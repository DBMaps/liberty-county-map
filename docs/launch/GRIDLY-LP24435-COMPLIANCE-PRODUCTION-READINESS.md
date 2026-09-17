# Gridly LP244.35 Compliance Production Readiness

Audit date: 2026-09-17

Production project: `nhwhkbkludzkuyxmkkcj` (`Gridly Platform`, `us-east-1`)

Audited migration: `supabase/migrations/20260916183911_google_play_compliance_closure.sql`

Production access used by this audit: catalog/data reads inside explicit `READ ONLY` transactions only

## 1. Migration hash

SHA-256:

```text
01D37B7EF8A7D4F1D2A2B53EF80AE76C0037E5327ECA12596FD26DD723D4FDF4
```

This hash is the deployment identity. The owner must re-compute it immediately before deployment and stop if it differs.

## 2. Production preflight

Result: **PASS**.

| Check | Read-only production result |
|---|---|
| PostgreSQL | `17.6` (project engine `17.6.1.105`) |
| Target migration ledger | `20260916183911` absent |
| Required predecessors | `20260908200554` and `202609160001` present |
| `public.reports` | Present, RLS enabled, estimated/actual row count `0` |
| Required columns | `id`, `cleanup_after`, `linkage_deadline`, and `device_id` present |
| `moderation_state` | Absent |
| `report_retention.device_links` | Present; row count `0` |
| `report_retention.admission_state` | Present; protocol `2`; `reporting_enabled=false` |
| Existing reporting RPCs | Submit, mutate, cancel, and status RPCs present |
| Target schemas | `moderation` and `privacy_ops` absent |
| Target function names | No collisions |
| API roles | `anon`, `authenticated`, and `service_role` present; all are non-login roles |
| Required crypto | `extensions.pgcrypto 1.3`; both `digest(...)` overloads and `gen_random_uuid()` present |
| Spatial dependency | `extensions.postgis 3.3.7` present; migration does not change it |
| Retention health | `succeeded`; overdue cleanup `0`; breached deadlines `0` |

Current production migration history ends with `202609160001_lp24429a_reporting_availability_contract`; the target is not recorded. The current reporting function definition MD5 values are frozen for postflight comparison:

```text
public.cancel_community_operation(text)                         0fcaa36d41beebee7b39935098fd4ddf
public.get_community_reporting_status()                        e8dfa42f1b9f69627d20fee71203cb59
public.mutate_community_observation(text,uuid,text,jsonb,text)  75ccf495e03ffc3d2e5efce1fc48ddb4
public.submit_community_observation(text,jsonb,text)            87cb55d3cf2dab858baef30d615645ff
```

## 3. Schema dependencies

The exact local PostgreSQL 17 rehearsal established this dependency order:

1. The LP244.21 baseline fixture creates `public.reports`, API roles, extensions, and predecessor public policies.
2. The LP244.22A transition creates the accepted retention boundary, private device linkage, admission state, protocol-v2 writers, replay evidence, and cleanup behavior.
3. `202609160001` adds the bounded reporting-status RPC without enabling reporting.
4. `20260916183911` adds moderation/privacy state and replaces only `report_retention.public_report(uuid)` so hidden or expired rows cannot escape through existing writers.

No PostGIS operation is introduced. UUID generation and SHA-256 digests resolve through the already-installed `extensions.pgcrypto` functions. The target's five-second lock timeout, 60-second statement timeout, transaction-scoped advisory lock, explicit object qualification, and single transaction make lock failure fail closed without a partial schema.

## 4. Privilege / RLS review

Result: **PASS**.

- `public.reports` has RLS enabled. Its existing read posture is two permissive `SELECT` policies plus the restrictive `report_retention_read_boundary` policy. PostgreSQL combines permissive policies with `OR`, then combines restrictive policies with `AND`; the new restrictive `moderation_public_visibility_boundary` therefore adds `moderation_state = 'visible'` without weakening the retention boundary.
- The new policy is `SELECT`-only. It does not alter insert/update/delete policy behavior or the protocol-v2 writer path.
- Production has no `anon`, `authenticated`, or `service_role` grants on private retention/history tables.
- The migration revokes all table and sequence privileges in `moderation` and `privacy_ops` from `PUBLIC` and all API roles. RLS is also enabled on every new private table with no public policies, providing a second fail-closed boundary.
- The public wrappers are `SECURITY INVOKER`. They require narrowly scoped `USAGE` plus `EXECUTE` on the two private implementation functions for `anon` and `authenticated`; those schemas are not added to the Data API exposed-schema configuration by this migration. `service_role` receives neither wrapper nor helper execution.
- `moderation.apply_action`, `privacy_ops.complete_deletion_request`, and `moderation.run_compliance_cleanup` receive no API-role execution. Private tables, sequences, source digests, operation digests, notes, and device linkage receive no API grants.
- The public projection omits `device_id`, `original_submitted_at`, `linkage_deadline`, `cleanup_after`, and `moderation_state`; ordinary clients retain no column privilege on private identifiers.

Immediately before deployment, the owner must confirm in Supabase API settings that `moderation` and `privacy_ops` have not been manually added as exposed schemas. This migration does not add them. With the production/default exposed-schema boundary intact, the only new Data API RPC routes are the two public wrappers listed below.

The current Supabase security advisor reports only pre-existing intentional notices: RLS-without-policy on private fail-closed tables and warnings for the four existing public protocol/status `SECURITY DEFINER` functions. It reports no target-migration object because the target is not deployed. Advisor remediation reference: <https://supabase.com/docs/guides/database/database-linter>.

## 5. Retention interaction

Result: **PASS**.

| Contract | Verified target behavior |
|---|---|
| Report cleanup | Existing `cleanup_after = original_submitted_at + 149 days` remains authoritative |
| Device linkage | Existing `linkage_deadline = original_submitted_at + 180 days`; target never writes a later value |
| Report deletion | `privacy_ops.complete_deletion_request(..., 'delete', ...)` deletes `public.reports`; the existing FK cascade deletes `report_retention.device_links` and observation receipts atomically |
| Complaint evidence | Default 148 days; constraint caps `retain_until` at creation +149 days |
| Deletion requests | Default 148 days; constraint caps at creation +149 days; completion shortens to at most 90 days from completion |
| Source suppression | Constraint caps at 180 days; action uses `least(report.linkage_deadline, now()+180 days)`; conflict resolution can only shorten an existing expiry |
| Action evidence | Capped at creation +180 days; target chooses complaint retention +31 days, which is at most 180 days |
| Cleanup order | Suppressions; complaint link/digest clearing; expired action evidence; complaints; deletion link/digest clearing; deletion requests |

Moderation/deletion requests do not modify a report's original submission time, linkage deadline, or cleanup deadline. Source suppression cannot outlive the source report's accepted linkage deadline. No path in the target extends private linkage.

## 6. Reporting fail-closed review

Result: **PASS**.

- Production is currently `reporting_enabled=false` and protocol version `2`.
- The target migration contains no update to admission state and no reporting enablement statement.
- Complaint and deletion RPCs can only reference an existing, non-expired report; neither inserts a community report.
- Source suppression is a `BEFORE INSERT` rejection boundary. It does not modify public reads, retained reports, or existing protocol-v2 idempotency/replay state.
- Existing submit/mutate/cancel/status writer definitions are not replaced by this migration. Pending-operation, retry, cancellation, and maintenance semantics remain unchanged.
- The target's replacement of `report_retention.public_report(uuid)` only adds visible/non-expired filters and preserves the previous bounded output keys.

## 7. Public API surface

The exact newly exposed ordinary-client Data API surface, assuming the standard production exposed-schema configuration remains unchanged, is:

| Function | Grants | Bounded result and controls |
|---|---|---|
| `public.submit_community_moderation_report(text, uuid, text, text)` | `EXECUTE` to `anon`, `authenticated`; none to `PUBLIC`, `service_role` | Returns only `status`. UUID-v4 operation id, six fixed reasons, device length 1-128, operation idempotency, 10 complaints/hour/device digest, 24-hour duplicate suppression, and missing/hidden/expired target rejection. No row, device id, digest, or notes are returned. |
| `public.request_community_report_deletion(text, uuid, text)` | `EXECUTE` to `anon`, `authenticated`; none to `PUBLIC`, `service_role` | Returns only `status` and, for accepted/idempotent requests, request UUID. UUID-v4 operation id, device length 1-128, operation idempotency, live-target requirement, and exact same-device linkage verification. Cross-device requests return `forbidden`. No report row, raw device id, digest, or internal request row is returned. |

Allowed complaint reasons are `dangerous_content`, `false_information`, `harassment`, `hate_or_abuse`, `spam`, and `other`. Returned complaint statuses are bounded to `invalid_request`, `already_processed`, `gone`, `rate_limited`, `accepted`, or `retryable_failure`. Deletion statuses are bounded to `invalid_request`, `already_processed`, `forbidden`, `accepted`, or `retryable_failure`.

The owner-only functions remain in non-exposed schemas and have no execution grant for `anon`, `authenticated`, or `service_role`.

## 8. Disposable rehearsal

Result: **PASS** on a new disposable PostgreSQL `17` cluster bound only to `127.0.0.1:55441`.

The rehearsal applied the baseline/authorization markers, LP244.22A retention transition, `202609160001`, and the exact hashed target in order. It exercised:

- clean migration from fresh state;
- private-table and owner-function denial for all API roles;
- bounded/idempotent complaints without plaintext identifiers;
- quarantine and remove visibility behavior;
- immutable action evidence;
- source suppression of current and future rows;
- same-device deletion and cross-device rejection;
- atomic report/device-link deletion;
- 149/180/90-day retention bounds; and
- dependency-ordered cleanup without deleting a still-live report.

All 45 combined database/retention/protocol/availability tests passed after current native assets were staged. The first combined run exposed only an ignored generated Android service-worker line-ending mismatch; the normal `build:native-web` plus `cap copy android` staging flow removed it. No tracked runtime file was changed by that staging.

The target is intentionally one-shot. It contains non-idempotent `ADD COLUMN`, policy, table, trigger, and function creation statements. Normal Supabase deployment consults `supabase_migrations.schema_migrations`; once `20260916183911` is recorded, it is not planned again. Do not manually delete that ledger row or directly replay the SQL. A correction or rollback must be a later forward migration.

## 9. Test results

| Gate | Result |
|---|---|
| LP244.33 database + retention + submission protocol + reporting availability | PASS — 45/45 |
| LP244.33 app/browser | PASS |
| Android fast | PASS — 56/56 |
| Native packaging | PASS |
| Startup manifest | PASS |
| Weather/KBYG | PASS |
| Crossing popup portrait containment | PASS |
| Search/POI | PASS after repairing one obsolete LP244.29A cache-name assertion to the current LP244.33 authority |
| LP244.35 artifact/hash contract | PASS |

There are zero new failures. The migration file was not modified.

## 10. Production postflight SQL

Run this only after an owner-authorized deployment. It is exact, read-only, and makes no reporting or retention-state changes.

```sql
begin read only;
set local statement_timeout = '20s';
set local lock_timeout = '5s';
set local search_path = pg_catalog;

with expected_writers(signature, expected_md5) as (
  values
    ('public.cancel_community_operation(text)', '0fcaa36d41beebee7b39935098fd4ddf'),
    ('public.get_community_reporting_status()', 'e8dfa42f1b9f69627d20fee71203cb59'),
    ('public.mutate_community_observation(text,uuid,text,jsonb,text)', '75ccf495e03ffc3d2e5efce1fc48ddb4'),
    ('public.submit_community_observation(text,jsonb,text)', '87cb55d3cf2dab858baef30d615645ff')
), writer_check as (
  select e.signature, e.expected_md5,
         md5(pg_get_functiondef(to_regprocedure(e.signature))) as actual_md5
  from expected_writers e
), api_roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role')
)
select jsonb_pretty(jsonb_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'target_migration_recorded', exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20260916183911'
  ),
  'schemas_exist', to_regnamespace('moderation') is not null
                      and to_regnamespace('privacy_ops') is not null,
  'moderation_state_exists', exists (
    select 1 from pg_attribute
    where attrelid = 'public.reports'::regclass
      and attname = 'moderation_state' and attnum > 0 and not attisdropped
  ),
  'rls', jsonb_build_object(
    'reports', (select relrowsecurity from pg_class where oid='public.reports'::regclass),
    'complaints', (select relrowsecurity from pg_class where oid='moderation.complaints'::regclass),
    'action_log', (select relrowsecurity from pg_class where oid='moderation.action_log'::regclass),
    'source_suppressions', (select relrowsecurity from pg_class where oid='moderation.source_suppressions'::regclass),
    'deletion_requests', (select relrowsecurity from pg_class where oid='privacy_ops.deletion_requests'::regclass)
  ),
  'restrictive_read_policies', (
    select jsonb_agg(jsonb_build_object('name',policyname,'mode',permissive,'qual',qual) order by policyname)
    from pg_policies where schemaname='public' and tablename='reports'
      and policyname in ('report_retention_read_boundary','moderation_public_visibility_boundary')
  ),
  'public_wrapper_grants', jsonb_build_object(
    'anon_moderation', has_function_privilege('anon','public.submit_community_moderation_report(text,uuid,text,text)','EXECUTE'),
    'authenticated_moderation', has_function_privilege('authenticated','public.submit_community_moderation_report(text,uuid,text,text)','EXECUTE'),
    'service_moderation', has_function_privilege('service_role','public.submit_community_moderation_report(text,uuid,text,text)','EXECUTE'),
    'anon_deletion', has_function_privilege('anon','public.request_community_report_deletion(text,uuid,text)','EXECUTE'),
    'authenticated_deletion', has_function_privilege('authenticated','public.request_community_report_deletion(text,uuid,text)','EXECUTE'),
    'service_deletion', has_function_privilege('service_role','public.request_community_report_deletion(text,uuid,text)','EXECUTE')
  ),
  'owner_function_api_grants', (
    select jsonb_agg(jsonb_build_object(
      'role', role_name,
      'apply_action', has_function_privilege(role_name,'moderation.apply_action(uuid,text,text)','EXECUTE'),
      'complete_deletion', has_function_privilege(role_name,'privacy_ops.complete_deletion_request(uuid,text,text)','EXECUTE'),
      'cleanup', has_function_privilege(role_name,'moderation.run_compliance_cleanup()','EXECUTE')
    ) order by role_name) from api_roles
  ),
  'private_table_api_grant_count', (
    select count(*) from information_schema.role_table_grants
    where table_schema in ('moderation','privacy_ops')
      and grantee in ('anon','authenticated','service_role')
  ),
  'private_report_column_grant_count', (
    select count(*) from information_schema.role_column_grants
    where table_schema='public' and table_name='reports'
      and column_name in ('device_id','original_submitted_at','linkage_deadline','cleanup_after','moderation_state')
      and grantee in ('anon','authenticated','service_role')
  ),
  'reporting_enabled', (
    select reporting_enabled from report_retention.admission_state where singleton
  ),
  'counts', jsonb_build_object(
    'reports', (select count(*) from public.reports),
    'device_links', (select count(*) from report_retention.device_links),
    'complaints', (select count(*) from moderation.complaints),
    'action_log', (select count(*) from moderation.action_log),
    'source_suppressions', (select count(*) from moderation.source_suppressions),
    'deletion_requests', (select count(*) from privacy_ops.deletion_requests)
  ),
  'retention_health', (
    select jsonb_build_object('last_status',last_status,
      'overdue_cleanup_count',overdue_cleanup_count,
      'breached_deadline_count',breached_deadline_count)
    from report_retention.health limit 1
  ),
  'writer_definitions', (
    select jsonb_agg(jsonb_build_object('signature',signature,'expected_md5',expected_md5,
      'actual_md5',actual_md5,'unchanged',actual_md5=expected_md5) order by signature)
    from writer_check
  )
));

rollback;
```

Required postflight values are: transaction read-only `on`; migration/schemas/column/RLS `true`; both policies present and `RESTRICTIVE`; wrapper grants `true` only for `anon` and `authenticated`; every owner-function grant `false`; both private grant counts `0`; reporting `false`; report/device-link counts still `0` relative to this audit baseline; all four new evidence-table counts `0`; retention health still succeeded with zero overdue/breached rows; and every writer hash unchanged.

Also re-run the Supabase security advisor after deployment and confirm the new private tables produce no privilege/exposure finding. RLS-without-policy informational findings on deliberately inaccessible private tables are expected.

## 11. Rollback plan

### Safe immediate rollback before the first complaint or deletion request

Use a new, later, owner-reviewed migration. Do not delete `20260916183911` from the migration ledger and do not replay it. The rollback migration must first lock the four evidence tables and abort unless all are empty. It can then:

1. revoke both public wrapper grants and both internal helper grants;
2. drop the two public wrappers;
3. drop `report_moderation_source_suppression` from `public.reports`;
4. drop `moderation_public_visibility_boundary` and `reports_moderation_state_cleanup_idx`;
5. restore the predecessor definition of `report_retention.public_report(uuid)` (the same bounded JSON keys, selecting by `r.id=report_id` without the LP244.35 moderation predicate);
6. drop `privacy_ops` and `moderation` with their contained functions/tables/triggers;
7. drop `reports_moderation_state_check` and `public.reports.moderation_state`; and
8. verify reporting remains false, report/device-link counts are unchanged, RLS remains enabled, and the four writer hashes still match this report.

The forward rollback migration should begin with this evidence guard:

```sql
lock table moderation.complaints, moderation.action_log,
  moderation.source_suppressions, privacy_ops.deletion_requests
  in access exclusive mode;

do $guard$
begin
  if exists (select 1 from moderation.complaints)
     or exists (select 1 from moderation.action_log)
     or exists (select 1 from moderation.source_suppressions)
     or exists (select 1 from privacy_ops.deletion_requests) then
    raise exception 'LP244.35 rollback refused: moderation/deletion evidence exists';
  end if;
end
$guard$;
```

### Conditional rollback after data exists

Do not drop either schema. First revoke the two public wrapper grants to stop new intake, leave hidden reports hidden, stop new owner actions, and preserve current cleanup/retention behavior. Determine whether evidence must be retained, exported under an approved legal/security procedure, or allowed to age out. Only after all evidence tables are empty may the immediate rollback migration be used. Removing source suppression would re-enable suppressed sources and must be an explicit owner risk decision.

### Irreversible implications

Reports already deleted by a verified deletion completion cannot be reconstructed by rollback. Dropping complaint, action, suppression, or deletion-request tables after evidence exists destroys audit/security evidence and may violate the accepted retention purpose. Quarantined/removed states must not be erased merely to make content visible again. These consequences make schema-drop rollback unsafe after first use.

## 12. Remaining risks

- Production deployment still requires an owner-authorized maintenance window and immediate postflight; this audit did not deploy.
- The owner must confirm the Supabase Data API exposed-schema list still excludes `moderation` and `privacy_ops`. This is external platform configuration, not changed by the SQL migration.
- `ALTER TABLE public.reports ADD COLUMN ... DEFAULT` takes a table lock. Production currently has zero report rows, and the migration has a five-second lock timeout, so contention fails closed rather than waiting indefinitely.
- Existing duplicate permissive policies on `public.reports` generate a performance advisor warning. The new restrictive policy remains logically safe and does not increase permissive-policy count. Policy cleanup is outside LP244.35.
- The exact migration is one-shot; accidental direct SQL replay would fail. Deploy only through the migration ledger path.
- The public complaint endpoint is intentionally unauthenticated for the no-account product. Its digest-only rate limit is per device-provided identifier and is abuse friction, not strong identity proof.

None is a material blocker to owner-authorized deployment when the stated pre/postflight controls are followed.

## 13. Files changed

- `docs/launch/GRIDLY-LP24435-COMPLIANCE-PRODUCTION-READINESS.md` — this production-readiness record.
- `tests/lp24435-compliance-production-readiness.test.mjs` — freezes the migration hash and required readiness/postflight/rollback evidence.
- `tests/lp2445c-consumer-visual-search-closure.test.mjs` — updates one stale LP244.29A cache assertion to the already-current LP244.33 service-worker authority.

The target migration is unchanged.

## 14. Commit

Commit message: `Prepare compliance production deployment readiness`. The immutable commit identifier is recorded in the mission handoff after commit creation.

## 15. Push

Target branch: `LP244.35-compliance-production-readiness`. Push status is recorded in the mission handoff. No merge is part of this mission.

## 16. Production safety

Production was inspected only through explicit read-only catalog/data queries. No production migration was applied, no row was written, `reporting_enabled` was not changed, no report was published, no retention state was altered, and no application or Play deployment occurred.

## 17. Final verdict

**A. READY FOR OWNER-AUTHORIZED PRODUCTION DEPLOYMENT**

This verdict applies only to the exact migration hash above, after the owner confirms the exposed-schema boundary, and subject to running the exact read-only postflight immediately after deployment.
