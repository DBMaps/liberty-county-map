# GRIDLY Live/History Implementation Readiness Gate — V363

Milestone: **V363 — Live/History Implementation Readiness Gate**

## 1. Executive Summary

V363 determines whether live/history implementation is safe to plan next. It does **not** begin live/history implementation.

The readiness gate exists to protect production behavior while creating a safe path toward separating live reports from historical intelligence. Current historical data preservation is not a requirement because all existing report and hazard rows should be treated as fake/test-generated artifacts from local testing, phone testing, and post-merge validation.

The critical requirement is preserving current production behavior. Any future work must be architecturally correct, scalable, and reversible without changing what users see or how production reads, writes, alerts, awareness, markers, Route Watch, clearing, hazards, crossings, or DriveTexas behave today.

## 2. Current Status

- Count reconciliation is stable.
- The duplicate road-hazard submit guard was implemented in V356.
- DriveTexas remains paused and non-production.
- The `reports` table is currently overloaded because it acts as the source for active report evidence and implied current situations.
- Existing rows are testing artifacts from local testing, phone testing, and validation after merges. They must not be treated as meaningful production history.
- No live/history implementation has started.

## 3. Product Model

- **Reports = evidence.** Reports are raw user-submitted or system-observed facts that support a situation.
- **Incidents = user-facing situations.** Incidents are the interpreted situations that users need to understand and act on.
- **Live reports / active incidents = what users need now.** Live state is the current operational map, alert, awareness, marker, and Route Watch reality.
- **History = cleared/resolved intelligence.** History is the resolved record of what happened, where it happened, how long it lasted, and how it changed over time.

Clearing should eventually close active state while preserving historical evidence. The future model should allow active state to end without destroying the evidence needed for historical intelligence.

## 4. Minimum Safe Phase 1

The only safe next implementation phase is:

**Shadow Historical Pipeline Foundation**

Allowed future Phase 1 work:

- Feature flags.
- Shadow historical model.
- Historical projection audit.
- Parity audit.
- No-user-impact validation.

Forbidden in Phase 1:

- Production read changes.
- Production write changes.
- Schema migration required by production.
- History UI.
- Alert rewiring.
- Awareness rewiring.
- Marker rewiring.
- Route Watch rewiring.
- Clearing rewiring.
- DriveTexas restart.

## 5. Required Feature Flags

Required future flags:

```text
GRIDLY_ENABLE_HISTORICAL_PIPELINE = false
GRIDLY_ENABLE_HISTORY_READS = false
GRIDLY_ENABLE_HISTORY_UI = false
```

Flag requirements:

- `GRIDLY_ENABLE_HISTORICAL_PIPELINE` may allow shadow/audit-only historical generation when explicitly enabled in a future approved milestone.
- `GRIDLY_ENABLE_HISTORY_READS` must remain `false` until future approval because production consumers must not read historical outputs yet.
- `GRIDLY_ENABLE_HISTORY_UI` must remain `false` until future approval because no history-facing user experience is approved in V363 or Phase 1.

## 6. Rollback Strategy

Mandatory rollback strategy: **single-toggle rollback**.

Turning off `GRIDLY_ENABLE_HISTORICAL_PIPELINE` must fully restore current production behavior.

Rollback must not require:

- Migration rollback.
- Data restore.
- Cleanup scripts.
- Manual Supabase edits.

## 7. Additive Schema Strategy

Any future schema work must be additive only.

Allowed future concepts:

- `historical_incidents` table.
- `incident_events` table.
- `closed_at`.
- `first_observed_at`.
- `last_observed_at`.
- `duration`.
- `report_count`.
- `confirmation_count`.
- `clear_count`.
- `recurrence_key`.

Forbidden:

- Renaming current `reports` fields.
- Deleting current fields.
- Changing active reports meaning.
- Changing current production queries.
- Forcing production consumers to read new tables.

## 8. Production Ownership Chain That Must Remain Untouched

The following production ownership chain is protected:

```text
reports
loadSharedReports()
activeHazards
getLiveHazardIncidents()
unifiedRoadIncidents
activeUnifiedIncidents
alerts
awareness
markers
Route Watch
```

Future historical work may observe this chain during Phase 1, but it must not own, replace, rewire, or become authoritative for any part of this chain.

## 9. Clear Lifecycle Risk

Clearing is the highest-risk area because it affects active state, recently-cleared behavior, expiration, rehydration suppression, and user trust in whether a situation is still current.

Requirements:

- Do not modify clear behavior in V363 or Phase 1.
- Do not modify recently-cleared behavior.
- Do not modify expiration behavior.
- Do not modify rehydration suppression.

Future historical work may observe clear events only.

## 10. Validation Gates

The following gates are required before any implementation can proceed beyond shadow mode:

- **Gate A — Fixture parity using V362 fixtures.** Shadow historical outputs must reconcile with the approved fixture and comparison-key design.
- **Gate B — Count stability.** Existing count reconciliation must remain stable.
- **Gate C — Alert stability.** Existing alerts must remain unchanged.
- **Gate D — Awareness stability.** Existing awareness generation must remain unchanged.
- **Gate E — Marker stability.** Existing marker generation must remain unchanged.
- **Gate F — Route Watch stability.** Existing Route Watch behavior must remain unchanged.
- **Gate G — Clear lifecycle stability.** Clearing, recently-cleared behavior, expiration, and rehydration suppression must remain unchanged.
- **Gate H — Supabase read/write stability.** Current production reads and writes must remain unchanged.
- **Gate I — Rollback verification.** Turning off `GRIDLY_ENABLE_HISTORICAL_PIPELINE` must fully restore current production behavior without migration rollback, data restore, cleanup scripts, or manual Supabase edits.

## 11. Go / No-Go Decision

V363 decision:

- Proceed to V364 only if V364 is shadow-only.
- Do not proceed to migration.
- Do not proceed to production read changes.
- Do not proceed to history UI.

Recommended next milestone if V363 passes:

**V364 — Shadow Historical Pipeline Foundation**

## 12. Final V363 Determination

V363 passes for readiness planning.

Implementation may proceed only as a shadow/audit-only foundation. Migration is not approved. Production read changes are not approved. History UI is not approved. DriveTexas remains paused.
