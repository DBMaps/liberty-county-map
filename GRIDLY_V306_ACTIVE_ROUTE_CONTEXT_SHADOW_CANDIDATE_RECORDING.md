# GRIDLY V306 — Active Route Context Shadow Candidate Recording

## Why V306 exists

V306 closes the audit-only handoff between the shared Active Route Context introduced in V304/V305 and the V296 Route Watch geometry runtime shadow audit. V305 confirmed that the active route context can describe the user-visible route preview, but V296 still had no audit candidate to inspect when no incident or hazard relevance scoring had been invoked.

The purpose of V306 is limited to candidate recording for shadow observation. It does not promote Active Route Context geometry into production scoring, recommendations, alerts, routing, monitoring, or UI behavior.

## V305 real-device result

V305 validated a real-device Active Route Context with the following relevant fields:

```json
{
  "routeContextType": "saved_destination_route",
  "destinationLabel": "Marshall's",
  "hasGeometry": true,
  "vertexCount": 1704,
  "routeWatchEligible": true
}
```

Before V306, the V296 runtime audit still reported no candidates for that context:

```json
{
  "evaluatedCandidates": 0,
  "observationScope": {
    "recordsSavedDestinationCandidates": false
  },
  "candidates": []
}
```

## Candidate recording rules

V306 records an Active Route Context shadow candidate only when all of the following are true:

- `activeRouteContext.routeContextAvailable === true`
- `activeRouteContext.hasGeometry === true`
- `activeRouteContext.vertexCount > 0`
- `activeRouteContext.routeWatchEligible === true`
- `activeRouteContext.routeContextType` is one of the supported context types listed below

Recorded candidates use `candidateSource: "active_route_context"` and `productionBehaviorChanged: false` so they remain distinguishable from incident/hazard geometry scoring candidates.

## Supported context types

V306 can record shadow candidates for these Active Route Context types:

- `searched_destination_route`
- `saved_destination_route`
- `home_destination_route`
- `work_destination_route`
- `route_watch_monitored_route`

## Excluded context types and conditions

V306 does not record candidates for:

- `no_active_route`
- `cleared_route`
- unsupported context types
- contexts where `routeContextAvailable` is not true
- contexts without geometry
- contexts with `vertexCount <= 0`
- contexts that are not Route Watch eligible

When a candidate is not recorded, `observationScope.activeRouteContextCandidateReason` reports the exclusion reason.

## Safety boundaries

V306 is audit/shadow-only. It does not change:

- production Route Watch recommendations
- route hazard score
- route relevance results
- alert relevance
- monitoring state
- UI state
- routing behavior
- notifications
- markers, popups, reporting, Supabase writes, awareness, desktop, PWA, store, or directional-display behavior

Active Route Context candidates are intentionally kept separate from geometry relevance scoring counts. If no incident/hazard scoring runs, `evaluatedCandidates` and `performance.scoringCount` can remain `0` while `candidates.length` is greater than `0` because the route context candidate is observational only.

## Validation expectations

In browser or on phone, after selecting a saved destination such as Marshall's and confirming route preview geometry exists, run:

```js
JSON.stringify(window.gridlyGetActiveRouteContext?.(), null, 2)
JSON.stringify(window.gridlyRouteWatchGeometryRuntimeShadowAudit?.(), null, 2)
```

Expected V306 audit output:

- `activeRouteContext.hasGeometry: true`
- `activeRouteContext.vertexCount > 0`
- `observationScope.activeRouteContextCandidateRecorded: true`
- `observationScope.activeRouteContextCandidateReason: "active_route_context_candidate_recorded"`
- `observationScope.recordsSavedDestinationCandidates: true` for a qualifying `saved_destination_route`
- `candidates.length > 0`
- `evaluatedCandidates` may remain `0` when no incident/hazard relevance scoring occurred
- `safeForProductionWiring: false`

Programmatic checks:

```bash
node --check js/app.js
node --check js/gridlyRouteWatchGeometryRuntimeShadowAudit.js
node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs
```

## Remaining gap after V306

V306 records the existence and metadata of a qualifying Active Route Context candidate, but it does not compare that route geometry against active incidents or hazards. The audit can now prove that eligible saved, searched, home, work, and monitored route contexts are observable, but geometry relevance remains unscored unless an existing shadow scoring path records an incident/hazard candidate separately.

## V307 recommendation

Default recommendation:

**V307 — Active Route Context Geometry Relevance Shadow Scoring**

V307 should begin only after V306 confirms Active Route Context candidates are recorded in real-device audits. V307 should compare Active Route Context geometry against available active incidents/hazards in shadow mode only, while preserving the same production-safety boundaries: no recommendation changes, no alert changes, no route monitoring changes, and `safeForProductionWiring: false` until separately approved.
