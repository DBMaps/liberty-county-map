# Gridly LP244.49B1 — Pulse provenance closure

Decision: **CONDITIONAL**. Generated 2026-09-24T23:50:37.985Z.

Final app SHA-256: f57fac7440ad6ad9bf230e1f41cffeefb7f22405c0a58b696e48bba3ce0ed0cd

Final weather SHA-256: f890f7bb5bf18a5012f2da719e18562ce9a48af106202152ed232f6e98e10d07

## A. Branch

LP244.48-destination-quick-check-around-me

## B. Starting HEAD

5538432be3bfe12c6dc0d3f34dcc9fd97c6edc3c

## C. Starting git status

Dirty as expected. Exact status is in starting-baseline.json.

```text
M js/app.js
 M js/gridlyWeatherLiveConnector.js
?? docs/launch/LP24449-AUDIT-PROGRESS.md
?? docs/launch/LP24449-TEXAS-STATEWIDE-CERTIFICATION.md
?? docs/launch/LP24449B-STATEWIDE-CLOSURE.md
?? reports/lp24449/
?? reports/lp24449b/
?? tests/lp24449b-source-truth-and-filter.test.cjs
?? tools/lp24449/
?? tools/lp24449b/
?? tools/lp24449b1/
```

## D. Starting dirty-file inventory

Product: js/app.js, js/gridlyWeatherLiveConnector.js. Captured 6954 tracked hashes and 2572 prior untracked hashes. See starting-baseline.json.

## E. Executive Pulse finding

Same-area published community summaries are reusable without the existing canonical community revision. A DriveTexas consumer publication while a local report is active captures that normalized report in activeHazardsInArea. After clear removes the current authoritative rows, getGridlyAlertsSurfaceActiveCommunityReportRows falls back to the still-area-valid published summary; its original report object re-enters the lightweight Pulse model. Shared-model caching then republishes the wrong count.

## F. Conroe reproduction

Pre-repair paired test: ordinary isolated clear converged; provider publication while active reproduced published count 1 after clear and two refreshes. Post-repair both variants clear to 0. Full 0/50/100/250/500/1000/2000ms observations are in three-witness-comparison.json and publication-race-before/after.json.

## G. Bowie reproduction

Pre-repair paired test: ordinary isolated clear converged; provider publication while active reproduced published count 1 after clear and two refreshes. Post-repair both variants clear to 0. Full 0/50/100/250/500/1000/2000ms observations are in three-witness-comparison.json and publication-race-before/after.json.

## H. Alamo Heights reproduction

Pre-repair paired test: ordinary isolated clear converged; provider publication while active reproduced published count 1 after clear and two refreshes. Post-repair both variants clear to 0. Full 0/50/100/250/500/1000/2000ms observations are in three-witness-comparison.json and publication-race-before/after.json.

## I. Exact stale candidate identity

gridly-test-lp24448a-1790281876622-145; object-18221; leon-tx/4811116. This additional statewide witness preserves the exact normalized object. Each required witness has its own identity in pulse-provenance.json.

## J. Candidate source collection

published summary activeHazardsInArea

## K. First divergence point

gridlyGetPublishedAwarenessAlertRecordsForCurrentArea accepts the stale same-area summary; downstream: getGridlyAlertsSurfaceActiveCommunityReportRows → getGridlyUserFacingActiveRoadHazardIncidents → buildGridlyLightweightActiveAwareness → buildGridlyCommunityPulseModel → refreshGridlyCommunityPulseSharedModel.

## L. Visible versus published count

Visible consumers read the governed projection, which is empty. The legacy active-awareness branch additionally trusts the old same-area publication.

## M. Isolated replay behavior

A provider/periodic publication must occur in the active interval. Five paired witnesses/controls clear without it and fail deterministically with it; county identity is not causal.

## N. Hypotheses

1. RULED_OUT: raw activeHazards and normalized activeReports empty
2. RULED_OUT: grouped current incident arrays empty
3. RULED_OUT: marker layers/DOM empty after clear; retained object originates in publication
4. RULED_IN: same-area cached summary retains obsolete community candidate
5. RULED_OUT: new candidate collections inherit publication fallback; no persistent Set/Map removal failure
6. RULED_OUT: same normalized object identity followed through fallback; raw removal succeeds
7. PROVEN: published activeHazardsInArea retains original normalized report
8. PROVEN: community clear revision missing from summary validity
9. RULED_OUT: accepted context generation remains identical across clear; data revision changes
10. PROVEN: provider publication before clear is causal; absence is paired passing control
11. PROVEN: provider publication captures active model; later refreshes reuse old candidate
12. RULED_OUT: fresh contexts in all three witnesses and two controls reproduce
13. RULED_OUT: retained identity is exact flood fixture, not a crossing
14. PROVEN: fixture/raw overlay removed; published normalized object remains
15. PROVEN: cache keyed by area without canonical clear revision
16. RULED_OUT: production provider consumer publication reproduces on fresh contexts with passive timed reads

## O. Proven RCA

Same-area published community summaries are reusable without the existing canonical community revision. A DriveTexas consumer publication while a local report is active captures that normalized report in activeHazardsInArea. After clear removes the current authoritative rows, getGridlyAlertsSurfaceActiveCommunityReportRows falls back to the still-area-valid published summary; its original report object re-enters the lightweight Pulse model. Shared-model caching then republishes the wrong count.

## P. Repair performed

Yes. Existing canonical community revision is attached to awareness summaries, checked at reuse and publication, and a stale incoming summary is rebuilt through existing authority. No timer, forced zero, global purge or fixture-specific product logic.

## Q. Exact product files changed

B1 changes js/app.js only. The final commit also includes the preserved 49B changes in js/app.js and js/gridlyWeatherLiveConnector.js.

## R. Exact test/tool/report files changed

See final-changed-file-inventory.json, which enumerates every selected 49B and B1 path, category and SHA-256. Ignored raw browser logs/screenshots remain local; prior evidence is not overwritten.

## S. Three-witness post-repair result

All three pass both paired variants; 10/10 total paired witness/control runs pass.

## T. Original ten replay

10/10 CLOSED.

| Case | Community | Fixture | Classification | Result |
|---|---|---|---|---|
| LP24449-ledger-02031 | Goldthwaite | synthetic_road | SAME_ROOT_CAUSE | CLOSED |
| LP24449-ledger-02032 | Goldthwaite | synthetic_delay | NO_LONGER_REPRODUCIBLE | CLOSED |
| LP24449-ledger-02033 | Colorado City | synthetic_road | SAME_ROOT_CAUSE | CLOSED |
| LP24449-ledger-02034 | Colorado City | synthetic_delay | NO_LONGER_REPRODUCIBLE | CLOSED |
| LP24449-ledger-02035 | Cut and Shoot | synthetic_road | SAME_ROOT_CAUSE | CLOSED |
| LP24449-ledger-02036 | Cut and Shoot | synthetic_delay | NO_LONGER_REPRODUCIBLE | CLOSED |
| LP24449-ledger-02037 | Marfa | synthetic_road | SAME_ROOT_CAUSE | CLOSED |
| LP24449-ledger-02038 | Marfa | synthetic_delay | NO_LONGER_REPRODUCIBLE | CLOSED |
| LP24449-ledger-02039 | Boling | synthetic_road | SAME_ROOT_CAUSE | CLOSED |
| LP24449-ledger-02040 | Boling | synthetic_delay | NO_LONGER_REPRODUCIBLE | CLOSED |

Exact historical sequences and deliberate provider-refresh ordering are separate evidence. Historical count-only captures do not prove the original refresh ordering. See original-ten-replay.json.

## U. Passing-county controls

10/10, including an actual multi-county Aransas Pass membership, metro/rural and regional coverage, ACTIVE_EMPTY and ACTIVE_POSITIVE counties.

## V. Mixed-source clear

Eight required mixed/context-source cases plus the sequential three-hazard case pass. The provider matrix additionally verifies that clearing a local community condition preserves an unrelated official roadway condition. provider-official-retention.json verifies a nonempty official evidence ID remains identical through 1→2→1→1 published counts.

## W. Context-transition clear

Six cases pass: clear→Search, Search→clear, Around Me→clear, Return Home→clear, County→clear, Area→clear. Saved Home bytes remain unchanged.

## X. Background-refresh races

Three publication orderings pass with interval/report refresh, Pulse and projection overlap; Alerts refresh is also exercised. Exact observed ordering is in clear-lifecycle.json. The separate generation-races.json records five ordered steps and matching canonical/published revisions for each of three overlaps.

## Y. Statewide active→clear

254/254. Every representative deliberately captures the active fixture in a provider publication before clear, then checks immediate, settled and two subsequent refresh cycles. Model, governed counts, local marker and fixture state agree.

## Z. Provider-health regression

1997/1997 exact historical memberships; 10/10 state matrix, passed=true. Controlled provider responses certify behavior, not live availability.

## AA. Crossings

254 packages; 202 ACTIVE_POSITIVE and 52 ACTIVE_EMPTY; 2058 membership contracts; 14/14 reclassified identities join polygon/package ownership to actual browser inventory.

## AB. Filters

362/362 actual multi-county County-filter interactions. Aransas Pass lifecycle includes Search, Around Me, Return Home and route protection.

## AC. Identity

Home contracts 2058; Search 2058/2058; Home browser 793/793; Return Home 793/793; same-county 763/763; cross-county 254/254. All 362 multi-county memberships and governed weather request locality are checked. See identity-regression.json.

## AD. Three-hazard sequential decrement

Flooded Roadway, Debris in Road and Downed Power Line: 3→2→1→0 with an additional publication after each clear. Frozen Alerts regression separately verifies three exact street identities, distinct freshness, disclosure persistence, five consumer surfaces and no undefinedm.

## AE. Rail clear

Passed=true. Neutral→blocked→clear→delay→clear uses real rendered Mark Cleared popup actions; retained inventory markers return to neutral icon and status.

## AF. UI freeze

Settings saved/reopened/reloaded values and keyboard semantics, 12 width/text cases, KBYG controls/4px gap, popup bounds, Saved Places, tile failure/recovery, Around Me messaging, Route Details contrast and close controls. Combined scenarios at 320/360/390/440: 320:PASS, 360:PASS, 390:PASS, 440:PASS. Text-size baseline limitation, if present, is recorded separately; no UI redesign. Existing baseline limitation: at 320 px with Large text, the Text Size control clips Standard/Compact labels and has 38 px button heights. Exact starting-source and repaired-source measurements match (text-size-baseline.json); this B1 change does not repair or certify that existing presentation defect. The first combined clear replay failed on both baseline and repaired source; instrumentation on the repaired source found a detached popup button (connected=false, no document click event). Waiting for the existing popup-open/render-ready state, then atomically selecting/clicking the attached rendered button corrects the harness. See combined-clear-diagnostic.json; original failed captures are preserved.

## AG. Counties

254 total / 254 conditional / 0 fail.

## AH. Communities

1859 total / 1859 conditional / 0 fail.

## AI. Memberships

2058 total / 2058 conditional / 0 fail.

## AJ. Remaining local/governed failures

None.

## AK. Live/native limitations

Live external geocoding, weather, roadway and shared-report acquisition are not fully certified. Physical Android/iOS and native WebViews remain pending. Browser results do not constitute device testing.

## AL. Focused tests

14/14 final focused tests pass, including 4 B1 regression tests, 6 official-publication tests and 4 preserved 49B tests. B1 negative control failed 3/4 before the repair and passes 4/4 afterward.

## AM. Broader tests

Final 263/273 pass; dirty49B baseline 256/266 pass. The same ten failures retain the same causes; no new failure. Details are in identity-regression/test-failure-details.json. These are reported as existing test-suite limitations, not silently counted as passing.

## AN. Browser coverage

See browser-summary.json and performance.json for exact cohorts. Headless desktop Edge with local deterministic routes; maximum two browser workers.

## AO. Runtime/performance

205 minutes elapsed from initial baseline to report. See performance.json for transactions and slowest memberships. These include reload/map/settlement work and are not human latency metrics.

## AP. Backend-write proof

Zero production writes. Every browser starts behind a GET/HEAD/OPTIONS method allowlist, external routes are blocked or locally fulfilled, WebSockets closed and service workers blocked. See browser-summary.json backend evidence and the session harness.

## AQ. Protected-file integrity

6954 tracked files checked against the dirty baseline; only js/app.js changed in B1. All 2572 captured prior untracked files match. The validated 49B weather source is byte-identical.

## AR. Marker integrity

45/45 PNG hashes unchanged.

## AS. Final changed-file inventory

See final-changed-file-inventory.json for exact path/hash inventory and final product diff retained locally at .artifacts/lp24449b1/final-product.diff. Unrelated pre-existing untracked files remain outside the authorized commit.

## AT. B1 decision

CONDITIONAL

## AU. Overall statewide launch-certification status

Local/governed certification is CONDITIONAL pending live-provider and physical-device verification.

## AV. Commit policy

One local commit is authorized after final diff and inventory verification. Actual outcome/hash is recorded in the final response; no push.

## AW. Commit message

Close statewide Pulse publication blocker. Commit hash is recorded in the final response to avoid a self-referential commit hash in committed documentation.

## AX. Merge recommendation

Eligible for owner review as a local functional closure; retain live/native launch conditions. No merge or push performed.

## AY. Final git status

Exact post-action status is recorded in the final response and ignored local commit-outcome.json. The tracked repair and selected certification additions form one commit only if every local gate passes; unrelated starting untracked files are preserved.
