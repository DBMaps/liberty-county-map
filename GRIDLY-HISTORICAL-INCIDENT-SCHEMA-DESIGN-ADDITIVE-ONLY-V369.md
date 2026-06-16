# V369 — Historical Incident Schema Design, Additive Only

## 1. Executive Summary

V369 designs a future additive schema for historical incident storage only. This milestone is documentation-only and does not approve implementation.

No schema changes, migrations, Supabase changes, historical writes, production reads, production writes, lifecycle changes, UI changes, or application behavior changes are approved by this document.

The design below describes how future historical incident storage could be added beside the existing `reports` evidence model after a separate readiness gate, migration plan, rollback plan, and implementation approval.

## 2. Design Principles

- **Additive only:** Any future historical schema must be added beside existing tables and behavior rather than replacing or rewriting current production data paths.
- **Preserve reports as evidence:** The `reports` table remains the evidence source. Reports should not be collapsed, rewritten, or treated as disposable implementation details.
- **Incidents are user-facing situations:** A historical incident represents a resolved or persisted user-facing situation inferred from one or more reports or projection observations.
- **History stores resolved intelligence:** Historical storage should represent resolved intelligence, lifecycle conclusions, or incident summaries, not the live mutable state used by the current map.
- **Live system remains current source of truth:** Existing live reads, writes, alerts, awareness, markers, Route Watch, and related production behavior remain the current source of truth unless separately changed and approved.
- **No production dependency until future approval:** Historical tables must not become dependencies for production reads, production writes, lifecycle decisions, UI rendering, alerts, awareness, markers, Route Watch, or DriveTexas without a future explicit approval.
- **Rollback must remain simple:** The future schema should be removable or ignorable without requiring changes to existing production queries or report evidence.

## 3. Proposed Future Tables

The following tables are proposed for future consideration only:

1. `historical_incidents`
   - Stores one row per resolved or historical incident candidate.
   - Intended to summarize incident type, status, location, timing, supporting reports, recurrence identity, and model version.

2. `incident_events`
   - Stores event-level history associated with a historical incident.
   - Intended to preserve how a historical incident was observed, confirmed, cleared, expired, or otherwise projected.

3. `incident_recurrence_index` — optional future table
   - Stores aggregated recurrence metadata for repeated incidents by type, area, location, and location bucket.
   - This table is optional and is not approved for implementation by V369.

## 4. `historical_incidents` Table Design

Proposed future fields:

| Field | Proposed purpose |
| --- | --- |
| `id` | Stable unique identifier for the historical incident row. |
| `incident_type` | Broad incident classification, such as road closure, flooding, crash, hazard, fire, police activity, or other future normalized categories. |
| `incident_kind` | More specific subtype or model-derived kind, if available. This can support future distinctions within a broader `incident_type`. |
| `status` | Historical lifecycle status, such as open, resolved, expired, suppressed, or closed. Future implementation should define allowed values before migration. |
| `primary_location_label` | Human-readable primary location label for the incident, derived from evidence or projection output. |
| `area_label` | Broader area, neighborhood, jurisdiction, corridor, or map zone label used for grouping and recurrence analysis. |
| `lat` | Representative latitude for the historical incident. This should not be assumed to be exact evidence location if multiple reports contributed. |
| `lng` | Representative longitude for the historical incident. This should not be assumed to be exact evidence location if multiple reports contributed. |
| `first_observed_at` | Earliest known observation time for the incident based on reports or projection observations. |
| `last_observed_at` | Latest known observation time for the incident before closure, expiration, or suppression. |
| `closed_at` | Time the incident was considered closed, resolved, expired, or otherwise no longer active in historical intelligence. |
| `duration_seconds` | Derived duration between `first_observed_at` and `closed_at`, or another explicitly defined future duration rule. |
| `report_count` | Number of source reports associated with the historical incident. |
| `confirmation_count` | Number of confirmation-type signals associated with the historical incident. |
| `clear_count` | Number of clear-type signals associated with the historical incident. |
| `source_report_ids` | Collection of report identifiers used as evidence for the historical incident. Future implementation must decide whether this is an array, JSON, or a normalized join model. |
| `recurrence_key` | Stable grouping key for identifying repeated incidents in a similar place, type, and context. The key algorithm must be versioned and reviewed before implementation. |
| `created_at` | Time the historical incident row was created. |
| `updated_at` | Time the historical incident row was last updated. |
| `model_version` | Version of the projection or historical derivation model that produced or last updated the row. |

The `historical_incidents` table is intended to store resolved or historical intelligence, not to replace the live `reports` table or current production map behavior.

## 5. `incident_events` Table Design

Proposed future fields:

| Field | Proposed purpose |
| --- | --- |
| `id` | Stable unique identifier for the incident event row. |
| `historical_incident_id` | Reference to the associated `historical_incidents` row. |
| `source_report_id` | Optional reference to the source report that produced or influenced the event. Some projection events may not have a direct source report. |
| `event_type` | Normalized event type describing what happened in the historical incident timeline. |
| `event_time` | Time the event occurred or was observed. |
| `event_source` | Origin of the event, such as report evidence, shadow projection, expiry logic, suppression logic, or future approved pipeline component. |
| `lat` | Event-level latitude, when available. |
| `lng` | Event-level longitude, when available. |
| `location_label` | Event-level human-readable location label, when available. |
| `device_hash` | Optional privacy-preserving device hash or actor grouping signal, if already permitted by future policy and security review. |
| `created_at` | Time the event row was created. |
| `model_version` | Version of the projection or historical derivation model that produced the event. |

Potential future `event_type` values include:

- `reported`
- `confirmed`
- `cleared`
- `expired`
- `suppressed_rehydration`
- `projection_observed`

The `incident_events` table is intended to preserve the timeline and evidence-derived transitions for a historical incident. It should not become a production lifecycle dependency without future explicit approval.

## 6. Optional `incident_recurrence_index` Design

The `incident_recurrence_index` table is optional and is not approved for implementation by V369.

Proposed future fields:

| Field | Proposed purpose |
| --- | --- |
| `id` | Stable unique identifier for the recurrence index row. |
| `recurrence_key` | Stable grouping key shared by related historical incidents. |
| `incident_type` | Broad incident classification used by the recurrence grouping. |
| `area_label` | Broader area, neighborhood, jurisdiction, corridor, or map zone label used for recurrence grouping. |
| `primary_location_label` | Representative human-readable location label for the recurring pattern. |
| `lat_bucket` | Bucketed latitude value used for stable approximate spatial grouping. |
| `lng_bucket` | Bucketed longitude value used for stable approximate spatial grouping. |
| `incident_count` | Number of historical incidents associated with the recurrence key. |
| `average_duration_seconds` | Average resolved duration for incidents in the recurrence group. |
| `last_seen_at` | Most recent time an incident in the recurrence group was observed or closed, depending on future definition. |
| `created_at` | Time the recurrence index row was created. |
| `updated_at` | Time the recurrence index row was last updated. |
| `model_version` | Version of the recurrence model or derivation logic used to produce the row. |

This optional table should only be considered after recurrence key stability, privacy implications, aggregation rules, and rollback behavior are reviewed.

## 7. Additive Migration Philosophy

Future schema may be added beside `reports` without changing current production behavior.

The `reports` table must not be rewritten, destructively migrated, or repurposed as part of historical schema implementation. Existing production queries must not be changed merely because historical tables exist.

Historical tables must not become production dependencies until separately approved through a future milestone. A future migration should be additive, independently reversible, and safe to ignore by existing runtime code.

## 8. No Backfill Requirement

Current data is test-generated. Historical preservation of current rows is not required for this design.

Future implementation may start fresh. Backfill is optional and should not block architecture, schema readiness, or future additive rollout planning.

If backfill is considered later, it should require a separate decision covering data quality, test data cleanup, deduplication, privacy, and verification that fake test history is not confused with real historical intelligence.

## 9. Relationship To Shadow Projection

The V364–V367 shadow historical projection work can inform future `historical_incidents` rows by producing candidate incident summaries, event transitions, and lifecycle observations.

The existing shadow projection does not currently write historical data. It remains isolated from production writes and is not a production dependency.

Any future write path from shadow projection into historical tables must be separately approved, designed, tested, and reviewed before implementation.

## 10. Future Write Path Concept

Design-only future concept:

```text
report evidence
↓
shadow projection
↓
historical incident candidate
↓
future historical write
```

This write path is not implemented by V369.

This write path is not approved by V369.

A future implementation would require a separate milestone covering schema migration, write-path dry run, safety gates, RLS/security review, rollback behavior, browser audit implications, and production isolation validation.

## 11. Future Read Path Concept

Design-only future concept:

```text
historical tables
↓
future historical intelligence surfaces
```

This read path is not implemented by V369.

This read path is not approved by V369.

Future historical intelligence surfaces could include analytics, admin review, recurrence summaries, or user-facing history features only after separate approval.

## 12. Validation Requirements Before Implementation

Before any schema implementation, the following validation must be completed:

- Schema review.
- Supabase migration plan.
- Rollback plan.
- No-production-read validation.
- Write-path dry run.
- RLS/security review.
- Browser audit plan.
- Test data cleanup decision.

These requirements are prerequisites for a future implementation milestone and are not satisfied merely by this design document.

## 13. Risks

- **Accidental production dependency:** Runtime code could begin relying on historical tables before approval.
- **Lifecycle coupling:** Historical status could accidentally influence live incident lifecycle behavior.
- **Duplicate history records:** Projection or write-path retries could create multiple rows for the same incident without idempotency controls.
- **Recurrence key instability:** Weak recurrence keys could split related incidents or merge unrelated incidents.
- **Premature UI usage:** UI could expose unvalidated historical intelligence before schema, privacy, and data quality reviews are complete.
- **Confusing fake test history with real history:** Existing test-generated data could be misinterpreted as real historical intelligence if backfilled without cleanup decisions.

## 14. Explicit Non-Approvals

V369 does **not** approve:

- Supabase schema changes.
- Migrations.
- Historical writes.
- Historical reads.
- History UI.
- Production read changes.
- Production write changes.
- Lifecycle changes.
- DriveTexas activation.

## 15. Recommended Next Milestone

Recommended next milestone:

**V370 — Historical Schema Implementation Readiness Gate**

V370 should remain a readiness gate unless a later milestone separately approves implementation. No implementation should occur merely because this design exists.
