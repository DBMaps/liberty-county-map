-- PHASE 17 TEST-ONLY BOOTSTRAP. Disposable localhost PostgreSQL only.
-- This simulates the minimum managed Supabase Auth catalog and the already-certified
-- production county-table shape. It must never be deployed.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;
CREATE SCHEMA extensions;
CREATE EXTENSION postgis SCHEMA extensions;
CREATE EXTENSION pgcrypto SCHEMA extensions;
CREATE SCHEMA auth;

CREATE TYPE auth.aal_level AS ENUM ('aal1','aal2','aal3');
CREATE TYPE auth.factor_type AS ENUM ('totp','webauthn','phone');
CREATE TYPE auth.factor_status AS ENUM ('unverified','verified');
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text UNIQUE
);
CREATE TABLE auth.mfa_factors (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_type auth.factor_type NOT NULL,
  status auth.factor_status NOT NULL
);
CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factor_id uuid,
  aal auth.aal_level
);
CREATE TABLE auth.mfa_amr_claims (
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  authentication_method text NOT NULL,
  PRIMARY KEY (session_id,authentication_method)
);

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
BEGIN
  RETURN nullif(current_setting('request.jwt.claims',true),'')::jsonb;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END
$fn$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE plpgsql STABLE SET search_path='' AS $fn$
BEGIN
  RETURN (auth.jwt()->>'sub')::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END
$fn$;

CREATE TABLE public.gridly_texas_county_boundaries (
  county_fips text PRIMARY KEY CHECK (county_fips ~ '^48[0-9]{3}$'),
  geom extensions.geometry(MultiPolygon,4326) NOT NULL,
  boundary_version text NOT NULL
);
INSERT INTO public.gridly_texas_county_boundaries(county_fips,geom,boundary_version)
SELECT '48'||lpad(n::text,3,'0'),
  extensions.ST_Multi(extensions.ST_GeomFromText(
    'POLYGON((-96 30,-95 30,-95 31,-96 31,-96 30))',4326)),
  'lp148-owner-built-statewide-runtime-geometry-v1'
FROM generate_series(1,254) n;
CREATE INDEX gridly_texas_county_boundaries_geom_idx
  ON public.gridly_texas_county_boundaries USING gist(geom);
ALTER TABLE public.gridly_texas_county_boundaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gridly_texas_county_boundaries FROM anon, authenticated, service_role;

CREATE SCHEMA gridly_control;
CREATE TABLE gridly_control.prelaunch_reset_authorization (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project_ref text NOT NULL
);
INSERT INTO gridly_control.prelaunch_reset_authorization(singleton,project_ref)
VALUES (true,'nhwhkbkludzkuyxmkkcj');

CREATE SCHEMA report_retention;
CREATE TABLE report_retention.admission_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  protocol_version integer NOT NULL CHECK (protocol_version=2),
  reporting_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO report_retention.admission_state(singleton,protocol_version,reporting_enabled)
VALUES (true,2,false);
CREATE TABLE report_retention.runs (id bigint PRIMARY KEY);
INSERT INTO report_retention.runs(id) VALUES (1);

CREATE SCHEMA history_capture;
CREATE TABLE history_capture.historical_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.gridly_feedback (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
INSERT INTO public.gridly_feedback SELECT FROM generate_series(1,7);
CREATE TABLE public.gridly_geocode_cache (id bigint PRIMARY KEY);
INSERT INTO public.gridly_geocode_cache SELECT n FROM generate_series(1,489) n;
CREATE TABLE public.gridly_geocode_provider_state (id bigint PRIMARY KEY);
INSERT INTO public.gridly_geocode_provider_state SELECT n FROM generate_series(1,2) n;

CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL
);
INSERT INTO supabase_migrations.schema_migrations(version,name)
VALUES ('20260908200554','lp24422a_prelaunch_reset_and_atomic_report_transition');
