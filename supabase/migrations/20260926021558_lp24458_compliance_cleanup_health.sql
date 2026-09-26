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
     OR md5(replace(pg_get_functiondef('moderation.run_compliance_cleanup()'::regprocedure),
                    chr(13)||chr(10),chr(10)))
          <> 'f5385ff3208f62d333563254ea4b6903'
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
