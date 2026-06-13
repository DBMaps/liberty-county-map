# Gridly V297 — Destination Route vs Route Watch Geometry Observation Audit

Scope: audit/documentation only. V297 adds a runtime inspection helper that compares the destination-search route preview path with the saved Route Watch path, but it does not change routing, Route Watch activation, relevance decisions, UI, alerts, popups, markers, reporting, Supabase, awareness, notifications, or directional display.

## Runtime Helper

V297 exposes:

```js
window.gridlyDestinationVsRouteWatchGeometryObservationAudit?.()
```

The helper reports whether the browser currently has evidence for destination-search route geometry, saved Route Watch route geometry, and V296 shadow observations. It is intentionally conservative:

- `auditOnly: true`
- `productionBehaviorChanged: false`
- `safeForProductionWiring: false`
- no production route relevance consumer reads from this helper
- no destination route preview consumer reads from this helper

## Findings

1. **Saved Route Watch and destination-search route preview have separate route ownership paths.**
   - Saved Route Watch routes are started from saved-place selections and render through the Route Watch route preview renderer.
   - Destination-search routes render from the search destination preview state into a separate destination preview layer.
2. **The two paths share a route geometry fetch helper but not the full render/ownership path.**
   - Both paths can use OSRM GeoJSON geometry through the road route preview fetch helper.
   - Route Watch then renders into its own route preview layer and stores Route Watch-specific geometry counters/source state.
   - Destination search stores geometry on `window.GridlyDestinationRoutePreview` and draws into `destinationRoutePreviewLayer`.
3. **Route relevance is Route Watch-specific.**
   - Route Watch relevance evaluates incidents only while Route Watch is activated.
   - V296 records geometry shadow candidates from that Route Watch relevance path.
   - Destination-search route preview does not call the V296 candidate recorder.
4. **A searched Walmart-style destination route can have valid preview geometry while V296 remains empty.**
   - If a Walmart-style search creates a ready destination preview but Route Watch is not active, V296 can still report `evaluatedCandidates: 0`, `routeWatchActive: false`, and Route Watch geometry state from the previous saved selector route.
5. **The observed V296 output is therefore consistent with separate systems, not necessarily OSRM failure for the destination route.**
   - `osrmRouteSuccess: false`, `routeGeometrySource: "fallback"`, and `routePolylineVertexCount: 0` describe the saved Route Watch path/state, not necessarily the destination preview path.

## Route Ownership Model

| System | Owner | Route state | Render layer | Geometry source | Relevance path | V296 visibility |
| --- | --- | --- | --- | --- | --- | --- |
| Saved Route Watch | Saved-place Route Watch selector/start flow | Route Watch globals such as selected route id, activation, render audit, route polyline counts | Route Watch preview layer / saved route layer path | OSRM via shared fetch helper or fallback line | `getRouteHazardAssessment()` and `isIncidentRouteRelevant()` | Yes, when activated and incident relevance evaluation runs |
| Destination-search route preview | Destination search selection/preview flow | `window.GridlyDestinationRoutePreview` | `destinationRoutePreviewLayer` | OSRM via shared fetch helper | Destination route impact/cache helpers, not Route Watch relevance | No, unless a future audit-only destination recorder is added |
| Shared geometry helper | Routing utility | Returned route preview data | Caller-owned | OSRM GeoJSON geometry converted to lat/lng arrays | None by itself | Indirect only |

## Destination Route vs Route Watch Comparison

### Destination-search route preview

- Initiated by destination search selection.
- Builds a preview route from the selected destination and resolved origin.
- Stores the preview geometry on the destination preview state object.
- Draws a separate halo/shoulder/core preview into the destination route preview layer.
- Can succeed independently of Route Watch activation.
- Does not mark Route Watch active.
- Does not write Route Watch selector/debug state.
- Does not call the V296 Route Watch candidate recorder.

### Saved Home → Work Route Watch route

- Initiated by saved Route Watch controls using saved places such as Home and Work.
- Writes Route Watch active/selected route state when activated.
- Renders the route through Route Watch route preview rendering.
- Uses Route Watch route geometry for hazard assessment and incident relevance.
- Calls V296 only when the Route Watch relevance path evaluates candidates.

## Should Geometry Shadow Scoring Observe One or Both Paths?

Geometry shadow scoring should **not** assume one route path represents the other.

A conservative architecture is:

1. Keep Route Watch shadow observation focused on saved Route Watch route relevance.
2. Add a separate destination-route observation channel only if V298 needs to audit search preview geometry and destination-route impact behavior.
3. Do not merge destination route preview behavior with saved Route Watch behavior unless additional evidence proves they are semantically identical.
4. Keep all scoring audit-only until disagreement rates, performance, and retained-geometry coverage are well understood.

## Risks of Conflating the Systems

- **False confidence:** A destination preview can have OSRM geometry while saved Route Watch has no active route; treating destination geometry as Route Watch geometry could hide a Route Watch activation problem.
- **Incorrect relevance decisions:** Destination search previews are ad hoc user intent, while saved Route Watch is a monitoring mode. Relevance thresholds and candidate timing may differ.
- **Debug confusion:** Route Watch debug can correctly show Home → Work state while a Walmart destination preview is active, because they are different owners.
- **Unintended production behavior:** Sharing state or recorders too early could cause Route Watch alerts, notifications, or marker emphasis to react to transient destination searches.
- **Layer ownership regressions:** Destination preview layers and Route Watch layers are separate; merging observation without clear ownership may lead to stale or double-counted geometry.

## V297 Audit Output

The V297 helper reports these top-level fields:

- `available`
- `auditOnly`
- `productionBehaviorChanged`
- `safeForProductionWiring`
- `routeWatchPathDetected`
- `destinationRoutePathDetected`
- `sharedGeometryHelpersDetected`
- `sharedRelevanceHelpersDetected`
- `destinationRouteHasGeometry`
- `destinationRouteVertexCount`
- `routeWatchHasGeometry`
- `routeWatchVertexCount`
- `destinationRouteObservedByV296`
- `routeWatchObservedByV296`
- `observationGapDetected`
- `observationGapReason`
- `recommendedObservationArchitecture`

It also includes nested checks for:

- searched destination route / Walmart-style search evidence
- saved Home → Work Route Watch route evidence
- active route preview layer state
- OSRM success/fallback state
- route polyline availability
- whether V296 appears to observe only one path

## Recommendation for V298

Default recommendation: **C) Keep Route Watch and destination route observation separate**, with an optional audit-only extension.

Recommended V298 sequencing:

1. **C) Keep Route Watch and destination route observation separate.** This prevents transient destination searches from being mistaken for saved monitoring routes.
2. **B) Fix Route Watch activation/geometry first** if V297 shows Route Watch still has no geometry or inactive state after a saved Home → Work Route Watch start.
3. **A) Extend V296 shadow observation to destination routes** only as a separate audit-only recorder/schema, not by reusing Route Watch activation or production relevance state.
4. **D) Continue audit-only mapping** if Route Watch and destination preview evidence remain ambiguous.

Do **not** wire production scoring in V298. Do **not** merge destination routing and Route Watch behavior unless future audit evidence clearly supports it.

## Validation

V297 should continue to pass the existing validation set:

```bash
node --check js/app.js
node --check js/gridlyRouteWatchGeometryRuntimeShadowAudit.js
node scripts/v291-route-watch-geometry-prototype.mjs
node scripts/v292-route-watch-geometry-validation.mjs
node scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs
node scripts/v295-route-watch-geometry-fixture-expansion.mjs
node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs
```
