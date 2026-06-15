# V343 — Road Hazard Clear Suppression Ordering Fix

## Goal

Fix a road-hazard lifecycle regression where an older `hazard_cleared` record could suppress a newer active road-hazard report after refresh.

## Scope

This production bug fix is limited to road-hazard clear suppression ordering. It does not change Route Watch, crossings, Supabase schema, DriveTexas ingestion, official-source architecture, marker design, alert design, awareness design, confirmation rules, V322.6 count protections, V341 awareness reconciliation, or reporting UX.

## Correct Suppression Rule

A clear record may suppress an active road-hazard report only when both conditions are true:

1. The clear record is newer than the active report.
2. The clear record matches the same incident identity under the existing identity matching rules.

Older clears must never suppress newer active reports.

## Applied Hazard Types

The ordering guard applies to all road hazards, including:

- flooding
- crash
- construction
- road_closed
- disabled_vehicle
- downed_power_line
- livestock
- emergency_response
- other_hazard

## Implementation Summary

`gridlyFindRecentClearForRoadHazard()` now checks a suppression decision before returning a matching clear. The decision preserves the existing identity match and adds timestamp ordering: `clearTimestamp > activeReportTimestamp`.

The audit helper `window.gridlyRoadHazardClearSuppressionAudit?.()` reports each matching suppression decision with:

- active report timestamp
- clear timestamp
- active incident identity
- clear incident identity
- whether suppression was allowed
- whether suppression was blocked
- reason

## Validation Expectations

Manual validation should create a flooding report after an older matching flooding clear exists. After refresh, the active flooding report, alert, marker, and active incident should remain active.

Then run:

```js
window.gridlyRoadHazardClearSuppressionAudit?.()
```

Expected key results:

- `suppressionOrderingEnforced: true`
- `olderClearSuppressionBlocked > 0`
- `floodingValidated: true`
- `v3226Preserved: true`
- `v341Preserved: true`

## Preservation Notes

V322.6 is preserved because confirmation records continue to be grouped by active hazard identity for count consistency; no confirmation-count rules were changed.

V341 is preserved because awareness quiet-state reconciliation ownership is unchanged; recently cleared records remain separate from active hazard counts.
