\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='2s'; SET LOCAL search_path=pg_catalog;
DO $preflight$
BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' THEN RAISE EXCEPTION 'PHASE26_STOP wrong database/principal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM gridly_rehearsal.environment WHERE marker='GRIDLY_PHASE26_LOCAL_SYNTHETIC' AND NOT production_access_authorized) THEN RAISE EXCEPTION 'PHASE26_STOP marker absent'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('dispatch_private','dispatch_audit','dispatch_projection','dispatch_api')) THEN RAISE EXCEPTION 'PHASE26_STOP Dispatch collision'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL OR to_regclass('auth.mfa_factors') IS NULL THEN RAISE EXCEPTION 'PHASE26_STOP Auth facilities absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN RAISE EXCEPTION 'PHASE26_STOP pgcrypto absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN RAISE EXCEPTION 'PHASE26_STOP API roles absent'; END IF;
 IF (SELECT count(*) FROM public.gridly_consumer_sentinel)<>1 OR (SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton) THEN RAISE EXCEPTION 'PHASE26_STOP sentinel mismatch'; END IF;
END $preflight$;
SELECT jsonb_build_object('stage','preflight','status','PASS','synthetic_only',true,'dispatch_collision',false,
 'postgres_version',current_setting('server_version'),'auth_users',(SELECT count(*) FROM auth.users),
 'consumer_rows',(SELECT count(*) FROM public.gridly_consumer_sentinel),'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton));
ROLLBACK;
