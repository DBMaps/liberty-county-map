-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 least-privilege grant design. This entire file is inert commentary.

Roles: existing anon, authenticated, service_role; future optional NOLOGIN
dispatch_function_owner. Do not create a browser role or make platform admin a DB role.

REVOKE ALL ON SCHEMA dispatch_private, dispatch_audit, dispatch_projection, dispatch_api FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA dispatch_private, dispatch_audit, dispatch_projection FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_private, dispatch_audit, dispatch_projection, dispatch_api FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA dispatch_api TO anon, authenticated;
GRANT SELECT ON dispatch_api.public_safe_projections TO anon, authenticated;
GRANT SELECT ON explicitly_allowlisted_dispatch_api_views TO authenticated;
GRANT EXECUTE ON explicitly_allowlisted_dispatch_api_functions TO authenticated;

-- SECURITY INVOKER wrappers call an exact private command allowlist. Therefore authenticated
-- receives USAGE on dispatch_private and EXECUTE on those command functions only; it receives
-- no table, sequence, type-mutation, helper, trigger, audit, or projection storage privileges.
-- Direct invocation is equivalent to wrapper invocation because each private command performs
-- the complete live authorization check. service_role receives no command EXECUTE grant.
GRANT USAGE ON SCHEMA dispatch_private TO authenticated;
GRANT EXECUTE ON explicitly_allowlisted_dispatch_private_commands TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE dispatch_function_owner IN SCHEMA dispatch_private
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE dispatch_function_owner IN SCHEMA dispatch_private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;

Function ownership is a minimal NOLOGIN owner without BYPASSRLS, CREATEROLE, CREATEDB,
REPLICATION, or superuser. Table owners and migration role are not application principals.
Any backend/service integration gets a separately reviewed function allowlist; service_role
is not treated as authorization. Platform authority remains live application data.

Data API configuration recommendation: expose only dispatch_api. Do not expose
dispatch_private, dispatch_audit, or dispatch_projection. If a project-level setting cannot
represent that isolation, deployment is NO-GO until the owner approves a safe configuration.
*/
-- PHASE25_INERT_SQL_END
