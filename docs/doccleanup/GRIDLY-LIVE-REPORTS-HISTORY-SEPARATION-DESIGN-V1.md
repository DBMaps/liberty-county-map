# Gridly Live Reports / History Separation Design V1

## 1. Executive Summary

Gridly should separate live operational state from historical intelligence. The current `reports` table acts as the shared container for active reports, hazard evidence, confirmations, cleared records, test/malfunction rows, and long-term intelligence signals. That makes the table useful as a raw event log, but risky as the direct source for active user-facing truth.

The safest future architecture is to keep user-submitted reports as evidence, introduce a durable incident model for user-facing situations, and archive closed incidents into explicit historical intelligence structures. Live UI should eventually read only active incidents or active-report projections, while historical and recurrence features should read from incident history and lifecycle events.

This document is design/audit only. It does not modify production code, Supabase schema, migrations, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or production data.

## 2. Current Problem

The `reports` table is overloaded because it is being used for multiple responsibilities that have different lifecycle, retention, and UI semantics:

- **Active operational reports:** rows that should affect the current map, alerts, awareness, and route context.
- **Road hazards:** rows representing current community-observed road conditions.
- **Rail crossing reports:** rows representing blocked or cleared crossing observations.
- **Confirmations:** user evidence that an existing condition is still true.
- **Cleared events:** evidence that a hazard or crossing condition is no longer active.
- **Test/malfunction rows:** non-production-quality rows that can pollute operational counts.
- **Recurring-pattern evidence:** older observations that are no longer live but remain valuable for intelligence.
- **Historical intelligence:** cleared/resolved facts that should answer what happened, where, when, and how long it lasted.

This creates repeated confusion because a single table row can be interpreted differently depending on the consumer. Active report counts, grouped incidents, cleared hazards, suppressed hazards, recurring hazard history, and production table clutter all become coupled to the same raw table. A clearing action can appear to remove too much because there is no first-class distinction between raw evidence, the live incident it belongs to, and the historical record produced after resolution.

## 3. Current Data Model

### Current `reports` table columns

The current documented live-report table shape is:

| Column | Current role |
| --- | --- |
| `id` | Unique report row identifier. |
| `crossing_id` | Optional crossing identifier for rail/crossing reports. |
| `crossing_name` | Human-readable crossing name when available. |
| `railroad` | Railroad/operator context when available. |
| `lat` | Latitude for map, proximity, grouping, and route relevance. |
| `lng` | Longitude for map, proximity, grouping, and route relevance. |
| `report_type` | Main semantic type such as blocked, cleared, road hazard, or subtype-specific signal. |
| `severity` | User- or system-derived severity signal. |
| `detail` | Freeform or structured descriptive details. |
| `source` | Source channel, client, import, or system origin. |
| `confidence` | Confidence/trust signal for the row. |
| `device_id` | Anonymous or device-scoped contributor identity. |
| `created_at` | Time the report row was created. |
| `expires_at` | Time after which the row should no longer be considered live. |

### Missing from the current model

The current shape does not provide first-class lifecycle and history concepts needed for safe separation:

- `status` — no durable active/confirmed/cleared/resolved/suppressed state.
- `cleared_at` — no explicit timestamp for when a live situation was cleared.
- `resolved_at` — no explicit timestamp for when an incident became resolved.
- `active` flag — no simple boolean projection for current operational relevance.
- `test` flag — no reliable way to isolate test, malfunction, or non-production evidence.
- `incident_id` — no direct link from evidence rows to the user-facing incident they support.
- History table — no canonical cleared/resolved historical intelligence store.

## 4. Product Model

The desired product model should define separate units of meaning:

- **Live reports = active operational truth.** These are current signals that users need now. They should be short-lived, clearly active, and safe to show in operational UI.
- **Historical incidents = cleared/resolved intelligence.** These preserve what happened after it is no longer active.
- **Reports are evidence.** A report is an observation, confirmation, clear, imported row, or system-derived signal. Reports support incidents; they are not always the user-facing incident themselves.
- **Incidents are user-facing situations.** An incident groups one or more reports into the thing the user sees: “flooding here,” “blocked crossing,” “debris on this road,” or “traffic backup.”
- **Clearing closes live state but preserves history.** A clear should stop the incident from appearing as active while preserving evidence, duration, confirmations, clearing evidence, and recurrence value.

## 5. Proposed Future Data Architecture

This section describes future tables and tradeoffs only. No schema should be implemented in this milestone.

### Option A: Keep `reports` as raw evidence and add `incidents`

#### Tables

- `reports`
  - Raw evidence rows.
  - Adds future nullable `incident_id`, `status`, `environment`, or `is_test` fields only after a later schema phase.
- `incidents`
  - One row per user-facing active or resolved situation.
  - Suggested fields: `id`, `type`, `subtype`, `status`, `lat`, `lng`, `crossing_id`, `road_name`, `first_reported_at`, `last_reported_at`, `confirmed_at`, `cleared_at`, `resolved_at`, `reports_count`, `confirmations_count`, `clear_evidence_count`, `confidence`, `created_at`, `updated_at`.
- `incident_reports`
  - Join table from reports to incidents.
  - Preserves many-to-one grouping and allows one clear event to close an incident without deleting evidence.
- `incident_lifecycle_events`
  - Append-only lifecycle ledger: created, report_added, confirmed, clear_requested, cleared, suppressed, expired, reopened, resolved.
- `incident_history`
  - Read-optimized summary for cleared/resolved intelligence.

#### Pros

- Lowest conceptual disruption: existing reports remain evidence.
- Makes incidents first-class without immediately replacing all reads.
- Supports phased dual-write and validation.
- Allows historical intelligence to be derived from incident lifecycle, not from brittle report filters.

#### Cons

- Requires careful migration because old code still reads `reports`.
- During transition, source-of-truth ambiguity can remain unless feature flags and validation are strict.
- Requires incident grouping logic to be deterministic and observable.

### Option B: Create `active_reports` as a live-only projection

#### Tables

- `reports`
  - Raw append-only evidence.
- `active_reports`
  - Current live operational projection only.
- `incident_history`
  - Historical summary after clear/resolution.

#### Pros

- Live UI can query a smaller, cleaner table.
- Active counts become simpler.
- Expiration and clearing can remove rows from the projection without deleting evidence.

#### Cons

- Projection correctness becomes critical.
- It may preserve the current “reports are user-facing state” ambiguity if incidents are not also modeled.
- Confirmations may still create duplicates unless grouped into incidents.

### Option C: Make `incidents` the live source of truth and keep `reports` evidence-only

#### Tables

- `reports`
  - Evidence only, not directly consumed by active UI.
- `incidents`
  - Active and recently resolved user-facing situations.
- `incident_reports`
  - Evidence membership.
- `incident_lifecycle_events`
  - Append-only state changes.
- `incident_history`
  - Long-term cleared/resolved summaries.
- `test_reports` or `environment` flag
  - Either a separate table for test evidence or a required `environment`/`is_test` marker on evidence rows.

#### Pros

- Best long-term model: user-facing UI reads user-facing incidents.
- Clear separation between evidence, operational state, and history.
- Enables accurate active counts, confirmation aggregation, and recurrence analytics.

#### Cons

- Highest migration complexity.
- Requires robust incident identity/grouping before switching UI reads.
- Needs extensive read-only validation before production cutover.

### Recommended architecture

Use **Option C as the long-term target**, reached through Option A-style phases. Keep `reports` as evidence first, add incidents and lifecycle in parallel, validate without changing UI, then switch active UI reads only after the incident model proves equivalent or better.

## 6. Clear Flow Design

When a user clears a hazard in the future architecture, the system should:

1. **Identify the incident**
   - Resolve the clear action to one active incident using incident id when available.
   - If no incident id is available, match by type, subtype, crossing id, road segment, and geospatial proximity.
   - Avoid broad clears based only on raw report type or loose location.

2. **Record clearing evidence**
   - Insert or associate a clear report as evidence.
   - Link it through `incident_reports`.
   - Append an `incident_lifecycle_events` row such as `clear_requested` or `cleared`.

3. **Close active incident**
   - Set the incident status to `cleared` or `resolved`.
   - Set `cleared_at` and/or `resolved_at`.
   - Stop the incident from appearing in active operational projections.

4. **Archive/summarize evidence**
   - Write or refresh an `incident_history` summary with first report time, clear time, duration, report count, confirmation count, clear evidence, location, subtype, and confidence.

5. **Remove from active UI**
   - Active map, alerts, awareness, route context, and active counts should exclude the closed incident.
   - This should happen through active incident status or active projection, not through deleting reports.

6. **Keep recurrence data**
   - Preserve the historical incident and all evidence links.
   - Recurrence analytics should count the resolved incident, not resurrect it into active UI.

## 7. Confirmation Flow Design

Confirmations should strengthen an incident without creating unlimited duplicate active rows.

Future confirmation behavior should be:

- Match the confirmation to an existing active incident by incident id, crossing id, road segment, type/subtype, and geospatial proximity.
- Insert the confirmation as evidence in `reports` or an equivalent evidence table.
- Link the confirmation through `incident_reports`.
- Increment or recalculate `confirmations_count` on the incident.
- Update `last_reported_at`, confidence, and freshness without creating a new active user-facing incident.
- Apply contributor/device dedupe windows so one device cannot inflate confirmations indefinitely.
- Keep raw confirmation evidence for auditability and trust scoring.

If a confirmation cannot safely match an existing incident, the system should either create a new candidate incident with low confidence or mark the report as unmatched evidence pending grouping, depending on product risk tolerance.

## 8. Recurring Hazard Intelligence

With explicit incidents and history, Gridly can later answer historical questions without polluting live state.

### Which crossings are blocked most often?

Query `incident_history` grouped by `crossing_id`, incident type, and time window. Use resolved incidents rather than raw rows so repeated confirmations do not over-count separate events.

### Which roads flood repeatedly?

Query historical incidents where `type = road_hazard` and `subtype = flooding`, grouped by normalized road segment, geohash, or map-matched segment id.

### Average clear time

Calculate `cleared_at - first_reported_at` or `resolved_at - first_reported_at` from historical incident summaries. Segment by type, subtype, crossing, road, severity, time of day, and weather/event context when available.

### Repeat hotspots

Build hotspot aggregates from `incident_history` by geohash, road segment, crossing id, subtype, and recurrence interval. Use incident-level records so one cluster of duplicate reports is counted as one situation.

### Confidence/trust over time

Use reports and lifecycle events to compute trust metrics:

- report-to-confirmation ratio
- clear evidence reliability
- device-level historical accuracy
- false positive/suppression rate
- average time from first report to confirmation
- consistency of recurrence at the same location

## 9. Migration Strategy

The migration must minimize risk and preserve current Gridly behavior until validation proves the new model.

### Phase 0: Audit-only

- Produce design and audit documents only.
- Do not change production code.
- Do not modify Supabase schema.
- Do not create migrations.
- Do not change report insertion, clearing behavior, alerts, markers, awareness, Route Watch, or DriveTexas.

### Phase 1: Add read-only history design docs

- Add more design docs and acceptance criteria.
- Define incident identity rules, matching thresholds, lifecycle states, and validation metrics.
- Inventory all current readers and writers of `reports`.
- No runtime behavior changes.

### Phase 2: Add schema in parallel, no production reads

- Add future tables in Supabase in a controlled migration after approval.
- Keep existing production reads on the current `reports` path.
- Add indexes and RLS policies with read/write isolation.
- Do not expose new tables to UI yet.

### Phase 3: Dual-write behind feature flag

- Existing write path continues unchanged from the user perspective.
- Behind a feature flag, write incident/evidence/lifecycle records in parallel.
- Fail closed: if the new write path fails, existing behavior should continue and the failure should be logged for audit.

### Phase 4: Read-only validation

- Compare current UI-derived active hazards/reports against new incident projections.
- Validate counts, grouping, clears, confirmations, expiration, route relevance, awareness inclusion, and marker eligibility.
- Produce dashboards or audit helpers that explain every mismatch.

### Phase 5: Switch active UI reads only after validation

- Switch one low-risk read surface at a time behind a feature flag.
- Start with internal diagnostics or read-only panels before map/alerts.
- Keep rollback path to current `reports` reads.
- Require production validation over representative active, cleared, duplicate, and recurrence cases.

### Phase 6: Cleanup old table usage

- Remove obsolete direct `reports` reads only after new incident reads are stable.
- Retain `reports` as evidence unless a separate archival strategy is approved.
- Do not delete production data as part of cleanup unless separately designed, approved, backed up, and tested.

## 10. Backward Compatibility

Backward compatibility should be preserved by keeping current app behavior intact until the new model has proven itself.

- Current `reports` writes remain the operational path during early phases.
- Current UI reads continue until validation and feature-flagged cutover.
- New incident/history tables are additive and parallel.
- Existing report ids remain valid and traceable.
- New incidents reference old reports instead of replacing them immediately.
- Clear and confirmation actions keep their current user-facing behavior while producing additional shadow records only after approved implementation phases.
- If incident grouping disagrees with existing behavior, diagnostics should explain the mismatch before any UI switch.
- Rollback should disable new reads and return to current `reports`-based behavior without data loss.

## 11. Risks

### High risks

- **Incorrect incident matching:** a clear could close the wrong active situation if matching rules are too broad.
- **Active UI cutover before validation:** users could see missing or duplicate hazards.
- **Dual-write inconsistency:** evidence and incident rows could diverge if partial failures are not handled carefully.
- **Historical backfill mistakes:** old rows could be grouped into inaccurate historical incidents if assumptions are wrong.

### Medium risks

- **Count differences:** incident-level counts will intentionally differ from raw row counts and need clear product language.
- **Confirmation inflation:** without dedupe windows, confirmations could overstate trust.
- **Schema/RLS mistakes:** new tables could be inaccessible or too permissive.
- **Performance:** incident grouping and historical queries need indexes and bounded windows.

### Low risks

- **Documentation drift:** design docs may become stale unless tied to implementation milestones.
- **Naming confusion:** `reports`, `active_reports`, `incidents`, and `history` require consistent product and engineering language.
- **Analytics interpretation:** recurrence metrics need clear definitions to avoid misleading comparisons.

## 12. Non-Goals

This design explicitly does not include:

- DriveTexas activation.
- Route Watch changes.
- Marker redesign.
- Alert redesign.
- Awareness redesign.
- Framework migration.
- Production data deletion.
- Supabase schema changes in this milestone.
- Migrations in this milestone.
- Changes to report insertion.
- Changes to clearing behavior.

## 13. Recommendation

The safest next step is to merge this design document only, then perform a read-only inventory of every `reports` reader/writer and every lifecycle/grouping helper before any schema or runtime work. After that inventory, define incident identity rules and validation metrics for a shadow incident model. Do not add tables, migrations, dual-writes, or UI read changes until those rules are reviewed and accepted.
