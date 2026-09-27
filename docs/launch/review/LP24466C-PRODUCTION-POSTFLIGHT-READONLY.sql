-- LP244.66C REVIEW ONLY. Future SELECT-only postflight after separately approved
-- cache and acknowledgment migrations. Never run in this review phase.
-- Verify project/dashboard identity and the preflight invariant first.
-- Any mismatch is a STOP; do not call mutating RPCs as a health probe.

SELECT version, count(*) AS ledger_rows FROM supabase_migrations.schema_migrations
WHERE version IN ('20260926205345','20260927204849')
GROUP BY version ORDER BY version;
SELECT protocol_version,reporting_enabled,changed_at
FROM report_retention.admission_state WHERE singleton;
SELECT project_ref='nhwhkbkludzkuyxmkkcj' AS expected_project,status,
       consumed_at,launched_at
FROM gridly_control.prelaunch_reset_authorization WHERE singleton;

SELECT n.nspname,c.relname,c.relrowsecurity,
       owner.rolname AS owner_role,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
       has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select,
       has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
       has_table_privilege('service_role',c.oid,'SELECT') AS service_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_roles owner ON owner.oid=c.relowner
WHERE n.nspname='subscription_ops' AND c.relkind='r'
ORDER BY c.relname;
SELECT n.nspname,c.relname,i.relname AS index_name,pg_get_indexdef(i.oid) AS index_definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_index x ON x.indrelid=c.oid JOIN pg_class i ON i.oid=x.indexrelid
WHERE n.nspname='subscription_ops' AND c.relkind='r'
ORDER BY c.relname,i.relname;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       owner.rolname AS owner_role,p.prosecdef AS security_definer,p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
       coalesce(string_agg(DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC'
         ELSE grantee.rolname END,','),'<none>') AS explicit_acl_grantees
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_roles owner ON owner.oid=p.proowner
LEFT JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a ON true
LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
WHERE (n.nspname='subscription_ops' AND p.proname='roll_ack_health')
   OR (n.nspname='public' AND p.proname IN
      ('gridly_reconcile_store_entitlement','gridly_prune_store_entitlement_cache',
       'gridly_enqueue_google_ack','gridly_prune_google_ack_work',
       'gridly_claim_google_ack','gridly_resolve_google_ack',
       'gridly_complete_google_ack_run','gridly_subscription_housekeeping',
       'gridly_google_ack_health'))
GROUP BY n.nspname,p.oid,owner.rolname
ORDER BY n.nspname,p.proname;

-- New tables only; count at most 1,000,000+1 rows each to detect saturation.
-- No identity, ciphertext or individual row is returned.
SELECT 'cache' AS subsystem,count(*) AS capped_count FROM
 (SELECT 1 FROM subscription_ops.store_entitlements LIMIT 1000001) x
UNION ALL SELECT 'google_ack_work',count(*) FROM
 (SELECT 1 FROM subscription_ops.google_ack_work LIMIT 1000001) x
UNION ALL SELECT 'google_ack_health',count(*) FROM
 (SELECT 1 FROM subscription_ops.google_ack_health LIMIT 3) x;
SELECT environment,last_tick_at,last_completed_at,last_purge_at,
       completed_count,denied_count,expired_count,terminal_count,last_error_category
FROM subscription_ops.google_ack_health ORDER BY environment;

-- Future scheduler activation is a separate window. At database-only
-- postflight, the subscription job must still be absent; existing two unchanged.
SELECT jobname,schedule,active,username='postgres' AS postgres_owner,
       database=current_database() AS current_database_target,
       CASE jobname
        WHEN 'gridly-community-report-retention'
          THEN command='select report_retention.run_cleanup()'
        WHEN 'gridly-community-compliance-cleanup'
          THEN command='select moderation.run_compliance_cleanup()'
        WHEN 'gridly-subscription-housekeeping'
          THEN command='SELECT queue_purged,cache_purged FROM public.gridly_subscription_housekeeping();'
       END AS exact_command
FROM cron.job WHERE jobname IN ('gridly-community-report-retention',
 'gridly-community-compliance-cleanup','gridly-subscription-housekeeping')
ORDER BY jobname;
