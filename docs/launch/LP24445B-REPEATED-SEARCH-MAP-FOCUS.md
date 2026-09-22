# LP244.45B — Repeated Search map focus

Baseline: a3218de7fd0b1a4de40768df7e631ead473ec60e. Branch: LP244.45-unified-awareness-context-foundation. Owner acceptance remains pending physical/local retest.

## Before-patch RCA

selectGridlySearchResult normalizes the selected destination, advances selection generation, cancels old route publication/preview, and activates the unified temporary context. Coordinates and identity are correct. However, gridlyRefreshUnifiedAwarenessContext only dispatches a camera when options.fitMap is set; Search does not set it, while clear/Return Home does. Search relies on its separate legacy focusGridlyDestinationOnMap call, guarded by marker && !isGridlyDestinationVisibilityCardPresent(). The visibility detector tests the shared command card's geometry, not whether a route preview actually owns movement. When Location Context is visible, this suppresses the only Search camera call. applyGridlyDestinationVisibilityOffset is not a fallback: it requires an active route preview and runs in preview loading, not community selection.

The first selection can move through a second incidental path: loadCrossings calls applyGridlyHomeTownAwarenessContext({ source: "crossings_loaded", fitMap: true }). That function reads the current awareness anchor, so loading Harris inventory can focus Crosby even though Search issued no camera request. After returning to Cleveland, Dayton shares the already-loaded Liberty inventory; no new crossing-load completion is required to rescue its missing focus. The baseline browser trace confirms a crossings_loaded Crosby dispatch and no Search dispatch for Dayton. The legacy marker focus can also run when the shared card happens to be absent. Neither path is a reliable accepted-selection contract. After Home restoration, its semantic camera is explicitly Cleveland; the next Search can update all context readers without issuing any camera call. There is no already-centered or coordinate equality optimization in that branch. The offset dedupe key belongs only to active route previews, so clearing that cache would not repair this failure. Canonical Cleveland, Crosby and Dayton targets already exist in generated presentation data and require no new coordinates.

Existing county hydration/route publication generations cancel stale work; they are not why a current Search dispatch is absent. Return Home's existing semantic dispatch must remain unchanged. The semantic camera's county synchronizer also has Home persistence side effects for multi-county places; a temporary Search handoff must not invoke those Home-owned writes after the unified transition has already qualified its county.

The prior LP244.45A browser assertions checked map center after Return Home only. They did not compare each repeated Search map center against its selected canonical target. LP244.45B adds that missing regression assertion.


## Repair

selectGridlySearchResult retains the snapshot returned by gridlySelectSearchAwarenessContext. After marker and UI publication, gridlyFocusSearchAwarenessContext performs the accepted selection's single focus without consulting destination-card visibility. The snapshot must still be the exact active SEARCH snapshot, have the matching destination ID, and be fresh. A canonical community dispatches its governed area through gridlyDispatchSemanticCamera, with animate false and the accepted temporary snapshot. A POI continues to focus its exact destination coordinates through the existing destination camera, separately from its surrounding awareness community. The pre-foundation compatibility path remains for callers without an awareness snapshot.

The semantic camera rejects stale temporary snapshots before movement. For a current temporary snapshot it reuses the existing governed PLACE camera and semantic sequence, while skipping the Home-persisting county synchronizer: the unified context transition has already qualified and activated its operational county. Non-temporary callers, including Return Home, keep their existing path. Existing PLACE commit state means late crossings_loaded callbacks recognize the current committed camera and do not add a second movement. No timer, retry, polling, new animation or new render cycle was added.

## Governed targets and browser evidence

Targets are read from existing data/generated/gridly-statewide-place-presentation-v1.json, not a new fixture:

| Community | PLACE GEOID | Latitude | Longitude |
|---|---|---|---|
| Cleveland | 4815436 | 30.3414794 | -95.0900115 |
| Crosby | 4817756 | 29.91154 | -95.0632549 |
| Dayton | 4819432 | 30.0473202 | -94.8873913 |

Baseline browser evidence reproduces the mismatch: Crosby and then Dayton are active while center remains Cleveland. The trace captures the incidental crossings_loaded Crosby movement between observations, and only Return Home has a reliable matching camera. Repaired browser evidence shows exact canonical target equality after Crosby → Home Cleveland → Dayton → Crosby → Dayton, then a final Return Home. Visible Location Context, weather identity, KBYG, Nearby, DriveTexas, community and crossing qualification remain aligned. The actual UI uses Search, result selection, X and Return Home; no reload or Settings navigation is involved. Return Home hides on Home and Search remains available. Four Home storage values compare byte-for-byte equal before/after.

The actual Search editor clears an existing selected destination when the query is edited/submitted. That existing behavior produces two intermediate Home clears during the last two UI searches. The trace therefore contains four accepted Search focuses plus three Home clear focuses, each with a unique context generation. The direct-selection --quick flow contains four Search focuses plus one explicit Home focus. There are no duplicate focuses for an accepted generation. This phase deliberately does not change query editing or clear semantics.

Late Crosby focus handoff and direct temporary semantic dispatch both return false after immediate Dayton selection; map coordinates stay exactly Dayton. The focused test also replays crossing hydration after Dayton and verifies no second camera operation. Existing delayed NWS/POI and route-publication tests remain passing.

## Tests and limits

- New LP244.45B focused tests: 9/9 pass.
- Main regression batch, including LP244.45/.45A, Search, route publication and multi-county: 76/76 pass.
- Additional camera, startup, weather/KBYG and Location Context tests: 41/43 pass. The same two LP197 VM tests fail at baseline because their extracted-function harness omits gridlySynchronizeActiveCountyForOperationalContext. Read-only baseline source substitution reproduces both failures; no historical test was changed.
- Combined distinct tests: 119, with 117 pass and two reproduced baseline failures. No new test regression detected.
- Actual-control browser and direct rapid-selection browser pass, including map/context equality, storage, control visibility and stale camera rejection. Baseline, repaired and rapid-path JSON plus portrait screenshots are in reports/lp24445b-*.
- JavaScript syntax and whitespace checks pass. Runtime diff is limited to js/app.js: 22 insertions and three deletions. No HTML/CSS or layout changes were needed; the 390 × 844 portrait capture retains the existing Location Context controls.

Browser testing uses headless Edge, governed local assets, deterministic NWS responses and blocked other remote requests. It retains the previously documented seeded saved-destination profile. It does not certify live tiles/providers, native hardware or physical/local owner acceptance. The baseline source hook serves git-show data in memory; it never rewrites the working app.

Reproduce with node tools/lp24445b/verify-browser.mjs, --baseline or --quick. Focused tests: node --test tests/lp24445b-repeated-search-map-focus.test.cjs. Existing baseline source-extraction checks use --require ./tools/lp24445b/baseline-app.cjs.

## Noninterference and disposition

No notifications, hazard taxonomy, winter hazards, Around Me activation, Route Watch implementation, Android/iOS native, Supabase/backend, reporting, moderation, retention, privacy, public-site, Dispatch or production changes. No build, push, merge or deployment. Prior phase artifacts remain unchanged.

One follow-up local commit is authorized: Repair repeated search map focus. Status remains READY FOR OWNER RETEST, not fully accepted.
