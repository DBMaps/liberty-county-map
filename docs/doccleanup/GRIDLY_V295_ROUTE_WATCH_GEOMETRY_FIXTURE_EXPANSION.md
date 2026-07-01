# Gridly V295 — Route Watch Geometry Fixture Expansion

## Status

- **Milestone:** V295 Route Watch Geometry Fixture Expansion
- **Scope:** Fixture, test, and documentation only
- **Production behavior:** Unchanged
- **UI behavior:** Unchanged
- **Safety status:** `safeForProductionWiring: false`

V295 expands the V294 Route Watch geometry shadow-scoring fixture set before any runtime shadow audit or production wiring. The geometry score remains a separate audit signal: it does not suppress, promote, display, alert, report, write Supabase state, change awareness behavior, or alter directional display.

## Expanded fixture strategy

The fixture payload remains `data/route-watch-geometry-shadow-fixtures.json`. All coordinates are synthetic Liberty County-style LineStrings and are not production incident data. V295 keeps the original V294 fixtures and adds corridor-specific edge cases for shared alignments, frontage/parallel roads, intersections, sparse geometry, overlap thresholds, and confidence-band boundaries.

Every fixture now declares the full expected shadow result:

- `expectedMidpointRelevant`
- `expectedGeometryRelevant`
- `expectedConfidenceBand`
- `expectedDisagreementReason`
- `expectedFallbackReason`

The audit helper validates these declarations before reporting success. Missing expectation fields are treated as validation failures, which keeps future fixture additions explicit instead of relying on implicit defaults.

## Corridor coverage

V295 expands the fixture set from 10 to 20 fixtures. The current corridor distribution is:

| Corridor | Fixture count | Coverage intent |
| --- | ---: | --- |
| US 90 | 4 | Baseline true positive, midpoint false positive, nearby parallel road, and overlap-threshold review. |
| FM 1960 | 2 | Sparse-vertex midpoint miss plus medium confidence-band edge case. |
| FM 1409 | 4 | Sustained overlap, intersection-adjacent ambiguity, sparse local-detour miss, and low-overlap review. |
| FM 1011 | 1 | Distant geometry true negative. |
| FM 1008 | 1 | Sparse route geometry miss retained from V294. |
| TX 146 | 3 | Shared-alignment support, frontage-style parallel non-overlap, and intersection-adjacent crossing ambiguity. |
| TX 321 | 3 | Weak shared alignment, geometry-supported shared alignment, and nearby parallel non-overlap. |
| US 59 / I-69 | 2 | Geometry-supported route event and frontage-road non-overlap. |

## Scenario coverage

The expanded fixture set covers the requested scenario classes:

| Scenario type | Fixture count | Notes |
| --- | ---: | --- |
| `midpoint_true_positive` | 1 | Confirms the existing midpoint path still accepts a clear direct route event. |
| `midpoint_false_positive` | 1 | Captures non-overlap geometry that midpoint proximity accepts. |
| `midpoint_false_negative` | 1 | Captures geometry-supported overlap that sparse route vertices can miss. |
| `geometry_overlap_true_positive` | 2 | Exercises FM 1409 and US 59 / I-69 direct overlap support. |
| `geometry_overlap_true_negative` | 1 | Preserves distant non-route rejection coverage. |
| `sparse_route_geometry_miss` | 2 | Keeps sparse no-overlap cases ambiguous rather than suppressive. |
| `nearby_parallel_road_non_overlap` | 2 | Covers US 90 and TX 321 local parallel roads. |
| `nearby_parallel_frontage_road_non_overlap` | 2 | Covers TX 146 and US 59 / I-69 frontage-style roads. |
| `intersection_adjacent_ambiguity` | 2 | Covers FM 1409 and TX 146 crossing/intersection ambiguity. |
| `tx_146_shared_alignment_case` | 1 | Keeps TX 146 shared-alignment support ambiguous. |
| `tx_321_shared_alignment_case` | 2 | Covers both weak and supported TX 321 shared-alignment variants. |
| `ambiguous_overlap_threshold_case` | 2 | Exercises low-overlap/threshold-adjacent review behavior. |
| `confidence_band_edge_case` | 1 | Adds a medium confidence-band case near geometry relevance thresholds. |

## Validation output

The V295 shadow report summary now includes the fixture totals and distributions required for pre-runtime audit review:

```json
{
  "totalFixtures": 20,
  "fixtureCountByCorridor": {
    "US 90": 4,
    "FM 1960": 2,
    "FM 1409": 4,
    "FM 1011": 1,
    "FM 1008": 1,
    "TX 146": 3,
    "TX 321": 3,
    "US 59 / I-69": 2
  },
  "midpointMatches": 20,
  "geometryMatches": 20,
  "midpointFalsePositiveCandidates": 9,
  "midpointFalseNegativeCandidates": 1,
  "geometrySupportedCandidates": 7,
  "geometryRejectedCandidates": 8,
  "ambiguousCandidates": 7,
  "confidenceBandDistribution": {
    "high": 4,
    "not_relevant": 6,
    "ambiguous": 7,
    "low": 2,
    "medium": 1
  },
  "safeForProductionWiring": false
}
```

The report also includes `fixtureCountByScenarioType`, `disagreementReasons`, per-fixture fallback reasons, expectation matches, and validation failures when expectations do not match the actual shadow score.

## Shadow-only safety boundaries

V295 preserves the V293/V294 safety contract:

- Existing Route Watch relevance remains unchanged.
- Geometry scoring remains separate from current relevance.
- Geometry scoring does not suppress current relevant results.
- Geometry scoring does not promote current non-relevant results.
- No alerts, popups, markers, reporting flows, Supabase writes, awareness behavior, or directional displays are changed.
- The report continues to emit `safeForProductionWiring: false`.

## Remaining blind spots

The expanded fixture set is still intentionally conservative and synthetic. Remaining blind spots include:

1. Real retained TxDOT geometry variance across route names, marker limits, ramps, and direction fields.
2. MultiLineString or malformed retained geometry, if future feeds preserve those shapes.
3. More dense-versus-sparse route geometry quality buckets, especially for curved rural segments.
4. Directional, limit-name, and route-name conflict cases on shared alignments.
5. Runtime sampling and performance characteristics for larger active incident sets.
6. Bbox prefilter behavior before calling the overlap scorer at runtime.
7. Production-facing copy, display, and suppression rules, which are deliberately out of scope for V295.

## Recommendation for V296

**Recommended V296: A) Runtime shadow audit.**

Rationale: V295 provides broader fixture coverage and all expanded fixtures validate, but the data is still synthetic and `safeForProductionWiring` remains `false`. The next conservative step is a runtime shadow audit that computes and logs the separate geometry signal without changing production Route Watch behavior. Production wiring architecture should wait until runtime shadow results confirm that the fixture-backed expectations hold against live retained geometry distributions.
