# GRIDLY V299 — Route Watch Activation Fix

## Root cause

V298 correctly found that searched destination routing and saved Route Watch routing use separate ownership paths. The activation gap was in the audit/readiness layer: when a searched destination route had working OSRM geometry but saved Route Watch had not been explicitly started, readiness reported the state as `route_watch_not_active` with `fix_route_watch_activation` as the next action. That made a valid destination-search preview look like a silent broken Route Watch route.

The saved Route Watch start path already attempts OSRM only after valid saved start/destination selections exist. The smaller broken link was therefore state classification and debug reporting, not geometry scoring or destination-route promotion.

## Exact fix

- Kept saved Route Watch activation scoped to explicit Route Watch starts from saved selections.
- Added explicit route ownership classification for:
  - `saved_route_watch_route`
  - `searched_destination_route`
  - `no_active_route`
  - `missing_destination`
  - `route_cleared`
- Updated Route Watch functional readiness so a working searched destination route that is intentionally separate no longer reports `route_watch_not_active` / `fix_route_watch_activation`. It reports `searched_destination_route_is_separate_from_saved_route_watch` and recommends `separate_destination_observation`.
- Updated destination-vs-Route-Watch geometry observation audit to include Route Watch active state, destination active state, route ownership state, and Route Watch layer-group vertex counting.
- Updated Route Watch debug output to expose the current route ownership state and searched-destination route state next to saved Route Watch geometry state.
- Updated the V296 runtime shadow audit to tag recorded candidates with route ownership. Existing Route Watch relevance candidates default to `saved_route_watch_route`, preserving the V296 scope while making ownership explicit.

## Why destination routing remains separate

Destination-search route previews still use the destination preview layer and destination preview state. They are not copied into saved Home/Work selections, do not set saved Route Watch active, and are not silently treated as saved Route Watch geometry. Saved Route Watch still activates only through the Route Watch start path with routable saved start/destination selections.

This preserves the product rule: destination-search routes and saved Route Watch remain separate unless a user explicitly activates Route Watch.

## Validation results

Programmatic validation completed successfully:

- `node --check js/app.js`
- `node --check js/gridlyRouteWatchGeometryRuntimeShadowAudit.js`
- `node scripts/v291-route-watch-geometry-prototype.mjs`
- `node scripts/v292-route-watch-geometry-validation.mjs`
- `node scripts/v294-route-watch-geometry-shadow-scoring-fixtures.mjs`
- `node scripts/v295-route-watch-geometry-fixture-expansion.mjs`
- `node scripts/v296-route-watch-geometry-runtime-shadow-audit.mjs`

## V300 recommendation

Proceed to geometry runtime observation only when all of the following are true:

1. Saved Route Watch is active.
2. Saved Route Watch route geometry exists.
3. `routePolylineVertexCount > 0`.
4. V296 has observed saved Route Watch candidates.

If only a searched destination route is active, keep the next action as separate destination observation. If saved Route Watch selections are missing or inactive, fix that targeted state first instead of wiring geometry scoring.
