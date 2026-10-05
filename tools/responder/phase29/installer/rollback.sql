-- Explicit empty/unactivated rollback only. Evidence means forward repair.
BEGIN;
SELECT pg_advisory_xact_lock(29291001);
DO $rollback$ DECLARE t record; n bigint; registry text[]:=ARRAY['role_templates','permissions','role_permissions','report_contract_versions','report_families','report_subtypes','department_report_policies','capability_catalog','capability_requirements']; BEGIN
 IF current_user<>'postgres' OR current_setting('dispatch_install.bound_project_ref',true) IS DISTINCT FROM 'cmrrvwgkgjhmdugzhnrh' THEN RAISE EXCEPTION 'ROLLBACK_REFUSED binding'; END IF;
 IF EXISTS(SELECT 1 FROM dispatch_private.report_contract_versions WHERE publishing_enabled) THEN RAISE EXCEPTION 'ROLLBACK_REFUSED activated'; END IF;
 FOR t IN SELECT ns.nspname,c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind IN('r','p') LOOP
 IF t.nspname='dispatch_private' AND t.relname=ANY(registry) THEN CONTINUE; END IF;
 EXECUTE format('SELECT count(*) FROM %I.%I',t.nspname,t.relname) INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'ROLLBACK_REFUSED evidence-bearing %',t.relname; END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind IN('r','p','v','m','S','f')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public') THEN RAISE EXCEPTION 'ROLLBACK_REFUSED external dependency/public object'; END IF;
 IF EXISTS(SELECT 1 FROM pg_depend d CROSS JOIN LATERAL pg_identify_object(d.refclassid,d.refobjid,d.refobjsubid) ref CROSS JOIN LATERAL pg_identify_object(d.classid,d.objid,d.objsubid) obj WHERE d.deptype='n' AND ref.schema LIKE 'dispatch\_%' ESCAPE '\' AND coalesce(obj.schema,(SELECT ns.nspname FROM pg_rewrite rw JOIN pg_class c ON c.oid=rw.ev_class JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE d.classid='pg_rewrite'::regclass AND rw.oid=d.objid),(SELECT ns.nspname FROM pg_constraint ct JOIN pg_namespace ns ON ns.oid=ct.connamespace WHERE d.classid='pg_constraint'::regclass AND ct.oid=d.objid),(SELECT ns.nspname FROM pg_attrdef ad JOIN pg_class c ON c.oid=ad.adrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE d.classid='pg_attrdef'::regclass AND ad.oid=d.objid),(SELECT ns.nspname FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE d.classid='pg_trigger'::regclass AND tr.oid=d.objid),(SELECT ns.nspname FROM pg_policy po JOIN pg_class c ON c.oid=po.polrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE d.classid='pg_policy'::regclass AND po.oid=d.objid),'UNKNOWN') NOT LIKE 'dispatch\_%' ESCAPE '\') THEN RAISE EXCEPTION 'ROLLBACK_REFUSED external dependency'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM storage.buckets) THEN RAISE EXCEPTION 'ROLLBACK_REFUSED platform application data'; END IF;
END $rollback$;
DROP SCHEMA dispatch_api CASCADE;
DROP SCHEMA dispatch_projection CASCADE;
DROP SCHEMA dispatch_audit CASCADE;
DROP SCHEMA dispatch_private CASCADE;
REVOKE CONNECT ON DATABASE postgres FROM dispatch_delivery_connection;
REVOKE USAGE ON SCHEMA extensions FROM dispatch_function_owner;
DROP ROLE dispatch_delivery_connection;
DROP ROLE dispatch_delivery_transport;
DROP ROLE dispatch_function_owner;
COMMIT;
-- Hardening persists: do not restore unsafe public defaults.