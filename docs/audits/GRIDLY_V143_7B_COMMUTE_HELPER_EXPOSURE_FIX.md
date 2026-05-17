# GRIDLY V143.7b — Commute Intelligence Helper Exposure Fix

## Issue
`window.gridlyCommuteIntelligenceAudit is not a function`

## Root cause
The helper was defined as a **named function expression** directly on `window`:

- `window.gridlyCommuteIntelligenceAudit = function gridlyCommuteIntelligenceAudit() { ... }`

In this form, `gridlyCommuteIntelligenceAudit` is not reliably available as a standalone binding for explicit re-assignment patterns.

## Fix applied
Converted the helper to a standalone function declaration and then explicitly exposed it on `window`:

- `function gridlyCommuteIntelligenceAudit() { ... }`
- `window.gridlyCommuteIntelligenceAudit = gridlyCommuteIntelligenceAudit;`

This preserves existing commute intelligence behavior while ensuring deterministic global exposure.

## Smoke helper
Confirmed/retained global smoke helper:

```js
window.gridlyCommuteAuditGlobalsCheck = function () {
  return {
    commuteIntelligenceAudit:
      typeof window.gridlyCommuteIntelligenceAudit
  };
};
```

## Validation
- `node --check js/app.js`
- Manual browser checks after hard refresh:
  - `window.gridlyCommuteAuditGlobalsCheck()`
  - `window.gridlyCommuteIntelligenceAudit()`

Expected:

```js
{
  commuteIntelligenceAudit: "function"
}
```
