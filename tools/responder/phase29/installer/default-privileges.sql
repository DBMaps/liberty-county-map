-- Global defaults can add privileges to every schema; remove known browser defaults first.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
-- Harden future application objects owned by postgres, not managed internal schemas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
-- Global PUBLIC function EXECUTE cannot be removed by a per-schema REVOKE.
-- Preserve platform creation behavior: revoke PUBLIC per new Dispatch function explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon,authenticated,service_role;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
