# GRIDLY V143.0 Route Relevance Checks Optimization Audit

## Scope
Audit-only review of `route_relevance_checks` inside `buildCommuteConsequenceIntelligence(...)`.

No route watch logic, routing engine behavior, route scoring output, hazard ownership, Supabase flow, report persistence, or layout behavior changed.

## Route Relevance Call Map
Current route relevance path during `buildCommuteConsequenceIntelligence(...)`:

1. `buildCommuteConsequenceIntelligence(...)`
2. `timeSection("route_hazard_scoring", ...)`
   - If `routeWatchActivated === true`: `getRouteHazardAssessment()`
   - `getRouteHazardAssessment()` -> `buildRouteHazardAssessment(getRoutePolylineLatLngs())`
3. `timeSection("route_relevance_checks", ...)`
   - Iterates all active unified incidents
   - For each incident: `isIncidentRouteRelevant(incident, routeHazard)`
     - Guard: route watch active?
     - Guard: route geometry available? (`getRoutePolylineLatLngs()`)
     - Route hazard nearby crossings from precomputed `routeHazard` when present
     - Fallback distance check: `getDistanceMiles(...)` across route polyline points

## Findings: Active / Idle State

### Route Watch Idle
- `route_hazard_scoring` correctly skips hazard assessment when route watch is idle.
- `route_relevance_checks` still iterates every active incident and calls `isIncidentRouteRelevant(...)`.
- Each call exits early (`false`) because route watch is inactive.

### Route Watch Active + No Route Geometry
- `route_relevance_checks` still iterates every active incident and calls `isIncidentRouteRelevant(...)`.
- Each call fetches route polyline and returns `false` if `<2` points.
- This is repeated per incident.

### Route Watch Active + Route Geometry Present
- Relevance evaluates by crossing-id membership first.
- For incidents without matching crossing-id, distance-to-route checks run.
- Distance checks scan route polyline points per incident.

## Unnecessary Work Findings

1. **Per-incident route relevance calls still run while route watch is idle**.
2. **Per-incident guard checks repeat when no active route geometry exists**.
3. **Route polyline access and distance scanning can be repeated per incident** instead of sharing reusable route context across the same refresh cycle.

## Safe Reuse Candidate (for V143.1)
The following route relevance context appears safe to compute once and reuse for a single refresh cycle:
- `routeWatchActivated` state snapshot
- route polyline lat/lng list (`getRoutePolylineLatLngs()`)
- route geometry availability (`latLngs.length >= 2`)
- `nearbyCrossingIds` derived from route hazard assessment

This would preserve outputs while reducing repeated per-incident work.

## Recommended V143.1 Optimization Scope
1. **Idle short-circuit:** if route watch inactive, skip per-incident route relevance computation and set `routeRelevant = false`.
2. **No-geometry short-circuit:** if route watch active but route geometry unavailable, skip per-incident route relevance computation and set `routeRelevant = false`.
3. **Per-cycle route context caching:** compute route context once and reuse for all incidents in `route_relevance_checks`.

All three are output-preserving candidates if implemented without changing thresholds, scoring weights, or incident filtering.

## Added Audit Helper
Added:
- `window.gridlyRouteRelevanceAudit()`

Returns:
- `routeWatchActive`
- `routeGeometryAvailable`
- `routeIncidentCount`
- `unifiedIncidentCount`
- `checksRun`
- `functionsCalled`
- `perIncidentTimings`
- `totalMs`
- `slowestCheck`
- `unnecessaryWorkDetected`
- `recommendedV143Patch`

Use this helper before and after submitting a report to observe route relevance execution characteristics.
