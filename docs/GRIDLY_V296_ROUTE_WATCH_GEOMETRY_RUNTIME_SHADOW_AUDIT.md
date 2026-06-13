# Gridly V296 — Route Watch Geometry Runtime Shadow Audit

Date: 2026-06-13
Scope: audit-only runtime shadow evaluation for Route Watch relevance.

## Summary

V296 adds a runtime shadow audit path that runs only beside the existing Route Watch relevance calculation. The existing midpoint / crossing-ID relevance result remains authoritative, and geometry-overlap scoring is captured only as audit data.

The implementation is intentionally conservative:

- No Route Watch production decision reads the geometry result.
- No UI, alert, popup, marker, awareness, reporting, Supabase, directional-display, or notification behavior is changed.
- `safeForProductionWiring` remains `false`.
- The recommended V297 path is **A) extended runtime observation** with limited telemetry refinement, not production wiring.

## Architecture

### Runtime pieces

1. `js/gridlyTxdotGeometryRetentionPrototype.js`
   - Existing V290 prototype overlap scorer.
   - Loaded before the runtime shadow audit helper so the audit can reuse the same overlap primitive used by V291/V292/V294/V295 validation.

2. `js/gridlyRouteWatchGeometryRuntimeShadowAudit.js`
   - New V296 audit-only state and aggregation helper.
   - Exposes:
     - `window.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate(...)`
     - `window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()`
     - `window.gridlyResetRouteWatchGeometryRuntimeShadowAudit?.()` for validation resets.

3. `isIncidentRouteRelevant(...)` in `js/app.js`
   - Still returns the existing midpoint / crossing-ID result.
   - Calls the shadow recorder only after the existing relevance path has evaluated a candidate while Route Watch has active route geometry.
   - Does not consume the geometry result and does not alter the returned value.

### Data flow

```text
Route Watch relevance execution
  -> existing midpoint / crossing-ID result is computed
  -> existing result is recorded as midpointRelevanceResult
  -> geometry-overlap relevance is scored separately in shadow helper
  -> shadow helper appends audit-only candidate record
  -> isIncidentRouteRelevant returns the original midpoint result
```

## Runtime behavior

The shadow path captures one audit record per evaluated candidate with:

- route identifier
- incident identifier
- midpoint relevance result
- geometry relevance result
- confidence band
- overlap percentage
- fallback reason
- disagreement reason

Geometry relevance uses retained line geometry when present. If an incident has no retained line geometry, the record stays audit-visible with `fallbackReason: retained_incident_geometry_unavailable_current_midpoint_preserved` and `disagreementReason: geometry_unavailable`.

## Audit output

`window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()` returns an object shaped for V296 runtime inspection:

```js
{
  available: true,
  auditOnly: true,
  shadowModeOnly: true,
  productionBehaviorChanged: false,
  safeForProductionWiring: false,

  evaluatedCandidates,
  midpointMatches,
  geometryMatches,

  midpointOnlyMatches,
  geometryOnlyMatches,

  disagreementCount,

  confidenceBandDistribution,

  overlapDistribution,

  disagreementReasons,

  corridorBreakdown,

  performance: {
    scoringCount,
    averageScoringTimeMs,
    peakScoringTimeMs,
    totalAuditOverheadMs,
    mobileSafe,
    performanceSafe
  },

  mobileSafe,
  performanceSafe,
  safetyVerification,
  candidates
}
```

The candidate list is included for audit inspection only and is not used by Route Watch output.

## Performance findings

Validation command:

```bash
node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs
```

Observed V296 validation sample:

- scoring count: `3`
- average scoring time: `0.744ms`
- peak scoring time: `1.852ms`
- total audit overhead: `3.944ms`
- `mobileSafe: true`
- `performanceSafe: true`

These numbers are from a small synthetic runtime harness and should not be treated as broad production evidence. They are sufficient to show that the shadow helper works and that no immediate optimization work is required for the validation sample.

## Disagreement analysis

V296 preserves V294/V295 fixture-backed disagreement categories and adds runtime categories appropriate for live candidates:

- `midpoint_only_no_geometry_overlap` — existing midpoint says relevant, retained geometry does not overlap.
- `insufficient_overlap_or_confidence` — some overlap exists, but not enough for the configured shadow thresholds.
- `geometry_only_overlap_candidate` — geometry overlaps while midpoint says not relevant.
- `geometry_unavailable` — retained incident line geometry is unavailable; midpoint remains preserved.
- `route_geometry_unavailable` — route geometry was not available to the shadow scorer.
- `none` — midpoint and geometry agree.

The runtime harness observed at least one disagreement and at least one geometry-supported match, confirming the audit can surface both agreement and disagreement without changing production output.

## Explicit safety verification

V296 verifies these as hard audit-only constraints:

- no UI changes
- no Route Watch output changes
- no alert changes
- no popup changes
- no marker changes
- no awareness changes
- no Supabase writes
- no notification behavior changes

The runtime audit response reports these in `safetyVerification`, and the validation script fails if they are not true.

## Existing validation continuity

The following validation paths continue to pass:

- V291 prototype validation: `node scripts/v291-route-watch-geometry-prototype.mjs`
- V292 validation: `node scripts/v292-route-watch-geometry-validation.mjs`
- V294 fixture validation: `node scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs`
- V295 fixture-expansion validation: `node scripts/v295-route-watch-geometry-fixture-expansion.mjs`
- V296 runtime shadow validation: `node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs`

## Remaining blind spots

- Runtime evidence is still synthetic unless testers actively use Route Watch with live retained geometry candidates.
- Many current incident objects may only have midpoint coordinates, which correctly produces `geometry_unavailable` but limits overlap conclusions.
- Performance findings are not yet representative of long sessions, dense incident sets, or low-end mobile browsers.
- The audit records are in-memory and reset on reload; this is deliberate to avoid telemetry, Supabase, or production persistence changes.
- The geometry scorer remains prototype-grade and does not yet solve divided-road, lane-level, or directional carriageway ambiguity.

## Recommendation for V297

Recommended: **A) Extended runtime observation**, with a narrow slice of **B) runtime telemetry refinement** if it remains audit-only.

Do **not** recommend C) production wiring architecture planning yet. V292/V294/V295 support production planning in principle, but V296 runtime evidence is intentionally limited and still shows important blind spots around retained geometry availability and real-session performance. Keep `safeForProductionWiring: false` until extended runtime observation demonstrates stable disagreement patterns, acceptable overhead on mobile devices, and enough retained-geometry coverage to justify design planning.
