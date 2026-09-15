\set ON_ERROR_STOP on
-- PHASE 18 TEST-ONLY BOOTSTRAP. Exact-version, marked localhost container only.
-- The PowerShell runner validates Docker labels, image identity, loopback publication,
-- database name, and the absence of production connection material before invoking this file.
\ir phase17_test_bootstrap.sql

CREATE SCHEMA gridly_rehearsal;
CREATE TABLE gridly_rehearsal.phase18_environment (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  environment_marker text NOT NULL CHECK (environment_marker='GRIDLY_PHASE18_NON_PRODUCTION'),
  container_name text NOT NULL CHECK (container_name='gridly-phase18-exact-db'),
  production_access_authorized boolean NOT NULL CHECK (production_access_authorized=false),
  source_kind text NOT NULL CHECK (source_kind='synthetic-production-shaped-bootstrap')
);
INSERT INTO gridly_rehearsal.phase18_environment
  (singleton,environment_marker,container_name,production_access_authorized,source_kind)
VALUES
  (true,'GRIDLY_PHASE18_NON_PRODUCTION','gridly-phase18-exact-db',false,
   'synthetic-production-shaped-bootstrap');
REVOKE ALL ON SCHEMA gridly_rehearsal FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA gridly_rehearsal FROM PUBLIC, anon, authenticated, service_role;

-- Mirror the tracked pre-responder migration history so the CLI can prove that the
-- generated Phase 18 migration is the only pending file. The Phase 17 bootstrap
-- supplies the final pre-existing marker; these rows complete its predecessors.
INSERT INTO supabase_migrations.schema_migrations(version,name) VALUES
  ('202606070001','create_gridly_feedback'),
  ('202606110001','add_county_metadata_columns'),
  ('202606160001','add_historical_incident_tables_draft'),
  ('202606160002','rollback_historical_incident_tables_draft'),
  ('202606170410','history_capture_storage'),
  ('202606170411','rollback_history_capture_storage'),
  ('202606170425','history_capture_schema_exposure'),
  ('202606170426','rollback_history_capture_schema_exposure'),
  ('202607280100','lp100_geocoding_governance'),
  ('202607290100','lp103_verified_rural_address_registry'),
  ('202607290200','lp1041_texas_address_foundation'),
  ('202609080001','community_report_retention'),
  ('202609080002','community_submission_protocol');

COMMENT ON SCHEMA gridly_rehearsal IS
  'Non-production marker for the disposable Phase 18 exact-version rehearsal only.';
