-- GRIDLY RESPONDER V1 PHASE 17 -- GUARDED PRODUCTION MIGRATION PACKAGE, NOT DEPLOYED.
-- Target compatibility: Supabase PostgreSQL 17.6, PostGIS 3.3.7 in schema extensions.
-- This file intentionally remains outside supabase/migrations until a separate owner
-- deployment authorization. The deployment gate must keep every
-- agency_publishing_enabled value false until a later, separately authorized phase.
BEGIN;
SET LOCAL statement_timeout = '5min';
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog;
SET LOCAL timezone = 'UTC';

DO $phase16_preflight$
DECLARE
  v_bad integer;
BEGIN
  IF to_regnamespace('agency_private') IS NOT NULL
     OR to_regnamespace('responder_public') IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 16 schema collision; refusing partial install';
  END IF;
  IF to_regclass('public.gridly_texas_county_boundaries') IS NULL THEN
    RAISE EXCEPTION 'Certified county boundary table is absent';
  END IF;
  SELECT count(*) FILTER (WHERE county_fips !~ '^48[0-9]{3}$'
      OR geom IS NULL OR extensions.ST_IsEmpty(geom)
      OR NOT extensions.ST_IsValid(geom)
      OR extensions.ST_SRID(geom) <> 4326
      OR extensions.GeometryType(geom) <> 'MULTIPOLYGON')
    INTO v_bad
    FROM public.gridly_texas_county_boundaries;
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries) <> 254 OR v_bad <> 0 THEN
    RAISE EXCEPTION 'Certified 254-county EPSG:4326 MultiPolygon prerequisite failed';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL
     OR to_regclass('auth.mfa_factors') IS NULL
     OR to_regclass('auth.mfa_amr_claims') IS NULL THEN
    RAISE EXCEPTION 'Required managed Auth relations are absent';
  END IF;
END
$phase16_preflight$;

DO $phase17_embedded_preflight$
DECLARE
  v_bad integer;
  v_actual integer;
  v_postgis text;
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres'
     OR current_setting('server_version_num')::integer<170006
     OR current_setting('server_version_num')::integer>=180000 THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: wrong principal or PostgreSQL version';
  END IF;
  IF NOT has_database_privilege(current_user,current_database(),'CREATE')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon' AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: migration principal or required roles differ';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NULL
     OR EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
       WHERE lower(name) LIKE '%responder%production%schema%') THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: migration history missing or responder marker already exists';
  END IF;
  IF to_regclass('gridly_control.prelaunch_reset_authorization') IS NULL
     OR NOT EXISTS (SELECT 1 FROM gridly_control.prelaunch_reset_authorization
       WHERE singleton AND project_ref='nhwhkbkludzkuyxmkkcj') THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: production project identity mismatch';
  END IF;
  IF to_regclass('report_retention.admission_state') IS NULL
     OR (SELECT count(*) FROM report_retention.admission_state)<>1
     OR NOT EXISTS (SELECT 1 FROM report_retention.admission_state
       WHERE singleton AND protocol_version=2 AND reporting_enabled=false) THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: reporting gate is absent, ambiguous, or enabled';
  END IF;
  IF to_regclass('public.reports') IS NULL OR to_regclass('public.gridly_feedback') IS NULL
     OR to_regclass('public.gridly_geocode_cache') IS NULL
     OR to_regclass('public.gridly_geocode_provider_state') IS NULL
     OR to_regclass('history_capture.historical_events') IS NULL
     OR to_regclass('report_retention.runs') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: community/history/retention dependency missing';
  END IF;
  IF NOT has_table_privilege(current_user,'auth.users','SELECT')
     OR NOT has_table_privilege(current_user,'auth.sessions','SELECT')
     OR NOT has_table_privilege(current_user,'auth.mfa_factors','SELECT')
     OR NOT has_table_privilege(current_user,'auth.mfa_amr_claims','SELECT') THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: migration principal cannot read live Auth state';
  END IF;
  SELECT count(*) INTO v_actual
  FROM (VALUES
    ('sessions','id','uuid','NO'),('sessions','user_id','uuid','NO'),
    ('sessions','aal','auth.aal_level','YES'),('sessions','factor_id','uuid','YES'),
    ('mfa_factors','id','uuid','NO'),('mfa_factors','user_id','uuid','NO'),
    ('mfa_factors','factor_type','auth.factor_type','NO'),
    ('mfa_factors','status','auth.factor_status','NO'),
    ('mfa_amr_claims','session_id','uuid','NO'),
    ('mfa_amr_claims','authentication_method','text','NO'))
    AS e(relation_name,column_name,type_name,is_nullable)
  JOIN information_schema.columns c ON c.table_schema='auth'
    AND c.table_name=e.relation_name AND c.column_name=e.column_name
    AND (CASE WHEN c.data_type='USER-DEFINED' THEN c.udt_schema||'.'||c.udt_name ELSE c.udt_name END)=e.type_name
    AND c.is_nullable=e.is_nullable;
  IF v_actual<>10 OR to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL
     OR NOT ('aal2'=ANY(enum_range(NULL::auth.aal_level)::text[]))
     OR NOT ('totp'=ANY(enum_range(NULL::auth.factor_type)::text[]))
     OR NOT ('verified'=ANY(enum_range(NULL::auth.factor_status)::text[])) THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: managed Auth contract differs';
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
      WHERE conrelid='auth.mfa_amr_claims'::regclass AND contype='f'
        AND confrelid='auth.sessions'::regclass AND confdeltype='c'
        AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (session_id)%') THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: managed Auth relation shape differs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
       WHERE e.extname='postgis' AND n.nspname='extensions')
     OR NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
       WHERE e.extname='pgcrypto' AND n.nspname='extensions')
     OR to_regprocedure('extensions.st_contains(extensions.geometry,extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_isvalid(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_isempty(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_makepoint(double precision,double precision)') IS NULL
     OR to_regprocedure('extensions.st_srid(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.geometrytype(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_x(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.st_y(extensions.geometry)') IS NULL
     OR to_regprocedure('extensions.digest(text,text)') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: required extension/routine contract differs';
  END IF;
  SELECT extensions.postgis_lib_version() INTO v_postgis;
  IF string_to_array(v_postgis,'.')::int[]<ARRAY[3,3,7]
     OR split_part(v_postgis,'.',1)::integer>=4 THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: unsupported PostGIS version %',v_postgis;
  END IF;
  SELECT count(*) FILTER (WHERE county_fips!~'^48[0-9]{3}$' OR geom IS NULL
      OR extensions.ST_IsEmpty(geom) OR NOT extensions.ST_IsValid(geom)
      OR extensions.ST_SRID(geom)<>4326 OR extensions.GeometryType(geom)<>'MULTIPOLYGON')
    INTO v_bad FROM public.gridly_texas_county_boundaries;
  IF (SELECT count(*) FROM public.gridly_texas_county_boundaries)<>254
     OR (SELECT count(DISTINCT county_fips) FROM public.gridly_texas_county_boundaries)<>254
     OR v_bad<>0 THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: exact county authority contract differs';
  END IF;
END
$phase17_embedded_preflight$;

CREATE SCHEMA agency_private;
CREATE SCHEMA responder_public;
REVOKE ALL ON SCHEMA agency_private, responder_public FROM PUBLIC;
GRANT USAGE ON SCHEMA responder_public TO anon, authenticated;

CREATE TYPE agency_private.principal_status AS ENUM ('active','disabled');
CREATE TYPE agency_private.membership_role AS ENUM ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN');
CREATE TYPE agency_private.membership_status AS ENUM ('invited','active','suspended','revoked');
CREATE TYPE agency_private.verification_status AS ENUM ('requested','pending_review','verified','rejected','revoked');
CREATE TYPE agency_private.operating_status AS ENUM ('inactive','active','suspended');
CREATE TYPE agency_private.authority_status AS ENUM ('approved','revoked');
CREATE TYPE agency_private.condition_type AS ENUM
  ('road_closed','high_water','obstruction','construction','public_works_notice');
CREATE TYPE agency_private.lifecycle_state AS ENUM
  ('draft','pending_review','active','resolved','withdrawn');
CREATE TYPE agency_private.update_event_type AS ENUM
  ('update_draft_created','update_draft_edited','update_submitted','update_returned',
   'update_activated','road_closure_activated','update_edited','update_renewed',
   'update_resolved','update_withdrawn');

CREATE TABLE agency_private.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL UNIQUE
    CHECK (canonical_name = lower(canonical_name)
      AND canonical_name ~ '^[a-z0-9][a-z0-9-]{2,99}$'),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  public_name text NOT NULL CHECK (char_length(public_name) BETWEEN 2 AND 160),
  approved_department_name text CHECK (char_length(approved_department_name) <= 160),
  verification_status agency_private.verification_status NOT NULL DEFAULT 'requested',
  operating_status agency_private.operating_status NOT NULL DEFAULT 'inactive',
  agency_publishing_enabled boolean NOT NULL DEFAULT false,
  publishing_authorization_id uuid,
  operation_epoch bigint NOT NULL DEFAULT 0 CHECK (operation_epoch >= 0),
  governance_revision integer NOT NULL DEFAULT 0 CHECK (governance_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK (operating_status <> 'active' OR verification_status = 'verified'),
  CHECK (agency_publishing_enabled = false OR
    (verification_status = 'verified' AND operating_status = 'active'
      AND publishing_authorization_id IS NOT NULL))
);

CREATE TABLE agency_private.principals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status agency_private.principal_status NOT NULL DEFAULT 'active',
  minimum_iat bigint CHECK (minimum_iat IS NULL OR minimum_iat >= 0),
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK (status <> 'disabled' OR disabled_at IS NOT NULL)
);

CREATE TABLE agency_private.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  role agency_private.membership_role NOT NULL,
  status agency_private.membership_status NOT NULL DEFAULT 'invited',
  joined_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (organization_id,user_id),
  UNIQUE (organization_id,id),
  CHECK (status <> 'active' OR joined_at IS NOT NULL),
  CHECK (status <> 'suspended' OR suspended_at IS NOT NULL),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX organization_memberships_one_active_org_per_user_idx
  ON agency_private.organization_memberships(user_id) WHERE status = 'active';
CREATE INDEX organization_memberships_org_status_role_idx
  ON agency_private.organization_memberships(organization_id,status,role);
CREATE INDEX organization_memberships_user_status_idx
  ON agency_private.organization_memberships(user_id,status);

CREATE TABLE agency_private.gridly_admin_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  granted_by_user_id uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  CHECK (active OR revoked_at IS NOT NULL)
);

CREATE TABLE agency_private.organization_county_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  county_fips text NOT NULL REFERENCES public.gridly_texas_county_boundaries(county_fips) ON DELETE RESTRICT,
  authority_version integer NOT NULL CHECK (authority_version > 0),
  boundary_version text NOT NULL CHECK (char_length(boundary_version) BETWEEN 1 AND 160),
  status agency_private.authority_status NOT NULL DEFAULT 'approved',
  approved_by_user_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  revoked_by_user_id uuid,
  revoked_at timestamptz,
  UNIQUE (organization_id,county_fips,authority_version),
  UNIQUE (organization_id,id),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (status <> 'revoked' OR (revoked_by_user_id IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX organization_county_authorities_one_current_idx
  ON agency_private.organization_county_authorities(organization_id,county_fips)
  WHERE status = 'approved';
CREATE INDEX organization_county_authorities_current_lookup_idx
  ON agency_private.organization_county_authorities
    (organization_id,status,effective_from,effective_until,county_fips);

CREATE TABLE agency_private.agency_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  created_by_user_id uuid NOT NULL,
  created_session_id uuid NOT NULL,
  source_family text NOT NULL DEFAULT 'AGENCY_OFFICIAL' CHECK (source_family = 'AGENCY_OFFICIAL'),
  stored_state agency_private.lifecycle_state NOT NULL DEFAULT 'draft',
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  activation_revision integer CHECK (activation_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (organization_id,id),
  CHECK ((stored_state = 'active') = (activation_revision IS NOT NULL)
    OR stored_state IN ('resolved','withdrawn'))
);
CREATE INDEX agency_updates_org_state_idx
  ON agency_private.agency_updates(organization_id,stored_state,updated_at DESC);

CREATE TABLE agency_private.agency_update_revisions (
  update_id uuid NOT NULL REFERENCES agency_private.agency_updates(id) ON DELETE RESTRICT,
  revision integer NOT NULL CHECK (revision >= 0),
  organization_id uuid NOT NULL,
  state agency_private.lifecycle_state NOT NULL,
  condition_type agency_private.condition_type NOT NULL,
  impact_level text NOT NULL CHECK (char_length(impact_level) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120 AND title !~ '[<>]'),
  detail text CHECK (char_length(detail) <= 1000 AND detail !~ '[<>]'),
  location extensions.geometry(Point,4326) NOT NULL
    CHECK (NOT extensions.ST_IsEmpty(location) AND extensions.ST_IsValid(location)
      AND extensions.ST_X(location) BETWEEN -180 AND 180
      AND extensions.ST_Y(location) BETWEEN -90 AND 90),
  road_name text CHECK (char_length(road_name) <= 120 AND road_name !~ '[<>]'),
  cross_street text CHECK (char_length(cross_street) <= 120 AND cross_street !~ '[<>]'),
  crossing_id text CHECK (char_length(crossing_id) <= 120),
  authority_id uuid,
  activation_revision integer CHECK (activation_revision >= 0),
  activated_at timestamptz,
  expires_at timestamptz,
  authored_by_user_id uuid NOT NULL,
  authored_session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (update_id,revision),
  FOREIGN KEY (organization_id,update_id)
    REFERENCES agency_private.agency_updates(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,authority_id)
    REFERENCES agency_private.organization_county_authorities(organization_id,id) ON DELETE RESTRICT,
  CHECK (state <> 'active' OR
    (authority_id IS NOT NULL AND activation_revision IS NOT NULL
      AND activated_at IS NOT NULL AND expires_at IS NOT NULL
      AND expires_at > created_at AND expires_at <= created_at + interval '24 hours'))
);
ALTER TABLE agency_private.agency_updates ADD CONSTRAINT agency_updates_current_revision_fk
  FOREIGN KEY (id,current_revision)
  REFERENCES agency_private.agency_update_revisions(update_id,revision)
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX agency_update_revisions_org_state_idx
  ON agency_private.agency_update_revisions(organization_id,state,expires_at);
CREATE INDEX agency_update_revisions_location_gist_idx
  ON agency_private.agency_update_revisions USING gist(location);

CREATE TABLE agency_private.road_closure_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL REFERENCES agency_private.agency_updates(id) ON DELETE RESTRICT,
  pending_revision integer NOT NULL CHECK (pending_revision >= 0),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  creator_user_id uuid NOT NULL,
  approver_user_id uuid NOT NULL,
  approver_session_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (update_id,pending_revision),
  UNIQUE (update_id,pending_revision,approver_user_id),
  FOREIGN KEY (update_id,pending_revision)
    REFERENCES agency_private.agency_update_revisions(update_id,revision) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,update_id)
    REFERENCES agency_private.agency_updates(organization_id,id) ON DELETE RESTRICT,
  CHECK (creator_user_id <> approver_user_id)
);

CREATE TABLE agency_private.agency_update_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  update_id uuid NOT NULL,
  revision integer NOT NULL,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  event_type agency_private.update_event_type NOT NULL,
  actor_user_id uuid NOT NULL,
  actor_session_id uuid NOT NULL,
  authority_id uuid,
  approval_id uuid REFERENCES agency_private.road_closure_approvals(id) ON DELETE RESTRICT,
  previous_state agency_private.lifecycle_state,
  new_state agency_private.lifecycle_state NOT NULL,
  reason text CHECK (char_length(reason) <= 1000 AND reason !~ '[<>]'),
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  operation_correlation_id uuid NOT NULL,
  UNIQUE (update_id,revision),
  FOREIGN KEY (organization_id,update_id)
    REFERENCES agency_private.agency_updates(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (update_id,revision)
    REFERENCES agency_private.agency_update_revisions(update_id,revision) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,authority_id)
    REFERENCES agency_private.organization_county_authorities(organization_id,id) ON DELETE RESTRICT,
  CHECK ((event_type = 'road_closure_activated') = (approval_id IS NOT NULL))
);
CREATE INDEX agency_update_events_org_time_idx
  ON agency_private.agency_update_events(organization_id,occurred_at DESC);
CREATE INDEX agency_update_events_activation_lineage_idx
  ON agency_private.agency_update_events(update_id,event_type,revision);

CREATE TABLE agency_private.activation_rate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  update_id uuid NOT NULL,
  revision integer NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (update_id,revision),
  FOREIGN KEY (organization_id,update_id)
    REFERENCES agency_private.agency_updates(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (update_id,revision)
    REFERENCES agency_private.agency_update_revisions(update_id,revision) ON DELETE RESTRICT
);
CREATE INDEX activation_rate_events_rolling_idx
  ON agency_private.activation_rate_events(organization_id,activated_at DESC);

CREATE TABLE agency_private.operation_receipts (
  token_digest bytea PRIMARY KEY CHECK (octet_length(token_digest) = 32),
  payload_digest bytea NOT NULL CHECK (octet_length(payload_digest) = 32),
  actor_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  command_family text NOT NULL CHECK (command_family IN ('update','membership','governance')),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  target_id uuid,
  bounded_result jsonb NOT NULL CHECK (jsonb_typeof(bounded_result) = 'object'
    AND octet_length(bounded_result::text) <= 1024),
  accepted_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX operation_receipts_actor_time_idx
  ON agency_private.operation_receipts(actor_user_id,accepted_at DESC);
CREATE INDEX operation_receipts_org_time_idx
  ON agency_private.operation_receipts(organization_id,accepted_at DESC);

CREATE TABLE agency_private.governance_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  actor_session_id uuid NOT NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  target_id uuid,
  target_revision integer,
  before_state jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(before_state) = 'object'
    AND octet_length(before_state::text) <= 4096),
  after_state jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(after_state) = 'object'
    AND octet_length(after_state::text) <= 4096),
  reason text CHECK (char_length(reason) <= 1000 AND reason !~ '[<>]'),
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  operation_correlation_id uuid NOT NULL
);
CREATE INDEX governance_events_org_time_idx
  ON agency_private.governance_events(organization_id,occurred_at DESC);

-- Exact frozen consumer allowlist: this table has exactly 18 columns.
CREATE TABLE responder_public.agency_updates (
  update_id uuid PRIMARY KEY,
  organization_public_name text NOT NULL,
  approved_department_name text,
  verified_agency boolean NOT NULL CHECK (verified_agency),
  verified_agency_label text NOT NULL CHECK (verified_agency_label = 'Verified Agency'),
  condition_type text NOT NULL CHECK (condition_type IN
    ('road_closed','high_water','obstruction','construction','public_works_notice')),
  impact_level text NOT NULL,
  title text NOT NULL,
  detail text,
  location jsonb NOT NULL CHECK (jsonb_typeof(location) = 'object'
    AND location = jsonb_build_object('latitude',location->'latitude','longitude',location->'longitude')),
  road_name text,
  cross_street text,
  crossing_id text,
  source_family text NOT NULL CHECK (source_family = 'AGENCY_OFFICIAL'),
  activated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  display_lifecycle_state text NOT NULL CHECK (display_lifecycle_state = 'active')
);
CREATE INDEX responder_public_agency_updates_expiry_idx
  ON responder_public.agency_updates(expires_at);

CREATE FUNCTION agency_private.reject_append_only_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION 'append-only responder evidence cannot be changed' USING ERRCODE = '55000';
END
$fn$;
REVOKE ALL ON FUNCTION agency_private.reject_append_only_mutation() FROM PUBLIC;

DO $triggers$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'agency_update_revisions','road_closure_approvals','agency_update_events',
    'activation_rate_events','operation_receipts','governance_events'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON agency_private.%I FOR EACH STATEMENT EXECUTE FUNCTION agency_private.reject_append_only_mutation()',
      v_table || '_append_only',v_table);
  END LOOP;
END
$triggers$;

CREATE FUNCTION agency_private._live_auth_context()
RETURNS TABLE(actor_user_id uuid,session_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid;
  v_jwt jsonb;
  v_session uuid;
  v_iat bigint;
BEGIN
  v_uid := auth.uid();
  v_jwt := auth.jwt();
  IF v_uid IS NULL OR v_jwt IS NULL OR jsonb_typeof(v_jwt) <> 'object'
     OR v_jwt->>'sub' IS DISTINCT FROM v_uid::text
     OR v_jwt->>'aal' IS DISTINCT FROM 'aal2'
     OR coalesce(v_jwt->>'session_id','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR jsonb_typeof(v_jwt->'amr') IS DISTINCT FROM 'array' THEN
    RETURN;
  END IF;
  BEGIN
    v_session := (v_jwt->>'session_id')::uuid;
    v_iat := (v_jwt->>'iat')::bigint;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_jwt->'amr') a
    WHERE jsonb_typeof(a) = 'object' AND a->>'method' = 'totp'
  ) THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1
    FROM auth.sessions s
    JOIN auth.mfa_factors f ON f.id = s.factor_id AND f.user_id = s.user_id
    WHERE s.id = v_session AND s.user_id = v_uid AND s.aal::text = 'aal2'
      AND s.factor_id IS NOT NULL AND f.factor_type::text = 'totp'
      AND f.status::text = 'verified'
      AND EXISTS (SELECT 1 FROM auth.mfa_amr_claims amr
        WHERE amr.session_id = s.id AND lower(amr.authentication_method::text) = 'totp')
      AND EXISTS (SELECT 1 FROM agency_private.principals p
        WHERE p.user_id = v_uid AND p.status = 'active'
          AND (p.minimum_iat IS NULL OR v_iat >= p.minimum_iat))
  ) THEN
    actor_user_id := v_uid;
    session_id := v_session;
    RETURN NEXT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Managed Auth schema drift and malformed request state deny, never degrade.
  RETURN;
END
$fn$;
REVOKE ALL ON FUNCTION agency_private._live_auth_context() FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION agency_private.current_responder_security_context()
RETURNS TABLE(actor_user_id uuid,session_id uuid,organization_id uuid,
  agency_role agency_private.membership_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT a.actor_user_id,a.session_id,m.organization_id,m.role
  FROM agency_private._live_auth_context() a
  JOIN agency_private.organization_memberships m ON m.user_id = a.actor_user_id
    AND m.status = 'active'
  JOIN agency_private.organizations o ON o.id = m.organization_id
    AND o.verification_status = 'verified' AND o.operating_status = 'active'
$fn$;
REVOKE ALL ON FUNCTION agency_private.current_responder_security_context()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA agency_private TO authenticated;
GRANT EXECUTE ON FUNCTION agency_private.current_responder_security_context() TO authenticated;

CREATE FUNCTION agency_private.current_gridly_admin_security_context()
RETURNS TABLE(actor_user_id uuid,session_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT a.actor_user_id,a.session_id
  FROM agency_private._live_auth_context() a
  JOIN agency_private.gridly_admin_grants g ON g.user_id = a.actor_user_id AND g.active
$fn$;
REVOKE ALL ON FUNCTION agency_private.current_gridly_admin_security_context()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION agency_private.current_gridly_admin_security_context() TO authenticated;

CREATE FUNCTION agency_private._current_authority_for_point(
  p_organization_id uuid,p_location extensions.geometry,p_at timestamptz)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT a.id
  FROM agency_private.organization_county_authorities a
  JOIN public.gridly_texas_county_boundaries c ON c.county_fips = a.county_fips
    AND c.boundary_version = a.boundary_version
  WHERE a.organization_id = p_organization_id AND a.status = 'approved'
    AND a.effective_from <= p_at AND (a.effective_until IS NULL OR a.effective_until > p_at)
    AND extensions.ST_SRID(p_location) = 4326
    AND extensions.ST_Contains(c.geom,p_location)
  ORDER BY a.county_fips
  LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION agency_private._current_authority_for_point(uuid,extensions.geometry,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION agency_private._public_update_eligible(p_update_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM agency_private.agency_updates u
    JOIN agency_private.agency_update_revisions r
      ON r.update_id = u.id AND r.revision = u.current_revision
    JOIN agency_private.organizations o ON o.id = u.organization_id
    JOIN agency_private.organization_county_authorities a
      ON a.id = r.authority_id AND a.organization_id = u.organization_id
    JOIN public.gridly_texas_county_boundaries c ON c.county_fips = a.county_fips
      AND c.boundary_version = a.boundary_version
    JOIN agency_private.agency_update_events current_event
      ON current_event.update_id = u.id AND current_event.revision = u.current_revision
    JOIN agency_private.agency_update_events activation_event
      ON activation_event.update_id = u.id AND activation_event.revision = u.activation_revision
    WHERE u.id = p_update_id AND u.source_family = 'AGENCY_OFFICIAL'
      AND u.stored_state = 'active' AND r.state = 'active'
      AND o.verification_status = 'verified' AND o.operating_status = 'active'
      AND o.agency_publishing_enabled AND r.expires_at > statement_timestamp()
      AND a.status = 'approved' AND a.effective_from <= statement_timestamp()
      AND (a.effective_until IS NULL OR a.effective_until > statement_timestamp())
      AND extensions.ST_Contains(c.geom,r.location)
      AND current_event.event_type IN ('update_activated','road_closure_activated','update_edited','update_renewed')
      AND current_event.new_state = 'active' AND current_event.authority_id = r.authority_id
      AND activation_event.event_type IN ('update_activated','road_closure_activated')
      AND activation_event.previous_state = 'pending_review'
      AND activation_event.new_state = 'active'
      AND (r.condition_type <> 'road_closed' OR
        (activation_event.event_type = 'road_closure_activated'
          AND activation_event.actor_user_id <> u.created_by_user_id
          AND activation_event.approval_id IS NOT NULL))
  )
$fn$;
REVOKE ALL ON FUNCTION agency_private._public_update_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agency_private._public_update_eligible(uuid) TO anon, authenticated;

CREATE FUNCTION agency_private._refresh_public_projection(p_update_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  DELETE FROM responder_public.agency_updates WHERE update_id = p_update_id;
  INSERT INTO responder_public.agency_updates
    (update_id,organization_public_name,approved_department_name,verified_agency,
     verified_agency_label,condition_type,impact_level,title,detail,location,
     road_name,cross_street,crossing_id,source_family,activated_at,updated_at,
     expires_at,display_lifecycle_state)
  SELECT u.id,o.public_name,o.approved_department_name,true,'Verified Agency',
    r.condition_type::text,r.impact_level,r.title,r.detail,
    jsonb_build_object('latitude',extensions.ST_Y(r.location),
      'longitude',extensions.ST_X(r.location)),
    r.road_name,r.cross_street,r.crossing_id,u.source_family,
    r.activated_at,u.updated_at,r.expires_at,'active'
  FROM agency_private.agency_updates u
  JOIN agency_private.agency_update_revisions r
    ON r.update_id = u.id AND r.revision = u.current_revision
  JOIN agency_private.organizations o ON o.id = u.organization_id
  WHERE u.id = p_update_id AND u.stored_state = 'active' AND r.state = 'active';
END
$fn$;
REVOKE ALL ON FUNCTION agency_private._refresh_public_projection(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION agency_private.agency_update_command(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_context record;
  v_org uuid;
  v_action text;
  v_token uuid;
  v_target uuid;
  v_expected integer;
  v_payload jsonb;
  v_token_digest bytea;
  v_payload_digest bytea;
  v_receipt agency_private.operation_receipts%ROWTYPE;
  v_update agency_private.agency_updates%ROWTYPE;
  v_prior agency_private.agency_update_revisions%ROWTYPE;
  v_revision integer;
  v_now timestamptz := statement_timestamp();
  v_point extensions.geometry(Point,4326);
  v_authority uuid;
  v_condition agency_private.condition_type;
  v_impact text;
  v_title text;
  v_detail text;
  v_road text;
  v_cross text;
  v_crossing text;
  v_reason text;
  v_hours numeric := 12;
  v_state agency_private.lifecycle_state;
  v_event agency_private.update_event_type;
  v_activation_revision integer;
  v_activated_at timestamptz;
  v_expires_at timestamptz;
  v_approval uuid;
  v_correlation uuid := gen_random_uuid();
  v_result jsonb;
  v_allowed text[];
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
     OR octet_length(p_request::text) > 8192
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_request) k
       WHERE k NOT IN ('contract_version','action','operation_token',
         'organization_id','update_id','expected_revision','payload'))
     OR p_request->>'contract_version' IS DISTINCT FROM 'responder.agency.v1.phase0.1'
     OR coalesce(p_request->>'operation_token','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR coalesce(p_request->>'organization_id','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR jsonb_typeof(p_request->'payload') IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_action := p_request->>'action';
  IF v_action IS NULL OR v_action NOT IN
    ('create_draft','edit_own_draft','edit_another_draft','submit_for_review',
     'return_for_changes','activate_non_closure','activate_road_closed',
     'edit_active_update','renew_update','resolve_update','withdraw_update') THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_org := (p_request->>'organization_id')::uuid;
  v_token := (p_request->>'operation_token')::uuid;
  v_payload := p_request->'payload';

  SELECT * INTO v_context FROM agency_private.current_responder_security_context();
  IF NOT FOUND OR v_context.organization_id <> v_org THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;
  IF v_context.agency_role = 'VIEWER'
     OR (v_action IN ('edit_another_draft','return_for_changes','activate_non_closure',
       'activate_road_closed','edit_active_update','renew_update','resolve_update')
       AND v_context.agency_role NOT IN ('SUPERVISOR','AGENCY_ADMIN')) THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;

  IF v_action = 'create_draft' THEN
    IF p_request ? 'update_id' OR p_request ? 'expected_revision' THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
  ELSE
    IF coalesce(p_request->>'update_id','') !~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR coalesce(p_request->>'expected_revision','') !~ '^(0|[1-9][0-9]{0,8})$' THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
    v_target := (p_request->>'update_id')::uuid;
    v_expected := (p_request->>'expected_revision')::integer;
  END IF;

  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','edit_active_update') THEN
    v_allowed := ARRAY['condition_type','impact_level','title','detail','longitude','latitude',
      'road_name','cross_street','crossing_id'];
  ELSIF v_action IN ('activate_non_closure','activate_road_closed','renew_update') THEN
    v_allowed := ARRAY['expiry_hours'];
  ELSIF v_action IN ('return_for_changes','resolve_update','withdraw_update') THEN
    v_allowed := ARRAY['reason'];
  ELSE
    v_allowed := ARRAY[]::text[];
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) k WHERE k <> ALL(v_allowed)) THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;

  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','edit_active_update') THEN
    BEGIN
      v_condition := (v_payload->>'condition_type')::agency_private.condition_type;
      IF jsonb_typeof(v_payload->'longitude') <> 'number'
         OR jsonb_typeof(v_payload->'latitude') <> 'number' THEN
        RETURN jsonb_build_object('status','invalid_request');
      END IF;
      v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(
        (v_payload->>'longitude')::double precision,
        (v_payload->>'latitude')::double precision),4326);
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('status','invalid_request');
    END;
    v_impact := trim(v_payload->>'impact_level');
    v_title := trim(v_payload->>'title');
    v_detail := nullif(trim(v_payload->>'detail'),'');
    v_road := nullif(trim(v_payload->>'road_name'),'');
    v_cross := nullif(trim(v_payload->>'cross_street'),'');
    v_crossing := nullif(trim(v_payload->>'crossing_id'),'');
    IF v_impact IS NULL OR char_length(v_impact) NOT BETWEEN 1 AND 40
       OR v_title IS NULL OR char_length(v_title) NOT BETWEEN 1 AND 120
       OR char_length(coalesce(v_detail,'')) > 1000
       OR char_length(coalesce(v_road,'')) > 120
       OR char_length(coalesce(v_cross,'')) > 120
       OR char_length(coalesce(v_crossing,'')) > 120
       OR concat_ws(' ',v_impact,v_title,v_detail,v_road,v_cross) ~ '[<>]'
       OR NOT extensions.ST_IsValid(v_point)
       OR extensions.ST_X(v_point) NOT BETWEEN -180 AND 180
       OR extensions.ST_Y(v_point) NOT BETWEEN -90 AND 90 THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
  END IF;
  IF v_action IN ('return_for_changes','resolve_update','withdraw_update') THEN
    v_reason := trim(v_payload->>'reason');
    IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 1 AND 1000
       OR v_reason ~ '[<>]' THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
  END IF;
  IF v_action IN ('activate_non_closure','activate_road_closed','renew_update')
     AND v_payload ? 'expiry_hours' THEN
    BEGIN v_hours := (v_payload->>'expiry_hours')::numeric;
    EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('status','invalid_request'); END;
    IF v_hours <= 0 OR v_hours > 24 THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
  END IF;

  v_token_digest := extensions.digest(decode(replace(v_token::text,'-',''),'hex'),'sha256');
  v_payload_digest := extensions.digest(convert_to((p_request - 'operation_token')::text,'UTF8'),'sha256');
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(v_token_digest,'hex'),0));
  SELECT * INTO v_receipt FROM agency_private.operation_receipts
    WHERE token_digest = v_token_digest;
  IF FOUND THEN
    IF v_receipt.payload_digest = v_payload_digest
       AND v_receipt.actor_user_id = v_context.actor_user_id
       AND v_receipt.organization_id = v_org
       AND v_receipt.command_family = 'update' AND v_receipt.action = v_action
       AND (v_action='create_draft' OR v_receipt.target_id IS NOT DISTINCT FROM v_target) THEN
      RETURN jsonb_build_object('status','already_processed',
        'correlation_id',v_receipt.bounded_result->>'correlation_id');
    END IF;
    RETURN jsonb_build_object('status','invalid_request');
  END IF;

  IF v_action <> 'create_draft' THEN
    SELECT * INTO v_update FROM agency_private.agency_updates
      WHERE id = v_target AND organization_id = v_org FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_update.current_revision <> v_expected THEN
      RETURN jsonb_build_object('status','stale_revision');
    END IF;
    SELECT * INTO STRICT v_prior FROM agency_private.agency_update_revisions
      WHERE update_id = v_target AND revision = v_expected;
    IF v_update.stored_state IN ('resolved','withdrawn') THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_update.stored_state = 'active' AND v_prior.expires_at <= v_now THEN
      RETURN jsonb_build_object('status','expired');
    END IF;
    IF v_action = 'edit_own_draft' AND v_update.created_by_user_id <> v_context.actor_user_id THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_action = 'submit_for_review' AND v_context.agency_role = 'RESPONDER'
       AND v_update.created_by_user_id <> v_context.actor_user_id THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_action = 'withdraw_update' AND v_context.agency_role = 'RESPONDER'
       AND (v_update.created_by_user_id <> v_context.actor_user_id
         OR v_update.stored_state NOT IN ('draft','pending_review')) THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_action IN ('edit_own_draft','edit_another_draft','submit_for_review')
       AND v_update.stored_state <> 'draft' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_action IN ('return_for_changes','activate_non_closure','activate_road_closed')
       AND v_update.stored_state <> 'pending_review' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_action IN ('edit_active_update','renew_update','resolve_update')
       AND v_update.stored_state <> 'active' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_action = 'activate_non_closure' AND v_prior.condition_type = 'road_closed' THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
    IF v_action = 'activate_road_closed' AND v_prior.condition_type <> 'road_closed' THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
    IF v_action = 'activate_road_closed' AND v_update.created_by_user_id = v_context.actor_user_id THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_action = 'activate_road_closed' AND NOT EXISTS (
      SELECT 1 FROM agency_private.principals p
      JOIN agency_private.organization_memberships m ON m.user_id = p.user_id
      WHERE p.user_id = v_update.created_by_user_id AND p.status = 'active'
        AND m.organization_id = v_org AND m.status = 'active'
        AND m.role IN ('RESPONDER','SUPERVISOR','AGENCY_ADMIN')) THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_action = 'edit_active_update' AND v_condition <> v_prior.condition_type THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
    -- No production-governed crossing registry is part of this candidate. A
    -- non-null crossing selector therefore remains fail-closed at publication.
    IF v_action IN ('activate_non_closure','activate_road_closed') AND v_prior.crossing_id IS NOT NULL THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
    IF v_action='edit_active_update' AND v_crossing IS NOT NULL THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
  END IF;

  IF v_action IN ('activate_non_closure','activate_road_closed','edit_active_update','renew_update')
     AND NOT EXISTS (SELECT 1 FROM agency_private.organizations
       WHERE id = v_org AND agency_publishing_enabled) THEN
    RETURN jsonb_build_object('status','maintenance');
  END IF;

  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','edit_active_update') THEN
    v_authority := agency_private._current_authority_for_point(v_org,v_point,v_now);
  ELSIF v_action IN ('submit_for_review','activate_non_closure','activate_road_closed','renew_update') THEN
    v_point := v_prior.location;
    v_authority := agency_private._current_authority_for_point(v_org,v_point,v_now);
  END IF;
  IF v_action IN ('create_draft','edit_own_draft','edit_another_draft','submit_for_review',
      'activate_non_closure','activate_road_closed','edit_active_update','renew_update')
     AND v_authority IS NULL THEN
    RETURN jsonb_build_object('status','out_of_scope');
  END IF;

  IF v_action IN ('activate_non_closure','activate_road_closed') THEN
    PERFORM 1 FROM agency_private.organizations WHERE id = v_org FOR UPDATE;
    IF (SELECT count(*) FROM agency_private.activation_rate_events
        WHERE organization_id = v_org
          AND activated_at > v_now - interval '60 minutes' AND activated_at <= v_now) >= 60 THEN
      RETURN jsonb_build_object('status','rate_limited');
    END IF;
  END IF;

  IF v_action = 'create_draft' THEN
    v_target := gen_random_uuid(); v_revision := 0; v_state := 'draft';
    v_event := 'update_draft_created';
    INSERT INTO agency_private.agency_updates
      (id,organization_id,created_by_user_id,created_session_id,stored_state,current_revision)
    VALUES (v_target,v_org,v_context.actor_user_id,v_context.session_id,'draft',0);
  ELSE
    v_revision := v_expected + 1;
    v_condition := coalesce(v_condition,v_prior.condition_type);
    v_impact := coalesce(v_impact,v_prior.impact_level);
    v_title := coalesce(v_title,v_prior.title);
    v_detail := coalesce(v_detail,v_prior.detail);
    v_point := coalesce(v_point,v_prior.location);
    v_road := coalesce(v_road,v_prior.road_name);
    v_cross := coalesce(v_cross,v_prior.cross_street);
    v_crossing := coalesce(v_crossing,v_prior.crossing_id);
    v_authority := coalesce(v_authority,v_prior.authority_id);
    v_activation_revision := v_prior.activation_revision;
    v_activated_at := v_prior.activated_at;
    v_expires_at := v_prior.expires_at;
    CASE v_action
      WHEN 'edit_own_draft','edit_another_draft' THEN v_state := 'draft'; v_event := 'update_draft_edited';
      WHEN 'submit_for_review' THEN v_state := 'pending_review'; v_event := 'update_submitted';
      WHEN 'return_for_changes' THEN v_state := 'draft'; v_event := 'update_returned';
      WHEN 'activate_non_closure' THEN v_state := 'active'; v_event := 'update_activated';
      WHEN 'activate_road_closed' THEN v_state := 'active'; v_event := 'road_closure_activated';
      WHEN 'edit_active_update' THEN v_state := 'active'; v_event := 'update_edited';
      WHEN 'renew_update' THEN v_state := 'active'; v_event := 'update_renewed';
      WHEN 'resolve_update' THEN v_state := 'resolved'; v_event := 'update_resolved';
      WHEN 'withdraw_update' THEN v_state := 'withdrawn'; v_event := 'update_withdrawn';
    END CASE;
    IF v_action IN ('activate_non_closure','activate_road_closed') THEN
      v_activation_revision := v_revision; v_activated_at := v_now;
      v_expires_at := v_now + make_interval(secs => (v_hours * 3600)::double precision);
    ELSIF v_action = 'renew_update' THEN
      v_expires_at := v_now + make_interval(secs => (v_hours * 3600)::double precision);
    END IF;
    IF v_action = 'activate_road_closed' THEN
      INSERT INTO agency_private.road_closure_approvals
        (update_id,pending_revision,organization_id,creator_user_id,approver_user_id,approver_session_id)
      VALUES (v_target,v_expected,v_org,v_update.created_by_user_id,
        v_context.actor_user_id,v_context.session_id) RETURNING id INTO v_approval;
    END IF;
  END IF;

  INSERT INTO agency_private.agency_update_revisions
    (update_id,revision,organization_id,state,condition_type,impact_level,title,detail,
     location,road_name,cross_street,crossing_id,authority_id,activation_revision,
     activated_at,expires_at,authored_by_user_id,authored_session_id,created_at)
  VALUES (v_target,v_revision,v_org,v_state,v_condition,v_impact,v_title,v_detail,v_point,
    v_road,v_cross,v_crossing,v_authority,v_activation_revision,v_activated_at,v_expires_at,
    v_context.actor_user_id,v_context.session_id,v_now);

  UPDATE agency_private.agency_updates SET stored_state = v_state,current_revision = v_revision,
    activation_revision = v_activation_revision,updated_at = v_now WHERE id = v_target;

  INSERT INTO agency_private.agency_update_events
    (update_id,revision,organization_id,event_type,actor_user_id,actor_session_id,
     authority_id,approval_id,previous_state,new_state,reason,occurred_at,operation_correlation_id)
  VALUES (v_target,v_revision,v_org,v_event,v_context.actor_user_id,v_context.session_id,
    v_authority,v_approval,CASE WHEN v_action = 'create_draft' THEN NULL ELSE v_prior.state END,
    v_state,v_reason,v_now,v_correlation);
  IF v_action IN ('activate_non_closure','activate_road_closed') THEN
    INSERT INTO agency_private.activation_rate_events
      (organization_id,update_id,revision,activated_at)
    VALUES (v_org,v_target,v_revision,v_now);
  END IF;
  PERFORM agency_private._refresh_public_projection(v_target);
  v_result := jsonb_build_object('status',CASE WHEN v_state = 'pending_review'
    THEN 'pending_review' ELSE 'accepted' END,'update_id',v_target,
    'revision',v_revision,'correlation_id',v_correlation);
  INSERT INTO agency_private.operation_receipts
    (token_digest,payload_digest,actor_user_id,organization_id,command_family,
     action,target_id,bounded_result)
  VALUES (v_token_digest,v_payload_digest,v_context.actor_user_id,v_org,'update',
    v_action,v_target,v_result);
  RETURN v_result;
EXCEPTION WHEN unique_violation OR foreign_key_violation OR check_violation THEN
  RETURN jsonb_build_object('status','invalid_request');
WHEN OTHERS THEN
  RAISE LOG 'responder update command SQLSTATE %: %',SQLSTATE,SQLERRM;
  RETURN jsonb_build_object('status','retryable_failure');
END
$fn$;
REVOKE ALL ON FUNCTION agency_private.agency_update_command(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION agency_private.agency_update_command(jsonb) TO authenticated;

CREATE FUNCTION agency_private._withdraw_active_updates(
  p_organization_id uuid,p_actor_user_id uuid,p_actor_session_id uuid,
  p_reason text,p_authority_id uuid,p_correlation uuid)
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_row record; v_revision integer; v_count integer := 0; v_now timestamptz := statement_timestamp();
BEGIN
  FOR v_row IN
    SELECT u.*,r.* FROM agency_private.agency_updates u
    JOIN agency_private.agency_update_revisions r
      ON r.update_id = u.id AND r.revision = u.current_revision
    WHERE u.organization_id = p_organization_id AND u.stored_state = 'active'
      AND (p_authority_id IS NULL OR r.authority_id = p_authority_id)
    ORDER BY u.id FOR UPDATE OF u
  LOOP
    v_revision := v_row.current_revision + 1;
    INSERT INTO agency_private.agency_update_revisions
      (update_id,revision,organization_id,state,condition_type,impact_level,title,detail,
       location,road_name,cross_street,crossing_id,authority_id,activation_revision,
       activated_at,expires_at,authored_by_user_id,authored_session_id,created_at)
    VALUES (v_row.id,v_revision,p_organization_id,'withdrawn',v_row.condition_type,
      v_row.impact_level,v_row.title,v_row.detail,v_row.location,v_row.road_name,
      v_row.cross_street,v_row.crossing_id,v_row.authority_id,v_row.activation_revision,
      v_row.activated_at,v_row.expires_at,p_actor_user_id,p_actor_session_id,v_now);
    UPDATE agency_private.agency_updates SET stored_state = 'withdrawn',
      current_revision = v_revision,updated_at = v_now WHERE id = v_row.id;
    INSERT INTO agency_private.agency_update_events
      (update_id,revision,organization_id,event_type,actor_user_id,actor_session_id,
       authority_id,previous_state,new_state,reason,occurred_at,operation_correlation_id)
    VALUES (v_row.id,v_revision,p_organization_id,'update_withdrawn',p_actor_user_id,
      p_actor_session_id,v_row.authority_id,'active','withdrawn',p_reason,v_now,p_correlation);
    PERFORM agency_private._refresh_public_projection(v_row.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END
$fn$;
REVOKE ALL ON FUNCTION agency_private._withdraw_active_updates(uuid,uuid,uuid,text,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION agency_private.agency_governance_command(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_context record;
  v_org uuid;
  v_action text;
  v_token uuid;
  v_expected integer;
  v_payload jsonb;
  v_reason text;
  v_target uuid;
  v_request_target uuid;
  v_fips text;
  v_boundary_version text;
  v_authority_version integer;
  v_now timestamptz := statement_timestamp();
  v_token_digest bytea;
  v_payload_digest bytea;
  v_receipt agency_private.operation_receipts%ROWTYPE;
  v_organization agency_private.organizations%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_correlation uuid := gen_random_uuid();
  v_result jsonb;
  v_withdrawn integer := 0;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
     OR octet_length(p_request::text) > 4096
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN
       ('contract_version','action','operation_token','organization_id',
        'expected_revision','target_id','payload'))
     OR p_request->>'contract_version' IS DISTINCT FROM 'responder.agency.v1.phase0.1'
     OR coalesce(p_request->>'operation_token','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR coalesce(p_request->>'organization_id','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR coalesce(p_request->>'expected_revision','') !~ '^(0|[1-9][0-9]{0,8})$'
     OR jsonb_typeof(p_request->'payload') IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_action := p_request->>'action';
  IF v_action IS NULL OR v_action NOT IN
    ('start_verification_review','verify_organization','reject_organization',
     'revoke_organization_verification','activate_organization','suspend_organization',
     'reinstate_organization','approve_authority','revoke_authority',
     'change_agency_publishing_gate') THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  SELECT * INTO v_context FROM agency_private.current_gridly_admin_security_context();
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  v_org := (p_request->>'organization_id')::uuid;
  v_expected := (p_request->>'expected_revision')::integer;
  v_token := (p_request->>'operation_token')::uuid;
  v_payload := p_request->'payload';
  v_reason := trim(v_payload->>'reason');
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 1 AND 1000 OR v_reason ~ '[<>]'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) k WHERE
       (v_action = 'start_verification_review' AND k NOT IN ('reason','evidence_reference'))
       OR (v_action = 'verify_organization' AND k NOT IN
         ('reason','evidence_reference','official_callback_confirmed','initial_admin_user_id'))
       OR (v_action = 'approve_authority' AND k NOT IN ('reason','county_fips'))
       OR (v_action = 'change_agency_publishing_gate'
         AND k NOT IN ('reason','enabled','owner_authorization_id'))
       OR (v_action NOT IN ('start_verification_review','verify_organization',
           'approve_authority','change_agency_publishing_gate')
         AND k <> 'reason')) THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF v_action IN ('start_verification_review','verify_organization') AND
    (jsonb_typeof(v_payload->'evidence_reference')<>'string'
      OR char_length(trim(v_payload->>'evidence_reference')) NOT BETWEEN 1 AND 160
      OR v_payload->>'evidence_reference' ~ '[<>]') THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF v_action='verify_organization' AND
    (v_payload->'official_callback_confirmed' IS DISTINCT FROM 'true'::jsonb
      OR coalesce(v_payload->>'initial_admin_user_id','') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR NOT EXISTS (SELECT 1 FROM agency_private.organization_memberships m
        JOIN agency_private.principals p ON p.user_id=m.user_id AND p.status='active'
        WHERE m.organization_id=v_org AND m.user_id=(v_payload->>'initial_admin_user_id')::uuid
          AND m.status='active' AND m.role='AGENCY_ADMIN')) THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF v_action = 'revoke_authority' THEN
    IF coalesce(p_request->>'target_id','') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
    v_target := (p_request->>'target_id')::uuid;
  ELSIF p_request ? 'target_id' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_request_target := v_target;

  v_token_digest := extensions.digest(decode(replace(v_token::text,'-',''),'hex'),'sha256');
  v_payload_digest := extensions.digest(convert_to((p_request - 'operation_token')::text,'UTF8'),'sha256');
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(v_token_digest,'hex'),0));
  SELECT * INTO v_receipt FROM agency_private.operation_receipts
    WHERE token_digest = v_token_digest;
  IF FOUND THEN
    IF v_receipt.payload_digest = v_payload_digest
       AND v_receipt.actor_user_id = v_context.actor_user_id
       AND v_receipt.organization_id = v_org
       AND v_receipt.command_family = 'governance' AND v_receipt.action = v_action
       AND v_receipt.target_id IS NOT DISTINCT FROM v_request_target THEN
      RETURN jsonb_build_object('status','already_processed',
        'correlation_id',v_receipt.bounded_result->>'correlation_id');
    END IF;
    RETURN jsonb_build_object('status','invalid_request');
  END IF;

  SELECT * INTO v_organization FROM agency_private.organizations WHERE id = v_org FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_organization.governance_revision <> v_expected THEN
    RETURN jsonb_build_object('status','stale_revision');
  END IF;
  v_before := jsonb_build_object('verification_status',v_organization.verification_status,
    'operating_status',v_organization.operating_status,
    'agency_publishing_enabled',v_organization.agency_publishing_enabled,
    'operation_epoch',v_organization.operation_epoch,
    'governance_revision',v_organization.governance_revision);

  CASE v_action
    WHEN 'start_verification_review' THEN
      IF v_organization.verification_status <> 'requested' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
      UPDATE agency_private.organizations SET verification_status='pending_review',
        governance_revision=governance_revision+1,updated_at=v_now WHERE id=v_org;
    WHEN 'verify_organization' THEN
      IF v_organization.verification_status <> 'pending_review' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
      UPDATE agency_private.organizations SET verification_status='verified',
        governance_revision=governance_revision+1,updated_at=v_now WHERE id=v_org;
    WHEN 'reject_organization' THEN
      IF v_organization.verification_status <> 'pending_review' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
      UPDATE agency_private.organizations SET verification_status='rejected',
        governance_revision=governance_revision+1,updated_at=v_now WHERE id=v_org;
    WHEN 'revoke_organization_verification' THEN
      IF v_organization.verification_status <> 'verified' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
      UPDATE agency_private.organizations SET verification_status='revoked',operating_status='suspended',
        agency_publishing_enabled=false,publishing_authorization_id=NULL,
        operation_epoch=operation_epoch+1,governance_revision=governance_revision+1,
        updated_at=v_now WHERE id=v_org;
      v_withdrawn := agency_private._withdraw_active_updates(v_org,v_context.actor_user_id,
        v_context.session_id,v_reason,NULL,v_correlation);
    WHEN 'activate_organization' THEN
      IF v_organization.verification_status <> 'verified' OR v_organization.operating_status <> 'inactive'
         OR NOT EXISTS (SELECT 1 FROM agency_private.organization_county_authorities a
           WHERE a.organization_id=v_org AND a.status='approved' AND a.effective_from<=v_now
             AND (a.effective_until IS NULL OR a.effective_until>v_now))
         OR NOT EXISTS (SELECT 1 FROM agency_private.organization_memberships m
           JOIN agency_private.principals p ON p.user_id=m.user_id AND p.status='active'
           WHERE m.organization_id=v_org AND m.status='active' AND m.role='AGENCY_ADMIN') THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;
      UPDATE agency_private.organizations SET operating_status='active',
        operation_epoch=operation_epoch+1,governance_revision=governance_revision+1,
        updated_at=v_now WHERE id=v_org;
    WHEN 'suspend_organization' THEN
      IF v_organization.operating_status <> 'active' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
      UPDATE agency_private.organizations SET operating_status='suspended',
        agency_publishing_enabled=false,publishing_authorization_id=NULL,
        operation_epoch=operation_epoch+1,governance_revision=governance_revision+1,
        updated_at=v_now WHERE id=v_org;
      v_withdrawn := agency_private._withdraw_active_updates(v_org,v_context.actor_user_id,
        v_context.session_id,v_reason,NULL,v_correlation);
    WHEN 'reinstate_organization' THEN
      IF v_organization.verification_status <> 'verified' OR v_organization.operating_status <> 'suspended'
         OR NOT EXISTS (SELECT 1 FROM agency_private.organization_county_authorities a
           WHERE a.organization_id=v_org AND a.status='approved' AND a.effective_from<=v_now
             AND (a.effective_until IS NULL OR a.effective_until>v_now)) THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;
      UPDATE agency_private.organizations SET operating_status='active',
        operation_epoch=operation_epoch+1,governance_revision=governance_revision+1,
        updated_at=v_now WHERE id=v_org;
    WHEN 'approve_authority' THEN
      v_fips := v_payload->>'county_fips';
      IF v_organization.verification_status <> 'verified' OR v_fips !~ '^48[0-9]{3}$' THEN
        RETURN jsonb_build_object('status','out_of_scope');
      END IF;
      SELECT boundary_version INTO v_boundary_version
        FROM public.gridly_texas_county_boundaries WHERE county_fips=v_fips;
      IF NOT FOUND THEN RETURN jsonb_build_object('status','out_of_scope'); END IF;
      IF EXISTS (SELECT 1 FROM agency_private.organization_county_authorities
        WHERE organization_id=v_org AND county_fips=v_fips AND status='approved') THEN
        RETURN jsonb_build_object('status','invalid_request');
      END IF;
      SELECT coalesce(max(authority_version),0)+1 INTO v_authority_version
        FROM agency_private.organization_county_authorities
        WHERE organization_id=v_org AND county_fips=v_fips;
      INSERT INTO agency_private.organization_county_authorities
        (organization_id,county_fips,authority_version,boundary_version,
         approved_by_user_id,effective_from)
      VALUES (v_org,v_fips,v_authority_version,v_boundary_version,
        v_context.actor_user_id,v_now) RETURNING id INTO v_target;
      UPDATE agency_private.organizations SET governance_revision=governance_revision+1,
        updated_at=v_now WHERE id=v_org;
    WHEN 'revoke_authority' THEN
      UPDATE agency_private.organization_county_authorities SET status='revoked',
        revoked_by_user_id=v_context.actor_user_id,revoked_at=v_now
      WHERE id=v_target AND organization_id=v_org AND status='approved';
      IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
      UPDATE agency_private.organizations SET governance_revision=governance_revision+1,
        updated_at=v_now WHERE id=v_org;
      v_withdrawn := agency_private._withdraw_active_updates(v_org,v_context.actor_user_id,
        v_context.session_id,v_reason,v_target,v_correlation);
    WHEN 'change_agency_publishing_gate' THEN
      IF jsonb_typeof(v_payload->'enabled') <> 'boolean' THEN
        RETURN jsonb_build_object('status','invalid_request');
      END IF;
      IF (v_payload->>'enabled')::boolean AND
        (v_organization.verification_status <> 'verified' OR v_organization.operating_status <> 'active'
          OR coalesce(v_payload->>'owner_authorization_id','') !~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        RETURN jsonb_build_object('status','forbidden');
      END IF;
      UPDATE agency_private.organizations SET
        agency_publishing_enabled=(v_payload->>'enabled')::boolean,
        publishing_authorization_id=CASE WHEN (v_payload->>'enabled')::boolean
          THEN (v_payload->>'owner_authorization_id')::uuid ELSE NULL END,
        governance_revision=governance_revision+1,updated_at=v_now WHERE id=v_org;
  END CASE;

  SELECT jsonb_build_object('verification_status',verification_status,
    'operating_status',operating_status,'agency_publishing_enabled',agency_publishing_enabled,
    'operation_epoch',operation_epoch,'governance_revision',governance_revision)
    INTO v_after FROM agency_private.organizations WHERE id=v_org;
  IF v_action IN ('start_verification_review','verify_organization') THEN
    v_after:=v_after||jsonb_build_object('evidence_reference',trim(v_payload->>'evidence_reference'));
  END IF;
  INSERT INTO agency_private.governance_events
    (organization_id,actor_user_id,actor_session_id,action,target_id,target_revision,
     before_state,after_state,reason,occurred_at,operation_correlation_id)
  VALUES (v_org,v_context.actor_user_id,v_context.session_id,v_action,v_target,v_expected,
    v_before,v_after,v_reason,v_now,v_correlation);
  v_result := jsonb_build_object('status','accepted','correlation_id',v_correlation,
    'governance_revision',v_expected+1,'related_id',v_target,'withdrawn_updates',v_withdrawn);
  INSERT INTO agency_private.operation_receipts
    (token_digest,payload_digest,actor_user_id,organization_id,command_family,
     action,target_id,bounded_result)
  VALUES (v_token_digest,v_payload_digest,v_context.actor_user_id,v_org,'governance',
    v_action,v_request_target,v_result);
  RETURN v_result;
EXCEPTION WHEN unique_violation OR foreign_key_violation OR check_violation THEN
  RETURN jsonb_build_object('status','invalid_request');
WHEN OTHERS THEN
  RAISE LOG 'responder governance command SQLSTATE %: %',SQLSTATE,SQLERRM;
  RETURN jsonb_build_object('status','retryable_failure');
END
$fn$;
REVOKE ALL ON FUNCTION agency_private.agency_governance_command(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION agency_private.agency_governance_command(jsonb) TO authenticated;

CREATE TYPE agency_private.invite_status AS ENUM ('created','redeemed','revoked');
CREATE TABLE agency_private.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  intended_user_id uuid,
  intended_email text NOT NULL CHECK (intended_email = lower(trim(intended_email))
    AND char_length(intended_email) BETWEEN 3 AND 254 AND intended_email LIKE '%@%'),
  proposed_role agency_private.membership_role NOT NULL,
  token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest)=32),
  status agency_private.invite_status NOT NULL DEFAULT 'created',
  invited_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (status <> 'redeemed' OR redeemed_at IS NOT NULL),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX organization_invites_one_live_email_idx
  ON agency_private.organization_invites(organization_id,intended_email) WHERE status='created';
CREATE INDEX organization_invites_expiry_idx
  ON agency_private.organization_invites(expires_at) WHERE status='created';

CREATE FUNCTION agency_private.agency_membership_command(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_responder record; v_live record; v_admin record;
  v_actor uuid; v_session uuid; v_org uuid; v_target uuid; v_request_target uuid; v_token uuid;
  v_action text; v_payload jsonb; v_reason text; v_email text; v_role agency_private.membership_role;
  v_target_user uuid; v_invite agency_private.organization_invites%ROWTYPE;
  v_member agency_private.organization_memberships%ROWTYPE; v_now timestamptz:=statement_timestamp();
  v_token_digest bytea; v_payload_digest bytea; v_receipt agency_private.operation_receipts%ROWTYPE;
  v_correlation uuid:=gen_random_uuid(); v_result jsonb; v_hours numeric:=72;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request)<>'object' OR octet_length(p_request::text)>4096
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_request) k WHERE k NOT IN
       ('contract_version','action','operation_token','organization_id','target_id','payload'))
     OR p_request->>'contract_version' IS DISTINCT FROM 'responder.agency.v1.phase0.1'
     OR coalesce(p_request->>'operation_token','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR coalesce(p_request->>'organization_id','') !~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR jsonb_typeof(p_request->'payload') IS DISTINCT FROM 'object' THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  v_action:=p_request->>'action'; v_org:=(p_request->>'organization_id')::uuid;
  v_token:=(p_request->>'operation_token')::uuid; v_payload:=p_request->'payload';
  IF v_action IS NULL OR v_action NOT IN ('invite_member','redeem_invite','change_member_role',
    'suspend_member','reactivate_member','revoke_member','revoke_invite') THEN
    RETURN jsonb_build_object('status','invalid_request');
  END IF;
  IF v_action='redeem_invite' THEN
    SELECT * INTO v_live FROM agency_private._live_auth_context();
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    v_actor:=v_live.actor_user_id; v_session:=v_live.session_id;
  ELSE
    SELECT * INTO v_responder FROM agency_private.current_responder_security_context();
    SELECT * INTO v_admin FROM agency_private.current_gridly_admin_security_context();
    IF FOUND THEN v_actor:=v_admin.actor_user_id; v_session:=v_admin.session_id; END IF;
    IF v_responder.actor_user_id IS NOT NULL AND v_responder.organization_id=v_org
       AND v_responder.agency_role='AGENCY_ADMIN' THEN
      v_actor:=v_responder.actor_user_id; v_session:=v_responder.session_id;
    ELSIF v_actor IS NULL THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM agency_private.organizations WHERE id=v_org
    AND verification_status='verified' AND operating_status='active') THEN
    RETURN jsonb_build_object('status','forbidden');
  END IF;
  IF v_action IN ('redeem_invite','change_member_role','suspend_member','reactivate_member',
    'revoke_member','revoke_invite') THEN
    IF coalesce(p_request->>'target_id','') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_target:=(p_request->>'target_id')::uuid;
  ELSIF p_request ? 'target_id' THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  v_request_target:=v_target;

  IF v_action='invite_member' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) k WHERE k NOT IN
      ('intended_email','intended_user_id','role','invite_token_digest','expires_hours')) THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_email:=lower(trim(v_payload->>'intended_email'));
    BEGIN
      v_role:=(v_payload->>'role')::agency_private.membership_role;
      v_target_user:=nullif(v_payload->>'intended_user_id','')::uuid;
      v_hours:=coalesce((v_payload->>'expires_hours')::numeric,72);
    EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('status','invalid_request'); END;
    IF char_length(v_email) NOT BETWEEN 3 AND 254 OR v_email NOT LIKE '%@%'
      OR coalesce(v_payload->>'invite_token_digest','') !~ '^[0-9a-f]{64}$'
      OR v_hours<=0 OR v_hours>168
      OR (v_target_user IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM agency_private.principals
          WHERE user_id=v_target_user AND status='active')
        OR EXISTS (SELECT 1 FROM agency_private.organization_memberships
          WHERE user_id=v_target_user AND status='active'))) THEN
      RETURN jsonb_build_object('status','invalid_request');
    END IF;
  ELSIF v_action='redeem_invite' THEN
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) k WHERE k<>'invite_token_digest')
      OR coalesce(v_payload->>'invite_token_digest','') !~ '^[0-9a-f]{64}$' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_payload) k WHERE k NOT IN ('reason','role')) THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    v_reason:=trim(v_payload->>'reason');
    IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 1 AND 1000 OR v_reason ~ '[<>]' THEN
      RETURN jsonb_build_object('status','invalid_request'); END IF;
    IF v_action='change_member_role' THEN
      BEGIN v_role:=(v_payload->>'role')::agency_private.membership_role;
      EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('status','invalid_request'); END;
    ELSIF v_payload ? 'role' THEN RETURN jsonb_build_object('status','invalid_request'); END IF;
  END IF;

  v_token_digest:=extensions.digest(decode(replace(v_token::text,'-',''),'hex'),'sha256');
  v_payload_digest:=extensions.digest(convert_to((p_request-'operation_token')::text,'UTF8'),'sha256');
  PERFORM pg_advisory_xact_lock(hashtextextended(encode(v_token_digest,'hex'),0));
  SELECT * INTO v_receipt FROM agency_private.operation_receipts WHERE token_digest=v_token_digest;
  IF FOUND THEN
    IF v_receipt.payload_digest=v_payload_digest AND v_receipt.actor_user_id=v_actor
      AND v_receipt.organization_id=v_org AND v_receipt.command_family='membership'
      AND v_receipt.action=v_action AND v_receipt.target_id IS NOT DISTINCT FROM v_request_target THEN
      RETURN jsonb_build_object('status','already_processed',
        'correlation_id',v_receipt.bounded_result->>'correlation_id');
    END IF;
    RETURN jsonb_build_object('status','invalid_request');
  END IF;

  IF v_action='invite_member' THEN
    INSERT INTO agency_private.organization_invites
      (organization_id,intended_user_id,intended_email,proposed_role,token_digest,
       invited_by_user_id,expires_at)
    VALUES (v_org,v_target_user,v_email,v_role,decode(v_payload->>'invite_token_digest','hex'),
      v_actor,v_now+make_interval(secs=>(v_hours*3600)::double precision)) RETURNING id INTO v_target;
  ELSIF v_action='redeem_invite' THEN
    SELECT * INTO v_invite FROM agency_private.organization_invites
      WHERE id=v_target AND organization_id=v_org FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    SELECT lower(email) INTO v_email FROM auth.users WHERE id=v_actor;
    IF NOT FOUND OR v_invite.status<>'created' OR v_invite.expires_at<=v_now
      OR v_invite.token_digest<>decode(v_payload->>'invite_token_digest','hex')
      OR v_invite.intended_email IS DISTINCT FROM v_email
      OR (v_invite.intended_user_id IS NOT NULL AND v_invite.intended_user_id<>v_actor)
      OR EXISTS (SELECT 1 FROM agency_private.organization_memberships
        WHERE user_id=v_actor AND status='active') THEN
      RETURN jsonb_build_object('status',CASE WHEN v_invite.expires_at<=v_now THEN 'expired' ELSE 'forbidden' END);
    END IF;
    INSERT INTO agency_private.organization_memberships
      (organization_id,user_id,role,status,joined_at)
    VALUES (v_org,v_actor,v_invite.proposed_role,'active',v_now)
    ON CONFLICT (organization_id,user_id) DO UPDATE SET role=excluded.role,status='active',
      joined_at=v_now,suspended_at=NULL,revoked_at=NULL,updated_at=v_now
    RETURNING id INTO v_target;
    UPDATE agency_private.organization_invites SET status='redeemed',redeemed_at=v_now
      WHERE id=v_invite.id;
  ELSIF v_action='revoke_invite' THEN
    UPDATE agency_private.organization_invites SET status='revoked',revoked_at=v_now
      WHERE id=v_target AND organization_id=v_org AND status='created';
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  ELSE
    SELECT * INTO v_member FROM agency_private.organization_memberships
      WHERE id=v_target AND organization_id=v_org FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('status','forbidden'); END IF;
    IF v_member.user_id=v_actor AND v_action='change_member_role' THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    IF v_member.role='AGENCY_ADMIN' AND v_member.status='active'
      AND v_action IN ('change_member_role','suspend_member','revoke_member')
      AND (v_action<>'change_member_role' OR v_role<>'AGENCY_ADMIN')
      AND (SELECT count(*) FROM agency_private.organization_memberships
        WHERE organization_id=v_org AND role='AGENCY_ADMIN' AND status='active')<=1 THEN
      RETURN jsonb_build_object('status','forbidden');
    END IF;
    CASE v_action
      WHEN 'change_member_role' THEN
        IF v_member.status<>'active' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
        UPDATE agency_private.organization_memberships SET role=v_role,updated_at=v_now WHERE id=v_target;
      WHEN 'suspend_member' THEN
        IF v_member.status<>'active' THEN RETURN jsonb_build_object('status','forbidden'); END IF;
        UPDATE agency_private.organization_memberships SET status='suspended',suspended_at=v_now,
          updated_at=v_now WHERE id=v_target;
      WHEN 'reactivate_member' THEN
        IF v_member.status<>'suspended' OR EXISTS (SELECT 1 FROM agency_private.organization_memberships
          WHERE user_id=v_member.user_id AND status='active') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
        UPDATE agency_private.organization_memberships SET status='active',suspended_at=NULL,
          joined_at=coalesce(joined_at,v_now),updated_at=v_now WHERE id=v_target;
      WHEN 'revoke_member' THEN
        IF v_member.status NOT IN ('invited','active','suspended') THEN RETURN jsonb_build_object('status','forbidden'); END IF;
        UPDATE agency_private.organization_memberships SET status='revoked',revoked_at=v_now,
          updated_at=v_now WHERE id=v_target;
    END CASE;
  END IF;
  INSERT INTO agency_private.governance_events
    (organization_id,actor_user_id,actor_session_id,action,target_id,before_state,
     after_state,reason,occurred_at,operation_correlation_id)
  VALUES (v_org,v_actor,v_session,v_action,v_target,'{}',jsonb_build_object('accepted',true),
    v_reason,v_now,v_correlation);
  v_result:=jsonb_build_object('status','accepted','target_id',v_target,'correlation_id',v_correlation);
  INSERT INTO agency_private.operation_receipts
    (token_digest,payload_digest,actor_user_id,organization_id,command_family,action,target_id,bounded_result)
  VALUES (v_token_digest,v_payload_digest,v_actor,v_org,'membership',v_action,v_request_target,v_result);
  RETURN v_result;
EXCEPTION WHEN unique_violation OR foreign_key_violation OR check_violation THEN
  RETURN jsonb_build_object('status','invalid_request');
WHEN OTHERS THEN
  RAISE LOG 'responder membership command SQLSTATE %: %',SQLSTATE,SQLERRM;
  RETURN jsonb_build_object('status','retryable_failure');
END
$fn$;
REVOKE ALL ON FUNCTION agency_private.agency_membership_command(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION agency_private.agency_membership_command(jsonb) TO authenticated;

DO $rls$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'organizations','principals','organization_memberships','gridly_admin_grants',
    'organization_county_authorities','agency_updates','agency_update_revisions',
    'road_closure_approvals','agency_update_events','activation_rate_events',
    'operation_receipts','governance_events','organization_invites'
  ] LOOP
    EXECUTE format('ALTER TABLE agency_private.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE agency_private.%I FORCE ROW LEVEL SECURITY',v_table);
    EXECUTE format('REVOKE ALL ON agency_private.%I FROM PUBLIC, anon, authenticated, service_role',v_table);
  END LOOP;
END
$rls$;
ALTER TABLE responder_public.agency_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_public.agency_updates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON responder_public.agency_updates FROM PUBLIC, anon, authenticated, service_role;

CREATE POLICY responder_organizations_read ON agency_private.organizations FOR SELECT TO authenticated
USING (
  id = (SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_principals_read ON agency_private.principals FOR SELECT TO authenticated
USING (
  user_id = (SELECT c.actor_user_id FROM agency_private.current_responder_security_context() c LIMIT 1)
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_memberships_read ON agency_private.organization_memberships FOR SELECT TO authenticated
USING (
  user_id = (SELECT c.actor_user_id FROM agency_private.current_responder_security_context() c LIMIT 1)
  OR (organization_id = (SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
    AND (SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)
      IN ('SUPERVISOR','AGENCY_ADMIN'))
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_gridly_grant_self_read ON agency_private.gridly_admin_grants FOR SELECT TO authenticated
USING (user_id = (SELECT c.actor_user_id FROM agency_private.current_gridly_admin_security_context() c LIMIT 1));
CREATE POLICY responder_authorities_read ON agency_private.organization_county_authorities FOR SELECT TO authenticated
USING (
  organization_id = (SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_updates_read ON agency_private.agency_updates FOR SELECT TO authenticated
USING (
  (organization_id = (SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
    AND ((SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1) <> 'VIEWER'
      OR stored_state NOT IN ('draft','pending_review')))
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_revisions_read ON agency_private.agency_update_revisions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM agency_private.agency_updates u
    WHERE u.id=agency_update_revisions.update_id
      AND u.organization_id=agency_update_revisions.organization_id
      AND ((u.organization_id=(SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
        AND ((SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)
          IN ('SUPERVISOR','AGENCY_ADMIN')
          OR ((SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)='RESPONDER'
            AND u.created_by_user_id=(SELECT c.actor_user_id FROM agency_private.current_responder_security_context() c LIMIT 1))))
        OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())))
);
CREATE POLICY responder_approvals_read ON agency_private.road_closure_approvals FOR SELECT TO authenticated
USING (
  (organization_id=(SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
    AND (SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)
      IN ('SUPERVISOR','AGENCY_ADMIN'))
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_update_events_read ON agency_private.agency_update_events FOR SELECT TO authenticated
USING (
  (organization_id=(SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
    AND ((SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)
      IN ('SUPERVISOR','AGENCY_ADMIN')
      OR ((SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)='RESPONDER'
        AND EXISTS (SELECT 1 FROM agency_private.agency_updates u
          WHERE u.id=agency_update_events.update_id
            AND u.created_by_user_id=(SELECT c.actor_user_id FROM agency_private.current_responder_security_context() c LIMIT 1)))))
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_rate_events_read ON agency_private.activation_rate_events FOR SELECT TO authenticated
USING (
  (organization_id=(SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
    AND (SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)
      IN ('SUPERVISOR','AGENCY_ADMIN'))
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_receipts_read ON agency_private.operation_receipts FOR SELECT TO authenticated
USING (actor_user_id=(SELECT c.actor_user_id FROM agency_private.current_responder_security_context() c LIMIT 1)
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context()));
CREATE POLICY responder_governance_events_read ON agency_private.governance_events FOR SELECT TO authenticated
USING (
  (organization_id=(SELECT c.organization_id FROM agency_private.current_responder_security_context() c LIMIT 1)
    AND (SELECT c.agency_role FROM agency_private.current_responder_security_context() c LIMIT 1)='AGENCY_ADMIN')
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_invites_read ON agency_private.organization_invites FOR SELECT TO authenticated
USING (
  organization_id=(SELECT c.organization_id FROM agency_private.current_responder_security_context() c
    WHERE c.agency_role='AGENCY_ADMIN' LIMIT 1)
  OR EXISTS (SELECT 1 FROM agency_private.current_gridly_admin_security_context())
);
CREATE POLICY responder_consumer_projection_read ON responder_public.agency_updates FOR SELECT
TO anon, authenticated USING ((SELECT agency_private._public_update_eligible(update_id)));

GRANT SELECT ON agency_private.organizations, agency_private.principals,
  agency_private.organization_memberships, agency_private.gridly_admin_grants,
  agency_private.organization_county_authorities, agency_private.agency_updates,
  agency_private.agency_update_revisions, agency_private.road_closure_approvals,
  agency_private.agency_update_events, agency_private.activation_rate_events,
  agency_private.operation_receipts, agency_private.governance_events,
  agency_private.organization_invites TO authenticated;
GRANT SELECT ON responder_public.agency_updates TO anon, authenticated;

CREATE FUNCTION responder_public.agency_update_command(p_request jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT agency_private.agency_update_command(p_request)
$fn$;
CREATE FUNCTION responder_public.agency_membership_command(p_request jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT agency_private.agency_membership_command(p_request)
$fn$;
CREATE FUNCTION responder_public.agency_governance_command(p_request jsonb)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT agency_private.agency_governance_command(p_request)
$fn$;
REVOKE ALL ON FUNCTION responder_public.agency_update_command(jsonb),
  responder_public.agency_membership_command(jsonb),
  responder_public.agency_governance_command(jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION responder_public.agency_update_command(jsonb),
  responder_public.agency_membership_command(jsonb),
  responder_public.agency_governance_command(jsonb) TO authenticated;

COMMENT ON SCHEMA agency_private IS
  'Unexposed Responder V1 authorization, employee, revision and governance state.';
COMMENT ON SCHEMA responder_public IS
  'Dedicated Data API schema; exact public projection plus security-invoker RPC wrappers.';
COMMENT ON FUNCTION agency_private._live_auth_context() IS
  'Fail-closed Phase 15A predicate: signed claims plus live session ownership, aal2, verified TOTP factor, live TOTP AMR and active principal.';
COMMENT ON FUNCTION agency_private.current_responder_security_context() IS
  'Derives the caller and sole active organization internally; accepts no actor, organization, role or assurance parameter.';
COMMENT ON FUNCTION agency_private.agency_update_command(jsonb) IS
  'RPC-only Responder V1 mutation boundary. Caller actor and county authority are never accepted from payload.';
COMMENT ON TABLE agency_private.activation_rate_events IS
  'Append-only successful activation evidence; 60 per organization per strict rolling 60-minute window.';
COMMENT ON TABLE responder_public.agency_updates IS
  'Exact 18-column AGENCY_OFFICIAL consumer projection. RLS rechecks current private eligibility and derived expiry.';

DO $phase17_post_ddl_assertions$
DECLARE
  v_expected_private_tables text[] := ARRAY['activation_rate_events','agency_update_events',
    'agency_update_revisions','agency_updates','governance_events','gridly_admin_grants',
    'operation_receipts','organization_county_authorities','organization_invites',
    'organization_memberships','organizations','principals','road_closure_approvals'];
  v_expected_private_functions text[] := ARRAY['_current_authority_for_point','_live_auth_context',
    '_public_update_eligible','_refresh_public_projection','_withdraw_active_updates',
    'agency_governance_command','agency_membership_command','agency_update_command',
    'current_gridly_admin_security_context','current_responder_security_context',
    'reject_append_only_mutation'];
  v_expected_public_functions text[] := ARRAY['agency_governance_command',
    'agency_membership_command','agency_update_command'];
  v_actual text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO v_actual
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='agency_private' AND c.relkind='r';
  IF v_actual IS DISTINCT FROM v_expected_private_tables THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: private table inventory assertion failed';
  END IF;
  SELECT array_agg(p.proname ORDER BY p.proname) INTO v_actual
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='agency_private';
  IF v_actual IS DISTINCT FROM v_expected_private_functions THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: private function inventory assertion failed';
  END IF;
  SELECT array_agg(p.proname ORDER BY p.proname) INTO v_actual
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='responder_public';
  IF v_actual IS DISTINCT FROM v_expected_public_functions THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: public function inventory assertion failed';
  END IF;
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='agency_private' AND c.relkind='r'
        AND c.relrowsecurity AND c.relforcerowsecurity)<>13
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='responder_public' AND c.relkind='r'
        AND c.relrowsecurity AND c.relforcerowsecurity)<>1
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='agency_private')<>13
     OR (SELECT count(*) FROM pg_policies WHERE schemaname='responder_public')<>1 THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: RLS/policy inventory assertion failed';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND coalesce(array_to_string(p.proconfig,','),'') NOT IN ('search_path=','search_path=""'))
     OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='responder_public' AND NOT p.prosecdef)<>3 THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: function security assertion failed';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='responder_public' AND table_name='agency_updates')<>18
     OR EXISTS (SELECT 1 FROM information_schema.role_table_grants
      WHERE table_schema='agency_private' AND grantee IN ('PUBLIC','anon','authenticated','service_role')
        AND privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='agency_private' AND p.prosecdef
        AND has_function_privilege('public',p.oid,'EXECUTE')) THEN
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: projection or least-privilege assertion failed';
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
    RAISE EXCEPTION 'PHASE17_MIGRATION_STOP: zero-activation assertion failed';
  END IF;
END
$phase17_post_ddl_assertions$;

COMMIT;
