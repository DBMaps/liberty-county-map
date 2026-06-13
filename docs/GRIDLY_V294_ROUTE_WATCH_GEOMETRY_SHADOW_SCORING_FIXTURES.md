# Gridly V294 — Route Watch Geometry Shadow Scoring Fixtures

## Status

- **Milestone:** V294 Route Watch Geometry Shadow Scoring Fixtures
- **Scope:** Documentation, fixture, and audit-only validation
- **Production behavior:** Unchanged
- **UI behavior:** Unchanged
- **Safety status:** `safeForProductionWiring: false`

V294 adds fixture-backed shadow scoring for Route Watch geometry relevance. It compares the current midpoint-style relevance signal with a separate geometry-overlap signal, records confidence and disagreement diagnostics, and validates expected disagreement cases without changing any existing Route Watch output.

## Fixture strategy

The fixture set lives in `data/route-watch-geometry-shadow-fixtures.json` and uses synthetic Liberty County-style LineString geometry rather than live incidents or user-submitted reports. Each fixture contains:

- A watched `routeGeometry` LineString.
- A retained-event-style `eventGeometry` LineString.
- Expected midpoint relevance.
- Expected geometry-overlap relevance.
- Expected confidence band.
- Expected disagreement reason.

The 10 V294 fixtures cover the required cases:

| Fixture id | Required case | Purpose |
| --- | --- | --- |
| `midpoint-true-positive` | midpoint true positive | Verifies midpoint relevance can still identify a direct route event. |
| `midpoint-false-positive` | midpoint false positive | Captures a nearby non-overlap line that the current midpoint threshold accepts. |
| `midpoint-false-negative` | midpoint false negative | Captures a sparse-vertex route where geometry overlap finds a route impact that midpoint misses. |
| `geometry-overlap-true-positive` | geometry overlap true positive | Confirms sustained retained geometry overlap is supported. |
| `geometry-overlap-true-negative` | geometry overlap true negative | Confirms distant retained geometry is rejected by both signals. |
| `sparse-route-geometry-miss` | sparse route geometry miss | Keeps sparse-route no-overlap as ambiguous instead of suppressive. |
| `nearby-parallel-road-non-overlap` | nearby parallel road non-overlap | Models frontage/parallel road proximity that should not become direct route evidence. |
| `intersection-adjacent-ambiguity` | intersection-adjacent ambiguity | Models cross-street contact near a route vertex without sustained overlap. |
| `tx-146-shared-alignment-case` | TX 146 shared-alignment case | Geometry-supported, but held for shared-alignment review before wiring. |
| `tx-321-shared-alignment-case` | TX 321 shared-alignment case | Weak shared-alignment overlap that stays ambiguous in shadow scoring. |

The fixture set intentionally includes both clear wins and unsafe edge cases. The goal is not to optimize the score for every case in V294; the goal is to make disagreement visible and repeatable before any production wiring plan is considered.

## Shadow scoring model

The audit helper and Node validation script use two independent scores:

1. **Current midpoint relevance**
   - Uses the current planning model of event midpoint to watched-route vertex distance.
   - Uses the V292 threshold of `0.8` miles.
   - Produces a midpoint confidence for comparison only.

2. **Geometry-overlap relevance**
   - Calls the V290 geometry retention prototype scorer when available.
   - Uses retained-event-style LineString geometry and watched-route LineString geometry.
   - Uses `60` meters as the default route-corridor tolerance.
   - Treats overlap as relevant only when overlap percentage is at least `25%` and geometry confidence is at least `0.55`.

The shadow report compares:

- Current midpoint relevance.
- Geometry-overlap relevance.
- Confidence band.
- Fallback reason.
- Disagreement reason.

The output summary reports:

```json
{
  "totalFixtures": 10,
  "midpointMatches": 10,
  "geometryMatches": 10,
  "midpointFalsePositiveCandidates": 4,
  "midpointFalseNegativeCandidates": 1,
  "geometrySupportedCandidates": 4,
  "geometryRejectedCandidates": 3,
  "ambiguousCandidates": 4,
  "safeForProductionWiring": false
}
```

## Audit helper

V294 adds a standalone audit helper in `js/gridlyRouteWatchGeometryShadowScoring.js`:

```js
window.gridlyRouteWatchGeometryShadowAudit?.()
```

The helper is intentionally not wired into user-facing Route Watch behavior. It uses `window.gridlyRouteWatchGeometryShadowFixtures` when called with no arguments, also accepts a fixture payload argument for tests/scripts, and returns a full shadow report with validation failures when expectations do not match.

The primary command-line entry point is:

```bash
node scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs
```

That script loads:

- `js/gridlyTxdotGeometryRetentionPrototype.js`
- `js/gridlyRouteWatchGeometryShadowScoring.js`
- `data/route-watch-geometry-shadow-fixtures.json`

It exits non-zero if any expected midpoint result, geometry result, confidence band, or disagreement reason fails validation.

## Safety boundaries

V294 preserves the V293 fallback contract:

- Existing Route Watch relevance remains unchanged.
- Geometry scoring is computed separately.
- Geometry results do not suppress or promote incidents.
- No alert behavior changes.
- No popup behavior changes.
- No marker behavior changes.
- No reporting behavior changes.
- No Supabase behavior changes.
- No awareness behavior changes.
- No user-facing display changes.

Every fixture result includes `existingRelevanceUnchanged: true` and `productionSuppressionOrPromotion: false`. The summary always reports `safeForProductionWiring: false` for this milestone.

## TX 146 / TX 321 notes

### TX 146

The TX 146 fixture represents a geometry-supported shared alignment. Geometry overlap is strong enough to support the candidate, but the case is deliberately marked `ambiguous` with `shared_alignment_review` because shared-alignment corridors can cause route-name ambiguity. A future milestone should require stronger route-name, limit, crossing, or direction evidence before using this as production route-impact proof.

### TX 321

The TX 321 fixture represents a short shared alignment with most retained geometry leaving the watched route. It remains geometry-rejected and ambiguous in shadow scoring. This protects against treating a brief shared segment, limit transition, or nearby connecting road as direct TX 321 Route Watch impact.

## Recommended next milestone

**Recommendation: V295 should be A) expand fixture coverage.**

Reasoning:

- V294 validates the minimum required disagreement cases, but the fixture set is still synthetic and intentionally small.
- Runtime shadow audit would be useful later, but V294 does not yet prove coverage across enough real retained TxDOT geometries, local county roads, ramps, frontage roads, and shared alignments.
- Production wiring planning should wait until fixture coverage includes more real sampled geometries and corridor-specific edge cases.

Recommended V295 additions:

1. Add real retained TxDOT geometry samples where licensing/source constraints allow internal audit use.
2. Expand TX 146 and TX 321 shared-alignment fixtures with direction, limit, and route-name variants.
3. Add route geometry quality buckets: dense, normal, sparse, malformed, and missing.
4. Add bbox prefilter fixtures so future runtime shadow scoring can be performance-tested safely.
5. Keep `safeForProductionWiring: false` until expanded fixtures continue passing and ambiguity handling is stable.
