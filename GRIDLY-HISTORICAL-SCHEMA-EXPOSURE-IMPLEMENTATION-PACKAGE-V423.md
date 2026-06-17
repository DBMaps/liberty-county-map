# GRIDLY Historical Schema Exposure Implementation Package V423

## Summary

V423 is an implementation-planning package only. It defines the minimum safe production-side change needed to allow the historical writer to insert append-only evidence rows into `history_capture.historical_events` after the live canary reached the Supabase/PostgREST schema exposure boundary.

Recommended approach: **Option A — expose `history_capture` through the Supabase Data API and add narrowly scoped insert-only grants plus an insert-only RLS policy for the verified writer role**.

This package does not execute SQL, does not change production settings, does not restart canary, does not activate capture or writer paths, does not perform historical reads or writes, and does not change awareness, alerts, markers, Route Watch, or any protected live incident system.

## Current blocker recap

Current canary result:

```text
errorCode: PGRST106
errorMessage: Invalid schema: history_capture
errorHint: Only the following schemas are exposed:
- public
- graphql_public
```

V422 established that the writer reached the intended path:

```text
Report → Capture Hook → Writer → Storage Target
```

The failure occurs before table-level authorization or RLS policy evaluation because PostgREST cannot route requests to `history_capture`. The target table remains:

```text
history_capture.historical_events
```

Therefore, V423 plans the minimum production-side API exposure and authorization posture required to allow the writer to attempt insert authorization safely.

## Option A review — schema exposure + grants + RLS

### Description

Option A exposes the existing `history_capture` schema to Supabase/PostgREST and grants only the minimum privileges needed for the verified writer role to insert rows into `history_capture.historical_events`.

Required elements:

1. Add `history_capture` to Supabase Data API exposed schemas.
2. Grant `USAGE` on schema `history_capture` to the verified writer role only.
3. Grant `INSERT` on table `history_capture.historical_events` to the verified writer role only.
4. Keep RLS enabled.
5. Add a narrow `INSERT` policy for accepted Phase 1A event rows only.
6. Do not grant `SELECT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` to browser/client roles.
7. Do not grant access to `history_capture.writer_monitoring_events` or `history_capture.retention_runs`.

### Security implications

Option A creates an addressable API surface for the `history_capture` schema. That is acceptable only if schema exposure is paired with disciplined privileges and RLS. Addressability alone should not allow reads or writes, but overly broad grants or permissive future default privileges could accidentally expand access.

Security posture:

- Least-privilege compatible.
- Requires explicit grant discipline.
- Requires continued avoidance of broad grants such as `GRANT ALL ON ALL TABLES IN SCHEMA history_capture`.
- RLS remains an independent control after grants are applied.

### Read exposure risk

Read exposure remains low if all of the following are true:

- No `SELECT` grant is given to `anon` or `authenticated` on `history_capture.historical_events`.
- No `SELECT` policy exists for client roles.
- No client grants are given for `writer_monitoring_events` or `retention_runs`.
- Future default privileges are not configured to grant reads automatically.

Risk increases if a future maintainer treats schema exposure as permission to grant broad table access. V423 explicitly rejects that pattern.

### Operational complexity

Option A is operationally simple:

- One Supabase dashboard setting change.
- A small SQL grant/revoke/policy package.
- No application writer code changes expected if the current schema-scoped writer remains in place.
- Future canary can test the same path after separate approval.

### Supabase compatibility

Option A matches Supabase/PostgREST behavior for non-public schemas:

- Custom schemas must be listed in exposed schemas.
- Roles must have `USAGE` on the schema.
- Roles must have table privileges.
- RLS must permit the operation.

### Historical writer compatibility

Option A is highly compatible with the current writer because the writer already targets `history_capture.historical_events` through the storage target path. The expected next writer behavior after Option A is applied is either a successful insert or a more specific grant/RLS/table validation error.

### Monitoring compatibility

Option A preserves current monitoring posture. It does not require persistent database writes to `writer_monitoring_events`. Existing in-memory diagnostics can continue to observe whether the writer advances past `PGRST106` in a separately approved canary.

### Retention compatibility

Option A does not expose `retention_runs` to client roles. Retention remains maintainer-controlled and separate from canary writer access.

### Future evidence-collection compatibility

Option A supports future append-only evidence collection by enabling direct inserts into the evidence table under RLS constraints. Additional event types should require separate policy review, not broad policy expansion by default.

### Future history-read compatibility

Option A does not pre-approve historical reads. Future history-read work would require separate grants, RLS `SELECT` policies, API design, UI approval, and governance review.

## Option B review — RPC / SECURITY DEFINER write-only path

### Description

Option B avoids direct table insert access from the client and instead creates a write-only RPC, for example `history_capture.record_historical_event(...)`, that validates inputs and inserts into `history_capture.historical_events` from inside a database function.

Required elements:

1. Add a database function/RPC with explicit input parameters or a validated JSON payload.
2. Use `SECURITY DEFINER` only if needed to avoid direct table grants.
3. Lock the function `search_path` to trusted schemas.
4. Own the function with a controlled database owner role that is not exposed to the browser.
5. Grant `EXECUTE` on the function only to the verified writer role.
6. Revoke direct table privileges from browser/client roles.
7. Change the historical writer to call `.rpc(...)` instead of `.schema('history_capture').from('historical_events').insert(...)`.

### Security implications

Option B can provide a smaller public API surface by exposing only a function rather than a direct table endpoint. It centralizes validation and can enforce append-only behavior inside the function.

However, `SECURITY DEFINER` increases review burden:

- Function owner privileges can bypass ordinary caller limitations.
- Unsafe `search_path` handling can create privilege-escalation risk.
- Validation bugs become database-side security bugs.
- RLS behavior must be reviewed carefully because a privileged function may not rely on the same caller-level RLS posture as direct table access.

### Read exposure risk

Option B has the lowest table-route read exposure because browser/client roles do not need direct table privileges. Reads remain unavailable if the function only inserts and returns a minimal status payload.

Read risk shifts from table grants to function design. The function must not return stored historical rows, generated payload echoes that include sensitive data, or diagnostic data that amounts to retention/history access.

### Operational complexity

Option B is operationally more complex:

- New SQL function design.
- Security-definer review.
- Function ownership review.
- Function grant review.
- Writer code changes.
- New tests for RPC invocation and error handling.
- Potential schema exposure question still remains for RPC access unless the function is placed in an already exposed schema, which could conflict with protected-system isolation.

### Supabase compatibility

Option B is compatible with Supabase RPC patterns, but it requires careful placement. If the RPC lives in `history_capture`, that schema must still be exposed for PostgREST RPC access. If the RPC lives in `public`, it avoids exposing `history_capture` as an API schema but introduces a public-schema bridge into protected historical storage.

### Historical writer compatibility

Option B is not directly compatible with the current writer. The writer would need to replace direct table insertion with RPC invocation, adapt payload mapping, and update diagnostics to distinguish RPC validation failures from storage insert failures.

### Monitoring compatibility

Option B can return controlled status/error codes for monitoring, but current monitoring would need updates to classify RPC failures correctly. This adds code-change scope to a milestone that is intended to be production-side only.

### Retention compatibility

Option B can keep retention fully isolated if the RPC only writes to `historical_events`. It must not access or return `retention_runs` data.

### Future evidence-collection compatibility

Option B can be a strong long-term ingestion boundary for evidence collection because the function can enforce database-side validation. It is better suited to a future milestone where writer behavior and validation contracts are intentionally redesigned.

### Future history-read compatibility

Option B does not help future history-read access directly. Reads would still require separate read APIs, grants, RLS policy, and UI/governance approval.

## Security comparison

| Dimension | Option A — exposed schema + grants + RLS | Option B — RPC / SECURITY DEFINER |
| --- | --- | --- |
| Least privilege | Strong if grants are insert-only and RLS is narrow | Strong if function is minimal and grants are execute-only |
| Privilege escalation risk | Mostly from broad grants/default privileges | Mostly from `SECURITY DEFINER`, owner privileges, and `search_path` mistakes |
| Validation location | RLS/table constraints/application payload | Function body plus table constraints |
| App code change required | No expected writer change | Yes, writer must call RPC |
| Review burden | Moderate | High |
| Immediate fit for `PGRST106` | Direct fit | Indirect redesign |

## Read-exposure comparison

Option A makes `history_capture` addressable through the Data API, but reads still require schema usage, table `SELECT`, and a matching RLS `SELECT` policy. With no `SELECT` grant and no `SELECT` policy, historical reads remain denied.

Option B can avoid direct table routes for browser/client roles, especially if the function is placed in an already exposed schema. However, a public-schema bridge function must be treated as a new API surface and must not return historical data.

Read-exposure conclusion: **Option B has the lower theoretical read surface, but Option A has acceptable read risk when implemented exactly as insert-only with explicit read denial and no read policies.**

## Operational comparison

Option A is the minimum production-side change:

- Expose schema.
- Apply grants/revokes.
- Apply one insert policy.
- Run a future canary only after separate approval.

Option B is a broader implementation package:

- Design and deploy function.
- Review security-definer safety.
- Modify writer code.
- Update diagnostics.
- Retest application behavior.

Operational conclusion: **Option A is the better fit for V423 because it resolves the known blocker without changing application code or expanding milestone scope.**

## Recommended approach

Recommend **Option A — schema exposure + insert-only grants + RLS**.

Rationale:

1. It directly addresses `PGRST106`.
2. It is compatible with the current historical writer path.
3. It preserves no historical reads, no history UI, no retention access, and no monitoring table writes.
4. It avoids introducing a privileged RPC before there is a clear need for database-side ingestion abstraction.
5. It keeps the next milestone focused on a manual, reviewable production-side fix.

Option B should remain a future design option if Gridly later needs centralized database-side validation, a single ingestion contract, or a stricter function-only write boundary.

## Draft implementation steps

Manual review required before any production action:

1. Verify the active writer role without performing historical writes.
   - Expected role is `anon` if the writer uses the browser anon Supabase client.
   - Use `authenticated` only if verified as necessary.
   - Do not grant both roles unless both are verified as required.
2. Confirm no historical reads are approved.
3. Confirm no access is being granted to `writer_monitoring_events` or `retention_runs`.
4. Add `history_capture` to Supabase Data API exposed schemas.
5. Apply the reviewed SQL package for the verified role only.
6. Confirm grants and policies by metadata inspection only, not by historical reads or writes.
7. Do not restart canary until a separate milestone explicitly approves one canary run.

## Draft SQL — NOT EXECUTED, MANUAL REVIEW REQUIRED

The SQL below is a draft implementation artifact only. It was not executed in V423 and must not be copied into production without manual review, role verification, and change approval.

This draft assumes the verified writer role is `anon`. Replace `anon` with `authenticated` only if the deployed writer identity is verified as `authenticated`.

```sql
-- V423 DRAFT ONLY — NOT EXECUTED.
-- MANUAL REVIEW REQUIRED BEFORE ANY PRODUCTION USE.
-- Purpose: minimum insert-only access for the historical evidence writer.
-- Prerequisite: manually add history_capture to Supabase Data API exposed schemas.
-- Assumption: the verified writer role is anon.

begin;

-- Allow the verified writer role to resolve objects in the exposed schema.
grant usage on schema history_capture to anon;

-- Allow append-only insertion into the evidence table.
grant insert on table history_capture.historical_events to anon;

-- Explicitly deny browser/client read and mutation privileges beyond INSERT.
revoke select, update, delete, truncate, references, trigger
  on table history_capture.historical_events
  from anon;

-- Do not expose monitoring persistence or retention bookkeeping to client roles.
revoke all on table history_capture.writer_monitoring_events from anon;
revoke all on table history_capture.retention_runs from anon;

-- Keep RLS enabled on protected historical tables.
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

### Optional authenticated-role variant — NOT EXECUTED

Use this only if `authenticated` is verified as the writer role. Do not apply preemptively.

```sql
-- V423 DRAFT ONLY — NOT EXECUTED.
-- MANUAL REVIEW REQUIRED BEFORE ANY PRODUCTION USE.
-- Apply only if authenticated is verified as the writer role.

grant usage on schema history_capture to authenticated;
grant insert on table history_capture.historical_events to authenticated;

revoke select, update, delete, truncate, references, trigger
  on table history_capture.historical_events
  from authenticated;

revoke all on table history_capture.writer_monitoring_events from authenticated;
revoke all on table history_capture.retention_runs from authenticated;
```

## Option B draft artifacts — not recommended for V423

These artifacts are included for comparison only and are not the recommended implementation path.

### RPC definition posture — NOT EXECUTED

```sql
-- V423 OPTION B DRAFT ONLY — NOT EXECUTED.
-- MANUAL REVIEW REQUIRED.
-- Not recommended as the immediate fix.

create or replace function history_capture.record_historical_event(
  p_schema_version text,
  p_phase text,
  p_event_type text,
  p_idempotency_key text,
  p_observed_at timestamptz,
  p_envelope jsonb,
  p_payload jsonb,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = history_capture, pg_temp
as $$
begin
  if p_schema_version <> 'history_capture.phase_1a.v1'
     or p_phase <> '1A'
     or p_event_type not in ('report_created', 'report_cleared')
     or p_idempotency_key is null
     or p_observed_at is null
     or jsonb_typeof(p_envelope) <> 'object'
     or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_metadata) <> 'object'
  then
    raise exception 'invalid historical event payload';
  end if;

  insert into history_capture.historical_events (
    schema_version,
    phase,
    event_type,
    idempotency_key,
    observed_at,
    envelope,
    payload,
    metadata
  ) values (
    p_schema_version,
    p_phase,
    p_event_type,
    p_idempotency_key,
    p_observed_at,
    p_envelope,
    p_payload,
    p_metadata
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function history_capture.record_historical_event(
  text, text, text, text, timestamptz, jsonb, jsonb, jsonb
) from public;

grant execute on function history_capture.record_historical_event(
  text, text, text, text, timestamptz, jsonb, jsonb, jsonb
) to anon;
```

### Required writer changes for Option B

If Option B is chosen in a future milestone, the writer must be changed from direct table insert to RPC invocation:

- Replace `.schema('history_capture').from('historical_events').insert(...)` with `.schema('history_capture').rpc('record_historical_event', ...)` or a public-schema RPC variant.
- Preserve existing diagnostic stages.
- Add RPC-specific failure classification.
- Ensure the RPC does not return historical row contents.
- Add application tests for payload mapping and RPC error handling.

## Protected-system review

V423 changes only a planning document. It does not alter or authorize changes to:

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

Gridly remains Awareness Platform First, Route Intelligence Second. Historical capture remains non-authoritative evidence storage and must not feed live awareness, alerting, marker behavior, routing, retention access, or UI without separate approval.

## Explicit non-approvals

V423 does not approve:

- Executing SQL.
- Applying production settings.
- Adding `history_capture` to exposed schemas without separate production approval.
- Starting or restarting canary.
- Activating capture.
- Activating writer behavior.
- Creating historical writes.
- Creating historical reads.
- Creating history UI.
- Granting `SELECT` to `anon` or `authenticated` on historical tables.
- Granting `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `ALL` to client roles on historical tables.
- Granting client access to `history_capture.writer_monitoring_events`.
- Granting client access to `history_capture.retention_runs`.
- Persistent monitoring writes.
- Retention reads or retention controls through the app.
- Awareness changes.
- Alert changes.
- Marker changes.
- Route Watch changes.
- DriveTexas changes.
- Destructive SQL.

## Testing performed

V423 testing was limited to local repository checks and document review. No production command, Supabase command, SQL execution, historical read, historical write, migration, canary execution, capture activation, or writer activation was performed.

Commands used:

- `git status --short`
- `git diff --check`

## Recommended next milestone

Recommended next milestone: **V424 — Manual Historical Schema Exposure Approval and Controlled Application Plan**.

Proposed V424 scope:

1. Confirm the writer role (`anon` vs. `authenticated`) without historical writes.
2. Review the V423 Option A SQL package.
3. Approve or reject adding `history_capture` to Supabase exposed schemas.
4. If approved, apply only the minimum insert-only grants and RLS policy for the verified role.
5. Verify metadata only: exposed schema setting, grants, and policy presence.
6. Confirm no client `SELECT` access exists.
7. Confirm no client access exists for `writer_monitoring_events` or `retention_runs`.
8. Defer any canary restart to a separate, explicitly approved canary milestone.
