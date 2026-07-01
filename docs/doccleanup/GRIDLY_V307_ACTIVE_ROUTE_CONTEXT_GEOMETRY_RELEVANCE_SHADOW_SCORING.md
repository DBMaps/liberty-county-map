# GRIDLY V307 — Active Route Context Geometry Relevance Shadow Scoring

## Why V307 exists

V307 closes the V306 runtime gap where Active Route Context could prove an observable route geometry existed, but the runtime geometry audit still had `evaluatedCandidates: 0` and `scoringCount: 0` when hazards were present. V307 keeps the work in shadow mode only and uses Active Route Context geometry as an audit-only route context for comparing active incidents/hazards.

## V306 phone evidence

Phone validation for V306 confirmed:

- `activeRouteContextCandidateRecorded: true`
- `routeContextType: "work_destination_route"`
- `hasGeometry: true`
- `vertexCount: 1650`
- `candidates.length: 1`
- `safeForProductionWiring: false`

The remaining evidence gap was that geometry was observable but not yet compared against active hazards: `evaluatedCandidates: 0` and `scoringCount: 0`.

## Scoring model

V307 supports these Active Route Context route types:

- `searched_destination_route`
- `saved_destination_route`
- `home_destination_route`
- `work_destination_route`
- `route_watch_monitored_route`

When the active route context reports `routeContextAvailable: true`, `hasGeometry: true`, `vertexCount > 0`, and `routeWatchEligible: true`, the runtime shadow audit reads the route geometry from the active context or route preview geometry and scores eligible active incidents/hazards against that route.

Each scored candidate reports:

- `routeOwnership`
- `destinationLabel`
- `incidentId`
- `incidentType`
- `incidentStatus`
- `incidentLocation`
- `midpointRelevant`
- `geometryRelevant`
- `overlapPercent`
- `confidenceBand`
- `fallbackReason`
- `disagreementReason`
- `productionDecisionUsed: false`

## Included and excluded incidents

Included:

- active/open/confirmed hazards and incidents with valid point or line geometry
- hazards/incidents scored only when active route geometry is available

Excluded:

- cleared hazards
- inactive/recently-cleared hazards that are not active
- invalid coordinates
- incidents with no usable geometry candidate
- cases where no active route geometry is available

No active hazards is a valid zero-scoring state, reported through `zeroScoringReasons.no_active_incidents` rather than treated as a failure.

## Aggregate output

`window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()` now includes V307 aggregate fields:

- `evaluatedCandidates`
- `activeRouteContextCandidateRecorded`
- `activeIncidentCandidates`
- `scoredIncidentCandidates`
- `midpointMatches`
- `geometryMatches`
- `midpointOnlyMatches`
- `geometryOnlyMatches`
- `disagreementCount`
- `confidenceBandDistribution`
- `overlapDistribution`
- `disagreementReasons`
- `routeOwnershipBreakdown`
- `safeForProductionWiring: false`

## Performance guardrails

The audit reports:

- `scoringCount`
- `averageScoringTimeMs`
- `peakScoringTimeMs`
- `totalAuditOverheadMs`
- `mobileSafe`
- `performanceSafe`

The scoring remains lightweight and audit-only. It uses the existing retained TxDOT geometry scorer when available and falls back to a bounded vertex-distance comparison only for shadow evidence.

## Safety boundaries

V307 does not change production behavior. Shadow scores are not used for:

- route recommendations
- route hazard score
- alert visibility
- marker visibility
- Route Watch copy
- monitoring state
- Supabase writes
- UI
- notifications
- popups/reporting/awareness/directional-display behavior

Every scored candidate reports `productionDecisionUsed: false`, and the aggregate remains `safeForProductionWiring: false`.

## Validation results

Runtime fixture validation covers:

- active route context with no active hazards
- active route context with active hazard near route
- active route context with active hazard away from route
- cleared hazard excluded
- invalid geometry excluded
- `safeForProductionWiring` remains false

Validation command:

```bash
node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs
```

## Recommendation for V308

Default recommendation: **B) Controlled test hazard route validation**.

Do not wire shadow geometry relevance into production yet. V307 provides the first complete shadow-scoring milestone, but V308 should validate controlled active hazards against known route geometry on device before any production wiring plan is considered.
