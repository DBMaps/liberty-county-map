\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;

DO $phase18_data_api$
DECLARE
  v_result jsonb;
  v_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gridly_rehearsal.phase18_environment
    WHERE singleton AND environment_marker='GRIDLY_PHASE18_NON_PRODUCTION'
      AND production_access_authorized=false) THEN
    RAISE EXCEPTION 'PHASE18_DATA_API_STOP: local database marker absent';
  END IF;
  IF has_schema_privilege('anon','agency_private','USAGE')
     OR NOT has_schema_privilege('authenticated','agency_private','USAGE')
     OR has_schema_privilege('service_role','agency_private','USAGE') THEN
    RAISE EXCEPTION 'PHASE18_DATA_API_STOP: private schema usage allowlist differs';
  END IF;
  IF NOT has_schema_privilege('anon','responder_public','USAGE')
     OR NOT has_schema_privilege('authenticated','responder_public','USAGE')
     OR NOT has_table_privilege('anon','responder_public.agency_updates','SELECT')
     OR NOT has_table_privilege('authenticated','responder_public.agency_updates','SELECT')
     OR has_function_privilege('anon','responder_public.agency_update_command(jsonb)','EXECUTE')
     OR NOT has_function_privilege('authenticated','responder_public.agency_update_command(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'PHASE18_DATA_API_STOP: public projection grants differ';
  END IF;

  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_count FROM responder_public.agency_updates;
  IF v_count<>0 THEN RAISE EXCEPTION 'PHASE18_DATA_API_STOP: anon projection is not empty'; END IF;
  RESET ROLE;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims','',true);
  SELECT count(*) INTO v_count FROM responder_public.agency_updates;
  IF v_count<>0 THEN RAISE EXCEPTION 'PHASE18_DATA_API_STOP: authenticated projection is not empty'; END IF;
  SELECT responder_public.agency_update_command('{}'::jsonb) INTO v_result;
  IF v_result->>'status'<>'invalid_request' THEN
    RAISE EXCEPTION 'PHASE18_DATA_API_STOP: authenticated wrapper did not reject invalid request';
  END IF;
  RESET ROLE;
END
$phase18_data_api$;

SELECT jsonb_build_object(
  'status','PHASE18_DATA_API_SQL_REHEARSAL_PASS',
  'scope','database roles, grants, RLS projection visibility, and wrapper invocation; no HTTP gateway',
  'responder_public_config_exposure',false,
  'agency_private_config_exposure',false,
  'anon_projection_rows',0,
  'anon_wrapper_execute',false,
  'authenticated_projection_rows',0,
  'authenticated_wrapper_execute',true,
  'http_postgrest_rehearsed',false
);
ROLLBACK;
