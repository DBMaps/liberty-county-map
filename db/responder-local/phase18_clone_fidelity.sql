\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
SET LOCAL search_path=pg_catalog;

DO $phase18_fidelity$
DECLARE
  v_postgis text;
BEGIN
  IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres' THEN
    RAISE EXCEPTION 'PHASE18_FIDELITY_STOP: wrong database or principal';
  END IF;
  IF current_setting('server_version_num')::integer<>170006 THEN
    RAISE EXCEPTION 'PHASE18_FIDELITY_STOP: exact PostgreSQL 17.6 required; got %',current_setting('server_version');
  END IF;
  SELECT extensions.postgis_lib_version() INTO v_postgis;
  IF v_postgis<>'3.3.7' THEN
    RAISE EXCEPTION 'PHASE18_FIDELITY_STOP: exact PostGIS 3.3.7 required; got %',v_postgis;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM gridly_rehearsal.phase18_environment
    WHERE singleton AND environment_marker='GRIDLY_PHASE18_NON_PRODUCTION'
      AND container_name='gridly-phase18-exact-db' AND production_access_authorized=false
      AND source_kind='synthetic-production-shaped-bootstrap'
  ) THEN
    RAISE EXCEPTION 'PHASE18_FIDELITY_STOP: local database marker absent or changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'PHASE18_FIDELITY_STOP: role posture differs';
  END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>14
     OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20260908200554' THEN
    RAISE EXCEPTION 'PHASE18_FIDELITY_STOP: pre-responder migration history differs';
  END IF;
END
$phase18_fidelity$;

SELECT jsonb_build_object(
  'status','PHASE18_CLONE_FIDELITY_PASS',
  'environment_marker',(SELECT environment_marker FROM gridly_rehearsal.phase18_environment WHERE singleton),
  'source_kind',(SELECT source_kind FROM gridly_rehearsal.phase18_environment WHERE singleton),
  'database',current_database(),
  'principal',current_user,
  'postgres_version',current_setting('server_version'),
  'postgres_version_num',current_setting('server_version_num')::integer,
  'postgis_version',extensions.postgis_lib_version(),
  'postgis_full_version',extensions.postgis_full_version(),
  'extensions',(SELECT jsonb_object_agg(e.extname,e.extversion ORDER BY e.extname)
    FROM pg_extension e WHERE e.extname IN ('postgis','pgcrypto')),
  'roles',(SELECT jsonb_object_agg(rolname,rolbypassrls ORDER BY rolname)
    FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role')),
  'auth_tables',(SELECT jsonb_agg(c.relname ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auth' AND c.relkind='r'),
  'county_rows',(SELECT count(*) FROM public.gridly_texas_county_boundaries),
  'county_valid_rows',(SELECT count(*) FROM public.gridly_texas_county_boundaries
    WHERE extensions.ST_IsValid(geom) AND NOT extensions.ST_IsEmpty(geom)
      AND extensions.ST_SRID(geom)=4326 AND extensions.GeometryType(geom)='MULTIPOLYGON'),
  'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton),
  'baseline',jsonb_build_object(
    'reports',(SELECT count(*) FROM public.reports),
    'feedback',(SELECT count(*) FROM public.gridly_feedback),
    'geocode_cache',(SELECT count(*) FROM public.gridly_geocode_cache),
    'geocode_provider_state',(SELECT count(*) FROM public.gridly_geocode_provider_state),
    'historical_events',(SELECT count(*) FROM history_capture.historical_events),
    'retention_runs',(SELECT count(*) FROM report_retention.runs)),
  'migration_history_rows',(SELECT count(*) FROM supabase_migrations.schema_migrations),
  'migration_history_max',(SELECT max(version) FROM supabase_migrations.schema_migrations),
  'responder_schemas_absent',to_regnamespace('agency_private') IS NULL AND to_regnamespace('responder_public') IS NULL
);
ROLLBACK;
