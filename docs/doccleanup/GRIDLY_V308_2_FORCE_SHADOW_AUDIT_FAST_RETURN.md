# GRIDLY V308.2 — Force Shadow Audit Fast Return

## Purpose

V308.2 keeps the Route Watch geometry runtime shadow audit browser-safe while Route Details candidate plumbing is being validated. Real-device testing showed that `window.gridlyGetDestinationRouteActiveIncidentCandidates?.()` could return active Route Details candidates, but `window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()` could hang before returning a report.

## Runtime safety behavior

When Route Details candidates are present, `window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()` now returns a safe audit payload immediately and does not attempt overlap scoring.

Expected safety fields:

- `routeDetailsIncidentCount`: Route Details candidate count.
- `activeIncidentCandidates`: active candidate count visible to the audit.
- `scoringSkipped: true`.
- `scoringSkipReason: "scoring_temporarily_disabled_for_runtime_safety"`.
- `productionBehaviorChanged: false`.
- `safeForProductionWiring: false`.

The audit also exposes `browserSafeValidationGuidance` with console commands and expected safety fields so browser validation can confirm the fast-return behavior without entering the heavy geometry path.

## Browser-safe validation guidance

Run these commands in the browser console after opening a destination route that has Route Details candidates:

```js
window.gridlyGetDestinationRouteActiveIncidentCandidates?.()
```

Then run:

```js
window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()
```

Expected result while Route Details candidates are present:

- The audit returns immediately.
- `routeDetailsIncidentCount` matches the Route Details candidate count.
- `activeIncidentCandidates` is greater than zero when active Route Details candidates exist.
- `scoringSkipped` is `true`.
- `scoringSkipReason` is `"scoring_temporarily_disabled_for_runtime_safety"`.
- `scoredIncidentCandidates` and `scoringCount` remain `0`.
- `productionBehaviorChanged` remains `false`.
- `safeForProductionWiring` remains `false`.

Do not proceed to overlap-scoring validation until this fast-return audit behavior is reliable in browser and on phone.
