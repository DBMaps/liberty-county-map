# LP101 — Search Quality & Relevance Refinement

## Executive summary

LP101 adds a small browser-side quality layer to the existing destination search pipeline. It normalizes everyday brand and roadway wording, applies a conservative correction list for high-confidence common typos, recognizes common destination categories before generic matching, separates known community terms from destination terms, and adds confidence-, governance-, distance-, category-, and community-aware ranking signals.

## Architecture and performance

The Gridly geocoding client, Edge Function, canonical response, provider abstraction, caching, governance, and routing remain unchanged. Normalization happens before the existing request is evaluated and does not add a request or provider. Ranking reads only Gridly's normalized browser result model. No provider-specific response field is introduced into the UI.

## Search behavior

- Brand variants include H-E-B / H E B, Wal Mart, and McDonald's.
- Road variants include CR / County Road, FM / Farm Road, Hwy / Highway, and U.S. / US.
- A deliberately small correction map covers `mcdonlds`, `walmartt`, `hopsital`, and `libary`; arbitrary fuzzy matching is not used.
- Category intent covers medical care, education, airports, fuel, government and civic services, public safety, worship, parks, libraries, DMV, tax offices, and post offices.
- Known community tokens are separated from destination terms for mixed searches such as `Dayton Walmart`.
- Saved and governed places retain precedence; category fit, explicit community fit, canonical confidence, proximity for “nearest,” and stable input order resolve remaining matches.

## Browser certification

`window.gridlyLp101BrowserCertification()` reports normalization, typo, category, and multi-term checks; canonical use and provider independence; zero additional requests; protected-system status; and `safeToMerge`.

## Merge recommendation

Merge when the LP097–LP101 contract suite passes and browser smoke validation confirms the search drawer remains visually unchanged and responsive.

## LP101.1 — runtime recovery and corrected certification gap

### Discovered failure and root cause

LP101 validation initially returned `safeToMerge: true` even though real destination searches received HTTP 404 from `POST /functions/v1/gridly-geocode`. That result was a false positive: the LP101 helper certified only deterministic normalization/ranking behavior and treated zero added requests as success. It did not consume actual boundary request evidence.

Repository and linked-project evidence agree on the intended boundary: the source directory is `supabase/functions/gridly-geocode`, `supabase/config.toml` configures `gridly-geocode` with `verify_jwt=false`, `.temp/project-ref` identifies project `nhwhkbkludzkuyxmkkcj`, and the browser client calls that project's `/functions/v1/gridly-geocode` path. LP100.1 source, migration, and deployment documentation remain present. No LP101 commit changed the project URL or function slug. The service worker does not synthesize an Edge response, although its shell cache and the client script version are advanced in this recovery to prevent an old client asset from masking the corrected recorder.

The production 404 therefore identifies a deployment-state gap: the expected function was absent from the linked production project (or its prior deployment was removed), rather than an alternate canonical slug. The application must not add a second path or call the upstream provider directly.

### Exact recovery and deployment status

The canonical no-result response now uses HTTP 200, so HTTP 404 unambiguously indicates a missing function instead of a valid no-result. Deploy the existing function source unchanged in slug with:

```bash
npx supabase functions deploy gridly-geocode --no-verify-jwt --project-ref nhwhkbkludzkuyxmkkcj
```

The deployment was **not completed from this environment**: outbound access to the Supabase/npm path was rejected by the environment proxy and no authenticated production function listing or deployment was possible. Denise must run the command above from an authenticated Supabase CLI environment. The LP100 migration and required function secrets described in the LP100 deployment document must also be present. A code-only fallback is intentionally not provided.

### Runtime evidence and consumer behavior

The client keeps session-memory-only evidence for each real request. Records contain only timestamp, request/intent type, endpoint origin, function slug, HTTP status, success flags, canonical success/failure flags, a bounded failure code, boundary-use confirmation, and direct-provider detection. They never contain the query, address, coordinates, headers, credentials, or provider payload.

The LP101.1 helper distinguishes configuration, attempt, reachability, HTTP success, canonical success, canonical failure, HTTP 404, provider independence, and absence of direct upstream requests. It fails closed for missing evidence, 401, 404, 5xx, network failure, malformed/noncanonical data, and direct provider access. A canonical `no_results` response is valid boundary evidence but remains a consumer no-result, not a geocoded success.

When an explicit address or business/place search encounters boundary failure, ordinary local road seeds are removed rather than presented as address matches. Independently matching Saved Places and LP097 governed destinations may remain, accompanied by the consumer-safe message, “Search is temporarily unavailable. Please try again.” Routing and the canonical Gridly response model are unchanged.

### Browser-first validation (required after deployment)

Use a fresh/private browser session, select the production deployment, open DevTools Network, and perform these user-triggered searches through the visible search UI in order:

1. `274 County Road 6`
2. `Dayton Walmart`
3. `Hospital`
4. `Liberty Courthouse`

For every remote attempt, confirm a request to `/functions/v1/gridly-geocode`, no HTTP 404/401/5xx, and a canonical JSON response with `providerBoundary: "gridly"`. Confirm the address does not become an ordinary road-only match, governed destinations remain preferred where applicable, business search works, selecting a result still opens route preview, and the Network panel contains no browser search request to the upstream provider.

Then run:

```js
(() => {
  const audit = window.gridlyLp101BrowserCertification?.();
  const checks = {
    milestone: audit?.milestone === "LP101.1",
    configured: audit?.boundaryConfigured === true,
    attempted: audit?.boundaryRequestAttempted === true,
    reachable: audit?.boundaryReachable === true,
    httpSuccess: audit?.httpSuccessObserved === true,
    canonical: audit?.canonicalSuccessResponseObserved === true || audit?.canonicalFailureResponseObserved === true,
    no404: audit?.http404Observed === false,
    providerIndependent: audit?.providerIndependentResponseConfirmed === true,
    noDirectProvider: audit?.directUpstreamBrowserRequestsAbsent === true,
    protectedSystems: audit?.protectedSystemsUnchanged === true,
    safeToMerge: audit?.safeToMerge === true
  };
  const failedChecks = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
  console.table(checks);
  console.log("Privacy-safe LP101.1 evidence", audit?.runtimeEvidence);
  return { passed: failedChecks.length === 0, failedChecks, audit };
})();
```

Browser certification is not complete until all four visible searches and route preview are manually observed and the block returns `passed: true`. Static tests cannot override a real HTTP failure. LP100's Browser → Gridly Edge Function → provider adapter → provider → canonical response architecture remains unchanged.

### Merge recommendation

**Do not merge based on repository tests alone.** Deploy the function, complete the four-search production sequence, and merge only if the exact browser block passes with no misleading fallback and no direct upstream browser request.
