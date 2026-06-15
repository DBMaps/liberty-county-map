# V349 — Top Awareness Road-Hazard Location Fragment Cleanup

## Goal

V349 fixes the remaining top Awareness Area copy path where an authoritative road-hazard headline could be followed by a weaker resolver or crossing fallback fragment.

The target regression was:

```text
Flooding on FM 1960
US 90 at Waco Street
```

When the top Awareness primary line already contains the authoritative road identity, the secondary line must not append unrelated fallback crossing context.

## Scope

This patch is intentionally limited to top Awareness road-hazard primary/secondary composition.

It does not change Tap Map payload preservation, alert-card secondary copy, alert snapshots, markers, Route Watch, crossings, Supabase schema, lifecycle rules, DriveTexas work, bridges, or ownership lookups.

## Behavior

For road hazards only, V349 checks the top Awareness secondary line after the primary line has been selected. If the primary line contains an authoritative road identity and the secondary line contains weaker fallback context from a different road or crossing, the secondary fallback fragment is suppressed.

Preferred FM 1960 flooding output remains either:

```text
Flooding on FM 1960
1 Mile West of Dayton
```

or:

```text
Flooding on FM 1960
```

The blocked state is:

```text
Flooding on FM 1960
US 90 at Waco Street
```

## Audit

V349 adds:

```js
window.gridlyTopAwarenessRoadHazardLocationFragmentAudit?.()
```

The audit reports the rendered top Awareness primary and secondary copy, whether the authoritative road identity is present, whether the fallback fragment was detected and removed, whether FM 1960 was preserved, whether the US 90 / Waco fragment remains, preservation flags for prior versions, findings, recommendations, and notes.

## Validation

With an active FM 1960 flooding report:

1. Confirm top Awareness does not show `US 90 at Waco Street` under `Flooding on FM 1960`.
2. Confirm the alert card still says `Reported on FM 1960`.
3. Run `window.gridlyTopAwarenessRoadHazardLocationFragmentAudit?.()`.
4. Confirm `policyVersion: "V349"`, `fallbackFragmentRemoved: true`, `fm1960Preserved: true`, `us90WacoFragmentPresent: false`, and `topAwarenessCopyPass: true`.
