\set ON_ERROR_STOP on
-- GRIDLY RESPONDER V1 PHASE 17 -- READ-ONLY PRODUCTION PREFLIGHT, NOT DEPLOYMENT.
-- Run as the future migration principal. This file persists nothing and always rolls back.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

DO $phase17_preflight$
DECLARE
  v_bad integer;
  v_version integer := current_setting('server_version_num')::integer;
  v_postgis text;
  v_project_ref text;
  v_expected_auth jsonb := jsonb_build_array(
    jsonb_build_object('relation','sessions','column','id','type','uuid','nullable','NO'),
    jsonb_build_object('relation','sessions','column','user_id','type','uuid','nullable','NO'),
    jsonb_build_object('relation','sessions','column','aal','type','auth.aal_level','nullable','YES'),
    jsonb_build_object('relation','sessions','column','factor_id','type','uuid','nullable','YES'),
    jsonb_build_object('relation','mfa_factors','column','id','type','uuid','nullable','NO'),
    jsonb_build_object('relation','mfa_factors','column','user_id','type','uuid','nullable','NO'),
    jsonb_build_object('relation','mfa_factors','column','factor_type','type','auth.factor_type','nullable','NO'),
    jsonb_build_object('relation','mfa_factors','column','status','type','auth.factor_status','nullable','NO'),
    jsonb_build_object('relation','mfa_amr_claims','column','session_id','type','uuid','nullable','NO'),
    jsonb_build_object('relation','mfa_amr_claims','column','authentication_method','type','text','nullable','NO')
  );
  v_actual_auth jsonb;
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: transaction is not read only';
  END IF;
  IF current_user <> 'postgres' OR session_user <> 'postgres' THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: expected postgres migration principal';
  END IF;
  IF v_version < 170006 OR v_version >= 180000 THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: PostgreSQL 17.6+ and below 18 required; got %', current_setting('server_version');
  END IF;
  IF NOT has_database_privilege(current_user,current_database(),'CREATE') THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: migration principal lacks database CREATE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: required role/BYPASSRLS contract differs';
  END IF;
  IF to_regnamespace('agency_private') IS NOT NULL
     OR to_regnamespace('responder_public') IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: responder schema or partial install already exists';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid
      WHERE n.nspname IN ('agency_private','responder_public'))
     OR EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_proc p ON p.pronamespace=n.oid
      WHERE n.nspname IN ('agency_private','responder_public'))
     OR EXISTS (SELECT 1 FROM pg_namespace n JOIN pg_type t ON t.typnamespace=n.oid
      WHERE n.nspname IN ('agency_private','responder_public') AND t.typtype='e')
     OR EXISTS (SELECT 1 FROM pg_policies WHERE schemaname IN ('agency_private','responder_public')) THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: candidate table/function/type/view/policy collision';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL
     OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE lower(name) LIKE '%responder%production%schema%') THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: migration history missing or stale responder marker present';
  END IF;
  IF to_regclass('gridly_control.prelaunch_reset_authorization') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: production identity control missing';
  END IF;
  SELECT project_ref INTO v_project_ref
  FROM gridly_control.prelaunch_reset_authorization WHERE singleton;
  IF v_project_ref IS DISTINCT FROM 'nhwhkbkludzkuyxmkkcj' THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: Gridly production project identity mismatch';
  END IF;
  IF to_regclass('report_retention.admission_state') IS NULL
     OR NOT EXISTS (SELECT 1 FROM report_retention.admission_state
       WHERE singleton AND protocol_version=2 AND reporting_enabled=false)
     OR (SELECT count(*) FROM report_retention.admission_state) <> 1 THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: reporting gate is absent, ambiguous, or enabled';
  END IF;
  IF to_regclass('public.reports') IS NULL
     OR to_regclass('public.gridly_feedback') IS NULL
     OR to_regclass('public.gridly_geocode_cache') IS NULL
     OR to_regclass('public.gridly_geocode_provider_state') IS NULL
     OR to_regclass('history_capture.historical_events') IS NULL
     OR to_regclass('report_retention.runs') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: community/history/retention baseline missing';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL
     OR to_regclass('auth.mfa_factors') IS NULL OR to_regclass('auth.mfa_amr_claims') IS NULL
     OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: required managed Auth objects missing';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'relation',c.table_name,'column',c.column_name,
      'type',CASE WHEN c.data_type='USER-DEFINED' THEN c.udt_schema||'.'||c.udt_name ELSE c.udt_name END,
      'nullable',c.is_nullable) ORDER BY c.table_name,c.column_name),'[]'::jsonb)
    INTO v_actual_auth
  FROM information_schema.columns c
  JOIN jsonb_array_elements(v_expected_auth) e
    ON c.table_schema='auth' AND c.table_name=e->>'relation' AND c.column_name=e->>'column';
  SELECT count(*) INTO v_bad
  FROM jsonb_array_elements(v_expected_auth) e
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_actual_auth) a
    WHERE a->>'relation'=e->>'relation' AND a->>'column'=e->>'column'
      AND a->>'type'=e->>'type' AND a->>'nullable'=e->>'nullable');
  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: managed Auth column/type/nullability contract differs';
  END IF;
  IF NOT has_table_privilege(current_user,'auth.users','SELECT')
     OR NOT has_table_privilege(current_user,'auth.sessions','SELECT')
     OR NOT has_table_privilege(current_user,'auth.mfa_factors','SELECT')
     OR NOT has_table_privilege(current_user,'auth.mfa_amr_claims','SELECT') THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: migration principal cannot read required Auth state';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='auth.sessions'::regclass AND contype='p'
        AND pg_get_constraintdef(oid)='PRIMARY KEY (id)')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='auth.sessions'::regclass AND contype='f'
        AND confrelid='auth.users'::regclass AND confdeltype='c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (user_id)%')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='auth.mfa_factors'::regclass AND contype='p'
        AND pg_get_constraintdef(oid)='PRIMARY KEY (id)')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='auth.mfa_factors'::regclass AND contype='f'
        AND confrelid='auth.users'::regclass AND confdeltype='c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (user_id)%')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='auth.mfa_amr_claims'::regclass AND contype='f'
        AND confrelid='auth.sessions'::regclass AND confdeltype='c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (session_id)%') THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: managed Auth PK/FK relation shape differs';
  END IF;
  IF to_regtype('auth.aal_level') IS NULL OR to_regtype('auth.factor_type') IS NULL
     OR to_regtype('auth.factor_status') IS NULL
     OR NOT ('aal2'=ANY(enum_range(NULL::auth.aal_level)::text[]))
     OR NOT ('totp'=ANY(enum_range(NULL::auth.factor_type)::text[]))
     OR NOT ('verified'=ANY(enum_range(NULL::auth.factor_status)::text[])) THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: managed Auth enum contract differs';
  END IF;
  IF to_regclass('public.gridly_texas_county_boundaries') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: county authority table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='gridly_texas_county_boundaries'
        AND column_name='county_fips' AND udt_name='text' AND is_nullable='NO')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='gridly_texas_county_boundaries'
        AND column_name='geom' AND udt_schema='extensions' AND udt_name='geometry' AND is_nullable='NO')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='gridly_texas_county_boundaries'
        AND column_name='boundary_version' AND udt_name='text' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: county column contract differs';
  END IF;
  SELECT count(*) FILTER (WHERE county_fips !~ '^48[0-9]{3}$' OR geom IS NULL
      OR extensions.ST_IsEmpty(geom) OR NOT extensions.ST_IsValid(geom)
      OR extensions.ST_SRID(geom)<>4326 OR extensions.GeometryType(geom)<>'MULTIPOLYGON')
    INTO v_bad FROM public.gridly_texas_county_boundaries;
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries)<>254
     OR (SELECT count(DISTINCT county_fips) FROM public.gridly_texas_county_boundaries)<>254
     OR v_bad<>0 THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: exact 254-county geometry contract failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
      WHERE e.extname='postgis' AND n.nspname='extensions')
     OR NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
      WHERE e.extname='pgcrypto' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: postgis/pgcrypto extension contract differs';
  END IF;
  SELECT extensions.postgis_lib_version() INTO v_postgis;
  IF string_to_array(v_postgis,'.')::int[] < ARRAY[3,3,7] OR split_part(v_postgis,'.',1)::int >= 4 THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: PostGIS 3.3.7+ and below 4 required; got %',v_postgis;
  END IF;
  IF to_regprocedure('extensions.st_contains(extensions.geometry,extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_isvalid(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_isempty(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_setsrid(extensions.geometry,integer)') IS NULL
     OR to_regprocedure('extensions.st_makepoint(double precision,double precision)') IS NULL
     OR to_regprocedure('extensions.st_srid(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.geometrytype(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_x(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_y(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_PREFLIGHT_STOP: required PostGIS/pgcrypto routines missing';
  END IF;
END
$phase17_preflight$;

SELECT jsonb_build_object(
  'status','PHASE17_PRODUCTION_PREFLIGHT_PASS',
  'transaction_read_only',current_setting('transaction_read_only'),
  'database',current_database(),'migration_principal',current_user,
  'server_version',current_setting('server_version'),
  'postgis_version',extensions.postgis_lib_version(),
  'project_ref_verified',true,
  'responder_schemas_absent',to_regnamespace('agency_private') IS NULL AND to_regnamespace('responder_public') IS NULL,
  'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton),
  'county_rows',(SELECT count(*) FROM public.gridly_texas_county_boundaries),
  'baseline',jsonb_build_object(
    'reports',(SELECT count(*) FROM public.reports),
    'feedback',(SELECT count(*) FROM public.gridly_feedback),
    'geocode_cache',(SELECT count(*) FROM public.gridly_geocode_cache),
    'geocode_provider_state',(SELECT count(*) FROM public.gridly_geocode_provider_state),
    'historical_events',(SELECT count(*) FROM history_capture.historical_events),
    'retention_runs',(SELECT count(*) FROM report_retention.runs)
  )
)::text;
ROLLBACK;
