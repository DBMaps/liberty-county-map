-- LP244.66C REVIEW ONLY. Future owner-run, bounded, SELECT-only snapshot.
-- Do not run during LP244.66C. Run only against the dashboard-verified production
-- project nhwhkbkludzkuyxmkkcj after explicit Window 1 authorization.
-- Stop on any mismatch. Never include raw report, purchase, token or secret rows.
-- Run the conditional cron query only after pg_cron presence is confirmed.

-- Target, ledger, exact version multiplicity. Compare complete ordered ledger
-- against the 17 historically recorded versions in the operator review; both
-- proposed versions must be absent exactly, with no unexpected versions.
SELECT current_database() AS database_name, current_user AS inspecting_role,
       current_setting('server_version') AS postgres_version,
       statement_timestamp() AT TIME ZONE 'UTC' AS observed_utc;
SELECT version, count(*) AS ledger_rows
FROM supabase_migrations.schema_migrations
GROUP BY version ORDER BY version;
WITH expected(version) AS (VALUES
 ('202606070001'),('202606110001'),('202606160001'),('202606160002'),
 ('202606170410'),('202606170411'),('202606170425'),('202606170426'),
 ('202607280100'),('202607290100'),('202607290200'),('202609080001'),
 ('202609080002'),('20260908200554'),('202609160001'),('20260916183911'),
 ('20260926021558')),
actual AS (SELECT version,count(*) AS n FROM supabase_migrations.schema_migrations GROUP BY version)
SELECT coalesce(e.version,a.version) AS version,
       CASE WHEN e.version IS NULL THEN 'unexpected'
            WHEN a.version IS NULL THEN 'missing'
            WHEN a.n<>1 THEN 'duplicate' ELSE 'expected_once' END AS ledger_state
FROM expected e FULL OUTER JOIN actual a USING(version)
ORDER BY version;
SELECT version, count(*) AS ledger_rows
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260926205345','20260927204849')
GROUP BY version ORDER BY version;

-- Admission and consumed/unlaunched guard: booleans/status/times only.
SELECT protocol_version, reporting_enabled, changed_at
FROM report_retention.admission_state WHERE singleton;
SELECT project_ref = 'nhwhkbkludzkuyxmkkcj' AS expected_project,
       status, consumed_at, launched_at
FROM gridly_control.prelaunch_reset_authorization WHERE singleton;

-- Proposed object collision and extension inventory. No source rows.
SELECT nspname AS schema_name FROM pg_namespace
WHERE nspname IN ('subscription_ops','cron') ORDER BY nspname;
SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pgcrypto') ORDER BY extname;
SELECT v.object_name, to_regclass(v.object_name) IS NOT NULL AS exists_now
FROM (VALUES ('subscription_ops.store_entitlements'),
             ('subscription_ops.google_ack_work'),
             ('subscription_ops.google_ack_health')) v(object_name);
SELECT v.signature, to_regprocedure(v.signature) IS NOT NULL AS exists_now
FROM (VALUES ('public.gridly_reconcile_store_entitlement(jsonb)'),
 ('public.gridly_prune_store_entitlement_cache(integer)'),
 ('subscription_ops.roll_ack_health(text)'),
 ('public.gridly_enqueue_google_ack(jsonb)'),
 ('public.gridly_prune_google_ack_work(text,integer)'),
 ('public.gridly_claim_google_ack(text,integer,text)'),
 ('public.gridly_resolve_google_ack(text,text,uuid,text,text)'),
 ('public.gridly_complete_google_ack_run(text,text)'),
 ('public.gridly_subscription_housekeeping()'),
 ('public.gridly_google_ack_health()')) v(signature);

-- Existing role and default-privilege posture. Names and privileges only.
SELECT rolname, rolinherit, rolcanlogin, rolbypassrls
FROM pg_roles WHERE rolname IN ('postgres','service_role','anon','authenticated')
ORDER BY rolname;
SELECT member.rolname AS member_role, parent.rolname AS granted_role
FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
JOIN pg_roles parent ON parent.oid=m.roleid
WHERE member.rolname IN ('service_role','anon','authenticated')
   OR parent.rolname IN ('service_role','anon','authenticated')
ORDER BY member.rolname,parent.rolname;
SELECT n.nspname AS schema_name,
       has_schema_privilege('anon',n.oid,'USAGE') AS anon_usage,
       has_schema_privilege('authenticated',n.oid,'USAGE') AS authenticated_usage,
       has_schema_privilege('service_role',n.oid,'USAGE') AS service_usage
FROM pg_namespace n WHERE n.nspname IN ('public','subscription_ops')
ORDER BY n.nspname;
SELECT v.signature,
       has_function_privilege('anon',to_regprocedure(v.signature),'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',to_regprocedure(v.signature),'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',to_regprocedure(v.signature),'EXECUTE') AS service_execute
FROM (VALUES ('public.get_community_reporting_status()'),
             ('public.gridly_cleanup_alert_health()')) v(signature)
WHERE to_regprocedure(v.signature) IS NOT NULL;
SELECT coalesce(n.nspname,'<global>') AS default_schema,
       owner.rolname AS owner_role, d.defaclobjtype AS object_type,
       CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
       x.privilege_type, x.is_grantable
FROM pg_default_acl d JOIN pg_roles owner ON owner.oid=d.defaclrole
LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) x
LEFT JOIN pg_roles grantee ON grantee.oid=x.grantee
WHERE owner.rolname='postgres' AND d.defaclobjtype IN ('f','r','S','n')
ORDER BY default_schema,object_type,grantee,privilege_type;

-- Existing cleanup jobs must remain precisely two; subscription job absent.
-- Execute this SELECT only if the extension inventory found pg_cron.
-- The boolean comparison protects other job command text from output.
SELECT jobname, schedule, active, username='postgres' AS postgres_owner,
       database=current_database() AS current_database_target,
       CASE jobname
        WHEN 'gridly-community-report-retention'
          THEN command='select report_retention.run_cleanup()'
        WHEN 'gridly-community-compliance-cleanup'
          THEN command='select moderation.run_compliance_cleanup()'
        WHEN 'gridly-subscription-housekeeping'
          THEN command='SELECT queue_purged,cache_purged FROM public.gridly_subscription_housekeeping();'
       END AS exact_command
FROM cron.job
WHERE jobname IN ('gridly-community-report-retention',
                  'gridly-community-compliance-cleanup',
                  'gridly-subscription-housekeeping') ORDER BY jobname;

-- If any proposed table unexpectedly exists, STOP. Do not query its rows or
-- invoke any proposed RPC. Catalog estimates below are data-free and bounded.
SELECT n.nspname AS schema_name,c.relname AS table_name,c.reltuples::bigint AS estimated_rows,
       c.relrowsecurity AS rls_enabled, owner.rolname AS table_owner
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_roles owner ON owner.oid=c.relowner
WHERE n.nspname='subscription_ops' AND c.relkind='r'
ORDER BY c.relname;

-- Backup/PITR status cannot be established from these SQL results. In the
-- correct Supabase project dashboard, record backup availability, most recent
-- successful backup UTC, PITR enabled/retention (if offered), restore option,
-- and owner/operator access; do not export a backup or reveal credentials.
