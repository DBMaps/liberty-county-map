\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r' AND NOT(c.relrowsecurity AND c.relforcerowsecurity)) THEN RAISE EXCEPTION 'RLS drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'dispatch_%' AND p.prosecdef AND p.proconfig IS DISTINCT FROM ARRAY['search_path=""']) THEN RAISE EXCEPTION 'search_path drift'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname LIKE 'dispatch_%' AND p.prosecdef AND r.rolname='postgres')<>1 THEN RAISE EXCEPTION 'Auth bridge owner drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname IN('current_actor_id','current_session_id') AND p.prosecdef) THEN RAISE EXCEPTION 'identity bridge drift'; END IF;
 IF has_table_privilege('authenticated','dispatch_private.operational_records','SELECT') OR has_column_privilege('authenticated','dispatch_private.operational_records','private_payload','SELECT') OR has_any_column_privilege('anon','dispatch_projection.projection_candidates','SELECT') OR has_any_column_privilege('authenticated','dispatch_projection.projection_candidates','SELECT') THEN RAISE EXCEPTION 'raw grant drift'; END IF;
 IF has_function_privilege('authenticated','dispatch_private.phase26_command(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'legacy bypass'; END IF;
 IF has_function_privilege('authenticated','dispatch_private.phase28_partial_command(text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','dispatch_private.pseudonymize_user(uuid)','EXECUTE') OR has_function_privilege('authenticated','dispatch_private.check_proof(uuid,uuid,text,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'closure helper bypass'; END IF;
 IF has_any_column_privilege('authenticated','dispatch_private.auth_check_context','SELECT') OR has_table_privilege('authenticated','dispatch_private.auth_check_context','INSERT') OR has_table_privilege('authenticated','dispatch_private.erasure_context','INSERT') OR has_any_column_privilege('authenticated','dispatch_private.approval_proofs','SELECT') THEN RAISE EXCEPTION 'proof/context exposure'; END IF;
 IF EXISTS(SELECT 1 FROM dispatch_private.auth_check_context) OR EXISTS(SELECT 1 FROM dispatch_private.erasure_context) THEN RAISE EXCEPTION 'transaction context residue'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='dispatch_private.has_live_aal2()'::regprocedure AND pronargs=0 AND prorettype='boolean'::regtype AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')) THEN RAISE EXCEPTION 'bounded bridge contract drift'; END IF;
 IF has_schema_privilege('dispatch_function_owner','dispatch_private','CREATE') THEN RAISE EXCEPTION 'DDL grant drift'; END IF;
 IF has_any_column_privilege('dispatch_function_owner','auth.users','SELECT') OR has_any_column_privilege('dispatch_function_owner','auth.sessions','SELECT') OR has_any_column_privilege('dispatch_function_owner','auth.mfa_factors','SELECT') THEN RAISE EXCEPTION 'Auth table grant drift'; END IF;
 IF to_regclass('dispatch_api.responder_public_projection') IS NOT NULL THEN RAISE EXCEPTION 'permanent compatibility forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dispatch_function_owner' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR NOT rolbypassrls)) THEN RAISE EXCEPTION 'owner role drift'; END IF;
 IF (SELECT count(*) FROM public.gridly_consumer_sentinel)<>1 OR (SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton) THEN RAISE EXCEPTION 'consumer interference'; END IF;
END $$;
SELECT 'PHASE28_POSTFLIGHT_PASS';
