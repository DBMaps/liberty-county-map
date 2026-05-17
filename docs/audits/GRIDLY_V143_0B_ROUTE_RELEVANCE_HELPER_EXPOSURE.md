# GRIDLY V143.0b — Route Relevance Audit Helper Exposure

## Issue
Console error observed:

- `window.gridlyRouteRelevanceAudit is not a function`

## Findings from `js/app.js`
Searched for:

- `gridlyRouteRelevanceAudit`
- `routeRelevanceAudit`
- `RouteRelevanceAudit`

Result:

- The helper implementation exists and was directly assigned via `window.gridlyRouteRelevanceAudit = function gridlyRouteRelevanceAudit() { ... }`.
- No alternate helper names were found.
- No duplicate overwrite assignments were found later in the file.
- Exposure risk was mitigated by making the function declaration explicit and attaching it to `window` in a dedicated global assignment.

## Change made
- Converted the helper to a named function declaration:
  - `function gridlyRouteRelevanceAudit() { ... }`
- Added explicit global exposure:
  - `window.gridlyRouteRelevanceAudit = gridlyRouteRelevanceAudit;`
- Added smoke helper:

```js
window.gridlyRouteRelevanceAuditGlobalsCheck = function () {
  return {
    routeRelevanceAudit: typeof window.gridlyRouteRelevanceAudit
  };
};
```

## Validation
- `node --check js/app.js`

## Manual checks
After hard refresh, run:

```js
window.gridlyRouteRelevanceAuditGlobalsCheck()
window.gridlyRouteRelevanceAudit()
```

Expected:

- `routeRelevanceAudit: "function"`
- audit object returned
