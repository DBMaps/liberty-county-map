# LP244.58 cleanup health evidence — operator design review

**Decision: APPROVE DESIGN for a separately authorized, tracked migration; DO NOT EXECUTE THIS SQL.** This replaces the earlier per-minute compliance aggregate proposal. The direct database login remains permanently rejected. The proposed Cloudflare Worker → authenticated Supabase Edge Function → fixed no-argument RPC → Resend path remains undeployed. No SQL mutation, secret, account setup, deployment, or reporting activation was performed in this review.

## 1. Current production and source RCA

Read-only inspection of Gridly production project `nhwhkbkludzkuyxmkkcj` at 2026-09-26 02:01–02:03 UTC found 16 migration ledger rows, protocol 2, `reporting_enabled=false`, consumed/unlaunched prelaunch guard, and exactly two active one-minute cleanup jobs. Both latest Cron runs succeeded at 02:01 UTC. Report retention health showed a fresh success and zero overdue/breached report counts. The four compliance source tables each had zero rows at that instant. This is a point-in-time observation, not a load forecast or permission to deploy.

The live `moderation.run_compliance_cleanup()` definition has MD5 `ebfa0b470548a5314fe1569092a740c7` and matches [the tracked compliance migration](../../supabase/migrations/20260916183911_google_play_compliance_closure.sql). It is `SECURITY DEFINER`, owned by `postgres`, with an empty search path and an explicit owner-only EXECUTE ACL. It takes `pg_advisory_xact_lock(24433,180)` and performs these six operations in order, with each deadline unchanged in the proposal below:

| Operation | Existing predicate | Result |
| --- | --- | --- |
| Source suppressions | `expires_at <= clock_timestamp()` | Delete |
| Complaint linkage | `retain_until <= clock_timestamp()` and link/digest present | Clear linkage |
| Action log | `retain_until <= clock_timestamp()` | Delete; existing trigger permits an expired row |
| Complaint row | `retain_until <= clock_timestamp() - interval '31 days'` | Delete |
| Deletion-request linkage | `retain_until <= clock_timestamp()` and link/digest present | Clear linkage |
| Deletion-request row | `retain_until <= clock_timestamp()` | Delete |

The function already obtains `ROW_COUNT` after every DML, totals affected operations, and returns that `bigint`. It has no exception handler and writes no compliance run/health record. A thrown SQL error aborts the Cron statement and rolls back the entire transaction, including prior cleanup DML. A hypothetical failure row written in that transaction would roll back too. [PostgreSQL transaction and PL/pgSQL error semantics](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING) support this conclusion. In contrast, `report_retention.run_cleanup()` has an inner exception block that stores a failed run and returns `-1`; `report_retention.health` is a view over its run ledger and live report counts. Its failure technique is not copied into compliance cleanup because it would change the existing return/error contract and make Cron mark a caught failure as succeeded.

## 2. Proposed bounded compliance evidence and failure boundary

Create one **private** `moderation.cleanup_health` singleton with `last_run_at`, `last_success_at`, bounded `last_processed_count`, and the timestamp/count of the most recent *late work that was successfully processed*. No IDs, digests, report data, notes, coordinates, free text, raw SQL error, or tokens are stored. `last_run_at` means the start of the last **committed successful** run; it is not a claim that a failed attempt was recorded. There is no `last_status='failed'` field because this function cannot commit such a value while preserving its current propagated-error behavior.

The modified cleanup retains the advisory lock and all six DML predicates and order. Each DML uses `RETURNING` of only its existing deadline column into a local aggregate. `last_processed_count` counts affected operations (a complaint may contribute to linkage and later row deletion); it is not a people/case count. A *late processed operation* means its existing cleanup predicate would already have been true **three minutes before this run started**. Three minutes is an alerting tolerance for the one-minute Cron, not a new retention deadline. For the complaint-row rule the comparison is exactly `retain_until <= (run_started_at - interval '3 minutes') - interval '31 days'`; the actual DELETE remains unchanged. This avoids claiming that moving a 31-day interval across a timestamp is universally equivalent around daylight-saving transitions. Aggregation examines only rows the existing DML changed; no additional compliance source scan is added. Counts stored in health saturate at 1,000,000; the function's original unbounded return value is preserved. `LEAST` caps storage/output, not the cleanup work itself.

The health UPDATE is the last step of the same transaction as all six DML operations, inside its own PL/pgSQL exception block. On normal success, cleanup and health commit together. If any cleanup DML fails, the error propagates and the entire transaction rolls back, including any health write; the prior success row remains unchanged and pg_cron records a failed run when available. If only the health UPDATE fails, its subtransaction rolls back but the already completed cleanup DML and original return value still commit. The heartbeat then ages into `stale`, or the singleton is `missing`; health failure cannot prevent privacy cleanup. If the session is killed, the transaction rolls back and the prior success ages into `stale`; a `running`/absent latest Cron record is not treated as success. The RPC never returns Cron error messages. [PostgreSQL's exception block semantics](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING) and [Supabase Cron run-history documentation](https://supabase.com/docs/guides/cron/quickstart#inspecting-job-runs) define these boundaries. A Cron subsystem unable to record a run is observable through stale health, subject to the later missed-monitor proof.

The persisted late event is **historical evidence of overdue work processed successfully**, not a count of currently outstanding rows. The last late event remains in the singleton until a newer late event replaces it; the Worker must use its durable alert state to send once per new event timestamp and must not repeatedly label an old event as current backlog. A fresh successful cleanup implies all six predicates were applied to rows visible to each DML statement, but concurrent writes can become due after a statement; the next scheduled run handles them. An exact current outstanding compliance backlog count is deliberately unavailable to the monitor without another scan. Failure/staleness signals risk of unprocessed due work without asserting a fabricated count. The existing live report-retention health view continues to provide actual overdue/breached report counts.

## 3. RPC contract, authority, and cost

The fixed `public.gridly_cleanup_alert_health()` reads only `report_retention.health`, the singleton `moderation.cleanup_health`, and `cron.job`/a recent `cron.job_run_details` window. It never references `moderation.source_suppressions`, `moderation.complaints`, `moderation.action_log`, or `privacy_ops.deletion_requests`. It returns exactly two rows, one per fixed subsystem, even when the compliance singleton is missing. Fields are fixed subsystem and safe state enums, UTC timestamps, and counts bounded to 0–1,000,000. The compliance row carries `compliance_late_processed_count` and `compliance_late_processed_at`; those mean the *last successfully processed late event*, not live backlog. The future Edge Function must allowlist these fields and suppress raw errors. The dormant local Worker still expects its old direct-login projection and requires separate revision before deployment.

The function is SQL-only, `STABLE SECURITY DEFINER`, owned by `postgres`, with `search_path=''`. The CREATE/REVOKE/GRANT is one transaction. Only `service_role` gets explicit application EXECUTE; PUBLIC, anon, authenticated, and any other explicit ACL grantee are rejected by the postcheck. PostgreSQL owner authority remains inherent even when an owner ACL entry is absent. The check expands a null ACL with `acldefault('f',proowner)`, so a default PUBLIC grant cannot hide. This is an explicit ACL invariant, not a claim that platform administrators or an existing role able to assume `service_role` lose that authority. The Edge Function must authenticate before using its backend credential. The direct login remains NO-GO: previous read-only catalog review found PUBLIC database TEMPORARY plus built-in operational functions available to a login, beyond a health-only view. No broad PUBLIC revoke is proposed. [PostgreSQL privilege documentation](https://www.postgresql.org/docs/17/ddl-priv.html) explains owner and default privileges.

The earlier complete PUBLIC review remains relevant: the hypothetical new login would have PUBLIC CONNECT and TEMPORARY on `postgres`; only the `public` non-system schema had PUBLIC USAGE; no non-system PUBLIC column or sequence grant was found. ACLs exposed SELECT on `cron.job`/`cron.job_run_details` and four extension metadata views but their schemas lacked PUBLIC USAGE. There were 842 ACL-only PUBLIC-executable non-system routines, all blocked by schema USAGE; the proposed additional `report_retention` USAGE exposed zero existing non-system routines. A new role would start with no named memberships; the 27 inspected explicit default-privilege entries contained no PUBLIC grant, but future function defaults could change authority. PostgreSQL built-ins including `pg_notify`, advisory locks, `pg_sleep`, and `set_config` remained available, so direct login could not be proven health-only. This is why the alternative uses no new LOGIN role. The RPC postcheck also rejects new direct `service_role` members outside the current platform pair `authenticator`/`postgres`.

| Cost | Rejected per-minute rescanning | Proposed cleanup-produced evidence |
| --- | --- | --- |
| Compliance source reads | Six extra predicates/minute; two scans each of complaints and deletion_requests; all six read-only EXPLAINs chose Seq Scan with current indexes | **Zero extra source scans by monitor**; six existing DML predicate evaluations remain in scheduled cleanup |
| Per affected row | None in cleanup | Deadline-only `RETURNING` aggregate; proportional to rows already updated/deleted, with potential CTE materialization during a large backlog |
| Writes | None | One private singleton UPDATE per successful cleanup (about 1,440/day); autovacuum handles dead tuple churn |
| Table growth | No new health table; Cron history already grows | Singleton stays one row; no new Cron job/history stream; Cron history still needs separate routine retention planning |
| Failure evidence | Fresh independent scans could see overdue rows, at repeated cost | Cron terminal cleanup failure plus unchanged success heartbeat; interrupted or health-write-failed runs become stale; late-processed event persists in singleton |
| Indexes | Four deadline-leading monitoring indexes were proposed solely to support rescans | No **monitoring-specific** deadline index required. Existing cleanup DML may need independent index review when production row volume grows; current zero-row tables do not prove future cost. No index is created here. |

`cron.job_run_details` currently has a primary-key B-tree on `runid`, and the RPC looks only at a recent runid window, not the whole history. Supabase states Cron history is not automatically purged; that existing operational issue is separate from this design. `report_retention.health` still reads the report table as it already did. [PostgreSQL data-modifying CTE documentation](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-MODIFYING) describes the `RETURNING` rowset used for aggregate counts.

## 4. Exact proposed tracked migration SQL — **DO NOT EXECUTE**

This is a review artifact, not an operational script. It requires **one new tracked migration** after separate owner authorization. The current production migration ledger remains exactly 16 because no migration was created or applied here; an authorized future schema migration would necessarily add a 17th version and must be reconciled with the owner's 16-version baseline before execution. The earlier applied compliance migration must never be edited or replayed. The SQL below intentionally has no `cron.schedule`, report admission change, guard change, retention-deadline change, or direct-login creation.

~~~sql
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog;

DO $pre$
BEGIN
  IF current_user <> 'postgres'
     OR (SELECT array_agg(version::text ORDER BY version)
         FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY[
       '202606070001','202606110001','202606160001','202606160002',
       '202606170410','202606170411','202606170425','202606170426',
       '202607280100','202607290100','202607290200','202609080001',
       '202609080002','20260908200554','202609160001','20260916183911']::text[]
     OR md5(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure))
          <> 'ebfa0b470548a5314fe1569092a740c7'
     OR (SELECT count(*) FROM report_retention.admission_state
         WHERE singleton AND protocol_version=2 AND NOT reporting_enabled) <> 1
     OR (SELECT count(*) FROM gridly_control.prelaunch_reset_authorization
         WHERE singleton AND status='consumed' AND launched_at IS NULL
           AND project_ref='nhwhkbkludzkuyxmkkcj'
           AND migration_id='20260908200554') <> 1
     OR (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM cron.job
         WHERE active AND username='postgres' AND database=current_database()
           AND schedule='* * * * *'
           AND ((jobname='gridly-community-report-retention'
                 AND command='select report_retention.run_cleanup()')
             OR (jobname='gridly-community-compliance-cleanup'
                 AND command='select moderation.run_compliance_cleanup()'))) <> 2
     OR to_regclass('moderation.cleanup_health') IS NOT NULL
     OR to_regprocedure('public.gridly_cleanup_alert_health()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gridly_cleanup_alert_login')
  THEN RAISE EXCEPTION 'LP244.58 preflight changed'; END IF;
END $pre$;

CREATE TABLE moderation.cleanup_health (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_processed_count bigint NOT NULL DEFAULT 0
    CHECK (last_processed_count BETWEEN 0 AND 1000000),
  last_late_processed_at timestamptz,
  last_late_processed_count bigint NOT NULL DEFAULT 0
    CHECK (last_late_processed_count BETWEEN 0 AND 1000000),
  CHECK ((last_run_at IS NULL) = (last_success_at IS NULL)),
  CHECK ((last_late_processed_at IS NULL) = (last_late_processed_count = 0))
);
REVOKE ALL ON moderation.cleanup_health FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE moderation.cleanup_health ENABLE ROW LEVEL SECURITY;
INSERT INTO moderation.cleanup_health(singleton) VALUES (true);

CREATE OR REPLACE FUNCTION moderation.run_compliance_cleanup() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $cleanup$
DECLARE
  removed bigint;
  late_removed bigint;
  total_removed bigint := 0;
  total_late bigint := 0;
  run_started_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(24433,180);
  run_started_at := clock_timestamp();

  WITH changed AS (
    DELETE FROM moderation.source_suppressions
      WHERE expires_at<=clock_timestamp() RETURNING expires_at
  ) SELECT count(*)::bigint,
      count(*) FILTER (WHERE expires_at<=run_started_at-interval '3 minutes')::bigint
    INTO removed,late_removed FROM changed;
  total_removed:=total_removed+removed; total_late:=total_late+late_removed;

  WITH changed AS (
    UPDATE moderation.complaints SET target_report_id=null,reporter_device_digest=null
      WHERE retain_until<=clock_timestamp()
        AND (target_report_id IS NOT NULL OR reporter_device_digest IS NOT NULL)
      RETURNING retain_until
  ) SELECT count(*)::bigint,
      count(*) FILTER (WHERE retain_until<=run_started_at-interval '3 minutes')::bigint
    INTO removed,late_removed FROM changed;
  total_removed:=total_removed+removed; total_late:=total_late+late_removed;

  WITH changed AS (
    DELETE FROM moderation.action_log
      WHERE retain_until<=clock_timestamp() RETURNING retain_until
  ) SELECT count(*)::bigint,
      count(*) FILTER (WHERE retain_until<=run_started_at-interval '3 minutes')::bigint
    INTO removed,late_removed FROM changed;
  total_removed:=total_removed+removed; total_late:=total_late+late_removed;

  WITH changed AS (
    DELETE FROM moderation.complaints
      WHERE retain_until<=clock_timestamp()-interval '31 days'
      RETURNING retain_until
  ) SELECT count(*)::bigint,
      count(*) FILTER (WHERE retain_until <=
        (run_started_at-interval '3 minutes')-interval '31 days')::bigint
    INTO removed,late_removed FROM changed;
  total_removed:=total_removed+removed; total_late:=total_late+late_removed;

  WITH changed AS (
    UPDATE privacy_ops.deletion_requests
      SET target_report_id=null,requester_device_digest=null
      WHERE retain_until<=clock_timestamp()
        AND (target_report_id IS NOT NULL OR requester_device_digest IS NOT NULL)
      RETURNING retain_until
  ) SELECT count(*)::bigint,
      count(*) FILTER (WHERE retain_until<=run_started_at-interval '3 minutes')::bigint
    INTO removed,late_removed FROM changed;
  total_removed:=total_removed+removed; total_late:=total_late+late_removed;

  WITH changed AS (
    DELETE FROM privacy_ops.deletion_requests
      WHERE retain_until<=clock_timestamp() RETURNING retain_until
  ) SELECT count(*)::bigint,
      count(*) FILTER (WHERE retain_until<=run_started_at-interval '3 minutes')::bigint
    INTO removed,late_removed FROM changed;
  total_removed:=total_removed+removed; total_late:=total_late+late_removed;

  BEGIN
    UPDATE moderation.cleanup_health
       SET last_run_at=run_started_at,
           last_success_at=clock_timestamp(),
           last_processed_count=least(total_removed,1000000),
           last_late_processed_at=CASE WHEN total_late>0
             THEN clock_timestamp() ELSE last_late_processed_at END,
           last_late_processed_count=CASE WHEN total_late>0
             THEN least(total_late,1000000) ELSE last_late_processed_count END
     WHERE singleton;
    IF NOT FOUND THEN RAISE EXCEPTION 'Compliance cleanup health row missing'; END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Preserve completed privacy cleanup; absence of a heartbeat is alertable.
    NULL;
  END;
  RETURN total_removed;
END $cleanup$;

CREATE FUNCTION public.gridly_cleanup_alert_health()
RETURNS TABLE (
  subsystem text, job_state text, latest_run_state text,
  latest_run_at timestamptz, last_success_at timestamptz,
  retention_state text, compliance_health_state text,
  report_overdue_count bigint, report_breached_count bigint,
  compliance_late_processed_count bigint,
  compliance_late_processed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $health$
WITH expected(subsystem,jobname,expected_command) AS (
  VALUES
    ('report_retention'::text,'gridly-community-report-retention'::text,
      'select report_retention.run_cleanup()'::text),
    ('compliance_cleanup'::text,'gridly-community-compliance-cleanup'::text,
      'select moderation.run_compliance_cleanup()'::text)
), run_floor AS (
  SELECT greatest(coalesce(max(runid),0)-128,0) AS minimum_runid
  FROM cron.job_run_details
)
SELECT e.subsystem,
  CASE WHEN j.jobid IS NULL THEN 'missing'
       WHEN NOT j.active THEN 'inactive'
       WHEN j.schedule<>'* * * * *' OR j.username<>'postgres'
         OR j.database<>current_database() OR j.command<>e.expected_command
         THEN 'misconfigured' ELSE 'active' END::text AS job_state,
  CASE WHEN d.status IS NULL THEN 'none'
       WHEN d.status IN ('succeeded','running') THEN d.status
       ELSE 'failed' END::text AS latest_run_state,
  d.start_time AS latest_run_at,
  CASE WHEN e.subsystem='report_retention' THEN rh.last_success_at
       ELSE ch.last_success_at END AS last_success_at,
  CASE WHEN e.subsystem='report_retention'
       THEN CASE WHEN rh.last_status IN ('succeeded','failed')
          THEN rh.last_status ELSE 'none' END ELSE 'none' END::text AS retention_state,
  CASE WHEN e.subsystem='compliance_cleanup'
       THEN CASE WHEN ch.singleton IS NULL THEN 'missing'
            WHEN ch.last_success_at IS NULL THEN 'pending'
            ELSE 'succeeded' END ELSE 'none' END::text AS compliance_health_state,
  CASE WHEN e.subsystem='report_retention'
       THEN least(rh.overdue_cleanup_count,1000000)::bigint ELSE 0::bigint END
       AS report_overdue_count,
  CASE WHEN e.subsystem='report_retention'
       THEN least(rh.breached_deadline_count,1000000)::bigint ELSE 0::bigint END
       AS report_breached_count,
  CASE WHEN e.subsystem='compliance_cleanup'
       THEN coalesce(ch.last_late_processed_count,0) ELSE 0::bigint END
       AS compliance_late_processed_count,
  CASE WHEN e.subsystem='compliance_cleanup'
       THEN ch.last_late_processed_at ELSE NULL::timestamptz END
       AS compliance_late_processed_at
FROM expected e
CROSS JOIN run_floor f
CROSS JOIN report_retention.health rh
LEFT JOIN moderation.cleanup_health ch ON ch.singleton AND e.subsystem='compliance_cleanup'
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
GRANT EXECUTE ON FUNCTION public.gridly_cleanup_alert_health() TO service_role;

DO $post$
DECLARE p record;
BEGIN
  SELECT proowner,prosecdef,provolatile,proconfig,proacl INTO p
  FROM pg_proc WHERE oid='public.gridly_cleanup_alert_health()'::regprocedure;
  IF p.proowner IS DISTINCT FROM 'postgres'::regrole
     OR p.prosecdef IS DISTINCT FROM true
     OR p.provolatile IS DISTINCT FROM 's'
     OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR EXISTS (
       SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       WHERE a.privilege_type='EXECUTE'
         AND a.grantee NOT IN (p.proowner,'service_role'::regrole::oid))
     OR (SELECT count(*) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
         WHERE a.privilege_type='EXECUTE'
           AND a.grantee='service_role'::regrole::oid AND NOT a.is_grantable) <> 1
     OR has_function_privilege('anon','public.gridly_cleanup_alert_health()','EXECUTE')
     OR has_function_privilege('authenticated','public.gridly_cleanup_alert_health()','EXECUTE')
     OR NOT has_function_privilege('service_role','public.gridly_cleanup_alert_health()','EXECUTE')
     OR (SELECT count(*) FROM moderation.cleanup_health) <> 1
     OR (SELECT relowner FROM pg_class
           WHERE oid='moderation.cleanup_health'::regclass)
           IS DISTINCT FROM 'postgres'::regrole
     OR NOT (SELECT relrowsecurity FROM pg_class
               WHERE oid='moderation.cleanup_health'::regclass)
     OR EXISTS (
       SELECT 1 FROM pg_class c
       CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
       WHERE c.oid='moderation.cleanup_health'::regclass
         AND a.grantee<>c.relowner)
     OR EXISTS (
       SELECT 1 FROM pg_proc f
       CROSS JOIN LATERAL aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
       WHERE f.oid='moderation.run_compliance_cleanup()'::regprocedure
         AND a.privilege_type='EXECUTE' AND a.grantee<>f.proowner)
     OR (SELECT proowner FROM pg_proc
           WHERE oid='moderation.run_compliance_cleanup()'::regprocedure)
           IS DISTINCT FROM 'postgres'::regrole
     OR (SELECT prosecdef FROM pg_proc
           WHERE oid='moderation.run_compliance_cleanup()'::regprocedure)
           IS DISTINCT FROM true
     OR EXISTS (SELECT 1 FROM pg_auth_members m
          WHERE m.roleid='service_role'::regrole
            AND m.member NOT IN ('authenticator'::regrole,'postgres'::regrole))
     OR (SELECT count(*) FROM public.gridly_cleanup_alert_health()) <> 2
     OR (SELECT count(DISTINCT subsystem)
           FROM public.gridly_cleanup_alert_health()) <> 2
     OR EXISTS (SELECT 1 FROM public.gridly_cleanup_alert_health()
       WHERE subsystem NOT IN ('report_retention','compliance_cleanup')
          OR job_state NOT IN ('active','missing','inactive','misconfigured')
          OR latest_run_state NOT IN ('succeeded','running','failed','none')
          OR retention_state NOT IN ('succeeded','failed','none')
          OR compliance_health_state NOT IN ('succeeded','pending','missing','none')
          OR report_overdue_count NOT BETWEEN 0 AND 1000000
          OR report_breached_count NOT BETWEEN 0 AND 1000000
          OR compliance_late_processed_count NOT BETWEEN 0 AND 1000000)
     OR (SELECT count(*) FROM cron.job) <> 2
     OR (SELECT count(*) FROM cron.job
         WHERE active AND username='postgres' AND database=current_database()
           AND schedule='* * * * *'
           AND ((jobname='gridly-community-report-retention'
                 AND command='select report_retention.run_cleanup()')
             OR (jobname='gridly-community-compliance-cleanup'
                 AND command='select moderation.run_compliance_cleanup()'))) <> 2
     OR (SELECT count(*) FROM report_retention.admission_state
         WHERE singleton AND protocol_version=2 AND NOT reporting_enabled) <> 1
     OR (SELECT count(*) FROM gridly_control.prelaunch_reset_authorization
         WHERE singleton AND status='consumed' AND launched_at IS NULL
           AND project_ref='nhwhkbkludzkuyxmkkcj'
           AND migration_id='20260908200554') <> 1
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='gridly_cleanup_alert_login')
  THEN RAISE EXCEPTION 'LP244.58 postcheck failed'; END IF;
END $post$;
COMMIT;
~~~

**Review gates before any future execution:** test this exact migration on an isolated database with seeded due and late rows, injected failure/rollback, action-log trigger behavior, missing health, ACL expansion, and the two-row RPC shape; inspect EXPLAIN on a representative data volume. Recheck the project, 16-version source baseline, original function MD5, admission/guard, two Cron jobs, and current report health immediately before owner-approved application. Afterward wait for an ordinary Cron run and verify a committed fresh compliance heartbeat, retained failure observability, exact function ACL, unchanged two jobs and report admission, and the expected new migration version. Do not call cleanup manually for proof without separate authorization.

**Recommendation: APPROVE DESIGN only.** The next decision is owner approval to create and test a new tracked migration, followed by separate authorization for any production application. No production SQL, Edge Function, Worker, Resend, credentials, or reporting activation is approved by this document. LP244.54 remains CLOSED/PASS. The old LP244.22 reset/repair/push sequence was not replayed.
