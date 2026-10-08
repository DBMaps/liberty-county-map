-- Approved additive fixture. DISPOSABLE LOCAL ONLY; never a production migration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'supabase_admin' OR current_database()<>'postgres'
 OR COALESCE(current_setting('dispatch_local.project',true),'') !~ '^gridly-dispatch-auth-[a-f0-9]{12}$'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND rolsuper)
 THEN RAISE EXCEPTION 'disposable native administrator required'; END IF;
 IF pg_catalog.to_regprocedure('dispatch_private.read_authorized_context()') IS NOT NULL
 OR pg_catalog.to_regprocedure('dispatch_api.read_authorized_context()') IS NOT NULL
 THEN RAISE EXCEPTION 'context fixture already exists'; END IF;
END $$;
CREATE FUNCTION dispatch_private.read_authorized_context()
RETURNS TABLE(organization_id uuid,organization_display_name text,unit_id uuid,unit_display_name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF dispatch_private.current_actor_id() IS NULL
 OR NOT dispatch_private.has_live_aal2() OR NOT dispatch_private.fresh_totp(600)
 THEN RAISE EXCEPTION 'context access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT DISTINCT o.id,o.display_name,u.id,u.display_name
 FROM dispatch_private.organizations o
 JOIN dispatch_private.organization_memberships m ON m.organization_id=o.id
 JOIN dispatch_private.unit_memberships um ON um.organization_id=o.id AND um.membership_id=m.id
 JOIN dispatch_private.organization_units u ON u.organization_id=o.id AND u.id=um.unit_id
 WHERE m.user_id=dispatch_private.current_actor_id()
 AND o.status='ACTIVE' AND m.status='ACTIVE' AND um.status='ACTIVE' AND u.status='ACTIVE'
 AND u.id IS NOT NULL
 AND u.onboarding_state IN('PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED')
 AND dispatch_private.actor_membership(o.id,'organization.read')=m.id
 AND dispatch_private.actor_membership(o.id,'operations.read')=m.id
 AND dispatch_private.unit_access(o.id,u.id,'operations.read')
 ORDER BY o.id,u.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'context access denied' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION dispatch_private.read_authorized_context() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.read_authorized_context() OWNER TO dispatch_function_owner;
GRANT EXECUTE ON FUNCTION dispatch_private.read_authorized_context() TO authenticated;
CREATE FUNCTION dispatch_api.read_authorized_context()
RETURNS TABLE(organization_id uuid,organization_display_name text,unit_id uuid,unit_display_name text)
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT organization_id,organization_display_name,unit_id,unit_display_name
 FROM dispatch_private.read_authorized_context()
$$;
REVOKE ALL ON FUNCTION dispatch_api.read_authorized_context() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_api.read_authorized_context() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION dispatch_api.read_authorized_context() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
