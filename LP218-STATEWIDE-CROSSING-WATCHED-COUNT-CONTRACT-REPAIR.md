# LP218 — Statewide Crossing Watched-Count Contract Repair

## Scope and Family I definition

Family I is a presentation-propagation failure: the authoritative county and its governed crossing package are correct, normalized coordinates and map markers are available, but Location Context publishes a false `0 crossings watched`. It is not a county-authority (Family J), package, coordinate, marker, awareness, Alerts, or KBYG repair.

## Controls and pre-repair evidence

| Control | County | Inventory | Prior watched display | Rendered markers | Classification |
| --- | --- | ---: | ---: | ---: | --- |
| Pecos / Town of Pecos | Reeves | 67 | 0 | 42 | Family I reproducer |
| Cienegas Terrace | Val Verde | 47 | 0 | 8 | Family I reproducer |
| Big Lake | Reagan | 22 | 21 | 3 | positive; 19 outside viewport |
| Floydada | Floyd | 1 | 0 | 0 | positive; sole crossing outside viewport/non-eligible |
| Stanton | Martin | 12 | 12 | independently positive |
| ACTIVE_EMPTY | Tyler | 0 | 0 | 0 | governed legitimate zero |

The Pecos and Cienegas Terrace failures prove that marker publication was not the missing stage. Big Lake proves watched count cannot equal marker count or inventory length. Floydada and ACTIVE_EMPTY prove zero cannot be replaced with inventory length.

## Old derivation path and exact root cause

The correct runtime path was:

1. active county selection;
2. governed source resolution and package fetch;
3. coordinate normalization and guarded inventory commit;
4. `getGridlyHomeTownCrossings` / `gridlySelectConsumerVisibleCrossings` using the full canonical awareness area;
5. independent viewport filtering and marker rendering.

The Location Context projection diverged at step 4. `buildGridlyCommunityAwarenessIntelligenceSummary` deliberately serialized `selectedAwarenessArea` through `getGridlyAwarenessAreaDebugOption`. That compact object nests its center at `coordinates.{lat,lng}` and omits governed geometry. Later, `getGridlyBottomPanelAwarenessCrossingCount` treated the compact debug object as the geographic authority and ran the selector a second time. The selector expects top-level `lat`/`lng` (or governed geometry). Consequently, records that did not happen to match the community label exactly failed geographic ownership and produced zero. Big Lake and Stanton survived through incidental locality-label matches; Town of Pecos and Cienegas Terrace did not. Rendering never consumed that compact summary projection, explaining healthy markers beside the false zero.

## New watched-count contract

The count stages remain distinct:

`county inventory → valid coordinates → reportable/public policy → canonical watched-area geography → watched count`

and independently:

`render candidates → viewport/bounds policy → prioritization/cap → marker registry`

Before calling the shared selector, Location Context now rejoins a compact summary projection to the current canonical awareness area only when identity and authoritative county agree. For a non-current supplied projection, it safely restores top-level coordinates from the compact shape. It does not use inventory length, marker registry size, or DOM text as a count fallback.

## Production changes and scheduling

`getGridlyBottomPanelAwarenessCrossingCount` now resolves canonical watched-area geometry before selecting eligible crossings. `buildGridlyCrossingWatchPresentationModel` records a bounded diagnostic snapshot with county, transition generation, inventory/coordinate/watched/viewport/render/display counts, update reason, prior/new display values, skip breakdown, and current/stale state. It contains no feature collection.

The existing authoritative load contract remains unchanged: inventory commits only when requested county and transition generation still match, increments the inventory revision, and synchronously invalidates/rebuilds awareness surfaces. An old request is rejected before commit, so its previous zero cannot overwrite a newer positive projection. Map movement continues to schedule marker rendering only; it does not update watched eligibility.

## Deterministic and statewide evaluation

The LP218 suite covers the two failures and four positive/zero controls as independent inventory, watched, and rendered sets. The governed production manifest remains the statewide inventory authority: all 254 packages remain available. Existing statewide certification classifies governed zero inventories independently from positive inventories; LP218 adds no fabricated statewide viewport claims because viewport state exists only in a browser session.

Deterministic control expectations after repair are:

- Reeves / Pecos: positive radius-owned watched eligibility (fixture: 48), independently of 42 markers.
- Val Verde / Cienegas Terrace: positive radius-owned watched eligibility (fixture: 21), independently of 8 markers.
- Reagan / Big Lake: 21 watched and 3 rendered from 22 inventory.
- Floyd / Floydada: legitimate 0 watched and 0 rendered from 1 inventory.
- Martin / Stanton: 12 watched.
- Tyler ACTIVE_EMPTY: 0 inventory and 0 watched.

These fixture values certify count propagation and set separation; final browser values remain owner-observed runtime evidence.

## Tests and protected foundations

`npm run test:lp218` proves selector ownership, non-DOM derivation, non-inventory fallback, post-load invalidation, stale-generation rejection, map-move independence, active-county ownership, absence of place/county special cases, and diagnostics. LP196, LP217, LP217.1, LP216, statewide certification, LP214, LP213, LP202.1, and LP202.2 remain required regressions. Thus explicit membership selection, county-qualified persistence/rehydration, no first-label reconstruction, and downstream county convergence remain protected.

## Explicit deferrals

Multi-county operational-context clarity remains a UX/product review: the same canonical place may legitimately show materially different crossing context for different governed memberships while retaining a similar camera. Alerts markup, active-issue reconciliation, official roadway subtype/KBYG, Community Pulse wording, generated incidents, Val Verde awareness behavior, community reports, low-water crossings, and performance optimization are untouched.

Performance evidence is preserved without action: `requestAnimationFrame` observations of 277, 341, 502, 431, 505, and 673 ms; `setTimeout` 113 ms; earlier input handlers of 187 and 214 ms; click handlers over one second; and forced reflow of 38 ms. LP218 introduces one synchronous bounded snapshot and no repeated collection logging.

## Remaining owner browser acceptance (not yet claimed)

Run Pecos, Cienegas Terrace, Big Lake, Floydada, and Stanton in that order. After each authoritative load, execute `window.gridlyCrossingWatchCountAudit()` and the existing crossing pipeline audit. Record county, inventory count, valid-coordinate count, watched-area eligible count, viewport-eligible count, rendered marker count, displayed watched count, skip breakdown, transition generation, and `current`/`stale` state.

Acceptance requires Pecos and Cienegas Terrace to display their positive governed watched eligibility; Big Lake to retain 21 watched / 3 rendered / 19 outside viewport; Floydada to retain 0 watched / 0 rendered / 1 outside viewport; and Stanton to retain 12 watched. Browser PASS is intentionally not asserted by this deterministic artifact.
