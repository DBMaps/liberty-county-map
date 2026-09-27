# LP244.66 Window 1 — production read-only preflight result

**Observation window:** September 27, 2026, 23:24–23:36 UTC. **Verdict: NOT READY FOR WINDOW 2.** The live subscription schema and migration ledger are clear for a later proposal, but current backup/PITR evidence and an exact-one migration dry run are missing. This result authorizes no migration, secret, deployment, scheduler, store purchase, paid admission or reporting activation.

## 1. Source and query boundary

Branch `LP244.66-production-subscription-verification-admission`; starting HEAD `979d157c5cf86290523248f2826699bd656fd85c`; initial working tree clean. The committed [LP244.66C preflight artifact](review/LP24466C-PRODUCTION-PREFLIGHT-READONLY.sql) was read before connection and parsed into **17 statements, each beginning `SELECT` or `WITH`**. It contains no INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, GRANT, REVOKE, TRUNCATE, CALL/DO, Cron or secret mutation. The conditional `cron.job` SELECT ran only after `pg_cron` was found. No artifact statement was changed. The historical command text in the Cron query was compared as a boolean and was never returned raw.

SHA-256 is of the **committed Git blob bytes**, which are the proposed migration bytes. Windows checkout line endings were accounted for without editing a file:

| Proposed file | Committed SHA-256 | Checkout observation |
| --- | --- | --- |
| `20260926205345_lp24462_store_entitlement_cache.sql` | `4ed076fe114e6d69b8104ea1e6de10c71031f7310d6a2bbbb2cd784158f24e6a` | Raw CRLF checkout hash `dec74ae2a664358a0de2cbfa74a23db24ca04e3bdb53abfd9a84c11e350a1fba`; **CRLF→LF only** reproduces the committed bytes/hash. |
| `20260927204849_lp24466_google_acknowledgment_queue.sql` | `53f9e93fbbf9f9acf831a8e301d8594a4b016f0fc1b25a227aead561c4125270` | Raw checkout bytes already equal committed bytes. |

Access used the configured Supabase connector with project ID `nhwhkbkludzkuyxmkkcj`. `get_project` returned **Gridly Platform**, region `us-east-1`, status `ACTIVE_HEALTHY`, ID/ref matching the expected production project. The project URL host matched `nhwhkbkludzkuyxmkkcj.supabase.co`; the private guard's project-ref comparison also returned true. SQL was executed only against that explicit ID. No credential, service key, password or connection string was retrieved or printed. Database identity SELECT reported `postgres`, inspecting role `postgres`, PostgreSQL `17.6`, and 23:24:45.759829 UTC. This is project identity proof at that observation time, not backup proof.

**Supplemental read-only checks:** The committed artifact did not include extension versions, private-table RLS summary, health-function definition, a cleanup-health call, or a broad relevant-job-name inventory. To meet the authorized Window 1 scope without editing its query set, separate connector `list_extensions`/`list_tables` reads and fixed catalog/health SELECTs were used. The live `public.gridly_cleanup_alert_health()` definition was inspected first: `STABLE`, `SECURITY DEFINER`, postgres owner, empty `search_path`, and a `WITH ... SELECT` body with no DML/DDL/call. Only then was the two-row bounded read-only health RPC selected. Another catalog SELECT returned owner/security-definer/search-path metadata for that function and `get_community_reporting_status()`. A final `cron.job` SELECT returned only job name/schedule/active for up to 30 names matching `gridly|subscription|entitlement|google`; it found only the two cleanup jobs. No writer RPC or cleanup routine was invoked.

For auditability, the four distinct supplemental SQL statements were exactly:

```sql
SELECT p.provolatile,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.oid=to_regprocedure('public.gridly_cleanup_alert_health()');

SELECT subsystem,job_state,latest_run_state,latest_run_at,last_success_at,
       retention_state,compliance_health_state,report_overdue_count,
       report_breached_count,compliance_late_processed_count,compliance_late_processed_at
FROM public.gridly_cleanup_alert_health();

SELECT p.proname,p.prosecdef,p.proconfig,owner.rolname AS owner_role
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_roles owner ON owner.oid=p.proowner
WHERE n.nspname='public' AND p.proname IN
 ('get_community_reporting_status','gridly_cleanup_alert_health')
ORDER BY p.proname;

SELECT jobname,schedule,active FROM cron.job
WHERE jobname ~* 'gridly|subscription|entitlement|google'
ORDER BY jobname LIMIT 30;
```

## 2. Live migration ledger and admission

The full production ledger contained **17 rows / 17 distinct versions**, each once, with no unexpected, missing or duplicate entry:

`202606070001`, `202606110001`, `202606160001`, `202606160002`, `202606170410`, `202606170411`, `202606170425`, `202606170426`, `202607280100`, `202607290100`, `202607290200`, `202609080001`, `202609080002`, `20260908200554`, `202609160001`, `20260916183911`, `20260926021558`.

The committed expected-versus-actual query classified all 17 `expected_once`. The direct proposed-version query returned zero rows: **cache `20260926205345` = ABSENT; acknowledgment `20260927204849` = ABSENT.** Neither is present or colliding in the ledger. This is a snapshot only; repeat immediately before any later authorized migration.

`report_retention.admission_state` returned one row: `protocol_version=2`, `reporting_enabled=false`, `changed_at=2026-09-09 16:13:48.113011+00`. `gridly_control.prelaunch_reset_authorization` returned one matching-project row: `status=consumed`, `consumed_at=2026-09-09 16:13:47.849122+00`, `launched_at=NULL`. A final read after all other checks returned the **same** values/timestamps. No reporting or guard change was performed. LP244.54 and LP244.65 remain closed; the historical LP244.22 reset/repair must not be replayed.

## 3. Object, grant, RLS and extension collision review

`subscription_ops` schema is **ABSENT**. All three proposed private tables are **ABSENT**: `store_entitlements`, `google_ack_work`, `google_ack_health`. All ten proposed functions/RPCs named in the preflight artifact are **ABSENT**. Consequently their proposed private-schema indexes, table constraints, triggers and policies cannot already exist there; no colliding subscription table/index/constraint/policy or data row was found. The catalog estimate query returned no subscription tables. **Affected preexisting row count: zero by object absence**, not by scanning sensitive rows. No unexpected subscription table with nonzero rows exists. Existing admission and guard each returned one bounded control row, not customer data.

The four relevant roles exist. `anon` and `authenticated` have `rolbypassrls=false`, no login; `service_role` has bypass RLS but no login; `postgres` has login and bypass RLS. Membership rows show `authenticator` and `postgres` are members of anon/authenticated/service_role; **anon/authenticated are not members of service_role** in the returned relevant graph. Existing `public` schema USAGE is true for anon/authenticated/service_role. The proposed `subscription_ops` schema is absent, so it has no current grants. Current default ACL rows exist for `public` and `storage`, including broad defaults for some new objects; there was **no global or `subscription_ops` default ACL row**. This is not a grant on a proposed object. The reviewed migrations explicitly revoke direct rights on their new private tables/schema/functions and postcheck the effective client denial. Recheck all ACLs after application; the source postcheck is not a substitute for live postflight.

Existing bounded status RPC `public.get_community_reporting_status()` is executable by anon/authenticated but not service_role; it is postgres-owned `SECURITY DEFINER` with `search_path=pg_catalog`. Existing `public.gridly_cleanup_alert_health()` is service_role-only among those three roles, postgres-owned `SECURITY DEFINER`, empty `search_path`, stable and read-only by current definition inspection. Existing private `report_retention.admission_state` and `gridly_control.prelaunch_reset_authorization` both reported RLS enabled. No proposed subscription RLS table exists yet. No broad security audit or private row read was performed.

`pg_cron` is installed at **1.6.4** in `pg_catalog`; `pgcrypto` is installed at **1.3** in `extensions`. PostgreSQL is **17.6**. The proposed migrations install no extension. `pg_cron` is relevant to a later separately approved housekeeping job, not migration application. Actual future query plans for absent subscription tables cannot be obtained in Window 1.

## 4. Cron and cleanup-health baseline

Exactly two relevant Gridly jobs were returned; no `gridly-subscription-housekeeping` job exists:

| Job | Active / schedule | Owner, DB and exact-command checks | Latest bounded run |
| --- | --- | --- | --- |
| `gridly-community-report-retention` | true / `* * * * *` | postgres, current database, expected command: all true | succeeded at 2026-09-27 23:30:00.022648+00 |
| `gridly-community-compliance-cleanup` | true / `* * * * *` | postgres, current database, expected command: all true | succeeded at 2026-09-27 23:30:00.021980+00 |

At the bounded cleanup-health read, report retention's last success was 23:30:00.032513 UTC, `retention_state=succeeded`, overdue count **0**, breached count **0**. Compliance cleanup's last success was 23:30:00.032649 UTC, `compliance_health_state=succeeded`, late-processed count **0**. No cleanup was triggered by this audit. This current healthy observation does not approve or activate the subscription scheduler.

## 5. Backup/PITR, exact-one mechanism and capacity

**Backup/PITR: NOT VERIFIED.** The connector's project metadata exposes project/database identity and engine version, but no backup schedule, most recent completed backup, PITR setting, retention window or restore capability. No supported read-only backup endpoint was available here. Before Window 2, the owner must inspect **the same project ref** in the Supabase dashboard and provide bounded evidence of: backup feature/status, last successful backup UTC, retention window, whether PITR is enabled and its window (or explicitly absent), restore method/eligible point, and the responsible operator. A plan name or generic Supabase documentation does not prove this project's recovery posture. No backup/export/restore was attempted.

**Exact-one application: NOT PROVED.** An existing cached standalone Supabase CLI package/binary reports **2.117.0**. Its local `db push --help` confirms `--workdir`, `--dry-run`, `--linked` and `--skip-vault`; no repository dependency was added. The first sandboxed version attempt could not write CLI telemetry under the home directory; rerunning with `SUPABASE_HOME` confined to workspace scratch and telemetry disabled returned the version without printing credentials. No linked CLI authentication or `db push --dry-run` was run. The full checkout has **two** pending migration files, so a normal linked push must not be assumed to apply one. A future candidate mechanism is a separately reviewed temporary `--workdir` containing all 17 recorded migrations plus **only the cache file**, followed by an exact-one `db push --dry-run --linked --skip-vault`; after separate authorization and a one-version ledger postcheck, add **only the ack file**, repeat dry run and postcheck. Exclude `--include-all`, roles and seed. The staged file identities, link target, CLI behavior and dry-run output must be proved before any real push. Current evidence **does not** guarantee exact-one application, so Window 2 remains NO-GO.

**Capacity:** proposed subscription tables do not exist; current relevant row counts and plans are therefore unavailable. Existing PostgreSQL/extension/role capability is recorded above. No `EXPLAIN ANALYZE` or customer-table scan was run. The future minute health RPC has several capped counts, including an error-category predicate without a dedicated index; count caps do not guarantee low scan work. Require read-only postmigration `EXPLAIN` without ANALYZE, observed statistics and bounded load/recovery acceptance **before** any subscription scheduler activation. No index or job was created here.

## 6. Stop conditions, verdict and next owner decision

No wrong target, migration collision, reporting/guard drift, subscription object collision, missing extension, grant conflict or cleanup-job drift was observed. Two **Window 2 hard gates remain open**: owner dashboard backup/PITR proof and exact-one linked migration dry-run/procedure proof. Current backup and CLI limitations are recorded as unknown/unproved, never converted into PASS. If a later snapshot differs, stop and reassess; do not repair in Window 1.

**Window 1 result: NOT READY FOR WINDOW 2.** The live baseline supports reviewing the two unapplied migration proposals, but not authorizing application yet. The exact next owner decisions are (1) provide/verify the bounded backup/PITR dashboard evidence for `nhwhkbkludzkuyxmkkcj` and (2) separately authorize preparation and **read-only exact-one CLI dry runs** using a staged workdir. Only after those pass should the owner review the two committed SHAs and consider **separate Window 2 migration authorization**. No migration, database write, Edge/Cloudflare deployment, secret/key configuration, Cron mutation, Resend/Healthchecks change, store purchase, reporting activation, push or merge occurred.
