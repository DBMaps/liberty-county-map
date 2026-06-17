# Gridly V411 — Historical Storage Deployment Authorization

## Scope

V411 is a documentation-only final authorization review for deployment of the dormant historical storage schema created in V410. It does **not** deploy the schema, execute migrations, enable the writer, enable capture, add reads, expose UI, or activate production historical evidence collection.

Core rule: **Capture Everything. Show Nothing. Depend On Nothing.**

## Reviewed Artifacts

- Forward migration: `supabase/migrations/202606170410_history_capture_storage.sql`
- Rollback migration: `supabase/migrations/202606170411_rollback_history_capture_storage.sql`

## Current Authorization State

| Area | State |
| --- | --- |
| Hooks installed | Yes |
| Storage artifacts | Yes |
| Writer implemented | Yes |
| Monitoring implemented | Yes |
| Rollback artifacts | Yes |
| Capture enabled | No |
| Writer enabled | No |
| Historical writes | No |
| Historical reads | No |
| History UI | No |
| Production activation | No |

## 1. Migration Review

### Findings

| Review area | Finding |
| --- | --- |
| Schema ownership | The migration creates a dedicated `history_capture` schema. It does not create or alter production schemas, report tables, alert tables, awareness tables, marker data, Route Watch state, or DriveTexas state. Ownership remains with the migration-executing Supabase role; no app-facing ownership transfer or grants are introduced. |
| Append-only design | `history_capture.historical_events` is shaped as an immutable event ledger with UUID primary key, unique `idempotency_key`, event metadata, envelope JSON, payload JSON, received timestamp, and observed timestamp. The migration does not add update/delete functions, upsert helpers, triggers, or production mutation paths. Physical append-only enforcement is not hardened with trigger-level update/delete prevention, so operational discipline and RLS/service-role boundaries remain required. |
| Non-authoritative design | The tables are isolated under `history_capture` and no production read path is added. The migration does not feed `loadSharedReports()`, live incident arrays, alerts, awareness, markers, Route Watch, DriveTexas, or UI. Stored events remain evidence only, not a source of truth. |
| Retention metadata | `historical_events.retained_until` is generated from `received_at + interval '18 months'`. `retention_runs` records target interval, status, count, timestamps, and detail JSON. This provides retention metadata without executing retention work. |
| Indexing strategy | Indexes cover event-type/time lookup, optional source report lookup, retention cutoff scanning, and writer-monitoring time ordering. This is appropriate for dormant schema deployment and future maintenance access. |
| RLS posture | RLS is enabled on all three tables and no broad app policies are created. This is a restrictive dormant posture for anon/authenticated clients. The service role/migration owner remains capable, which is expected for future controlled writer use but must remain disabled until separately approved. |
| Isolation from production systems | The migration creates only `history_capture` schema objects and comments. It does not reference production tables, functions, views, app JS, CSS, HTML, report workflows, alert workflows, awareness workflows, marker rendering, Route Watch, or DriveTexas. |

### Classification

**Ready With Conditions**

The forward migration is acceptable for dormant schema deployment because it is isolated, non-authoritative, RLS-restricted, indexed for expected maintenance paths, and carries retention metadata. Conditions are required because append-only behavior is a design posture rather than database-trigger-enforced immutability, and because deployment must not be confused with writer/capture activation.

## 2. Rollback Review

### Findings

| Review area | Finding |
| --- | --- |
| Rollback scope limited to V410 artifacts | The rollback drops `history_capture.retention_runs`, `history_capture.writer_monitoring_events`, `history_capture.historical_events`, and then `history_capture`. |
| No protected-system impact | The rollback does not reference or alter production reports, active hazards, unified incidents, alerts, awareness, markers, Route Watch, or DriveTexas. |
| No report-table impact | No report table, report function, shared report loader, or incident table is referenced. |
| No alert impact | No alert table, alert function, alert state, or UI alert path is referenced. |
| No awareness impact | No awareness table, awareness state, or awareness presentation path is referenced. |

### Classification

**Ready**

The rollback is narrow and limited to the V410 history schema artifacts. The primary operational caution is that it is destructive to historical storage if used after future data collection, but V411 does not authorize evidence collection.

## 3. Protected-System Review

Deployment of the reviewed schema artifacts does not alter the protected systems below because the migrations only create or drop `history_capture` schema objects and do not modify app files or production Supabase objects.

| Protected system | Deployment impact | Risk |
| --- | --- | --- |
| `loadSharedReports()` | No code or database dependency added. | None |
| `activeHazards` | No mutation, read, subscription, or dependency added. | None |
| `getLiveHazardIncidents()` | No code or query path changed. | None |
| `unifiedRoadIncidents` | No code or data source changed. | None |
| `activeUnifiedIncidents` | No code or data source changed. | None |
| Alerts | No alert table, state, rendering, or trigger changed. | None |
| Awareness | No awareness table, state, rendering, or trigger changed. | None |
| Markers | No marker source, rendering, clustering, or styling changed. | None |
| Route Watch | No route state, scoring, monitoring, or UI changed. | None |
| DriveTexas | No polling, ingestion, parsing, or state changed. | None |

### Protected-System Risk Classification

**None**

## 4. Supabase Risk Review

| Risk area | Assessment | Risk |
| --- | --- | --- |
| Schema creation risk | Dedicated schema creation is low-risk and isolated. Main risk is migration-role ownership and ensuring no unintended grants are introduced outside the artifact. | Low |
| Index creation risk | Indexes are created on empty/new dormant tables, so lock and duration risk should be low. | Low |
| RLS risk | RLS is enabled without broad client policies, which is safer than permissive access. Future writer access must use a separately approved service path. | Low |
| Storage growth risk | No growth occurs until capture and writer are enabled. The 18-month retention metadata prepares for later lifecycle work but does not enforce deletion by itself. | Low now; Moderate after future capture enablement |
| Operational risk | The main operational risk is accidentally treating schema deployment as production activation. Strict feature-state controls keep this low. | Low with conditions |

### Supabase Risk Classification

**Low** for dormant schema deployment under the required conditions.

## 5. Beta Readiness Review

Deploying dormant historical storage before beta **improves readiness** if and only if it remains invisible and inactive.

Rationale:

- It allows the database footprint to be validated before user-visible or production evidence-collection milestones.
- It separates schema risk from later writer/capture activation risk.
- It improves rollback preparedness by proving the forward and rollback artifacts are paired before data collection exists.
- It has neutral user impact because there are no reads, no UI, no historical writes, and no protected-system dependencies.
- It does not create meaningful beta risk unless operators accidentally enable capture, writer, reads, or UI in the same milestone.

## 6. Deployment Decision Matrix

| Area | Readiness | Risk | Recommendation | Notes |
| --- | --- | --- | --- | --- |
| Schema | Ready With Conditions | Low | Authorize dormant deployment only | Dedicated `history_capture` schema; no production schema changes. |
| Tables | Ready With Conditions | Low | Authorize dormant deployment only | Event, writer-monitoring, and retention bookkeeping tables are isolated. Append-only intent is clear, though not trigger-hardened. |
| Indexes | Ready | Low | Authorize | Appropriate for future event-type/time, source-report, retention, and monitoring queries. New empty tables keep deployment risk low. |
| RLS | Ready | Low | Authorize | RLS enabled and no permissive app policies added. Writer access remains separately blocked. |
| Rollback | Ready | Low | Authorize | Drops only V410 `history_capture` artifacts. Destructive only to future history data, which V411 does not permit collecting. |
| Monitoring assumptions | Ready With Conditions | Low | Authorize dormant storage only | Monitoring table exists, but monitoring writes and operational dashboards must remain disabled until separately approved. |

## 7. Final Authorization Decision

**B. Authorized With Conditions**

Gridly may authorize the next milestone to deploy the V410 dormant historical storage schema because the reviewed migration artifacts are isolated, non-authoritative, restrictive by default, and rollback-scoped to the new history schema. Authorization is limited to schema deployment only. It does not authorize evidence collection, writer operation, capture hooks, historical reads, history UI, lifecycle adapters, production activation, DriveTexas work, or any protected-system integration.

The decision is conditional because:

1. Append-only behavior is represented by schema shape and operational discipline, not trigger-level update/delete prevention.
2. Retention metadata exists, but retention execution/lifecycle automation is not part of this authorization.
3. RLS is restrictive for clients, but any service-role writer path must remain disabled until a later milestone explicitly authorizes it.
4. Schema deployment must be performed as a standalone migration milestone with no JS, UI, report, alert, awareness, marker, Route Watch, or DriveTexas changes.

## 8. Required Conditions

If deployed in V412, all of the following must remain true after deployment:

- `capture_enabled = false`
- `writer_enabled = false`
- `historical_reads = false`
- `history_ui = false`
- No evidence collection may begin.
- No historical writes may occur.
- No production systems may depend on the history schema.
- No protected-system code may be changed as part of deployment.
- No app UI may expose history state.
- No lifecycle/retention deletion job may run.

## 9. Explicit Non-Approvals

V411 does **not** authorize:

- Writer enablement
- Capture enablement
- Historical writes
- Historical reads
- History UI
- Production activation
- Lifecycle adapter
- `report_updated` capture
- Incident transition capture
- DriveTexas work
- Alert changes
- Awareness changes
- Marker changes
- Route Watch changes
- `loadSharedReports()` changes
- `activeHazards` changes
- `getLiveHazardIncidents()` changes
- `unifiedRoadIncidents` changes
- `activeUnifiedIncidents` changes

## 10. Recommended Next Milestone

**V412 — Historical Storage Migration Deployment**

Purpose: apply the reviewed V410 migration artifacts only.

V412 must still keep:

- Capture disabled
- Writer disabled
- Reads disabled
- UI disabled

## Deployment Recommendation

**Authorize V412 schema deployment with conditions.**

The deployment should be limited to applying `supabase/migrations/202606170410_history_capture_storage.sql` and retaining `supabase/migrations/202606170411_rollback_history_capture_storage.sql` as the paired rollback artifact. No app, UI, protected-system, writer, capture, or read work should be included.

## Confirmation No Deployment Occurred In V411

V411 performed a documentation-only review. No migration command was executed, no Supabase schema was deployed, no writer was enabled, no capture was enabled, and no app/UI file was changed by this milestone.
