# GRIDLY V302 — Route Watch Ownership Alignment Architecture

## Why V302 exists

V302 defines the smallest safe technical architecture step to reduce Route Watch ownership drift without changing production behavior. V300 concluded the product experience is now one destination-based Route Watch experience. V301 documented that technical ownership still drifts across Search Destination, route preview, Route Watch activation, Route Watch relevance, geometry retention, and monitoring.

V302 does **not** implement production behavior. It names a read-only active route context architecture so future audits can describe the route the user is currently seeing without changing routing, scoring, UI, alert relevance, storage, or monitoring behavior.

## V300/V301 recap

- **V300 finding:** Search Destination is the route entry point from the user's perspective. Home, Work, saved places, and searched places all behave as destination route inputs.
- **V300 finding:** Route Watch is perceived as monitoring/readiness layered around the selected destination route, not as a separate user-facing route system.
- **V301 finding:** implementation ownership remains fragmented. Destination route geometry and Route Watch geometry can be available through separate layers, state, and audit paths.
- **V301 recommendation:** use V302 for ownership alignment architecture before any production wiring.

## Current target model

| Product concept | Target owner |
| --- | --- |
| Search Destination | Route entry point |
| Route Watch | Monitoring/readiness layer |
| Destination route geometry | Observable route context |
| Route intelligence | Evaluates active route context only after separate approval |

## Smallest safe alignment step

The first safe alignment step is to introduce a **read-only active route context model** and an audit-only helper that can describe the current route context without owning or mutating it.

This reduces ownership drift by classifying destination-route geometry as **observable route context** while keeping Route Watch monitoring separate from route creation. It allows audits to see active destination route geometry and route-preview state without changing recommendations, production scoring, routing, UI, alerts, or storage.

## Active route context model

The V302 model describes these route context types:

- `no_active_route`
- `searched_destination_route`
- `saved_destination_route`
- `home_destination_route`
- `work_destination_route`
- `route_watch_monitored_route`
- `cleared_route`

The model fields are:

| Field | Meaning |
| --- | --- |
| `routeContextAvailable` | Whether an active or recently cleared context can be described. |
| `routeContextType` | The context classification from the supported type list. |
| `routeSource` | The source that produced the context: none, search destination, saved destination, Home, Work, Route Watch, or cleared. |
| `destinationType` | Destination classification: none, searched destination, saved place, Home, or Work. |
| `destinationLabel` | Display label only; never a persistence or routing write target. |
| `hasGeometry` | Whether route geometry is observable. |
| `geometrySource` | Read-only source classification for geometry. |
| `vertexCount` | Read-only geometry vertex count. |
| `routePreviewAvailable` | Whether a preview/layer appears observable. |
| `monitoringActive` | Whether Route Watch monitoring is active. |
| `relevanceObserved` | Whether audit/relevance paths have observed candidates. |
| `routeWatchEligible` | Descriptive eligibility only; does not activate or promote Route Watch. |
| `ownershipNotes` | Read-only notes explaining ownership boundaries and drift. |

## Current vs future ownership

| Area | Current ownership | V302 alignment | Future ownership |
| --- | --- | --- | --- |
| Route entry | Search Destination and Route Watch activation can both initiate route-like states. | Search Destination is named as route entry point for destination routes. | One explicit route-entry contract. |
| Route geometry | Destination preview geometry and Route Watch geometry are observed separately. | Destination geometry is observable route context. | Shared read-only observation bridge before any scoring changes. |
| Monitoring | Route Watch owns monitoring/readiness. | Monitoring remains separate. | Possible later monitoring alignment plan. |
| Relevance/scoring | Route Watch relevance evaluates existing Route Watch paths. | Production scoring remains blocked. | Evaluate active route context only after separate approval. |
| Storage | Saved places and Supabase writes remain independent. | No writes. | Any persistence change requires a separate task. |

## Audit helper

V302 adds:

```js
window.gridlyActiveRouteContextArchitectureAudit?.()
```

The helper returns:

```js
{
  available: true,
  auditOnly: true,
  productionBehaviorChanged: false,
  activeRouteContextModel,
  currentDetectedRouteContext,
  supportedRouteContextTypes,
  destinationRoutesObservable,
  savedRoutesObservable,
  routeWatchMonitoringSeparate,
  geometryObservationAllowed,
  productionScoringAllowed: false,
  ownershipDriftReducedBy,
  remainingOwnershipDrift,
  recommendedImplementationSequence,
  safeForProductionWiring: false
}
```

## Safety boundaries

The active route context architecture is explicitly read-only:

- It must not change routing.
- It must not change Route Watch recommendations.
- It must not change alert relevance.
- It must not promote destination routes into saved Route Watch.
- It must not write to Supabase.
- It must not change UI.
- It must not change alerts, popups, markers, reporting, awareness, notifications, desktop, PWA, store, or directional-display behavior.
- It must not change geometry scoring.

## Implementation sequence

1. **V302:** document the read-only active route context model and expose the architecture audit helper.
2. **V303 A:** implement a read-only active route context audit bridge that returns normalized context from existing route state.
3. Validate that bridge output remains audit-only and `safeForProductionWiring: false`.
4. Only after bridge validation, consider extending geometry shadow observation to active route context.
5. Plan Route Watch monitoring alignment separately after ownership and observation audits stabilize.

## What remains unresolved

- Destination route geometry is still not a production input to Route Watch scoring.
- Monitoring activation for searched destination routes remains separate from route preview.
- Route Watch relevance still follows existing production relevance paths.
- The code still has separate destination preview and Route Watch route layers/state.
- There is no production active-route owner yet.

## V303 recommendation options

### A) Implement read-only active route context audit bridge

Default recommendation. This is the conservative next step because it adds normalized audit visibility without changing behavior.

### B) Extend geometry shadow observation to active route context

Only choose this if the V302/V303 bridge proves observation is safe without behavior changes.

### C) Route Watch monitoring alignment plan

Useful later, but not first because monitoring alignment has higher production-behavior risk.

### D) Pause Route Watch ownership work

Safe but leaves ownership drift unresolved.

## V303 recommendation

Choose **A) Implement read-only active route context audit bridge**. It is conservative, actionable, and keeps production routing, UI, scoring, Route Watch recommendations, alert relevance, and storage unchanged.
