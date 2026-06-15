# V345 — Restore V322 Road-Hazard Location Ownership

## Goal

V345 restores the validated V322.2 / V322.5 behavior that one road hazard has one authoritative rendered location identity across alert, popup, awareness, and detail surfaces.

This is a regression fix only. It does not introduce a new location ownership system, bridge architecture, recursive ownership lookup, alert snapshot mutation, schema changes, Route Watch changes, crossing changes, marker redesign, or reporting UX changes.

## Root Cause

The regression occurred upstream of alert wording. During road-hazard shaping, coordinate-based corridor resolver output could win before the submitted / normalized road-hazard location fields. For a flooding report whose submitted identity was FM 1960 / 2 Miles West of Dayton, that allowed the fallback resolver context to surface as `US 90 at Waco Street` in active incident and downstream awareness / alert diagnostics.

## Restored Ownership Order

Road-hazard location identity now follows the V322 ownership order:

1. Existing authoritative rendered road-hazard location identity.
2. Existing stable V322.2 / V322.5 location label.
3. Normalized report location fields preserved from submission.
4. Resolver fallback only as a last resort.

## Trace Points

`window.gridlyRoadHazardLocationOwnershipRegressionAudit?.()` traces:

- submitted report
- normalized report
- active hazard
- active incident
- awareness headline
- alert diagnostic row

The audit reports whether FM 1960 identity was found and preserved, whether `US 90 at Waco Street` fallback text was detected or used, and the stage where identity loss appears.

## Validation Contract

For a flooding report on FM 1960 / 2 Miles West of Dayton:

- Awareness should show `Flooding on FM 1960` and `2 Miles West of Dayton` context.
- Alert should show the same FM 1960-owned identity.
- `US 90 at Waco Street` must not appear unless that is the actual incident location.

Expected audit highlights:

```js
{
  available: true,
  policyVersion: "V345",
  fm1960IdentityFound: true,
  fm1960IdentityPreserved: true,
  fallbackLocationUsed: false,
  locationConsistencyPass: true,
  v3222Preserved: true,
  v3225Preserved: true,
  v341Preserved: true,
  v343Preserved: true
}
```
