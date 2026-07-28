# LP100 — Gridly Geocoding Provider Boundary

## 1. Executive Summary
LP100 replaces destination/address/business browser calls to the public provider with `gridly-geocode`, a provider-neutral Supabase Edge Function. Local suggestions remain immediate; remote searches require Search or Enter. Source is complete but is **not deployment evidence**.

## 2. Browser-Confirmed Failure
The previous browser architecture exposed users to cross-origin rejection and provider HTTP 429 responses. Address intent and structured fields were valid; request ownership was not.

## 3. Current Direct-Browser Architecture
Before LP100, `app.js` built provider URLs and called them after a 350 ms input debounce. After LP100, destination search and Manage Places forward only canonical JSON to `gridlyGeocodingClient`. The remaining direct Nominatim call is reverse geocoding, separately inventoried at `gridlyReverseGeocode`; it is not destination search, but should be migrated in a later privacy milestone.

## 4. Public Provider Constraints
Public Nominatim is temporary and requires light use, identification, attribution, caching, no client autocomplete, and an aggregate maximum of one request/second. Moving uncontrolled traffic behind a proxy would not make it launch-ready. Expected production capacity is not approved.

## 5. Supabase Edge Function Architecture
The existing repository had migrations/config but no Edge Functions, CORS utility, CLI script, or deployment workflow. LP100 adds the conventional `supabase/functions/gridly-geocode/index.ts` and configures public invocation (`verify_jwt=false`); origin validation, input validation, and database governance remain mandatory. It can be served/deployed with the CLI or pasted into the Dashboard; it can be called anonymously or with the existing publishable key. Local serving requires Docker/Supabase CLI and environment values.

Browser → `gridlyGeocodingClient` → Supabase Edge Function → hashed cache/global lease → provider adapter → temporary public Nominatim.

## 6. Canonical Request Contract
`intent` is `address` or `business_place`; `query`, relevant `structuredAddress`, geographic `context`, `limit` (1–15), and a safe request ID are accepted. Unknown fields, controls, invalid ranges, bodies over 8 KiB, invalid methods/content types, and queries outside 3–200 characters are rejected. Address requests use structured fields when available; business/place requests use free-form `q`; they are never mixed.

## 7. Canonical Response Contract
Success includes `ok:true`, `status:"success"`, provider, `providerBoundary:"gridly"`, cache flag, request ID, and normalized results. Failure contains no provider detail: `invalid_request`, `rate_limited`, `provider_unavailable`, `provider_timeout`, `no_results`, or `configuration_error`, retry seconds, request ID, and an empty result list.

## 8. Provider Adapter
Provider name, URL, timeout, interval, attribution, and cache namespace live only in Edge configuration. Canonicalization isolates browser ranking from provider response shapes. LP097 continues its sequential maximum-three variant loop; no parallel fan-out was added.

## 9. Rate Governance
`gridly_reserve_geocode_provider_slot` atomically reserves database-backed slots spaced at least 1,000 ms apart across Edge instances. This is materially global after migration deployment—not an in-memory global claim. The Edge in-flight map reuses duplicate requests within an instance; the database cache handles cross-instance repeats. Timeout, 429/Retry-After response handling, and safe provider failures exist. The source does not prove the deployed database/function is active.

## 10. Cache Strategy
SHA-256 keys cover normalized intent/query/structured fields/context/limit/provider namespace; raw queries are not keys. The private RLS table stores only canonical results. Address TTL is 6 hours, place TTL 24 hours, and no-results TTL 60 seconds. Provider namespace changes invalidate logically. Expired records are ignored; operations should schedule `delete from gridly_geocode_cache where expires_at < now()` and enforce a deployment-specific record cap. This cache is infrastructure, not analytics.

## 11. Search Trigger Compliance
Typing searches Saved Places and governed/static seeds only. Search button or Enter initiates remote search. Focus/click cannot initiate remote traffic. This preserves local instant results without prohibited public-provider autocomplete.

## 12. CORS
Default allowed origins: `https://gridly.app`, localhost and 127.0.0.1 on ports 3000, 8080, and 5500. Production should set `GRIDLY_GEOCODE_ALLOWED_ORIGINS` to the exact deployed origin list. OPTIONS is supported. Unknown/missing origins receive no allow-origin header and a 403 canonical failure. No wildcard is used.

## 13. Privacy
Neither client nor function logs queries or full URLs. Runtime evidence contains request ID, intent, length bucket, status, cache state, count, and `queryRedacted:true`; it is memory-only. No query is written to browser storage or analytics. Hash keys are irreversible; bounded canonical cache payloads expire. Do not use private addresses in certification evidence.

## 14. Attribution
The map already renders OpenStreetMap attribution through Leaflet. Provider attribution is centralized in Edge configuration; do not add technical metadata to result cards. Confirm attribution visually after deployment.

## 15. Provider Switching
Change `GRIDLY_GEOCODE_PROVIDER`, `GRIDLY_GEOCODE_PROVIDER_URL`, and `GRIDLY_GEOCODE_CACHE_NAMESPACE`, then replace/extend the server adapter if response/request semantics differ. Browser code and LP097/LP099 ranking do not change.

## 16. Deployment
The owner's current VS Code Live Server origins are `http://127.0.0.1:5500` and `http://localhost:5500`. Include both in the comma-separated allowed-origin value when that development environment needs access. The deployed `GRIDLY_GEOCODE_ALLOWED_ORIGINS` secret remains authoritative.

PowerShell 5.1 copy/paste block (prompts keep secrets out of history/output):

```powershell
$ErrorActionPreference = "Stop"
npx supabase --version
npx supabase projects list
$ProjectRef = Read-Host "Supabase project ref"
npx supabase link --project-ref $ProjectRef
npx supabase db push
$AllowedOrigins = Read-Host "Comma-separated exact Gridly origins"
$UserAgent = Read-Host "Application identification (include contact URL/email)"
npx supabase secrets set GRIDLY_GEOCODE_ALLOWED_ORIGINS="$AllowedOrigins" GRIDLY_GEOCODE_USER_AGENT="$UserAgent" GRIDLY_GEOCODE_PROVIDER="nominatim" GRIDLY_GEOCODE_CACHE_NAMESPACE="nominatim-public-v1" --project-ref $ProjectRef
npx supabase functions serve gridly-geocode --no-verify-jwt
npx supabase functions deploy gridly-geocode --no-verify-jwt --project-ref $ProjectRef
$FunctionUrl = "https://$ProjectRef.supabase.co/functions/v1/gridly-geocode"
$Origin = ($AllowedOrigins -split ',')[0].Trim()
$Headers = @{ Origin=$Origin; apikey=(Read-Host "Publishable anon key"); Authorization="Bearer " + (Read-Host "Publishable anon key again"); "Content-Type"="application/json" }
Invoke-WebRequest -UseBasicParsing -Method Options -Uri $FunctionUrl -Headers @{Origin=$Origin;"Access-Control-Request-Method"="POST"} | Select-Object StatusCode,Headers
$Smoke = @{intent="business_place";query="Dayton City Hall";context=@{countyId="liberty-tx"};limit=3;requestId="lp100-production-smoke"} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri $FunctionUrl -Headers $Headers -Body $Smoke | Select-Object ok,status,providerBoundary,cached,@{n='resultCount';e={$_.results.Count}}
try { Invoke-WebRequest -UseBasicParsing -Method Options -Uri $FunctionUrl -Headers @{Origin="https://invalid.example";"Access-Control-Request-Method"="POST"} } catch { if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw }; "Unknown origin correctly rejected" }
```

Local serving is a separate terminal and may block; omit it only where Docker is unavailable. Dashboard deployment is possible by creating `gridly-geocode`, applying the SQL migration, adding the same secrets, disabling JWT verification, and deploying unchanged source.

## 17. Runtime Evidence
`gridlyGeocodingClient.evidence()` and the LP100 audit expose sanitized request attempted/received, status, cache hit/miss, result count, explicit-action trigger, provider category, and redaction. Result render/route handoff remains represented by existing destination audits; deployment certification must exercise them.

## 18. Browser Certification
Run only after deployment and the manual address/business/route exercises:

```js
(() => {
  const a = window.gridlyLp100GeocodingBoundaryAudit?.();
  const lp97 = window.gridlyLp097AddressResolutionAudit?.();
  const lp98 = window.gridlyLp098DestinationCoverageAudit?.();
  const lp99 = window.gridlyLp099BusinessSearchAudit?.();
  const checks = {
    helperExists: !!a, milestone: a?.milestone === "LP100", boundaryReachable: a?.gridlyBoundaryReachable === true,
    noDirectNominatim: a?.directBrowserNominatimSearchCount === 0,
    explicitRemoteAction: a?.remoteSearchExplicitActionObserved === true,
    canonicalResponse: a?.canonicalSuccessContractPass === true,
    cacheObserved: a?.runtimeEvidence?.some(x => x.event === "cache_hit"), privacy: a?.queryRedactionPass === true,
    addressThroughGridly: a?.addressSearchUsesGridlyBoundary === true, businessThroughGridly: a?.businessSearchUsesGridlyBoundary === true,
    routeHandoff: a?.routePreviewRegressionDetected === false, lp097: !a?.lp097AddressSearchRegressionDetected && !!lp97,
    lp098: !a?.lp098DestinationCoverageRegressionDetected && !!lp98, lp099: !a?.lp099BusinessSearchRegressionDetected && !!lp99,
    safeToMerge: a?.safeToMerge === true, safeForPublicLaunch: a?.safeForPublicLaunch === true
  };
  return { passed: Object.entries(checks).filter(([k]) => k !== "safeForPublicLaunch").every(([,v]) => v === true), checks, audit: a };
})()
```

The helper intentionally keeps `safeToMerge:false` until deployed evidence is incorporated into a follow-up commit. Public launch remains false until capacity and monitoring are approved.

## 19. LP097 Regression Results
Deterministic LP097 suites preserve address modeling, rural County Road normalization, three attempts, exactness ranking, and route handoff contracts. Live exact-address certification remains pending deployment.

## 20. LP098 Regression Results
The governed destination data was not modified. Its coverage suite remains the authority; live local-typing checks remain pending.

## 21. LP099 Regression Results
Business intent/ranking data was not modified. Provider canonical results are converted at one adapter point into the shape consumed by existing ranking.

## 22. Protected Systems
Shared Reports, Route Watch calculations, Awareness Filtering, hazard/alert lifecycle, report sync, historical intelligence, official sources, crossing interactions, Saved Places contracts, personalization/favorites, OSRM, reporting/notifications, LP098 records, dock, and map architecture were not changed.

## 23. Known Limitations
No deployment credentials or live endpoint evidence were available. `safeToMerge` therefore remains false. The public provider has no approved production capacity. Reverse geocoding still directly uses Nominatim and is an explicit separate-path blocker for a future complete provider-boundary/privacy claim. Retry-After is returned canonically and persisted as a database cooldown. Cleanup scheduling/monitoring remains operational work.

## 24. safeToMerge Decision
**False.** Static and deterministic source checks are not deployment/browser certification.

## 25. safeForPublicLaunch Decision
**False.** Temporary public Nominatim capacity is not approved and monitoring is not established.

## 26. Files Changed
Client adapter, destination trigger/app integration, HTML Search action, Edge Function, governance migration/config, LP100 tests, package script, and this document.

## 27. Tests Performed
Run `npm run test:lp100`, `npm run test:lp097`, `npm run test:lp0971`, `npm run test:lp0972`, `npm run test:lp098`, and `npm run test:lp099`. Run `git diff --check`. Browser/deployment checks remain pending.

## 28. Merge Recommendation
**Do not merge yet.** Deploy, verify approved/rejected CORS, run 390×844 incognito tests, repeat a public-safe query for cache evidence, confirm exact/business results and route preview, then update runtime evidence and `safeToMerge` in a deployment-certification follow-up. Do not approve public launch without adequate provider capacity, monitoring, and attribution review.

### Mobile portrait test sequence
1. At 390×844 in a fresh private session, filter Network for `nominatim`; expect no destination-search request. Filter `gridly-geocode`; expect none while typing.
2. Type `Dayton City Hall`; verify local results, then tap Search and observe one boundary request.
3. Manually enter the private test address, press Enter, select the exact result, verify preview, and confirm browser storage contains no query. Never paste it into audit output.
4. Explicitly search H-E-B, McDonald’s, Walmart Liberty, Buc-ee’s Baytown, and Houston City Hall; verify businesses outrank roads and route preview works.
5. Repeat a public-safe business query and inspect sanitized cache evidence.
6. Simulate canonical failures and verify consumer language. Recheck County Road, US 90, TX 146, Saved/Home/Work/Favorites, governed destinations, Route Watch, crossing focus, Reporting, and Awareness Filtering.

# LP100.1 — Deployed Boundary Certification Evidence Completion

## 1. Purpose
LP100.1 adds only a same-page, runtime-memory certification recorder for externally observed database governance and rejected-origin behavior. It does not test either system, send a request, persist evidence, or change search or Edge Function behavior.

## 2. Existing Deployed Evidence
The Gridly-owned endpoint is deployed and reachable, the migration is applied, destination requests cross the boundary, explicit-action and sanitized cache evidence are observable, and LP097–LP099 are regression-free. Those browser observations remain separate from the external SQL and rejected-origin observations below.

## 3. Global Provider Governance Verification
After a successful browser request through `gridly-geocode`, run exactly:

```sql
select
  provider_namespace,
  next_allowed_at,
  cooldown_until,
  now() as checked_at
from public.gridly_geocode_provider_state;
```

Certify only if at least one row exists, `provider_namespace` is `nominatim-public-v1`, `next_allowed_at` is non-null, and it reflects Edge Function reservation activity. Pass only the resulting booleans to JavaScript; never pass SQL row values.

## 4. Rejected-Origin Verification
Run this exact Windows PowerShell 5.1-compatible test:

```powershell
$FunctionUrl = "https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-geocode"

$Headers = @{
    "Origin" = "https://not-gridly.example"
    "Content-Type" = "application/json"
}

$Body = @{
    intent = "business_place"
    query = "Dayton City Hall"
    limit = 5
    requestId = "lp100-rejected-origin-test"
} | ConvertTo-Json -Depth 5

try {
    Invoke-WebRequest `
        -Uri $FunctionUrl `
        -Method POST `
        -Headers $Headers `
        -Body $Body `
        -UseBasicParsing

    Write-Host "❌ Unexpected: rejected origin was accepted." -ForegroundColor Red
}
catch {
    $response = $_.Exception.Response

    if ($response) {
        Write-Host "HTTP status:" ([int]$response.StatusCode)
    }

    if ($response -and [int]$response.StatusCode -eq 403) {
        Write-Host "✅ Unapproved origin was rejected with HTTP 403." -ForegroundColor Green
    }
    else {
        Write-Host "❌ Rejection occurred, but HTTP 403 was not confirmed." -ForegroundColor Red
    }
}
```

Record `rejectedOriginHttp403Observed: true` only when HTTP 403 is visibly confirmed. Do not record true for DNS or connection failure, timeout, 401, 404, 500, or any other status. Do not include credentials or paste the endpoint response body into the recorder.

## 5. Runtime-Only Recorder
`window.gridlyRecordLp100InfrastructureCertification(payload)` requires exactly all six governed fields and strict boolean values. It rejects missing, additional, string, query, URL, Origin/header, credential, coordinate, timestamp, and database-row fields. A valid call copies only the six booleans into module memory and returns the updated passive audit. Reloading recreates empty evidence.

## 6. Privacy Restrictions
The recorder performs no storage, IndexedDB, Supabase, analytics, network, or console operation. Never supply a query, private address, endpoint URL, Origin, headers, credentials or keys, SQL content, timestamps, or coordinates.

## 7. Browser Certification Sequence
Run the following only after (1) a successful Gridly boundary browser search in the same page session, (2) SQL provider-state verification, (3) visible HTTP 403 confirmation from the PowerShell test, and (4) no intervening reload.

```js
(() => {
  console.clear();

  const record =
    typeof window.gridlyRecordLp100InfrastructureCertification === "function"
      ? window.gridlyRecordLp100InfrastructureCertification({
          globalRateGovernanceVerified: true,
          rejectedOriginPass: true,
          providerStateRowObserved: true,
          providerNamespaceObserved: true,
          persistentReservationTimestampObserved: true,
          rejectedOriginHttp403Observed: true
        })
      : null;

  const audit =
    typeof window.gridlyLp100GeocodingBoundaryAudit === "function"
      ? window.gridlyLp100GeocodingBoundaryAudit()
      : record;

  const checks = {
    auditAvailable: !!audit,
    milestoneCorrect: audit?.milestone === "LP100.1" || audit?.milestone === "LP100",
    passive: audit?.passive === true,
    gridlyBoundaryConfigured: audit?.gridlyBoundaryConfigured === true,
    gridlyBoundaryReachable: audit?.gridlyBoundaryReachable === true,
    edgeFunctionDetected: audit?.edgeFunctionDetected === true,
    edgeFunctionDeployed: audit?.edgeFunctionDeployed === true,
    noDirectBrowserNominatim: audit?.directBrowserNominatimRemoved === true && Number(audit?.directBrowserNominatimSearchCount || 0) === 0,
    addressSearchUsesGridlyBoundary: audit?.addressSearchUsesGridlyBoundary === true,
    businessSearchUsesGridlyBoundary: audit?.businessSearchUsesGridlyBoundary === true,
    governedLocalSearchPreserved: audit?.governedDestinationLocalSearchPreserved === true,
    explicitRemoteActionAvailable: audit?.explicitRemoteSearchActionAvailable === true,
    explicitRemoteActionObserved: audit?.remoteSearchExplicitActionObserved === true,
    remoteAutocompleteDisabled: audit?.remoteAutocompleteDisabled === true,
    localWhileTypingPreserved: audit?.localWhileTypingSearchPreserved === true,
    providerAdapterAvailable: audit?.providerAdapterAvailable === true,
    providerSwitchingAvailable: audit?.providerSwitchingAvailable === true,
    structuredAddressSupportPreserved: audit?.structuredAddressSupportPreserved === true,
    businessPlaceSupportPreserved: audit?.businessPlaceSupportPreserved === true,
    corsConfigured: audit?.corsConfigured === true,
    approvedOriginPass: audit?.approvedOriginPass === true,
    rejectedOriginPass: audit?.rejectedOriginPass === true,
    rejectedOriginHttp403Observed: audit?.rejectedOriginHttp403Observed === true,
    requestValidationAvailable: audit?.requestValidationAvailable === true,
    requestRateGovernanceAvailable: audit?.requestRateGovernanceAvailable === true,
    globalRateGovernanceVerified: audit?.globalRateGovernanceVerified === true,
    providerStateRowObserved: audit?.providerStateRowObserved === true,
    providerNamespaceObserved: audit?.providerNamespaceObserved === true,
    persistentReservationTimestampObserved: audit?.persistentReservationTimestampObserved === true,
    duplicateInflightReuseAvailable: audit?.duplicateInflightReuseAvailable === true,
    cacheAvailable: audit?.cacheAvailable === true,
    cachePrivacyPass: audit?.cachePrivacyPass === true,
    retryAfterHandlingAvailable: audit?.retryAfterHandlingAvailable === true,
    providerTimeoutAvailable: audit?.providerTimeoutAvailable === true,
    providerCooldownAvailable: audit?.providerCooldownAvailable === true,
    noRawQueryLogging: audit?.rawQueryLoggingDetected === false,
    noRawQueryPersistence: audit?.rawQueryPersistenceDetected === false,
    queryRedactionPass: audit?.queryRedactionPass === true,
    canonicalSuccessContractPass: audit?.canonicalSuccessContractPass === true,
    canonicalFailureContractPass: audit?.canonicalFailureContractPass === true,
    lp097RegressionFree: audit?.lp097AddressSearchRegressionDetected === false,
    lp098RegressionFree: audit?.lp098DestinationCoverageRegressionDetected === false,
    lp099RegressionFree: audit?.lp099BusinessSearchRegressionDetected === false,
    routePreviewRegressionFree: audit?.routePreviewRegressionDetected === false,
    routeWatchRegressionFree: audit?.routeWatchRegressionDetected === false,
    infrastructureCertificationRecorded: audit?.infrastructureCertificationRecordedThisSession === true,
    publicLaunchStillBlocked: audit?.safeForPublicLaunch === false,
    productionCapacityStillUnapproved: audit?.productionProviderCapacityApproved === false,
    safeToMerge: audit?.safeToMerge === true
  };

  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  console.table(checks);
  console.log("Full LP100.1 audit:", audit);

  if (failedChecks.length) {
    console.error("❌ LP100.1 BROWSER CERTIFICATION FAILED", failedChecks);
    return { passed: false, failedChecks, audit };
  }

  console.log("✅ LP100.1 BROWSER CERTIFICATION PASSED — SAFE TO MERGE");
  return { passed: true, failedChecks: [], audit };
})();
```

## 8. safeToMerge Decision
The audit is fail-closed. `safeToMerge` can become true only when same-session endpoint and explicit-action evidence, all pre-existing LP100 contracts/regressions, all provider-state observations, and confirmed rejected-origin HTTP 403 evidence pass.

## 9. safeForPublicLaunch Decision
**False.** `temporaryPublicNominatimUpstream` remains true and `productionProviderCapacityApproved` remains false; operational monitoring and launch-scale provider approval remain pending.

## 10. Known Limitations
The recorder records human-verified outcomes; it cannot independently inspect SQL or forge a browser Origin test. Evidence is intentionally lost on reload. Public launch, monitoring, capacity, and the separately inventoried reverse-geocode path remain outside this certification.

## 11. Tests Performed
Run `npm run test:lp100`, LP097/LP097.1/LP097.2/LP098/LP099 suites, JavaScript syntax checks, and `git diff --check`. The LP100 suite covers strict schema/privacy rejection, fail-closed derivation, complete evidence, session-only state, preserved evidence, and the permanent public-launch block.

## 12. Files Changed
Only the LP100 passive audit/recorder in `js/app.js`, deterministic LP100 tests, and this certification document change. Search, Edge Function, database schema, migrations, and protected systems are untouched.

## 13. Merge Recommendation
Recommend merge only after the live sequence above returns `passed: true`, `safeToMerge: true`, and `safeForPublicLaunch: false`. Repository tests alone do not assert that the external checks were performed.
