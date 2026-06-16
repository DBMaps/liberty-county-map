# V372 — Historical Schema Migration Review & SQL Safety Audit

## 1. Quick Summary

V372 reviewed the V371 draft historical schema migration and rollback draft for SQL safety, additive-only behavior, rollback safety, and future Supabase readiness.

This milestone is review/audit only. No migration was applied, no Supabase schema was changed, and no application integration was added.

**Recommendation:** GO to **V373 — Historical Schema Dry-Run Plan**, with the explicit constraint that V373 also must not apply the migration.

## 2. Reviewed Files

- `supabase/migrations/202606160001_add_historical_incident_tables_draft.sql`
- `supabase/migrations/202606160002_rollback_historical_incident_tables_draft.sql`
- `GRIDLY-HISTORICAL-INCIDENT-SCHEMA-DESIGN-ADDITIVE-ONLY-V369.md`
- `GRIDLY-ADDITIVE-HISTORICAL-SCHEMA-MIGRATION-DRAFT-V371.md`

## 3. Additive-Only Findings

The V371 migration draft is additive-only.

Findings:

- Creates only new historical schema objects:
  - `public.historical_incidents`
  - `public.incident_events`
  - `public.incident_recurrence_index`
- Uses `create table if not exists` for new historical tables.
- Uses `create index if not exists` for new historical indexes.
- Does not alter, rewrite, drop, backfill, or repurpose `public.reports`.
- Does not modify any known existing production table.
- Does not create triggers on `public.reports` or any production table.
- Does not create functions that could become production dependencies.
- Does not add data-copy, migration, or backfill statements.
- Does not add app-facing read or write paths.

Audit result: **PASS** for additive-only behavior.

## 4. Table-Definition Findings

The draft table definitions match the V369 design intent closely enough for a future dry-run planning milestone.

### `public.historical_incidents`

Findings:

- Includes a UUID primary key with `gen_random_uuid()` default.
- Captures incident type/kind, status, representative location, area/location labels, first/last/closed timestamps, duration, counts, source report IDs, recurrence key, timestamps, and model version.
- Keeps `source_report_ids` as a UUID array, which is consistent with the V369 design note that a future implementation must choose between array, JSON, or a normalized join model.
- Does not reference `public.reports`, which avoids coupling the historical table to current production writes during the draft stage.

### `public.incident_events`

Findings:

- Includes a UUID primary key with `gen_random_uuid()` default.
- References `public.historical_incidents(id)` with `on delete cascade`, which is appropriate for event cleanup if a historical incident row is removed.
- Stores source report ID as an uncoupled UUID rather than a foreign key to `public.reports`, which avoids accidental production-table dependency.
- Captures event type/time/source, location, optional device hash, created timestamp, and model version.

### `public.incident_recurrence_index`

Findings:

- Includes a UUID primary key with `gen_random_uuid()` default.
- Captures recurrence key, incident type, area/location labels, coordinate buckets, incident count, average duration, last seen timestamp, timestamps, and model version.
- Remains additive and independent from production tables.

Audit result: **PASS** for V369-aligned table definitions.

## 5. Index Findings

The V371 migration draft indexes are safe for a future additive migration because they are created only on newly introduced historical tables.

Findings:

- Indexes on `public.historical_incidents` cover plausible future query dimensions:
  - `recurrence_key`
  - `incident_type`
  - `area_label`
  - `closed_at`
  - `first_observed_at`
- Indexes on `public.incident_events` cover plausible event lookup dimensions:
  - `historical_incident_id`
  - `source_report_id`
  - `event_type`
- Index on `public.incident_recurrence_index(recurrence_key)` supports future recurrence lookup.
- All indexes use `create index if not exists`.
- No index is created on `public.reports` or any existing production table.
- No concurrent-index requirement is identified because the indexed tables are new and empty when created by this draft.

Audit result: **PASS** for index safety.

## 6. RLS Findings

The V371 migration draft RLS posture is conservative.

Findings:

- Enables row level security on all three new historical tables.
- Creates explicit deny-read policies for `anon` and `authenticated` roles using `using (false)`.
- Creates no anonymous or authenticated insert, update, or delete policies.
- Does not create broad public writes.
- Does not enable historical reads.
- Does not enable historical writes.
- Leaves any future service-role/back-office write path for a separate review and approval milestone.

Important Supabase readiness note:

- Supabase service role bypass behavior should be reviewed again before any future write job is approved. The current draft correctly avoids granting client read/write access, but future operational writers must still be governed by a separate service-role, job-runner, credential-handling, audit, and dry-run plan.

Audit result: **PASS** for conservative draft RLS.

## 7. Rollback Findings

The V371 rollback draft is narrowly scoped to the V371 historical objects.

Findings:

- Drops only the explicit deny-read policies on the three historical tables.
- Drops only the V371 historical tables:
  - `public.incident_recurrence_index`
  - `public.incident_events`
  - `public.historical_incidents`
- Does not touch `public.reports`.
- Does not touch production tables.
- Drops `incident_events` before `historical_incidents`, which is safe because `incident_events` references `historical_incidents`.
- Drops the independent recurrence table before the dependent event/summary pair, which is safe.
- Uses `if exists` for policy and table drops.
- Is appropriate only while there is no production dependency, no historical write path, and no app read path relying on the historical tables.

Audit result: **PASS** for rollback safety in the current draft-only/no-dependency context.

## 8. Risks

Remaining risks are planning and governance risks, not immediate code or SQL execution risks, because the migration remains unapplied.

- **Premature application risk:** Applying the draft before V373 dry-run planning and later approval could create unmanaged schema in Supabase.
- **Future writer risk:** A future service-role writer could bypass client RLS; it must be separately designed, audited, and tested.
- **Data quality risk:** Existing fake/test-generated data must not be backfilled or treated as trusted history without a separate cleanup and data-quality plan.
- **Dependency risk:** Future app code must not begin relying on historical tables until historical reads, writes, UI, and parity gates are separately approved.
- **Rollback timing risk:** The rollback draft is safe only before production dependencies or valuable historical data exist. After real writes or app dependencies are introduced, rollback would require a data preservation and dependency-removal plan.

## 9. Required Corrections

No SQL corrections are required for V372.

The reviewed migration and rollback drafts already include the expected draft warnings, `if exists` / `if not exists` guards, conservative RLS, additive-only tables, safe index scope, and rollback isolation.

## 10. Explicit Non-Approvals

V372 does **NOT** approve:

- applying the migration
- Supabase schema changes
- historical writes
- historical reads
- app integration
- history UI
- production read changes
- production write changes
- lifecycle changes
- alert changes
- awareness changes
- marker changes
- Route Watch changes
- DriveTexas activation
- backfill logic
- production dependency on historical tables

## 11. Supabase Changes Applied

**NO.**

No Supabase migration was applied. No Supabase schema was changed. No remote Supabase command was run.

## 12. App Integration Changes

**NONE.**

V372 made no changes to `js/app.js`, `index.html`, or `css/styles.css`.

## 13. Production Read Changes

**NO.**

No production read path was changed.

## 14. Production Write Changes

**NO.**

No production write path was changed.

## 15. Go / No-Go Recommendation

**GO to V373 — Historical Schema Dry-Run Plan.**

V373 should remain planning/dry-run only and still must not apply the migration. Before any real Supabase application is approved, a later milestone should define the exact dry-run environment, SQL execution method, schema diff verification, RLS verification, rollback rehearsal, and post-run evidence requirements.

## 16. Merge Recommendation

Merge V372 as an audit/documentation milestone.

This merge should be treated only as approval of the review findings and readiness to plan a dry run. It must not be interpreted as approval to apply the migration, enable historical reads/writes, or integrate app behavior.
