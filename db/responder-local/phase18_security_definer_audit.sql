\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;

DO $phase18_definer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gridly_rehearsal.phase18_environment
    WHERE singleton AND environment_marker='GRIDLY_PHASE18_NON_PRODUCTION'
      AND production_access_authorized=false) THEN
    RAISE EXCEPTION 'PHASE18_DEFINER_STOP: local database marker absent';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef)<>10 THEN
    RAISE EXCEPTION 'PHASE18_DEFINER_STOP: expected 10 private definers';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef
      AND (pg_get_userbyid(p.proowner)<>'postgres'
        OR coalesce(array_to_string(p.proconfig,','),'') NOT IN ('search_path=','search_path=""'))
  ) THEN
    RAISE EXCEPTION 'PHASE18_DEFINER_STOP: owner or search_path differs';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef
      AND (has_function_privilege('public',p.oid,'EXECUTE')
        OR has_function_privilege('service_role',p.oid,'EXECUTE'))
  ) THEN
    RAISE EXCEPTION 'PHASE18_DEFINER_STOP: PUBLIC or service_role can execute a private definer';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND has_function_privilege('authenticated',p.oid,'EXECUTE'))<>6
     OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND has_function_privilege('anon',p.oid,'EXECUTE'))<>1
     OR NOT has_function_privilege('authenticated','agency_private._public_update_eligible(uuid)','EXECUTE')
     OR NOT has_function_privilege('anon','agency_private._public_update_eligible(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'PHASE18_DEFINER_STOP: authenticated/anon definer allowlist differs';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='responder_public' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'PHASE18_DEFINER_STOP: public wrapper is SECURITY DEFINER';
  END IF;
END
$phase18_definer$;

SELECT jsonb_build_object(
  'status','PHASE18_SECURITY_DEFINER_AUDIT_PASS',
  'private_security_definers',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef),
  'private_definers_owned_by_postgres',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'),
  'private_definers_empty_search_path',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef
      AND coalesce(array_to_string(p.proconfig,','),'') IN ('search_path=','search_path=""')),
  'public_or_service_role_executable_private_definers',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef
      AND (has_function_privilege('public',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))),
  'authenticated_executable_private_definers',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef AND has_function_privilege('authenticated',p.oid,'EXECUTE')),
  'anon_executable_private_definers',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='agency_private' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')),
  'public_security_definer_wrappers',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='responder_public' AND p.prosecdef),
  'public_security_invoker_wrappers',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='responder_public' AND NOT p.prosecdef)
);
ROLLBACK;
