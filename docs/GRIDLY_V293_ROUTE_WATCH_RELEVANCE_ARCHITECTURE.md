# Gridly V293 — Route Watch Relevance Architecture

Audit date: 2026-06-13<br>
Branch: `V293-ROUTE-WATCH-RELEVANCE-ARCHITECTURE`<br>
Scope: architecture / planning only<br>
Production changes: none

## 1. Executive Summary

V293 defines the safe architecture for future Route Watch relevance improvements after V290 proved TxDOT geometry retention has product value, V291 proved geometry-overlap relevance in controlled prototype scenarios, and V292 validated geometry overlap across realistic Liberty County corridor scenarios.

The recommended future architecture is a **layered, optional relevance model**. The current midpoint / route-vertex relevance path remains the default and must stay available as the safe fallback. Geometry overlap becomes an isolated supplemental signal only after private debug validation, fixture coverage, shadow scoring, and guarded rollout milestones. Road/corridor text agreement should support confidence, but it must not replace geometry or crossing-id evidence.

V293 does **not** wire geometry overlap into production Route Watch. It does not change Route Watch behavior, alerts, hazard popups, map markers, reporting, Supabase, awareness systems, directional display, directional labels, or UI.

Final recommendation: **A. Architecture is ready for shadow scoring.** The next milestone should be **V294 — Route Watch Geometry Fixture Suite** so future integration has explicit true-overlap, partial-overlap, nearby-no-overlap, crossing, shared-alignment, sparse-route, invalid-geometry, and missing-geometry coverage before any production behavior changes.

## 2. Current Relevance Architecture

### Current production relevance path

Route Watch relevance is currently point/proximity based. The active route is read from the route preview layer first and the saved Route Watch route layer second. If neither source provides at least two valid latitude/longitude vertices, route relevance exits as unavailable.

The current model has two related relevance entry points:

1. `isIncidentRouteRelevant(incident, routeHazard)` for incident ranking and route-aware presentation.
2. `doesGridlyIncidentImpactActiveRoute(incident)` for marker visual-state route-impact checks.

Both use crossing identity first and route-coordinate proximity second. Neither performs event-line-to-route-line overlap.

### Active route requirements

A route can only be considered for relevance when Route Watch is active. `isIncidentRouteRelevant()` returns `false` immediately when `routeWatchActivated` is false. It then requires `getRoutePolylineLatLngs()` to return at least two route points.

`getRoutePolylineLatLngs()` resolves the active geometry from `window.__gridlyRoutePreviewLayer?.getLatLngs?.()` first, then from the first saved route layer that exposes `getLatLngs()`. The helper normalizes each point into numeric `{ lat, lng }` pairs and filters invalid coordinates.

### Crossing id matching

Crossing id is the strongest current non-geometry signal. The current route hazard assessment returns `nearbyReports`; `isIncidentRouteRelevant()` builds a set of those `crossingId` values and returns `true` when the incident crossing id is present.

`doesGridlyIncidentImpactActiveRoute()` follows the same pattern. It obtains the current route hazard assessment, builds a set of `nearbyReports` crossing ids, and returns `true` when the incident crossing id matches.

### Midpoint proximity and route vertex distance

For incidents with coordinates and no crossing-id confirmation, current Route Watch relevance computes distance from the incident coordinate to route vertices. In `isIncidentRouteRelevant()`, relevance is confirmed when the minimum incident-to-route-vertex distance is at or under `0.8` miles.

`doesGridlyIncidentImpactActiveRoute()` uses the same route-vertex style check with a tighter `0.6` mile threshold.

`buildRouteHazardAssessment()` also uses `0.8` miles as its route hazard threshold. It dedupes candidate active reports and hazards, resolves each candidate to an anchor coordinate using the report coordinate or crossing coordinate, computes the minimum distance to route vertices, and excludes candidates beyond the threshold.

### Road-name / corridor matching

Road-name and corridor signals exist elsewhere in the app, but they are not a substitute for Route Watch overlap. Current local corridor identity is represented by aliases for corridors such as `US 90`, `TX 146`, `TX 321`, `FM 1409`, and `FM 1008`. TxDOT normalization and local filtering retain route/corridor text fields, and V291/V292 used road/corridor text as validation context.

In the current Route Watch relevance path, road-name/corridor text is supporting metadata and presentation context; it is not a direct line-overlap relevance calculation.

### Current fallback behavior

Current fallback behavior is intentionally conservative:

- If Route Watch is inactive, route relevance is false.
- If route geometry has fewer than two valid points, route relevance is false.
- If incident coordinates are invalid and crossing id does not match, route relevance is false.
- If an exception occurs in `doesGridlyIncidentImpactActiveRoute()`, the helper records a safe fallback count and returns false.
- If route hazard assessment cannot identify nearby route reports, proximity still provides a route-vertex fallback when incident coordinates exist.

## 3. Future Relevance Architecture

The future model should be layered and explainable. Each layer produces a structured signal, and a final reducer turns those signals into a confidence band and route-impact decision. The reducer must preserve the current midpoint / route-vertex model as fallback.

### Layer 1: Existing midpoint relevance

Layer 1 is the current behavior. It remains the baseline contract and fallback path:

- Active Route Watch required.
- Active route geometry must contain at least two valid points.
- Crossing id matching remains a direct confirmation path.
- Incident coordinate to route vertex proximity remains available at current thresholds.
- Existing scoring, sorting, marker, alert, popup, reporting, and awareness behavior remains unchanged until a later guarded milestone explicitly changes it.

Layer 1 should be callable independently so future geometry scoring can be disabled without losing current Route Watch behavior.

### Layer 2: Geometry-overlap relevance

Layer 2 is a future optional signal that compares retained event geometry with active route geometry. It should be isolated behind a feature guard or shadow-scoring path at first.

Layer 2 should produce:

- `geometryAvailable`: whether retained event geometry and active route geometry are usable.
- `geometryValid`: whether both geometries have valid line-like coordinate arrays.
- `bboxCandidate`: whether event and route expanded bounding boxes intersect.
- `overlapDistanceMeters`: estimated shared alignment distance.
- `overlapPercentage`: percentage of event geometry that shares the route corridor.
- `overlapToleranceMeters`: scoring corridor tolerance used for the comparison.
- `overlapStrength`: `strong`, `partial`, `weak`, or `none`.
- `overlapAmbiguityReason`: reason when the result cannot be used as direct route impact evidence.

Layer 2 must not mutate incident objects used by alerts, popups, markers, reporting, Supabase, or awareness systems during shadow phases.

### Layer 3: Road/corridor text agreement

Layer 3 evaluates whether event road/corridor text agrees with the watched route identity and geometry result. It should normalize route aliases such as `SH 146`, `TX 146`, `Highway 146`, and `Hwy 146` before comparison.

Layer 3 should support confidence rather than independently declaring direct route impact. Recommended outputs:

- `textAgreement`: `match`, `alias_match`, `shared_alignment_match`, `conflict`, `missing`, or `unknown`.
- `matchedCorridor`: canonical corridor when one is found.
- `conflictingCorridor`: canonical conflicting corridor when the text conflicts with geometry.
- `textConfidenceAdjustment`: bounded positive, neutral, or negative adjustment for the final confidence reducer.

### Layer 4: Confidence scoring

Layer 4 combines crossing id, midpoint proximity, geometry overlap, text agreement, route geometry quality, and data quality into a confidence band. The confidence score should be explainable and should prefer stable categorical bands over fragile numeric-only behavior.

Recommended reducer inputs:

- Crossing id match.
- Strong, partial, weak, or no geometry overlap.
- Midpoint / route-vertex distance result.
- Text agreement or conflict.
- Route geometry quality and sparsity.
- Event geometry validity and length.
- Ambiguity flags such as shared alignment or conflicting route names.

### Layer 5: Fallback and suppression rules

Layer 5 determines what can be safely claimed:

- Keep current midpoint behavior when geometry is unavailable.
- Use geometry overlap to confirm route impact only when confidence is high or medium and no suppression rule applies.
- Mark ambiguous when signals conflict or shared-alignment context prevents direct ownership.
- Suppress direct route impact when strong evidence says the event is nearby but not on the watched route.
- Never suppress crossing-id direct relevance unless the crossing id itself is known invalid or stale.

Suppression should mean **do not claim direct route impact from the geometry layer**. It should not delete incidents, hide markers, alter alerts, change reporting, or modify awareness systems in V293.

## 4. Signal Priority Model

Future relevance should rank signals by reliability and product meaning.

| Priority | Signal | Confirms relevance when | Reduces relevance when | Marks ambiguous when | Suppresses direct route impact when |
| ---: | --- | --- | --- | --- | --- |
| 1 | Crossing id match | Incident crossing id matches a crossing already identified on/near the active route. | Only if the crossing id is invalid, stale, or mapped to a different known crossing. | Crossing id exists but maps to a crossing near a shared or complex interchange. | Rarely; only with data-quality proof that the crossing id is wrong. |
| 2 | Strong geometry overlap | Event geometry overlaps `50%+` of its length with the active route corridor. | Not applicable unless geometry is invalid. | Shared alignment carries multiple route names and text does not identify the watched route. | Strong overlap with a conflicting route name on a parallel/nearby geometry after bbox and geometry validation. |
| 3 | Partial geometry overlap | Event geometry overlaps `25%–50%` and text or midpoint supports route relevance. | Partial overlap is short and text points to another corridor. | Partial overlap occurs at intersections, ramps, shared alignments, or sparse route geometry. | Partial overlap is only incidental at a crossing/intersection and text conflicts. |
| 4 | Midpoint proximity | Current `0.8` mile route-vertex proximity or current `0.6` mile impact check is satisfied. | Geometry clearly shows no overlap and text points elsewhere. | Midpoint is near the route but geometry is missing, sparse, or conflicting. | Geometry is valid, overlap is under `10%`, and text conflicts with the watched corridor. |
| 5 | Text corridor match | Road/corridor aliases agree with the watched route and no stronger signal conflicts. | Text names a different route, local street, or cross street. | Text names a shared alignment, limit road, or ambiguous local description. | Valid geometry has no overlap and text likely describes only a nearby corridor or limit. |
| 6 | County/local area match | Event is in the active county or local focus area and at least one stronger signal is unavailable. | Event is outside active county/local route bbox. | County match is the only signal. | County/local area is the only signal and no direct route evidence exists. |

Priority rules:

1. Crossing id match remains the highest-confidence current signal.
2. Strong geometry overlap should outrank midpoint proximity because it evaluates shared line alignment rather than a single point.
3. Partial geometry overlap should confirm relevance only with supportive midpoint or text evidence.
4. Midpoint proximity remains useful but can be downgraded by valid no-overlap geometry.
5. Text match can strengthen confidence but should not independently override valid geometry conflict.
6. County/local area is a candidate prefilter, not direct route-impact proof.

## 5. Confidence Bands

V292 concluded that a `25%` minimum overlap plus a confidence floor is the best planning threshold, with `10%–25%` as an ambiguity / low-confidence band and `50%+` as high-confidence route impact evidence.

| Band | Geometry overlap guidance | Typical signal combination | Future route-impact treatment |
| --- | --- | --- | --- |
| High confidence | `50%+` overlap | Strong geometry overlap, crossing id match, or strong overlap plus text agreement. | Can confirm direct route impact in a future guarded production phase. |
| Medium confidence | `25%–50%` overlap | Partial geometry overlap plus midpoint proximity or text agreement. | Can confirm route relevance after fixture validation; should explain partial nature in diagnostics. |
| Low confidence | `10%–25%` overlap | Weak overlap, midpoint proximity, or text-only corridor agreement. | Do not claim direct route impact without another strong signal; keep as candidate/nearby. |
| Ambiguous | Conflicting signals, shared alignment, sparse route geometry, or intersection-only contact | Midpoint says relevant but geometry is weak/no overlap, or geometry overlaps a shared route with unclear text. | Do not suppress the incident, but suppress direct route-impact claims from geometry. |
| Not relevant | Under `10%` overlap with valid geometry, no crossing id match, and no convincing midpoint/text support | Valid event geometry is nearby but does not share the watched route. | Suppress direct route-impact classification in a future guarded phase; fallback behavior remains available if geometry is disabled. |

Additional guidance:

- `50%+` overlap should be treated as strong same-route evidence unless text conflicts with a known shared-alignment route.
- `25%–50%` overlap should be treated as meaningful partial route evidence when the overlap spans more than an incidental intersection touch.
- `10%–25%` overlap should be treated as weak/ambiguous because short shared alignments, ramps, and intersections can inflate apparent relevance.
- Under `10%` overlap should normally be non-relevant when geometry is valid, but only after bbox, route geometry quality, and event geometry validity checks pass.

## 6. Fallback Behavior

The current midpoint model must remain available in every future phase.

| Condition | Future architecture behavior | Safe fallback |
| --- | --- | --- |
| Geometry is missing | Mark `geometryAvailable=false`; skip overlap scoring. | Use current crossing-id and midpoint / route-vertex model. |
| Geometry is invalid | Mark `geometryValid=false`; record invalid reason; skip overlap confirmation. | Use current model and treat geometry as unavailable. |
| Bbox is missing | Compute bbox from valid coordinates when possible; otherwise skip bbox optimization. | Use current model or candidate text/point prefilter only. |
| Route geometry is sparse | Set `routeGeometryQuality=sparse`; avoid strong suppression from no-overlap alone. | Current midpoint model remains available; geometry result can be ambiguous rather than suppressive. |
| Source route name conflicts with geometry | Mark `textAgreement=conflict`; reduce confidence; require stronger geometry or crossing evidence. | Do not claim direct route impact from text alone. |
| Overlap is ambiguous | Produce `confidenceBand=ambiguous` and `suppressionReason`/`ambiguityReason`. | Keep current behavior unchanged until a guarded milestone decides otherwise. |
| Midpoint and overlap disagree | Prefer geometry for confidence only when geometry is valid and route quality is adequate; otherwise mark ambiguous. | Current midpoint behavior remains the runtime fallback until shadow scoring is promoted. |
| Crossing id match but geometry missing/conflicting | Treat crossing id as high-confidence current signal unless the crossing id is known invalid. | Preserve crossing-id relevance. |
| Text match but geometry no-overlap | Treat as nearby/corridor context, not direct route impact. | Do not suppress current production behavior until future guarded rollout. |

The fallback contract is intentionally conservative: geometry can add confidence only when it is available, valid, and tested. It cannot remove the current Route Watch relevance path during planning or shadow phases.

## 7. Performance Architecture

Geometry overlap must be designed so it cannot regress refresh, map interaction, or mobile performance.

### Candidate prefiltering

Before overlap scoring, future code should reduce the candidate set by:

- Active county/local focus area.
- Active Route Watch only.
- Event lifecycle and freshness.
- Event bbox intersecting the expanded route bbox.
- Existing midpoint/corridor/text proximity where geometry bbox is absent.
- Maximum candidate count per refresh.

### Bbox filtering

Every retained event geometry and active route geometry should have a cheap bounding box. Expanded bbox intersection should be required before segment-level overlap scoring. Bbox padding should match the configured overlap tolerance and expected GPS/source uncertainty.

### Active route only

Overlap scoring should run only for the current active Route Watch route. It should not scan every saved place, inactive route, alternate route, awareness area, or county road during production refresh.

### Refresh-time caps

A future scorer should enforce time and count caps, for example:

- Maximum geometry-scored candidates per refresh.
- Maximum event segments sampled per candidate.
- Maximum route segments considered after bbox narrowing.
- Maximum total scoring time before returning fallback/partial diagnostics.

If caps are hit, the scorer should return `fallbackPath=performance_cap` and preserve current midpoint behavior.

### Geometry simplification

Retained event geometry and active route geometry may be simplified for scoring, but simplification must preserve corridor shape enough for overlap. Simplification should be deterministic and should never modify original retained geometry.

### Route geometry caching

The active route should be normalized and cached by route identity, route vertex count, or route generation timestamp. Cached artifacts may include:

- Valid route points.
- Route segments.
- Route bbox.
- Simplified route segments.
- Segment spatial bins or bbox index.

Route cache invalidation should occur when Route Watch starts/stops, route endpoints change, route preview geometry changes, or route layer data changes.

### Off-render-path scoring

Geometry scoring should not run inside marker rendering, popup rendering, alert rendering, map pan/zoom handlers, or reporting flows. It should run after candidate collection and before model reduction, preferably in a batched or idle-time path.

### Mobile performance safety

Mobile guardrails should include:

- Lower candidate caps on constrained devices.
- Early fallback when route/event geometries exceed limits.
- No scoring during animation or map drag.
- Structured debug timing so slow cases can be identified without user telemetry.
- Ability to disable geometry relevance independently of Route Watch.

## 8. Test Fixture Strategy

No production integration should occur until fixture coverage exists. Fixtures should be deterministic, small enough for CI/local runs, and independent of live TxDOT availability.

Required fixture classes:

1. **True overlap** — event line follows the watched route and should be high confidence.
2. **Partial overlap** — event line overlaps only a meaningful portion of the watched route and should be medium confidence.
3. **No overlap but nearby** — event midpoint is near the route while event geometry is on a nearby/parallel road; should reduce or suppress direct route impact in future guarded use.
4. **Intersection crossing** — event touches the watched route only at a crossing/intersection; should be ambiguous unless crossing id or text confirms route impact.
5. **Shared alignment** — event geometry overlaps a segment where multiple route names share pavement; should avoid overclaiming a single route.
6. **Sparse route miss** — event overlaps a route segment whose route vertices are sparse; geometry should recover the true overlap.
7. **Invalid geometry** — malformed or too-short event geometry; should fallback safely.
8. **Missing geometry** — no retained event geometry; should use current midpoint/crossing-id behavior.
9. **TX 146 samples** — include standalone TX 146 and US 90 / TX 146 shared-alignment cases.
10. **TX 321 samples** — include standalone TX 321 and TX 105 / TX 321 shared-alignment or local-street ambiguity cases.
11. **US 90 samples** — include clean US 90, shared US 90 / TX 146 geometry, and nearby-non-overlap cases.

Fixture assertions should cover:

- Midpoint result.
- Overlap percentage.
- Overlap distance.
- Text agreement result.
- Confidence band.
- Ambiguity/suppression reason.
- Fallback path.
- Performance timing envelope.

## 9. Telemetry / Debug Strategy

V293 recommends debug-only diagnostics and no user telemetry requirement.

A future private helper may be added after architecture approval:

```js
window.gridlyRouteWatchRelevanceArchitectureAudit?.()
```

The helper should be debug-only, local, and non-mutating. It should report architecture outputs without changing Route Watch behavior.

Recommended report fields:

- `version`: architecture/debug helper version.
- `routeWatchActive`: active Route Watch state.
- `routePointCount`: active route geometry count.
- `candidateCount`: candidates considered after prefiltering.
- `midpointResult`: current crossing/proximity result, distance, threshold, and fallback status.
- `overlapResult`: geometry availability, validity, bbox result, overlap distance, overlap percentage, tolerance, and overlap strength.
- `textResult`: canonical route/corridor match, alias match, conflict, or missing text.
- `confidenceBand`: high, medium, low, ambiguous, or not relevant.
- `suppressionReason`: reason direct route impact would be suppressed in future guarded use.
- `ambiguityReason`: shared alignment, intersection-only touch, sparse route, text conflict, or missing data.
- `fallbackPath`: current model, geometry unavailable, geometry invalid, performance cap, or disabled guard.
- `performanceTiming`: prefilter, bbox, overlap, text, reducer, and total milliseconds.
- `safeNoMutation`: explicit confirmation that alerts, popups, markers, reporting, Supabase, awareness, and UI were not modified.

Debug output should be console/object based and should not transmit user telemetry.

## 10. Integration Sequence

### Phase 1: Documentation and architecture

V293. Complete this plan. No runtime behavior changes.

### Phase 2: Private debug helper

Add a non-mutating helper that computes or summarizes architecture signals without affecting Route Watch, alerts, popups, markers, reporting, Supabase, awareness, or UI.

### Phase 3: Fixture validation

Build the required fixture suite and assert confidence bands, fallback behavior, and performance envelopes. This should precede any production wiring.

### Phase 4: Shadow scoring beside current model

Compute geometry/text/confidence signals beside the current model, but keep the current model as the only production decision source. Compare disagreements in debug output only.

### Phase 5: Limited production use behind guard

Allow geometry to influence route relevance only behind a kill-switchable guard, with current midpoint fallback and suppression rules. Start with high-confidence confirmations only.

### Phase 6: Route Watch confidence update

After shadow and guarded validation, update Route Watch confidence semantics. UI/display changes, if any, must be a separate milestone and must not add directional display or NB/SB/EB/WB labels unless a later directional milestone explicitly approves that work.

## 11. Risk Assessment

| Risk | Description | Mitigation |
| --- | --- | --- |
| False positives | Geometry may overstate route impact for nearby lines, ramps, intersections, or shared alignments. | Require bbox + overlap threshold + text/crossing review; mark ambiguous below strong thresholds. |
| False negatives | Sparse route geometry, clipped TxDOT extents, or simplified geometry could miss real route impacts. | Preserve midpoint fallback; avoid suppressing when route geometry quality is sparse. |
| Performance regression | Segment-level scoring can be expensive if run for too many candidates or on render path. | Candidate caps, bbox filtering, route caching, simplification, and off-render scoring. |
| Data quality | Retained TxDOT geometry may be missing, malformed, stale, or generalized. | Validate geometry, record fallback path, and never require geometry for current behavior. |
| Geometry mismatch | Local route geometry and TxDOT event geometry may represent different centerlines or extents. | Use tolerance corridors, confidence bands, and ambiguity states. |
| Route alias conflict | `SH`, `TX`, `US`, local street names, and shared alignments can conflict. | Canonical alias normalization and text conflict handling. |
| User trust | Overclaiming “on your route” can cause users to distrust Route Watch. | Suppress direct route-impact claims when signals are ambiguous; keep current behavior until guarded rollout. |
| Overclaiming route impact | Text-only or county-only matches may be mistaken for direct route impact. | Treat text/county as supporting or prefilter signals, not direct proof. |
| Regression outside Route Watch | Alerts, popups, markers, reporting, Supabase, or awareness could accidentally change. | Keep scorer isolated and non-mutating through debug/shadow phases; add no UI changes in V293. |

## 12. TX 146 / TX 321 Architecture Notes

### TX 146

TX 146 requires explicit shared-alignment handling because parts of the corridor can overlap or be referenced with US 90. Future architecture should distinguish:

- **Standalone TX 146 geometry**: high confidence when event geometry overlaps the active TX 146 route and text agrees with TX 146 aliases.
- **Shared US 90 / TX 146 geometry**: high geometry confidence but potential route-name ambiguity. Text agreement should determine whether the event can be called a TX 146 direct impact, US 90 direct impact, or shared-corridor impact.
- **Route overlap ambiguity**: if geometry overlaps shared pavement but text names only US 90 while the watched route is TX 146, the confidence reducer should mark `shared_alignment_match` or `ambiguous` rather than overclaiming a TX 146-only impact.
- **Future confidence handling**: strong overlap on shared pavement can confirm corridor relevance, but direct route impact should require either watched-route text agreement, crossing id match, or route configuration that explicitly traverses the shared segment.

### TX 321

TX 321 requires explicit handling for TX 105 / TX 321 overlap and local-street ambiguity. Future architecture should distinguish:

- **Standalone TX 321 geometry**: high confidence when overlap and text agree.
- **TX 105 / TX 321 overlap**: strong geometry overlap may be real, but route ownership can be ambiguous if text names only TX 105 or local limit roads.
- **Local street ambiguity**: construction limits or incident descriptions may name a local street near TX 321 without indicating same-pavement route impact. Text-only local references should not override valid no-overlap geometry.
- **Future confidence handling**: partial overlap plus TX 321 text can be medium confidence; shared alignment or local-street-only text should mark ambiguous unless crossing id, strong overlap, or additional route context confirms direct relevance.

## 13. Recommended Next Milestone

Recommended: **V294 — Route Watch Geometry Fixture Suite**.

Why this should be next:

- V293 is architecture only.
- Fixture validation is the safest bridge between architecture and any debug/shadow implementation.
- Fixtures provide regression protection for confidence bands, fallback rules, TX 146 shared-alignment cases, TX 321 ambiguity cases, and performance caps.
- A fixture suite reduces the risk of accidentally changing Route Watch production behavior during future milestones.

Alternative future milestones after V294:

- **Route Watch Relevance Shadow Scoring** — compute geometry signals beside the current model after fixture coverage exists.
- **Route Watch Geometry Integration Plan** — define guarded production rollout criteria after shadow-scoring evidence.
- **WZDx Construction Intelligence Prototype** — separate construction-intelligence exploration, not a Route Watch relevance wiring milestone.

## 14. Final Recommendation

**A. Architecture is ready for shadow scoring.**

The architecture should proceed only through the phased sequence above. The midpoint / route-vertex model remains the production fallback. Geometry overlap should become an isolated optional signal after fixture validation and shadow scoring, not a direct production Route Watch behavior change in V293.
