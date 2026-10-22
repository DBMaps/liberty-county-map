const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const dir = path.resolve('.artifacts/community-loading-repair');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const before = read('before-baseline.json'), after = read('after-baseline.json');
const median = a => a.slice().sort((a, b) => a - b)[Math.floor(a.length / 2)];
function cpu(file) {
  const p = read(file), parents = new Map(), nodes = new Map(p.nodes.map(n => [n.id, n])), totals = new Map();
  for (const n of p.nodes) for (const id of n.children || []) parents.set(id, n.id);
  for (let i = 0; i < p.samples.length; i++) {
    let id = p.samples[i]; const delta = (p.timeDeltas[i] || 0) / 1000;
    while (id) { const name = nodes.get(id).callFrame.functionName; totals.set(name, (totals.get(name) || 0) + delta); id = parents.get(id); }
  }
  return { windowMs: (p.endTime - p.startTime) / 1000, selectorMs: totals.get('gridlySelectConsumerVisibleCrossings') || 0, popupMs: totals.get('buildPopup') || 0, diagnosticStackMs: totals.get('gridlyGetInvalidRoadLabelCaller') || 0 };
}
function metric(r, phase, index) {
  const s = r.snapshot, bodies = s.resources.filter(x => /production-crossings\.geojson/.test(x.url));
  const probes = s.resources.filter(x => /assets\/markers\//.test(x.url));
  return { phase, case: r.case, mode: r.mode, bootstrapMs: s.diag.startupCompletedAtMs, usableMs: r.usability.paintAt, clickPaintMs: r.usability.hostClickAndPaintMs, crossings: s.crossings, roads: s.roads, crossingRequests: s.fetch.filter(x => /production-crossings\.geojson/.test(x.url)).length, crossingBodyBytes: bodies.reduce((sum, x) => sum + x.encoded, 0), crossingTransferBytes: bodies.reduce((sum, x) => sum + x.transfer, 0), markerProbeRequests: probes.length, markerProbeBytes: probes.reduce((sum, x) => sum + x.encoded, 0), longTaskCount: s.longTasks.length, longTaskMs: s.longTasks.reduce((sum, x) => sum + x.ms, 0), longestTaskMs: Math.max(0, ...s.longTasks.map(x => x.ms)), blockingAbove50Ms: s.longTasks.reduce((sum, x) => sum + Math.max(0, x.ms - 50), 0), ...cpu(`${phase}-${r.case}-${index}.cpuprofile`) };
}
const measurements = [], parity = [];
for (let i = 0; i < after.length; i++) {
  const a = after[i], b = before[i]; assert.equal(a.case, b.case); assert.equal(a.mode, b.mode);
  assert.deepEqual(a.snapshot.dom.inventoryIds, b.snapshot.dom.inventoryIds);
  assert.deepEqual(a.snapshot.dom.consumerIds, b.snapshot.dom.consumerIds);
  assert.deepEqual(a.snapshot.area.countyMemberships, b.snapshot.area.countyMemberships);
  assert.equal(a.snapshot.context.placeId, b.snapshot.context.placeId); assert.equal(a.snapshot.context.countyId, b.snapshot.context.countyId);
  assert.equal(a.snapshot.dom.camera.zoom, b.snapshot.dom.camera.zoom);
  assert.ok(Math.abs(a.snapshot.dom.camera.center.lat - b.snapshot.dom.camera.center.lat) < 0.00001);
  assert.ok(Math.abs(a.snapshot.dom.camera.center.lng - b.snapshot.dom.camera.center.lng) < 0.00001);
  const index = a.mode === 'cold' ? 0 : Number(a.mode.split('-')[1]);
  measurements.push(metric(b, 'before', index), metric(a, 'after', index));
  parity.push({ case: a.case, mode: a.mode, inventoryCount: a.snapshot.dom.inventoryIds.length, consumerCount: a.snapshot.dom.consumerIds.length, orderedIdsMatch: true, identityMembershipsAndCameraMatch: true });
}
const cases = ['Crosby', 'Dayton', 'Dallas', 'Coldspring'];
const comparison = cases.map(name => {
  const values = phase => { const rows = measurements.filter(r => r.case === name && r.phase === phase); return Object.fromEntries(Object.keys(rows[0]).filter(k => typeof rows[0][k] === 'number').map(k => [k, median(rows.map(r => r[k]))])); };
  return { case: name, before: values('before'), after: values('after') };
});
const failures = file => fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(x => /^not ok/.test(x)).map(x => x.replace(/^not ok \d+ - /, ''));
const suites = ['investigation', 'expanded'].map(suite => {
  const old = failures(`before-${suite}.tap`), current = failures(suite === 'investigation' ? 'after-investigation.tap' : 'after-expanded.tap');
  assert.deepEqual(current, old); return { suite, baselineFailures: old, newFailures: [] };
});
const functional = [];
for (const name of cases) {
  const file = `after-${name}-functional.json`; if (!fs.existsSync(path.join(dir, file))) continue;
  const a = read(file), old = `before-${name}-functional.json`;
  if (fs.existsSync(path.join(dir, old))) {
    const b = read(old); assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
    const rows = [];
    for (const state of a.states) {
      const previous = b.states.find(s => s.label === state.label); if (!previous) continue;
      for (const key of ['inventoryIds', 'consumerIds']) assert.deepEqual(state[key], previous[key]);
      // Model ordering can respond to independently captured timestamps. Identity,
      // source ownership and coordinates must remain exactly equivalent.
      for (const key of Object.keys(state.surfaces)) {
        const sort = records => records.slice().sort((x, y) => x.id.localeCompare(y.id));
        assert.deepEqual(sort(state.surfaces[key]), sort(previous.surfaces[key]), `${name}/${state.label}/${key}`);
      }
      assert.deepEqual(state.weather, previous.weather); assert.equal(state.context.type, previous.context.type);
      if (state.context.type !== 'AROUND_ME') assert.equal(state.context.placeId, previous.context.placeId);
      else { assert.match(state.context.placeId, /^foreground-location:/); assert.equal(state.context.lat, previous.context.lat); assert.equal(state.context.lng, previous.context.lng); assert.equal(state.context.health, previous.context.health); }
      assert.equal(state.context.countyId, previous.context.countyId);
      rows.push(state.label);
    }
    functional.push({ case: name, comparedStates: rows, checks: a.checks, popupBefore: b.popup, popupAfter: a.popup });
  }
}
const result = { head: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), appSha256: crypto.createHash('sha256').update(fs.readFileSync('js/app.js')).digest('hex'), measurements, comparison, parity, suites, functional };
const activeBefore = read('before-Dayton-active-popup.json'), activeAfter = read('after-Dayton-active-popup.json');
assert.deepEqual(activeBefore.errors, []); assert.deepEqual(activeAfter.errors, []);
assert.equal(activeBefore.popup.id, activeAfter.popup.id); assert.deepEqual(activeBefore.popup.fields, activeAfter.popup.fields);
assert.ok(activeBefore.checks.activePopup && activeAfter.checks.activePopup);
result.activePopup = { before: activeBefore.popup, after: activeAfter.popup };
const priorHash = read('initial-after/after-metadata.json').appSha256;
const diagnosticOnlyPriorSource = fs.readFileSync('js/app.js', 'utf8').replace('popupContentBuilt: 0, listenersAttached: crossingsNeedingMarkers.length', 'popupContentBuilt: crossingsNeedingMarkers.length, listenersAttached: crossingsNeedingMarkers.length');
assert.equal(crypto.createHash('sha256').update(diagnosticOnlyPriorSource).digest('hex'), priorHash);
result.functionalSourceProvenance = { fullStateQualificationSha256: priorHash, finalSha256: result.appSha256, onlyDifference: 'marker-render audit popupContentBuilt count corrected to zero for deferred content' };
const functionalBeforeMetadata = read('before-functional-metadata.json'), functionalAfterMetadata = read('after-functional-metadata.json');
assert.equal(functionalBeforeMetadata.appSha256, read('before-metadata.json').appSha256);
assert.equal(functionalAfterMetadata.appSha256, result.appSha256);
result.functionalSourceProvenance.currentSettledReplay = { beforeSha256: functionalBeforeMetadata.appSha256, afterSha256: functionalAfterMetadata.appSha256 };
fs.writeFileSync(path.join(dir, 'comparison.json'), JSON.stringify(result, null, 2));
const seconds = n => (n / 1000).toFixed(2), mb = n => (n / 1000000).toFixed(3);
const pair = (r, key, format = seconds) => `${format(r.before[key])} -> ${format(r.after[key])}`;
const table = comparison.map(r => `${r.case.padEnd(11)} | ${pair(r, 'bootstrapMs').padEnd(15)} | ${pair(r, 'usableMs').padEnd(15)} | ${pair(r, 'selectorMs').padEnd(15)} | ${pair(r, 'popupMs').padEnd(15)} | ${pair(r, 'crossingRequests', String).padEnd(6)} | ${pair(r, 'crossingBodyBytes', mb).padEnd(17)} | ${pair(r, 'markerProbeRequests', String).padEnd(8)} | ${pair(r, 'markerProbeBytes', mb).padEnd(17)} | ${pair(r, 'blockingAbove50Ms').padEnd(15)} | ${pair(r, 'longestTaskMs', String)}`).join('\n');
const report = `Gridly post-launch community loading performance repair
22 October 2026

Decision

GO for committing this isolated local repair after explicit owner authorization.
NO-GO for release or deployment based on these browser results alone. Native
device and published-source reconciliation steps remain below. No commit,
push, merge, store build, release or deployment was performed.

A. Repository and provenance

Repository: DBMaps/liberty-county-map
Worktree: C:/Users/gulfi/.codex/worktrees/4d36/liberty-county-map
Starting state: clean, detached HEAD, exact investigation source fingerprint.
Branch created: codex/community-loading-performance-repair
Starting HEAD and final HEAD: ${result.head}
The branch starts from the audited development snapshot matching local main
and cached origin/main. It does not incorporate unrelated later worktrees or
assert that the currently published store artifacts were independently traced.
Final application SHA256: ${result.appSha256}
Git status: js/app.js modified; the new focused test and tools directory are
untracked, unstaged. HEAD has not moved. Audit evidence remains gitignored.

B. Root causes and precise repair inventory

Only one shipping source file changed: js/app.js (93 insertions, 24 deletions).
No source datasets, classification predicates, source-authority modules, CSS,
markup, frameworks, native projects, manifests or dependencies changed.

A / lookup: getGridlyAwarenessIntelligenceCrossing (53718) now builds first-match
ID and lazily normalized-name maps per inventory array, length, inventory
revision, county, transition generation and normalizer identity. It retains
the exact prior explicit-ID precedence, whitespace behavior, name fallback,
normalization and first-match ordering. A generic incident record.id is still
not interpreted as a crossing ID. The change removes nested full-array scans
while preserving the published matching semantics.

B / popup: renderCrossings (61481), inside renderCrossingMarkersFromList, binds
a Leaflet content callback instead of eagerly invoking buildPopup. The existing
prepareGridlyCrossingPopupContent/finalizeOpenCrossingPopup activation owner
still constructs the unchanged current report/location model synchronously
before opening. Direct Leaflet activation also has a content callback. The
content signature starts empty and the render diagnostic now correctly reports
zero eagerly built popups. No user-visible placeholder or extra request was added.

C / hydration: loadCrossings (55348) installs and shares one pending transaction
per county and transition generation before entering gridlyHydrateCrossings
(55363). Both success and failure evict the matching pending transaction.
Review-mode wrapping (117023) preserves the ordinary shared promise. Existing
normalization, classification, governed-source resolution and success commit
guard remain. A late stale failure can no longer overwrite a newer generation's
failure flags or consumer status text. ensureGridlyActiveCountyCrossingInventory
(56595), gridlyAwaitActiveCountyCrossingInventoryLoad (50729) and the runtime
audit (50262) now qualify pending work by generation too, including A-B-A.
Governed empty inventory is still a healthy loaded state; failures can retry.

D / existing shared-summary reuse: gridlyAwarenessSummaryInputRevision (54031)
fingerprints selected area, full current context/generation, operational county,
crossing/road/hydration revisions, report and hazard contents, alert rows,
lifecycle-correct community revision, source freshness/health, provider revision
and complete retained roadway/weather records. Unsupported/circular snapshots
cannot authorize reuse. buildGridlyCommunityAwarenessIntelligenceSummary
(54055) stamps newly built summaries; isGridlyCachedAwarenessSummaryForCurrentArea
(43066), gridlyV734BuildRefreshReuseSignature (27000), Pulse publication (66318)
and authoritative publication (66359) validate those snapshots. This strengthens
the existing publication machinery without introducing a long-lived summary
memoizer. Existing legacy official-only compatibility remains; those records
continue through the current official publisher's source qualification.

E / diagnostics: gridlyGetInvalidRoadLabelCaller (9204) does not construct Error
stacks in ordinary operation. The road-label eligibility predicate and operation
context remain unchanged. Explicit GRIDLY_DEBUG / GRIDLY_PERFORMANCE_DEBUG or
the existing debug preferences retain development caller/stack diagnostics.

New nonshipping files:
- tests/community-loading-performance-repair.test.cjs: production-function,
  baseline-parity, hydration, retry/race, popup and summary-invalidation tests.
- tools/community-loading-repair/baseline-source.cjs: read-only test substitution.
- run-tests.cjs plus two manifests: reproducible baseline/final suite comparison.
- replay.cjs: controlled four-community browser replay.
- verify-runtime.cjs: active safety, portrait, context and popup verification.
- report.cjs: assertions, CPU aggregation and comparison/report generation.
- README.txt: exact reproduction commands and scope.

C. Comparable before/after measurements

Three runs per community per phase: one cold context and two reloads. Installed
headless Edge, 390 x 844 portrait, identical fixtures and unthrottled desktop
CPU, real public roadway payloads replayed locally after hash verification.
The recognized preview hostname was mapped exclusively to loopback so ordinary
production hostname branches ran. No hosted server was modified. Interception
means reloads are not a representative warm HTTP-cache benchmark.

Values below are medians, before -> after. Bootstrap and usable-view are actual
end-to-end browser observations, not extrapolated lookup microbenchmarks.
Usable-view means a real Alerts dock click after startupCompleted followed by a
painted visible sheet with the correct PLACE/county/map state; this is a
conservative observed usable-view bound, not the earliest possible input event.
CPU values are inclusive sampled totals over navigation/probe observation
windows; those windows shorten with the repair. Do not add overlapping CPU
values. Blocking is sum(max(long-task duration - 50 ms, 0)) through the snapshot.
0 popup CPU means no samples for eager popup construction in this startup probe.

Community   | Bootstrap s     | Usable-view s   | Selector CPU s  | Popup CPU s     | Bodies | Body MB           | PNG req  | PNG MB            | Blocking s      | Longest task ms
${table}

Crossing transfer bytes including ResourceTiming overhead, per run:
${comparison.map(r => `${r.case}: ${r.before.crossingTransferBytes} -> ${r.after.crossingTransferBytes}`).join('\n')}

County inventories/road features remain complete and equal: Harris 1,159/45,588;
Liberty 115/8,405; Dallas 789/40,208; San Jacinto 12/3,906. The same initial
consumer crossing sets remain 23, 27, 209 and 0 respectively. Coldspring's zero
is the existing local/viewport geography result, not unavailable county data.

The 28 global marker dimension probes remain, about 27.71 MB. The extra observed
before PNG in Crosby/Dallas was a rendered asset; no asset-delivery optimization
is claimed. The 47.91 MB all-county geometry package also remains. After-repair
long tasks still reach hundreds of milliseconds; a sub-100-ms startup target
has not been achieved. Coldspring's small selector total and click latency show
minor variation, not a justified claim that every individual operation improved.

Published uiUsable still fires before complete community usability. Its early
flag was not used to claim these gains. Store verification, native networking,
live feed latency and phone-class throttling are outside this controlled replay.
The baseline DriveTexas configuration is unavailable; active DriveTexas/NWS
validation below uses explicit controlled fixtures, not a live-service claim.

D. Functional equivalence and safety evidence

report.cjs asserts exact ordered county crossing IDs and consumer-visible IDs
for all 12 paired replays, county-qualified memberships/PLACE identity, and map
camera equivalence. Every governed package row was also checked by the focused
test against the unchanged original lookup, including duplicate names and IDs,
aliases, punctuation, missing values and generic incident IDs.

Four paired functional cases compare 33 settled states. For every surface they
assert the same evidence IDs, source IDs, source kind, county and coordinates,
plus crossing sets, context, and weather freshness. Timestamp-derived Around Me
session IDs naturally differ, so those compare type, health, county and exact
coordinates rather than their capture-time suffix.

All cases retain a fresh countywide Flash Flood Warning and a nearby DriveTexas
closure in Alerts alongside community hazard/crossing reports. Complete retained
DriveTexas snapshots keep both nearby and more distant county records. Clearing
community reports leaves independent official/NWS alerts visible. A failed
roadway source remains unavailable rather than healthy-empty, retaining the
independent current warning. Clearing weather leaves the official closure.
No new PLACE-only allowlist, radius reduction, county filter or alert limit was
introduced. Existing source eligibility and boundary/crossing policies remain.

Search resolves real governed Dayton identity; Around Me activates a fresh fix,
expires it to stale, and the real Return Home control restores accepted Home.
Route Watch context rejects competing Search/Around Me activation. Dayton's fast
Crosby -> Coldspring -> Dayton selection sequence finishes with Liberty inventory
and correct current identity while older work completes late. Node tests also
exercise actual hydration commit rejection, same-county A-B-A late success and
failure, shared pending work, retry after failure, and governed empty state.

Popup content compares actual activation with the unchanged current production
model. First unreported popup activation was 96 -> 91 ms synchronous in Crosby,
81 -> 79 ms in Dayton, and approximately the same order in Dallas. The separate
active blocked-crossing popup test on the final source matches title, road label,
guidance, confidence and freshness exactly; no placeholder is shown:
  synchronous activation ${activeBefore.popup.synchronousMs.toFixed(1)} -> ${activeAfter.popup.synchronousMs.toFixed(1)} ms
  visible paint including the existing pan/open flow ${activeBefore.popup.paintMs.toFixed(1)} -> ${activeAfter.popup.paintMs.toFixed(1)} ms
No added first-activation delay was observed in these fixtures. Coldspring has
no initial crossing marker; popup activation was correctly marked not applicable.

Portrait checks cover all captured states for overflow and malformed labels;
active before/after screenshots were inspected. CSS/markup are unchanged.
The original full state comparison used source ${priorHash}; final source differs
only in the nonfunctional popupContentBuilt diagnostic literal. report.cjs reverses
that one literal and verifies the full prior SHA256. The local-commit gate also
reruns the complete settled-state comparison on the final exact source and checks
both served-source fingerprints, alongside the repeated performance cohort,
regression suites and active-popup check.

The commit-gate replay exposed an earlier Around Me capture with weather still
in flight. The harness now awaits the real context-qualified connector refresh
and rejects any capture whose weather authority is still loading. Both original
and repaired sources are rerun with the same corrected settling procedure. This
is a benchmark correction, not a shipping change or a newly waived product failure.
An intermediate unconditional refresh produced a baseline provider timeout and
was removed. The final wait only starts a missing first request for a valid
current point; it does not republish an already checked source. Both diagnostic
attempts are preserved separately from the successful certification evidence.
Coldspring also exposed the harness reusing manual_refresh within the existing
report-read dedupe window. The clear-fixture step now uses its own request reason
and asserts an increased authoritative retrieval revision, succeeded status and
cleared input collections before testing summary clearing. The production dedupe
policy is unchanged; the failed pre-read capture is archived separately.

E. Tests and baseline failures

Original investigation suite: 339 results, 333 pass, six fail before and after.
The exact six documented failures remain:
${suites[0].baselineFailures.map(s => '- ' + s).join('\n')}

Expanded native/portrait/popup/source suite: 103 results, 94 pass, nine fail on
both the original source and repair. These are ADDITIONAL baseline findings,
not reclassified as part of the investigation's six:
${suites[1].baselineFailures.map(s => '- ' + s).join('\n')}

New focused suite: 28 pass, zero fail. Across the two existing suites and new
suite: 470 reported results, 455 pass, 15 reproduced baseline failures, ZERO new
failures. One passing file overlaps the existing manifests; these are reported
results, not a claim of 470 unique tests. Syntax checks and git diff --check pass.
There is no default npm test script; the manifests record the selected relevant
automated coverage. No claim is made that every historical repository test ran.

The original failures include incomplete VM fixtures and older static source
contracts. The expanded failures include existing Android dependency/SDK and
artifact-reference expectations. They are not silently waived for release.
Raw TAP logs and exact before/after failure lists are retained in this directory.

F. Risk for published iOS and Android apps

This is a local, uncommitted shared-JavaScript repair. Current installed apps and
published assets are untouched. The repair adds no dependency, bridge API,
permission, schema, framework, native setting or asset update. Native weather
and packaging-related automated checks ran; existing Android contract failures
remain. Windows browser testing is not physical iOS/WKWebView or Android WebView
certification, and no Xcode/Gradle/store build was performed.

Main residual risks: popup timing on real devices, full-source fingerprint cost
as live DriveTexas volume grows, shared model publication under native resume,
and the remaining geometry/image startup memory and main-thread work. The
fingerprint intentionally favors fresh complete evidence over aggressive reuse;
its cost is linear in retained records. Live credentials/feed volume were not
available in the original baseline and have not been certified by fixtures.
The audit branch must be reconciled with the exact currently approved store
source before any integration/release; cached main refs do not prove that lineage.

G. Exact next testing steps

1. Review js/app.js diff, focused tests, comparison.json and these baseline-failure
   lists. Obtain explicit authorization before making the local commit.
2. Confirm the exact published iOS and Android source SHAs and evaluate the patch
   on their approved development successor. Do not merge unrelated launch work.
3. Resolve or explicitly disposition the six original and nine additional baseline
   failures with their owners; Android dependency/SDK contracts need attention
   before a native release, not an unrelated change in this repair.
4. After separate build/test authorization, use internal iOS and Android builds on
   physical devices. For all four communities test cold/warm launch, Alerts, active
   and cleared popups/actions, Search/camera, GPS denial/expiry, Return Home, Route
   Watch start/stop, rapid A-B-A switches, offline/retry and background/resume.
5. With sanctioned live configuration, verify DriveTexas/NWS source identities,
   countywide and cross-border relevance, source freshness and retained alerts.
   Measure live payload size and fingerprint cost without logging credentials.
6. Repeat at least five interleaved phone-class runs per case with controlled
   network/CPU and real warm HTTP cache. Report p50/p95 input-to-paint and memory,
   separating store admission, shell, community readiness and source readiness.

H. Local commit recommendation

GO for the narrow isolated commit, subject to the owner's explicit permission.
The complete crossing sets, paired safety surfaces and published UI remain
equivalent in the controlled coverage, gains are end-to-end measured, and no
new automated failure appeared. NO-GO for release until the native/source/live
checks above are complete. All changes are left unstaged and uncommitted.

Evidence and reproduction

comparison.json: 24 performance replays, all metrics and parity assertions.
before/after-CASE-N.cpuprofile: standard DevTools CPU profiles.
before/after-baseline.json and metadata: raw timing/network/resource capture.
before/after-CASE-functional.json: paired settled safety/context state evidence.
before/after-Dayton-active-popup.json: active popup identity/content/latency.
before/after-CASE-active-portrait.png: visual regression evidence.
before/after-investigation.tap, before/after-expanded.tap, unit-final.tap: tests.
initial-after/: preserved earlier after cohort before the diagnostic correction.
The early hidden-map investigation and intermediate fixture timing/targeting
diagnostics are not treated as valid performance or product-failure results.
See tools/community-loading-repair/README.txt for exact commands.
`;
fs.writeFileSync(path.join(dir, 'REPAIR_REPORT.txt'), report);
console.log(JSON.stringify({ comparison, parityCases: parity.length, functionalCases: functional.length, suites }, null, 2));
