\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s'; SET LOCAL search_path=pg_catalog;
DO $postflight$ DECLARE v integer;
BEGIN
 SELECT count(*) INTO v FROM pg_namespace WHERE nspname IN('dispatch_private','dispatch_audit','dispatch_projection','dispatch_api'); IF v<>4 THEN RAISE EXCEPTION 'schema count %',v; END IF;
 SELECT count(*) INTO v FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit') AND t.typtype='e'; IF v<>23 THEN RAISE EXCEPTION 'enum count %',v; END IF;
 SELECT count(*) INTO v FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r'; IF v<>22 THEN RAISE EXCEPTION 'table count %',v; END IF;
 SELECT count(*) INTO v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('dispatch_private','dispatch_api'); IF v<>64 THEN RAISE EXCEPTION 'function count %',v; END IF;
 SELECT count(*) INTO v FROM pg_policies WHERE schemaname IN('dispatch_private','dispatch_audit','dispatch_projection'); IF v<>17 THEN RAISE EXCEPTION 'policy count %',v; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)) THEN RAISE EXCEPTION 'RLS not enabled/forced'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.prosecdef AND NOT EXISTS(SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) x WHERE x IN('search_path=','search_path=""'))) THEN RAISE EXCEPTION 'definer search_path not empty'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('dispatch_private','dispatch_api') AND has_function_privilege('public',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'PUBLIC execute leak'; END IF;
 IF (SELECT count(*) FROM dispatch_private.role_templates)<>5 OR (SELECT count(*) FROM dispatch_private.permissions)<>26 THEN RAISE EXCEPTION 'static seed mismatch'; END IF;
 IF (SELECT count(*) FROM public.gridly_consumer_sentinel)<>1 OR (SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton) THEN RAISE EXCEPTION 'consumer/reporting changed'; END IF;
END $postflight$;
SELECT jsonb_build_object('stage','postflight','status','PASS','schemas',4,'types',23,'tables',22,'functions',64,'policies',17,'roles',5,'permissions',26,'consumer_rows',(SELECT count(*) FROM public.gridly_consumer_sentinel),'reporting_enabled',(SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton));
ROLLBACK;
