\set ON_ERROR_STOP on
-- GRIDLY RESPONDER V1 PHASE 17 -- EMPTY-DATA ROLLBACK CANDIDATE, NOT DEPLOYED.
-- This rollback is intentionally unavailable after any responder evidence exists.
BEGIN;
SET LOCAL statement_timeout='5min';
SET LOCAL lock_timeout='5s';
SET LOCAL search_path=pg_catalog;
SET LOCAL timezone='UTC';

DO $phase17_rollback_gate$
DECLARE
  v_table text;
  v_rows bigint;
  v_actual text[];
BEGIN
  IF current_user<>'postgres' OR session_user<>'postgres' THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: wrong principal';
  END IF;
  IF to_regnamespace('agency_private') IS NULL OR to_regnamespace('responder_public') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: exact responder deployment is not present';
  END IF;
  SELECT array_agg(c.relname::text ORDER BY c.relname::text COLLATE "C") INTO v_actual
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='agency_private' AND c.relkind='r';
  IF v_actual IS DISTINCT FROM ARRAY['activation_rate_events','agency_update_events',
    'agency_update_revisions','agency_updates','governance_events','gridly_admin_grants',
    'operation_receipts','organization_county_authorities','organization_invites',
    'organization_memberships','organizations','principals','road_closure_approvals']
     OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname IN ('agency_private','responder_public') AND c.relkind IN ('v','m','p','f'))
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='responder_public' AND c.relkind='r')<>1
     OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='agency_private')<>11
     OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       WHERE n.nspname='responder_public')<>3
     OR (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
       WHERE n.nspname='agency_private' AND t.typtype='e')<>10 THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: responder object inventory differs; do not CASCADE';
  END IF;
  IF EXISTS (
      SELECT 1 FROM pg_constraint k
      JOIN pg_class target ON target.oid=k.confrelid
      JOIN pg_namespace target_ns ON target_ns.oid=target.relnamespace
      JOIN pg_class source ON source.oid=k.conrelid
      JOIN pg_namespace source_ns ON source_ns.oid=source.relnamespace
      WHERE target_ns.nspname IN ('agency_private','responder_public')
        AND source_ns.nspname NOT IN ('agency_private','responder_public'))
     OR EXISTS (
      SELECT 1 FROM pg_depend d
      JOIN pg_class target ON target.oid=d.refobjid
      JOIN pg_namespace target_ns ON target_ns.oid=target.relnamespace
      JOIN pg_rewrite r ON r.oid=d.objid
      JOIN pg_class dependent ON dependent.oid=r.ev_class
      JOIN pg_namespace dependent_ns ON dependent_ns.oid=dependent.relnamespace
      WHERE target_ns.nspname IN ('agency_private','responder_public')
        AND dependent_ns.nspname NOT IN ('agency_private','responder_public')) THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: external dependency exists; do not CASCADE';
  END IF;
  FOREACH v_table IN ARRAY ARRAY[
    'organizations','principals','organization_memberships','gridly_admin_grants',
    'organization_county_authorities','agency_updates','agency_update_revisions',
    'road_closure_approvals','agency_update_events','activation_rate_events',
    'operation_receipts','governance_events','organization_invites'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM agency_private.%I',v_table) INTO v_rows;
    IF v_rows<>0 THEN
      RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: responder evidence exists in %. Preserve/export it and use a separately reviewed forward recovery migration',v_table;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM responder_public.agency_updates) THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: consumer projection evidence exists; preserve/export and use forward recovery';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM report_retention.admission_state
      WHERE singleton AND protocol_version=2 AND reporting_enabled=false) THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: community reporting gate differs; stop without touching it';
  END IF;
END
$phase17_rollback_gate$;

DROP SCHEMA responder_public CASCADE;
DROP SCHEMA agency_private CASCADE;

DO $phase17_rollback_assertions$
BEGIN
  IF to_regnamespace('agency_private') IS NOT NULL OR to_regnamespace('responder_public') IS NOT NULL THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: responder schemas remain';
  END IF;
  IF to_regclass('public.gridly_texas_county_boundaries') IS NULL
     OR (SELECT count(*) FROM public.gridly_texas_county_boundaries)<>254
     OR to_regclass('public.reports') IS NULL OR to_regclass('public.gridly_feedback') IS NULL
     OR to_regclass('public.gridly_geocode_cache') IS NULL
     OR to_regclass('public.gridly_geocode_provider_state') IS NULL
     OR to_regclass('history_capture.historical_events') IS NULL
     OR to_regclass('report_retention.runs') IS NULL
     OR NOT EXISTS (SELECT 1 FROM report_retention.admission_state
       WHERE singleton AND protocol_version=2 AND reporting_enabled=false)
     OR to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL
     OR to_regclass('auth.mfa_factors') IS NULL OR to_regclass('auth.mfa_amr_claims') IS NULL THEN
    RAISE EXCEPTION 'PHASE17_ROLLBACK_STOP: protected dependency assertion failed';
  END IF;
END
$phase17_rollback_assertions$;
COMMIT;
