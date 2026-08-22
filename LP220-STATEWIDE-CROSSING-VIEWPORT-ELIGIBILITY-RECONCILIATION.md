# LP220 — Statewide Crossing Viewport-Eligibility Reconciliation

## Decision

LP220 found no corrupt Walker package, county divergence, stale transition, coordinate-order error, or alternate/cached crossing viewport. The production decision is a strict containment test against the live Leaflet geographic bounds. The observed Huntsville `36/36 outside_viewport` result means exactly that none of the normalized Walker points was contained by the map bounds passed to that render. LP220 therefore does **not** move the camera, alter LP201, broaden bounds, fabricate visibility, or disable filtering. The minimal repair is deterministic decision-operand instrumentation so this geometrically valid zero-result can no longer be confused with anchor-radius or package failure. A behavior change without an owner capture of the new operands would violate audit-first policy.

## Owner evidence

### Huntsville

The authoritative fresh load selected Huntsville (`4835528`, `walker tx huntsville`) with all county owners on `walker-tx`, generation 0, stable town state, zoom 13, 36 production features, 13 watched, and zero selected/rendered markers. Diagnostics reported all 36 as `outside_viewport`. An earlier transition produced 12 marker elements tens of thousands of pixels outside the DOM viewport; this is secondary evidence and is not treated as successful visibility.

### Eastland positive control

Eastland retained `eastland-tx`, 34 production features, 13 watched, 31 outside, and three selected markers, all inside the map. It demonstrates that the same bounds/filter/render contract can produce a nonzero result.

## Exact predicate and viewport authority

`renderCrossings()` obtains `bounds` synchronously from `map.getBounds()`, obtains the zoom from `map.getZoom()`, and passes both to `getGridlyRegionalCrossingVisibilityPolicy()` and `getGridlyPolicyVisibleCrossings()`. At zoom 13 the V829 policy is `medium-zoom`/`representative`, enables markers, enables viewport filtering, and caps the post-filter list at 80. `getGridlyPolicyVisibleCrossings()` first enforces public-roadway and active-county inventory membership, then evaluates:

```js
!visibilityPolicy.useViewport || !bounds || bounds.contains([crossing.lat, crossing.lng])
```

Thus `outside_viewport` is emitted by `gridlyBuildCrossingRenderCoverageDiagnostics()` when an active-county inventory crossing was not selected and the same live Leaflet bounds fail `contains([lat, lng])`. There is no radius, padding, projected-pixel predicate, semantic PLACE polygon, or awareness-anchor predicate in eligibility. Zoom matters only because V829 turns bounds filtering on at zoom 12 and above. The awareness anchor participates only after eligibility, to distance-sort and cap eligible representatives; it cannot make an outside point eligible. Before and after LP220 the behavior authority remains live `map.getBounds()` with zero padding. LP220 makes that authority and its operands explicit in the audit.

## Presentation, anchor, and actual map comparison

The LP201 Huntsville authority is `[30.7235263, -95.5507771]`; Eastland is `[32.4006299, -98.8194482]`. Huntsville's closest governed production crossing is about 2.66 miles from its presentation point, while Eastland's closest is about 0.40 miles from its presentation point. This differentiating spatial relationship explains why similarly sized zoom-13 views can yield Huntsville 36/36 outside and Eastland three inside without a county or coordinate defect. The Huntsville production extent is approximately latitude `30.51053..30.87527`, longitude `-95.51097..-95.38357`; its inventory lies predominantly east of the PLACE presentation point. The canonical Huntsville coordinate is internally consistent with LP201 and the awareness anchor, and LP220 does not declare it incorrect.

The extended audit now reports canonical identity, anchor and source, LP201 coordinate, actual center/bounds/zoom, source county, inventory extent, nearest distances, actual/eligibility counts, mismatch count, representative and marker counts, plus the first outside sample. That sample includes exact bounds operands and Leaflet container/layer projection. These fields allow an owner replay to determine whether the actual browser center/bounds agree with the canonical target and whether any DOM position disagrees with geographic eligibility.

## Coordinate order

Production GeoJSON stores `[longitude, latitude]`. Normalization assigns `lng = coordinates[0]` and `lat = coordinates[1]`. Leaflet calls use `[crossing.lat, crossing.lng]`, as do bounds containment and projection calls. LP220 fixtures explicitly conserve both orders. No swap was found or repaired.

## Root cause and minimal repair

The exact cause of the reported classification is spatial: the live zoom-13 Huntsville Leaflet bounds contain none of the Walker inventory, whereas Eastland's contain three. The misleading part of the prior contract was audit opacity: `outside_viewport` did not expose which viewport or operands produced the result, and the medium-zoom description mentioned an awareness anchor even though the anchor does not establish eligibility. LP220 minimally repairs that observability gap in `window.gridlyCrossingRenderAudit()`; it does not change valid rendering policy on unproven assumptions.

This is statewide-safe because the audit derives every value from current canonical identity, county inventory, live Leaflet state, and generic coordinate math. There are no Huntsville, Walker, Eastland, or crossing-ID branches. Eastland remains protected because filtering and rendering code are unchanged.

## Deterministic matrix

| Control | Deterministic result |
|---|---|
| Huntsville identity/inventory | `4835528`, `walker-tx`, 36 real features retained |
| Huntsville legitimate in-bounds point | survives county + actual-bounds eligibility; no fabricated point |
| Eastland | 34 retained; in-bounds subset eligible and outside subset filtered |
| Distant crossing | excluded |
| Foreign county near viewport | excluded |
| Coordinate order | GeoJSON `[lng,lat]`; Leaflet `[lat,lng]` |
| Fresh load | result depends only on current inventory/county/bounds |
| Transition | switching county/bounds cannot retain the prior county candidate |

## Regression results

The required checks were executed after implementation; detailed command totals are recorded in the completion report. No unrelated assertion was weakened.

## Explicit deferrals

**Box Canyon and the broader county investigation remain unresolved and outside LP220 scope.** Cienegas Terrace's later positive replay does not classify or resolve them; they require separate owner direction.

Performance warnings (requestAnimationFrame violations, forced reflow, long timers, and slow input/click handlers) remain a separate unresolved family. LP220 performs no performance optimization.

## Acceptance status

Owner browser acceptance is still required. LP220 does not claim Huntsville or Eastland browser acceptance. On replay, the owner should capture `window.gridlyCrossingRenderAudit()` and compare `canonicalPresentationCoordinate`, `actualMapCenter`, `actualMapBounds`, `inActualLeafletBoundsCount`, and `firstOutsideViewportSample` against actual marker DOM geometry before authorizing any camera or policy change.
