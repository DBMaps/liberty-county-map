# LP244.58 health-read access security review — NOT APPROVED

**Decision (2026-09-26 UTC): direct production database LOGIN is NO-GO.** This review withdraws the earlier gridly_cleanup_alert_login / report_retention.cleanup_alert_health proposal. No SQL below was executed. No role, view, function, grant, Edge Function, Cloudflare resource, Resend resource, password, secret, or deployment was created. Reporting remains disabled. The SQL below is a new proposal for separate owner review, not an instruction to run it.

## 1. Fresh production catalog evidence and effective PUBLIC authority

Read-only catalog queries were run against the existing Gridly production project (reference nhwhkbkludzkuyxmkkcj), PostgreSQL 17.6. The proposed login does **not** exist. A CREATE ROLE with no membership clause would add no role memberships; the only shared grant source for that new role would be PUBLIC, plus any grants explicitly added later. NOINHERIT does not subtract PUBLIC privileges. The prior design would have added USAGE on report_retention and SELECT on one view.

| Scope | Current PUBLIC finding | Consequence for the proposed login |
| --- | --- | --- |
| Database postgres | CONNECT and TEMPORARY; no CREATE | It could connect and create temporary tables. TEMPORARY is beyond the health view. |
| Schemas | Only public has PUBLIC USAGE; no non-system schema has PUBLIC CREATE. report_retention, cron, extensions, moderation, privacy_ops, auth, storage, realtime, and other checked schemas have no PUBLIC USAGE. | The prior explicit report_retention USAGE would add that schema. The other schemas remain inaccessible through PUBLIC. |
| Tables/views | cron.job and cron.job_run_details have PUBLIC SELECT; cron.job_run_details also has PUBLIC DELETE. In extensions, four metadata views and spatial_ref_sys have PUBLIC SELECT. No PUBLIC relation privilege was found in public, report_retention, moderation, or privacy_ops. | The cron and extensions ACLs are **not effective** without schema USAGE. The prior design did not grant those schemas. Their latent PUBLIC ACLs are not a reason to broaden or revoke production grants in this phase. |
| Columns | No non-system column-level PUBLIC grant was found in pg_attribute.attacl. | No column grant bypasses the absent table/view grants in the accessible public or proposed report_retention schema. |
| Sequences | No non-system PUBLIC sequence privilege found. | No sequence access through PUBLIC was found. |
| Routines | PUBLIC EXECUTE ACLs exist on 4 auth, 5 cron, 798 extensions, 1 graphql_public, 15 realtime, and 19 storage routines (842 total). No PUBLIC EXECUTE ACL exists on a public or report_retention routine. No non-builtin routine was found in pg_catalog. | All 842 ACL-only routines are blocked by absent schema USAGE. Adding report_retention USAGE would expose **zero** existing routines through PUBLIC. |
| Memberships | The proposed role is absent; therefore it has zero current membership edges. The proposed CREATE ROLE did not specify membership. | A new role would receive no named-role membership at creation. Later grants would require a fresh audit. |
| Default privileges | All 27 explicit pg_default_acl entries inspected contained no PUBLIC privilege. PostgreSQL's inherent default can still give PUBLIC EXECUTE to future routines created by an owner without a restrictive default ACL. | Current proof is point-in-time. Future owner/schema changes could expand a login's authority, especially because public already has PUBLIC USAGE. |

**Complete current non-system routine inventory callable by the proposed login via PUBLIC, after the prior report_retention USAGE grant: empty (zero functions, zero procedures).** Accordingly, the callable non-system classification set is empty: harmless/read-only 0; bounded health-only 0; potentially data-reading 0; mutating 0; SECURITY DEFINER 0; unknown/risky 0. The 842 PUBLIC-EXECUTE routines above are *not callable* because their schemas lack PUBLIC USAGE. In the Gridly schemas, live catalog inspection found the security-definer report writers, reporting-status function, moderation/deletion submitters, cleanup functions, and geocoding functions all lack PUBLIC EXECUTE. None would become callable through the proposed login. No RLS bypass or named-role grant is implied by NOINHERIT.

The non-system inventory does not make a database login health-only. PostgreSQL core routines remain executable in pg_catalog: live ACL inspection confirmed PUBLIC EXECUTE on pg_notify(text,text), pg_advisory_lock(bigint), pg_sleep(double precision), and set_config(text,text,boolean). Notifications, session advisory locks, sleep/resource use, and session setting changes are operational effects outside the health view; the database-level TEMPORARY privilege also allows temporary writes. The proposed default_transaction_read_only=on can be changed by the session and is not an authorization boundary. A compromised credential could consume database resources or generate notifications even while private report tables and Gridly routines remain inaccessible. [PostgreSQL documents PUBLIC database TEMPORARY and default function EXECUTE](https://www.postgresql.org/docs/17/ddl-priv.html). **Direct DB login: NO-GO under the owner's health-only authority requirement.** No broad PUBLIC revoke is proposed.

## 2. Compliance backlog is available as a private aggregate

Current production metadata confirms four private tables and the same columns/defaults used by the source migration: moderation.source_suppressions.expires_at; moderation.complaints.retain_until and nullable target/device linkage; moderation.action_log.retain_until; privacy_ops.deletion_requests.retain_until and nullable target/device linkage. The live moderation.run_compliance_cleanup() definition MD5 is ebfa0b470548a5314fe1569092a740c7, matching the LP244.57 reviewed definition. The [current migration](../../supabase/migrations/20260916183911_google_play_compliance_closure.sql) and [deletion runbook](GRIDLY-DATA-DELETION-RUNBOOK.md) define six cleanup predicates:

| Work category | Existing cleanup deadline / condition |
| --- | --- |
| Source suppression | expires_at; delete expired row |
| Complaint linkage | retain_until; clear target report and reporter digest when present |
| Action evidence | retain_until; delete expired row |
| Complaint row | retain_until plus 31 days; delete expired row |
| Deletion request linkage | retain_until; clear target report and requester digest when present |
| Deletion request row | retain_until; delete expired row |

A SELECT-only query counted each category at its actual deadline and one minute before it. All six returned due=0 and overdue=0 in the category check; a separate aggregate-only check at 2026-09-26 01:31:48 UTC again returned compliance_due_count=0 and compliance_overdue_count=0. No private row, identifier, digest, free text, or token was returned. The one-minute **due** lookahead reflects the existing every-minute cleanup cadence; it changes no retention deadline. **Overdue** means the existing predicate's deadline has arrived and matching cleanup work remains. These are counts of cleanup predicates, not distinct people or cases; a row can contribute to more than one category. The proposed output caps each total at 1,000,000. A positive overdue total must trigger an alert even if Cron reports success.

## 3. Safer architecture and returned-field contract

The smallest safer route under this stricter authority rule is:

~~~text
Cloudflare Worker (one-minute independent schedule)
  -> authenticated, response-allowlisted Supabase Edge Function
  -> one fixed no-argument, read-only SQL SECURITY DEFINER projection
  -> two safe subsystem rows
  -> Worker classifier -> Resend owner email
~~~

The Worker would hold only a dedicated high-entropy token for **that one health endpoint**, not a database login, Hyperdrive URL, postgres credential, or Supabase service/secret key. The Edge Function must reject missing/invalid authorization before database access, accept no SQL or object name from the request, rate-limit calls, return only the fields below, suppress raw errors, and use its Supabase-managed backend secret only to invoke the fixed RPC. A leaked Worker token could obtain only bounded health data through this endpoint, subject to rate limits. The backend secret remains high privilege and its Edge Function code needs separate owner review. [Supabase documents Edge Function secrets](https://supabase.com/docs/guides/functions/secrets) and [function authorization](https://supabase.com/docs/guides/functions/auth). **No Edge Function or secret is authorized or implemented here.** The current local Worker/Hyperdrive code is dormant and must be revised and retested before any deployment.

The proposed RPC returns exactly two rows, one per subsystem, with these fields only:

| Field | Type / meaning |
| --- | --- |
| subsystem | Fixed report_retention or compliance_cleanup |
| job_state | active, missing, inactive, misconfigured |
| latest_run_state | succeeded, running, failed, none; no raw Cron message |
| latest_run_at | UTC timestamp or null |
| last_success_at | UTC timestamp or null |
| retention_state | succeeded, failed, none; none for compliance |
| report_overdue_count | Integer 0–1,000,000; zero/not applicable on compliance row |
| report_breached_count | Integer 0–1,000,000; zero/not applicable on compliance row |
| compliance_due_count | Integer 0–1,000,000; zero/not applicable on report row |
| compliance_overdue_count | Integer 0–1,000,000; zero/not applicable on report row |

The Worker may use compliance_due_count internally, but the Resend payload remains the existing allowlist: environment, subsystem, health state, UTC timestamps, bounded overdue/breach counts, and safe error category. The compliance overdue total maps to the outbound overdue_count. No due count, raw database error, row content, identifier, coordinate, token, or customer datum enters email. The Worker must treat any wrong row count, unknown enum, null/negative/unbounded count, or inconsistent subsystem fields as monitor_error. The report five-minute and compliance three-minute success thresholds remain local alert rules; the new aggregate changes no deadline.

## 4. Revised exact SQL proposal — DO NOT EXECUTE

This replaces, rather than amends, the rejected login/view SQL. It creates **one no-argument, fixed-return function** in the already API-exposed public schema, owned by postgres, with SECURITY DEFINER and an empty search path. PUBLIC, anon, and authenticated receive no EXECUTE; only the already existing service_role is granted EXECUTE for the future Edge Function. CREATE and REVOKE are in one transaction, so there is no separately committed PUBLIC-executable window. The function contains SELECTs only and returns no source rows. Its body was tested as a SELECT-only projection at 01:27 UTC and returned exactly two healthy rows with zero aggregate counts; the CREATE FUNCTION and grants have **not** been tested or executed.

~~~sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog;

DO $check$
BEGIN
  IF current_user <> 'postgres'
     OR (SELECT array_agg(version::text ORDER BY version)
           FROM supabase_migrations.schema_migrations)
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
     OR (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM cron.job
         WHERE active AND username = 'postgres' AND database = current_database()
           AND schedule = '* * * * *'
           AND ((jobname = 'gridly-community-report-retention'
                 AND command = 'select report_retention.run_cleanup()')
             OR (jobname = 'gridly-community-compliance-cleanup'
                 AND command = 'select moderation.run_compliance_cleanup()'))) <> 2
     OR NOT EXISTS (SELECT 1 FROM report_retention.health
         WHERE last_status = 'succeeded'
           AND last_success_at > statement_timestamp() - interval '5 minutes'
           AND overdue_cleanup_count = 0 AND breached_deadline_count = 0)
     OR to_regprocedure('public.gridly_cleanup_alert_health()') IS NOT NULL
     OR to_regclass('report_retention.cleanup_alert_health') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gridly_cleanup_alert_login')
  THEN RAISE EXCEPTION 'LP244.58 health projection preflight changed; no object created';
  END IF;
END $check$;

CREATE FUNCTION public.gridly_cleanup_alert_health()
RETURNS TABLE (
  subsystem text, job_state text, latest_run_state text,
  latest_run_at timestamptz, last_success_at timestamptz,
  retention_state text, report_overdue_count bigint,
  report_breached_count bigint, compliance_due_count bigint,
  compliance_overdue_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $health$
WITH t AS (SELECT statement_timestamp() AS now_utc),
expected(subsystem,jobname,expected_command) AS (
  VALUES
    ('report_retention'::text,'gridly-community-report-retention'::text,
      'select report_retention.run_cleanup()'::text),
    ('compliance_cleanup'::text,'gridly-community-compliance-cleanup'::text,
      'select moderation.run_compliance_cleanup()'::text)
), run_floor AS (
  SELECT greatest(coalesce(max(runid),0)-128,0) AS minimum_runid
  FROM cron.job_run_details
), compliance_work AS (
  SELECT least(sum(work.due_count),1000000)::bigint AS due_count,
         least(sum(work.overdue_count),1000000)::bigint AS overdue_count
  FROM (
    SELECT count(*) FILTER (WHERE expires_at<=t.now_utc+interval '1 minute') AS due_count,
           count(*) FILTER (WHERE expires_at<=t.now_utc) AS overdue_count
    FROM moderation.source_suppressions CROSS JOIN t
    UNION ALL
    SELECT count(*) FILTER (WHERE retain_until<=t.now_utc+interval '1 minute'
             AND (target_report_id IS NOT NULL OR reporter_device_digest IS NOT NULL)),
           count(*) FILTER (WHERE retain_until<=t.now_utc
             AND (target_report_id IS NOT NULL OR reporter_device_digest IS NOT NULL))
    FROM moderation.complaints CROSS JOIN t
    UNION ALL
    SELECT count(*) FILTER (WHERE retain_until<=t.now_utc+interval '1 minute'),
           count(*) FILTER (WHERE retain_until<=t.now_utc)
    FROM moderation.action_log CROSS JOIN t
    UNION ALL
    SELECT count(*) FILTER (WHERE retain_until+interval '31 days'<=t.now_utc+interval '1 minute'),
           count(*) FILTER (WHERE retain_until+interval '31 days'<=t.now_utc)
    FROM moderation.complaints CROSS JOIN t
    UNION ALL
    SELECT count(*) FILTER (WHERE retain_until<=t.now_utc+interval '1 minute'
             AND (target_report_id IS NOT NULL OR requester_device_digest IS NOT NULL)),
           count(*) FILTER (WHERE retain_until<=t.now_utc
             AND (target_report_id IS NOT NULL OR requester_device_digest IS NOT NULL))
    FROM privacy_ops.deletion_requests CROSS JOIN t
    UNION ALL
    SELECT count(*) FILTER (WHERE retain_until<=t.now_utc+interval '1 minute'),
           count(*) FILTER (WHERE retain_until<=t.now_utc)
    FROM privacy_ops.deletion_requests CROSS JOIN t
  ) work
)
SELECT e.subsystem,
  CASE WHEN j.jobid IS NULL THEN 'missing'
       WHEN NOT j.active THEN 'inactive'
       WHEN j.schedule<>'* * * * *' OR j.username<>'postgres'
         OR j.database<>current_database() OR j.command<>e.expected_command
         THEN 'misconfigured'
       ELSE 'active' END::text AS job_state,
  CASE WHEN d.status IS NULL THEN 'none'
       WHEN d.status IN ('succeeded','running') THEN d.status
       ELSE 'failed' END::text AS latest_run_state,
  d.start_time AS latest_run_at,
  CASE WHEN e.subsystem='report_retention' THEN h.last_success_at
       ELSE (SELECT x.end_time FROM cron.job_run_details x
             WHERE x.jobid=j.jobid AND x.status='succeeded'
               AND x.runid>=f.minimum_runid
             ORDER BY x.runid DESC LIMIT 1) END AS last_success_at,
  CASE WHEN e.subsystem='report_retention'
       THEN CASE WHEN h.last_status IN ('succeeded','failed')
                 THEN h.last_status ELSE 'none' END
       ELSE 'none' END::text AS retention_state,
  CASE WHEN e.subsystem='report_retention'
       THEN least(h.overdue_cleanup_count,1000000)::bigint
       ELSE 0::bigint END AS report_overdue_count,
  CASE WHEN e.subsystem='report_retention'
       THEN least(h.breached_deadline_count,1000000)::bigint
       ELSE 0::bigint END AS report_breached_count,
  CASE WHEN e.subsystem='compliance_cleanup'
       THEN cw.due_count ELSE 0::bigint END AS compliance_due_count,
  CASE WHEN e.subsystem='compliance_cleanup'
       THEN cw.overdue_count ELSE 0::bigint END AS compliance_overdue_count
FROM expected e
CROSS JOIN run_floor f
CROSS JOIN report_retention.health h
CROSS JOIN compliance_work cw
LEFT JOIN cron.job j ON j.jobname=e.jobname
LEFT JOIN LATERAL (
  SELECT status,start_time FROM cron.job_run_details
  WHERE jobid=j.jobid AND runid>=f.minimum_runid
  ORDER BY runid DESC LIMIT 1
) d ON true
ORDER BY e.subsystem
$health$;

REVOKE ALL ON FUNCTION public.gridly_cleanup_alert_health()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gridly_cleanup_alert_health()
  TO service_role;

DO $check$
DECLARE p record;
BEGIN
  SELECT proowner,prosecdef,provolatile,proconfig,proacl INTO p
  FROM pg_proc WHERE oid='public.gridly_cleanup_alert_health()'::regprocedure;
  IF p.proowner IS DISTINCT FROM 'postgres'::regrole
     OR p.prosecdef IS DISTINCT FROM true
     OR p.provolatile IS DISTINCT FROM 's'
     OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
     OR has_function_privilege('anon','public.gridly_cleanup_alert_health()','EXECUTE')
     OR has_function_privilege('authenticated','public.gridly_cleanup_alert_health()','EXECUTE')
     OR NOT has_function_privilege('service_role','public.gridly_cleanup_alert_health()','EXECUTE')
     OR (SELECT count(*) FROM public.gridly_cleanup_alert_health()) <> 2
     OR (SELECT count(DISTINCT subsystem) FROM public.gridly_cleanup_alert_health()) <> 2
     OR EXISTS (SELECT 1 FROM public.gridly_cleanup_alert_health()
                WHERE subsystem NOT IN ('report_retention','compliance_cleanup')
                   OR job_state IS NULL OR job_state NOT IN ('active','missing','inactive','misconfigured')
                   OR latest_run_state IS NULL OR latest_run_state NOT IN ('succeeded','running','failed','none')
                   OR retention_state IS NULL OR retention_state NOT IN ('succeeded','failed','none')
                   OR report_overdue_count IS NULL OR report_overdue_count NOT BETWEEN 0 AND 1000000
                   OR report_breached_count IS NULL OR report_breached_count NOT BETWEEN 0 AND 1000000
                   OR compliance_due_count IS NULL OR compliance_due_count NOT BETWEEN 0 AND 1000000
                   OR compliance_overdue_count IS NULL OR compliance_overdue_count NOT BETWEEN 0 AND 1000000)
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gridly_cleanup_alert_login')
     OR to_regclass('report_retention.cleanup_alert_health') IS NOT NULL
     OR (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM report_retention.admission_state
         WHERE singleton AND protocol_version=2 AND NOT reporting_enabled) <> 1
  THEN RAISE EXCEPTION 'LP244.58 health projection postcheck failed';
  END IF;
END $check$;
COMMIT;
~~~

This proposed function is itself a new SECURITY DEFINER boundary. Its code and the future Edge Function must receive owner review before any production write. The live SELECT-only projection proof does not certify deployment behavior, service-role API exposure, timeout, or load at production scale.

## 5. Before/after security assertions and approval recommendation

**Before any separately approved operation:** reconfirm project identity; exact 16-version ledger; protocol 2 and reporting_enabled=false; consumed/unlaunched guard; exactly two active matching Cron jobs; fresh report retention health; six compliance aggregates; no new login/view/RPC; unchanged public ACL and role memberships. The SELECT-only checks in sections 1–2 are current evidence, not a substitute for the immediate preflight.

**After any approved SQL:** assert exactly the fixed two RPC rows and field types; owner postgres; SECURITY DEFINER with empty search path; no EXECUTE for PUBLIC/anon/authenticated; EXECUTE only for service_role among application roles; no new login/view; no raw rows or identifiers in the response. Re-run the 16-version, disabled admission, guard, two-job, retention, and compliance checks. Then separately review and implement the authenticated Edge Function, revise the dormant Worker away from Hyperdrive, test redaction and failure handling, prove a missed-monitor alert, and obtain a dated owner-inbox Resend receipt. No part of this sequence is approved merely by this document.

**Recommendation:** Do **not** approve the prior direct-login SQL. The owner may consider the fixed RPC plus Edge Function design only after reviewing the new SECURITY DEFINER function, backend key handling, endpoint authentication/rate limiting, aggregate-query cost, and Worker redesign. Reporting activation and LP244.58 alerting remain **NO-GO**. LP244.54 remains CLOSED/PASS; the historical LP244.22 reset/repair was not replayed.

At 2026-09-26 01:34:11 UTC, a final SELECT-only postcheck still found the exact 16 migration rows/versions, protocol 2, reporting_enabled=false, consumed/unlaunched guard, two matching active one-minute jobs with latest runs succeeded at 01:34 UTC, and fresh report-retention success with zero overdue/breached counts. The rejected login/view and proposed RPC were all absent. This is a point-in-time observation, not approval to execute the proposal.
