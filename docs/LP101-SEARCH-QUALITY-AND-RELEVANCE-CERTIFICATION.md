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

## LP101.2 — automated visible-search certification

LP101.2 replaces the manual four-search and network-panel procedure with the asynchronous
`window.gridlyLp101VisibleSearchCertification?.()` helper. It opens the production destination-search
sheet, writes to the real search input, clicks the real Search button, waits for the rendered state,
reads the consumer-visible cards and message, selects the first actionable result through its real
click handler, verifies Route Preview, resets, and continues sequentially. It does not introduce a
test-only search pipeline or change routing.

The four cases and expectations are:

- `address`: the Dayton street address must reach the Gridly boundary with an HTTP/canonical response;
  either a valid exact result or a truthful canonical no-result is accepted, while an unrelated roadway
  shown as a successful Best Match fails.
- `business`: Walmart must be visibly relevant and carry Dayton, Liberty County, or appropriate nearby
  context; a roadway-only first result fails.
- `category`: a hospital or medical destination must be visible and must not be outranked by a roadway.
- `governed_destination`: the first visible result must preserve the governed Liberty courthouse.

The certification fails closed for missing sheet/input/action/results, a search timeout, missing boundary
evidence, HTTP 401/404/5xx or malformed/network evidence, direct upstream access, relevance or precedence
failure, misleading roadway fallback, or unavailable Route Preview. `safeToMerge` is true only when every
case, every required runtime check, and Route Preview pass.

Evidence remains in session memory through the LP101.1 recorder. The returned audit uses only safe case
labels, counts, booleans, and bounded check names. It does not return or persist raw queries, the complete
address, coordinates, credentials, response/provider payloads, or personal destinations.

### One-step production browser validation

1. Open Gridly and open DevTools Console.
2. Run exactly:

```js
await window.gridlyLp101VisibleSearchCertification?.()
```

3. Read the unmistakable PASS/FAIL line and concise case table. Merge only for
   `✅ LP101 VISIBLE SEARCH CERTIFICATION PASSED — SAFE TO MERGE` and a returned
   `safeToMerge: true`. Browser production behavior remains authoritative.

## LP101.3 — address fallback removal and business query recovery

### Address fallback root cause

Explicit address searches entered the shared result pipeline with local transportation seeds. Address ranking penalized approximate roads, but no minimum relevance gate removed them, so nearby highways could still appear under **Best matches** after the canonical boundary returned no result.

LP101.3 applies an explicit-intent relevance gate before the final visible list. An address candidate must be an exact address, agree with the parsed street, or match the normalized roadway identity. `County Road 677` and `CR 677` share an identity; unrelated US 90, TX 321, and FM 1960 do not. A canonical no-result now reaches the existing truthful no-result presentation instead of displaying roadway filler.

### Business query root cause

LP099 correctly classified `Dayton Walmart`, and LP101 correctly separated Dayton from Walmart, but the provider path sent only the normalized literal phrase. Explicit business searches also lacked a final target-term relevance floor, allowing proximity-only roads to remain visible when provider recall was weak.

LP101.3 preserves Walmart as the business target and Dayton as geographic context while constructing provider-independent variants for Walmart in Dayton, near Dayton, and in Liberty County. Every request still passes through the canonical Gridly boundary. The final relevance gate requires the business target in visible business results, allowing a remote Walmart result to survive while removing unrelated road filler. Existing Saved Place/governed boosts, community and county context, canonical confidence, and distance signals remain in the ranker.

### Preserved behavior and merge guidance

LP097 exact-address behavior, LP098 governed destinations, LP099 classification, the LP100 boundary, Hospital category search, Liberty Courthouse precedence, and Route Preview certification remain covered. No direct upstream browser request was added.

Browser certification: `await window.gridlyLp101VisibleSearchCertification?.()`

Merge only when the LP097–LP101.3 automated suite passes and the one-line browser certification reports `failedChecks: []`, `routePreviewVerified: true`, and `safeToMerge: true`.
