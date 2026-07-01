# V364 — Shadow Historical Pipeline Foundation

## Purpose

V364 introduces the first code-based historical intelligence foundation as a shadow-only system. It provides an internal projection and audits that can observe current live incident inputs without changing any user-visible production behavior.

## Architecture

The protected production ownership chain remains unchanged:

```text
reports
↓
loadSharedReports()
↓
activeHazards
↓
getLiveHazardIncidents()
↓
unifiedRoadIncidents
↓
activeUnifiedIncidents
↓
alerts
awareness
markers
Route Watch
```

The V364 shadow pipeline sits beside that chain. It may observe active hazards, active incident outputs, recent clears, confirmations, and active reports. It does not own, redirect, replace, persist, or control any production consumer.

## Feature Flag Behavior

`GRIDLY_ENABLE_HISTORICAL_PIPELINE` defaults to `false`.

When `false`, the shadow projection is not generated during live report refreshes and production behavior remains unchanged. Audit helpers can still report disabled state and perform read-only parity previews for diagnostics.

When explicitly set to `true`, the app may generate an in-memory shadow historical projection after `loadSharedReports()` refreshes the existing production collections. The flag only enables shadow projection generation; it does not enable production history reads or UI.

V364 intentionally does not create these future flags:

- `GRIDLY_ENABLE_HISTORY_READS`
- `GRIDLY_ENABLE_HISTORY_UI`

## Shadow Boundaries

The V364 historical system may observe:

- active hazards
- live incident outputs
- clear rows already visible to current code
- confirmation-like records already visible to current code

The V364 historical system may not control:

- alerts
- awareness
- markers
- Route Watch
- lifecycle decisions
- production reads
- production writes
- Supabase records

The projection is in-memory only. It is not persisted, written to Supabase, or added to existing report records.

## Audit Usage

Run these helpers from the browser console:

```js
window.gridlyHistoricalProjectionAudit?.()
window.gridlyHistoricalParityAudit?.()
```

`gridlyHistoricalProjectionAudit()` reports whether the feature is enabled, whether a projection is available, projection count, active production incident count, parity status, and confirms the audit is shadow-only.

`gridlyHistoricalParityAudit()` compares the current production incident identity view with the shadow projection identity view. It reports pass/fail, difference counts, projection counts, and a comparison summary without changing production behavior.

## Parity Strategy

Parity is identity-based. The audit compares current production live hazard incident identities against shadow projection incident identities. Differences are reported as diagnostics only and never used to alter alerts, awareness, markers, Route Watch, lifecycle handling, or writes.

## Known Limitations

- The projection exists only in memory for the current page runtime.
- No historical storage table or schema is introduced.
- The parity audit is intentionally conservative and identity-focused.
- Audit output is diagnostic and not a product UI.
- DriveTexas remains paused and unchanged.

## Future Migration Prerequisites

Before any future milestone can promote historical intelligence beyond shadow mode, it must separately approve and validate schema design, write policy, read policy, lifecycle ownership, UI behavior, migration safety, rollback behavior, and production parity gates.

## Required Safety Statement

V364 does **not** approve:

- migrations
- production read changes
- production write changes
- history UI
- schema migration
- DriveTexas activation
