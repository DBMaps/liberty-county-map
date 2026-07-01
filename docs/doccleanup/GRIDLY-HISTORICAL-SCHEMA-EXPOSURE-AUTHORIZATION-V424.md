# GRIDLY Historical Schema Exposure Authorization V424

## Summary

V424 is the final authorization package for the minimum Supabase-side production change required to clear the current historical writer blocker:

- Add `history_capture` to Supabase/PostgREST exposed API schemas.
- Apply insert-only database access for the verified writer role.
- Preserve no historical reads, no history UI, no retention access, and no persistent writer monitoring access.

This document is authorization and planning only. It does not execute SQL, does not modify production, does not restart canary, does not activate capture or writer behavior, does not create historical writes, and does not create historical reads.

Gridly remains Awareness Platform First, Route Intelligence Second. Historical capture remains a non-authoritative evidence sidecar.

## Current blocker

Latest canary diagnostic:

```text
errorCode: PGRST106
errorMessage: Invalid schema: history_capture
errorHint: Only the following schemas are exposed: public, graphql_public
```

Assessment:

1. The writer now reaches Supabase/PostgREST.
2. The writer targets `history_capture.historical_events` through schema-scoped access.
3. PostgREST rejects the request before table grants or RLS can be evaluated because `history_capture` is not listed in the exposed API schemas.
4. The minimum production-side blocker is therefore schema exposure, followed by narrowly scoped insert authorization for the exact writer role.

## Authorization decision

Authorize manual application of **Option A: expose `history_capture` through Supabase/PostgREST and grant insert-only access to the verified writer role**.

This authorization is limited to:

1. Supabase dashboard/API setting: expose `history_capture` as an API schema.
2. SQL grants/revokes/policy for insert-only writes to `history_capture.historical_events` by the verified writer role.
3. Metadata-only validation of schema exposure, grants, policies, and read denial.
4. A later one-event canary validation only after the manual authorization change is confirmed.

This authorization does **not** approve broader history features, reads, UI, retention access, monitoring persistence, protected-system changes, or any unrelated implementation work.

## Manual production setting change

Exact production setting to change:

- In Supabase project settings for the Data API/PostgREST exposed schemas, add:

```text
history_capture
```

Expected final exposed schema list includes at minimum:

```text
public
graphql_public
history_capture
```

Operational notes:

- This is a manual Supabase production setting change.
- This document does not apply the setting.
- Do not remove `public` or `graphql_public` as part of this change.
- Do not expose unrelated schemas.
- Do not restart canary during or immediately after the setting change.

## Manual SQL package — NOT EXECUTED

The SQL below is a draft/manual-review package only. It has not been executed by this milestone and must not be executed automatically.

### Primary package for current expected writer role: `anon`

```sql
-- V424 DRAFT ONLY — NOT EXECUTED.
-- MANUAL REVIEW REQUIRED BEFORE ANY PRODUCTION USE.
-- Purpose: minimum insert-only access for the historical evidence writer.
-- Prerequisite: manually add history_capture to Supabase Data API exposed schemas.
-- Current assumption: the verified browser writer role is anon.

begin;

-- Allow the verified writer role to resolve objects in the exposed schema.
grant usage on schema history_capture to anon;

-- Allow append-only insertion into the evidence table only.
grant insert on table history_capture.historical_events to anon;

-- Explicitly deny browser/client read and non-insert mutation privileges.
revoke select, update, delete, truncate, references, trigger
  on table history_capture.historical_events
  from anon;

-- Keep writer monitoring persistence and retention bookkeeping client-inaccessible.
revoke all on table history_capture.writer_monitoring_events from anon;
revoke all on table history_capture.retention_runs from anon;

-- Keep RLS enabled on all protected historical tables.
alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

-- Replace only the scoped insert policy for the verified writer role.
drop policy if exists "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events;

create policy "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events
  for insert
  to anon
  with check (
    schema_version = 'history_capture.phase_1a.v1'
    and phase = '1A'
    and event_type in ('report_created', 'report_cleared')
    and idempotency_key is not null
    and observed_at is not null
    and envelope is not null
    and payload is not null
    and metadata is not null
    and jsonb_typeof(envelope) = 'object'
    and jsonb_typeof(payload) = 'object'
    and jsonb_typeof(metadata) = 'object'
  );

commit;
```

### Optional authenticated variant — NOT EXECUTED

Use this only if production verification proves the historical writer is running as `authenticated`. Do not apply preemptively and do not grant both roles unless both are separately proven necessary.

```sql
-- V424 DRAFT ONLY — NOT EXECUTED.
-- MANUAL REVIEW REQUIRED BEFORE ANY PRODUCTION USE.
-- Apply only if authenticated is verified as the writer role.

begin;

grant usage on schema history_capture to authenticated;
grant insert on table history_capture.historical_events to authenticated;

revoke select, update, delete, truncate, references, trigger
  on table history_capture.historical_events
  from authenticated;

revoke all on table history_capture.writer_monitoring_events from authenticated;
revoke all on table history_capture.retention_runs from authenticated;

alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

drop policy if exists "history_capture_authenticated_insert_phase1a_events"
  on history_capture.historical_events;

create policy "history_capture_authenticated_insert_phase1a_events"
  on history_capture.historical_events
  for insert
  to authenticated
  with check (
    schema_version = 'history_capture.phase_1a.v1'
    and phase = '1A'
    and event_type in ('report_created', 'report_cleared')
    and idempotency_key is not null
    and observed_at is not null
    and envelope is not null
    and payload is not null
    and metadata is not null
    and jsonb_typeof(envelope) = 'object'
    and jsonb_typeof(payload) = 'object'
    and jsonb_typeof(metadata) = 'object'
  );

commit;
```

## Role/grant assumptions

Current writer-role conclusion:

- The expected writer role is `anon`.
- The app initializes the browser Supabase client with the public key.
- No current evidence in this milestone proves the historical writer uses an authenticated Supabase session.
- Therefore, the primary package targets `anon` only.

Required manual confirmation before SQL execution:

1. Confirm whether the deployed browser client has an authenticated user session at the moment the historical writer canary runs.
2. If no authenticated session is present, apply only the `anon` package.
3. If an authenticated session is proven present and is the writer identity, use the authenticated variant instead.
4. Do not grant both `anon` and `authenticated` unless both roles are independently verified as required.

Approved grants for the verified role only:

- `USAGE` on schema `history_capture`.
- `INSERT` on table `history_capture.historical_events`.

Not approved:

- `SELECT` on any `history_capture` table for browser/client roles.
- `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `ALL` on historical tables for browser/client roles.
- Any grants on `writer_monitoring_events` beyond explicit revocation for this milestone.
- Any grants on `retention_runs` beyond explicit revocation for this milestone.

## RLS review

RLS must remain enabled on:

- `history_capture.historical_events`
- `history_capture.writer_monitoring_events`
- `history_capture.retention_runs`

The approved insert policy is intentionally narrow:

- Operation: `INSERT` only.
- Role: verified writer role only.
- Table: `history_capture.historical_events` only.
- Phase: `1A` only.
- Schema version: `history_capture.phase_1a.v1` only.
- Event types: `report_created` and `report_cleared` only.
- Required evidence fields: `idempotency_key`, `observed_at`, `envelope`, `payload`, and `metadata`.
- JSON object checks for envelope, payload, and metadata.

RLS still limits writes safely because schema exposure and `INSERT` grants are not enough by themselves; the inserted row must also satisfy the policy `with check` expression.

## Read-denial review

SELECT remains denied.

Required read-denial posture:

1. No `SELECT` grant to `anon` or `authenticated` on `history_capture.historical_events`.
2. No `SELECT` policy for browser/client roles on `history_capture.historical_events`.
3. No `SELECT` grant to browser/client roles on `writer_monitoring_events`.
4. No `SELECT` grant to browser/client roles on `retention_runs`.
5. No history UI, no history read API, and no app-side historical query path.

Exposing `history_capture` makes the schema route addressable by PostgREST; it does not, by itself, approve readable access. Read access still requires table privilege and an RLS read policy, neither of which is approved here.

## Monitoring/retention access review

### `writer_monitoring_events`

`history_capture.writer_monitoring_events` remains client-inaccessible for now.

V424 does not approve:

- Client `INSERT` into `writer_monitoring_events`.
- Client `SELECT` from `writer_monitoring_events`.
- Persistent writer monitoring writes.

Writer monitoring remains in-memory/diagnostic-only until a separate milestone approves persistent monitoring storage.

### `retention_runs`

`history_capture.retention_runs` remains client-inaccessible.

V424 does not approve:

- Client `INSERT`, `SELECT`, `UPDATE`, or `DELETE` on `retention_runs`.
- App UI retention access.
- Retention reads through browser client code.
- Retention control through browser client code.

## Rollback plan

The change is rollback-capable.

### Rollback trigger examples

Rollback immediately if any of the following are observed:

- Unexpected historical read access from browser/client roles.
- Unexpected client access to `writer_monitoring_events` or `retention_runs`.
- Unexpected write success outside the one-event canary envelope.
- RLS policy misconfiguration.
- Wrong writer role was granted.
- Any protected live awareness, alert, marker, Route Watch, or other live-path regression is suspected.

### Exact rollback steps

1. Stop any active canary if one is running under a separate approval.
2. In Supabase Data API settings, remove `history_capture` from exposed schemas.
3. Run the reviewed rollback SQL for the role that was actually granted.
4. Confirm metadata shows no client table privileges remain.
5. Confirm no browser/client `SELECT` policy exists on any `history_capture` table.
6. Confirm `writer_monitoring_events` and `retention_runs` have no client grants.
7. Leave RLS enabled.
8. Do not delete historical tables as part of this rollback.
9. Do not run destructive SQL.

### Rollback SQL for `anon` package — NOT EXECUTED

```sql
-- V424 ROLLBACK DRAFT ONLY — NOT EXECUTED.
-- Apply only if the anon package was applied.

begin;

drop policy if exists "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events;

revoke insert on table history_capture.historical_events from anon;
revoke usage on schema history_capture from anon;
revoke all on table history_capture.writer_monitoring_events from anon;
revoke all on table history_capture.retention_runs from anon;

alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

commit;
```

### Rollback SQL for authenticated package — NOT EXECUTED

```sql
-- V424 ROLLBACK DRAFT ONLY — NOT EXECUTED.
-- Apply only if the authenticated package was applied.

begin;

drop policy if exists "history_capture_authenticated_insert_phase1a_events"
  on history_capture.historical_events;

revoke insert on table history_capture.historical_events from authenticated;
revoke usage on schema history_capture from authenticated;
revoke all on table history_capture.writer_monitoring_events from authenticated;
revoke all on table history_capture.retention_runs from authenticated;

alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

commit;
```

## Post-change validation plan

Post-change validation must be metadata-only until the one-event canary is separately started.

Validate manually:

1. Supabase Data API exposed schemas include `history_capture`.
2. The verified writer role has `USAGE` on `history_capture`.
3. The verified writer role has `INSERT` on `history_capture.historical_events`.
4. The verified writer role does not have `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `ALL` on `history_capture.historical_events`.
5. Browser/client roles have no privileges on `history_capture.writer_monitoring_events`.
6. Browser/client roles have no privileges on `history_capture.retention_runs`.
7. RLS is enabled on all three historical tables.
8. Exactly one scoped insert policy exists for the verified writer role on `historical_events`.
9. No browser/client `SELECT` policy exists on any historical table.
10. No production historical reads or writes are performed during metadata validation.

Suggested metadata-only SQL inspection examples — NOT EXECUTED:

```sql
-- V424 INSPECTION DRAFT ONLY — NOT EXECUTED.
-- These examples inspect metadata and privileges only; they do not read historical rows.

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'history_capture'
order by tablename;

select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'history_capture'
order by grantee, table_name, privilege_type;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'history_capture'
order by tablename, policyname;
```

## One-event canary validation plan

The one-event canary is not started by this document. It may occur only after the manual production setting and SQL package are applied and validated.

Exact process after authorization is applied:

1. Confirm no existing canary is running.
2. Confirm the protected-system baseline is normal.
3. Confirm the post-change metadata validation plan passed.
4. Start the historical canary manually using the existing approved manual canary control.
5. Create exactly one normal report to generate one accepted Phase 1A historical event.
6. Do not create additional reports.
7. Inspect canary status and writer diagnostics.
8. Confirm expected success outcome:
   - `eventsObserved: 1`
   - `eventsWritten: 1`
   - `writerErrors: 0`
   - no historical reads
   - no history UI
   - protected systems unchanged
9. Stop or allow the canary to stop according to the existing canary control behavior.
10. Capture the resulting diagnostic output for review.
11. Do not expand event volume without a separate approval.

If the one-event canary fails:

- Do not retry repeatedly.
- Do not broaden grants.
- Do not add `SELECT`.
- Do not expose monitoring or retention tables.
- Preserve diagnostics and open a follow-up diagnosis milestone.

## Protected-system review

V424 authorizes only a production-side schema exposure and insert-only historical evidence access package. It does not alter or approve changes to:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness
- markers
- Route Watch
- DriveTexas

Historical events must not feed live awareness, alerts, markers, Route Watch, active incident state, or any public UI without separate review and approval.

## Explicit non-approvals

V424 does not approve:

- Executing SQL from this repository by the agent.
- Applying production settings by the agent.
- Starting or restarting canary during this task.
- Capture activation during this task.
- Writer activation during this task.
- Historical writes during this task.
- Historical reads during this task.
- History UI.
- Awareness changes.
- Alert changes.
- Marker changes.
- Route Watch changes.
- DriveTexas changes.
- Persistent writer monitoring writes.
- Client access to `writer_monitoring_events`.
- Client access to `retention_runs`.
- Any `SELECT` grant to browser/client roles on historical tables.
- Any broad `GRANT ALL` pattern.
- Any destructive SQL.
- Any production table deletion, truncation, or retention action.

## Testing performed

Repository-only checks requested for this authorization document:

- `git status --short`
- `git diff --check`

No production command, Supabase command, SQL execution, historical read, historical write, migration, canary execution, capture activation, writer activation, UI change, awareness change, alert change, marker change, Route Watch change, or DriveTexas change was performed.

## Final approval recommendation

Approve the manual Supabase-side change only if reviewers agree to all of the following:

1. `history_capture` may be added to Supabase/PostgREST exposed schemas.
2. The verified writer role is confirmed before grants are applied.
3. The current expected writer role is `anon`; `authenticated` is used only if separately verified.
4. The verified writer role receives only schema `USAGE` and table `INSERT` on `history_capture.historical_events`.
5. `SELECT` remains denied.
6. `writer_monitoring_events` remains client-inaccessible.
7. `retention_runs` remains client-inaccessible.
8. RLS remains enabled and limits writes to valid Phase 1A event rows.
9. The change remains rollback-capable by removing schema exposure, dropping the scoped insert policy, and revoking the narrow grants.
10. The first runtime validation after approval is exactly one event and no more.

Recommendation: **Approve Option A for manual production application, with `anon` as the presumed writer role unless production session verification proves otherwise.**
