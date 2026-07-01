# V373 — Historical Schema Dry-Run Plan

## 1. Scope and Non-Goals

V373 is a documentation-only dry-run plan for the V371 additive historical schema migration draft reviewed in V372.

### In scope

- Define the local and dry-run review sequence for the V371 draft migration SQL.
- Define the review checklist for a future Supabase migration application milestone.
- Define rollback rehearsal expectations for a future isolated dry-run environment.
- Define validation commands and evidence requirements that a later milestone must run before any production migration is considered.
- Preserve the V372 recommendation to proceed only to planning, not execution.

### Non-goals

V373 does **not** include or approve any of the following:

- Applying the V371 migration.
- Running Supabase commands.
- Changing any Supabase schema, policy, index, function, trigger, table, or row.
- Modifying app behavior.
- Adding historical reads.
- Adding historical writes.
- Integrating historical UI.
- Modifying production read paths.
- Modifying production write paths.
- Backfilling historical data.
- Activating or changing DriveTexas behavior.
- Changing alerts, awareness, markers, Route Watch, or incident lifecycle behavior.

Protected systems that must not be modified by V373 or by the future dry-run planning work described here:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- `alerts`
- `awareness`
- `markers`
- Route Watch
- DriveTexas

## 2. Pre-Dry-Run Prerequisites

Before any later milestone performs an actual isolated dry run, all prerequisites below must be satisfied and documented with evidence.

- Confirm the migration remains additive-only:
  - It creates only the V371 historical tables.
  - It does not alter, drop, rewrite, repurpose, or backfill `public.reports`.
  - It does not alter any production table.
  - It does not create triggers or functions that attach to production tables.
- Confirm the rollback SQL remains narrowly scoped to V371 historical objects only.
- Confirm no app code references the V371 historical tables.
- Confirm no production read/write path depends on historical tables.
- Confirm no UI entry point exposes historical data.
- Confirm no service-role writer, scheduled job, edge function, client call, or backfill job is included.
- Identify the dry-run target environment before execution:
  - It must not be production.
  - It should be an isolated local database or disposable Supabase project.
  - It must contain no production secrets.
  - It must contain no valuable user data unless a separate data-safety review approves it.
- Define who will execute the dry run, who will review evidence, and who has authority to stop the milestone.
- Capture baseline schema evidence from the dry-run environment before migration execution.
- Prepare a clean working tree and record exact commit SHA for the migration artifacts under review.

## 3. Local/Dry-Run Review Sequence

The future dry-run milestone should follow this sequence. V373 itself does not execute these steps against Supabase.

1. **Confirm artifact identity**
   - Record the exact migration file path and checksum.
   - Record the exact rollback file path and checksum.
   - Confirm the SQL matches the V371/V372-reviewed draft or document every delta.

2. **Static SQL review**
   - Inspect migration SQL for destructive operations such as `drop`, `truncate`, production-table `alter`, production-table indexes, production-table triggers, data-copy statements, or backfills.
   - Inspect rollback SQL for scope creep beyond V371 historical objects.
   - Confirm all object names are schema-qualified where expected.
   - Confirm `if not exists` / `if exists` guards remain present where expected.

3. **Application isolation review**
   - Search for historical table references in app code.
   - Confirm production systems listed in the protected-systems section are unchanged.
   - Confirm no feature flags, UI affordances, browser reads, background writers, or lifecycle processors were added.

4. **Dry-run environment preparation**
   - Use only the approved isolated target.
   - Capture baseline schema, policy, index, table, and migration-state evidence.
   - Confirm the dry-run environment can be discarded or safely rolled back.

5. **Migration dry run**
   - Apply the migration only in the isolated dry-run environment approved by the later milestone.
   - Capture logs, schema diff, table list, policy list, and index list immediately after execution.
   - Do not run against production.

6. **Post-migration inspection**
   - Verify only V371 historical objects were added.
   - Verify RLS is enabled on the new historical tables.
   - Verify `anon` and `authenticated` roles do not receive historical read/write access.
   - Verify existing production tables, policies, indexes, and data remain unchanged.

7. **Rollback rehearsal**
   - Run rollback only in the isolated dry-run environment.
   - Capture before/after evidence proving V371 historical objects were removed.
   - Verify existing production objects remain intact.

8. **Evidence packaging**
   - Save command transcripts, schema diffs, reviewed checksums, and pass/fail notes.
   - Identify any discrepancy as a NO-GO until reviewed.

## 4. Supabase Migration Review Checklist

A future migration-application milestone must complete this checklist before any real Supabase migration is considered.

- [ ] Confirm the target is not production unless a later explicit production-application milestone approves production execution.
- [ ] Confirm project ref, database URL, and environment name before any command is run.
- [ ] Confirm no production secrets are printed or committed.
- [ ] Confirm migration file is the reviewed V371 additive draft or a fully re-reviewed successor.
- [ ] Confirm rollback file is paired with the exact migration version under review.
- [ ] Confirm migration creates only:
  - `public.historical_incidents`
  - `public.incident_events`
  - `public.incident_recurrence_index`
  - indexes and policies scoped only to those tables
- [ ] Confirm migration does not modify `public.reports`.
- [ ] Confirm migration does not modify any existing production table.
- [ ] Confirm migration does not add triggers, functions, scheduled jobs, edge functions, storage changes, or auth changes.
- [ ] Confirm migration does not copy, update, delete, or backfill data.
- [ ] Confirm RLS is enabled on all new historical tables.
- [ ] Confirm `anon` and `authenticated` have no read/write access to the new historical tables.
- [ ] Confirm service-role writer behavior remains unimplemented and separately unapproved.
- [ ] Confirm app deployment is not bundled with migration execution.
- [ ] Confirm no app code is released that reads or writes the new historical tables.

## 5. Rollback Rehearsal Checklist

Rollback rehearsal must be performed only in an isolated dry-run environment before any later production application can be considered.

- [ ] Confirm rollback SQL corresponds exactly to the applied dry-run migration.
- [ ] Confirm rollback drops only policies and tables introduced by V371.
- [ ] Confirm rollback does not touch `public.reports`.
- [ ] Confirm rollback does not touch alerts, awareness, markers, Route Watch, DriveTexas, or production incident paths.
- [ ] Confirm rollback order handles dependencies safely:
  - recurrence index table removal
  - event table removal
  - historical incident summary table removal
- [ ] Capture schema evidence before rollback.
- [ ] Execute rollback only in the dry-run environment.
- [ ] Capture schema evidence after rollback.
- [ ] Verify V371 historical tables no longer exist.
- [ ] Verify production tables, policies, indexes, and row counts are unchanged.
- [ ] Verify rollback does not require production data restoration in the current no-dependency context.
- [ ] Record any warning or unexpected object as a NO-GO pending review.

## 6. Validation Commands/Checks

V373 itself is documentation-only. The commands below are the allowed local validation checks for this planning milestone and recommended evidence checks for a later isolated dry-run milestone.

### V373 documentation-only checks

```sh
git status --short
git diff --check
rg -n "loadSharedReports|activeHazards|getLiveHazardIncidents|unifiedRoadIncidents|activeUnifiedIncidents|alerts|awareness|markers|Route Watch|DriveTexas" GRIDLY-HISTORICAL-SCHEMA-DRY-RUN-PLAN-V373.md
```

### Future isolated dry-run evidence checks

These are examples for a later milestone. Do not run them in V373 and do not run them against production.

```sh
sha256sum supabase/migrations/202606160001_add_historical_incident_tables_draft.sql
sha256sum supabase/migrations/202606160002_rollback_historical_incident_tables_draft.sql
rg -n "historical_incidents|incident_events|incident_recurrence_index" . --glob '!node_modules/**'
rg -n "drop table|truncate|alter table public\.reports|insert into public\.reports|update public\.reports|delete from public\.reports" supabase/migrations/202606160001_add_historical_incident_tables_draft.sql supabase/migrations/202606160002_rollback_historical_incident_tables_draft.sql
```

Any Supabase CLI or SQL execution command must wait for a later explicit dry-run execution milestone and must target only an approved non-production environment.

## 7. Required Pass/Fail Criteria

### PASS criteria

The future dry-run plan can pass only if all of the following are true:

- The reviewed SQL remains additive-only.
- No production table is modified.
- No production data is copied, updated, deleted, truncated, or backfilled.
- No production read path changes are present.
- No production write path changes are present.
- No app code depends on historical tables.
- No UI exposes historical data.
- New historical tables remain inaccessible to `anon` and `authenticated` roles.
- Rollback removes only V371 historical objects.
- Rollback completes without requiring production data restoration.
- All evidence is captured and reviewed.

### FAIL / NO-GO criteria

The future dry-run plan fails if any of the following occur:

- The target environment is production without a later explicit production-application approval milestone.
- Any Supabase command is run during V373.
- Migration SQL alters, drops, rewrites, backfills, or depends on production tables.
- Rollback SQL reaches beyond V371 historical objects.
- Any app read/write path is changed to use historical tables.
- Any protected system is modified.
- RLS grants client-visible read/write access before separate approval.
- Service-role writes, jobs, or backfills are introduced without separate approval.
- Evidence is missing, ambiguous, or inconsistent.

## 8. Explicit Production Safety Boundaries

V373 is not a production migration milestone.

Production safety boundaries:

- Do not apply the migration to production.
- Do not run Supabase commands in V373.
- Do not change production Supabase schema.
- Do not change production Supabase RLS.
- Do not change production incident reads.
- Do not change production incident writes.
- Do not add historical reads.
- Do not add historical writes.
- Do not add history UI.
- Do not backfill existing reports into historical tables.
- Do not attach triggers to `public.reports`.
- Do not introduce service-role writers.
- Do not modify protected systems listed in this plan.

If any future milestone needs to cross one of these boundaries, it must be separately scoped, reviewed, approved, and evidenced.

## 9. GO / NO-GO Criteria for a Future Migration-Application Milestone

### GO to a later isolated dry-run execution milestone only if

- V373 is accepted as planning-only.
- V371/V372 SQL artifacts remain unchanged or all changes receive a new SQL safety review.
- A non-production dry-run target is identified.
- Baseline evidence collection is defined.
- Rollback rehearsal evidence requirements are defined.
- Ownership, reviewer, and stop-authority are assigned.
- The milestone explicitly excludes production execution and app integration.

### GO to a later production migration-application milestone only if

A later milestone, not V373, provides all of the following:

- Successful isolated dry-run evidence.
- Successful rollback rehearsal evidence.
- Security/RLS review evidence.
- Confirmation that no production app dependency exists at migration time.
- Production execution window and operator approval.
- Production backup and observability plan.
- Explicit production-application approval.

### NO-GO if

- The migration is treated as approved by V373.
- Production execution is requested without a completed dry-run evidence package.
- App reads, writes, UI, backfill, or service-role jobs are bundled into the migration milestone.
- Any protected production system is modified.
- Rollback no longer remains simple, scoped, and dependency-free.

## 10. V373 Non-Approval Statement

V373 does **not** approve applying the V371 historical schema migration.

V373 approves only the existence of this dry-run plan document as a planning artifact. Any future migration execution, Supabase command, production application, historical read path, historical write path, UI integration, service-role writer, backfill, or production dependency requires a separate milestone with explicit approval.
