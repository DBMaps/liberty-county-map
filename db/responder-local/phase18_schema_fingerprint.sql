\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;

DO $phase18_fingerprint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM gridly_rehearsal.phase18_environment
    WHERE singleton AND environment_marker='GRIDLY_PHASE18_NON_PRODUCTION'
      AND container_name='gridly-phase18-exact-db' AND production_access_authorized=false) THEN
    RAISE EXCEPTION 'PHASE18_FINGERPRINT_STOP: local database marker absent';
  END IF;
END
$phase18_fingerprint$;

WITH signature AS (
  SELECT jsonb_build_object(
    'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner)) ORDER BY n.nspname)
      FROM pg_namespace n WHERE n.nspname IN ('agency_private','responder_public')),
    'types',(SELECT jsonb_agg(jsonb_build_array(n.nspname,t.typname,e.enums) ORDER BY n.nspname,t.typname)
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      LEFT JOIN LATERAL (SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) enums FROM pg_enum WHERE enumtypid=t.oid) e ON true
      WHERE n.nspname IN ('agency_private','responder_public') AND t.typtype='e'),
    'columns',(SELECT jsonb_agg(jsonb_build_array(table_schema,table_name,ordinal_position,column_name,data_type,udt_schema,udt_name,is_nullable,column_default) ORDER BY table_schema,table_name,ordinal_position)
      FROM information_schema.columns WHERE table_schema IN ('agency_private','responder_public')),
    'constraints',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,x.conname,pg_get_constraintdef(x.oid,true)) ORDER BY n.nspname,c.relname,x.conname)
      FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('agency_private','responder_public')),
    'indexes',(SELECT jsonb_agg(jsonb_build_array(schemaname,tablename,indexname,indexdef) ORDER BY schemaname,tablename,indexname)
      FROM pg_indexes WHERE schemaname IN ('agency_private','responder_public')),
    'functions',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),p.prosecdef,p.provolatile,p.proconfig,pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('agency_private','responder_public')),
    'policies',(SELECT jsonb_agg(jsonb_build_array(schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check) ORDER BY schemaname,tablename,policyname)
      FROM pg_policies WHERE schemaname IN ('agency_private','responder_public')),
    'triggers',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid,true)) ORDER BY n.nspname,c.relname,t.tgname)
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('agency_private','responder_public') AND NOT t.tgisinternal),
    'rls',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity) ORDER BY n.nspname,c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('agency_private','responder_public') AND c.relkind='r')
  ) AS value
)
SELECT jsonb_build_object(
  'status','PHASE18_SCHEMA_FINGERPRINT_PASS',
  'sha256',encode(extensions.digest(value::text,'sha256'),'hex')
) FROM signature;
ROLLBACK;
