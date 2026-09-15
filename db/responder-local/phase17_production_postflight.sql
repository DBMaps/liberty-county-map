\set ON_ERROR_STOP on
-- GRIDLY RESPONDER V1 PHASE 17 -- READ-ONLY POSTFLIGHT CERTIFICATION.
-- Supply the six bounded counts emitted by phase17_production_preflight.sql.
\if :{?phase17_expected_reports}
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: phase17_expected_reports is required'
  \quit 3
\endif
\if :{?phase17_expected_feedback}
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: phase17_expected_feedback is required'
  \quit 3
\endif
\if :{?phase17_expected_geocode_cache}
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: phase17_expected_geocode_cache is required'
  \quit 3
\endif
\if :{?phase17_expected_geocode_provider_state}
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: phase17_expected_geocode_provider_state is required'
  \quit 3
\endif
\if :{?phase17_expected_historical_events}
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: phase17_expected_historical_events is required'
  \quit 3
\endif
\if :{?phase17_expected_retention_runs}
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: phase17_expected_retention_runs is required'
  \quit 3
\endif

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';

DO $phase17_postflight$
DECLARE
  v_private_tables text[];
  v_private_functions text[];
  v_public_functions text[];
  v_public_columns text[];
  v_missing_indexes integer;
BEGIN
  IF current_setting('transaction_read_only')<>'on' THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: transaction is not read only';
  END IF;
  IF to_regnamespace('agency_private') IS NULL OR to_regnamespace('responder_public') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: responder schemas missing';
  END IF;
  SELECT array_agg(c.relname::text ORDER BY c.relname::text COLLATE "C") INTO v_private_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='agency_private' AND c.relkind='r';
  IF v_private_tables IS DISTINCT FROM ARRAY['activation_rate_events','agency_update_events',
    'agency_update_revisions','agency_updates','governance_events','gridly_admin_grants',
    'operation_receipts','organization_county_authorities','organization_invites',
    'organization_memberships','organizations','principals','road_closure_approvals'] THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: private table inventory differs';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('agency_private','responder_public') AND c.relkind IN ('v','m','p','f')) THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: unexpected view/materialized/partitioned/foreign relation';
  END IF;
  SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C") INTO v_private_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='agency_private';
  SELECT array_agg(p.proname::text ORDER BY p.proname::text COLLATE "C") INTO v_public_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='responder_public';
  IF v_private_functions IS DISTINCT FROM ARRAY['_current_authority_for_point','_live_auth_context',
    '_public_update_eligible','_refresh_public_projection','_withdraw_active_updates',
    'agency_governance_command','agency_membership_command','agency_update_command',
    'current_gridly_admin_security_context','current_responder_security_context','reject_append_only_mutation']
     OR v_public_functions IS DISTINCT FROM ARRAY['agency_governance_command','agency_membership_command','agency_update_command'] THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: function inventory differs';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='agency_private')<>13
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='responder_public')<>1
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='agency_private' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>13
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='responder_public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>1 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: RLS/policy inventory differs';
  END IF;
  SELECT count(*) INTO v_missing_indexes FROM unnest(ARRAY[
    'organization_memberships_one_active_org_per_user_idx','organization_memberships_org_status_role_idx',
    'organization_memberships_user_status_idx','organization_county_authorities_one_current_idx',
    'organization_county_authorities_current_lookup_idx','agency_updates_org_state_idx',
    'agency_update_revisions_org_state_idx','agency_update_revisions_location_gist_idx',
    'agency_update_events_org_time_idx','agency_update_events_activation_lineage_idx',
    'activation_rate_events_rolling_idx','operation_receipts_actor_time_idx',
    'operation_receipts_org_time_idx','governance_events_org_time_idx',
    'organization_invites_one_live_email_idx','organization_invites_expiry_idx',
    'responder_public_agency_updates_expiry_idx']) i(name)
  WHERE NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_index x ON x.indexrelid=c.oid
    WHERE c.relname=i.name AND n.nspname IN ('agency_private','responder_public') AND x.indisvalid AND x.indisready);
  IF v_missing_indexes<>0 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: expected index missing/not ready';
  END IF;
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='agency_private' AND NOT t.tgisinternal
        AND t.tgname LIKE '%_append_only')<>6 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: append-only trigger inventory differs';
  END IF;
  IF has_schema_privilege('public','agency_private','USAGE')
     OR has_schema_privilege('anon','agency_private','USAGE')
     OR has_schema_privilege('service_role','agency_private','USAGE')
     OR NOT has_schema_privilege('authenticated','agency_private','USAGE')
     OR has_schema_privilege('public','responder_public','USAGE')
     OR has_schema_privilege('service_role','responder_public','USAGE')
     OR NOT has_schema_privilege('anon','responder_public','USAGE')
     OR NOT has_schema_privilege('authenticated','responder_public','USAGE') THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: schema grants differ';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema='agency_private' AND grantee IN ('PUBLIC','anon','authenticated','service_role')
        AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))
     OR has_table_privilege('anon','agency_private.organizations','SELECT')
     OR has_table_privilege('service_role','agency_private.organizations','SELECT') THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: private table grants differ';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND (coalesce(array_to_string(p.proconfig,','),'') NOT IN ('search_path=','search_path=""')
          OR has_function_privilege('public',p.oid,'EXECUTE')
          OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: private SECURITY DEFINER grants/search_path differ';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND has_function_privilege('anon',p.oid,'EXECUTE'))<>1
     OR NOT has_function_privilege('anon','agency_private._public_update_eligible(uuid)','EXECUTE')
     OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND has_function_privilege('authenticated',p.oid,'EXECUTE'))<>6 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: private policy-helper/call-chain allowlist differs';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='responder_public' AND NOT p.prosecdef
        AND has_function_privilege('authenticated',p.oid,'EXECUTE')
        AND NOT has_function_privilege('public',p.oid,'EXECUTE')
        AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
        AND NOT has_function_privilege('service_role',p.oid,'EXECUTE'))<>3 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: wrapper security/grants differ';
  END IF;
  SELECT array_agg(column_name::text ORDER BY ordinal_position) INTO v_public_columns
  FROM information_schema.columns WHERE table_schema='responder_public' AND table_name='agency_updates';
  IF v_public_columns IS DISTINCT FROM ARRAY['update_id','organization_public_name','approved_department_name',
    'verified_agency','verified_agency_label','condition_type','impact_level','title','detail','location',
    'road_name','cross_street','crossing_id','source_family','activated_at','updated_at','expires_at',
    'display_lifecycle_state'] THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: exact 18-column projection differs';
  END IF;
  IF position('auth.sessions' in pg_get_functiondef('agency_private._live_auth_context()'::regprocedure))=0
     OR position('auth.mfa_factors' in pg_get_functiondef('agency_private._live_auth_context()'::regprocedure))=0
     OR position('auth.mfa_amr_claims' in pg_get_functiondef('agency_private._live_auth_context()'::regprocedure))=0 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: live Auth helper definition differs';
  END IF;
  IF EXISTS (SELECT 1 FROM agency_private.organizations)
     OR EXISTS (SELECT 1 FROM agency_private.principals)
     OR EXISTS (SELECT 1 FROM agency_private.organization_memberships)
     OR EXISTS (SELECT 1 FROM agency_private.gridly_admin_grants)
     OR EXISTS (SELECT 1 FROM agency_private.organization_county_authorities)
     OR EXISTS (SELECT 1 FROM agency_private.agency_updates)
     OR EXISTS (SELECT 1 FROM agency_private.agency_update_revisions)
     OR EXISTS (SELECT 1 FROM agency_private.road_closure_approvals)
     OR EXISTS (SELECT 1 FROM agency_private.agency_update_events)
     OR EXISTS (SELECT 1 FROM agency_private.activation_rate_events)
     OR EXISTS (SELECT 1 FROM agency_private.operation_receipts)
     OR EXISTS (SELECT 1 FROM agency_private.governance_events)
     OR EXISTS (SELECT 1 FROM agency_private.organization_invites)
     OR EXISTS (SELECT 1 FROM responder_public.agency_updates)
     OR NOT EXISTS (SELECT 1 FROM report_retention.admission_state
       WHERE singleton AND protocol_version=2 AND reporting_enabled=false) THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: zero-activation state differs';
  END IF;
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries)<>254
     OR (SELECT count(DISTINCT county_fips) FROM public.gridly_texas_county_boundaries)<>254 THEN
    RAISE EXCEPTION 'PHASE17_POSTFLIGHT_STOP: county authority changed';
  END IF;
END
$phase17_postflight$;

SELECT (
  (SELECT count(*) FROM public.reports)=:'phase17_expected_reports'::bigint
  AND (SELECT count(*) FROM public.gridly_feedback)=:'phase17_expected_feedback'::bigint
  AND (SELECT count(*) FROM public.gridly_geocode_cache)=:'phase17_expected_geocode_cache'::bigint
  AND (SELECT count(*) FROM public.gridly_geocode_provider_state)=:'phase17_expected_geocode_provider_state'::bigint
  AND (SELECT count(*) FROM history_capture.historical_events)=:'phase17_expected_historical_events'::bigint
  AND (SELECT count(*) FROM report_retention.runs)=:'phase17_expected_retention_runs'::bigint
) AS phase17_bounded_baseline_unchanged \gset
\if :phase17_bounded_baseline_unchanged
\else
  \echo 'PHASE17_POSTFLIGHT_STOP: community/history/retention bounded counts changed'
  \quit 4
\endif

SELECT jsonb_build_object(
  'status','PHASE17_PRODUCTION_POSTFLIGHT_PASS',
  'transaction_read_only',current_setting('transaction_read_only'),
  'schemas',jsonb_build_object('agency_private',true,'responder_public',true),
  'objects',jsonb_build_object('private_tables',13,'public_tables',1,'private_functions',11,
    'public_wrappers',3,'policies',14,'explicit_indexes',17,'append_only_triggers',6),
  'zero_activation',true,'agency_publishing_enabled_rows',0,
  'county_rows',(SELECT count(*) FROM public.gridly_texas_county_boundaries),
  'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton),
  'bounded_baseline_unchanged',true
)::text;
ROLLBACK;
