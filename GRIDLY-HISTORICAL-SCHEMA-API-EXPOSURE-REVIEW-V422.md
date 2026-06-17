# GRIDLY Historical Schema API Exposure Review V422

## Summary

V422 reviews the live canary `PGRST106` failure as a planning milestone only. No Supabase SQL was run, no migrations were run, no canary was started, no writer/capture gate was enabled, and no historical rows were read or written.

The current failure is best assessed as a Supabase/PostgREST API schema-exposure failure, not evidence that `history_capture.historical_events` is missing. The latest canary explicitly says PostgREST only exposes `public` and `graphql_public`, while the writer now targets the intended custom schema through `storageClient.schema('history_capture').from('historical_events')`.

Minimum safe next step: manually expose the `history_capture` schema in Supabase Data API settings and apply narrowly scoped writer-only grants/policies for the exact app role that performs canary writes. Do not grant `SELECT` to browser roles, do not expose `retention_runs`, and keep `writer_monitoring_events` in memory unless a separate milestone approves persistent monitoring writes.

## Latest canary error recap

Latest post-V421 canary diagnostic:

```text
errorCode: PGRST106
errorMessage: Invalid schema: history_capture
errorHint: Only the following schemas are exposed: public, graphql_public
writerStage: write_attempt
storageStage: historical_events_insert
```

Interpretation:

- The writer reached the Supabase/PostgREST write attempt.
- The storage stage reached the intended `historical_events_insert` path.
- PostgREST rejected the requested schema before table-level authorization or RLS policy evaluation could prove success/failure.
- The error identifies the exposed API schema list as `public, graphql_public`; `history_capture` is absent.

## Migration file context, including draft-only warning

### Draft-only historical migration files

The following files are historical/draft context and must not be treated as production lineage or executed artifacts for this review:

- `supabase/migrations/202606160001_add_historical_incident_tables_draft.sql`
- `supabase/migrations/202606160002_rollback_historical_incident_tables_draft.sql`

### Actual historical capture storage lineage

The reviewed storage lineage is:

- `supabase/migrations/202606170410_history_capture_storage.sql`
- `supabase/migrations/202606170411_rollback_history_capture_storage.sql`

The forward storage migration creates `history_capture`, `historical_events`, `writer_monitoring_events`, and `retention_runs`; adds indexes; and enables RLS on all three tables. It does not add API exposure settings, grants, or RLS policies for client insert access.

Known V412 production verification states these production tables exist:

- `history_capture.historical_events`
- `history_capture.writer_monitoring_events`
- `history_capture.retention_runs`

V422 did not re-query production and does not supersede V412 evidence.

## Root cause assessment

### Determination 1 — schema exposure vs. missing tables

The current failure is caused by PostgREST schema exposure rather than by missing tables, based on the error shape:

- `PGRST106` names `history_capture` as an invalid schema.
- The error hint says only `public` and `graphql_public` are exposed.
- A missing table under an exposed schema would normally present as relation/table lookup or permission failure, not as "Invalid schema" with a list of exposed schemas.
- V412 separately verified that the target storage tables exist in production.

Therefore, the next failure to resolve is API exposure for the schema. Table grants/RLS may still be additional blockers after schema exposure is fixed.

## Supabase/PostgREST schema exposure review

### Determination 2 — how Supabase exposes non-public schemas

Supabase's Data API is backed by PostgREST. Custom schemas are not automatically addressable just because they exist in Postgres. To use a non-public schema through `supabase-js`/REST:

1. The schema must be listed in Supabase Dashboard Data API/API settings as an exposed schema.
2. The active database role must have `USAGE` on the schema.
3. The active database role must have object-level privileges on tables/functions it will use.
4. RLS must allow the requested row operation when RLS is enabled.

The current canary error proves step 1 is missing for `history_capture`.

### Determination 3 — exact schema/API setting or SQL grants required

Required API setting:

- Add `history_capture` to the Supabase Data API / API settings `Exposed schemas` list.

Required database privilege layer, if the browser anon client remains the writer identity:

- `GRANT USAGE ON SCHEMA history_capture TO anon;`
- `GRANT INSERT ON TABLE history_capture.historical_events TO anon;`
- No `SELECT`, `UPDATE`, or `DELETE` grant to `anon`.
- Add an `INSERT` RLS policy for `anon` on `history_capture.historical_events` that tightly validates canary/Phase 1A rows.

If authenticated users can also trigger the same client writer path, mirror the same minimum `USAGE` and `INSERT` grant for `authenticated` only if required by the deployed identity. Do not grant broader privileges preemptively.

`service_role` is normally privileged and server-side only. It should not be exposed to the browser and should not be used to justify broad client grants.

## Permission/RLS review

### Determination 5 — whether RLS/policies still prevent unauthorized reads/writes

RLS remains a required defense layer after schema exposure. However, RLS is not enough by itself:

- API schema exposure controls whether PostgREST can route requests to `history_capture`.
- Schema/table grants control whether `anon`/`authenticated` can touch the schema/table at all.
- RLS controls which rows and operations are allowed after privileges exist.

The storage migration enables RLS on all three tables but does not define policies. With RLS enabled and no insert policy, client inserts should remain blocked even after grants are added. A successful writer requires both the narrow grants and a matching insert policy.

### Determination 6 — anon/authenticated role requirements

For the current passive writer to insert into `historical_events` through the browser Supabase client, the active client role needs:

| Role/object | Minimum required if role is the writer | Not recommended |
| --- | --- | --- |
| `history_capture` schema | `USAGE` | Ownership or broad all-schema defaults |
| `history_capture.historical_events` | `INSERT` only | `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`, broad `ALL` |
| `history_capture.writer_monitoring_events` | No grant for V422/V423 unless DB monitoring persistence is separately approved | Preemptive `INSERT` or any `SELECT` |
| `history_capture.retention_runs` | No client grant | Any anon/authenticated access |

Recommended posture:

- Grant `USAGE` only to the role that truly performs the writer call.
- Grant `INSERT` only on `history_capture.historical_events` for the next canary fix.
- Do not grant `SELECT` to `anon` or `authenticated` for any `history_capture` table.
- Do not grant client access to `retention_runs`.
- Do not grant `writer_monitoring_events` access unless persistent monitoring is explicitly approved.

## Read-exposure risk review

### Determination 4 — whether exposing `history_capture` would expose reads unintentionally

Adding `history_capture` to `Exposed schemas` makes objects in that schema addressable by the Data API, but addressability is not the same as readable access. Reads still require:

1. Schema `USAGE`.
2. Table `SELECT` privilege.
3. A permissive RLS `SELECT` policy when RLS is enabled.

Risk exists if broad SQL such as `GRANT ALL ON ALL TABLES IN SCHEMA history_capture TO anon, authenticated` is applied, or if future default privileges accidentally expose new tables. That pattern is not recommended for Gridly historical capture because it would over-grant read/update/delete capabilities.

Safe read posture:

- No `SELECT` grants on `history_capture.historical_events` to `anon` or `authenticated`.
- No `SELECT` policies on historical tables.
- Maintainer/admin reads, if ever needed, should use controlled SQL/admin tooling or a separately reviewed server/RPC path, not app UI reads.

## Writer-only access options

### Option A — expose schema and grant direct table insert only

Description:

- Add `history_capture` to Data API exposed schemas.
- Grant `USAGE` on `history_capture` to the exact client role.
- Grant `INSERT` only on `history_capture.historical_events`.
- Add a narrow RLS insert policy.

Pros:

- Smallest change matching current writer code.
- Keeps V421 schema-scoped client path valid.
- Does not introduce new app frameworks or server infrastructure.

Cons:

- The entire schema becomes API-addressable, so grants/default privileges must stay disciplined.
- Requires careful RLS policy design.

### Option B — expose schema and also persist writer monitoring events

Description:

- Same as Option A, plus `INSERT` grant and RLS policy for `history_capture.writer_monitoring_events`.

Assessment:

- Not recommended for the immediate fix.
- Current repository evidence says JavaScript monitoring is in-memory only, and no database monitoring writer is required to resolve `PGRST106` for `historical_events`.
- Persisting monitoring events would enlarge the write surface and should be a separate milestone.

### Option C — no direct table exposure; use a controlled RPC/function

Description:

- Keep base tables inaccessible to client table endpoints.
- Expose a narrow function such as `record_history_capture_event(...)` and grant only `EXECUTE`.
- Function validates payload and inserts server-side, possibly as `SECURITY DEFINER` with a locked-down search path.

Pros:

- Smaller API surface than direct table endpoints.
- Can hide base tables from direct client table routes.
- Centralizes validation and append-only behavior.

Cons:

- Requires a new SQL function design/review.
- RLS does not apply inside privileged `SECURITY DEFINER` functions in the same way; function security must be reviewed carefully.
- More implementation risk than the minimum direct-schema fix.

## Writer monitoring events decision

### Determination 7 — same API path or in memory for now

`writer_monitoring_events` should remain in memory for now. V422 is focused on restoring the canary writer's ability to insert historical event evidence. Persistent monitoring writes are not needed to fix `PGRST106` and would expand production write scope.

Future persistent monitoring may be useful, but it needs its own approval for event shape, retention, grants, RLS policies, and operational visibility.

## Retention runs decision

### Determination 8 — retention_runs client accessibility

`history_capture.retention_runs` should remain completely non-client-accessible:

- No `USAGE`-derived practical access beyond schema-level routing.
- No table grants to `anon` or `authenticated`.
- No RLS policies for client roles.
- No UI/API path.

Retention bookkeeping belongs to maintainer-controlled jobs only and is not part of the canary writer fix.

## RPC/function alternative review

### Determination 9 — whether RPC is safer than exposing schema directly

A separate RPC can be safer long term if the project wants a single append-only ingestion endpoint instead of direct table access. It can also avoid exposing table routes. However, it is not the minimum safe fix because it requires new SQL/function code, explicit function grants, validation logic, and security-definer review.

Recommendation:

- Use direct schema exposure plus minimal insert-only grants/policy for the next milestone if speed and minimal code movement are priorities.
- Consider an RPC migration later if direct schema exposure becomes too broad or if maintainer validation should be centralized database-side.

## Minimum recommended fix

### Determination 10 — minimum safe change for next milestone

Minimum next milestone should be a manually reviewed, manually applied production-side change only:

1. Add `history_capture` to Supabase Data API exposed schemas.
2. Grant schema `USAGE` to the exact browser client role used by the canary writer (`anon` unless verified otherwise).
3. Grant `INSERT` only on `history_capture.historical_events` to that role.
4. Create a narrow `INSERT` RLS policy for that role on `history_capture.historical_events`.
5. Do not grant `SELECT`, `UPDATE`, `DELETE`, or `ALL` to `anon`/`authenticated`.
6. Do not grant client access to `writer_monitoring_events` or `retention_runs` in the immediate fix.
7. After the manual change is reviewed and applied in a future milestone, run one explicitly approved canary only; do not restart canary as part of this review.

## Draft SQL or dashboard-setting recommendation

### Dashboard setting recommendation

Manual future step, not performed by V422:

- Supabase Dashboard → Project Settings / Data API / API settings → `Exposed schemas` → add `history_capture`.

### Future/manual-review SQL draft only — do not execute in V422

The exact writer role must be verified before use. The version below assumes the browser canary uses `anon`. If the deployed writer uses `authenticated`, replace or supplement the role only after verification.

```sql
-- V422 DRAFT ONLY — DO NOT EXECUTE AS PART OF V422.
-- Purpose: minimum insert-only Data API access for passive historical canary writer.
-- Prerequisite: manually add history_capture to Supabase Data API exposed schemas.

begin;

-- Keep schema visible to the Data API role, but do not grant broad table privileges.
grant usage on schema history_capture to anon;

-- Allow append-only event insertion only.
grant insert on table history_capture.historical_events to anon;

-- Explicitly avoid read/update/delete client access.
revoke select, update, delete, truncate, references, trigger
  on table history_capture.historical_events
  from anon;

revoke all on table history_capture.writer_monitoring_events from anon;
revoke all on table history_capture.retention_runs from anon;

-- RLS insert policy draft. Tighten further if a stable canary marker or JWT claim is available.
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
    and jsonb_typeof(envelope) = 'object'
    and jsonb_typeof(payload) = 'object'
    and jsonb_typeof(metadata) = 'object'
  );

commit;
```

If `authenticated` is confirmed as the required canary role, create an equivalent role-specific grant/policy for `authenticated`. Do not grant both roles unless both are verified as necessary.

### Optional RPC draft direction — not recommended as immediate minimum

A future RPC approach should be packaged separately and reviewed for:

- `SECURITY DEFINER` ownership.
- Locked `search_path`.
- Explicit `EXECUTE` grant only to the required client role.
- Input validation inside the function.
- No direct table grants to `anon`/`authenticated`.
- Operational logging/rollback.

No RPC SQL is included here to avoid implying approval for a new database API surface.

## Protected-system review

V422 made no runtime changes and no SQL changes. The review does not alter:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness behavior
- markers
- Route Watch
- DriveTexas

The recommendation preserves Gridly as Awareness Platform First, Route Intelligence Second. Historical capture remains non-authoritative, append-only evidence storage and does not feed live awareness, alerts, markers, routing, or UI.

## Explicit non-approvals

V422 does not approve:

- Starting or restarting canary.
- Enabling capture.
- Enabling writer.
- Creating historical writes.
- Creating historical reads.
- Creating history UI.
- Running SQL.
- Running migrations.
- Applying the draft SQL.
- Broad `GRANT ALL` on `history_capture`.
- Any `SELECT` grant to `anon` or `authenticated` on historical tables.
- Client access to `retention_runs`.
- Persistent database writes to `writer_monitoring_events`.
- DriveTexas implementation work.
- Any change to awareness, alerts, markers, Route Watch, or protected live incident systems.

## Testing performed

V422 testing was limited to repository checks and static review commands. No production Supabase command, SQL, read, write, migration, or canary command was run.

Commands required for this milestone:

- `git status --short`
- `git diff --check`

JS-specific checks:

- Not applicable; no JavaScript files were changed.

## Recommended next milestone

Recommended next milestone: **V423 — Manual Historical Schema API Exposure Package**.

Scope should be limited to:

1. Verify the active canary writer role (`anon` vs. `authenticated`) without creating historical writes.
2. Prepare a final SQL package based on the V422 draft.
3. Manually add `history_capture` to Supabase exposed schemas.
4. Manually apply minimum insert-only grants and RLS policy for `historical_events`.
5. Confirm no `SELECT` grants/policies exist for client roles.
6. Keep `writer_monitoring_events` and `retention_runs` inaccessible to client roles.
7. Only after separate approval, run a single canary to verify `PGRST106` is resolved.

Success criteria for the next canary milestone should be narrowly defined as: the writer no longer fails with `PGRST106`; any subsequent grant/RLS/table error is captured and reviewed without broadening access automatically.
