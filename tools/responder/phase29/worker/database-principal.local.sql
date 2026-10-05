-- LOCAL DISPOSABLE ONLY. No password; local test provisions transient synthetic material.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM gridly_rehearsal.environment WHERE marker='GRIDLY_PHASE26_LOCAL_SYNTHETIC' AND NOT production_access_authorized) THEN RAISE EXCEPTION 'WORKER_LOCAL_ONLY'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dispatch_delivery_connection') THEN RAISE EXCEPTION 'WORKER_PRINCIPAL_COLLISION'; END IF;
END $$;
CREATE ROLE dispatch_delivery_connection LOGIN NOINHERIT NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 4;
GRANT CONNECT ON DATABASE postgres TO dispatch_delivery_connection;
GRANT dispatch_delivery_transport TO dispatch_delivery_connection WITH INHERIT FALSE, SET TRUE;
ALTER ROLE dispatch_delivery_connection SET statement_timeout='3s';
ALTER ROLE dispatch_delivery_connection SET idle_in_transaction_session_timeout='5s';
ALTER ROLE dispatch_delivery_connection SET search_path='pg_catalog';
DO $$ BEGIN
 IF has_schema_privilege('dispatch_delivery_connection','public','CREATE') OR has_database_privilege('dispatch_delivery_connection','postgres','CREATE') THEN RAISE EXCEPTION 'WORKER_PUBLIC_CREATE_REFUSED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='dispatch_delivery_connection') AND roleid<>(SELECT oid FROM pg_roles WHERE rolname='dispatch_delivery_transport')) THEN RAISE EXCEPTION 'WORKER_ROLE_BOUNDARY'; END IF;
END $$;
COMMIT;
