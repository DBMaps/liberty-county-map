# Gridly V292 — Route Watch Geometry Validation

Validation date: 2026-06-13<br>
Branch: `V292-ROUTE-WATCH-GEOMETRY-VALIDATION`<br>
Scope: validation only<br>
Production changes: none

## 1. Executive Summary

V292 validates whether retained TxDOT geometry overlap is trustworthy enough to justify future Route Watch production planning. The answer is **yes for production planning, not direct production wiring**.

This milestone adds a validation-only harness at `scripts/v292-route-watch-geometry-validation.mjs`. The harness imports the V290 retained-geometry prototype scorer, reads local route geometry from `data/liberty-county-road-segments.geojson`, builds controlled validation samples for seven requested corridors, and compares current midpoint / route-vertex relevance against prototype geometry-overlap relevance. The harness is not imported by the app and does not change Route Watch behavior, alerts, hazard popups, map markers, reporting, Supabase, awareness systems, directional display, or UI.

Primary validation result: geometry-overlap relevance consistently provides better explanatory confidence and catches both classes of midpoint weakness:

- **False positives**: midpoint says relevant for nearby parallel/frontage-style or near-corridor geometry, while overlap correctly rejects non-overlap.
- **False negatives**: midpoint misses true impact when route vertices are sparse and the retained event overlaps the route between vertices, while overlap correctly recognizes the shared segment.

Across 42 validation samples, the default 25% overlap / 0.55 confidence model produced:

| Result class | Count | Percentage |
| --- | ---: | ---: |
| A. Both correct | 14 | 33.3% |
| B. Midpoint false positive | 14 | 33.3% |
| C. Midpoint false negative | 7 | 16.7% |
| D. Geometry ambiguity | 7 | 16.7% |

The 25% overlap threshold balanced relevance and caution best in this dataset: it preserved all judged true positives, introduced no judged false positives, and kept ambiguous short-overlap cases visible for confidence handling rather than silently treating them as fully reliable.

Final recommendation: **A. Geometry-overlap relevance is validated and ready for production planning.**

## 2. Validation Dataset Description

The dataset was intentionally validation-only. It uses retained-geometry-style TxDOT `LineString` samples, local Route Watch route geometry samples, corridor samples, overlap examples, and nearby-but-not-overlapping examples. The validation script constructs samples in memory and prints JSON; it does not write production state or app configuration.

### Source geometry

The route source is `data/liberty-county-road-segments.geojson`. The validation harness searches route-feature properties for corridor aliases, chooses the longest matching local feature as the route geometry sample, and derives retained-event samples from that route geometry.

| Corridor | Local route features | Approx. geometry miles |
| --- | ---: | ---: |
| TX 146 | 87 | 71.16 |
| TX 321 | 40 | 27.09 |
| US 90 | 127 | 53.28 |
| US 59 / I-69 | 82 | 35.31 |
| FM 1960 | 5 | 12.30 |
| FM 1409 | 9 | 13.47 |
| FM 1011 | 8 | 7.34 |

### Sample families

Each corridor has six validation samples:

1. **Retained geometry overlap** — event geometry follows the watched corridor.
2. **Partial corridor overlap** — event geometry partially follows the watched corridor, then leaves it.
3. **Nearby parallel not overlap** — event geometry is close enough for midpoint relevance but offset from the route corridor.
4. **Nearby intersection not overlap** — cross-street geometry places the midpoint on the route but does not follow the route corridor.
5. **Sparse route missed overlap** — sparse route geometry creates a midpoint false negative even though retained geometry overlaps the route segment.
6. **Threshold ambiguity** — a short shared alignment or limit-style overlap is intentionally sensitive to overlap-threshold selection.

This produces **42 total samples**: 7 corridors × 6 sample families.

## 3. Midpoint vs Overlap Results

The validation compares:

- **Current model**: event midpoint to route vertices, with the current Route Watch-style 0.8-mile relevance radius.
- **Prototype model**: retained event geometry to candidate route geometry, with a 60-meter route-corridor tolerance, 25% minimum overlap, and 0.55 confidence threshold.

Summary:

| Metric | Value |
| --- | ---: |
| Total samples | 42 |
| Midpoint / overlap agreement | 18 samples (42.9%) |
| Midpoint / overlap disagreement | 24 samples (57.1%) |
| Average overlap confidence advantage | +0.030 |
| Midpoint false-positive reduction candidates | 14 samples (33.3%) |
| Missed Route Watch impact candidates | 7 samples (16.7%) |

Interpretation: disagreement is not a weakness here; the disagreements are exactly where geometry overlap adds value. Midpoint and overlap agree on clean same-route cases, but overlap separates near-corridor non-overlap from actual shared-route geometry and recovers sparse-route misses.

## 4. False Positive Analysis

False-positive pattern: **midpoint relevant, overlap not relevant**.

Count: **14 of 42 samples (33.3%)**.

Observed causes:

- Nearby parallel or frontage-style geometry close to a watched corridor.
- Midpoint proximity to route vertices despite no retained segment overlap.
- Near-corridor relationship that text matching or midpoint distance alone cannot disambiguate.
- Route/corridor relationship: nearby alignment, not shared alignment.

Corridor examples:

| Corridor | Midpoint distance | Overlap percentage | Overlap confidence | Finding |
| --- | ---: | ---: | ---: | --- |
| TX 146 parallel | 0.098 mi | 0.000 | 0.338 | Midpoint would over-alert; geometry rejects non-overlap. |
| TX 146 intersection | 0.000 mi | 0.000 | 0.338 | Midpoint sits on the route, but retained geometry crosses instead of following it. |
| TX 321 parallel | 0.109 mi | 0.000 | 0.338 | Same false-positive pattern. |
| TX 321 intersection | 0.000 mi | 0.000 | 0.338 | Cross-street proximity is rejected by overlap. |
| US 90 parallel | 0.276 mi | 0.000 | 0.338 | Near-corridor point proximity is insufficient. |
| US 90 intersection | 0.000 mi | 0.000 | 0.338 | Cross-street proximity is rejected by overlap. |
| US 59 / I-69 parallel | 0.276 mi | 0.000 | 0.338 | Parallel/nearby alignment is filtered by overlap. |
| US 59 / I-69 intersection | 0.000 mi | 0.000 | 0.338 | Cross-street proximity is rejected by overlap. |
| FM 1960 parallel | 0.276 mi | 0.000 | 0.338 | Midpoint relevance is too permissive. |
| FM 1960 intersection | 0.000 mi | 0.000 | 0.338 | Cross-street proximity is rejected by overlap. |
| FM 1409 parallel | 0.142 mi | 0.091 | 0.405 | Tiny incidental proximity stays below relevance. |
| FM 1409 intersection | 0.000 mi | 0.000 | 0.338 | Cross-street proximity is rejected by overlap. |
| FM 1011 parallel | 0.085 mi | 0.127 | 0.438 | Close but low-overlap geometry remains not relevant. |
| FM 1011 intersection | 0.000 mi | 0.000 | 0.338 | Cross-street proximity is rejected by overlap. |

False-positive reduction potential is therefore **material**. Geometry overlap should reduce Route Watch over-alerting for frontage roads, parallel roads, nearby intersections, and nearby-but-not-shared alignments.

## 5. False Negative Analysis

False-negative pattern: **midpoint not relevant, overlap relevant**.

Count: **7 of 42 samples (16.7%)**.

Observed causes:

- Sparse route polyline has endpoints/vertices far from the retained event midpoint.
- Retained event geometry overlaps the route segment between vertices.
- Midpoint-to-vertex distance does not evaluate segment overlap.
- Route/corridor relationship: same corridor, same segment, missed by vertex-only distance.

Corridor examples:

| Corridor | Midpoint distance | Overlap percentage | Overlap confidence | Finding |
| --- | ---: | ---: | ---: | --- |
| TX 146 | 8.006 mi | 1.000 | 0.963 | Midpoint misses a true shared segment. |
| TX 321 | 7.893 mi | 1.000 | 0.963 | Sparse route vertices create a route-impact miss. |
| US 90 | 2.801 mi | 1.000 | 0.963 | Overlap recovers a missed same-route impact. |
| US 59 / I-69 | 2.619 mi | 1.000 | 0.963 | Overlap detects impact between sparse vertices. |
| FM 1960 | 2.728 mi | 1.000 | 0.963 | Same sparse-route false-negative behavior. |
| FM 1409 | 2.628 mi | 1.000 | 0.963 | Same sparse-route false-negative behavior. |
| FM 1011 | 2.399 mi | 1.000 | 0.963 | Same sparse-route false-negative behavior. |

Missed Route Watch impact potential is **meaningful** because a user watching a route should care about an event that overlaps their route segment even when a single selected midpoint is far from route vertices.

## 6. TX 146 Validation Findings

TX 146 is the primary validation corridor and strongly supports geometry-overlap planning.

| Sample | Midpoint | Overlap | Class | Confidence difference |
| --- | --- | --- | --- | ---: |
| retained geometry overlap | relevant | relevant, 100.0% overlap | A | +0.162 |
| partial corridor overlap | relevant | relevant, 85.8% overlap | A | +0.153 |
| nearby parallel not overlap | relevant | not relevant, 0.0% overlap | B | -0.407 |
| nearby intersection not overlap | relevant | not relevant, 0.0% overlap | B | -0.463 |
| sparse route missed overlap | not relevant | relevant, 100.0% overlap | C | +0.912 |
| threshold ambiguity | relevant | relevant, 63.3% overlap | D | +0.014 |

Answers:

1. **Does overlap reduce ambiguity?** Yes. It distinguishes same-route TX 146 geometry from nearby parallel geometry.
2. **Does overlap improve confidence?** Yes for same-route and sparse-route cases; false-positive cases intentionally lower confidence.
3. **Does overlap improve route relevance?** Yes. It expresses route relevance as shared corridor distance instead of point proximity.
4. **Does overlap reduce false positives?** Yes. The nearby parallel sample is rejected.
5. **Does overlap reduce false negatives?** Yes. The sparse-route missed-overlap sample is recovered.

## 7. TX 321 Validation Findings

TX 321 mirrors the TX 146 pattern.

| Sample | Midpoint | Overlap | Class | Confidence difference |
| --- | --- | --- | --- | ---: |
| retained geometry overlap | relevant | relevant, 100.0% overlap | A | +0.162 |
| partial corridor overlap | relevant | relevant, 83.2% overlap | A | +0.139 |
| nearby parallel not overlap | relevant | not relevant, 0.0% overlap | B | -0.401 |
| nearby intersection not overlap | relevant | not relevant, 0.0% overlap | B | -0.463 |
| sparse route missed overlap | not relevant | relevant, 100.0% overlap | C | +0.912 |
| threshold ambiguity | relevant | relevant, 60.9% overlap | D | +0.004 |

Findings:

- Overlap adds high-confidence confirmation for actual TX 321 route impacts.
- It reduces false positives where a nearby line is close to route vertices but does not overlap the route.
- It recovers sparse-route false negatives.
- Ambiguity remains in short shared-alignment cases, which should be handled with confidence and threshold policy rather than automatic production behavior.

## 8. US 90 Validation Findings

US 90 also validates the overlap direction, with one threshold-sensitive sample falling below the default 25% overlap threshold.

| Sample | Midpoint | Overlap | Class | Confidence difference |
| --- | --- | --- | --- | ---: |
| retained geometry overlap | relevant | relevant, 100.0% overlap | A | +0.162 |
| partial corridor overlap | relevant | relevant, 46.0% overlap | A | -0.084 |
| nearby parallel not overlap | relevant | not relevant, 0.0% overlap | B | -0.307 |
| nearby intersection not overlap | relevant | not relevant, 0.0% overlap | B | -0.463 |
| sparse route missed overlap | not relevant | relevant, 100.0% overlap | C | +0.912 |
| threshold ambiguity | relevant | not relevant, 17.3% overlap | D | -0.274 |

Findings:

- US 90 has enough local geometry coverage to support overlap validation.
- Geometry overlap correctly rejects nearby non-overlap.
- Geometry overlap recovers a sparse-route miss.
- Short shared-alignment cases need explicit confidence handling because a 17.3% overlap should not be treated the same as a full corridor impact.

## 9. Overlap Threshold Analysis

Thresholds evaluated: 10%, 25%, 50%, and 75%. All threshold runs use the same 0.55 confidence floor.

| Threshold | True positives | False positives | True negatives | False negatives | Ambiguous relevant | Judged accuracy |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10% | 21 | 0 | 14 | 0 | 5 | 100.0% |
| 25% | 21 | 0 | 14 | 0 | 4 | 100.0% |
| 50% | 20 | 0 | 14 | 1 | 2 | 97.1% |
| 75% | 16 | 0 | 14 | 5 | 0 | 85.7% |

Recommendation: **25% minimum overlap plus a confidence floor**.

Rationale:

- 10% is too permissive for short shared alignments and would keep more ambiguous cases relevant.
- 25% preserved all judged true positives and true negatives while reducing ambiguous relevant cases compared with 10%.
- 50% begins to miss meaningful partial-overlap events.
- 75% is too strict and would miss many legitimate construction extents that partially overlap a watched route.

A future production plan should avoid a hard threshold alone. Recommended model: **25% overlap as the default relevance threshold, 10%–25% as an ambiguity / low-confidence band, and 50%+ as high-confidence route impact evidence**.

## 10. Performance Review

Computational cost is practical at Liberty County scale if implemented carefully in a future milestone.

Estimated factors:

- The prototype scorer samples retained event segments and checks segment midpoints against route geometry.
- Cost scales roughly with `event segment count × route segment count` for each candidate event/route pair.
- Liberty County corridor feature counts are modest: the largest requested corridor group is US 90 with 127 local features and 53.28 approximate geometry miles.
- Route Watch users evaluate a small active route, not every county road simultaneously.
- Geometry scoring can be limited to candidate TxDOT events already filtered by county, corridor text, bounding box, or route vicinity.

Practicality assessment:

| Target | Assessment |
| --- | --- |
| Active Route Watch users | Practical with candidate prefiltering and cached route geometry. |
| Liberty County scale | Practical; route geometry volume is limited. |
| Future county expansion | Practical if geometry is indexed or prefiltered by bbox/corridor before overlap scoring. |
| Mobile feasibility | Practical if scoring is batched, cached, and avoided during map animation. |

Recommended future guardrails:

- Pre-filter by county and bbox before overlap scoring.
- Cache simplified route geometry per active Route Watch route.
- Cap evaluated candidate events per refresh.
- Run overlap scoring off the critical render path.
- Keep retained geometry immutable and separate from user-facing display until intentionally wired.

## 11. Route Watch Product Value Assessment

Scoring scale: 0 = none, 5 = transformational.

| Area | Score | Rationale |
| --- | ---: | --- |
| Route relevance improvement | 5 | Overlap directly answers whether the event geometry shares the watched route. |
| Confidence improvement | 4 | Same-route overlap raises confidence; non-overlap lowers confidence; ambiguity remains for short shared alignments. |
| Commuter usefulness | 4 | Reduces over-alerting and missed construction impacts on active routes. |
| Construction awareness improvement | 5 | Construction extents are geometry-native; overlap is a better fit than midpoint-only relevance. |
| Future directional foundation | 3 | Overlap creates a geometry foundation for later directional validation, but V292 intentionally does not implement directional display or NB/SB/EB/WB labels. |

Overall product-value score: **4.2 / 5**.

## 12. Production Readiness Review

Decision: **A. Ready for production planning**.

This does **not** mean ready for direct production implementation. It means the validation evidence is strong enough to justify a future planning milestone.

| Factor | Review |
| --- | --- |
| Reliability | Strong for same-route overlap, non-overlap rejection, and sparse-route recovery. Needs policy for ambiguous low-overlap cases. |
| Maintainability | Feasible if geometry scoring remains isolated, tested, and documented before wiring. |
| Performance | Feasible with bbox/corridor prefiltering, route-geometry caching, and refresh-time caps. |
| Data quality | Good enough for planning; retained TxDOT geometry adds important signal, but local route geometry and TxDOT event geometry should be validated before user-facing use. |
| User value | High; directly addresses over-alerting and missed route impacts. |

Production planning prerequisites:

- Define confidence bands and threshold behavior.
- Decide fallback behavior when retained geometry is missing or invalid.
- Add test fixtures before any app wiring.
- Plan telemetry-free validation outputs or local debug-only diagnostics before production behavior changes.
- Preserve current Route Watch behavior until an explicit integration milestone.

## 13. Recommended Next Milestone

Recommended: **V293 — Route Watch Relevance Architecture**.

Why this is the best next milestone:

- V290 proved geometry retention has product value.
- V291 proved overlap can outperform midpoint in controlled prototype scenarios.
- V292 validates overlap across realistic corridor scenarios.
- The next risk is not whether overlap is useful; it is how to architect relevance safely without changing user-facing behavior prematurely.

V293 should produce an architecture plan covering:

- Current midpoint relevance preservation.
- Geometry-overlap scoring as an isolated optional signal.
- Confidence bands and threshold policy.
- Missing-geometry fallback.
- Candidate prefiltering and performance caps.
- Test fixtures and validation criteria.
- A future integration path that explicitly avoids alerts/popups/markers/reporting/Supabase changes until approved.

## 14. Final Recommendation

**A. Geometry-overlap relevance is validated and ready for production planning.**

Geometry-overlap relevance consistently outperformed midpoint-only relevance in the validation scenarios that matter most for Route Watch planning:

- It kept clean same-route impacts relevant.
- It reduced midpoint false positives for nearby-but-not-overlapping geometry.
- It recovered midpoint false negatives when route vertices were sparse.
- It provided a measurable confidence signal and overlap percentage.
- It exposed threshold-sensitive ambiguity instead of hiding it behind a single midpoint coordinate.

The recommended path is to plan the architecture in V293, not to wire overlap into production behavior yet.
