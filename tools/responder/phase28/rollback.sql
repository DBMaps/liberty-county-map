\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
BEGIN;
DO $guard$ DECLARE n bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM gridly_rehearsal.environment WHERE marker='GRIDLY_PHASE26_LOCAL_SYNTHETIC' AND NOT production_access_authorized) THEN RAISE EXCEPTION 'PHASE26_ROLLBACK_REFUSED wrong environment'; END IF;
 SELECT coalesce(sum(rows),0) INTO n FROM (
  SELECT count(*) rows FROM dispatch_private.organizations UNION ALL SELECT count(*) FROM dispatch_audit.audit_events UNION ALL SELECT count(*) FROM dispatch_audit.command_receipts UNION ALL SELECT count(*) FROM dispatch_projection.projection_candidates) q;
 IF n<>0 THEN RAISE EXCEPTION 'PHASE26_ROLLBACK_REFUSED evidence-bearing package requires freeze/forward repair'; END IF;
END $guard$;
DROP SCHEMA dispatch_api CASCADE; DROP SCHEMA dispatch_projection CASCADE; DROP SCHEMA dispatch_audit CASCADE; DROP SCHEMA dispatch_private CASCADE;
REVOKE ALL ON SCHEMA extensions FROM dispatch_function_owner;
DROP ROLE dispatch_function_owner;
COMMIT;
