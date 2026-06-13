# GRIDLY V298 — Route Watch Functional Readiness Audit

## Why this milestone exists

V296 and V297 made the Route Watch geometry investigation more precise, but they also exposed a sequencing risk: geometry scoring can only be meaningful after Route Watch can produce, activate, render, and retain usable route geometry in real runtime conditions. V298 therefore adds an audit-only functional readiness layer. It does not change scoring, rendering, ownership, notifications, markers, reporting, Supabase, awareness, alerts, or directional display behavior.

The new runtime helper is:

```js
window.gridlyRouteWatchFunctionalReadinessAudit?.()
```

Its purpose is to classify the current blocker before any additional geometry scoring work is considered.

## Real-device observation that motivated V298

Recent real-device testing after setting a searched destination route showed that Route Watch geometry was not actually available for observation:

```js
{
  routeWatchActive: false,
  osrmRouteSuccess: false,
  routeGeometrySource: "fallback",
  routePolylineVertexCount: 0,
  routePreviewRendered: false,
  routePreviewLayerExists: false
}
```

That state indicates a functional readiness problem, not a scoring-quality problem. The conservative rule for V298 is: do not recommend more geometry scoring work unless route geometry is present and Route Watch is functional.

## Saved Route Watch readiness model

The saved Route Watch path is audited independently from destination search. The helper reports:

- Selected start and selected destination.
- Whether start and destination coordinates are present.
- Whether Route Watch is active.
- Whether a route preview was requested.
- Whether an OSRM route request was attempted.
- OSRM success or failure.
- OSRM failure reason, when available from existing runtime state.
- Whether fallback route geometry was used.
- Current route geometry source.
- Route polyline vertex count across retained/rendered route sources.
- Whether a route preview layer exists.
- Whether the preview layer, or its route signature group, is on the map.
- Whether the preview is rendered.
- Active route source.
- Monitored route duration.
- Whether route relevance has executed.
- V296 runtime shadow observed candidate count.

The readiness flags are:

- `routeWatchGeometryReady`: true only when usable geometry has at least two vertices and preview/render evidence exists.
- `routeWatchFunctional`: true only when Route Watch is active, both endpoints have coordinates, and Route Watch geometry is ready.

## Searched destination route readiness model

The searched destination route path remains separate from saved Route Watch. The helper reports:

- Last searched destination.
- Whether searched destination coordinates are present.
- Whether destination route preview was requested.
- Destination route geometry source.
- Destination route vertex count.
- Whether the destination route preview layer exists.
- Whether destination route preview rendered.
- Whether destination route is currently treated as Route Watch.
- Whether destination route is intentionally separate from Route Watch.

The readiness flags are:

- `destinationRouteGeometryReady`: true only when the destination route has at least two vertices and its preview rendered.
- `destinationRouteFunctional`: true only when a destination route preview was requested, destination coordinates exist, and destination route geometry is ready.

## Blocker classification

The helper returns these classification fields:

- `routeWatchFunctional`
- `routeWatchGeometryReady`
- `destinationRouteFunctional`
- `destinationRouteGeometryReady`
- `observationReady`
- `blockingReason`
- `recommendedNextAction`

`recommendedNextAction` is constrained to one of:

- `fix_route_watch_activation`
- `fix_osrm_route_generation`
- `fix_route_geometry_retention`
- `fix_route_preview_rendering`
- `separate_destination_observation`
- `proceed_to_runtime_observation`

The classification priority is intentionally conservative:

1. If Route Watch is not active, recommend `fix_route_watch_activation`.
2. If OSRM was attempted, failed, and no usable route geometry exists, recommend `fix_osrm_route_generation`.
3. If Route Watch is active but geometry is missing, recommend `fix_route_geometry_retention`.
4. If geometry exists but preview rendering/layer-on-map evidence is missing, recommend `fix_route_preview_rendering`.
5. If destination route geometry exists separately from Route Watch and V296 has not observed it, recommend `separate_destination_observation`.
6. If Route Watch is functional and geometry is ready, proceed to runtime observation.

## Recommendation for V299

V299 should follow the V298 helper's recommendation instead of starting with scoring changes. If the real-device state remains similar to the observed payload (`routeWatchActive: false`, `osrmRouteSuccess: false`, fallback source, zero vertices, and no rendered preview), the next fix should target activation and route generation/retention before any geometry scoring work resumes.

If saved Route Watch becomes functional but searched destination routes remain separate and unobserved, V299 should add a separate audit-only destination observation path rather than merging destination routes into Route Watch or changing production ownership.
