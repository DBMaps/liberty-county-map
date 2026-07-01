# GRIDLY V308 — Shadow Scoring Incident Source Alignment

## Real-device evidence

V307 correctly recorded the active route context candidate on device:

- `activeRouteContextCandidateRecorded: true`
- `routeContextType: "saved_destination_route"`
- `hasGeometry: true`
- `vertexCount: 1707`
- `candidates.length: 1`

After submitting a Construction report near that active route, Route Details showed `1 active hazard reported near this route`, and `window.gridlyActiveIncidentAudit?.()` reported one `generatedRoadIncidents` entry. V307 still returned `activeIncidentCandidates: 0`, `scoredIncidentCandidates: 0`, and `zeroScoringReasons.no_active_incidents: 1`.

## Route Details incident source found

Route Details uses the destination-route intelligence pipeline:

1. `buildGridlyDestinationRouteIntelligenceAudit()` reads the active destination route preview geometry.
2. It builds route-corridor matches from:
   - `getGridlyDestinationRouteHazardSource()` → active `activeHazards[]` rows where `!hazard.expired` and `hazard.type !== "hazard_cleared"`.
   - `getGridlyDestinationRouteReportSource()` → active `activeReports[]` rows where `!report.expired`.
   - `getGridlyDestinationRouteAlertSource()` → alert snapshot arrays.
3. `findGridlyDestinationRouteCorridorMatches()` filters candidates by expanded route bounds and then by distance from route within `GRIDLY_DESTINATION_ROUTE_INTELLIGENCE_CORRIDOR_FEET`.
4. `buildGridlyDestinationRouteImpactAudit()` consumes `matchedHazards`, `matchedAlerts`, and `matchedReports`.
5. `getGridlyDestinationRoutePrimaryImpactReason()` displays `Active hazard reported near this route` when `hazardMatches.length > 0 || alertMatches.length > 0`.

`generatedRoadIncidents` is relevant diagnostic evidence from `gridlyActiveIncidentAudit()`, but the Route Details copy is driven by route-intelligence `matchedHazards` / `matchedAlerts` / `matchedReports`, not directly by `generatedRoadIncidents`.

## V307 mismatch root cause

V307 shadow scoring only read explicit audit inputs, `input.activeIncidents`, or `window.__gridlyRouteWatchGeometryRuntimeShadowIncidents`. On real devices, Route Details used route-intelligence matches from active hazard/report/alert state, so the shadow scorer saw no incident source and incorrectly emitted `no_active_incidents` while Route Details had a route-relevant active hazard.

## Exact alignment approach

V308 adds a read-only Route Details source accessor:

- `window.gridlyGetDestinationRouteActiveIncidentCandidates()` returns the currently matched Route Details incident candidates from `gridlyDestinationRouteIntelligenceAudit()`.
- The accessor reports source name, route-found state, corridor width, grouped counts, `routeDetailsIncidentCount`, and a combined read-only `incidents[]` array.

The V308 shadow audit now resolves incident sources in this order:

1. Explicit `input.incidents`.
2. Explicit `input.activeIncidents`.
3. Route Details accessor `gridlyGetDestinationRouteActiveIncidentCandidates()`.
4. Legacy `window.__gridlyRouteWatchGeometryRuntimeShadowIncidents`.
5. Empty source.

When Route Details has active route-relevant incidents, the shadow scorer can now observe and score those same candidates against the Active Route Context geometry. If a candidate is inactive/cleared or lacks usable coordinates, it is listed in `excludedIncidentCandidates` and counted in `excludedIncidentReasons` / `zeroScoringReasons` instead of being hidden behind a false `no_active_incidents` result.

## Safety boundaries

V308 remains shadow-only and read-only:

- `safeForProductionWiring: false`
- `productionDecisionUsed: false`
- `shadowModeOnly: true`
- `productionBehaviorChanged: false`

It does not change Route Details behavior, alerts, markers, popups, recommendations, route hazard score, Supabase writes, report lifecycle, awareness, notifications, or directional display.

## Validation expectations

Browser/phone validation:

1. Open an active route to Marshall's or Work.
2. Submit a test Construction or Disabled Vehicle hazard near the route.
3. Confirm Route Details shows a route hazard.
4. Run:

```js
JSON.stringify(window.gridlyRouteWatchGeometryRuntimeShadowAudit?.(), null, 2)
```

Expected V308 results:

- `activeRouteContextCandidateRecorded: true`
- `routeDetailsIncidentCount >= 1`
- `activeIncidentCandidates >= 1` or `excludedIncidentReasons` explains every exclusion
- `activeIncidentCandidateIds` includes the candidate IDs seen by the shadow scorer
- `zeroScoringReasons` does not incorrectly report `no_active_incidents` when Route Details has an active route hazard
- `safeForProductionWiring: false`

## V309 recommendation

Default recommendation: **V309 — Controlled Route Hazard Shadow Scoring Validation**.

Proceed to V309 only after V308 confirms the shadow scorer sees the same active incident candidates as Route Details, or explains exact exclusion reasons for any Route Details candidates it cannot score.
