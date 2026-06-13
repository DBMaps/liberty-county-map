# GRIDLY V304 — Shared Active Route Context Provider

## Why this provider exists

V304 adds the first implementation step for the route-ownership alignment work: a shared, read-only Active Route Context provider. The provider gives diagnostics and future consumers one normalized way to describe the currently observable route context without changing routing, monitoring, recommendations, alert relevance, scoring, awareness, Supabase writes, or UI behavior.

The provider exists because prior audits found multiple systems independently inferring route state from Route Watch flags, destination preview state, route layers, selected saved places, and debug snapshots. V304 centralizes that read path only; it does not create a new source of truth or a writer.

## Relationship to V300–V303

- **V300** established Route Watch as a destination-based experience.
- **V301** documented ownership drift between destination routes, saved Route Watch routes, route intelligence, and debug/audit helpers.
- **V302** defined the Active Route Context architecture and the supported context vocabulary.
- **V303** recommended **Option A**: add a shared read-only getter before migrating any consumers.
- **V304** implements that getter and exposes an audit helper while preserving all existing consumers.

## Provider contract

Internal getter:

```js
getActiveRouteContext()
```

Window exposure:

```js
window.gridlyGetActiveRouteContext?.()
```

The returned model is normalized and read-only:

```js
{
  available: true,
  readOnly: true,
  productionBehaviorChanged: false,

  routeContextAvailable,
  routeContextType,
  routeSource,
  destinationType,
  destinationLabel,

  hasGeometry,
  geometrySource,
  vertexCount,

  routePreviewAvailable,
  monitoringActive,
  relevanceObserved,
  routeWatchEligible,

  ownershipNotes,
  safeForProductionWiring: false
}
```

The provider returns a fresh frozen object. Its fields are descriptive snapshots derived from existing runtime state.

## Supported context types

V304 supports the V302/V303 context vocabulary:

- `no_active_route`
- `searched_destination_route`
- `saved_destination_route`
- `home_destination_route`
- `work_destination_route`
- `route_watch_monitored_route`
- `cleared_route`

## Detection rules

The provider uses existing runtime state only:

- Destination route preview state and selected search destination are read as destination context.
- Saved-place labels and destination metadata are read to classify saved, home, and work destination routes.
- Existing Route Watch activation flags are read to classify monitored Route Watch routes.
- Existing route preview layers, geometry arrays, and route-render snapshots are read to report geometry availability and vertex counts.
- Existing runtime shadow audit availability is read only to report whether relevance observation has occurred.

## Safety boundaries

V304 intentionally does **not**:

- create new route state;
- promote destination routes into saved Route Watch;
- alter Route Watch activation;
- alter destination search routing;
- migrate existing consumers;
- change UI, recommendations, geometry scoring, alert relevance, awareness, directional display, or Supabase writes.

`safeForProductionWiring` remains `false` because V304 is a provider foundation and not a consumer migration.

## Audit helper

V304 adds:

```js
window.gridlyActiveRouteContextProviderAudit?.()
```

The audit returns provider availability, read-only status, the supported context types, the current context snapshot, and explicit safety flags. It is audit-only and reports `mutationDetected: false` and `productionBehaviorChanged: false`.

## Examples

Read the current context:

```js
const context = window.gridlyGetActiveRouteContext?.();
console.log(context?.routeContextType, context?.destinationLabel);
```

Run the provider safety audit:

```js
const audit = window.gridlyActiveRouteContextProviderAudit?.();
console.log(audit?.providerAvailable, audit?.providerReadOnly);
```

Expected safety flags:

```js
context.safeForProductionWiring === false;
audit.safeForProductionWiring === false;
audit.productionBehaviorChanged === false;
```

## Recommendation for V305

Default recommendation:

**V305 — Active Route Context Consumer Migration Plan**

Keep V305 practical and low risk: migrate only debug and audit consumers first. Do not migrate production routing, recommendation, scoring, alert relevance, awareness, or Route Watch activation consumers until the read-only provider has been validated across runtime states.
