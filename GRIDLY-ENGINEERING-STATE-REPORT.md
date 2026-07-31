# Gridly Engineering State Report

**Baseline date:** 2026-07-31

**Repository baseline:** `4cd0402512b9e1d2f874d4f446cce4f1c597af45` (merge of LP105.2 browser certification follow-up)

**Selected task branch:** `LP105.3-—-Gridly-Engineering-State-Report`; the Codex checkout is the temporary branch `work`.
**Evidence labels used below:** **Repository fact** means current code/configuration; **artifact/test evidence** means a checked-in artifact or a test run; **documented intent** means a project document or owner-supplied milestone record; **runtime finding** means the supplied browser/deployment observation; **deferred** means deliberately inactive; **recommendation/inference** is explicitly identified.

## 1. Executive Status

Gridly is a mobile-portrait-first, consumer-facing Texas travel-awareness web application: it combines community reports, hazards, official roadway/weather context, rail crossings, destination search, Route Watch, and governed geocoding around **Know Before You Go**. Its posture remains **Awareness Platform First, Route Intelligence Second**.

The current repository baseline has 28 production crossing packages, 28 operational county configurations, curated and business/place search, a Supabase geocoding boundary, strict LP102 rural-address acceptance, a complete 28-county TxGIO address manufacturing cohort, PWA infrastructure, and a Liberty-only server-side certified-address adapter. LP105.1 and LP105.2 implementation commits are merged into this baseline; the supplied deployment record says `gridly-geocode` was deployed. The 28 address packages are manufactured but `activated: false` as a cohort; LP105.2 attempts only Liberty consumption.

**Current active milestone:** LP105.3 documents the baseline. **Not operational:** live Liberty certified results are not reaching the browser, directional display is paused, and push/background location are not proven active. **Highest-priority blocker:** the deployed Edge Function reaches the governed boundary but does not return the locally certified Liberty result; repository evidence does not prove that its configured/default public artifact host serves the certificate and gzip package. Fallback continuation then exposes misleading provider results. This is a runtime/artifact-access divergence, not evidence that LP102 or the package build is defective.

## 2. Product Mission and Operating Principles

The controlling product principles are:

* **Know Before You Go**; **Awareness Platform First; Route Intelligence Second**.
* Design and certify mobile portrait first, using consumer language rather than provider, database, or geospatial jargon.
* Maintain a privacy-minimizing posture: explicit remote search, sanitized diagnostics, no raw-query diagnostic persistence, and no private-address seed fixtures.
* Express uncertainty truthfully. Fail closed when authority, exactness, containment, or artifact integrity is absent; never turn interpolation, a nearby number, or a road into an exact home.
* Audit first and patch second; preserve stable systems and avoid frameworks. Prefer a premium, calm experience over feature density.

These are **documented intent** reinforced by current acceptance gates and audits. They are constraints, not claims that every live provider response is currently relevant.

## 3. Owner Workflow and Delivery Model

The established owner workflow is: Denise owns the project; works in Windows PowerShell 5.1 and VS Code; creates GitHub branches; and supplies one standard copy/paste Codex block. Codex Cloud uses the selected GitHub branch even when its local checkout reports `work`, prepares implementation and PR metadata, and Denise opens/creates the PR when the environment requires it. GitHub performs the merge; Denise then pulls the merged branch or `main` locally and runs the Node tests.

Supabase functions are deployed from an authenticated owner environment with:

```powershell
npx supabase functions deploy <function>
```

Runtime milestones require browser-console certification after deployment. Every Codex handoff must give (1) a quick summary, (2) a merge recommendation, and (3) exact testing steps.

## 4. Current Architecture

* **Client:** a framework-free static application in `index.html`, `css/styles.css`, and JavaScript led by `js/app.js`. Leaflet 1.9.4 is loaded from unpkg; map attribution and provider configuration identify OpenStreetMap.
* **Data/services:** Supabase supplies synchronization and Edge Functions. `js/gridly-geocoding-client.js` posts canonical address/business requests to project `nhwhkbkludzkuyxmkkcj`, and `supabase/functions/gridly-geocode/index.ts` owns provider calls, cache/rate governance, registry/index checks, strict evaluation, and the LP105.2 adapter.
* **Boundary:** the browser normalizes intent, assembles requests, merges/ranks candidates, renders consumer states, and hands accepted coordinates to Route Preview. The server validates requests, protects upstream-provider access, resolves governed sources, and returns a canonical response. The browser does not load the LP105.2 package.
* **Generated strategy:** county roads, crossings, boundaries, destinations, and addresses are generated/static packages with manifests or certificates. Source availability, manufacturing, certification, runtime consumption, and activation are separate gates. A local artifact is not automatically a deployed asset.
* **PWA:** `manifest.json`, PNG icons, and `service-worker.js` exist. The service worker caches a deliberately small shell and county geometry, performs network-first navigation, removes recognized old caches, and accepts version/skip-waiting messages.
* **Controlled activation:** county registries and manifests govern supported context. LP105.1 explicitly did not activate its manufactured address cohort; LP105.2 hard-codes only Liberty identity/eligibility in the shared server adapter.
* **Hosting evidence:** no GitHub Pages/site-deploy workflow is checked in. The only workflow builds temporary `www` and Capacitor assets and copies `data`; it does not publish a website. Therefore a production application host is not established by workflow evidence.

## 5. Protected Systems

Future work must not regress Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase synchronization, production crossing runtime, business search, curated destinations, the governed provider boundary, LP102 exact-address acceptance, truthful no-result behavior, the mobile portrait experience, onboarding, PWA install/update behavior, or privacy-safe diagnostics. LP105.2 specifically preserves business/curated paths and continues the existing provider chain only when certified evidence is unavailable rather than falsely promoting it.

## 6. Geographic Coverage

The configured 28-county product cohort is **Austin, Brazoria, Brazos, Calhoun, Chambers, Colorado, Fayette, Fort Bend, Galveston, Grimes, Hardin, Harris, Jackson, Jasper, Jefferson, Lavaca, Liberty, Matagorda, Montgomery, Newton, Orange, Polk, San Jacinto, Tyler, Walker, Waller, Washington, and Wharton**. Current runtime configuration reports 28 operational counties; community configuration is broader than county-only identities and includes a Houston regional/subcommunity model. The repository contains many community/awareness identities (the application computes the authoritative count at runtime); no stable checked-in summary proving a single exact current community total was found, so this report does not invent one.

Coverage stages must not be conflated:

| Stage | Meaning | Current evidence |
|---|---|---|
| Source availability | Official source contains potentially usable records | TxGIO 2026 statewide source is documented; the owner-supplied completed inventory count is 12,142,647 across 254 counties, but the repository's `data/generated/lp105/README.md` says that real inventory output was not committed. |
| Manufacturing | Deterministic county gzip exists | 28/28 address packages and 28/28 crossing packages. |
| Certification | Artifact was evaluated against its contract | 28 address package/runtime certificates; 24 address certifications pass and four carry findings. Crossings: 28 pass, zero blocked. |
| Runtime consumption | Executing code reads an artifact | Crossings are consumed; LP105.2 code attempts Liberty address consumption server-side. |
| County activation | Product allows that source for a county | Address manufacturing report says `activated: false`; Liberty alone is explicitly eligible in LP105.2. |

Crossing evidence totals **3,771 certified production crossings**. Address package availability is 28 counties, but current certified runtime consumption is not equivalent to 28-county activation.

## 7. Search System

1. The destination input supports local suggestions while typing; remote search requires explicit Search/Enter.
2. Search governance normalizes whitespace, punctuation, roadway aliases, geography, and identities, then detects category, business/place, and complete address intent.
3. Curated candidates come from governed LP097/LP098 destination datasets; saved/local items remain immediate. Business candidates come through LP099 logic and the provider boundary. Residential/provider candidates arrive from the canonical server response.
4. Candidates are normalized into a common shape, deduplicated, geographically assessed, and ranked. Active community/county and Texas relevance outrank unqualified distant results while explicit out-of-area intent remains possible.
5. Address candidates pass LP102 exact-number, canonical-road, geography, containment, supported-county, and precision acceptance before final rendering. Rejected provider fallbacks must not enter the visible candidate pipeline.
6. Final rendering produces cards or a truthful no-result state. Route Preview is eligible only after an accepted candidate supplies valid coordinates.

These are distinct paths: **curated destination search** is checked-in governance data; **business/place search** depends on live provider completeness; **residential search** applies stricter intent and exactness; **governed provider search** crosses the Edge boundary; **certified package search** is the Liberty adapter ahead of existing providers; and **fallback providers** may continue only on adapter unavailability, never as certified evidence. The current browser finding demonstrates that fallback relevance still needs enforcement in the live path.

## 8. Address Platform Evolution

### LP097
Objective: compliant address resolution plus Liberty destination expansion. Implementation added address intent, rural normalization, controlled provider queries, common classification/ranking, consumer failure states, and governed destinations. Tests and later browser evidence verified pipeline wiring, exact labels, route handoff, deduplication, and geography safeguards; initial live provider testing was unavailable. It introduced explicit-search/privacy and truthful classification protections. **Status: active foundation, extended by later milestones.**

### LP098
Objective: 28-county curated destination coverage. It introduced county-neutral governance and certification fixtures. The checked-in certification documents 153 curated destinations, exactly 28 counties, unique IDs/coordinates, and required category coverage. **Status: active; destination coverage, not residential address coverage.**

### LP099
Objective: business/place capability without shipping a massive business snapshot. It added business intent, provider-backed candidates, ranking/deduplication, and representative browser/Node certification. **Status: active; live completeness and relevance remain provider-dependent.**

### LP100
Objective: remove browser-to-public-geocoder destination calls. It added the `gridly-geocode` Supabase Edge Function, canonical contracts, CORS, caching, rate governance, attribution, privacy evidence, and explicit-action triggers. Source existence was explicitly not deployment proof. **Status: active governed boundary; later milestones extended it.**

### LP101
Objective: visible search quality/relevance. LP101 and its follow-ups repaired runtime recovery, fallback/no-result behavior, candidate-pipeline agreement, and visible certification. Node and browser helpers protect final-state rather than merely server-response behavior. **Status: active; older pre-repair failure statements are superseded by later code, except where a current live observation reproduces a problem.**

### LP102
Objective: investigate and safely resolve rural aliases without false exactness. Model A implemented strict house/road/geography/precision/containment evaluation and privacy-safe rejection evidence. Subsequent commits repaired certification scope and diagnostic propagation, not the core acceptance rule. **Status: active protected contract.**

### LP103
Objective: authoritative rural resolution where general providers cannot prove an address. It added a governed verified-address registry and resolution hierarchy. LP103.1 added pending/verified/revoked enrollment, approval tooling, consumer eligibility, and precision governance. **Status: active foundation; population/deployment remains operationally separate.**

### LP104
Objective: county-neutral Texas rural resolution and source/package foundations. LP104 made 254-county/FIPS inventory, normalization, build, certification, and controlled activation separate. Its early document honestly reports zero coverage before acquisition; that state is **superseded** by later TxGIO packages, not silently reconciled.

### LP104.1
Objective: Texas statewide open-address schema/storage foundation. It added migrations, normalized record/lookup contracts, source/license gating, coverage ledgers, and fail-closed activation. **Status: active architecture, extended by TxGIO manufacturing.**

### LP104.2
Objective: safe NAD R23 discovery/ingestion design. It delivered bounded inspection tooling but recorded the archive unavailable. **Status: superseded as the selected manufacturing route by the later official TxGIO 2026 source; its safety lessons remain relevant.**

### LP104.5
Objective: consume the certified Liberty TxGIO package without startup/business/non-Liberty loads. The browser-era runtime validated identity, bytes/hash, decompressed once, indexed exact keys, and reused the promise. **Status: package/certificate contract remains active; LP105.2 supersedes direct browser package loading with server-owned scanning.**

### LP105.1
Objective: resumable manufacture/certification of all 28 Gridly counties. It produced 28 packages, 28 package certifications, 28 runtime certificates, a candidate manifest, and a 24-pass/four-finding report without activation. **Status: complete manufacturing evidence; not runtime rollout.**

### LP105.2
Objective: server-side Liberty certified-address consumption through the existing boundary. It added the shared adapter, Edge orchestration, focused tests, diagnostics, and browser helper. Code is merged and the function was reportedly deployed, but supplied browser certification fails because certified exact/alias results are absent. **Status: implemented and deployed, not operationally certified.**

## 9. Texas Address Source and Manufacturing Platform

The project identifies the official **TxGIO 2026 statewide Address Points** FileGDB at `C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb`. The owner-supplied completed inventory finding is **12,142,647 address points across all 254 Texas counties**. Because the checked-in LP105 README explicitly says no real inventory was run in this repository environment, that total is **documented runtime/owner evidence**, not reproducible from a committed statewide report here.

The selected schema carries numeric county FIPS, house number, street components/assembled road, full address, postal community, ZIP, county, source/update provenance, and point geometry. The deterministic builder transforms geometry to WGS84 and writes gzip JSON Lines. Compact keys are `i` ID, `h` house, `r` road, `a` full address, `p` postal community, `z` ZIP, `c` county, `f` FIPS, `x/y` geometry, `s` source, and `u` update date. Duplicate deterministic IDs are counted and omitted; invalid incomplete/non-point records are rejected rather than inferred.

Manufacturing is resumable/checkpointed and produces manifests, package certificates, runtime certificates, byte sizes, and SHA-256 hashes. The checked-in cohort report records 28 completed package paths, and the filesystem contains 28 certification JSON files plus 28 runtime-certificate JSON files. However, only the Liberty gzip is present in this checkout under `data/generated/lp104/txgio-addresses`; the other 27 gzip payloads are not locally available for independent byte/hash verification. Thus **28/28 manufactured** is report/certificate evidence, while **1/28 package payloads locally present** is the final filesystem fact. Filesystem existence and hashes outrank stale summary wording.

**Liberty facts:** source records **82,444**; accepted/indexed **82,443**; rejected **0**; duplicates omitted **1**; package `liberty-48291.addresses.jsonl.gz`; size **2,555,016 bytes**; SHA-256 `792f4f3f76524ef6652fbabf7c1c17d76eb1dfd9d83a71c460c1e038c2841b93`; runtime certificate `liberty-48291.runtime-certificate.json`.

## 10. LP102 Strict Acceptance Contract

An exact numbered result requires exact normalized house number, exact canonical road identity, agreement with supplied locality, ZIP, county and state evidence, valid coordinates inside the supported Texas region/county context, a supported county, and an approved address precision. Missing or conflicting evidence fails closed. Interpolation is never promoted as exact; nearby-number substitution, road-only promotion, and misleading fallback are rejected. Route Preview becomes eligible only after acceptance.

Canonical certification pair:

```text
274 County Road 677, Dayton, TX 77535 → truthful_no_result
276 County Road 677, Dayton, TX 77535 → exact_match
```

## 11. LP105.1 Manufacturing Status

Artifact evidence records **28/28 packages, 28/28 package certificates, 28/28 runtime certificates**, `completedCount: 28`, `successCount: 24`, and `failureCount: 4`. All four are certification findings, **not missing-package failures**:

* Brazoria: exact sample and canonical alias failed.
* Harris: runtime load was 8,583.3569 ms, above 5,000 ms.
* Walker: exact sample and canonical alias failed.
* Washington: exact sample and canonical alias failed.

The manufacturing report says `activated: false`; later activation must not infer that artifact existence equals consumer readiness.

## 12. LP105.2 Runtime Architecture

`js/gridly-geocoding-client.js` sends the browser's canonical request to `gridly-geocode`. `execute()` calls `lookupLibertyCertifiedAddress()` before the database/provider chain. Eligibility requires address intent and a leading exact house number plus Liberty evidence: FIPS `48291`, county ID `liberty-tx`, county Liberty, or Dayton **and** ZIP 77535. Any supplied conflicting FIPS, county ID/name, city, or ZIP rejects eligibility.

The adapter fetches `liberty-48291.runtime-certificate.json`, requires the exact identity/acceptance fields, then fetches `liberty-48291.addresses.jsonl.gz`, verifies **2,555,016 bytes** and the expected SHA-256, streams gzip decompression, and parses JSONL. It scans records for FIPS, exact normalized house, canonical road, postal locality, and ZIP; creates government-address-point candidates; and the Edge Function reuses LP102 `evaluateRuralCandidate()` before response. Exact certified candidates return success; a valid scan without a match returns canonical `no_results`/truthful no-result and stops substitution. Artifact/certificate/read/decompression failure returns `package_unavailable`, after which the existing governed provider chain continues. Business, curated, startup, and non-Liberty requests do not qualify. Diagnostics expose outcomes/timing/source without UI address data.

**Important correction to milestone shorthand:** this is not a bounded indexed lookup. It applies bounded exact filters while **stream-scanning the full compressed Liberty package for every eligible request**; no server cache or early termination appears in the adapter. LP104.5's browser index/promise reuse was superseded by this server scan.

## 13. LP105.2 Automated Test Status

Verified locally for this report: LP105.2 focused tests, LP099, LP101, LP102, LP104, LP104.5, and LP105.1 pass. Together they prove the checked-in contracts, adapter eligibility/conflicts, certificate/hash enforcement using fixtures, exact/alias/missing-number behavior, browser non-loading, provider continuation, search regression protection, deterministic manufacturing orchestration, and strict acceptance logic.

They do **not** prove public artifact reachability, deployed Edge access to an artifact host, actual browser output, deployment/configuration parity, or live fallback relevance. LP105.2 is the concrete example: adapter tests pass while browser certification fails.

## 14. LP105.2 Browser Certification Helper

Helper: `window.gridlyLp1052RuntimeAddressCertification`

Command:

```javascript
await window.gridlyLp1052RuntimeAddressCertification?.()
```

It executes the production client/boundary path for exact 276, missing 274, `County Rd`, `CR`, and `Co Rd` aliases, the road-only `County Road 677, Dayton, TX`, and the `Dayton Walmart` business control. It checks boundary use, exact point/number/road agreement, no nearby substitution, no road-only residential promotion, and business path preservation.

## 15. Current Browser Runtime Finding

**Known runtime finding supplied for certification:** `providerBoundaryPreserved: true`, `exactHouseNumberRequired: false`, `canonicalRoadRequired: false`, `nearbyNumberSubstitutionAbsent: true`, `roadOnlyPromotionAbsent: false`, `businessPathPreserved: true`, `passed: false`, `safeToMerge: false`.

* **Exact —** `276 County Road 677, Dayton, TX 77535`: `no_results`, provider `gridly-geocode`, source `none`; failed.
* **Missing nearby number —** `274 County Road 677, Dayton, TX 77535`: `truthful_no_result`; passed.
* **County Rd alias —** no results; failed.
* **CR alias —** primary geocoder returned `276, Webb Road, Dayton, Liberty County, Texas, 77535`; number agreed but canonical road did not; failed.
* **Co Rd alias —** no results; failed.
* **Road only —** `County Road 677, Dayton, TX`: primary geocoder returned `677, County Road 6681, Dayton, Liberty County, Texas, 77535`; the browser helper classified it as an exact residential result; failed.
* **Business control —** a business/place result existed, but it was a Walmart in Dayton, Ohio; path preservation passed while geographic relevance did not.

This proves the browser reaches the governed Edge Function, the certified Liberty result is not returned, fail-closed adapter behavior permits fallback continuation, fallback can still mislead, and Node success is not live-runtime success. It does **not** prove LP102 is broken, or that the package, certificate, or builder is corrupt.

## 16. Current Artifact and Certificate Reality

Tracked local files:

* `data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz` — exists, tracked, **2,555,016 bytes**, SHA-256 `792f4f3f76524ef6652fbabf7c1c17d76eb1dfd9d83a71c460c1e038c2841b93`.
* `data/generated/lp104/txgio-addresses/liberty-48291.runtime-certificate.json` — exists, tracked, **463 bytes in this checkout**.

The task input stated 480 certificate bytes, but direct `stat` reports 463; this report retains the verified filesystem result rather than silently reconciling the contradiction. Certificate file size is not part of the LP105.2 identity check. `liberty-48291.addresses.jsonl.gz.json` is **not** the LP105.2 runtime certificate filename.

## 17. Current Hosting and Artifact Access Reality

The Edge Function takes its artifact base from environment variable `GRIDLY_CERTIFIED_ADDRESS_BASE_URL`; absent that, it defaults to hard-coded `https://gridly.app`. The same hostname is in the default CORS allowlist, but repository ownership/deployment configuration does not prove that the hostname belongs to or publishes this checkout. The browser endpoint proves a Supabase project/function URL, not a static artifact host.

The only GitHub Actions workflow is Capacitor validation. It copies `data` into temporary `www`/Android assets but has no deploy job. There is no GitHub Pages workflow or other checked-in public hosting workflow establishing that `data/generated` is published. Network availability of the two deployed artifact URLs was not established by repository evidence.

**Current public artifact host not proven from repository evidence.** The exact supported operational blocker is: the deployed runtime did not return the certified Liberty record, while its server adapter depends on an unproven public base URL serving the exact certificate and gzip. Artifact host reachability/configuration and deployed-function diagnostics must be observed before assigning a narrower root cause.

## 18. Supabase Deployment Status

The owner-supplied deployment record says the Supabase CLI was invoked through `npx`; `gridly-geocode` deployed successfully to project reference `nhwhkbkludzkuyxmkkcj`; Docker was not required for remote deployment; an initial HTTP 502 was retryable; and the second deployment succeeded. This is **known deployment/runtime evidence**, not a secret-bearing repository artifact. No secrets are reproduced here.

## 19. Crossing Platform

The production manifest verifies **28 packages, 3,771 crossings, 28 pass, zero blocked**. Liberty's production package contains **115** crossings and is wired into runtime. Visibility governance retains public-roadway crossings and hides private, industrial, rail-yard, and temporary-access classifications. Current Liberty locality evidence records Dayton **30**, Liberty **31**, and Cleveland **24**. Locality promotion remains governed by package/runtime evidence; it must not override public-road classification or county containment.

## 20. Awareness, Alerts, Hazards, and Trust

Current code retains consumer-language alert cards/hazard popups, awareness-area filtering, synchronized reports, hazard lifecycle/clear-state convergence, and cleared-hazard persistence. Trust presentation combines official/community provenance, participation acknowledgement, community evidence, recency, reasonableness, reinforcing/conflicting signals, and uncertainty language; it avoids provider/database jargon in consumer surfaces. Missing evidence fails closed to calm/uncertain explanations rather than predictions.

The requested `GRIDLY-TRUST-RESOLUTION-POLICY-V1-(DRAFT).txt` is not present in this checkout. The Trust Resolution Policy must therefore be treated as **draft/unimplemented intent**, not an active policy, unless a newer implementation is separately proven.

## 21. Directional Intelligence

The repository contains a complete directional service/model foundation, containment/governance evidence, prototypes, and runtime assets, but no approved consumer NB/SB/EB/WB display. Directional display is paused and must not restart without explicit owner direction.

Latest evidence is not a single uniform status: older V713 readiness marked US 90, TX 146, FM 1960, FM 1409, FM 1011, and TX 321 not ready before extraction; later source/runtime artifacts now exist for US 90, TX 146, FM 1960, and the I-69/US 59 prototype. **US 59/I-69** is the empirically validated prototype/readiness basis; **US 90, FM 1960, and TX 146** have later runtime assets but remain display-inactive; **FM 1409, FM 1011, and TX 321** have no proven promoted directional runtime in the inspected assets. None is authorized for directional UI. Older “missing inventory” statements are historical wherever a later runtime asset exists, but do not become display approval.

## 22. PWA and Distribution Status

`manifest.json` is installable-shaped (`standalone`, scoped start URL, 192/512 and maskable icons), linked from `index.html`, and backed by a service worker. The worker implements shell/geometry caching, navigation fallback, cache cleanup, version reporting, and skip-waiting support. Application code includes install/update prompt handling; browser installability still depends on HTTPS, valid serving, and browser criteria and was not live-certified here.

The current distribution baseline is web/PWA. Capacitor Android/iOS scaffolding and CI validation show future native packaging work, but do not prove app-store release; iOS validation is explicitly deferred to macOS. Older app-store plans are therefore deferred/superseded as current delivery claims. Push-notification toggles/copy do not establish a push subscription/service-worker push handler, and no such operational implementation was proven. Background location is likewise not proven operational; privacy-preserving explicit/passive location behavior must not be described as continuous tracking.

## 23. Audit and Browser Certification Model

`js/app.js` maintains a central `__gridlyAuditHelperRegistry`, explicit helper exposure, debug inventory, and many direct `window.*` certification helpers. The model distinguishes:

* **Node contract tests:** deterministic code/data behavior in controlled fixtures.
* **Passive audits:** inspect configuration/state without changing consumer behavior.
* **Visible browser certification:** proves rendered cards, final phases, network boundary, and route handoff in the deployed application.
* **Real-device validation:** proves mobile portrait, install/update, browser/network, and OS behavior.

LP105.2 is the governing lesson: automated adapter and regression tests passed while live browser certification failed. No lower layer can override contradictory deployed evidence.

## 24. Current Known Findings

### Confirmed Current Blockers

* Live Liberty exact/alias certified results are not returned through the deployed boundary.
* Public certificate/package reachability and the deployed `GRIDLY_CERTIFIED_ADDRESS_BASE_URL` value are unproven; fallback continuation currently permits misleading road/business geography.

### Known Certification Findings

* Brazoria, Walker, Washington: exact-sample/canonical-alias findings.
* Harris: full-package certification load exceeds 5,000 ms.

These do not mean packages are missing.

### Deferred Enhancements

28-county address activation; bounded/indexed server lookup; additional directional corridors/UI; push notifications; background location; app-store distribution; implementation of a final Trust Resolution Policy; and broader real-device certification.

### Historical/Superseded Findings

LP097 provider tunnel unavailability, LP100/LP101 pre-deployment limitations, LP101 candidate/no-result defects, LP102 helper scope/diagnostic propagation defects, LP104's initial zero-source coverage report, LP104.2 missing NAD archive, and LP104.5 browser-direct package loading describe earlier checkpoints. Later commits supersede their implementation state; they remain history, not permission to disregard current browser failures.

## 25. Current Production Readiness

| System | Status | Evidence | Current risk |
|---|---|---|---|
| Awareness | Stable/protected | Current code and extensive audits/tests | Live-provider/device state still requires operational monitoring. |
| Reports | Stable/protected | Supabase synchronization and lifecycle code | Deployment/data health not re-certified by this report. |
| Crossings | Production-certified | 28 packages, 3,771, zero blocked | Preserve classification and locality governance. |
| Business search | Operational path, relevance finding | LP099 tests; browser control returned a result | Dayton, Ohio result shows geographic relevance risk. |
| Curated destinations | Certified | LP098: 153 across 28 counties | Static freshness/coverage is bounded. |
| Provider boundary | Deployed/reached | LP100 code; browser `providerBoundaryPreserved: true` | Fallback results can mislead. |
| Rural strict acceptance | Contract-certified | LP102 tests/evaluator | Live fallback/helper result must not be mistaken for LP102 failure. |
| 28-county manufacturing | Complete, inactive | 28 packages/certificates; 24 pass, four findings | Findings and activation gates remain. |
| Liberty runtime consumption | **Blocked** | Code/test pass; browser `passed: false` | Artifact/config/runtime divergence. |
| PWA | Implemented foundation | Manifest/icons/SW/update/install code | Live install/update/device certification not proven. |
| Directional intelligence | Foundation/readiness only; display paused | Evidence/runtime assets; no approved UI | Do not activate implicitly. |
| Push notifications | Not operationally proven | Settings copy only; no proven push handler | Must not promise delivery. |

## 26. Immediate Next Engineering Task

**Recommendation/inference:** perform one focused **LP105.2 deployed artifact-access and fallback-divergence repair**, without rebuilding data or changing acceptance.

* **Scope:** observe deployed sanitized diagnostics and HTTP status for the exact certificate/package URLs; prove the deployed base-url value; configure or minimally correct server artifact resolution; ensure unavailable artifacts remain fail-closed; and prevent the certification helper/live final pipeline from treating road-only or geographically irrelevant fallbacks as exact/relevant.
* **Likely files/config:** Supabase secret/environment configuration first; only if evidence proves code error, `supabase/functions/_shared/liberty-certified-address.mjs`, `supabase/functions/gridly-geocode/index.ts`, and narrowly the final certification/relevance handling in `js/app.js`. Do not touch the package, certificate, builder, LP102 evaluator, providers, or county activation.
* **Required evidence:** HTTP reachability/content type/byte length/hash from the Edge environment; sanitized adapter outcome/rejection reason/timing; deployed function version; canonical responses; browser network trace without direct package browser loading.
* **Success:** 276 and its three aliases return the identical certified address point; 274 returns truthful no-result; road-only is not exact; Dayton Walmart remains business intent and geographically relevant; boundary remains Gridly; no direct browser artifact/provider request.
* **Browser acceptance:** run `await window.gridlyLp1052RuntimeAddressCertification?.()` after cache-busted deployment and require every case pass, `passed: true`, and `safeToMerge: true`, plus visible Route Preview for accepted 276 only.
* **Deployment validation:** deploy with `npx supabase functions deploy gridly-geocode`, confirm configuration without exposing secrets, then certify production and mobile portrait.
* **Rollback/fail-closed:** retain the current deployed function/config for rollback; any certificate/hash/read/decompression mismatch returns no certified candidate and never weakens LP102. Do not broaden counties or matching.

## 27. Canonical Source-of-Truth Hierarchy

Future work must resolve claims in this order:

1. Current deployed runtime evidence.
2. Current repository implementation.
3. Current automated tests.
4. Current generated artifacts and filesystem verification.
5. Latest milestone certification documents.
6. Older roadmap/reference documents.
7. Historical chat handoffs.

Older documents provide intent and lineage but cannot override newer verified code, artifacts, tests, or runtime. Contradictions must be stated (as with the certificate byte count, LP104 zero-coverage checkpoint, LP104.5 indexed browser architecture, and LP105.2 full server scan), not silently averaged.

## 28. Final State Statement

Gridly has become a governed, 28-county Texas travel-awareness platform with mature community/official intelligence, certified crossing infrastructure, protected search boundaries, strict truthful rural-address acceptance, and a deterministic statewide-capable address manufacturing platform. Crossings and the 28-county manufacturing cohort are genuinely complete at their stated gates; LP105.2 code and deployment exist, but live Liberty certified consumption is not certified because the exact result does not reach the browser and its public artifact host/configuration is unproven. Next work must prove and repair that deployed artifact path and fallback divergence, then pass the browser helper. It must not reopen LP102, rebuild packages, loosen matching, broaden activation, add providers/frameworks, or restart directional UI.

---

### Repository review record

Reviewed current `index.html`, `css/styles.css`, `js/app.js`, geocoding/search modules, `package.json`, `manifest.json`, `service-worker.js`, Supabase geocoding/shared adapter and migrations, LP097–LP105.2 documents and tests present in `docs/`/`tests/`, TxGIO builders/inventory/manufacturing tools, generated manifests/certificates/reports, crossing/community manifests and packages, directional evidence/runtime assets, audit registry, county/community configuration, PWA/Capacitor workflow, and the last 30 commits through `4cd0402`.

The specifically requested legacy files `GRIDLY-MASTER-REFERENCE.txt`, `GRIDLY-DEVELOPMENT-WORKFLOW.txt`, `GRIDLY-ROADMAP.txt`, `Gridly-Current-State-Snapshot-6-3-2026.txt`, `Gridly-Project-Instructions.txt`, `Gridly-Release-Note-6-3-2026.txt`, `Gridly-Audit-Debug-Helper-Inventory.txt`, `GRIDLY-DIRECTIONAL-INTELLIGENCE-STATUS.txt`, `GRIDLY-V254-V255-PRODUCT-REFINEMENT-STATUS.txt`, `GRIDLY-TRUST-RESOLUTION-POLICY-V1-(DRAFT).txt`, `GRIDLY-APP-READINESS-AUDIT-V1.txt`, `GRIDLY-PWA-FOUNDATION-PLAN-V1.txt`, and `V783-—-Production-Crossing-Runtime-Integration.txt` were not present in this checkout. Their absence is not filled by guesses. No `AGENTS.md` was found. No `origin` remote is configured, so remote fetch/push and remote-branch verification are unavailable; selected-branch identity comes from the task assignment, while Git verifies the local branch is `work`.
