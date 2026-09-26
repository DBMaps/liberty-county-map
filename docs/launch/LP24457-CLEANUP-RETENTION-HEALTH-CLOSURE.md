# LP244.57 cleanup scheduling and retention health closure

**State:** Database cleanup scheduling **GO** and retention health **HEALTHY** after the owner-authorized bounded operation on September 25, 2026 local time (September 26, 00:16–00:18 UTC). Independent owner-visible alert delivery **NO-GO**: the owner confirmed no alert service is configured. Community reporting remains **DISABLED / NO-GO**. This is a cleanup checkpoint, not launch authorization.

## Starting proof and inherited baseline

On `C:\GitHub\liberty-county-map`, `git branch --show-current` returned `LP244.57-cleanup-retention-health-closure`; both `git rev-parse HEAD` and `git rev-parse origin/main` returned `1f94e4b04d57f2fd5bbc2a2c910da7060c469cbb`; initial `git status --short` was empty. LP244.56 is closed and recorded 16 unique migrations, protocol 2, reporting disabled, a consumed/unlaunched guard, zero relevant data counts, no `pg_cron`, and stale retention health. LP244.55 and LP244.36 are historical records, not substitutes for this preflight. LP244.54 physical iPhone acceptance remains **CLOSED/PASS**. The old LP244.22 reset/repair/push and guard authorization were **not replayed**.

## Fresh read-only preflight, before any mutation

At `2026-09-26 00:08–00:09 UTC`, the connected Supabase account listed one project: `Gridly Platform`, reference `nhwhkbkludzkuyxmkkcj`, region `us-east-1`, active/healthy. The guard's `project_ref` matched. The production migration listing still contained the exact 16 LP244.56 versions once, with none newer. Direct SQL returned 16 ledger rows and 16 distinct versions. Private admission remained protocol 2 and `reporting_enabled=false`, with unchanged `changed_at=2026-09-09 16:13:48.113011 UTC`. The guard remained `consumed` and unlaunched. Reports, legacy history, replay evidence, complaints, action log, suppressions, and deletion requests each counted zero. All six checked compliance cleanup due categories counted zero. No report was overdue or past the linkage deadline. `pg_cron` was not installed and `cron.job` did not exist. The complete bounded preflight was repeated at `00:16:15–00:16:26 UTC`, immediately before the approved write, with the same result.

Report retention health still said `last_status=succeeded`, with one recorded run and `last_success_at=2026-09-09 16:13:47.953099 UTC`; this is **STALE** relative to the five-minute gate. Twelve checked private tables had RLS enabled and no effective `anon`/`authenticated` DML grant. Neither client role had a direct report INSERT column grant; both restrictive public report read policies remained. The reviewed cleanup functions are owned by `postgres`; their live `pg_get_functiondef` MD5s were `cb308fbe14f415f7244eefbf9d34903f` for `report_retention.run_cleanup()` and `ebfa0b470548a5314fe1569092a740c7` for `moderation.run_compliance_cleanup()`. Neither function is executable by `anon` or `authenticated`. `pg_cron` version 1.6.4 was available but not installed. The connected database and `cron.database_name` were both `postgres`, and `pg_cron` was present in `shared_preload_libraries`. No material drift from LP244.56 was found.

The owner approved the exact guarded scheduling and zero-row proof operation in this session. The preflight found no material difference in project, ledger, admission, guard, counts, function definitions, Cron state, or grants. A read-only multi-statement transaction probe confirmed the connected SQL tool could execute a transaction before the approved operation was sent.

## Cleanup architecture and safety audit

`report_retention.run_cleanup()` is an owner-held security-definer function with `pg_catalog` search path and advisory transaction lock `(24421,180)`. It removes only `public.reports` whose `cleanup_after <= clock_timestamp()`, where `cleanup_after` is the original submission plus 3,576 hours (149 days); private device links cascade. Removed reports contribute only month/family/count to the aggregate. It inserts a `report_retention.runs` row even on zero deletions, marks success with `completed_at`, and returns `0`; repeat runs cannot delete or double-count the same report. A caught failure marks the run `failed`, stores SQLSTATE only, and returns `-1`; an aborted transaction produces no success heartbeat, so stale-health detection remains necessary. Old run evidence is removed after 30 days. This function does not inspect or change `reporting_enabled`. The report INSERT guard requires a successful run within five minutes and keeps writing unavailable when stale. It preserves the 180-day association ceiling. No production report writer was called during this audit.

`moderation.run_compliance_cleanup()` is a separate owner-held security-definer function with an empty search path and advisory transaction lock `(24433,180)`. It deletes expired source suppressions and action evidence, clears complaint/deletion link digests at `retain_until`, removes complaints only 31 days after `retain_until`, and deletes expired deletion requests. These are bounded metadata/evidence classes; it does not delete a live report or depend on reporting being enabled. Repeated execution is idempotent against already removed/cleared rows. A SQL failure rolls back the call; unlike report retention, it has **no dedicated health ledger**. A scheduled job's `cron.job_run_details` is the bounded run-status evidence, and independent monitoring of it remains to be designed. The [deletion runbook](GRIDLY-DATA-DELETION-RUNBOOK.md) requires both cleanup functions on an approved schedule.

The source behavior is covered by disposable-database tests for failed and retryable report cleanup, zero-row idempotency, stale/healthy monitor transitions, and expired compliance evidence cleanup without deleting a live report. The disposable PostgreSQL service at `127.0.0.1:55441` was unavailable during this audit, so those database fixture suites were not rerun. A four-case local pure monitor check passed: healthy, stale, failed, and query failure. No production cleanup function was called.

## Historical activation SQL audit

| Statement in `activate-community-report-retention.sql` | Today’s classification |
| --- | --- |
| `BEGIN`, local lock/statement timeouts | Useful bounded operator controls after authorization. |
| `CREATE EXTENSION IF NOT EXISTS pg_cron` | Required type of mutation, but the historical form does not bind the expected absent state or schema. Use a guarded, exact extension operation. |
| `cron.schedule('gridly-community-report-retention', '* * * * *', ...)` | Correct report function and cadence; **risky to replay blindly** because scheduling a name that already exists can replace it. It also does not schedule compliance cleanup. |
| One-job assertion and `COMMIT` | Checks only the report job, not the complete job set, owner, compliance job, or health outcome. Insufficient as the LP244.57 operator transaction. |
| Comment requiring an external one-minute monitor/page | Still required; no execution or notification configuration is provided by the file. |

Current [Supabase Cron documentation](https://supabase.com/docs/guides/cron) confirms `pg_cron` backs jobs in `cron.job` and run history in `cron.job_run_details`; [its install guidance](https://supabase.com/docs/guides/cron/install) places the extension in `pg_catalog`. The named-job quickstart says a same-name schedule replaces the existing job. No production job is present now, but the operator transaction must fail closed if that changes.

## Exact authorized production operation

1. **READ-ONLY:** Repeated the project, exact 16-version ledger, admission/guard, count, Cron, cleanup-definition, and grant preflight above. No customer rows or credentials were returned.
2. **MUTATING — OWNER APPROVED:** Executed the guarded transaction below once through the connected SQL tool. It installed `pg_cron` 1.6.4 in `pg_catalog` and created exactly two named, active jobs as `postgres`, both on `* * * * *`: `gridly-community-report-retention` calling `select report_retention.run_cleanup()` and `gridly-community-compliance-cleanup` calling `select moderation.run_compliance_cleanup()`. The transaction rejected a preinstalled extension, any existing Cron job, wrong owner, altered function definitions, changed ledger/admission/guard, or incorrect resulting job attributes. It committed successfully. No migration, grant, RLS, report writer, reporting admission, guard, or retention deadline was changed.
3. **READ-ONLY:** Verified extension/version, exact two active jobs and their first two scheduled runs. Both jobs reported `succeeded` at `00:17 UTC` and again at `00:18 UTC`; zero failed runs. No manual `run_cleanup` invocation was needed or made, because the scheduled path itself proved execution.
4. **READ-ONLY:** Verified retention health became current and `healthy=true`; the latest report run deleted zero reports. All bounded report/evidence and compliance-due counts remained zero. The 16-version ledger, protocol-2 disabled admission, consumed/unlaunched guard, public status RPC agreement, RLS, and launch-critical grants remained unchanged. A later read-only check at `00:21:40 UTC` again found exactly two active jobs, a fresh `00:21:00 UTC` retention success, `healthy=true`, reporting disabled, and guard consumed.

The exact one-time transaction executed (retained for audit; **do not replay**):

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = pg_catalog;
DO $check$
BEGIN
  IF current_user <> 'postgres'
     OR EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR (SELECT array_agg(version::text ORDER BY version) FROM supabase_migrations.schema_migrations)
          IS DISTINCT FROM ARRAY[
            '202606070001','202606110001','202606160001','202606160002',
            '202606170410','202606170411','202606170425','202606170426',
            '202607280100','202607290100','202607290200','202609080001',
            '202609080002','20260908200554','202609160001','20260916183911'
          ]::text[]
     OR (SELECT count(*) FROM report_retention.admission_state
         WHERE singleton AND protocol_version = 2 AND NOT reporting_enabled) <> 1
     OR (SELECT count(*) FROM gridly_control.prelaunch_reset_authorization
         WHERE singleton AND project_ref = 'nhwhkbkludzkuyxmkkcj'
           AND migration_id = '20260908200554' AND status = 'consumed'
           AND consumed_at IS NOT NULL AND launched_at IS NULL) <> 1
     OR (SELECT count(*) FROM public.reports) <> 0
     OR (SELECT count(*) FROM moderation.complaints) <> 0
     OR (SELECT count(*) FROM moderation.action_log) <> 0
     OR (SELECT count(*) FROM moderation.source_suppressions) <> 0
     OR (SELECT count(*) FROM privacy_ops.deletion_requests) <> 0
     OR md5(pg_get_functiondef('report_retention.run_cleanup()'::regprocedure))
          <> 'cb308fbe14f415f7244eefbf9d34903f'
     OR md5(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure))
          <> 'ebfa0b470548a5314fe1569092a740c7'
  THEN RAISE EXCEPTION 'LP244.57 preflight changed; no cleanup scheduling applied';
  END IF;
END $check$;

CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;

DO $check$
BEGIN
  IF (SELECT count(*) FROM cron.job) <> 0
     OR NOT has_schema_privilege('postgres','cron','USAGE')
     OR to_regprocedure('cron.schedule(text,text,text)') IS NULL
     OR NOT has_function_privilege('postgres','cron.schedule(text,text,text)','EXECUTE')
  THEN RAISE EXCEPTION 'LP244.57 Cron installation/privileges not exact';
  END IF;
END $check$;

SELECT cron.schedule('gridly-community-report-retention',
                     '* * * * *', 'select report_retention.run_cleanup()');
SELECT cron.schedule('gridly-community-compliance-cleanup',
                     '* * * * *', 'select moderation.run_compliance_cleanup()');

DO $check$
BEGIN
  IF (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM cron.job
         WHERE active AND username = 'postgres' AND database = current_database()
           AND ((jobname = 'gridly-community-report-retention'
                 AND schedule = '* * * * *'
                 AND command = 'select report_retention.run_cleanup()')
             OR (jobname = 'gridly-community-compliance-cleanup'
                 AND schedule = '* * * * *'
                 AND command = 'select moderation.run_compliance_cleanup()'))) <> 2
  THEN RAISE EXCEPTION 'LP244.57 scheduled jobs not exact';
  END IF;
END $check$;
COMMIT;
```

The transaction is intentionally **fail closed on rerun**. It changed neither migration ledger nor reporting admission, launch guard, grants, RLS, retention deadlines, or product assets. Extension installation and two schedules were the only planned persistent changes. No extra owner Cron grant was required, and no migration entry was recorded.

## Independent alert detection and delivery

The tracked `tools/retention/check-report-retention.mjs` reads only the bounded retention health view under a dedicated monitor connection, classifies success as `last_status=succeeded`, last success inside five minutes, and both overdue counts zero. It fails closed on missing configuration, SQL failure, malformed output, failed status, or staleness; it suppresses database error details and emits only a safe reason. This detects report retention problems, but a process exit code alone does not notify an owner. Production `gridly_retention_monitor` is `NOLOGIN` with no non-owner members; no external monitor login or deployed poller was evidenced.

Compliance cleanup has no health row. Its two successful scheduled runs are visible in `cron.job_run_details`, but the existing monitor cannot read that catalog with its current privileges. No extra grant, external credential, pager, or service was created. The owner confirmed **no alert service is configured**. Supabase Cron's Dashboard/history is an inspection surface, not proof of independent notification. **Independent alert delivery: NO-GO** until an owner-selected service runs a one-minute external check of retention and both job histories, alerts on failure/staleness/overdue counts/query failure, and a dated delivery test proves an owner receives a payload containing status/time/counts only. Do not paste service credentials into Codex. Current report monitor detection was proven locally; compliance detection can be inspected read-only from Cron history, but there is no independent deployed poller for either path.

## Before/after and gate ledger

| Gate | Before, verified | After, verified |
| --- | --- | --- |
| `pg_cron` | Absent; version 1.6.4 available | Installed version 1.6.4 in `pg_catalog` |
| Named jobs | No Cron catalog or jobs | Exactly two active minute jobs as `postgres`; two successful runs each by 00:18 UTC |
| Report cleanup execution | Last success September 9; one run total | Scheduled success at 00:17 and 00:18 UTC; latest deletion count 0 |
| Retention health | **STALE** | `healthy=true` at 00:18:24 UTC; success 00:18:00 UTC; overdue/breached 0/0 |
| Compliance cleanup execution/health | Due counts zero; no health ledger or scheduler | Two successful Cron runs; all six due counts still 0; no separate health ledger |
| Alert detection | Existing report monitor passed four local synthetic cases | Cron status visible read-only; no independent deployed poller |
| Alert delivery | No service configured | **NO-GO**; owner-selected service and delivery test required |
| Reporting admission | Protocol 2; disabled | Protocol 2; disabled; public/private status agree |
| Launch guard | Consumed; unlaunched | Consumed; unlaunched |
| Migration ledger | Exact 16 unique versions | Exact same 16 unique versions |
| Report/history/replay/moderation/deletion counts | All checked zero | All checked zero |
| RLS/grants | Bounded launch-critical contract | 12/12 private RLS enabled, 0 client DML exposure, 0 direct report INSERT columns, two restrictive public report read policies |

**Current decisions:** cleanup scheduling **GO**; current retention health **GO**; independent alerting **NO-GO** because no deployed poller or owner-visible delivery exists; production reporting activation **NO-GO**; next launch phase **NO-GO** pending alert delivery and LP244.55 backup, controlled-copy, moderation/privacy staffing, legal/publication, and distribution evidence. This cleanup approval did **not** authorize reporting release. LP244.54 remains **CLOSED/PASS**. The old LP244.22 reset/repair/push was **not replayed**.
