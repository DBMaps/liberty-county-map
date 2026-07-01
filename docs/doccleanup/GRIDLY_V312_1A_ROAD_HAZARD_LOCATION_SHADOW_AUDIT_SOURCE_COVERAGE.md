# Gridly V312.1A — Road Hazard Location Shadow Audit Source Coverage Fix

V312.1A keeps `window.gridlyRoadHazardLocationShadowAudit?.()` as a shadow-mode, audit-only helper while fixing the runtime source coverage gap observed when visible app hazards existed but the audit returned zero rows.

## Source collection update

The shadow audit now follows the same active road-hazard ownership used by the visible app:

1. `getLiveHazardIncidents()` generated road incidents, matching `window.gridlyActiveIncidentAudit?.()` and the road incident model used to build unified incidents.
2. Active `road-*` unified incident rows from `getUnifiedIncidents()`, matching visible alert and marker rendering when the generated incident source is unavailable.
3. Lifecycle-filtered `activeHazards` as a fallback.
4. Latest alert rows only as a final diagnostic fallback.

Crossing and rail rows remain excluded from the audit. The helper does not change production wording, alert cards, awareness text, marker placement, route logic, crossing naming, FRA data, Supabase sync, or data models.

## New diagnostics

The audit output now includes:

- `sourceUsed`
- `sourceCounts`
- `roadHazardRowsBeforeFiltering`
- `roadHazardRowsAfterFiltering`
- `excludedCrossingRows`
- `emptySourceWarning`

`emptySourceWarning` is populated only when active app road-hazard sources are detected but the shadow audit still produces no rows after filtering.

## Validation

Run the existing manual validation helpers with visible road hazards active:

```js
window.gridlyRoadHazardLocationShadowAudit?.()
window.gridlyActiveIncidentAudit?.()
window.gridlyAlertDataDiagnostic?.()
window.gridlyReferenceRoadEvidenceAudit?.()
```

Expected behavior: `activeRoadHazardCount` tracks the visible active road-hazard count reasonably, `rows` includes active road hazards, crossings remain excluded, and Waco/Sawmill diagnostics continue to populate when applicable.
