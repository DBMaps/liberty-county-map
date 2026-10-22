Gridly production-derived community loading integration V1

The performance-only intermediate commit supports the performance regression
mode and REPAIR_NWS_CHECKS=0 consumer replay. Commands enabling NWS acceptance
require the separately scoped NWS commit and its tests/tools; the combined
certification commands below target that final state.

No command here commits, pushes, deploys, creates a native release build or
changes a store release. The certified 9711cd8d reference remains untouched.

Baseline: faac47368da3137b50d53813b7f0299a2f4b1830 (Android production 14,
containing Apple uploaded/owner-confirmed selected Build 14 e0b51235).
Later Apple Build 15 diagnostic work is excluded.

Install exact locked dependencies without lifecycle scripts or browser download:
  $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD='1'
  npm ci --ignore-scripts --no-audit --no-fund

PowerShell, from repository root; use a fresh evidence directory for a new run:
  $env:REPAIR_OUTPUT_DIR='.artifacts/community-loading-integration-v1'
  $env:REPAIR_BASELINE_REF='faac47368da3137b50d53813b7f0299a2f4b1830'
  $env:AUDIT_HOST='preview.gridlygo.com'
  $env:AUDIT_ROAD_REPLAY='1'
  $env:AUDIT_RUNS='3'
  $env:AUDIT_CASES=''
  $env:REPAIR_CHECKS='0'
  $env:REPAIR_NWS_CHECKS='0'
  $env:REPAIR_ACTIVE_POPUP='0'
  $env:REPAIR_PHASE='before'
  node tools/community-loading-repair/replay.cjs
  $env:REPAIR_PHASE='after'
  node tools/community-loading-repair/replay.cjs

Run phases sequentially without concurrent tests/benchmarks. Before serves app.js
and all three changed NWS modules directly from the explicit baseline Git source.
After serves the actual working files. Metadata records all served SHA256 values.
No old development before-app.js or historical comparison is reused. Requires
installed Edge plus the original hash-verified roadway/library replay fixtures in
.artifacts/community-loading-audit. External writes/WebSockets and nonfixture
providers are blocked. Store admission latency, physical phones, real warm HTTP
cache and live providers are NOT certified by the replay.

Functional parity and mounted NWS safety checks:
  $env:AUDIT_RUNS='1'
  $env:REPAIR_CHECKS='1'
  $env:REPAIR_NWS_CHECKS='1'
  # Run replay.cjs before, then after, as above.
  # Then repeat before and after with:
  $env:AUDIT_CASES='Dayton'
  $env:REPAIR_ACTIVE_POPUP='1'
The normal functional runs compare 33 settled states across four communities.
They do not repeat the startup click probe or post-startup microbenchmarks; those
are measured only by the separate performance cohort. UI actions have bounded
120-second waits for the unoptimized baseline. Healthy-state setup waits for the
actual provider transaction, finishes competing report/road work, and permits one
real weather retry after a baseline main-thread-induced fixture timeout. Explicit
NWS failure cases do not receive that healthy-state retry. Earlier baseline
timeout/action failures are retained separately and must not be hidden or called
new integration regressions. Production timeout/retry policy is never modified.
NWS adds nine after-only browser states per community, including actual Weather
disclosure activation, forecast 503, alert outage/retention, recovery, cancellation,
outage after cancellation, visible pending refresh, and automatic authoritative expiry without another poll.
The separate active-popup run compares the existing blocked-crossing model.

Existing regression suites (set REPAIR_OUTPUT_DIR to its final-tests subdirectory):
  node tools/community-loading-repair/run-tests.cjs before investigation
  node tools/community-loading-repair/run-tests.cjs after investigation
  node tools/community-loading-repair/run-tests.cjs before expanded
  node tools/community-loading-repair/run-tests.cjs after expanded
The before hook substitutes all four changed source files for Node VM fixtures;
the portrait server uses the same hook for actual served script bytes.

Focused certification (56 tests: original 28 + NWS 22 + integration parity 6):
  node --test --test-reporter=tap tests/community-loading-performance-repair.test.cjs tests/community-loading-nws-safety.test.cjs tests/community-loading-production-integration.test.cjs
Save TAP as focused-final.tap under the evidence root. Keep the original 28 tests
unchanged; their development-reference lookup parity is supplemented by exact
production-port equivalence, Apple/native parity and paid/reporting preservation.

Additional unchanged paid authority/browser suites:
  node --test --test-reporter=tap tests/lp24461-subscription-entitlement.test.mjs tests/lp24463-apple-storekit.test.mjs tests/lp24465-continuity.test.mjs tests/lp24465-paid-access.test.mjs tests/lp24466s-apple-node.test.mjs tests/paid-report-authorization.test.mjs
  node --test --test-reporter=tap tests/android-paid-startup.test.mjs tests/android-production12-subscription.test.mjs tests/lp24465-paid-startup-browser.test.mjs

Reset REPAIR_OUTPUT_DIR to the evidence root, then aggregate and assert:
  node tools/community-loading-repair/compare-integration.cjs
This validates 12 paired performance runs, ordered inventories/subsets, context /
membership/camera, 33 paired safety states, NWS browser evidence, active popup,
served fingerprints, and identical remaining baseline failure lists. It writes
comparison.json. REPORT.txt beside it explains scope, failures and limitations.
Old report.cjs is intentionally excluded: its hardcoded development report and
hashes must not be used to certify this production-derived candidate.

Statewide certification and conditional local-commit gate
-------------------------------------------------------
Use a NEW evidence root; do not overwrite either earlier investigation:
  $env:STATEWIDE_OUTPUT_DIR='.artifacts/community-loading-statewide'
  node tools/community-loading-repair/statewide-fixtures.cjs
  node tools/community-loading-repair/statewide-replay.cjs
  node tools/community-loading-repair/statewide-compare.cjs
  node tools/community-loading-repair/statewide-callers.cjs
  node tools/community-loading-repair/statewide-regressions.cjs combined

statewide-replay.cjs runs three counterbalanced/interleaved pairs per community
in statewide-matrix.json. Every observation has a fresh Edge context. Only this
runner may execute while timings are captured; run regression suites afterwards.
STATEWIDE_RESUME=1 skips completed observations, but final comparison revalidates
all baseline/candidate served source hashes. STATEWIDE_CASES and
STATEWIDE_REPETITIONS can define explicitly labelled diagnostic cohorts; do not
present those as the full matrix. Preserve failed attempts in diagnostics.
The post-startup checks use the same 300-second test bound on both versions.
This does not change an application timeout or turn a timeout into a timing.

The matrix adds actual startup, Alerts click/paint, CPU profiles, full crossing
request/transfer counts, first-popup activation fields/cost, summary refresh,
revision invalidation, same-document lookup reuse, CDP heap and DOM snapshots.
Memory is measured without forced GC. Sample medians/worst observations are not
p95 claims. Interception disables true HTTP-cache measurement. Native-device,
live-provider, paid-admission latency and cellular performance remain unproven.

statewide-certification.cjs executes real registry resolution, package adapter,
normalization, public/private/reportability and shared selection functions over
all 254 county packages and every governed PLACE/county membership. It compares
against exact production source. Data match production Git object identity
(allowing only LF/CRLF checkout materialization); all source SHA256 values are
recorded. Legacy county entries without inline FIPS join the unchanged governed
LP149 county identity authority. Hydration, empty-state, retry/race, index and
summary revision tests are isolated function-level execution, not full browser
or exact boundary-edge tests for 254 counties.

statewide-nws.cjs reuses the independent NWS harness with the actual governed
point resolver/presentation fixtures in every county. Unsupported county-wide
contexts remain fail-closed; a point is never fabricated to inflate coverage.
The eight-entry cache limit, eviction and revisit retrieval are also tested.
This uses controlled transport and does not substitute for live NWS evidence.

All remote replay reads use the production registry URLs. LP210 and Harris
package hashes are checked against their governed manifests/registry. Fort Bend
has no expected production checksum: its exact source URL and downloaded hash
are pinned for both phases and this integrity limitation is reported explicitly.
Montgomery's clean-checkout gzip is materialized only into ignored fixtures by
the existing LP1833 packageAsset(root, false) deterministic generator. Its exact
6,444,342-byte production hash and the real browser decoder's size/hash/gzip/JSON
checks remain enforced. No native build or source-asset generation is performed.
Liberty/San Jacinto local roadway bytes are pinned to production Git authority;
their ordinary local HTTP server delivery is preserved. Earlier Montgomery
road-unavailable diagnostics do not count as healthy-road measurements.

For separation, stage the exact 17-hunk app performance patch and its related
tests/tools first. Temporarily retain the NWS layer and its three updated
transport fixtures outside the intermediate certification state. Run
statewide-regressions.cjs performance plus the controlled consumer replay,
confirm the exact staged tree, then make the first local commit only when the
owner's conditional gate has passed. Restore the exact fingerprinted NWS layer,
run statewide-regressions.cjs combined and mounted NWS/consumer checks, then
review/stage its shipping hunks and directly related tests/tools for the second
local commit. No command in these tools automatically stages or commits.

Expedited bounded comparison
----------------------------
After an owner-directed safe stop, run statewide-compare.cjs --bounded. It
requires at least one complete before/after pair for every selected community,
validates all included sources and identities, reports actual per-row samples,
and retains unmatched observations separately. Never call this the planned
three-pair cohort. Reuse already valid byte-identical browser evidence; do not
expand or repeat the expensive schedule without a demonstrated need. The local
commit gate can record targeted intermediate tests and a single full combined
regression run rather than duplicate expensive suites.
