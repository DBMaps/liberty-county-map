# LP110 — Texas statewide data expansion and production feasibility

## 1. Executive summary

LP110 is an audit-only milestone. It changes no runtime, package, certificate, matching, reporting, routing, awareness, hazard, alert, or Supabase behavior. The audit started on branch `work` at commit `e8bbd8aa5556a3c16b797a3f47b6afea9a529ed2`; the only untracked paths were the permitted generated directories `android/.gradle/`, `android/build/`, and `node_modules/`. No applicable `AGENTS.md` was found.

**Decision: the governed data model and offline package builder are statewide-capable, but a production launch across all 254 counties is not ready.** The repository already has a canonical 254-county inventory, read-only and resumable statewide source inventory, resumable per-county generation, package manifests, strict certification, selective verification/upload, private Storage verification, and remote runtime certification. These should be extended, not replaced.

The statewide build must not begin yet. The decisive blockers are absent real statewide inventory evidence, unresolved TxGIO production licensing, and the fact that certification, deployed identity selection, Storage orchestration, and remote certification are intentionally governed to the initial 28 counties. In addition, the existing one-package full-stream runtime is not demonstrated safe for every large urban county; Harris required its own 256-bucket bounded lookup. Statewide source inventory and urban pilot measurements must determine which additional counties need the existing bounded-artifact pattern.

No new general-purpose pipeline is justified. The minimum path is to run the existing inventory, resolve licensing, benchmark representative counties, and then make one separately reviewed cohort-parameterization change across the existing LP107/LP108 identity, certificate, Storage, and certification boundaries. Promotion must be incremental and county-selective, with the current 28 retained as the rollback cohort.

### Finding classifications

| Finding | Classification |
|---|---|
| Canonical inventory contains all 254 Texas counties and the LP104 builder accepts `--all-texas` or selected FIPS. | **READY** |
| LP105 provides aggregate-only, atomic, resumable statewide inventory with source-identity refusal and concurrency 1–4. | **READY** |
| Exact house number, canonical road, FIPS containment, integrity checking, no interpolation, no nearby substitution, and fail-closed runtime policy are reusable without change. | **READY** |
| Existing 28 artifacts provide a measured baseline: 3,189,922 accepted rows and 114,699,291 compressed bytes. | **READY** |
| Run the real LP105 all-Texas inventory and retain its checkpoint, ledger, estimates, failures, and pilots. | **REQUIRED BEFORE STATEWIDE BUILD** |
| Obtain affirmative written TxGIO production authorization under the existing fail-closed license decision. | **STATEWIDE BUILD BLOCKER** |
| Generalize the fixed initial-28 certification/identity/upload/runtime-certification cohort only after inventory and pilot approval. | **REQUIRED BEFORE STATEWIDE BUILD** |
| Prove bounded runtime behavior for large urban outliers; reuse the Harris bucket pattern where evidence requires it. | **STATEWIDE BUILD BLOCKER** |
| Add run-level duration, throughput, object-count, retry, and per-county latency dashboards from existing reports/logs. | **RECOMMENDED** for pilots; **REQUIRED BEFORE STATEWIDE LAUNCH** |
| Execute uploads and activation in reviewable waves, never as a single 254-county cutover. | **RECOMMENDED** |

## 2. Existing automation inventory

| Capability | Existing implementation | Scope and audit result | Classification |
|---|---|---|---|
| County governance | `data/lp104/texas-counties.json` | Canonical names, IDs, FIPS, and exactly 254 counties; marks the initial 28 cohort. This is the statewide control plane and should remain the single county source. | **READY** |
| Statewide coverage view | `data/lp104/texas-county-coverage.json`, `js/lp104-regional-rural-address-audit.js` | Schema and 254-county gate exist, but the checked-in coverage snapshot is deliberately `unbuilt`: 0 source-covered, built, certified, eligible, or active counties. It is architecture evidence, not current statewide production evidence. | **REQUIRED BEFORE STATEWIDE BUILD** (populate from governed evidence) |
| Source measurement | `tools/lp104/measure-nad-r23.mjs`, `tools/lp104/explore-nad-r23.mjs`, `tools/lp105/inventory-txgio-statewide.mjs` | Read-only aggregate inspection; LP105 supports one county, initial 28, or all Texas and never exports address rows. | **READY** |
| Resumable inventory | `tools/lp105/inventory-txgio-statewide.mjs` | Atomic checkpoint after each county, resume by default, successful-county skip, failed-county retry, source-identity mismatch refusal, heartbeat, and concurrency 1–4. | **READY** |
| County generation | `tools/lp104/build-txgio-address-packages.mjs` | Supports Liberty, initial 28, selected comma-separated FIPS, or all 254. It reads the GDB via `ogr2ogr`, emits deterministic compact gzip JSONL, and resumes counties whose sidecar hash still agrees. Builds sequentially; selective FIPS is the safe rebuild mechanism. | **READY** |
| 28-county manufacture | `tools/lp1051/manufacture-gridly-28-address-counties.mjs` | Orchestrates the governed 28 and creates candidate certification evidence. Its fixed cohort is intentional and is not a statewide orchestrator. Reuse its validation logic rather than cloning it. | **REQUIRED BEFORE STATEWIDE BUILD** (parameterize cohort after approval) |
| Package manifest | LP104 builder `manifest.json`; LP105.1 candidate `runtime-manifest.candidate.json` | LP104 merges built county results by FIPS into a statewide-capable package manifest. Runtime candidate generation remains 28-scoped. | Package manifest **READY**; runtime manifest expansion **REQUIRED BEFORE STATEWIDE BUILD** |
| Offline package query | `tools/lp104/query-txgio-address-package.mjs` | Streams gzip and requires exact house plus canonical road; useful for selective spot certification without runtime activation. | **READY** |
| Package certification | `tools/lp104/certify-texas-address-package.mjs` | County selected from a runtime manifest; independently checks size/hash, identity, FIPS, exact lookups, negative numbers, aliases, load time, lazy load and cache reuse. | **READY**, once a county is admitted to a governed manifest |
| Runtime certificates | `tools/lp107/generate-runtime-certificates.mjs` | Deterministically hashes packages, validates the strict acceptance contract, writes atomically, preserves correct certificates byte-for-byte, and supports `--verify-only --county-fips`. County selection is currently initial-28 only. | Logic **READY**; cohort expansion **REQUIRED BEFORE STATEWIDE BUILD** |
| Upload planning and upload | `tools/lp108/sync-certified-address-storage.mjs` | Plans, uploads, retries, skips matching private objects, refuses mismatches unless explicit replacement is authorized, verifies remote bytes, redacts secrets, and supports a selected county. It consumes LP107's 28-only selection. | Logic **READY**; cohort expansion **REQUIRED BEFORE STATEWIDE BUILD** |
| Storage verification | Same LP108 sync tool | Verifies bucket access plus object size and SHA-256, reporting matching/missing/mismatched/inaccessible states atomically. | **READY** |
| Runtime identity and selection | `supabase/functions/_shared/certified-address-identities.mjs` and the governed certified-address adapter | Enforces consistent county/FIPS/county-ID evidence and rejects conflict, ambiguity, or unsupported counties. The deployed inventory is exactly 28 identities. | Policy **READY**; 254 identities **REQUIRED BEFORE STATEWIDE BUILD** |
| Runtime verification | `tools/lp108/certify-remote-runtime.mjs` | Deterministic private representative selection, county-positive case, optional controls, timeout/error classification, and atomic evidence; accepts `--county-fips`. Full-run selection is currently 28-only. | Logic **READY**; statewide cohort and staged runner **REQUIRED BEFORE STATEWIDE LAUNCH** |
| Large-county bounded lookup | `tools/lp108/harris-certified-lookup.mjs`, `tools/lp108/sync-harris-sidecar.mjs` | Builds/verifies/uploads 256 independently hashed Harris buckets bound to the unchanged package and certificate. Upload is resumable through matching-object skip. This is proven reusable architecture, not proof every county needs buckets. | **READY** for Harris; **RECOMMENDED** only for measured outliers |
| Test/certification suites | `tests/lp1044-*`, `lp1046`, `lp1047`, `lp105`, `lp1051`, `lp106`, `lp107`, `lp108`, `lp1089`, `lp10811` | Deterministic coverage of generation, querying, runtime, resume, integrity, strict matching, negative controls, Storage, streaming, and buckets. | **READY** as regression foundation |

### Reusable infrastructure conclusion

Generation, integrity, certification, object naming, upload safety, verification, and fail-closed selection already exist. The missing component is not a new statewide builder. It is an approved statewide cohort flowing through the existing fixed-28 control points, plus evidence-driven bounded lookup for any package whose measured runtime exceeds the launch budget.

## 3. Production feasibility assessment

### 3.1 Storage

The checked-in 28 packages contain **3,189,922 accepted records in 114,699,291 compressed bytes**, or about **36.0 compressed bytes per accepted record**. Harris contributes 57,731,771 bytes, demonstrating why county distribution—not a simple per-county average—must drive capacity planning. Its 256 bucket objects add 65,089,143 compressed bytes while retaining the original governed package.

The source declares 12,142,647 statewide rows. If every source row were accepted and the observed 28-county compression ratio transferred unchanged, the original-format packages would be approximately **437 MB**. Applying LP105's existing 0.65–1.5 planning band yields a deliberately provisional **284–655 MB** package range. Certificates and manifests are small relative to package bytes; bounded lookup artifacts can add roughly one more package-equivalent for affected counties. Capacity should therefore reserve at least **2× the completed inventory estimate**, plus version-retention headroom, before upload. These are planning figures, not a statewide measurement; the real LP105 ledger is required.

**Classification:** architecture **READY**; measured statewide capacity **REQUIRED BEFORE STATEWIDE BUILD**.

### 3.2 Runtime and statewide concurrency

Runtime loads one selected county artifact, not all Texas data into the browser or Edge process. Object count and total statewide bytes therefore do not directly increase a single ordinary lookup. County/FIPS selection and private retrieval remain bounded by county. However, the original runtime scans and validates a complete selected gzip. Harris measured 11.6 seconds wall time, 13.7 seconds CPU, and 136.3 MiB peak RSS for 1,452,427 records before the bucket architecture reduced a representative local lookup to a 259,122-byte bucket averaging 12.6 ms over 20 runs. That establishes both feasibility and the need for outlier classification.

Every large pilot must record certificate download, package/bucket download, decompression, scan/exact lookup, total runtime, status, and fail-closed diagnostics using LP108's existing fields. Production limits and p95/p99 targets must be agreed with the deployment owner; LP110 must not invent them. Statewide load/concurrency behavior remains unmeasured and needs a rate-controlled test that uses non-residential synthetic/hashed certification controls and observes Edge/Storage saturation.

**Classification:** per-county lazy architecture **READY**; additional urban runtime profiles and concurrent-load evidence **STATEWIDE BUILD BLOCKER**.

### 3.3 Build, certification, and upload duration

The builder is sequential and resumable by certified county. LP105 inventory supports concurrency up to four but defaults to one to protect a large FileGDB and an approximately 8 GB workstation. Neither the checked-in sidecars nor reports preserve trustworthy build durations for the 28 artifacts, and no real statewide LP105 run has been checked in. Consequently a calendar duration would be invented.

The first statewide inventory and a representative rural/suburban/urban build pilot must measure rows/second, bytes/second, peak disk, and per-stage wall time. Use those observations to calculate:

* build ETA = sum of remaining county estimated rows / observed profile throughput;
* certification ETA = sum of artifact bytes / observed hash-plus-certification throughput;
* upload ETA = total new bytes / observed effective upload throughput, plus retry/verification time; and
* remote certification ETA = sum of county request durations plus controlled spacing and retry budget.

All operations are county-selective and safe to rerun. Upload already skips matching objects and refuses silent replacement, so interruption recovery does not require a new uploader.

**Classification:** resumability/selective rebuild **READY**; defensible duration estimates **REQUIRED BEFORE STATEWIDE BUILD**.

### 3.4 Incremental updates and selective rebuilds

`--fips` provides selective source inventory/build, LP107 and LP108 accept `--county-fips`, and object paths are county-version governed. Correctly certified artifacts are skipped; source/checkpoint mismatch and remote mismatch fail closed. An update should create and certify the county artifact first, upload without replacement, verify remote bytes, deploy its identity, certify its exact and negative cases, and only then retire a previous version under a retention policy.

The current object path is not content-versioned in its filename and replacement requires an explicit override. Before recurring statewide updates, adopt an operational release identifier or immutable version prefix in a separately governed change; never overwrite the only known-good object. This is operational hardening, not permission to alter matching behavior.

**Classification:** selective rebuild **READY**; immutable multi-version release convention **RECOMMENDED** before first launch and **REQUIRED** before routine statewide refreshes.

### 3.5 Operational complexity, rollback, and monitoring

The production unit should remain a county, with an explicit wave manifest and immutable evidence bundle. A wave is complete only when local package/certificate, remote bytes, deployed identity, exact case, false-number case, conflict case, and no-fallback diagnostics all pass. Failed counties remain unsupported and fail closed; successful counties need not roll back.

Rollback is: redeploy the previous Edge commit/identity inventory and retain verified Storage objects. Never delete or replace the current 28 known-good objects during expansion. For a new version, select the prior immutable path and redeploy. If monitoring detects a county regression, remove only that county from the active governed cohort while preserving its evidence for investigation.

Required monitoring is aggregate and privacy-safe: request outcome by county/FIPS, selected artifact version, certificate/package/bucket validation outcome, fallback-executed invariant, Edge status/timeout/resource category, download and lookup latency, Storage missing/mismatch, and deployment version. Do not log queries, addresses, coordinates, credentials, signed URLs, or raw response bodies. Alert on any integrity failure, fallback after certified-provider execution, unsupported active identity, rising timeout/resource failures, or remote object mismatch.

**Classification:** rollback mechanism **READY**; formal release ledger, retention policy, dashboards and alerts **REQUIRED BEFORE STATEWIDE LAUNCH**.

## 4. Statewide build readiness

| Gate | Current evidence | Status |
|---|---|---|
| Governed 254-county identity | Canonical manifest has 254 unique Texas FIPS entries. | **READY** |
| Statewide source inventory | Tool exists, but `data/generated/lp105/README.md` states no real inventory was run; coverage snapshot remains unbuilt. | **REQUIRED BEFORE STATEWIDE BUILD** |
| Source authorization | `data/lp105/txgio-license-decision.json` is `UNRESOLVED_FAIL_CLOSED`. | **STATEWIDE BUILD BLOCKER** |
| Statewide package generation | Existing builder supports `--all-texas`, resumes certified files, and updates the package manifest. | **READY**, gated by inventory/license |
| Statewide certification | Strict generic logic exists; LP107 selection is fixed to initial 28. | **REQUIRED BEFORE STATEWIDE BUILD** |
| Statewide Storage | Generic private-object verification/upload exists; governed input remains fixed to initial 28. | **REQUIRED BEFORE STATEWIDE BUILD** |
| Statewide runtime selection | Fail-closed generic selection exists with 28 admitted identities. | **REQUIRED BEFORE STATEWIDE BUILD** |
| Large-county runtime | Harris bounded lookup works; other metropolitan packages have not been profiled. | **STATEWIDE BUILD BLOCKER** |
| Remote evidence | LP108 documentation reports remote execution incomplete in its environment; authenticated owner evidence is required. | **REQUIRED BEFORE STATEWIDE LAUNCH** |
| Protected behavior | Existing contracts and regression suites preserve exactness and fail-closed behavior. | **READY**; non-negotiable release gate |

## 5. Statewide launch recommendation

**Recommendation: NO-GO for a single statewide production launch; GO for an evidence-gathering inventory and pilot phase using existing tooling.**

Minimum execution sequence:

1. **Inventory, no package build.** Run LP105 `--all-texas --resume --concurrency 1`; review failures, empty/low-quality counties, estimated bytes, and rural/suburban/urban pilots. Re-run only failures and archive the source identity plus checkpoint.
2. **Resolve authorization.** Obtain and record affirmative responses to every existing licensing question. If authorization is not affirmative, stop; do not build production artifacts.
3. **Pilot existing builder.** Select small rural, typical suburban, large urban, and known Harris profiles by FIPS. Record build/certification throughput, size, rejection, duplicates, and disk peak. Do not activate.
4. **Classify runtime artifacts.** Run LP104.6 locally. Exercise the unmodified full-stream runtime for representative packages. Assign the existing Harris bucket pattern only when size/CPU/memory evidence requires it.
5. **Approve the smallest engineering change.** Parameterize the governed cohort consumed by LP105.1/LP107/LP108 and generate the deployed identity inventory from the canonical approved wave. Preserve current schemas and exactness policies. Add tests proving 254 unique identities, subset operation, conflict rejection, unsupported-county rejection, and no behavior change for the original 28.
6. **Capacity and operational review.** Reserve Storage/version headroom from measured inventory, set privacy-safe latency/resource/error alerts, document immutable version retention and county rollback, and rehearse a failed upload and failed activation.
7. **Wave deployment.** Start with a small non-overlapping pilot wave, then rural/small, suburban, and large/exception cohorts. For every wave: local verify → upload → remote byte verify → deploy identity → county-by-county remote certification → negative/business controls → observe → approve next wave.
8. **Statewide closure.** Require 254/254 governed identities and remote exact cases, zero missing/mismatched objects, all controls passing, and explicit disposition of every outlier. A county that does not pass remains inactive; do not weaken acceptance to reach a numeric target.

Estimated production effort cannot yet be responsibly expressed as elapsed days. Engineering scope is **small-to-moderate** because it is cohort parameterization and evidence aggregation, not new pipeline construction. Operational effort is **high** because 226 additional counties require source review, build/certification, object verification, staged deployment, and observation. The inventory and pilot run will convert this into a defensible schedule.

## 6. Merge recommendation

**MERGE RECOMMENDED.** LP110 is documentation-only, accurately records blockers, and authorizes neither production build nor activation. It preserves LP102 and LP104–LP108 runtime behavior and all protected systems. Merge does not imply statewide readiness; it establishes the gates for a later, separately authorized implementation milestone.

## 7. Exact validation steps

Run from the repository root. Commands that require owner data or credentials are deliberately separated from repository-only validation.

### Repository-only audit and regression

```bash
git branch --show-current
git rev-parse HEAD
git status --short --branch
find .. -name AGENTS.md -print

node -e "const m=require('./data/lp104/texas-counties.json'); const f=m.counties.map(c=>c.fips); if(m.counties.length!==254||new Set(f).size!==254||f.some(x=>!/^48[0-9]{3}$/.test(x))) process.exit(1); console.log('254 unique Texas counties')"
node --test tests/lp1044-txgio-address-builder.test.mjs
node --test tests/lp1046-texas-address-certification.test.mjs
node --test tests/lp1047-multi-county-runtime-activation.test.mjs
node --test tests/lp105-texas-statewide-readiness.test.mjs
node --test tests/lp1051-28-county-manufacturing-orchestrator.test.mjs
node --test tests/lp107-runtime-certificate-readiness.test.mjs
node --test tests/lp108-storage-and-runtime-certification.test.mjs
node --test tests/lp1089-streaming-runtime.test.mjs
node --test tests/lp10811-harris-sidecar.test.mjs

node tools/lp107/generate-runtime-certificates.mjs --verify-only
node tools/lp108/sync-certified-address-storage.mjs --plan
npm run build:lp10812:harris-buckets
npm run verify:lp10812:harris-buckets
```

### Owner inventory and pilot evidence (immutable source required)

```powershell
$env:GRIDLY_TXGIO_GDB = 'C:\path\to\immutable\Texas-2026.gdb'
node .\tools\lp105\inventory-txgio-statewide.mjs --all-texas --gdal 'C:\Program Files\QGIS 3.44.11\bin' --reports '.\data\generated\lp105' --name 'texas-2026-statewide' --resume --concurrency 1

# Use FIPS selected from the completed inventory; do not infer pilots in advance.
node .\tools\lp104\build-txgio-address-packages.mjs --fips <comma-separated-approved-pilot-fips> --gdal 'C:\Program Files\QGIS 3.44.11\bin'
node .\tools\lp104\certify-texas-address-package.mjs --fips <one-approved-fips> --report .\reports\lp110\<fips>-certification.json
```

Before proceeding, confirm all 254 inventory rows have an explicit outcome, source identity is unchanged, failures are dispositioned, estimates have been reviewed, and the license decision is affirmative. Do not use `--force` merely to hide a mismatch.

### Owner Storage and deployed runtime certification (after separately approved cohort change)

```bash
node tools/lp107/generate-runtime-certificates.mjs --verify-only
node tools/lp108/sync-certified-address-storage.mjs --plan
node tools/lp108/sync-certified-address-storage.mjs --upload
node tools/lp108/sync-certified-address-storage.mjs --verify-remote
npx supabase functions deploy gridly-geocode --project-ref "$SUPABASE_PROJECT_REF"
node tools/lp108/certify-remote-runtime.mjs --county-fips <approved-fips> --include-controls
node tools/lp108/certify-remote-runtime.mjs
```

Required environment-only values are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and optionally `GRIDLY_GEOCODE_FUNCTION_URL`/`GRIDLY_CERTIFICATION_ORIGIN`. Final approval requires matching remote size/SHA for every admitted object, a passing exact case for every admitted county, passing incorrect-number/road-only/conflict/unsupported/business controls, `fallbackExecuted !== true` after certified-provider execution, and no unresolved timeout, memory, CPU, or Storage error category.
