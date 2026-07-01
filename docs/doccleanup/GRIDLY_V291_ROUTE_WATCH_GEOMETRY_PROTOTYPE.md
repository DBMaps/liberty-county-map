# Gridly V291 — Route Watch Geometry Prototype

Audit date: 2026-06-13<br>
Branch: `V291-ROUTE-WATCH-GEOMETRY-PROTOTYPE`<br>
Scope: prototype / audit only<br>
Production changes: none

## 1. Executive Summary

V291 evaluated whether retained TxDOT `LineString` geometry can produce better Route Watch relevance than the current midpoint / route-vertex proximity model. The answer is **yes, but not production-ready without a dedicated validation milestone**.

The current Route Watch relevance model is intentionally simple: it checks whether Route Watch is active, obtains the current route polyline, uses nearby hazard reports already computed by route proximity, and then treats an incident as route-relevant when either its crossing id is in the route hazard set or its single incident coordinate is within the Route Watch radius of one of the route polyline vertices. This is practical and stable, but it does not know whether a TxDOT event actually overlaps the user's route segment.

The isolated V290 TxDOT geometry retention prototype already provides the missing primitive: a retained TxDOT geometry record and a prototype-only segment-overlap scorer. V291 adds an audit harness in `scripts/v291-route-watch-geometry-prototype.mjs` that compares the current midpoint / vertex-distance result with retained-geometry overlap scoring. The harness is not imported by the app and does not wire into production Route Watch, alerts, popups, map markers, reporting, Supabase, or awareness systems.

Primary finding: **retained TxDOT geometry materially improves Route Watch relevance confidence** for the focused corridors, especially TX 146, TX 321, and US 90. It reduces ambiguity at shared alignments, intersections, frontage/parallel roads, and sparse route-polyline sections. The recommended next milestone is **V292 — Route Watch Geometry Validation**.

Final recommendation: **B. Geometry-overlap Route Watch is promising but needs validation.**

## 2. Current Route Watch Relevance Baseline

### Midpoint proximity behavior

TxDOT production normalization currently collapses each TxDOT `LineString` to a single midpoint coordinate by selecting the coordinate at `Math.floor(coordinates.length / 2)`. That midpoint becomes the incident latitude/longitude used by downstream incident handling. This means a long construction or closure segment becomes one point for route relevance purposes.

### Route vertex distance behavior

Route Watch route relevance uses route polyline vertices, not segment-to-segment overlap. `isIncidentRouteRelevant()` returns false unless Route Watch is active and the route polyline has at least two points. It then checks the incident crossing id against nearby route reports and, if that does not match, computes the minimum distance from the incident latitude/longitude to each route polyline vertex. The incident is relevant when that minimum vertex distance is within `0.8` miles.

`doesGridlyIncidentImpactActiveRoute()` uses the same general pattern with a tighter `0.6` mile threshold for active-route impact checks: crossing id match first, then incident coordinate to route vertex distance.

### Road-name matching

Production TxDOT records retain road identity fields such as `roadName`, `routeName`, `routeNameRaw`, and `routeNameDisplay`. The TxDOT service formats TxDOT route codes like `SH0146` into display names like `TX 146`, and local TxDOT filtering can match configured corridor strings against the route display name, title, and limit text. Road-name matching is useful for local relevance, but it is still text evidence rather than route-overlap evidence.

### Corridor matching

TxDOT local-focus logic combines county filtering with a text corridor list. The default local corridor set is `US 90`, `TX 146`, `TX 321`, `FM 1960`, `FM 1409`, and `FM 1008`. V291's requested corridor list adds `US 59 / I-69` and `FM 1011`, and the audit harness evaluates local route-geometry availability for those corridors from `data/liberty-county-road-segments.geojson`.

### Known limitations

- A single TxDOT midpoint can falsely mark a nearby but non-overlapping parallel road, ramp, frontage road, or intersection event as relevant.
- A single TxDOT midpoint can miss a long event that overlaps the watched route while the selected midpoint sits away from the user's route slice.
- Route-vertex distance can miss true overlap when a route polyline is sparse and the incident midpoint is far from all route vertices even though it lies on the route segment.
- Text corridor matches cannot distinguish true route impact from nearby route mentions, shared alignments, or limits that name a cross street.
- Current production relevance does not compute overlap distance, overlap percentage, or geometry-derived confidence.
- Current production relevance does not retain TxDOT geometry on normalized incidents, so the overlap signal is unavailable after normalization.

## 3. Geometry Overlap Prototype Results

### Prototype method

V291 uses the isolated V290 prototype scorer, which compares retained TxDOT event coordinates with candidate route geometry at a default 60-meter corridor tolerance. The scorer returns overlap distance, overlap percentage, corridor confidence, route-name confidence, geometry confidence, and combined confidence. V291's harness compares that score against a private reimplementation of current midpoint / route-vertex behavior and prints JSON only.

### Sample comparison results

| Sample | Corridor | Current midpoint result | Geometry overlap result | Confidence difference | Ambiguity reduced? | Product meaning |
| --- | --- | --- | --- | ---: | --- | --- |
| `tx146-true-overlap` | TX 146 | Relevant; midpoint vertex distance `0.000 mi` | Relevant; overlap `100.0%`, confidence `0.963` | `+0.412` | Yes | Both models flag relevance, but overlap explains that the event line shares the watched corridor. |
| `tx146-nearby-parallel` | TX 146 / nearby US 90-style control | Relevant; midpoint vertex distance `0.098 mi` | Not relevant; overlap `1.0%`, confidence `0.347` | `-0.203` | Yes | Midpoint proximity over-alerts because the line is near the route but does not materially overlap it. |
| `tx321-true-overlap` | TX 321 | Relevant; midpoint vertex distance `0.000 mi` | Relevant; overlap `100.0%`, confidence `0.963` | `+0.412` | Yes | Overlap confirms true TX 321 impact rather than nearby local-street context. |
| `us90-true-overlap` | US 90 | Relevant; midpoint vertex distance `0.000 mi` | Relevant; overlap `100.0%`, confidence `0.963` | `+0.412` | Yes | Overlap confirms shared-corridor relevance and can separate true shared alignment from nearby-only incidents. |
| `sparse-route-midpoint-miss` | Sparse route control | Not relevant; midpoint vertex distance `2.280 mi` | Relevant; overlap `100.0%`, confidence `0.963` | `+0.762` | Yes | Route-vertex distance can miss a true route overlap when route vertices are sparse. |

### Prototype conclusion

Geometry overlap provides better evidence than midpoint-only matching because it can say whether the retained TxDOT event line actually shares the watched route corridor. The largest improvement is not simply more true positives; it is **better confidence and lower ambiguity**.

## 4. Corridor Validation Results

The V291 harness measured local route-geometry availability from `data/liberty-county-road-segments.geojson` for the requested corridors. This does not prove live TxDOT event availability on every corridor at all times; it confirms that Gridly has local route geometry suitable for an offline validation harness.

| Corridor | Local route geometry availability | TxDOT geometry availability | Overlap scoring usefulness | Ambiguity reduction | False-positive reduction potential |
| --- | ---: | --- | --- | --- | --- |
| TX 146 | 87 local LineString features, about 71.16 geometry miles | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | Very high | Very high | Very high near US 90 shared segments, intersections, and frontage/parallel roads |
| TX 321 | 40 local LineString features, about 27.09 geometry miles | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | High | High | High near TX 105 / TX 321 overlap and local streets |
| US 90 | 127 local LineString features, about 53.28 geometry miles | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | Very high | High | Very high at US 90 / TX 146 shared alignment and connector segments |
| US 59 / I-69 | 82 local LineString features, about 35.31 geometry miles under US 59/I-69 aliases | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | High | Moderate to high | High for highway frontage, ramps, and alias confusion |
| FM 1960 | 5 local LineString features, about 12.30 geometry miles | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | Moderate | Moderate | Moderate; less local feature density means validation should be careful |
| FM 1409 | 9 local LineString features, about 13.47 geometry miles | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | Moderate to high | Moderate | Moderate to high for rural intersections and long work zones |
| FM 1011 | 8 local LineString features, about 7.34 geometry miles | Available when DriveTexas returns LineString features; production normalizes to midpoint today, V290 can retain lines | Moderate | Moderate | Moderate; useful, but smaller corridor sample |

## 5. Route Watch Value Test

Scores: `0 = no improvement`, `5 = transformational improvement`.

| Value dimension | Score | Rationale |
| --- | ---: | --- |
| Route relevance | 4 | Overlap directly tests whether an event shares the watched route corridor instead of relying on one point near route vertices. |
| Route confidence | 5 | Overlap percentage, overlap distance, geometry quality, and route-name agreement create a stronger confidence basis than midpoint proximity. |
| Route impact | 4 | Direct overlap helps separate true route impact from nearby awareness; production planning still needs thresholds by severity and event type. |
| Delay awareness | 3 | More precise relevance improves delay messaging, but delay magnitude still depends on TxDOT delay fields, historical traffic, or future WZDx-style data. |
| Construction awareness | 5 | Long construction/work-zone lines are exactly where midpoint collapse is weakest and retained geometry is strongest. |
| Commuter usefulness | 4 | Users benefit when Route Watch distinguishes “on my route” from “near my route,” especially on recurring corridors. |

Overall value score: **4.2 / 5**. Geometry overlap is a high-value Route Watch planning input.

## 6. False Positive / False Negative Analysis

### A. Midpoint says relevant, overlap says weak/no overlap

Product meaning: likely midpoint false positive or low-confidence nearby context. This can happen near intersections, frontage roads, parallel routes, ramps, or shared route labels. Route Watch should eventually avoid escalating these as direct route impacts unless another signal confirms relevance.

### B. Midpoint says not relevant, overlap says strong overlap

Product meaning: likely midpoint / vertex-distance false negative. This can happen when route vertices are sparse, when a long TxDOT event overlaps only part of the watched route, or when the selected TxDOT midpoint sits outside the user's active route slice. This is a high-value case because users may otherwise miss route-impacting construction or closures.

### C. Both agree relevant

Product meaning: strongest production candidate. Midpoint proximity and geometry overlap agree, and overlap adds a measurable confidence explanation. These cases should become the first validation set in V292.

### D. Both agree not relevant

Product meaning: likely nearby awareness only, not a Route Watch impact. These cases are useful as negative controls for threshold tuning and regression checks.

## 7. TX 146 Special Review

Geometry-overlap scoring would improve TX 146 Route Watch reliability.

TX 146 has strong local route geometry availability and known ambiguity because it appears both as standalone TX 146 and in US 90 / TX 146 shared-alignment context. The midpoint model can tell that a point is near TX 146, but it cannot reliably distinguish whether the retained event line follows TX 146, follows US 90 near TX 146, crosses TX 146 at an intersection, or runs along a frontage/connector segment.

Overlap scoring helps distinguish:

- **True TX 146 impact:** strong line overlap with TX 146 route geometry should increase route confidence.
- **Nearby US 90 impact:** weak/no TX 146 overlap but strong US 90 geometry should reduce TX 146 direct-impact confidence.
- **Shared US 90 / TX 146 overlap:** overlap with both corridor geometries can identify shared-alignment ambiguity instead of forcing a text-only route choice.
- **Frontage/intersection ambiguity:** short or weak overlap can keep the event in nearby-awareness territory rather than direct Route Watch impact.

TX 146 conclusion: **yes — geometry overlap should materially improve TX 146 reliability**, especially for ambiguity reduction and false-positive control.

## 8. TX 321 Special Review

Geometry-overlap scoring would improve TX 321 Route Watch reliability.

TX 321 has enough local geometry for validation and is a strong test for overlap against TX 105 / TX 321 and local-street ambiguity. Current midpoint relevance can treat a nearby point as route-relevant even when the line follows a cross street, local frontage/connector, or shared segment that should be classified separately.

Overlap scoring helps distinguish:

- **True TX 321 impact:** event line overlap with TX 321 route geometry confirms direct relevance.
- **Nearby TX 105 impact:** weak/no TX 321 overlap should prevent over-escalating TX 105-only context into TX 321 Route Watch.
- **TX 105 / TX 321 overlap:** overlapping geometry can preserve shared-alignment ambiguity for validation rather than pretending route-name text is enough.
- **Local street ambiguity:** short/no overlap helps keep local street events out of direct TX 321 Route Watch impact unless the user's route actually uses that street.

TX 321 conclusion: **yes — geometry overlap should improve TX 321 reliability**, with the most value in separating true route impact from TX 105 and local street context.

## 9. Production Readiness Assessment

Assessment choice: **B. Useful but needs more validation**.

| Factor | Assessment |
| --- | --- |
| Reliability | Promising. The prototype produces clear wins in controlled samples, but live TxDOT event variety and route geometry edge cases need validation. |
| Complexity | Moderate. The core scorer is small, but production integration would need data retention, thresholds, caching, diagnostics, and fallback behavior. |
| Performance | Likely manageable if scoped to active route plus local TxDOT candidates, but line-to-line checks should be bounded and cached before production. |
| Maintainability | Good if kept as a dedicated geometry module with test fixtures; risky if mixed into current Route Watch rendering or alert logic too early. |
| Data availability | Local route geometry is available for all focus corridors. Live TxDOT geometry is available when the DriveTexas GeoJSON feed returns `LineString` features, but production currently collapses it to midpoint. |
| User value | High. The biggest user-facing value is fewer false “near your route” escalations and stronger confidence for construction/closure relevance. |

Not ready for production implementation yet because V291 did not validate against a large live TxDOT corpus, did not tune production thresholds, did not define fallback precedence, and did not measure runtime cost under real Route Watch sessions.

## 10. Recommended Next Milestone

Recommended milestone: **V292 — Route Watch Geometry Validation**.

V292 should remain non-UI and validation-first. It should:

1. Retain a private fixture set of live or captured TxDOT LineString events for TX 146, TX 321, US 90, US 59/I-69, FM 1960, FM 1409, and FM 1011.
2. Compare midpoint relevance, route-vertex relevance, text corridor relevance, and segment-overlap relevance across positive and negative samples.
3. Define overlap thresholds by event type, corridor, length, and route-name agreement.
4. Measure runtime cost with active-route-only candidate filtering.
5. Produce a production integration plan only after validation passes.

Directional validation, WZDx construction integration, and UI display changes should wait until geometry relevance thresholds are validated.

## 11. Final Recommendation

Final choice: **B. Geometry-overlap Route Watch is promising but needs validation.**

Geometry-overlap Route Watch should be prioritized for validation planning, not immediate production behavior. The retained TxDOT geometry signal is materially better than midpoint-only matching for relevance confidence, ambiguity reduction, false-positive reduction, and construction awareness. However, production Route Watch, alerts, hazard popups, map markers, reporting, Supabase, awareness systems, and UI should remain unchanged until a V292 validation milestone proves thresholds and performance on a broader dataset.
