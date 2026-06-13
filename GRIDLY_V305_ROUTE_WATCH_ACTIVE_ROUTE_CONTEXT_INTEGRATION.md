# GRIDLY V305 — Route Watch Active Route Context Integration

## Summary

V305 integrates Route Watch monitoring diagnostics, route relevance shadow observation, and ownership validation with the V304 `getActiveRouteContext()` provider. The implementation is production-facing but intentionally read-only: it does not redesign UI, change route generation, alter Route Watch activation, promote geometry scoring, change recommendations, modify alerts, write Supabase state, change awareness behavior, or alter directional display.

## Integration points

### Active Route Context as shared ownership source

Route ownership classification now flows through the shared Active Route Context provider for Route Watch diagnostic consumers. The integration adds a small normalization bridge that maps `activeRouteContext.routeContextType` into the ownership labels used by Route Watch debug, readiness, and runtime shadow observation.

Recognized context types include:

- `searched_destination_route`
- `saved_destination_route`
- `home_destination_route`
- `work_destination_route`
- `route_watch_monitored_route`
- `cleared_route`
- `no_active_route`

### Route Watch monitoring/readiness

`gridlyRouteWatchFunctionalReadinessAudit()` now includes the current Active Route Context snapshot and reports `sharedOwnershipSource: "getActiveRouteContext"`. Its `activeRouteOwnershipState` is derived from the shared provider when an active context is available, while the existing readiness checks and blocking/recommendation rules remain unchanged.

### Route Watch debug

`window.gridlyRouteWatchDebug?.()` now includes:

- `activeRouteContext`
- `sharedOwnershipSource: "getActiveRouteContext"`
- `routeOwnershipState` derived from the shared provider

All existing Route Watch debug fields remain available for triage.

### Route relevance runtime shadow observation

The Route Watch relevance helper still preserves existing behavior: it returns `false` unless Route Watch is active and it still uses the existing midpoint route relevance result as the production decision. V305 only passes the Active Route Context snapshot into the V296 runtime shadow recorder so shadow candidates can be classified by the shared ownership model.

The V296 runtime shadow audit now records and summarizes:

- `activeRouteContextType`
- `activeRouteHasGeometry`
- `activeRouteVertexCount`
- searched destination route candidates
- saved destination route candidates
- Route Watch monitored route candidates

This remains audit-only and does not feed production scoring.

### Destination-vs-Route-Watch observation

`gridlyDestinationVsRouteWatchGeometryObservationAudit()` now also reports the Active Route Context snapshot and shared ownership source so its route ownership state is consistent with debug, readiness, and runtime shadow observation.

## Behavior preserved

V305 preserves the current user experience and runtime behavior:

- Search Destination workflow remains unchanged.
- Home routing remains unchanged.
- Work routing remains unchanged.
- Saved places remain unchanged.
- Destination routing remains unchanged.
- Route Watch UI remains unchanged.
- Route recommendations remain unchanged.
- Route relevance production decisions remain unchanged.
- Geometry shadow scoring remains audit-only.
- Alerts, awareness, Supabase, and directional display remain unchanged.

## Ownership improvements

Before V305, Route Watch debug/readiness/runtime observation could independently infer ownership from Route Watch flags, selected controls, destination preview state, and route layer state. V305 reduces that drift by routing ownership classification through `getActiveRouteContext()` for the production-facing observation surfaces requested in this milestone.

The provider remains read-only. Route Watch still owns monitoring lifecycle writes, Search Destination still owns destination route preview creation, and V296 runtime shadow observation still does not change production decisions.

## Runtime validation results

Static validation completed in this implementation pass:

- `node --check js/app.js` passed.
- `node --check js/gridlyRouteWatchGeometryRuntimeShadowAudit.js` passed.

Runtime browser validation should verify these helpers report matching ownership/context fields for searched destinations, saved destinations, and monitored Route Watch routes:

```js
window.gridlyGetActiveRouteContext?.()
window.gridlyRouteWatchDebug?.()
window.gridlyRouteWatchFunctionalReadinessAudit?.()
window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()
```

Expected consistency checks:

- `gridlyRouteWatchDebug().activeRouteContext.routeContextType` should match `gridlyGetActiveRouteContext().routeContextType`.
- `gridlyRouteWatchFunctionalReadinessAudit().activeRouteContext.routeContextType` should match `gridlyGetActiveRouteContext().routeContextType`.
- `gridlyRouteWatchGeometryRuntimeShadowAudit().activeRouteContext.routeContextType` should match `gridlyGetActiveRouteContext().routeContextType` when the provider is available.
- Runtime shadow candidates should expose `activeRouteContextType`, `activeRouteHasGeometry`, and `activeRouteVertexCount` without changing the production midpoint relevance result.

## Remaining gaps

- Active Route Context is now the shared read path for the requested Route Watch observation surfaces, but it is still not a writer or event bus.
- Destination route geometry is observable context, not promoted production Route Watch scoring input.
- Route Watch activation remains explicit; searched destination routes are not silently converted into saved Route Watch routes.
- Full browser/manual validation is still needed across live searched destination, saved destination, Home, Work, and monitored Route Watch states.
