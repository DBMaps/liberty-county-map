# Gridly LP244.49A — statewide identity closure

Decision: **APPROVE**. This gate covers locally certifiable Home, Search, explicit membership and downstream identity. It does not certify live provider availability or resolve LP244.49B findings.

Branch: `LP244.48-destination-quick-check-around-me`. Starting HEAD: `02fe47fd1b76a4bd52d8f8487a96cdc8e5c804e8`. Tracked working tree was clean before the repair. Existing LP244.49 untracked evidence was preserved. The commit containing this report is the final local repair commit if approved; its hash is reported separately because a commit cannot embed its own hash.

## Root causes and repair

1. County-filtered Home choices carried a PLACE and county in their source row but lost those fields at the name-only apply path. All governed choices now carry the existing canonical resolution payload and an explicit operational county, including 27 legacy aliases resolved uniquely inside their own county.
2. Legacy Home save and restore round-tripped through nonunique labels. Stable keys and persisted county authority now survive the transaction. Existing storage keys/schema remain in use. The established canonical record path now supports both single- and multi-county PLACEs.
3. A normalized Settings default was being mistaken for saved county authority. Unique legacy names recover deterministically; ambiguous names without a governed county remain unselected and the existing chooser remains available. The 19 startup profiles include Palestine, both Cleveland spellings, county-specific legacy keys, conflicting stale Settings, Work-only and malformed records.
4. Exact governed Search candidates could be removed by address/business relevance and publication stages, including the renderer's second relevance filter. Verified canonical candidates now keep their publication slot and exact county metadata. County-qualified names resolve locally; distinct same-name GEOIDs remain separate choices. An unattempted external request is no longer labeled a failed request when a canonical local result answers the query.
5. Restored Home identity reached Weather with the wrong PLACE in the original failures. The upstream identity repair fixes those inputs. Canonical presentation coordinates feed restored Home and its context cache. Repeated Home reads keep a stable area object until identity or coordinates change. There is no weather exception table or county-centroid substitution.

The only changed product file is `js/app.js`. There are no CSS, marker, data package, crossing package, route-logic, backend, schema, auth or native-build changes.

## Original failure reconciliation

| Original family | Original | Fixed | Remaining |
|---|---:|---:|---:|
| SEARCH_NOT_FOUND | 16 | 16 | 0 |
| HOME_BASELINE_WRONG_CONTEXT | 17 | 17 | 0 |
| HOME_CHOICE_IDENTITY_BINDING_LOSS | 222 | 222 | 0 |
| HOME_MEMBERSHIP_WRONG_CONTEXT | 65 | 65 | 0 |
| WEATHER_WRONG_LOCALITY | 21 | 21 | 0 |
| SEARCH_PUBLICATION_FAILED | 22 | 22 | 0 |
| MULTICOUNTY_WRONG_MEMBERSHIP | 6 | 6 | 0 |

Every original assertion retains its original failure ID and links to proof in `replay-results.json`. No original assertion was dropped. The 17 Nueces baseline assertions have a separate Agua Dulce Home → Search → Return Home replay.

## Coverage

| Check | Result |
|---|---|
| Home option and serialization/deserialization contracts | 2,058 memberships |
| Visible Home save, real reload and Return Home | 793/793; 254 counties |
| Multi-county Home | 362/362 memberships; 163 communities |
| Final-source Search with canonical Home preserved | 2058/2058 memberships |
| Visible Search failures/collisions | 67/67 identities |
| Collision audit | 22 normalized groups / 45 identities |
| Startup profiles | 19/19 |
| Return Home | 793/793 |
| Same-county transitions | 763/763, across 224 counties |
| Cross-county ring | 254/254 |

Lakeview (Hall) and Lake View (Val Verde) belong to one punctuation-free audit group but have distinct word boundaries. Each exact spelling and county-qualified query is tested independently. The other exact-name ambiguities expose distinct governed choices. The initial overly broad expectation and its browser evidence remain in the local diagnostic artifacts.

Home browser coverage is the union of every county representative, all multi-county memberships, every original in-scope failure, every normalized collision identity and the frozen edge cohort. The production chooser's rendered controls execute their real handlers; no fabricated result county is injected. The first pilot also used Playwright pointer clicks. Every final-source Home case performs an actual page reload. Search uses the county metadata returned by the production query itself.

Early Home batches used fresh contexts between counties. Later batches reused each isolated worker session and alternated membership indices to balance the slower metropolitan counties. Every case retained the same save/reload/Search/Return Home assertions; only final-source completed checkpoints count. Ring checks reuse isolated sessions and alternate the 254 county representatives.

## Consumers and frozen UI

Home, active county, Weather point, crossing owner and DriveTexas owner are recorded for every Home browser case. Search records exact PLACE, county, canonical coordinates, Weather locality and byte-for-byte preservation of Home storage. Location Context, Community Pulse, KBYG and Alerts retain their three-hazard projection.

Reload and Return Home also check the actual weather connector point and both NWS point URLs, Location Context and KBYG labels, and all three Alerts source-owner identities. Per-consumer totals are recorded in `browser-summary.json`; full request and ownership proof remains in `home-browser-results.json`.

The frozen inventory contains misencoded community labels. The unchanged starting-source display cleanup removes encoding-artifact characters, so raw inventory text is not the exact visible-label oracle. The report uses that independently captured baseline formatter and records both raw and expected labels, while PLACE, county, coordinates and owner assertions remain separate. For example, the frozen CÃ©sar ChÃ¡vez label renders as C©sar Ch¡vez. This existing data/presentation defect is disclosed in `label-baseline.json` and is not repaired by LP244.49A; no data package or display cleanup was changed.

The required Flood/Debris/Power Line scenario checks three markers and three items in every consumer, separate freshness, no `undefinedm`, and disclosure state across background refresh and reopen. Expected streets are Cook/Church, Winfree/Flowers and Hope/Nancy. Result: PASS.

Settings persistence, reload, arrow/Home/End/Space keyboard operation and 12 width/text combinations are checked at 320/360/390/440px. Map Style retains `standard/satellite`; Theme retains `system/light/dark`. Geometry checks cover KBYG dead space and control containment, popup bounds, map pan, marker taps and local tile failure/recovery. Settings: PASS; geometry: PASS.

The wider historical H1 harness hit Playwright pointer/navigation waiting timeouts on both the starting app and repaired app. Its diagnostic records are retained. Deterministic state checks invoke rendered control click events and wait for the actual sheet state; Settings measurements wait for the entrance animation to settle. The targeted three-hazard suite is the LP244.49A freeze gate. No physical Android/iOS testing is claimed. Standard DOM buttons/radio semantics are the compatibility assumption, not device certification.

The disclosure diagnostic is consistent with a locator retaining an obsolete node during a background render: the earlier locator click did not change the mounted state, while the atomic current-node click did. Resolving and clicking the currently mounted summary in one browser task preserves the real production click/default action; collapse, refresh, close/reopen and expansion then pass without an Alerts code change. Saved Home/Work Search layout at all four widths: PASS.

Visual review confirmed the choice groups, saved-place rows and popup containment. The existing Text Size group clips labels at 320 px in large-text mode. A paired starting/repaired-source browser comparison confirms identical control metrics and appearance. No CSS changed in this milestone; this baseline presentation limitation remains disclosed. See `visual-review.json` and `text-size-baseline.json`.

The wider historical harness also timed out waiting for the crossing-cleared count to settle. The focused starting/repaired replay classifies that diagnostic as **BOTH_PASS_ON_REPLAY**; full stages and failure reasons are in `freeze-clear-comparison.json`. This does not certify or repair the deferred statewide stale-after-clear finding.

## Tests, runtime and safety

Repaired suite: ℹ tests 273; ℹ suites 0; ℹ pass 263; ℹ fail 10; ℹ cancelled 0; ℹ skipped 0; ℹ duration_ms 16009.4787. Starting suite: ℹ tests 266; ℹ suites 0; ℹ pass 256; ℹ fail 10; ℹ cancelled 0; ℹ skipped 0; ℹ duration_ms 13057.9281. The same ten pre-existing failures remain: isolated fixture dependencies and existing asset metadata assertions. New failures: 0. Seven new behavioral tests cover stable Home caching, exact canonical address/business relevance, explicit county authority, ordinary-address protection, and canonical resolution cache validation/invalidation.

Profiling exposed repeated registry scans in canonical Home resolution: 1,000 reads took 582.3 ms before the final cache repair. The final-source diagnostic took 11.3 ms and retained the explicitly selected Harris County Houston identity. The starting source took 26.7 ms but selected Montgomery County, so full-save timings are not comparable. The cache key includes PLACE, supplied memberships and current presentation focus, and requires the same registry reference. Malformed authority still fails closed; coordinate hydration invalidates the cached result. Before-cache evidence is archived locally and excluded from final certification totals.

Headless timings include map rendering, settlement, reload and concurrent local audit work. They do not measure human tap latency. Home accumulated case time: 190.3 minutes; Search: 36.0 minutes. Slow cases are enumerated in `browser-summary.json`.

Production writes: 0. Browser routes reject mutation-capable methods before network continuation, block service workers and close WebSockets. External providers are blocked or locally fulfilled. Controlled NWS/report fixtures prove request geography and local identity; they do not prove live external geocoding, DriveTexas or weather availability.

Protected integrity: 1361 baseline files checked; only `js/app.js` changed. All 45 marker PNGs and all 3489 prior audit files are unchanged. Source SHA-256: `e157d88855529f7a6af3a16905cceb6b05f89f6006b2295bdb0bea2f074dd291`.

## Deferred LP244.49B findings

- PROVIDER_HEALTH_FALSE: 1997 original assertions, not repaired here.
- CROSSING_ELIGIBLE_PACKAGE_MISSING: 12 original assertions, not repaired here.
- PULSE_PUBLISHED_COUNT_STALE_AFTER_CLEAR: 10 original assertions, not repaired here.
- FILTER_COUNTY_WRONG_SCOPE: 1 original assertions, not repaired here.

No push, merge or deployment was performed. The identity repair is suitable for review as one local commit; broader statewide launch remains subject to the deferred findings and live/device certification.

## Exact managed files

### product

- `js/app.js`

### tests

- `tests/lp196-multi-county-place-identity-resolution.test.mjs`
- `tests/multi-county-exit-transition.test.mjs`
- `tests/lp24445-unified-awareness-context.test.cjs`
- `tests/lp24449a-home-cache.test.cjs`
- `tests/lp24449a-search-publication.test.cjs`
- `tests/lp24449a-canonical-home-resolution-cache.test.cjs`

### tools

- `tools/lp24449a/baseline-test-loader.cjs`
- `tools/lp24449a/baseline.mjs`
- `tools/lp24449a/contracts.mjs`
- `tools/lp24449a/disclosure-diagnostic.mjs`
- `tools/lp24449a/docs.mjs`
- `tools/lp24449a/freeze-clear-compare.cjs`
- `tools/lp24449a/freeze-geometry.cjs`
- `tools/lp24449a/freeze-saved-places.mjs`
- `tools/lp24449a/freeze-three-hazards.mjs`
- `tools/lp24449a/freeze-verify-browser.cjs`
- `tools/lp24449a/freeze-verify-settings.cjs`
- `tools/lp24449a/home-browser.mjs`
- `tools/lp24449a/home-read-performance.mjs`
- `tools/lp24449a/integrity.mjs`
- `tools/lp24449a/inventory.mjs`
- `tools/lp24449a/label-baseline.mjs`
- `tools/lp24449a/nueces-baseline.mjs`
- `tools/lp24449a/profiles.mjs`
- `tools/lp24449a/progress.mjs`
- `tools/lp24449a/README.md`
- `tools/lp24449a/report.mjs`
- `tools/lp24449a/runtime-probe.js`
- `tools/lp24449a/search.mjs`
- `tools/lp24449a/session.cjs`
- `tools/lp24449a/tests.mjs`
- `tools/lp24449a/text-size-baseline.mjs`
- `tools/lp24449a/transitions.mjs`
- `tools/lp24449a/visible-search.mjs`

### reports

- `reports/lp24449a/artifact-index.json`
- `reports/lp24449a/backend-safety.json`
- `reports/lp24449a/browser-cohort.json`
- `reports/lp24449a/browser-summary.json`
- `reports/lp24449a/certification-cohorts.json`
- `reports/lp24449a/cross-county-transitions-0.json`
- `reports/lp24449a/cross-county-transitions-1.json`
- `reports/lp24449a/cross-county-transitions.json`
- `reports/lp24449a/decision.json`
- `reports/lp24449a/failure-clusters.json`
- `reports/lp24449a/failure-ledger.json`
- `reports/lp24449a/file-manifest.json`
- `reports/lp24449a/freeze-clear-comparison.json`
- `reports/lp24449a/freeze-saved-places.json`
- `reports/lp24449a/freeze-three-hazards-diagnostic.json`
- `reports/lp24449a/freeze-three-hazards.json`
- `reports/lp24449a/home-browser-results-0.json`
- `reports/lp24449a/home-browser-results-1.json`
- `reports/lp24449a/home-browser-results.json`
- `reports/lp24449a/home-identity-summary.csv`
- `reports/lp24449a/home-identity-summary.json`
- `reports/lp24449a/home-network-0.json`
- `reports/lp24449a/home-network-1.json`
- `reports/lp24449a/home-read-performance.json`
- `reports/lp24449a/integrity.json`
- `reports/lp24449a/label-baseline.json`
- `reports/lp24449a/multicounty-recertification.json`
- `reports/lp24449a/nueces-baseline-replay.json`
- `reports/lp24449a/original-in-scope-failures.json`
- `reports/lp24449a/progress.json`
- `reports/lp24449a/replay-results.csv`
- `reports/lp24449a/replay-results.json`
- `reports/lp24449a/root-cause-map.json`
- `reports/lp24449a/search-recertification.csv`
- `reports/lp24449a/search-recertification.json`
- `reports/lp24449a/starting-baseline.json`
- `reports/lp24449a/startup-profiles.json`
- `reports/lp24449a/test-comparison.json`
- `reports/lp24449a/test-failure-details.json`
- `reports/lp24449a/text-size-baseline.json`
- `reports/lp24449a/visible-search.json`
- `reports/lp24449a/visual-review.json`
- `reports/lp24449a/weather-locality-recertification.json`

### docs

- `docs/launch/LP24449A-STATEWIDE-IDENTITY-CLOSURE.md`

## Pre-commit status snapshot

```text
 M js/app.js
 M tests/lp196-multi-county-place-identity-resolution.test.mjs
 M tests/lp24445-unified-awareness-context.test.cjs
 M tests/multi-county-exit-transition.test.mjs
?? docs/launch/LP24449-AUDIT-PROGRESS.md
?? docs/launch/LP24449-TEXAS-STATEWIDE-CERTIFICATION.md
?? reports/lp24449/
?? reports/lp24449a/
?? tests/lp24449a-canonical-home-resolution-cache.test.cjs
?? tests/lp24449a-home-cache.test.cjs
?? tests/lp24449a-search-publication.test.cjs
?? tools/lp24449/
?? tools/lp24449a/
```

Final post-commit HEAD/status are reported in the task response. Screenshot and diagnostic log paths/hashes are in `artifact-index.json`; local bulky artifacts remain under `.artifacts/lp24449a`.
