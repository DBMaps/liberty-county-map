# V348 — Road Hazard Secondary Location Copy Cleanup

## Goal

V348 narrows road-hazard secondary location copy so alert cards do not append weaker resolver fallback context after an authoritative submitted road identity is already available.

## Behavior change

Primary road-hazard identity remains owned by the existing V347/V322 location-preservation flow. V348 only changes the secondary presentation line used by alert card consumer copy.

For road hazards, secondary copy now prefers an authoritative road-hazard identity such as:

- `Reported on FM 1960`
- `Reported on FM 1960 • 1 Mile West of Dayton`

When an authoritative road identity exists, weaker fallback corridor/crossing context such as `US 90 at Waco Street` is not appended to the secondary line.

## Audit helper

Run in the browser console:

```js
window.gridlyRoadHazardSecondaryLocationAudit?.()
```

The audit reports V348 policy status, the primary and secondary copy observed from active road-hazard alert data, whether fallback context was detected and removed, FM 1960 preservation status, and preservation booleans for V322.2, V322.5, V343, and V347.

## Manual validation

With active FM 1960 flooding:

1. Open Alerts.
2. Verify the headline still identifies FM 1960 / 1 Mile West of Dayton.
3. Verify secondary copy reads `Reported on FM 1960` or `Reported on FM 1960 • 1 Mile West of Dayton`.
4. Confirm secondary copy does not show `FM 1960 · US 90 at Waco Street`.
5. Run `window.gridlyRoadHazardSecondaryLocationAudit?.()` and verify `policyVersion: "V348"`, fallback removal, FM 1960 preservation, and preservation booleans are true.
