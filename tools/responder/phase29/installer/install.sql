-- Deployment-safe empty-project candidate. Separately authorized execution only.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(29291001);
-- Phase A: inside installer transaction; no mutation before this block.
DO $precheck$ DECLARE n text; r text;
BEGIN
 IF current_user<>'postgres' OR current_database()<>'postgres' THEN RAISE EXCEPTION 'INSTALL_REFUSED administrator/database'; END IF;
 IF current_setting('dispatch_install.bound_project_ref',true) IS DISTINCT FROM 'cmrrvwgkgjhmdugzhnrh' THEN RAISE EXCEPTION 'INSTALL_REFUSED project binding'; END IF;
 IF current_setting('server_version_num')::int/10000<>17 THEN RAISE EXCEPTION 'INSTALL_REFUSED PostgreSQL major'; END IF;
 IF current_setting('server_version_num')::int<170011 THEN RAISE EXCEPTION 'INSTALL_REFUSED PostgreSQL minimum 17.11'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname LIKE 'dispatch\_%' ESCAPE '\') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname LIKE 'dispatch\_%' ESCAPE '\') THEN RAISE EXCEPTION 'INSTALL_REFUSED existing Dispatch namespace/role'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m','S','f')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') THEN RAISE EXCEPTION 'INSTALL_REFUSED nonempty public'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT IN('public','auth','extensions','graphql','graphql_public','realtime','storage','vault','supabase_migrations','_supabase','_analytics','net','pgsodium','pgsodium_masks','_realtime','pgbouncer','supabase_functions') AND nspname NOT LIKE 'pg\_%' ESCAPE '\' AND nspname<>'information_schema') THEN RAISE EXCEPTION 'INSTALL_REFUSED unexpected application namespace %',(SELECT string_agg(nspname,',') FROM pg_namespace WHERE nspname NOT IN('public','auth','extensions','graphql','graphql_public','realtime','storage','vault','supabase_migrations','_supabase','_analytics','net','pgsodium','pgsodium_masks','_realtime','pgbouncer','supabase_functions') AND nspname NOT LIKE 'pg\_%' ESCAPE '\' AND nspname<>'information_schema'); END IF;
 FOREACH n IN ARRAY ARRAY['auth','extensions','storage','realtime'] LOOP IF to_regnamespace(n) IS NULL THEN RAISE EXCEPTION 'INSTALL_REFUSED platform schema %',n; END IF; END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator','supabase_auth_admin','supabase_admin'] LOOP IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN RAISE EXCEPTION 'INSTALL_REFUSED platform role %',r; END IF; END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres' AND rolcreaterole AND rolcreatedb) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('anon','authenticated','authenticator') AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'INSTALL_REFUSED platform attributes'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('auth.sessions') IS NULL OR to_regclass('auth.mfa_factors') IS NULL THEN RAISE EXCEPTION 'INSTALL_REFUSED Auth dependencies'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM storage.objects) OR EXISTS(SELECT 1 FROM storage.buckets) THEN RAISE EXCEPTION 'INSTALL_REFUSED nonempty platform application data'; END IF;
 IF to_regprocedure('extensions.gen_random_uuid()') IS NULL OR to_regprocedure('extensions.digest(text,text)') IS NULL OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements') THEN RAISE EXCEPTION 'INSTALL_REFUSED extension/helper'; END IF;
 -- Refuse unreviewed grantors/grantees instead of silently erasing arbitrary ACLs.
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a LEFT JOIN pg_namespace ns ON ns.oid=d.defaclnamespace WHERE (ns.nspname='public' OR (d.defaclnamespace=0 AND d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname='postgres'))) AND (pg_get_userbyid(d.defaclrole) NOT IN('postgres','supabase_admin') OR a.grantee NOT IN(0,(SELECT oid FROM pg_roles WHERE rolname='postgres'),(SELECT oid FROM pg_roles WHERE rolname='supabase_admin'),(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='authenticated'),(SELECT oid FROM pg_roles WHERE rolname='service_role')))) THEN RAISE EXCEPTION 'INSTALL_REFUSED unknown default privilege baseline'; END IF;
END $precheck$;
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

-- PHASE B
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dispatch_function_owner') THEN
 CREATE ROLE dispatch_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
END IF; END $$;
CREATE SCHEMA dispatch_private; CREATE SCHEMA dispatch_audit; CREATE SCHEMA dispatch_projection; CREATE SCHEMA dispatch_api;
REVOKE ALL ON SCHEMA dispatch_private,dispatch_audit,dispatch_projection,dispatch_api FROM PUBLIC;

CREATE TYPE dispatch_private.profile_status AS ENUM('ACTIVE','DISABLED');
CREATE TYPE dispatch_private.organization_status AS ENUM('PENDING','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE dispatch_private.organization_type AS ENUM('FIRE','EMS','LAW_ENFORCEMENT','EMERGENCY_MANAGEMENT','UTILITY','FLEET','TRUCKING','MUNICIPALITY','SCHOOL_DISTRICT','CONTRACTOR','PRIVATE_COMPANY','INDUSTRIAL_OPERATOR','TRANSPORTATION_OPERATOR','INFRASTRUCTURE_OPERATOR','OTHER');
CREATE TYPE dispatch_private.verification_level AS ENUM('UNVERIFIED','VERIFIED_ORGANIZATION','VERIFIED_PUBLIC_ENTITY');
CREATE TYPE dispatch_private.membership_status AS ENUM('INVITED','ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_private.role_template_key AS ENUM('OWNER','ORGANIZATION_ADMIN','SUPERVISOR','OPERATOR','VIEWER');
CREATE TYPE dispatch_private.invitation_status AS ENUM('PENDING','ACCEPTED','DECLINED','EXPIRED','REVOKED');
CREATE TYPE dispatch_private.permission_scope AS ENUM('ORGANIZATION','PLATFORM');
CREATE TYPE dispatch_private.scope_type AS ENUM('COUNTY','MULTI_COUNTY','STATEWIDE','SERVICE_TERRITORY','CORRIDOR','ROUTE','FACILITY','SITE','NON_GEOGRAPHIC');
CREATE TYPE dispatch_private.scope_status AS ENUM('ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_private.capability_status AS ENUM('PENDING','ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_private.record_type AS ENUM('CONDITION','HAZARD','PLANNED_WORK','OPERATIONAL_NOTICE');
CREATE TYPE dispatch_private.record_status AS ENUM('DRAFT','OPEN','IN_PROGRESS','MONITORING','CLOSED','CANCELLED');
CREATE TYPE dispatch_private.record_priority AS ENUM('LOW','NORMAL','HIGH','CRITICAL');
CREATE TYPE dispatch_private.assignment_status AS ENUM('ASSIGNED','CLEARED');
CREATE TYPE dispatch_private.source_class AS ENUM('COMMUNITY','OFFICIAL_PUBLIC','ORGANIZATION','PRIVATE_OPERATIONAL');
CREATE TYPE dispatch_private.visibility_class AS ENUM('PRIVATE','ORGANIZATION','PROJECTION_CANDIDATE','PUBLIC_PROJECTION');
CREATE TYPE dispatch_private.review_state AS ENUM('NOT_SUBMITTED','PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE dispatch_private.projection_status AS ENUM('SUBMITTED','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE dispatch_private.ownership_transfer_status AS ENUM('PENDING','ACCEPTED','CANCELLED');
CREATE TYPE dispatch_private.recovery_status AS ENUM('FIRST_APPROVED','RECOVERED','CANCELLED');
CREATE TYPE dispatch_audit.receipt_status AS ENUM('ACCEPTED');
CREATE TYPE dispatch_private.audit_event_type AS ENUM('ORGANIZATION_CREATED','ORGANIZATION_UPDATED','ORGANIZATION_ACTIVATED','ORGANIZATION_SUSPENDED','ORGANIZATION_REINSTATED','ORGANIZATION_CLOSED','MEMBER_INVITED','INVITATION_ACCEPTED','INVITATION_DECLINED','INVITATION_EXPIRED','MEMBER_SUSPENDED','MEMBER_REACTIVATED','MEMBER_REVOKED','MEMBERSHIP_LEFT','ROLE_CHANGED','OWNERSHIP_TRANSFER_INITIATED','OWNERSHIP_TRANSFER_CANCELLED','OWNERSHIP_TRANSFERRED','OWNERSHIP_RECOVERED','SCOPE_GRANTED','SCOPE_REVOKED','CAPABILITY_GRANTED','CAPABILITY_SUSPENDED','CAPABILITY_REVOKED','RECORD_CREATED','RECORD_UPDATED','RECORD_ASSIGNED','RECORD_CLOSED','RECORD_CANCELLED','PROJECTION_SUBMITTED','PROJECTION_APPROVED','PROJECTION_REJECTED','PROJECTION_PUBLISHED','PROJECTION_WITHDRAWN','SETTINGS_CHANGED');

CREATE TABLE dispatch_private.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,display_name text NOT NULL,status dispatch_private.profile_status NOT NULL DEFAULT 'ACTIVE',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_private.organizations(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),display_name text NOT NULL,legal_name text NOT NULL,organization_type dispatch_private.organization_type NOT NULL,status dispatch_private.organization_status NOT NULL DEFAULT 'PENDING',verification_level dispatch_private.verification_level NOT NULL DEFAULT 'UNVERIFIED',governance_revision integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_private.role_templates(role_key dispatch_private.role_template_key PRIMARY KEY,description text NOT NULL);
CREATE TABLE dispatch_private.permissions(permission_key text PRIMARY KEY,scope_class dispatch_private.permission_scope NOT NULL);
CREATE TABLE dispatch_private.role_permissions(role_key dispatch_private.role_template_key REFERENCES dispatch_private.role_templates,permission_key text REFERENCES dispatch_private.permissions,PRIMARY KEY(role_key,permission_key));
CREATE TABLE dispatch_private.organization_memberships(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,user_id uuid NOT NULL REFERENCES dispatch_private.profiles,status dispatch_private.membership_status NOT NULL,role_template dispatch_private.role_template_key NOT NULL,revision integer NOT NULL DEFAULT 0,activated_at timestamptz,UNIQUE(organization_id,id));
CREATE UNIQUE INDEX organization_memberships_live_pair ON dispatch_private.organization_memberships(organization_id,user_id) WHERE status IN('INVITED','ACTIVE','SUSPENDED');
CREATE UNIQUE INDEX organization_memberships_one_owner ON dispatch_private.organization_memberships(organization_id) WHERE status='ACTIVE' AND role_template='OWNER';
CREATE TABLE dispatch_private.organization_invitations(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,target_identity text NOT NULL,role_template dispatch_private.role_template_key NOT NULL,token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),status dispatch_private.invitation_status NOT NULL DEFAULT 'PENDING',expires_at timestamptz NOT NULL,created_by_membership_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),accepted_at timestamptz,revoked_at timestamptz,FOREIGN KEY(organization_id,created_by_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id));
CREATE UNIQUE INDEX organization_invitations_pending ON dispatch_private.organization_invitations(organization_id,target_identity) WHERE status='PENDING';
CREATE TABLE dispatch_private.operational_scopes(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,scope_type dispatch_private.scope_type NOT NULL,status dispatch_private.scope_status NOT NULL DEFAULT 'ACTIVE',version integer NOT NULL DEFAULT 1,label text NOT NULL,source_reference text NOT NULL,valid_until timestamptz,UNIQUE(organization_id,id),UNIQUE(id,version));
CREATE TABLE dispatch_private.operational_scope_members(operational_scope_id uuid NOT NULL,scope_version integer NOT NULL,ordinal integer NOT NULL,member_kind text NOT NULL,member_identifier text NOT NULL,PRIMARY KEY(operational_scope_id,scope_version,member_kind,member_identifier),FOREIGN KEY(operational_scope_id,scope_version) REFERENCES dispatch_private.operational_scopes(id,version));
CREATE TABLE dispatch_private.platform_admin_grants(user_id uuid NOT NULL REFERENCES dispatch_private.profiles,permission_key text NOT NULL REFERENCES dispatch_private.permissions,active boolean NOT NULL DEFAULT true,granted_by_user_id uuid NOT NULL REFERENCES dispatch_private.profiles,PRIMARY KEY(user_id,permission_key));
CREATE TABLE dispatch_private.capability_grants(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,capability_key text NOT NULL CHECK(capability_key IN('awareness.condition.publish','awareness.hazard.publish','awareness.planned_work.publish','awareness.official_notice.publish','awareness.road_closure.publish')),operational_scope_id uuid NOT NULL,operational_scope_version integer NOT NULL,status dispatch_private.capability_status NOT NULL DEFAULT 'PENDING',valid_from timestamptz NOT NULL DEFAULT now(),valid_until timestamptz,revision integer NOT NULL DEFAULT 0,granted_by_platform_actor uuid NOT NULL REFERENCES dispatch_private.profiles,UNIQUE(organization_id,id),FOREIGN KEY(operational_scope_id,operational_scope_version) REFERENCES dispatch_private.operational_scopes(id,version));
CREATE TABLE dispatch_private.operational_records(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,operational_scope_id uuid NOT NULL,record_type dispatch_private.record_type NOT NULL,status dispatch_private.record_status NOT NULL DEFAULT 'DRAFT',priority dispatch_private.record_priority NOT NULL DEFAULT 'NORMAL',title text NOT NULL,private_payload jsonb NOT NULL DEFAULT '{}',current_revision integer NOT NULL DEFAULT 1,created_by_membership_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),FOREIGN KEY(organization_id,operational_scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id),FOREIGN KEY(organization_id,created_by_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id));
CREATE TABLE dispatch_audit.record_revisions(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,record_id uuid NOT NULL,revision_number integer NOT NULL,snapshot jsonb NOT NULL,actor_user_id uuid NOT NULL REFERENCES dispatch_private.profiles,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,record_id,revision_number),FOREIGN KEY(organization_id,record_id) REFERENCES dispatch_private.operational_records(organization_id,id));
CREATE TABLE dispatch_private.record_assignments(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,record_id uuid NOT NULL,assigned_membership_id uuid NOT NULL,status dispatch_private.assignment_status NOT NULL DEFAULT 'ASSIGNED',created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,record_id) REFERENCES dispatch_private.operational_records(organization_id,id),FOREIGN KEY(organization_id,assigned_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id));
CREATE TABLE dispatch_private.record_provenance(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,record_id uuid NOT NULL,revision_number integer NOT NULL,source_class dispatch_private.source_class NOT NULL,capability_grant_id uuid,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,record_id,revision_number) REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number));
CREATE TABLE dispatch_private.ownership_transfers(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,from_membership_id uuid NOT NULL,to_membership_id uuid NOT NULL,status dispatch_private.ownership_transfer_status NOT NULL DEFAULT 'PENDING',expected_org_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX ownership_transfers_one_pending ON dispatch_private.ownership_transfers(organization_id) WHERE status='PENDING';
CREATE TABLE dispatch_private.ownership_recovery_cases(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,target_membership_id uuid NOT NULL,status dispatch_private.recovery_status NOT NULL DEFAULT 'FIRST_APPROVED',organization_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_private.recovery_approvals(case_id uuid NOT NULL REFERENCES dispatch_private.ownership_recovery_cases,user_id uuid NOT NULL REFERENCES dispatch_private.profiles,session_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(case_id,user_id));
CREATE TABLE dispatch_audit.command_receipts(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid,actor_user_id uuid NOT NULL REFERENCES dispatch_private.profiles,session_id uuid NOT NULL,command_name text NOT NULL,idempotency_key uuid NOT NULL,request_hash bytea NOT NULL CHECK(octet_length(request_hash)=32),result_payload jsonb NOT NULL,status dispatch_audit.receipt_status NOT NULL DEFAULT 'ACCEPTED',created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX command_receipts_org_key ON dispatch_audit.command_receipts(organization_id,actor_user_id,command_name,idempotency_key) NULLS NOT DISTINCT;
CREATE TABLE dispatch_audit.audit_events(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid,actor_user_id uuid NOT NULL REFERENCES dispatch_private.profiles,event_type dispatch_private.audit_event_type NOT NULL,target_id uuid,event_payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_projection.projection_candidates(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,source_record_id uuid NOT NULL,source_revision integer NOT NULL,capability_grant_id uuid NOT NULL,status dispatch_private.projection_status NOT NULL DEFAULT 'SUBMITTED',sanitized_payload jsonb NOT NULL,requested_by_user_id uuid NOT NULL REFERENCES dispatch_private.profiles,requested_at timestamptz NOT NULL DEFAULT now(),freshness_deadline timestamptz NOT NULL,UNIQUE(organization_id,id),FOREIGN KEY(organization_id,source_record_id,source_revision) REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number),FOREIGN KEY(organization_id,capability_grant_id) REFERENCES dispatch_private.capability_grants(organization_id,id));
CREATE TABLE dispatch_projection.public_safe_projections(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),candidate_id uuid NOT NULL REFERENCES dispatch_projection.projection_candidates,projection_revision integer NOT NULL,organization_public_name text NOT NULL,source_class dispatch_private.source_class NOT NULL,source_label text NOT NULL,consumer_taxonomy text NOT NULL,title text NOT NULL,summary text NOT NULL,public_location jsonb,published_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,withdrawn_at timestamptz,invalidation_reason text,UNIQUE(candidate_id,projection_revision));

INSERT INTO dispatch_private.role_templates(role_key,description) VALUES
 ('OWNER','Accountable controller'),('ORGANIZATION_ADMIN','Organization administrator'),
 ('SUPERVISOR','Operational reviewer'),('OPERATOR','Operational operator'),('VIEWER','Bounded viewer')
ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.permissions(permission_key,scope_class) VALUES
 ('organization.read','ORGANIZATION'),('organization.manage','ORGANIZATION'),('members.read','ORGANIZATION'),('members.invite','ORGANIZATION'),('members.manage','ORGANIZATION'),('ownership.transfer','ORGANIZATION'),('scope.read','ORGANIZATION'),('scope.manage','ORGANIZATION'),('operations.read','ORGANIZATION'),('operations.create','ORGANIZATION'),('operations.update','ORGANIZATION'),('operations.assign','ORGANIZATION'),('operations.close','ORGANIZATION'),('awareness.read','ORGANIZATION'),('projection.submit','ORGANIZATION'),('projection.review','ORGANIZATION'),('projection.publish','ORGANIZATION'),('audit.read','ORGANIZATION'),('settings.read','ORGANIZATION'),('settings.manage','ORGANIZATION'),('platform.organization.verify','PLATFORM'),('platform.organization.suspend','PLATFORM'),('platform.capability.manage','PLATFORM'),('platform.ownership.recover','PLATFORM'),('platform.audit.investigate','PLATFORM'),('platform.abuse.manage','PLATFORM')
ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.role_permissions(role_key,permission_key)
 SELECT 'OWNER',permission_key FROM dispatch_private.permissions WHERE scope_class='ORGANIZATION' ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.role_permissions(role_key,permission_key)
 SELECT 'ORGANIZATION_ADMIN',permission_key FROM dispatch_private.permissions WHERE scope_class='ORGANIZATION' AND permission_key<>'ownership.transfer' ON CONFLICT DO NOTHING;
INSERT INTO dispatch_private.role_permissions VALUES
 ('SUPERVISOR','organization.read'),('SUPERVISOR','members.read'),('SUPERVISOR','scope.read'),('SUPERVISOR','operations.read'),('SUPERVISOR','operations.create'),('SUPERVISOR','operations.update'),('SUPERVISOR','operations.assign'),('SUPERVISOR','operations.close'),('SUPERVISOR','projection.submit'),('SUPERVISOR','projection.review'),('SUPERVISOR','projection.publish'),('SUPERVISOR','audit.read'),('OPERATOR','organization.read'),('OPERATOR','scope.read'),('OPERATOR','operations.read'),('OPERATOR','operations.create'),('OPERATOR','operations.update'),('OPERATOR','projection.submit'),('VIEWER','organization.read'),('VIEWER','scope.read'),('VIEWER','operations.read')
ON CONFLICT DO NOTHING;


CREATE FUNCTION dispatch_private.request_hash(p jsonb) RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path='' AS 'SELECT extensions.digest(pg_catalog.convert_to(p::text,''UTF8''),''sha256'')';
CREATE FUNCTION dispatch_private.current_session_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN coalesce(auth.jwt()->>'session_id','')~'^[0-9a-f-]{36}$' THEN (auth.jwt()->>'session_id')::uuid END $$;
CREATE FUNCTION dispatch_private.current_actor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT auth.uid() $$;
CREATE FUNCTION dispatch_private.has_live_aal2() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT auth.uid()=u.id AND auth.jwt()->>'aal'='aal2' AND auth.jwt()->'amr' @> '[{"method":"totp"}]'::jsonb AND s.user_id=u.id AND s.aal='aal2' AND f.user_id=u.id AND f.status='verified' AND p.status='ACTIVE' FROM auth.users u JOIN auth.sessions s ON s.id=dispatch_private.current_session_id() JOIN auth.mfa_factors f ON f.id=s.factor_id JOIN dispatch_private.profiles p ON p.user_id=u.id WHERE u.id=auth.uid() AND u.deleted_at IS NULL),false) $$;
CREATE FUNCTION dispatch_private.actor_membership(p_org uuid,p_permission text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT m.id FROM dispatch_private.organization_memberships m JOIN dispatch_private.organizations o ON o.id=m.organization_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE m.organization_id=p_org AND m.user_id=dispatch_private.current_actor_id() AND m.status='ACTIVE' AND o.status='ACTIVE' AND rp.permission_key=p_permission LIMIT 1 $$;
CREATE FUNCTION dispatch_private.command_permission(p_command text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE WHEN p_command LIKE '%record%' THEN CASE WHEN p_command LIKE 'create%' THEN 'operations.create' WHEN p_command LIKE 'assign%' THEN 'operations.assign' WHEN p_command LIKE 'close%' THEN 'operations.close' ELSE 'operations.update' END WHEN p_command LIKE '%invitation%' OR p_command='invite_member' THEN 'members.invite' WHEN p_command LIKE '%member%' THEN 'members.manage' WHEN p_command LIKE '%ownership_transfer' THEN 'ownership.transfer' WHEN p_command LIKE '%projection%' THEN CASE WHEN p_command LIKE 'submit%' THEN 'projection.submit' WHEN p_command IN('approve_projection','reject_projection') THEN 'projection.review' ELSE 'projection.publish' END ELSE 'organization.manage' END $$;
CREATE FUNCTION dispatch_private.projection_eligible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT p.withdrawn_at IS NULL AND p.expires_at>now() AND c.status='APPROVED' AND o.status='ACTIVE' AND g.status='ACTIVE' AND (g.valid_until IS NULL OR g.valid_until>now()) AND s.status='ACTIVE' AND r.status NOT IN('CLOSED','CANCELLED') AND r.current_revision=c.source_revision FROM dispatch_projection.public_safe_projections p JOIN dispatch_projection.projection_candidates c ON c.id=p.candidate_id JOIN dispatch_private.organizations o ON o.id=c.organization_id JOIN dispatch_private.capability_grants g ON g.id=c.capability_grant_id JOIN dispatch_private.operational_scopes s ON s.id=g.operational_scope_id JOIN dispatch_private.operational_records r ON r.id=c.source_record_id WHERE p.id=p_id),false) $$;
CREATE FUNCTION dispatch_private.reject_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'append-only'; END $$;
CREATE FUNCTION dispatch_private.safe_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT p-'private_payload'-'internal_notes'-'assignment' $$;
CREATE FUNCTION dispatch_private.command_event(p text) RETURNS dispatch_private.audit_event_type LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE WHEN p LIKE '%projection%' THEN 'SETTINGS_CHANGED'::dispatch_private.audit_event_type WHEN p LIKE '%member%' OR p LIKE '%invitation%' THEN 'SETTINGS_CHANGED'::dispatch_private.audit_event_type WHEN p LIKE '%capability%' THEN 'CAPABILITY_GRANTED'::dispatch_private.audit_event_type WHEN p LIKE '%record%' THEN 'RECORD_UPDATED'::dispatch_private.audit_event_type ELSE 'SETTINGS_CHANGED'::dispatch_private.audit_event_type END $$;
CREATE FUNCTION dispatch_private.is_platform_command(p text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT p IN('grant_capability','suspend_capability','revoke_capability','start_ownership_recovery','approve_ownership_recovery','set_organization_verification','set_organization_status') $$;
CREATE FUNCTION dispatch_private.execute_command(p_command text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=dispatch_private.current_actor_id(); sid uuid:=dispatch_private.current_session_id(); org uuid:=(p_payload->>'organization_id')::uuid; key uuid:=(p_payload->>'idempotency_key')::uuid; h bytea:=dispatch_private.request_hash(p_payload-'idempotency_key'); old dispatch_audit.command_receipts%ROWTYPE; mid uuid; oid uuid:=coalesce((p_payload->>'object_id')::uuid,extensions.gen_random_uuid()); perm text;
BEGIN
 IF a IS NULL OR NOT dispatch_private.has_live_aal2() THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(key::text,0));
 SELECT * INTO old FROM dispatch_audit.command_receipts WHERE organization_id IS NOT DISTINCT FROM org AND actor_user_id=a AND command_name=p_command AND idempotency_key=key;
 IF FOUND THEN IF old.request_hash<>h THEN RAISE EXCEPTION 'idempotency payload mismatch'; END IF; RETURN old.result_payload||jsonb_build_object('replay',true); END IF;
 IF dispatch_private.is_platform_command(p_command) THEN
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants g WHERE g.user_id=a AND g.active AND g.permission_key=CASE WHEN p_command LIKE '%capability%' THEN 'platform.capability.manage' WHEN p_command LIKE '%recovery%' THEN 'platform.ownership.recover' WHEN p_command='set_organization_status' THEN 'platform.organization.suspend' ELSE 'platform.organization.verify' END) THEN RAISE EXCEPTION 'forbidden'; END IF;
 ELSE
  IF p_command='accept_invitation' THEN mid:=NULL;
  ELSIF p_command='accept_ownership_transfer' THEN SELECT id INTO mid FROM dispatch_private.organization_memberships WHERE organization_id=org AND user_id=a AND status='ACTIVE'; IF mid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSE perm:=dispatch_private.command_permission(p_command); mid:=dispatch_private.actor_membership(org,perm); IF mid IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  END IF;
 END IF;
 IF p_command='create_operational_record' THEN INSERT INTO dispatch_private.operational_records(id,organization_id,operational_scope_id,record_type,status,title,private_payload,created_by_membership_id) VALUES(oid,org,(p_payload->>'scope_id')::uuid,(p_payload->>'record_type')::dispatch_private.record_type,'OPEN',p_payload->>'title',coalesce(p_payload->'private_payload','{}'),mid); INSERT INTO dispatch_audit.record_revisions(organization_id,record_id,revision_number,snapshot,actor_user_id) VALUES(org,oid,1,p_payload,a);
 ELSIF p_command='update_operational_record' THEN UPDATE dispatch_private.operational_records SET title=coalesce(p_payload->>'title',title),private_payload=coalesce(p_payload->'private_payload',private_payload),current_revision=current_revision+1 WHERE id=oid AND organization_id=org AND current_revision=(p_payload->>'expected_revision')::int; IF NOT FOUND THEN RAISE EXCEPTION 'stale revision'; END IF; INSERT INTO dispatch_audit.record_revisions(organization_id,record_id,revision_number,snapshot,actor_user_id) SELECT org,oid,current_revision,p_payload,a FROM dispatch_private.operational_records WHERE id=oid;
 ELSIF p_command='assign_operational_record' THEN INSERT INTO dispatch_private.record_assignments(organization_id,record_id,assigned_membership_id) VALUES(org,oid,(p_payload->>'membership_id')::uuid);
 ELSIF p_command='close_operational_record' THEN UPDATE dispatch_private.operational_records SET status='CLOSED',current_revision=current_revision+1 WHERE id=oid AND organization_id=org AND current_revision=(p_payload->>'expected_revision')::int; IF NOT FOUND THEN RAISE EXCEPTION 'stale revision'; END IF;
 ELSIF p_command='invite_member' THEN INSERT INTO dispatch_private.organization_invitations(id,organization_id,target_identity,role_template,token_digest,expires_at,created_by_membership_id) VALUES(oid,org,p_payload->>'target_identity',(p_payload->>'role')::dispatch_private.role_template_key,decode(p_payload->>'token_digest','hex'),(p_payload->>'expires_at')::timestamptz,mid);
 ELSIF p_command='revoke_invitation' THEN UPDATE dispatch_private.organization_invitations SET status='REVOKED',revoked_at=now() WHERE id=oid AND organization_id=org AND status='PENDING'; IF NOT FOUND THEN RAISE EXCEPTION 'invalid invitation'; END IF;
 ELSIF p_command='accept_invitation' THEN UPDATE dispatch_private.organization_invitations SET status='ACCEPTED',accepted_at=now() WHERE id=oid AND organization_id=org AND status='PENDING' AND expires_at>now() AND target_identity='user:'||a::text AND token_digest=extensions.digest(convert_to(p_payload->>'token','UTF8'),'sha256'); IF NOT FOUND THEN RAISE EXCEPTION 'invalid invitation'; END IF; INSERT INTO dispatch_private.organization_memberships(organization_id,user_id,status,role_template,activated_at) SELECT org,a,'ACTIVE',role_template,now() FROM dispatch_private.organization_invitations WHERE id=oid;
 ELSIF p_command='change_member_role' THEN UPDATE dispatch_private.organization_memberships SET role_template=(p_payload->>'role')::dispatch_private.role_template_key,revision=revision+1 WHERE id=oid AND organization_id=org;
 ELSIF p_command='suspend_member' THEN UPDATE dispatch_private.organization_memberships SET status='SUSPENDED',revision=revision+1 WHERE id=oid AND organization_id=org;
 ELSIF p_command='reactivate_member' THEN UPDATE dispatch_private.organization_memberships SET status='ACTIVE',revision=revision+1 WHERE id=oid AND organization_id=org;
 ELSIF p_command='revoke_member' THEN UPDATE dispatch_private.organization_memberships SET status='REVOKED',revision=revision+1 WHERE id=oid AND organization_id=org;
 ELSIF p_command='initiate_ownership_transfer' THEN INSERT INTO dispatch_private.ownership_transfers(id,organization_id,from_membership_id,to_membership_id,expected_org_revision) VALUES(oid,org,mid,(p_payload->>'to_membership_id')::uuid,(p_payload->>'expected_revision')::int);
 ELSIF p_command='accept_ownership_transfer' THEN
  UPDATE dispatch_private.ownership_transfers SET status='ACCEPTED' WHERE id=oid AND organization_id=org AND status='PENDING' AND to_membership_id=mid AND expected_org_revision=(SELECT governance_revision FROM dispatch_private.organizations WHERE id=org); IF NOT FOUND THEN RAISE EXCEPTION 'invalid transfer'; END IF;
  UPDATE dispatch_private.organization_memberships SET role_template='ORGANIZATION_ADMIN',revision=revision+1 WHERE organization_id=org AND role_template='OWNER' AND status='ACTIVE';
  UPDATE dispatch_private.organization_memberships SET role_template='OWNER',revision=revision+1 WHERE id=mid;
  UPDATE dispatch_private.organizations SET governance_revision=governance_revision+1 WHERE id=org;
 ELSIF p_command='cancel_ownership_transfer' THEN UPDATE dispatch_private.ownership_transfers SET status='CANCELLED' WHERE id=oid AND organization_id=org AND status='PENDING';
 ELSIF p_command='grant_capability' THEN INSERT INTO dispatch_private.capability_grants(id,organization_id,capability_key,operational_scope_id,operational_scope_version,status,valid_until,granted_by_platform_actor) VALUES(oid,org,p_payload->>'capability',(p_payload->>'scope_id')::uuid,1,'ACTIVE',(p_payload->>'valid_until')::timestamptz,a);
 ELSIF p_command IN('suspend_capability','revoke_capability') THEN UPDATE dispatch_private.capability_grants SET status=(CASE WHEN p_command='suspend_capability' THEN 'SUSPENDED' ELSE 'REVOKED' END)::dispatch_private.capability_status,revision=revision+1 WHERE id=oid AND organization_id=org AND status IN('ACTIVE','SUSPENDED'); IF NOT FOUND THEN RAISE EXCEPTION 'capability transition lost race'; END IF;
 ELSIF p_command='submit_projection_candidate' THEN INSERT INTO dispatch_projection.projection_candidates(id,organization_id,source_record_id,source_revision,capability_grant_id,sanitized_payload,requested_by_user_id,freshness_deadline) VALUES(oid,org,(p_payload->>'record_id')::uuid,(p_payload->>'source_revision')::int,(p_payload->>'capability_id')::uuid,dispatch_private.safe_payload(p_payload->'payload'),a,(p_payload->>'freshness_deadline')::timestamptz);
 ELSIF p_command='approve_projection' THEN UPDATE dispatch_projection.projection_candidates SET status='APPROVED' WHERE id=oid AND organization_id=org AND status='SUBMITTED'; IF NOT FOUND THEN RAISE EXCEPTION 'projection transition lost race'; END IF;
 ELSIF p_command='reject_projection' THEN UPDATE dispatch_projection.projection_candidates SET status='REJECTED' WHERE id=oid AND organization_id=org AND status='SUBMITTED'; IF NOT FOUND THEN RAISE EXCEPTION 'projection transition lost race'; END IF;
 ELSIF p_command='publish_projection' THEN INSERT INTO dispatch_projection.public_safe_projections(candidate_id,projection_revision,organization_public_name,source_class,source_label,consumer_taxonomy,title,summary,public_location,expires_at) SELECT id,1,p_payload->>'organization_public_name','ORGANIZATION',p_payload->>'source_label',p_payload->>'taxonomy',sanitized_payload->>'title',sanitized_payload->>'summary',sanitized_payload->'public_location',freshness_deadline FROM dispatch_projection.projection_candidates WHERE id=oid AND organization_id=org AND status='APPROVED' RETURNING id INTO oid;
 ELSIF p_command='withdraw_projection' THEN UPDATE dispatch_projection.public_safe_projections SET withdrawn_at=now(),invalidation_reason='withdrawn' WHERE id=oid;
 ELSIF p_command='set_organization_status' THEN UPDATE dispatch_private.organizations SET status=(p_payload->>'status')::dispatch_private.organization_status,governance_revision=governance_revision+1 WHERE id=org;
 ELSIF p_command='set_organization_verification' THEN UPDATE dispatch_private.organizations SET verification_level=(p_payload->>'verification_level')::dispatch_private.verification_level,governance_revision=governance_revision+1 WHERE id=org;
 ELSIF p_command='start_ownership_recovery' THEN INSERT INTO dispatch_private.ownership_recovery_cases(id,organization_id,target_membership_id,organization_revision) VALUES(oid,org,(p_payload->>'target_membership_id')::uuid,(p_payload->>'expected_revision')::int); INSERT INTO dispatch_private.recovery_approvals VALUES(oid,a,sid,now());
 ELSIF p_command='approve_ownership_recovery' THEN
  INSERT INTO dispatch_private.recovery_approvals VALUES(oid,a,sid,now());
  UPDATE dispatch_private.ownership_recovery_cases SET status='RECOVERED' WHERE id=oid AND organization_id=org AND status='FIRST_APPROVED' AND organization_revision=(SELECT governance_revision FROM dispatch_private.organizations WHERE id=org) AND (SELECT count(*) FROM dispatch_private.recovery_approvals WHERE case_id=oid)=2; IF NOT FOUND THEN RAISE EXCEPTION 'recovery requires distinct second approval and unchanged revision'; END IF;
  UPDATE dispatch_private.organization_memberships SET role_template='ORGANIZATION_ADMIN',revision=revision+1 WHERE organization_id=org AND role_template='OWNER' AND status='ACTIVE';
  UPDATE dispatch_private.organization_memberships SET role_template='OWNER',revision=revision+1 WHERE id=(SELECT target_membership_id FROM dispatch_private.ownership_recovery_cases WHERE id=oid);
  UPDATE dispatch_private.organizations SET governance_revision=governance_revision+1 WHERE id=org;
 END IF;
 INSERT INTO dispatch_audit.audit_events(organization_id,actor_user_id,event_type,target_id,event_payload) VALUES(org,a,dispatch_private.command_event(p_command),oid,jsonb_build_object('command',p_command));
 INSERT INTO dispatch_audit.command_receipts(organization_id,actor_user_id,session_id,command_name,idempotency_key,request_hash,result_payload) VALUES(org,a,sid,p_command,key,h,jsonb_build_object('command',p_command,'object_id',oid,'actor_id',a,'organization_id',org,'replay',false));
 RETURN jsonb_build_object('command',p_command,'object_id',oid,'actor_id',a,'organization_id',org,'replay',false);
END $$;

DO $factory$ DECLARE n text; names text[]:=ARRAY['create_operational_record','update_operational_record','assign_operational_record','close_operational_record','invite_member','revoke_invitation','accept_invitation','change_member_role','suspend_member','reactivate_member','revoke_member','initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer','grant_capability','suspend_capability','revoke_capability','submit_projection_candidate','approve_projection','reject_projection','publish_projection','withdraw_projection','start_ownership_recovery','approve_ownership_recovery','set_organization_verification','set_organization_status']; BEGIN FOREACH n IN ARRAY names LOOP
 EXECUTE format('CREATE FUNCTION dispatch_private.%I_command(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='''' AS $f$ SELECT dispatch_private.execute_command(%L,p_payload) $f$',n,n);
 EXECUTE format('CREATE FUNCTION dispatch_api.%I(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $f$ SELECT dispatch_private.%I_command(p_payload) $f$',n,n);
END LOOP; END $factory$;

CREATE TRIGGER revisions_append_only BEFORE UPDATE OR DELETE ON dispatch_audit.record_revisions FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON dispatch_audit.audit_events FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER receipts_append_only BEFORE UPDATE OR DELETE ON dispatch_audit.command_receipts FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();

DO $rls$ DECLARE r regclass; BEGIN FOR r IN SELECT format('%I.%I',n.nspname,c.relname)::regclass FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',r); EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',r); END LOOP; END $rls$;
CREATE POLICY profiles_self ON dispatch_private.profiles FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND dispatch_private.has_live_aal2());
CREATE POLICY organizations_member ON dispatch_private.organizations FOR SELECT TO authenticated USING(dispatch_private.actor_membership(id,'organization.read') IS NOT NULL);
CREATE POLICY memberships_member ON dispatch_private.organization_memberships FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'members.read') IS NOT NULL);
CREATE POLICY invitations_member ON dispatch_private.organization_invitations FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'members.invite') IS NOT NULL);
CREATE POLICY scopes_member ON dispatch_private.operational_scopes FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'scope.read') IS NOT NULL);
CREATE POLICY records_member ON dispatch_private.operational_records FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'operations.read') IS NOT NULL);
CREATE POLICY assignments_member ON dispatch_private.record_assignments FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'operations.read') IS NOT NULL);
CREATE POLICY transfers_member ON dispatch_private.ownership_transfers FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'organization.read') IS NOT NULL);
CREATE POLICY revisions_member ON dispatch_audit.record_revisions FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'operations.read') IS NOT NULL);
CREATE POLICY candidates_member ON dispatch_projection.projection_candidates FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'projection.review') IS NOT NULL);
CREATE POLICY platform_self ON dispatch_private.platform_admin_grants FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) AND dispatch_private.has_live_aal2());
CREATE POLICY capabilities_member ON dispatch_private.capability_grants FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'organization.read') IS NOT NULL);
CREATE POLICY recovery_platform ON dispatch_private.ownership_recovery_cases FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants g WHERE g.user_id=(SELECT auth.uid()) AND g.permission_key='platform.ownership.recover' AND g.active));
CREATE POLICY public_projection_anon ON dispatch_projection.public_safe_projections FOR SELECT TO anon USING(dispatch_private.projection_eligible(id));
CREATE POLICY public_projection_auth ON dispatch_projection.public_safe_projections FOR SELECT TO authenticated USING(dispatch_private.projection_eligible(id));
CREATE POLICY organizations_platform ON dispatch_private.organizations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants g WHERE g.user_id=(SELECT auth.uid()) AND g.active));
CREATE POLICY audit_member ON dispatch_audit.audit_events FOR SELECT TO authenticated USING(dispatch_private.actor_membership(organization_id,'audit.read') IS NOT NULL OR EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants g WHERE g.user_id=(SELECT auth.uid()) AND g.permission_key='platform.audit.investigate' AND g.active));

CREATE VIEW dispatch_api.operational_records WITH(security_invoker=true) AS SELECT id,organization_id,operational_scope_id,record_type,status,priority,title,current_revision,created_at FROM dispatch_private.operational_records;
CREATE VIEW dispatch_api.public_safe_projections WITH(security_invoker=true) AS SELECT id,organization_public_name,source_class,source_label,consumer_taxonomy,title,summary,public_location,published_at,expires_at FROM dispatch_projection.public_safe_projections WHERE dispatch_private.projection_eligible(id);
-- No permanent compatibility wrapper in absent/empty/unreferenced mode.

GRANT dispatch_function_owner TO postgres;
GRANT USAGE,CREATE ON SCHEMA dispatch_private TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.execute_command(text,jsonb) OWNER TO dispatch_function_owner;
DO $owners$ DECLARE p regprocedure; BEGIN FOR p IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname NOT IN('current_session_id','current_actor_id','has_live_aal2') LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO dispatch_function_owner',p); END LOOP; END $owners$;
REVOKE CREATE ON SCHEMA dispatch_private FROM dispatch_function_owner;
GRANT USAGE ON SCHEMA extensions,dispatch_private,dispatch_audit,dispatch_projection TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA dispatch_private,dispatch_audit,dispatch_projection TO dispatch_function_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA dispatch_private,dispatch_audit,dispatch_projection FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_private,dispatch_audit,dispatch_projection,dispatch_api FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.current_session_id(),dispatch_private.current_actor_id(),dispatch_private.has_live_aal2() TO dispatch_function_owner;
GRANT USAGE ON SCHEMA dispatch_api TO anon,authenticated; GRANT SELECT ON dispatch_api.public_safe_projections TO anon,authenticated; GRANT SELECT ON dispatch_api.operational_records TO authenticated;
GRANT USAGE ON SCHEMA dispatch_private TO authenticated; GRANT EXECUTE ON FUNCTION dispatch_private.has_live_aal2(),dispatch_private.actor_membership(uuid,text),dispatch_private.projection_eligible(uuid) TO authenticated;
GRANT SELECT ON dispatch_private.operational_records TO authenticated;
GRANT USAGE ON SCHEMA dispatch_projection,dispatch_private TO anon,authenticated;
GRANT SELECT ON dispatch_projection.public_safe_projections,dispatch_projection.projection_candidates TO anon,authenticated;
GRANT EXECUTE ON FUNCTION dispatch_private.projection_eligible(uuid) TO anon;
DO $grants$ DECLARE p regprocedure; BEGIN FOR p IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_api' AND p.prokind='f' LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',p); END LOOP; END $grants$;
DO $private_grants$ DECLARE p regprocedure; BEGIN FOR p IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname LIKE '%\_command' ESCAPE '\' LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',p); END LOOP; END $private_grants$;
REVOKE dispatch_function_owner FROM postgres;
NOTIFY pgrst,'reload schema';
-- Additive hardening applied in the SAME transaction as the Phase 26 baseline.
GRANT dispatch_function_owner TO postgres;
-- Phase prerequisite independently checked by installer A and single transaction.


CREATE TYPE dispatch_private.unit_type AS ENUM('PUBLIC_WORKS','LAW_ENFORCEMENT','FIRE','EMS','EMERGENCY_MANAGEMENT','UTILITIES','TRANSPORTATION','ADMINISTRATION','OTHER');
CREATE TYPE dispatch_private.unit_status AS ENUM('PLANNED','ACTIVE','SUSPENDED','OFFBOARDED');
CREATE TYPE dispatch_private.internal_share_class AS ENUM('PRIVATE_TO_UNIT','PRIVATE_TO_ORGANIZATION','SHARED_WITH_SELECTED_UNITS');
CREATE TYPE dispatch_private.onboarding_state AS ENUM('PLANNED','IDENTITY_VERIFIED','ADMIN_ASSIGNED','MEMBERSHIP_CONFIGURED','SCOPE_CONFIGURED','MFA_VERIFIED','PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED','SUSPENDED','OFFBOARDED');
CREATE TABLE dispatch_private.organization_units (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(), organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,
 unit_type dispatch_private.unit_type NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120), display_name text NOT NULL,
 status dispatch_private.unit_status NOT NULL DEFAULT 'PLANNED', parent_unit_id uuid, revision integer NOT NULL DEFAULT 1,
 onboarding_state dispatch_private.onboarding_state NOT NULL DEFAULT 'PLANNED',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,id), UNIQUE(organization_id,name), CHECK(parent_unit_id IS DISTINCT FROM id),
 FOREIGN KEY(organization_id,parent_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
CREATE INDEX units_parent ON dispatch_private.organization_units(organization_id,parent_unit_id);
CREATE TABLE dispatch_private.unit_memberships (
 organization_id uuid NOT NULL, unit_id uuid NOT NULL, membership_id uuid NOT NULL,
 status dispatch_private.membership_status NOT NULL DEFAULT 'ACTIVE', revision integer NOT NULL DEFAULT 1,
 PRIMARY KEY(unit_id,membership_id),
 FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id),
 FOREIGN KEY(organization_id,membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id));
CREATE INDEX unit_memberships_member ON dispatch_private.unit_memberships(membership_id,unit_id) WHERE status='ACTIVE';
CREATE TABLE dispatch_private.unit_scope_grants (
 organization_id uuid NOT NULL, unit_id uuid NOT NULL, scope_id uuid NOT NULL,
 PRIMARY KEY(unit_id,scope_id),
 FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id),
 FOREIGN KEY(organization_id,scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id));
CREATE TABLE dispatch_private.pilot_governance (
 organization_id uuid PRIMARY KEY REFERENCES dispatch_private.organizations,
 verification_expires_at timestamptz, attestation_expires_at timestamptz,
 governance_source text, governance_version text, publishing_enabled boolean NOT NULL DEFAULT false,
 legal_retention_approved boolean NOT NULL DEFAULT false);
CREATE TABLE dispatch_private.scope_governance (
 organization_id uuid NOT NULL, scope_id uuid PRIMARY KEY, source_reference text NOT NULL CHECK(length(source_reference)>0),
 source_version text NOT NULL CHECK(length(source_version)>0), valid_until timestamptz NOT NULL,
 FOREIGN KEY(organization_id,scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id));
ALTER TABLE dispatch_private.operational_records ADD COLUMN owning_unit_id uuid,
 ADD COLUMN internal_share_class dispatch_private.internal_share_class NOT NULL DEFAULT 'PRIVATE_TO_UNIT',
 ADD COLUMN safety_class text NOT NULL DEFAULT 'UNREVIEWED' CHECK(safety_class IN('UNREVIEWED','GENERAL_AWARENESS','HAZARD','ROAD_CLOSURE')),
 ADD FOREIGN KEY(organization_id,owning_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id),
 ADD CHECK(owning_unit_id IS NOT NULL OR internal_share_class='PRIVATE_TO_ORGANIZATION');
CREATE INDEX records_unit ON dispatch_private.operational_records(organization_id,owning_unit_id);
ALTER TABLE dispatch_private.record_provenance ADD COLUMN owning_unit_id uuid,
 ADD COLUMN actor_token uuid NOT NULL,
 ADD FOREIGN KEY(organization_id,owning_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id);
CREATE TRIGGER provenance_append_only BEFORE UPDATE OR DELETE ON dispatch_private.record_provenance
 FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TABLE dispatch_private.internal_awareness (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(), organization_id uuid NOT NULL, source_record_id uuid NOT NULL,
 source_revision integer NOT NULL, source_unit_id uuid NOT NULL, revision integer NOT NULL DEFAULT 1,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160), summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 500),
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 sanitization_version text NOT NULL CHECK(sanitization_version='internal-v1'),
 UNIQUE(organization_id,id),
 FOREIGN KEY(organization_id,source_record_id,source_revision) REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number),
 FOREIGN KEY(organization_id,source_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
CREATE TABLE dispatch_private.internal_share_recipients (
 organization_id uuid NOT NULL, share_id uuid NOT NULL, recipient_unit_id uuid NOT NULL,
 PRIMARY KEY(share_id,recipient_unit_id),
 FOREIGN KEY(organization_id,share_id) REFERENCES dispatch_private.internal_awareness(organization_id,id),
 FOREIGN KEY(organization_id,recipient_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
CREATE INDEX recipients_unit ON dispatch_private.internal_share_recipients(recipient_unit_id,share_id);
CREATE TABLE dispatch_private.actor_tokens (
 organization_id uuid NOT NULL REFERENCES dispatch_private.organizations, user_id uuid NOT NULL,
 token uuid NOT NULL DEFAULT extensions.gen_random_uuid(), PRIMARY KEY(organization_id,user_id), UNIQUE(token));
CREATE TABLE dispatch_audit.pilot_events (
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(), organization_id uuid NOT NULL,
 actor_token uuid NOT NULL, command_name text NOT NULL, target_id uuid NOT NULL, revision integer,
 source_record_id uuid, source_revision integer, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), legal_hold boolean NOT NULL DEFAULT false,
 retention_class text NOT NULL DEFAULT 'AUDIT_7Y');
CREATE TRIGGER pilot_events_append_only BEFORE UPDATE OR DELETE ON dispatch_audit.pilot_events
 FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();

INSERT INTO dispatch_private.permissions VALUES('internal.share','ORGANIZATION'),('internal.read','ORGANIZATION'),('units.manage','ORGANIZATION');
INSERT INTO dispatch_private.role_permissions VALUES
 ('OWNER','internal.share'),('ORGANIZATION_ADMIN','internal.share'),('SUPERVISOR','internal.share'),
 ('OWNER','units.manage'),('ORGANIZATION_ADMIN','units.manage'),
 ('OWNER','internal.read'),('ORGANIZATION_ADMIN','internal.read'),('SUPERVISOR','internal.read'),('OPERATOR','internal.read'),('VIEWER','internal.read');

CREATE FUNCTION dispatch_private.current_claims() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT coalesce(nullif(pg_catalog.current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE OR REPLACE FUNCTION dispatch_private.current_actor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT CASE WHEN coalesce(dispatch_private.current_claims()->>'sub','') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (dispatch_private.current_claims()->>'sub')::uuid END $$;
CREATE OR REPLACE FUNCTION dispatch_private.current_session_id() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE WHEN coalesce(dispatch_private.current_claims()->>'session_id','') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (dispatch_private.current_claims()->>'session_id')::uuid END $$;
CREATE OR REPLACE FUNCTION dispatch_private.has_live_aal2() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.id=dispatch_private.current_session_id()
 JOIN auth.mfa_factors f ON f.id=s.factor_id JOIN dispatch_private.profiles p ON p.user_id=u.id
 WHERE u.id=auth.uid() AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
 AND s.user_id=u.id AND s.aal='aal2' AND (s.not_after IS NULL OR s.not_after>now())
 AND f.user_id=u.id AND f.status='verified' AND f.factor_type='totp' AND p.status='ACTIVE'
 AND auth.jwt()->>'aal'='aal2' AND auth.jwt()->'amr' @> '[{"method":"totp"}]'::jsonb) $$;
CREATE OR REPLACE FUNCTION dispatch_private.actor_membership(p_org uuid,p_permission text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id FROM dispatch_private.organization_memberships m JOIN dispatch_private.organizations o ON o.id=m.organization_id
 JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template
 WHERE dispatch_private.has_live_aal2() AND m.organization_id=p_org AND m.user_id=dispatch_private.current_actor_id() AND m.status='ACTIVE'
 AND o.status='ACTIVE' AND rp.permission_key=p_permission LIMIT 1 $$;
CREATE FUNCTION dispatch_private.unit_access(p_org uuid,p_unit uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT dispatch_private.actor_membership(p_org,p_permission) IS NOT NULL AND
 (p_unit IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.unit_memberships m JOIN dispatch_private.organization_units u ON u.id=m.unit_id
 WHERE m.organization_id=p_org AND m.unit_id=p_unit AND m.membership_id=dispatch_private.actor_membership(p_org,p_permission)
 AND m.status='ACTIVE' AND u.status='ACTIVE' AND u.onboarding_state IN('PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED'))) $$;
CREATE FUNCTION dispatch_private.record_access(p_id uuid,p_permission text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.operational_records r JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id
 WHERE r.id=p_id AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now())
 AND dispatch_private.unit_access(r.organization_id,r.owning_unit_id,p_permission)
 AND (r.owning_unit_id IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.unit_scope_grants g WHERE g.unit_id=r.owning_unit_id AND g.scope_id=s.id))) $$;
CREATE FUNCTION dispatch_private.internal_access(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.internal_awareness a JOIN dispatch_private.operational_records r ON r.id=a.source_record_id
 JOIN dispatch_private.organization_units u ON u.id=a.source_unit_id JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id
 WHERE a.id=p_id AND a.revoked_at IS NULL AND a.expires_at>now() AND u.status='ACTIVE' AND s.status='ACTIVE'
 AND (s.valid_until IS NULL OR s.valid_until>now()) AND r.current_revision=a.source_revision AND r.status NOT IN('CLOSED','CANCELLED')
 AND EXISTS(SELECT 1 FROM dispatch_private.internal_share_recipients x WHERE x.share_id=a.id
 AND dispatch_private.unit_access(a.organization_id,x.recipient_unit_id,'internal.read'))) $$;
CREATE FUNCTION dispatch_private.pilot_candidate_eligible(p_record uuid,p_cap uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.operational_records r
 JOIN dispatch_private.organizations o ON o.id=r.organization_id
 JOIN dispatch_private.pilot_governance v ON v.organization_id=o.id
 JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id
 JOIN dispatch_private.scope_governance sg ON sg.scope_id=s.id AND sg.organization_id=o.id
 JOIN dispatch_private.capability_grants g ON g.id=p_cap AND g.organization_id=o.id AND g.operational_scope_id=s.id AND g.operational_scope_version=s.version
 WHERE r.id=p_record AND r.status IN('OPEN','IN_PROGRESS','MONITORING') AND r.safety_class='GENERAL_AWARENESS'
 AND r.record_type<>'HAZARD' AND o.status='ACTIVE' AND o.verification_level='VERIFIED_PUBLIC_ENTITY'
 AND v.publishing_enabled AND v.verification_expires_at>now() AND v.attestation_expires_at>now()
 AND length(v.governance_source)>0 AND length(v.governance_version)>0 AND sg.valid_until>now()
 AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now())
 AND g.status='ACTIVE' AND g.valid_from<=now() AND g.valid_until>now() AND g.valid_until<=g.valid_from+interval '90 days'
 AND g.capability_key=CASE r.record_type WHEN 'CONDITION' THEN 'awareness.condition.publish' WHEN 'PLANNED_WORK' THEN 'awareness.planned_work.publish' WHEN 'OPERATIONAL_NOTICE' THEN 'awareness.official_notice.publish' END
 AND (r.owning_unit_id IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.organization_units u WHERE u.id=r.owning_unit_id AND u.status='ACTIVE' AND u.onboarding_state='PUBLISHING_ENABLED'))) $$;
CREATE OR REPLACE FUNCTION dispatch_private.projection_eligible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_projection.public_safe_projections p JOIN dispatch_projection.projection_candidates c ON c.id=p.candidate_id
 JOIN dispatch_private.operational_records r ON r.id=c.source_record_id WHERE p.id=p_id AND p.withdrawn_at IS NULL AND p.expires_at>now()
 AND c.status='APPROVED' AND c.freshness_deadline>now() AND r.current_revision=c.source_revision
 AND dispatch_private.pilot_candidate_eligible(r.id,c.capability_grant_id)) $$;
CREATE OR REPLACE FUNCTION dispatch_private.safe_payload(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('title',p->>'title','summary',p->>'summary') $$;
CREATE FUNCTION dispatch_private.fresh_totp(p_seconds integer) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT dispatch_private.has_live_aal2() AND EXISTS(SELECT 1 FROM jsonb_array_elements(dispatch_private.current_claims()->'amr') m
 WHERE m->>'method'='totp' AND (m->>'timestamp') ~ '^[0-9]{1,12}$'
 AND (m->>'timestamp')::bigint BETWEEN extract(epoch FROM now())::bigint-p_seconds AND extract(epoch FROM now())::bigint) $$;

DROP POLICY records_member ON dispatch_private.operational_records;
CREATE POLICY records_member ON dispatch_private.operational_records FOR SELECT TO authenticated USING(dispatch_private.record_access(id,'operations.read'));
DROP POLICY assignments_member ON dispatch_private.record_assignments;
CREATE POLICY assignments_member ON dispatch_private.record_assignments FOR SELECT TO authenticated USING(dispatch_private.record_access(record_id,'operations.read'));
DROP POLICY revisions_member ON dispatch_audit.record_revisions;
CREATE POLICY revisions_member ON dispatch_audit.record_revisions FOR SELECT TO authenticated USING(dispatch_private.record_access(record_id,'operations.read'));
DROP POLICY candidates_member ON dispatch_projection.projection_candidates;
CREATE POLICY candidates_member ON dispatch_projection.projection_candidates FOR SELECT TO authenticated USING(dispatch_private.record_access(source_record_id,'projection.review'));
CREATE POLICY units_member ON dispatch_private.organization_units FOR SELECT TO authenticated USING(dispatch_private.unit_access(organization_id,id,'organization.read'));
CREATE POLICY units_membership_self ON dispatch_private.unit_memberships FOR SELECT TO authenticated USING(membership_id=dispatch_private.actor_membership(organization_id,'organization.read'));
CREATE POLICY internal_recipient ON dispatch_private.internal_awareness FOR SELECT TO authenticated USING(dispatch_private.internal_access(id));
CREATE VIEW dispatch_api.internal_awareness WITH(security_invoker=true) AS SELECT id,title,summary,created_at,expires_at FROM dispatch_private.internal_awareness;
CREATE OR REPLACE VIEW dispatch_api.operational_records WITH(security_invoker=true) AS SELECT id,organization_id,operational_scope_id,record_type,status,priority,title,current_revision,created_at,owning_unit_id,internal_share_class FROM dispatch_private.operational_records;

-- The frozen dispatcher is reachable only through the new live-authorization boundary.
ALTER FUNCTION dispatch_private.execute_command(text,jsonb) RENAME TO phase26_command;
CREATE FUNCTION dispatch_private.execute_command(p_command text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 a uuid:=dispatch_private.current_actor_id(); org uuid:=(p_payload->>'organization_id')::uuid; k uuid:=(p_payload->>'idempotency_key')::uuid;
 oid uuid:=(p_payload->>'object_id')::uuid; unit uuid:=(p_payload->>'unit_id')::uuid; mid uuid;
 rid uuid; cap uuid; rev integer; t uuid; result jsonb; prior dispatch_audit.command_receipts%ROWTYPE;
 r dispatch_private.operational_records%ROWTYPE; unit_row dispatch_private.organization_units%ROWTYPE;
 sh dispatch_private.internal_awareness%ROWTYPE; c dispatch_projection.projection_candidates%ROWTYPE;
 recipients uuid[]; target_state text; permission text; h bytea:=dispatch_private.request_hash(p_payload-'idempotency_key');
BEGIN
 IF NOT dispatch_private.has_live_aal2() OR a IS NULL OR org IS NULL OR k IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 -- Serialize policy changes and commands within the owning organization; never authorize from UI selection.
 PERFORM 1 FROM dispatch_private.organizations WHERE id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k::text,0));
 mid:=dispatch_private.actor_membership(org,'organization.read');
 IF mid IS NULL AND NOT (dispatch_private.is_platform_command(p_command) OR p_command='accept_invitation') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF dispatch_private.is_platform_command(p_command) AND NOT EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants g WHERE g.user_id=a AND g.active AND g.permission_key=CASE WHEN p_command LIKE '%capability%' THEN 'platform.capability.manage' WHEN p_command LIKE '%recovery%' THEN 'platform.ownership.recover' WHEN p_command='set_organization_status' THEN 'platform.organization.suspend' ELSE 'platform.organization.verify' END) THEN RAISE EXCEPTION 'platform permission required'; END IF;
 IF p_command IN('create_unit','set_unit_membership','advance_onboarding','offboard_unit') AND dispatch_private.actor_membership(org,'units.manage') IS NULL THEN RAISE EXCEPTION 'unit management forbidden'; END IF;
 IF NOT dispatch_private.is_platform_command(p_command) AND p_command NOT IN('create_unit','set_unit_membership','advance_onboarding','offboard_unit','create_internal_share','replace_internal_share_recipients','revoke_internal_share','accept_invitation','accept_ownership_transfer') AND dispatch_private.actor_membership(org,dispatch_private.command_permission(p_command)) IS NULL THEN RAISE EXCEPTION 'permission required'; END IF;
 IF p_command IN('start_ownership_recovery','approve_ownership_recovery') THEN
  -- Do not retain Phase 26's insufficient cross-approver session revalidation.
  RAISE EXCEPTION 'PHASE28_RECOVERY_DISABLED requires live first-approver revalidation';
 END IF;
 IF p_command IN('initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer') AND NOT dispatch_private.fresh_totp(600) THEN RAISE EXCEPTION 'fresh TOTP required'; END IF;
 IF p_command='initiate_ownership_transfer' AND (NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships WHERE id=(p_payload->>'to_membership_id')::uuid AND organization_id=org AND status='ACTIVE' AND user_id<>a) OR (p_payload->>'expected_revision')::int IS DISTINCT FROM (SELECT governance_revision FROM dispatch_private.organizations WHERE id=org)) THEN RAISE EXCEPTION 'transfer target/revision'; END IF;
 IF p_command='accept_ownership_transfer' AND NOT EXISTS(SELECT 1 FROM dispatch_private.ownership_transfers t JOIN dispatch_private.organization_memberships m ON m.id=t.from_membership_id WHERE t.id=oid AND t.organization_id=org AND t.created_at>now()-interval '10 minutes' AND m.organization_id=org AND m.role_template='OWNER' AND m.status='ACTIVE') THEN RAISE EXCEPTION 'transfer expired or initiator revoked'; END IF;
 IF p_command IN('create_operational_record','update_operational_record','assign_operational_record','close_operational_record') THEN
  permission:=dispatch_private.command_permission(p_command);
  IF p_command='create_operational_record' THEN
   IF NOT dispatch_private.unit_access(org,unit,permission) THEN RAISE EXCEPTION 'unit forbidden'; END IF;
   IF unit IS NULL AND coalesce(p_payload->>'internal_share_class','')<>'PRIVATE_TO_ORGANIZATION' THEN RAISE EXCEPTION 'organization record classification required'; END IF;
   IF NOT EXISTS(SELECT 1 FROM dispatch_private.operational_scopes s WHERE s.id=(p_payload->>'scope_id')::uuid AND s.organization_id=org AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND (unit IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.unit_scope_grants g WHERE g.unit_id=unit AND g.scope_id=s.id))) THEN RAISE EXCEPTION 'scope forbidden'; END IF;
  ELSE
   SELECT * INTO r FROM dispatch_private.operational_records WHERE id=oid AND organization_id=org FOR UPDATE;
   IF NOT FOUND OR NOT dispatch_private.record_access(oid,permission) THEN RAISE EXCEPTION 'record forbidden'; END IF;
   IF p_payload ? 'unit_id' OR p_payload ? 'internal_share_class' THEN RAISE EXCEPTION 'ownership is immutable'; END IF;
   IF p_command='assign_operational_record' AND NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships m WHERE m.id=(p_payload->>'membership_id')::uuid AND m.organization_id=org AND m.status='ACTIVE' AND (r.owning_unit_id IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.unit_memberships um WHERE um.membership_id=m.id AND um.unit_id=r.owning_unit_id AND um.status='ACTIVE'))) THEN RAISE EXCEPTION 'assignee forbidden'; END IF;
  END IF;
  IF p_command IN('create_operational_record','update_operational_record') AND coalesce(p_payload->>'data_attestation','')<>'OPERATIONAL_AWARENESS_ONLY' THEN RAISE EXCEPTION 'sensitive-data attestation required'; END IF;
 END IF;
 IF p_command='grant_capability' THEN
  IF p_payload->>'capability' NOT IN('awareness.condition.publish','awareness.planned_work.publish','awareness.official_notice.publish') OR p_payload->>'capability' IS NULL THEN RAISE EXCEPTION 'pilot capability disabled'; END IF;
  IF (p_payload->>'valid_until')::timestamptz IS NULL OR (p_payload->>'valid_until')::timestamptz<=now() OR (p_payload->>'valid_until')::timestamptz>now()+interval '90 days' THEN RAISE EXCEPTION 'pilot grant duration'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.scope_governance sg JOIN dispatch_private.operational_scopes s ON s.id=sg.scope_id WHERE sg.organization_id=org AND sg.scope_id=(p_payload->>'scope_id')::uuid AND sg.valid_until>now() AND s.status='ACTIVE') THEN RAISE EXCEPTION 'governed scope required'; END IF;
 END IF;
 IF p_command IN('submit_projection_candidate','approve_projection','reject_projection','publish_projection','withdraw_projection') THEN
  IF p_command='submit_projection_candidate' THEN rid:=(p_payload->>'record_id')::uuid; cap:=(p_payload->>'capability_id')::uuid;
  ELSE
   IF p_command='withdraw_projection' THEN SELECT pc.* INTO c FROM dispatch_projection.projection_candidates pc JOIN dispatch_projection.public_safe_projections pp ON pp.candidate_id=pc.id WHERE pp.id=oid AND pc.organization_id=org;
   ELSE SELECT * INTO c FROM dispatch_projection.projection_candidates WHERE id=oid AND organization_id=org FOR UPDATE; END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'candidate forbidden'; END IF; rid:=c.source_record_id; cap:=c.capability_grant_id;
  END IF;
  IF NOT dispatch_private.record_access(rid,dispatch_private.command_permission(p_command)) OR NOT EXISTS(SELECT 1 FROM dispatch_private.operational_records WHERE id=rid AND organization_id=org) THEN RAISE EXCEPTION 'source forbidden'; END IF;
  IF p_command NOT IN('withdraw_projection','reject_projection') AND NOT dispatch_private.pilot_candidate_eligible(rid,cap) THEN RAISE EXCEPTION 'publication ineligible'; END IF;
  IF p_command='submit_projection_candidate' THEN
   IF NOT EXISTS(SELECT 1 FROM dispatch_private.operational_records WHERE id=rid AND current_revision=(p_payload->>'source_revision')::int) OR (p_payload->>'freshness_deadline')::timestamptz IS NULL OR (p_payload->>'freshness_deadline')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+interval '5 minutes' THEN RAISE EXCEPTION 'source/freshness mismatch'; END IF;
   IF coalesce(p_payload->>'sanitization_attestation','')<>'PUBLIC_SAFE_V1' OR coalesce(length(p_payload->'payload'->>'title'),0) NOT BETWEEN 1 AND 160 OR coalesce(length(p_payload->'payload'->>'summary'),0) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'sanitization required'; END IF;
  ELSIF p_command IN('approve_projection','publish_projection') THEN
   IF c.freshness_deadline<=now() OR NOT EXISTS(SELECT 1 FROM dispatch_private.operational_records WHERE id=rid AND current_revision=c.source_revision) THEN RAISE EXCEPTION 'stale candidate'; END IF;
   IF p_command='approve_projection' AND (c.requested_by_user_id=a OR coalesce(p_payload->>'sanitization_attestation','')<>'PUBLIC_SAFE_V1') THEN RAISE EXCEPTION 'independent sanitation review required'; END IF;
   IF p_command='publish_projection' AND (coalesce(p_payload->>'organization_public_name','')<>(SELECT display_name FROM dispatch_private.organizations WHERE id=org) OR coalesce(p_payload->>'source_label','')<>'Governed organization awareness' OR coalesce(p_payload->>'taxonomy','')<>(SELECT CASE record_type WHEN 'CONDITION' THEN 'condition' WHEN 'PLANNED_WORK' THEN 'planned_work' WHEN 'OPERATIONAL_NOTICE' THEN 'official_notice' ELSE '' END FROM dispatch_private.operational_records WHERE id=rid)) THEN RAISE EXCEPTION 'governed presentation required'; END IF;
  END IF;
 END IF;
 IF p_command='invite_member' AND ((p_payload->>'expires_at')::timestamptz IS NULL OR (p_payload->>'expires_at')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+interval '7 days') THEN RAISE EXCEPTION 'invitation duration'; END IF;
 IF p_command='change_member_role' AND p_payload->>'role'='OWNER' THEN RAISE EXCEPTION 'ownership transfer required'; END IF;
 IF p_command IN('change_member_role','suspend_member','revoke_member') AND EXISTS(SELECT 1 FROM dispatch_private.organization_memberships WHERE id=oid AND organization_id=org AND role_template='OWNER') THEN RAISE EXCEPTION 'owner protection'; END IF;
 -- Authorize before returning receipts; replay cannot disclose a newly inaccessible source.
 SELECT * INTO prior FROM dispatch_audit.command_receipts WHERE organization_id=org AND actor_user_id=a AND command_name=p_command AND idempotency_key=k;
 IF FOUND THEN
  IF prior.request_hash<>h THEN RAISE EXCEPTION 'idempotency payload mismatch'; END IF;
  IF p_command LIKE '%internal_share%' AND NOT dispatch_private.record_access((prior.result_payload->>'source_record_id')::uuid,'internal.share') THEN RAISE EXCEPTION 'share forbidden'; END IF;
  RETURN prior.result_payload||jsonb_build_object('replay',true);
 END IF;
 IF p_command IN('update_operational_record','assign_operational_record','close_operational_record') AND (p_payload->>'expected_revision')::int IS DISTINCT FROM r.current_revision THEN RAISE EXCEPTION 'stale revision'; END IF;
 -- The organization lock serializes these checks with every command in this tenant.
 -- Check after authorized receipt replay so retrying an accepted command is stable.
 IF p_command IN('set_organization_status','set_organization_verification') AND
    (p_payload->>'expected_revision')::int IS DISTINCT FROM (SELECT governance_revision FROM dispatch_private.organizations WHERE id=org)
 THEN RAISE EXCEPTION 'stale organization revision'; END IF;
 IF p_command IN('change_member_role','suspend_member','reactivate_member','revoke_member') THEN
  SELECT revision INTO rev FROM dispatch_private.organization_memberships WHERE id=oid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR (p_payload->>'expected_revision')::int IS DISTINCT FROM rev THEN RAISE EXCEPTION 'stale membership revision'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships WHERE id=oid AND
    CASE p_command WHEN 'change_member_role' THEN status='ACTIVE' WHEN 'suspend_member' THEN status='ACTIVE'
    WHEN 'reactivate_member' THEN status='SUSPENDED' ELSE status IN('INVITED','ACTIVE','SUSPENDED') END)
  THEN RAISE EXCEPTION 'invalid membership transition'; END IF;
 END IF;
 IF p_command IN('suspend_capability','revoke_capability') THEN
  SELECT revision INTO rev FROM dispatch_private.capability_grants WHERE id=oid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR (p_payload->>'expected_revision')::int IS DISTINCT FROM rev THEN RAISE EXCEPTION 'stale capability revision'; END IF;
 END IF;
 IF p_command IN('create_unit','set_unit_membership','advance_onboarding','offboard_unit') THEN
  IF dispatch_private.actor_membership(org,'units.manage') IS NULL THEN RAISE EXCEPTION 'unit management forbidden'; END IF;
  IF p_command='create_unit' THEN
   oid:=coalesce(oid,extensions.gen_random_uuid());
   INSERT INTO dispatch_private.organization_units(id,organization_id,unit_type,name,display_name,parent_unit_id) VALUES(oid,org,(p_payload->>'unit_type')::dispatch_private.unit_type,p_payload->>'name',p_payload->>'display_name',(p_payload->>'parent_unit_id')::uuid);
  ELSE
   SELECT * INTO unit_row FROM dispatch_private.organization_units WHERE id=unit AND organization_id=org FOR UPDATE;
   IF NOT FOUND OR (p_payload->>'expected_revision')::int IS DISTINCT FROM unit_row.revision THEN RAISE EXCEPTION 'stale unit'; END IF;
   oid:=unit;
   IF p_command='set_unit_membership' THEN
    INSERT INTO dispatch_private.unit_memberships(organization_id,unit_id,membership_id,status) VALUES(org,unit,(p_payload->>'membership_id')::uuid,(p_payload->>'status')::dispatch_private.membership_status)
    ON CONFLICT(unit_id,membership_id) DO UPDATE SET status=EXCLUDED.status,revision=dispatch_private.unit_memberships.revision+1;
   ELSIF p_command='offboard_unit' THEN
    UPDATE dispatch_private.organization_units SET status='OFFBOARDED',onboarding_state='OFFBOARDED' WHERE id=unit;
    UPDATE dispatch_private.unit_memberships SET status='REVOKED',revision=revision+1 WHERE unit_id=unit;
    UPDATE dispatch_private.internal_awareness SET revoked_at=now() WHERE source_unit_id=unit AND revoked_at IS NULL;
    DELETE FROM dispatch_private.internal_share_recipients WHERE recipient_unit_id=unit;
   ELSE
    target_state:=p_payload->>'state';
    IF coalesce(p_payload->>'owner_review_reference','')='' THEN RAISE EXCEPTION 'owner review required'; END IF;
    IF target_state<>(CASE unit_row.onboarding_state WHEN 'PLANNED' THEN 'IDENTITY_VERIFIED' WHEN 'IDENTITY_VERIFIED' THEN 'ADMIN_ASSIGNED' WHEN 'ADMIN_ASSIGNED' THEN 'MEMBERSHIP_CONFIGURED' WHEN 'MEMBERSHIP_CONFIGURED' THEN 'SCOPE_CONFIGURED' WHEN 'SCOPE_CONFIGURED' THEN 'MFA_VERIFIED' WHEN 'MFA_VERIFIED' THEN 'PRIVATE_PILOT_READY' WHEN 'PRIVATE_PILOT_READY' THEN 'PUBLISHING_REVIEW_REQUIRED' WHEN 'PUBLISHING_REVIEW_REQUIRED' THEN 'PUBLISHING_ENABLED' ELSE '' END) AND target_state<>'SUSPENDED' THEN RAISE EXCEPTION 'invalid onboarding transition'; END IF;
    IF target_state='PUBLISHING_ENABLED' AND NOT EXISTS(SELECT 1 FROM dispatch_private.pilot_governance WHERE organization_id=org AND publishing_enabled AND verification_expires_at>now() AND attestation_expires_at>now()) THEN RAISE EXCEPTION 'platform publishing review required'; END IF;
    IF target_state='PUBLISHING_ENABLED' AND NOT EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants WHERE user_id=a AND permission_key='platform.capability.manage' AND active) THEN RAISE EXCEPTION 'independent platform unit approval required'; END IF;
    IF target_state='PRIVATE_PILOT_READY' AND (NOT EXISTS(SELECT 1 FROM dispatch_private.unit_memberships WHERE unit_id=unit AND status='ACTIVE') OR NOT EXISTS(SELECT 1 FROM dispatch_private.unit_scope_grants WHERE unit_id=unit)) THEN RAISE EXCEPTION 'membership/scope required'; END IF;
    UPDATE dispatch_private.organization_units SET onboarding_state=target_state::dispatch_private.onboarding_state,status=(CASE WHEN target_state IN('PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED') THEN 'ACTIVE' WHEN target_state='SUSPENDED' THEN 'SUSPENDED' ELSE 'PLANNED' END)::dispatch_private.unit_status WHERE id=unit;
   END IF;
   UPDATE dispatch_private.organization_units SET revision=revision+1,updated_at=now() WHERE id=unit;
  END IF;
 ELSIF p_command IN('create_internal_share','replace_internal_share_recipients','revoke_internal_share') THEN
  IF p_command='create_internal_share' THEN rid:=(p_payload->>'record_id')::uuid;
  ELSE SELECT * INTO sh FROM dispatch_private.internal_awareness WHERE id=oid AND organization_id=org FOR UPDATE;
   IF NOT FOUND OR sh.revoked_at IS NOT NULL OR (p_payload->>'expected_revision')::int IS DISTINCT FROM sh.revision THEN RAISE EXCEPTION 'stale share'; END IF; rid:=sh.source_record_id;
  END IF;
  SELECT * INTO r FROM dispatch_private.operational_records WHERE id=rid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR NOT dispatch_private.record_access(rid,'internal.share') OR r.owning_unit_id IS NULL THEN RAISE EXCEPTION 'share forbidden'; END IF;
  IF p_command<>'revoke_internal_share' THEN
   IF r.status IN('CLOSED','CANCELLED') OR (p_command='create_internal_share' AND (p_payload->>'source_revision')::int IS DISTINCT FROM r.current_revision) THEN RAISE EXCEPTION 'source not shareable'; END IF;
   SELECT array_agg(value::uuid) INTO recipients FROM jsonb_array_elements_text(p_payload->'recipient_unit_ids');
   IF coalesce(cardinality(recipients),0)=0 OR cardinality(recipients)>20 OR EXISTS(SELECT 1 FROM unnest(recipients) x LEFT JOIN dispatch_private.organization_units u ON u.id=x AND u.organization_id=org AND u.status='ACTIVE' WHERE u.id IS NULL) THEN RAISE EXCEPTION 'explicit live same-organization recipients required'; END IF;
   IF p_command='create_internal_share' THEN
    IF coalesce(p_payload->>'sanitization_attestation','')<>'INTERNAL_SAFE_V1' OR (p_payload->>'expires_at')::timestamptz IS NULL OR (p_payload->>'expires_at')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+interval '1 day' THEN RAISE EXCEPTION 'internal sanitization/expiry required'; END IF;
    oid:=coalesce(oid,extensions.gen_random_uuid());
    INSERT INTO dispatch_private.internal_awareness(id,organization_id,source_record_id,source_revision,source_unit_id,title,summary,expires_at,sanitization_version) VALUES(oid,org,rid,r.current_revision,r.owning_unit_id,p_payload->>'title',p_payload->>'summary',(p_payload->>'expires_at')::timestamptz,'internal-v1');
   ELSE DELETE FROM dispatch_private.internal_share_recipients WHERE share_id=oid;
    UPDATE dispatch_private.internal_awareness SET revision=revision+1 WHERE id=oid;
   END IF;
   INSERT INTO dispatch_private.internal_share_recipients SELECT org,oid,x FROM unnest(recipients) x;
  ELSE UPDATE dispatch_private.internal_awareness SET revoked_at=now(),revision=revision+1 WHERE id=oid; END IF;
 ELSE
  IF p_command NOT IN('create_operational_record','update_operational_record','assign_operational_record','close_operational_record','invite_member','revoke_invitation','accept_invitation','change_member_role','suspend_member','reactivate_member','revoke_member','initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer','grant_capability','suspend_capability','revoke_capability','submit_projection_candidate','approve_projection','reject_projection','publish_projection','withdraw_projection','set_organization_verification','set_organization_status') THEN RAISE EXCEPTION 'unknown command'; END IF;
  -- Default ownership constraint is checked by a transaction-local insert trigger below.
  PERFORM set_config('dispatch.phase28_unit',coalesce(unit::text,''),true);
  result:=dispatch_private.phase26_command(p_command,p_payload);
  oid:=(result->>'object_id')::uuid;
  IF p_command='create_operational_record' THEN
   UPDATE dispatch_private.operational_records SET safety_class=coalesce(p_payload->>'safety_class','UNREVIEWED') WHERE id=oid;
  END IF;
  IF p_command='close_operational_record' THEN INSERT INTO dispatch_audit.record_revisions(organization_id,record_id,revision_number,snapshot,actor_user_id) SELECT org,oid,current_revision,to_jsonb(x),a FROM dispatch_private.operational_records x WHERE id=oid; END IF;
  IF p_command='assign_operational_record' THEN
   UPDATE dispatch_private.operational_records SET current_revision=current_revision+1 WHERE id=r.id;
   INSERT INTO dispatch_audit.record_revisions(organization_id,record_id,revision_number,snapshot,actor_user_id) SELECT org,r.id,current_revision,to_jsonb(x),a FROM dispatch_private.operational_records x WHERE id=r.id;
  END IF;
 END IF;
 INSERT INTO dispatch_private.actor_tokens(organization_id,user_id) VALUES(org,a) ON CONFLICT DO NOTHING;
 SELECT token INTO t FROM dispatch_private.actor_tokens WHERE organization_id=org AND user_id=a;
 IF p_command IN('create_operational_record','update_operational_record','assign_operational_record','close_operational_record') THEN
  rid:=oid;
  SELECT * INTO r FROM dispatch_private.operational_records WHERE id=rid AND organization_id=org;
  INSERT INTO dispatch_private.record_provenance(organization_id,record_id,revision_number,source_class,owning_unit_id,actor_token)
  VALUES(org,rid,r.current_revision,'PRIVATE_OPERATIONAL',r.owning_unit_id,t);
 ELSIF rid IS NOT NULL THEN SELECT * INTO r FROM dispatch_private.operational_records WHERE id=rid AND organization_id=org;
 END IF;
 INSERT INTO dispatch_audit.pilot_events(organization_id,actor_token,command_name,target_id,source_record_id,source_revision,payload)
 VALUES(org,t,p_command,oid,rid,r.current_revision,jsonb_build_object('request_hash',encode(h,'hex'),'recipient_unit_ids',recipients,'sanitization',p_payload->>'sanitization_attestation','owner_review_reference',p_payload->>'owner_review_reference'));
 IF result IS NULL THEN
  result:=jsonb_build_object('object_id',oid,'source_record_id',rid,'replay',false);
  INSERT INTO dispatch_audit.command_receipts(organization_id,actor_user_id,session_id,command_name,idempotency_key,request_hash,result_payload) VALUES(org,a,dispatch_private.current_session_id(),p_command,k,h,result);
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION dispatch_private.record_unit_insert() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 NEW.owning_unit_id:=nullif(current_setting('dispatch.phase28_unit',true),'')::uuid;
 NEW.internal_share_class:=CASE WHEN NEW.owning_unit_id IS NULL THEN 'PRIVATE_TO_ORGANIZATION'::dispatch_private.internal_share_class ELSE 'PRIVATE_TO_UNIT'::dispatch_private.internal_share_class END;
 RETURN NEW;
END $$;
CREATE TRIGGER record_unit_insert BEFORE INSERT ON dispatch_private.operational_records FOR EACH ROW EXECUTE FUNCTION dispatch_private.record_unit_insert();

DO $factory$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['create_unit','set_unit_membership','advance_onboarding','offboard_unit','create_internal_share','replace_internal_share_recipients','revoke_internal_share'] LOOP
 EXECUTE format('CREATE FUNCTION dispatch_api.%I(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $f$ SELECT dispatch_private.execute_command(%L,p_payload) $f$',n,n);
END LOOP; END $factory$;

-- Catalog-generated RLS statements are install-time only, never caller-driven runtime SQL.
DO $rls$ DECLARE r regclass; BEGIN FOR r IN SELECT c.oid::regclass FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r' LOOP
 EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',r); EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',r);
END LOOP; END $rls$;
GRANT dispatch_function_owner TO postgres;
GRANT CREATE ON SCHEMA dispatch_private TO dispatch_function_owner;
DO $owners$ DECLARE p regprocedure; BEGIN FOR p IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname<>'has_live_aal2' LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO dispatch_function_owner',p); END LOOP; END $owners$;
REVOKE CREATE ON SCHEMA dispatch_private FROM dispatch_function_owner;

REVOKE ALL ON ALL TABLES IN SCHEMA dispatch_private,dispatch_audit,dispatch_projection FROM dispatch_function_owner,PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON dispatch_private.profiles,dispatch_private.organizations,dispatch_private.role_templates,dispatch_private.permissions,dispatch_private.role_permissions,dispatch_private.organization_memberships,dispatch_private.organization_invitations,dispatch_private.operational_scopes,dispatch_private.operational_scope_members,dispatch_private.platform_admin_grants,dispatch_private.capability_grants,dispatch_private.operational_records,dispatch_private.record_assignments,dispatch_private.record_provenance,dispatch_private.ownership_transfers,dispatch_private.ownership_recovery_cases,dispatch_private.recovery_approvals,dispatch_projection.projection_candidates,dispatch_projection.public_safe_projections,dispatch_audit.command_receipts,dispatch_audit.record_revisions,dispatch_audit.audit_events,dispatch_private.organization_units,dispatch_private.unit_memberships,dispatch_private.unit_scope_grants,dispatch_private.pilot_governance,dispatch_private.scope_governance,dispatch_private.internal_awareness,dispatch_private.internal_share_recipients,dispatch_private.actor_tokens,dispatch_audit.pilot_events TO dispatch_function_owner;
GRANT INSERT ON dispatch_private.organization_invitations,dispatch_private.organization_memberships,dispatch_private.capability_grants,dispatch_private.operational_records,dispatch_private.record_assignments,dispatch_private.ownership_transfers,dispatch_projection.projection_candidates,dispatch_projection.public_safe_projections,dispatch_audit.command_receipts,dispatch_audit.record_revisions,dispatch_audit.audit_events,dispatch_private.organization_units,dispatch_private.unit_memberships,dispatch_private.internal_awareness,dispatch_private.internal_share_recipients,dispatch_private.actor_tokens,dispatch_audit.pilot_events TO dispatch_function_owner;
GRANT UPDATE ON dispatch_private.organizations,dispatch_private.organization_memberships,dispatch_private.organization_invitations,dispatch_private.capability_grants,dispatch_private.operational_records,dispatch_private.ownership_transfers,dispatch_projection.projection_candidates,dispatch_projection.public_safe_projections,dispatch_private.organization_units,dispatch_private.unit_memberships,dispatch_private.internal_awareness TO dispatch_function_owner;
GRANT DELETE ON dispatch_private.internal_share_recipients TO dispatch_function_owner;
GRANT INSERT ON dispatch_private.record_provenance TO dispatch_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_private,dispatch_api FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.has_live_aal2(),dispatch_private.current_actor_id(),dispatch_private.current_session_id(),dispatch_private.unit_access(uuid,uuid,text),dispatch_private.record_access(uuid,text),dispatch_private.internal_access(uuid),dispatch_private.execute_command(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_private.has_live_aal2() TO dispatch_function_owner;

GRANT EXECUTE ON FUNCTION dispatch_private.projection_eligible(uuid) TO anon,authenticated;
GRANT SELECT(id,organization_id,operational_scope_id,record_type,status,priority,title,current_revision,created_at,owning_unit_id,internal_share_class) ON dispatch_private.operational_records TO authenticated;
GRANT SELECT(id,title,summary,created_at,expires_at) ON dispatch_private.internal_awareness TO authenticated;
GRANT SELECT(id,organization_public_name,source_class,source_label,consumer_taxonomy,title,summary,public_location,published_at,expires_at) ON dispatch_projection.public_safe_projections TO anon,authenticated;
GRANT SELECT ON dispatch_api.internal_awareness TO authenticated;
DO $grants$ DECLARE p regprocedure; BEGIN FOR p IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_api' AND p.prokind='f' LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',p); END LOOP;
 FOR p IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname LIKE '%\_command' ESCAPE '\' AND p.proname<>'phase26_command' LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',p); END LOOP;
END $grants$;
GRANT EXECUTE ON FUNCTION dispatch_private.current_session_id(),dispatch_private.current_claims() TO postgres;
GRANT EXECUTE ON FUNCTION dispatch_private.current_claims() TO authenticated;
REVOKE dispatch_function_owner FROM postgres;
NOTIFY pgrst,'reload schema';

GRANT dispatch_function_owner TO postgres;
CREATE TABLE dispatch_private.approval_proofs(
 operation_id uuid NOT NULL, organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,
 kind text NOT NULL CHECK(kind IN('TRANSFER','RECOVERY')), actor_id uuid,
 session_id uuid, factor_id uuid, totp_at timestamptz NOT NULL,
 binding jsonb NOT NULL, actor_token uuid NOT NULL,
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(), UNIQUE(operation_id,actor_token));
CREATE TABLE dispatch_private.auth_check_context(
 transaction_id bigint PRIMARY KEY, operation_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('TRANSFER','RECOVERY','ERASURE')));
CREATE TABLE dispatch_private.user_offboarding(
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES dispatch_private.organizations, target_user_id uuid, revision integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'AUTH_REVOCATION_REQUIRED' CHECK(status IN('AUTH_REVOCATION_REQUIRED','COMPLETE')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
CREATE UNIQUE INDEX offboarding_pending_user ON dispatch_private.user_offboarding(target_user_id) WHERE target_user_id IS NOT NULL;
CREATE TABLE dispatch_private.erasure_context(transaction_id bigint PRIMARY KEY, user_id uuid NOT NULL);
CREATE TABLE dispatch_audit.command_versions(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,
 command_name text NOT NULL, object_id uuid NOT NULL, expected_revision integer, revision integer NOT NULL,
 actor_token uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER command_versions_immutable BEFORE UPDATE OR DELETE ON dispatch_audit.command_versions FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
ALTER TABLE dispatch_private.organization_invitations ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE dispatch_private.ownership_transfers ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE dispatch_private.ownership_recovery_cases ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE dispatch_projection.projection_candidates ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE dispatch_private.pilot_governance ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE dispatch_private.profiles DROP CONSTRAINT profiles_user_id_fkey;

-- Keep Auth UUIDs only while operationally necessary. Every historical actor has an
-- independent organization-scoped random token; nullable raw links retain their FKs.
ALTER TABLE dispatch_private.organization_memberships ADD COLUMN actor_token uuid;
ALTER TABLE dispatch_private.platform_admin_grants DROP CONSTRAINT platform_admin_grants_pkey,
 ADD COLUMN id uuid DEFAULT extensions.gen_random_uuid() PRIMARY KEY,
 ADD COLUMN actor_token uuid, ADD COLUMN grantor_token uuid,
 ALTER COLUMN user_id DROP NOT NULL, ALTER COLUMN granted_by_user_id DROP NOT NULL;
CREATE UNIQUE INDEX platform_live_grant ON dispatch_private.platform_admin_grants(user_id,permission_key) WHERE user_id IS NOT NULL;
ALTER TABLE dispatch_private.recovery_approvals DROP CONSTRAINT recovery_approvals_pkey,
 ADD COLUMN id uuid DEFAULT extensions.gen_random_uuid() PRIMARY KEY, ADD COLUMN actor_token uuid,
 ALTER COLUMN user_id DROP NOT NULL, ALTER COLUMN session_id DROP NOT NULL;
CREATE UNIQUE INDEX recovery_distinct_live ON dispatch_private.recovery_approvals(case_id,user_id) WHERE user_id IS NOT NULL;
ALTER TABLE dispatch_private.organization_memberships ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE dispatch_private.capability_grants ADD COLUMN actor_token uuid, ALTER COLUMN granted_by_platform_actor DROP NOT NULL;
ALTER TABLE dispatch_audit.record_revisions ADD COLUMN actor_token uuid, ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE dispatch_audit.command_receipts ADD COLUMN actor_token uuid, ALTER COLUMN actor_user_id DROP NOT NULL, ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE dispatch_audit.audit_events ADD COLUMN actor_token uuid, ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE dispatch_projection.projection_candidates ADD COLUMN actor_token uuid, ALTER COLUMN requested_by_user_id DROP NOT NULL;

CREATE FUNCTION dispatch_private.token_for(p_org uuid,p_actor uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t uuid; BEGIN
 IF p_actor IS NULL THEN RETURN NULL; END IF;
 INSERT INTO dispatch_private.actor_tokens(organization_id,user_id) VALUES(p_org,p_actor) ON CONFLICT DO NOTHING;
 SELECT token INTO t FROM dispatch_private.actor_tokens WHERE organization_id=p_org AND user_id=p_actor;
 RETURN t;
END $$;

-- Exact JSON value replacement, including nested historical command/revision payloads.
CREATE FUNCTION dispatch_private.erase_json(p jsonb,actor uuid,token uuid) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE result jsonb; BEGIN
 CASE jsonb_typeof(p)
 WHEN 'object' THEN SELECT coalesce(jsonb_object_agg(key,dispatch_private.erase_json(value,actor,token)),'{}') INTO result FROM jsonb_each(p);
 WHEN 'array' THEN SELECT coalesce(jsonb_agg(dispatch_private.erase_json(value,actor,token)),'[]') INTO result FROM jsonb_array_elements(p);
 WHEN 'string' THEN result:=to_jsonb(replace(p#>>'{}',actor::text,token::text));
 ELSE result:=p; END CASE; RETURN result;
END $$;

-- The bridge remains no-argument, read-only, boolean-only and the sole postgres definer.
-- Peer checks can only be selected by a command-owned transaction context, never a GUC
-- or browser-selected actor. Supplied factor IDs are verified here, never trusted.
CREATE OR REPLACE FUNCTION dispatch_private.has_live_aal2() RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM auth.users u JOIN auth.sessions s ON s.id=dispatch_private.current_session_id()
 JOIN auth.mfa_factors f ON f.id=s.factor_id JOIN dispatch_private.profiles p ON p.user_id=u.id
 WHERE u.id=auth.uid() AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now())
 AND s.user_id=u.id AND s.aal='aal2' AND (s.not_after IS NULL OR s.not_after>now())
 AND f.user_id=u.id AND f.status='verified' AND f.factor_type='totp' AND p.status='ACTIVE'
 AND auth.jwt()->>'aal'='aal2' AND auth.jwt()->'amr' @> '[{"method":"totp"}]'::jsonb)
 AND NOT EXISTS(SELECT 1 FROM dispatch_private.auth_check_context ctx
 JOIN dispatch_private.approval_proofs proof ON proof.operation_id=ctx.operation_id AND proof.kind=ctx.kind
 LEFT JOIN auth.users u ON u.id=proof.actor_id LEFT JOIN auth.sessions s ON s.id=proof.session_id
 LEFT JOIN auth.mfa_factors f ON f.id=proof.factor_id LEFT JOIN dispatch_private.profiles p ON p.user_id=proof.actor_id
 WHERE ctx.transaction_id=txid_current() AND (u.id IS NULL OR u.deleted_at IS NOT NULL OR u.banned_until>now()
 OR s.id IS NULL OR s.user_id IS DISTINCT FROM proof.actor_id OR s.aal IS DISTINCT FROM 'aal2'
 OR s.factor_id IS DISTINCT FROM proof.factor_id OR s.not_after<=now()
 OR f.id IS NULL OR f.user_id IS DISTINCT FROM proof.actor_id OR f.status IS DISTINCT FROM 'verified'
 OR f.factor_type IS DISTINCT FROM 'totp' OR p.status IS DISTINCT FROM 'ACTIVE'
 OR proof.totp_at>clock_timestamp() OR proof.totp_at<clock_timestamp()-CASE ctx.kind WHEN 'RECOVERY' THEN interval '5 minutes' ELSE interval '10 minutes' END
 OR (ctx.kind='RECOVERY' AND NOT EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants g
 WHERE g.user_id=proof.actor_id AND g.permission_key='platform.ownership.recover' AND g.active))))
 AND NOT EXISTS(SELECT 1 FROM dispatch_private.auth_check_context ctx
 JOIN dispatch_private.ownership_recovery_cases c ON c.id=ctx.operation_id
 JOIN dispatch_private.organization_memberships m ON m.id=c.target_membership_id
 LEFT JOIN auth.users u ON u.id=m.user_id WHERE ctx.transaction_id=txid_current() AND ctx.kind='RECOVERY'
 AND (u.id IS NULL OR u.deleted_at IS NOT NULL OR u.banned_until>now()))
 AND NOT EXISTS(SELECT 1 FROM dispatch_private.auth_check_context ctx JOIN dispatch_private.user_offboarding j ON j.id=ctx.operation_id
 JOIN auth.users u ON u.id=j.target_user_id WHERE ctx.transaction_id=txid_current() AND ctx.kind='ERASURE')
$$;

CREATE OR REPLACE FUNCTION dispatch_private.fresh_totp(p_seconds integer) RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path='' AS $$
 SELECT dispatch_private.has_live_aal2() AND EXISTS(SELECT 1 FROM jsonb_array_elements(dispatch_private.current_claims()->'amr') m
 WHERE m->>'method'='totp' AND (m->>'timestamp') ~ '^[0-9]{1,12}$'
 AND to_timestamp((m->>'timestamp')::bigint) BETWEEN clock_timestamp()-make_interval(secs=>p_seconds) AND clock_timestamp())
$$;

CREATE FUNCTION dispatch_private.check_proof(op uuid,org uuid,kind text,binding jsonb,factor uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE stamp timestamptz; BEGIN
 IF NOT dispatch_private.fresh_totp(CASE kind WHEN 'RECOVERY' THEN 300 ELSE 600 END) THEN RAISE EXCEPTION 'fresh same-user TOTP required'; END IF;
 SELECT to_timestamp(max((m->>'timestamp')::bigint)) INTO stamp FROM jsonb_array_elements(dispatch_private.current_claims()->'amr') m WHERE m->>'method'='totp';
 INSERT INTO dispatch_private.approval_proofs(operation_id,organization_id,kind,actor_id,session_id,factor_id,totp_at,binding,actor_token) VALUES(op,org,kind,dispatch_private.current_actor_id(),dispatch_private.current_session_id(),factor,stamp,binding,dispatch_private.token_for(org,dispatch_private.current_actor_id()));
 INSERT INTO dispatch_private.auth_check_context VALUES(txid_current(),op,kind);
 IF NOT dispatch_private.has_live_aal2() THEN RAISE EXCEPTION 'approval live revalidation failed'; END IF;
 DELETE FROM dispatch_private.auth_check_context WHERE transaction_id=txid_current();
END $$;

CREATE FUNCTION dispatch_private.lifecycle_allowed(old dispatch_private.record_status,new dispatch_private.record_status) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE old WHEN 'DRAFT' THEN new IN('OPEN','CANCELLED') WHEN 'OPEN' THEN new IN('IN_PROGRESS','MONITORING','CLOSED','CANCELLED')
 WHEN 'IN_PROGRESS' THEN new IN('MONITORING','CLOSED','CANCELLED') WHEN 'MONITORING' THEN new IN('IN_PROGRESS','CLOSED','CANCELLED') ELSE false END
$$;

ALTER FUNCTION dispatch_private.execute_command(text,jsonb) RENAME TO phase28_partial_command;
CREATE FUNCTION dispatch_private.execute_command(p_command text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a uuid:=dispatch_private.current_actor_id(); org uuid:=(p_payload->>'organization_id')::uuid;
 k uuid:=(p_payload->>'idempotency_key')::uuid; oid uuid:=(p_payload->>'object_id')::uuid;
 h bytea:=dispatch_private.request_hash(p_payload-'idempotency_key'); v integer; expected integer:=(p_payload->>'expected_revision')::int;
 old dispatch_audit.command_receipts%ROWTYPE; result jsonb; target uuid; mid uuid; t uuid; bind jsonb;
 transfer dispatch_private.ownership_transfers%ROWTYPE; recovery dispatch_private.ownership_recovery_cases%ROWTYPE;
 record dispatch_private.operational_records%ROWTYPE; grantrow dispatch_private.capability_grants%ROWTYPE;
 state dispatch_private.record_status; permission text; special boolean; job dispatch_private.user_offboarding%ROWTYPE;
BEGIN
 IF NOT dispatch_private.has_live_aal2() OR a IS NULL OR org IS NULL OR k IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 -- Global identity operations lock first; organization locks follow deterministically.
 PERFORM pg_advisory_xact_lock(280028);
 PERFORM 1 FROM dispatch_private.organizations WHERE id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'organization forbidden'; END IF;
 special:=p_command IN('start_ownership_recovery','approve_ownership_recovery','initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer','transition_operational_record','grant_capability','renew_capability','renew_verification','renew_attestation','set_organization_status','set_organization_verification','offboard_organization','begin_user_offboarding','complete_user_offboarding');
 permission:=CASE WHEN p_command LIKE '%recovery' THEN 'platform.ownership.recover'
 WHEN p_command IN('renew_capability','grant_capability','suspend_capability','revoke_capability') THEN 'platform.capability.manage'
 WHEN p_command IN('renew_verification','renew_attestation','set_organization_verification') THEN 'platform.organization.verify'
 WHEN p_command IN('set_organization_status','offboard_organization') THEN 'platform.organization.suspend'
 WHEN p_command IN('begin_user_offboarding','complete_user_offboarding') THEN 'platform.abuse.manage'
 WHEN p_command='accept_ownership_transfer' THEN 'organization.read'
 WHEN p_command LIKE '%ownership_transfer' THEN 'ownership.transfer'
 WHEN p_command='transition_operational_record' THEN CASE WHEN p_payload->>'state' IN('CLOSED','CANCELLED') THEN 'operations.close' ELSE 'operations.update' END
 WHEN p_command IN('create_unit','set_unit_membership','advance_onboarding','offboard_unit') THEN 'units.manage'
 WHEN p_command LIKE '%internal_share%' THEN 'internal.share'
 ELSE dispatch_private.command_permission(p_command) END;
 IF permission LIKE 'platform.%' THEN
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants WHERE user_id=a AND permission_key=permission AND active) THEN RAISE EXCEPTION 'platform permission required'; END IF;
 ELSIF p_command<>'accept_invitation' AND dispatch_private.actor_membership(org,permission) IS NULL THEN RAISE EXCEPTION 'live membership permission required'; END IF;
 IF p_command IN('update_operational_record','assign_operational_record','close_operational_record','transition_operational_record') THEN
  SELECT * INTO record FROM dispatch_private.operational_records WHERE id=oid AND organization_id=org;
  IF NOT FOUND OR NOT dispatch_private.record_access(oid,permission) THEN RAISE EXCEPTION 'record ownership forbidden'; END IF;
 END IF;
 IF p_command LIKE '%internal_share%' THEN
  target:=CASE WHEN p_command='create_internal_share' THEN (p_payload->>'record_id')::uuid ELSE (SELECT source_record_id FROM dispatch_private.internal_awareness WHERE id=oid AND organization_id=org) END;
  IF NOT dispatch_private.record_access(target,'internal.share') THEN RAISE EXCEPTION 'share source forbidden'; END IF;
 END IF;
 IF p_command IN('submit_projection_candidate','approve_projection','reject_projection','publish_projection','withdraw_projection') THEN
  target:=CASE WHEN p_command='submit_projection_candidate' THEN (p_payload->>'record_id')::uuid WHEN p_command='withdraw_projection' THEN
   (SELECT c.source_record_id FROM dispatch_projection.projection_candidates c JOIN dispatch_projection.public_safe_projections p ON p.candidate_id=c.id WHERE p.id=oid AND c.organization_id=org)
   ELSE (SELECT source_record_id FROM dispatch_projection.projection_candidates WHERE id=oid AND organization_id=org) END;
  IF NOT dispatch_private.record_access(target,permission) THEN RAISE EXCEPTION 'projection source forbidden'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k::text,0));
 SELECT * INTO old FROM dispatch_audit.command_receipts WHERE organization_id=org AND actor_user_id=a AND command_name=p_command AND idempotency_key=k;
 IF FOUND THEN
  IF old.request_hash<>h THEN RAISE EXCEPTION 'idempotency payload mismatch'; END IF;
  -- Ownership approvals are single-use security decisions, not repeatable acceptances.
  IF p_command IN('approve_ownership_recovery','accept_ownership_transfer') THEN RAISE EXCEPTION 'approval consumed'; END IF;
  RETURN old.result_payload||jsonb_build_object('replay',true);
 END IF;
 IF p_command IN('update_operational_record','assign_operational_record') AND record.status IN('CLOSED','CANCELLED') THEN RAISE EXCEPTION 'terminal record'; END IF;
 IF p_command='close_operational_record' AND NOT dispatch_private.lifecycle_allowed(record.status,'CLOSED') THEN RAISE EXCEPTION 'illegal transition'; END IF;
 IF p_command IN('revoke_invitation','accept_invitation') THEN
  SELECT revision INTO v FROM dispatch_private.organization_invitations WHERE id=oid AND organization_id=org;
  IF NOT FOUND OR expected IS DISTINCT FROM v THEN RAISE EXCEPTION 'stale invitation'; END IF;
 END IF;
 IF p_command IN('approve_projection','reject_projection','publish_projection') THEN
  SELECT revision INTO v FROM dispatch_projection.projection_candidates WHERE id=oid AND organization_id=org;
  IF NOT FOUND OR expected IS DISTINCT FROM v THEN RAISE EXCEPTION 'stale projection'; END IF;
 END IF;
 IF p_command='withdraw_projection' THEN
  SELECT projection_revision INTO v FROM dispatch_projection.public_safe_projections WHERE id=oid AND withdrawn_at IS NULL;
  IF NOT FOUND OR expected IS DISTINCT FROM v THEN RAISE EXCEPTION 'stale public projection'; END IF;
 END IF;
 IF p_command='invite_member' AND p_payload->>'role'='OWNER' THEN RAISE EXCEPTION 'ownership transfer required'; END IF;
 IF p_command IN('advance_onboarding','set_unit_membership','offboard_unit') AND EXISTS(SELECT 1 FROM dispatch_private.organization_units WHERE id=(p_payload->>'unit_id')::uuid AND status='OFFBOARDED') THEN RAISE EXCEPTION 'terminal unit'; END IF;
 IF p_command IN('set_organization_status','set_organization_verification') AND EXISTS(SELECT 1 FROM dispatch_private.organizations WHERE id=org AND status='CLOSED') THEN RAISE EXCEPTION 'terminal organization'; END IF;

 IF p_command IN('start_ownership_recovery','approve_ownership_recovery') THEN
  IF NOT dispatch_private.fresh_totp(300) THEN RAISE EXCEPTION 'fresh TOTP required'; END IF;
  SELECT governance_revision INTO v FROM dispatch_private.organizations WHERE id=org AND status='ACTIVE';
  IF NOT FOUND OR expected IS DISTINCT FROM v THEN RAISE EXCEPTION 'stale organization'; END IF;
  target:=(p_payload->>'target_membership_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships m JOIN dispatch_private.profiles p ON p.user_id=m.user_id WHERE m.id=target AND m.organization_id=org AND m.status='ACTIVE' AND p.status='ACTIVE') THEN RAISE EXCEPTION 'invalid recovery target'; END IF;
  IF p_command='start_ownership_recovery' THEN
   oid:=coalesce(oid,extensions.gen_random_uuid());
   INSERT INTO dispatch_private.ownership_recovery_cases(id,organization_id,target_membership_id,organization_revision) VALUES(oid,org,target,v);
  ELSE
   SELECT * INTO recovery FROM dispatch_private.ownership_recovery_cases WHERE id=oid AND organization_id=org FOR UPDATE;
   IF NOT FOUND OR recovery.status<>'FIRST_APPROVED' OR recovery.revision IS DISTINCT FROM (p_payload->>'case_revision')::int OR recovery.organization_revision<>v OR recovery.target_membership_id<>target THEN RAISE EXCEPTION 'changed recovery case'; END IF;
   IF EXISTS(SELECT 1 FROM dispatch_private.approval_proofs WHERE operation_id=oid AND actor_id=a) THEN RAISE EXCEPTION 'distinct approvers required'; END IF;
  END IF;
  bind:=jsonb_build_object('case',oid,'organization',org,'target',target,'target_actor',(SELECT user_id FROM dispatch_private.organization_memberships WHERE id=target),'org_revision',v,'case_revision',1);
  IF EXISTS(SELECT 1 FROM dispatch_private.approval_proofs WHERE operation_id=oid AND binding<>bind) THEN RAISE EXCEPTION 'approval binding changed'; END IF;
  PERFORM dispatch_private.check_proof(oid,org,'RECOVERY',bind,(p_payload->>'factor_id')::uuid);
  INSERT INTO dispatch_private.recovery_approvals(case_id,user_id,session_id,created_at,actor_token) VALUES(oid,a,dispatch_private.current_session_id(),now(),dispatch_private.token_for(org,a));
  IF p_command='approve_ownership_recovery' THEN
   IF (SELECT count(*) FROM dispatch_private.approval_proofs WHERE operation_id=oid)<>2 THEN RAISE EXCEPTION 'two approvals required'; END IF;
   UPDATE dispatch_private.organization_memberships SET role_template='ORGANIZATION_ADMIN',revision=revision+1 WHERE organization_id=org AND role_template='OWNER' AND status='ACTIVE';
   UPDATE dispatch_private.organization_memberships SET role_template='OWNER',revision=revision+1 WHERE id=target;
   UPDATE dispatch_private.organizations SET governance_revision=governance_revision+1 WHERE id=org;
   UPDATE dispatch_private.ownership_recovery_cases SET status='RECOVERED',revision=revision+1 WHERE id=oid;
  END IF;
 ELSIF p_command IN('initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer') THEN
  IF NOT dispatch_private.fresh_totp(600) THEN RAISE EXCEPTION 'fresh TOTP required'; END IF;
  SELECT governance_revision INTO v FROM dispatch_private.organizations WHERE id=org;
  IF expected IS DISTINCT FROM v THEN RAISE EXCEPTION 'stale organization'; END IF;
  mid:=dispatch_private.actor_membership(org,permission);
  IF p_command='initiate_ownership_transfer' THEN
   target:=(p_payload->>'to_membership_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships WHERE id=mid AND role_template='OWNER') OR NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships m JOIN dispatch_private.profiles p ON p.user_id=m.user_id WHERE m.id=target AND m.organization_id=org AND m.status='ACTIVE' AND m.user_id<>a AND p.status='ACTIVE') THEN RAISE EXCEPTION 'invalid transfer target'; END IF;
   oid:=coalesce(oid,extensions.gen_random_uuid());
   INSERT INTO dispatch_private.ownership_transfers(id,organization_id,from_membership_id,to_membership_id,expected_org_revision) VALUES(oid,org,mid,target,v);
   bind:=jsonb_build_object('transfer',oid,'organization',org,'from',mid,'to',target,'from_actor',a,'to_actor',(SELECT user_id FROM dispatch_private.organization_memberships WHERE id=target),'revision',v);
   PERFORM dispatch_private.check_proof(oid,org,'TRANSFER',bind,(p_payload->>'factor_id')::uuid);
  ELSE
   SELECT * INTO transfer FROM dispatch_private.ownership_transfers WHERE id=oid AND organization_id=org FOR UPDATE;
   IF NOT FOUND OR transfer.status<>'PENDING' OR transfer.expected_org_revision<>v OR transfer.revision IS DISTINCT FROM (p_payload->>'transfer_revision')::int THEN RAISE EXCEPTION 'changed transfer'; END IF;
   IF p_command='cancel_ownership_transfer' THEN
    IF mid<>transfer.from_membership_id THEN RAISE EXCEPTION 'initiator required'; END IF;
    UPDATE dispatch_private.ownership_transfers SET status='CANCELLED',revision=revision+1 WHERE id=oid;
   ELSE
    IF mid<>transfer.to_membership_id OR mid=transfer.from_membership_id OR NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships WHERE id=transfer.from_membership_id AND organization_id=org AND role_template='OWNER' AND status='ACTIVE') THEN RAISE EXCEPTION 'transfer relationship changed'; END IF;
    bind:=jsonb_build_object('transfer',oid,'organization',org,'from',transfer.from_membership_id,'to',mid,'from_actor',(SELECT user_id FROM dispatch_private.organization_memberships WHERE id=transfer.from_membership_id),'to_actor',a,'revision',v);
    IF NOT EXISTS(SELECT 1 FROM dispatch_private.approval_proofs WHERE operation_id=oid AND binding=bind) THEN RAISE EXCEPTION 'transfer binding changed'; END IF;
    PERFORM dispatch_private.check_proof(oid,org,'TRANSFER',bind,(p_payload->>'factor_id')::uuid);
    UPDATE dispatch_private.organization_memberships SET role_template='ORGANIZATION_ADMIN',revision=revision+1 WHERE id=transfer.from_membership_id;
    UPDATE dispatch_private.organization_memberships SET role_template='OWNER',revision=revision+1 WHERE id=mid;
    UPDATE dispatch_private.ownership_transfers SET status='ACCEPTED',revision=revision+1 WHERE id=oid;
    UPDATE dispatch_private.organizations SET governance_revision=governance_revision+1 WHERE id=org;
   END IF;
  END IF;
 ELSIF p_command='transition_operational_record' THEN
  state:=(p_payload->>'state')::dispatch_private.record_status;
  IF expected IS DISTINCT FROM record.current_revision OR NOT dispatch_private.lifecycle_allowed(record.status,state) THEN RAISE EXCEPTION 'illegal or stale transition'; END IF;
  UPDATE dispatch_private.operational_records SET status=state,current_revision=current_revision+1 WHERE id=oid;
  INSERT INTO dispatch_audit.record_revisions(organization_id,record_id,revision_number,snapshot,actor_user_id,actor_token) SELECT org,oid,current_revision,to_jsonb(r),a,dispatch_private.token_for(org,a) FROM dispatch_private.operational_records r WHERE id=oid;
  INSERT INTO dispatch_private.record_provenance(organization_id,record_id,revision_number,source_class,owning_unit_id,actor_token) SELECT org,oid,current_revision,'PRIVATE_OPERATIONAL',owning_unit_id,dispatch_private.token_for(org,a) FROM dispatch_private.operational_records WHERE id=oid;
 ELSIF p_command='grant_capability' THEN
  IF p_payload->>'capability' IS NULL OR p_payload->>'capability' NOT IN('awareness.condition.publish','awareness.planned_work.publish','awareness.official_notice.publish') THEN RAISE EXCEPTION 'pilot capability disabled'; END IF;
  IF (p_payload->>'valid_until')::timestamptz IS NULL OR (p_payload->>'valid_until')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+interval '90 days' THEN RAISE EXCEPTION 'pilot grant duration'; END IF;
  SELECT s.version INTO v FROM dispatch_private.operational_scopes s JOIN dispatch_private.scope_governance g ON g.scope_id=s.id AND g.organization_id=s.organization_id WHERE s.id=(p_payload->>'scope_id')::uuid AND s.organization_id=org AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND g.valid_until>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'governed scope required'; END IF;
  oid:=coalesce(oid,extensions.gen_random_uuid());
  INSERT INTO dispatch_private.capability_grants(id,organization_id,capability_key,operational_scope_id,operational_scope_version,status,valid_until,granted_by_platform_actor,actor_token) VALUES(oid,org,p_payload->>'capability',(p_payload->>'scope_id')::uuid,v,'ACTIVE',(p_payload->>'valid_until')::timestamptz,a,dispatch_private.token_for(org,a));
 ELSIF p_command='renew_capability' THEN
  SELECT * INTO grantrow FROM dispatch_private.capability_grants WHERE id=oid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR expected IS DISTINCT FROM grantrow.revision OR grantrow.status<>'ACTIVE' OR grantrow.capability_key NOT IN('awareness.condition.publish','awareness.planned_work.publish','awareness.official_notice.publish') THEN RAISE EXCEPTION 'capability not renewable'; END IF;
  IF (p_payload ? 'scope_id' AND (p_payload->>'scope_id')::uuid IS DISTINCT FROM grantrow.operational_scope_id) OR (p_payload ? 'capability' AND p_payload->>'capability' IS DISTINCT FROM grantrow.capability_key) THEN RAISE EXCEPTION 'renewal cannot widen authority'; END IF;
  IF (p_payload->>'valid_until')::timestamptz IS NULL OR (p_payload->>'valid_until')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+interval '90 days' THEN RAISE EXCEPTION 'renewal duration'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.pilot_governance g JOIN dispatch_private.organizations o ON o.id=g.organization_id JOIN dispatch_private.scope_governance sg ON sg.organization_id=o.id JOIN dispatch_private.operational_scopes s ON s.id=sg.scope_id WHERE o.id=org AND o.status='ACTIVE' AND o.verification_level='VERIFIED_PUBLIC_ENTITY' AND g.verification_expires_at>now() AND g.attestation_expires_at>now() AND sg.scope_id=grantrow.operational_scope_id AND sg.valid_until>now() AND s.status='ACTIVE' AND s.version=grantrow.operational_scope_version AND (s.valid_until IS NULL OR s.valid_until>now())) THEN RAISE EXCEPTION 'renewal governance expired'; END IF;
  UPDATE dispatch_private.capability_grants SET valid_from=now(),valid_until=(p_payload->>'valid_until')::timestamptz,revision=revision+1 WHERE id=oid;
 ELSIF p_command IN('renew_verification','renew_attestation') THEN
  oid:=org;
  SELECT revision INTO v FROM dispatch_private.pilot_governance WHERE organization_id=org FOR UPDATE;
  IF NOT FOUND OR expected IS DISTINCT FROM v OR coalesce(p_payload->>'evidence_source','')='' OR coalesce(p_payload->>'evidence_version','')='' THEN RAISE EXCEPTION 'renewal evidence/revision required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.organizations WHERE id=org AND status='ACTIVE' AND verification_level='VERIFIED_PUBLIC_ENTITY') THEN RAISE EXCEPTION 'verified public entity required'; END IF;
  IF (p_payload->>'valid_until')::timestamptz IS NULL OR (p_payload->>'valid_until')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+(CASE p_command WHEN 'renew_verification' THEN interval '1 year' ELSE interval '6 months' END) THEN RAISE EXCEPTION 'renewal duration'; END IF;
  UPDATE dispatch_private.pilot_governance SET verification_expires_at=CASE WHEN p_command='renew_verification' THEN (p_payload->>'valid_until')::timestamptz ELSE verification_expires_at END,attestation_expires_at=CASE WHEN p_command='renew_attestation' THEN (p_payload->>'valid_until')::timestamptz ELSE attestation_expires_at END,governance_source=p_payload->>'evidence_source',governance_version=p_payload->>'evidence_version',revision=revision+1 WHERE organization_id=org;
 ELSIF p_command IN('set_organization_status','set_organization_verification') THEN
  oid:=org;
  IF expected IS DISTINCT FROM (SELECT governance_revision FROM dispatch_private.organizations WHERE id=org) THEN RAISE EXCEPTION 'stale organization revision'; END IF;
  IF p_command='set_organization_status' THEN
   IF p_payload->>'status'='CLOSED' THEN RAISE EXCEPTION 'use organization offboarding'; END IF;
   UPDATE dispatch_private.organizations SET status=(p_payload->>'status')::dispatch_private.organization_status,governance_revision=governance_revision+1 WHERE id=org;
  ELSE UPDATE dispatch_private.organizations SET verification_level=(p_payload->>'verification_level')::dispatch_private.verification_level,governance_revision=governance_revision+1 WHERE id=org; END IF;
 ELSIF p_command='offboard_organization' THEN
  oid:=org;
  IF expected IS DISTINCT FROM (SELECT governance_revision FROM dispatch_private.organizations WHERE id=org) OR EXISTS(SELECT 1 FROM dispatch_private.organizations WHERE id=org AND status='CLOSED') THEN RAISE EXCEPTION 'stale or closed organization'; END IF;
  UPDATE dispatch_private.organization_memberships SET status='REVOKED',revision=revision+1 WHERE organization_id=org;
  UPDATE dispatch_private.unit_memberships SET status='REVOKED',revision=revision+1 WHERE organization_id=org;
  UPDATE dispatch_private.organization_units SET status='OFFBOARDED',onboarding_state='OFFBOARDED',revision=revision+1 WHERE organization_id=org;
  UPDATE dispatch_private.capability_grants SET status='REVOKED',revision=revision+1 WHERE organization_id=org;
  UPDATE dispatch_private.organization_invitations SET status='REVOKED',revision=revision+1,revoked_at=now() WHERE organization_id=org AND status='PENDING';
  UPDATE dispatch_private.internal_awareness SET revoked_at=now(),revision=revision+1 WHERE organization_id=org;
  DELETE FROM dispatch_private.internal_share_recipients WHERE organization_id=org;
  UPDATE dispatch_private.pilot_governance SET publishing_enabled=false,revision=revision+1 WHERE organization_id=org;
  UPDATE dispatch_private.organizations SET status='CLOSED',verification_level='UNVERIFIED',governance_revision=governance_revision+1 WHERE id=org;
 ELSIF p_command='begin_user_offboarding' THEN
  target:=(p_payload->>'user_id')::uuid;
  IF target IS NULL OR target=a OR NOT EXISTS(SELECT 1 FROM dispatch_private.profiles WHERE user_id=target) THEN RAISE EXCEPTION 'invalid offboarding subject'; END IF;
  IF EXISTS(SELECT 1 FROM dispatch_private.organization_memberships m JOIN dispatch_private.organizations o ON o.id=m.organization_id WHERE m.user_id=target AND m.status='ACTIVE' AND m.role_template='OWNER' AND o.status<>'CLOSED') THEN RAISE EXCEPTION 'transfer ownership before user offboarding'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.organization_memberships WHERE user_id=target AND organization_id=org) THEN RAISE EXCEPTION 'subject organization mismatch'; END IF;
  oid:=coalesce(oid,extensions.gen_random_uuid());
  INSERT INTO dispatch_private.user_offboarding(id,organization_id,target_user_id) VALUES(oid,org,target);
  UPDATE dispatch_private.profiles SET status='DISABLED' WHERE user_id=target;
 ELSIF p_command='complete_user_offboarding' THEN
  SELECT * INTO job FROM dispatch_private.user_offboarding WHERE id=oid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR job.status<>'AUTH_REVOCATION_REQUIRED' OR expected IS DISTINCT FROM job.revision THEN RAISE EXCEPTION 'stale offboarding'; END IF;
  INSERT INTO dispatch_private.auth_check_context VALUES(txid_current(),oid,'ERASURE');
  IF NOT dispatch_private.has_live_aal2() THEN RAISE EXCEPTION 'Auth deletion/session/factor revocation must finish first'; END IF;
  DELETE FROM dispatch_private.auth_check_context WHERE transaction_id=txid_current();
  PERFORM dispatch_private.pseudonymize_user(job.target_user_id);
  UPDATE dispatch_private.user_offboarding SET target_user_id=NULL,status='COMPLETE',completed_at=now(),revision=revision+1 WHERE id=oid;
 ELSE
  result:=dispatch_private.phase28_partial_command(p_command,p_payload);
  oid:=(result->>'object_id')::uuid;
  IF p_command IN('revoke_invitation','accept_invitation') THEN UPDATE dispatch_private.organization_invitations SET revision=revision+1 WHERE id=oid; END IF;
  IF p_command IN('approve_projection','reject_projection','publish_projection') THEN UPDATE dispatch_projection.projection_candidates SET revision=revision+1 WHERE id=(p_payload->>'object_id')::uuid; END IF;
  IF p_command='withdraw_projection' THEN UPDATE dispatch_projection.public_safe_projections SET projection_revision=projection_revision+1 WHERE id=oid; END IF;
 END IF;
 t:=dispatch_private.token_for(org,a);
 IF special THEN
  result:=jsonb_build_object('object_id',oid,'replay',false);
  INSERT INTO dispatch_audit.command_receipts(organization_id,actor_user_id,session_id,command_name,idempotency_key,request_hash,result_payload,actor_token) VALUES(org,a,dispatch_private.current_session_id(),p_command,k,h,result,t);
  INSERT INTO dispatch_audit.audit_events(organization_id,actor_user_id,event_type,target_id,event_payload,actor_token) VALUES(org,a,'SETTINGS_CHANGED',oid,jsonb_build_object('command',p_command,'expected_revision',expected,'evidence_source',p_payload->>'evidence_source','evidence_version',p_payload->>'evidence_version','valid_until',p_payload->>'valid_until'),t);
  INSERT INTO dispatch_audit.pilot_events(organization_id,actor_token,command_name,target_id,revision,payload) VALUES(org,t,p_command,oid,expected,jsonb_build_object('request_hash',encode(h,'hex')));
 END IF;
 v:=CASE
 WHEN p_command IN('create_operational_record','update_operational_record','assign_operational_record','close_operational_record','transition_operational_record') THEN (SELECT current_revision FROM dispatch_private.operational_records WHERE id=oid)
 WHEN p_command IN('create_unit','set_unit_membership','advance_onboarding','offboard_unit') THEN (SELECT revision FROM dispatch_private.organization_units WHERE id=oid)
 WHEN p_command IN('change_member_role','suspend_member','reactivate_member','revoke_member') THEN (SELECT revision FROM dispatch_private.organization_memberships WHERE id=oid)
 WHEN p_command IN('invite_member','accept_invitation','revoke_invitation') THEN (SELECT revision FROM dispatch_private.organization_invitations WHERE id=oid)
 WHEN p_command IN('grant_capability','renew_capability','suspend_capability','revoke_capability') THEN (SELECT revision FROM dispatch_private.capability_grants WHERE id=oid)
 WHEN p_command IN('submit_projection_candidate','approve_projection','reject_projection') THEN (SELECT revision FROM dispatch_projection.projection_candidates WHERE id=oid)
 WHEN p_command IN('publish_projection','withdraw_projection') THEN (SELECT projection_revision FROM dispatch_projection.public_safe_projections WHERE id=oid)
 WHEN p_command IN('set_organization_status','set_organization_verification','offboard_organization') THEN (SELECT governance_revision FROM dispatch_private.organizations WHERE id=org)
 WHEN p_command IN('renew_verification','renew_attestation') THEN (SELECT revision FROM dispatch_private.pilot_governance WHERE organization_id=org)
 WHEN p_command IN('start_ownership_recovery','approve_ownership_recovery') THEN (SELECT revision FROM dispatch_private.ownership_recovery_cases WHERE id=oid)
 WHEN p_command IN('initiate_ownership_transfer','accept_ownership_transfer','cancel_ownership_transfer') THEN (SELECT revision FROM dispatch_private.ownership_transfers WHERE id=oid)
 WHEN p_command IN('begin_user_offboarding','complete_user_offboarding') THEN (SELECT revision FROM dispatch_private.user_offboarding WHERE id=oid)
 WHEN p_command IN('create_internal_share','replace_internal_share_recipients','revoke_internal_share') THEN (SELECT revision FROM dispatch_private.internal_awareness WHERE id=oid)
 END;
 INSERT INTO dispatch_audit.command_versions(organization_id,command_name,object_id,expected_revision,revision,actor_token) VALUES(org,p_command,oid,expected,v,t);
 RETURN result;
END $$;

-- Pseudonymization is an explicit, constrained transformation of retained evidence.
-- It never deletes event/revision/receipt rows. The trigger permits only this exact
-- actor substitution while the protected transaction context names the subject.
CREATE OR REPLACE FUNCTION dispatch_private.reject_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE subject uuid; token uuid; expected jsonb; BEGIN
 SELECT user_id INTO subject FROM dispatch_private.erasure_context WHERE transaction_id=txid_current();
 IF TG_OP='UPDATE' AND subject IS NOT NULL THEN
  SELECT t.token INTO token FROM dispatch_private.actor_tokens t WHERE t.organization_id=(to_jsonb(OLD)->>'organization_id')::uuid AND t.user_id=subject;
  expected:=dispatch_private.erase_json(to_jsonb(OLD),subject,token);
  IF to_jsonb(OLD)->>'actor_user_id'=subject::text THEN expected:=jsonb_set(jsonb_set(expected,'{actor_user_id}','null'),'{actor_token}',to_jsonb(token)); END IF;
  IF TG_TABLE_NAME='command_receipts' AND to_jsonb(OLD)->>'actor_user_id'=subject::text THEN expected:=jsonb_set(expected,'{session_id}','null'); END IF;
  IF to_jsonb(NEW)=expected THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'append-only';
END $$;

CREATE FUNCTION dispatch_private.pseudonymize_user(subject uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry record; token uuid; BEGIN
 INSERT INTO dispatch_private.erasure_context VALUES(txid_current(),subject);
 FOR entry IN SELECT id FROM dispatch_private.organizations LOOP
  token:=dispatch_private.token_for(entry.id,subject);
  UPDATE dispatch_audit.record_revisions SET actor_token=CASE WHEN actor_user_id=subject THEN token ELSE actor_token END,actor_user_id=CASE WHEN actor_user_id=subject THEN NULL ELSE actor_user_id END,snapshot=dispatch_private.erase_json(snapshot,subject,token) WHERE organization_id=entry.id;
  UPDATE dispatch_audit.audit_events SET actor_token=CASE WHEN actor_user_id=subject THEN token ELSE actor_token END,actor_user_id=CASE WHEN actor_user_id=subject THEN NULL ELSE actor_user_id END,target_id=CASE WHEN target_id=subject THEN token ELSE target_id END,event_payload=dispatch_private.erase_json(event_payload,subject,token) WHERE organization_id=entry.id;
  UPDATE dispatch_audit.command_receipts SET actor_token=CASE WHEN actor_user_id=subject THEN token ELSE actor_token END,session_id=CASE WHEN actor_user_id=subject THEN NULL ELSE session_id END,actor_user_id=CASE WHEN actor_user_id=subject THEN NULL ELSE actor_user_id END,result_payload=dispatch_private.erase_json(result_payload,subject,token) WHERE organization_id=entry.id;
  UPDATE dispatch_audit.pilot_events SET payload=dispatch_private.erase_json(payload,subject,token) WHERE organization_id=entry.id;
  UPDATE dispatch_private.organization_memberships SET actor_token=token,user_id=NULL,status='REVOKED',revision=revision+1 WHERE organization_id=entry.id AND user_id=subject;
  UPDATE dispatch_private.capability_grants SET actor_token=token,granted_by_platform_actor=NULL WHERE organization_id=entry.id AND granted_by_platform_actor=subject;
  UPDATE dispatch_projection.projection_candidates SET actor_token=token,requested_by_user_id=NULL WHERE organization_id=entry.id AND requested_by_user_id=subject;
  UPDATE dispatch_private.organization_invitations SET target_identity='actor:'||token::text,status=CASE WHEN status='PENDING' THEN 'REVOKED'::dispatch_private.invitation_status ELSE status END,token_digest=extensions.digest(token::text||id::text,'sha256'),revision=revision+1 WHERE organization_id=entry.id AND target_identity='user:'||subject::text;
  UPDATE dispatch_private.recovery_approvals SET actor_token=token,user_id=NULL,session_id=NULL WHERE user_id=subject AND case_id IN(SELECT id FROM dispatch_private.ownership_recovery_cases WHERE organization_id=entry.id);
  UPDATE dispatch_private.approval_proofs SET binding=dispatch_private.erase_json(binding,subject,token) WHERE organization_id=entry.id;
 END LOOP;
 UPDATE dispatch_private.unit_memberships SET status='REVOKED',revision=revision+1 WHERE membership_id IN(SELECT id FROM dispatch_private.organization_memberships WHERE user_id IS NULL AND status='REVOKED');
 -- Platform grants are mutable authority, not historical evidence. Their decisions
 -- remain in immutable scoped events; no identity-bearing grant survives erasure.
 DELETE FROM dispatch_private.platform_admin_grants WHERE user_id=subject;
 UPDATE dispatch_private.platform_admin_grants SET granted_by_user_id=NULL,grantor_token=extensions.gen_random_uuid() WHERE granted_by_user_id=subject;
 UPDATE dispatch_private.approval_proofs SET actor_id=NULL,session_id=NULL,factor_id=NULL WHERE actor_id=subject;
 DELETE FROM dispatch_private.actor_tokens WHERE user_id=subject;
 DELETE FROM dispatch_private.profiles WHERE user_id=subject;
 DELETE FROM dispatch_private.erasure_context WHERE transaction_id=txid_current();
END $$;

DO $api$ DECLARE name text; BEGIN FOREACH name IN ARRAY ARRAY['transition_operational_record','renew_capability','renew_verification','renew_attestation','offboard_organization','begin_user_offboarding','complete_user_offboarding'] LOOP
 EXECUTE format('CREATE FUNCTION dispatch_api.%I(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $f$ SELECT dispatch_private.execute_command(%L,p_payload) $f$',name,name);
END LOOP; END $api$;
GRANT CREATE ON SCHEMA dispatch_private TO dispatch_function_owner;
DO $owners$ DECLARE f regprocedure; BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname<>'has_live_aal2' LOOP EXECUTE format('ALTER FUNCTION %s OWNER TO dispatch_function_owner',f); END LOOP; END $owners$;
REVOKE CREATE ON SCHEMA dispatch_private FROM dispatch_function_owner;
DO $rls$ DECLARE t regclass; BEGIN FOR t IN SELECT c.oid::regclass FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r' LOOP EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t); END LOOP; END $rls$;
GRANT SELECT,INSERT,DELETE ON dispatch_private.auth_check_context,dispatch_private.erasure_context TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.approval_proofs TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.user_offboarding TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_audit.command_versions TO dispatch_function_owner;
GRANT INSERT,UPDATE ON dispatch_private.ownership_recovery_cases,dispatch_private.recovery_approvals TO dispatch_function_owner;
GRANT UPDATE ON dispatch_private.pilot_governance,dispatch_private.profiles,dispatch_audit.record_revisions,dispatch_audit.command_receipts,dispatch_audit.audit_events,dispatch_audit.pilot_events TO dispatch_function_owner;
GRANT DELETE ON dispatch_private.platform_admin_grants,dispatch_private.actor_tokens,dispatch_private.profiles TO dispatch_function_owner;
GRANT UPDATE ON dispatch_private.platform_admin_grants TO dispatch_function_owner;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.has_live_aal2(),dispatch_private.current_actor_id(),dispatch_private.current_session_id(),dispatch_private.current_claims(),dispatch_private.unit_access(uuid,uuid,text),dispatch_private.record_access(uuid,text),dispatch_private.internal_access(uuid),dispatch_private.execute_command(text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_private.has_live_aal2() TO dispatch_function_owner;
GRANT EXECUTE ON FUNCTION dispatch_private.projection_eligible(uuid) TO anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_api FROM PUBLIC,anon,service_role;
DO $grants$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_api' AND p.prokind='f' LOOP
 EXECUTE format('CREATE OR REPLACE FUNCTION dispatch_api.%I(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='''' AS $f$ SELECT dispatch_private.execute_command(%L,p_payload) $f$',f.proname,f.proname);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
END LOOP; END $grants$;
GRANT EXECUTE ON FUNCTION dispatch_private.current_session_id(),dispatch_private.current_claims() TO postgres;
REVOKE dispatch_function_owner FROM postgres;
NOTIFY pgrst,'reload schema';


-- PHASE C
GRANT dispatch_function_owner TO postgres;
-- Phase prerequisite independently checked by installer A and single transaction.

CREATE TABLE dispatch_private.report_contract_versions(version text PRIMARY KEY,contract_hash text NOT NULL CHECK(contract_hash ~ '^[a-f0-9]{64}$'),policy_version text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),publishing_enabled boolean NOT NULL DEFAULT false);
CREATE TABLE dispatch_private.report_families(code text PRIMARY KEY);
CREATE TABLE dispatch_private.report_subtypes(code text PRIMARY KEY,family text NOT NULL REFERENCES dispatch_private.report_families,public_eligible boolean NOT NULL,hazard_required boolean NOT NULL DEFAULT false,contract_version text NOT NULL REFERENCES dispatch_private.report_contract_versions);
CREATE TABLE dispatch_private.department_report_policies(department text NOT NULL CHECK(department IN('POLICE','FIRE','EMS','PUBLIC_WORKS')),subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,internal_allowed boolean NOT NULL DEFAULT false,public_allowed boolean NOT NULL DEFAULT false,evidence_class text NOT NULL CHECK(evidence_class IN('N','R','X','U','INTERNAL')),contract_version text NOT NULL REFERENCES dispatch_private.report_contract_versions,PRIMARY KEY(department,subtype),CHECK(NOT public_allowed OR internal_allowed));
CREATE TABLE dispatch_private.capability_catalog(capability_key text PRIMARY KEY,subtype text REFERENCES dispatch_private.report_subtypes,legacy boolean NOT NULL,high_risk_gate boolean NOT NULL DEFAULT false,CHECK(NOT legacy OR subtype IS NULL));
CREATE TABLE dispatch_private.capability_requirements(subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,capability_key text NOT NULL REFERENCES dispatch_private.capability_catalog,requirement text NOT NULL CHECK(requirement IN('ALWAYS','HAZARD','FULL_CLOSURE')),PRIMARY KEY(subtype,capability_key));
ALTER TABLE dispatch_private.capability_grants DROP CONSTRAINT capability_grants_capability_key_check;
ALTER TABLE dispatch_private.capability_grants ADD CONSTRAINT capability_grants_catalog_fk FOREIGN KEY(capability_key) REFERENCES dispatch_private.capability_catalog DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE dispatch_private.capability_grant_constraints(grant_id uuid PRIMARY KEY,organization_id uuid NOT NULL,scope_id uuid NOT NULL,scope_version integer NOT NULL,subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,closure_envelope text[] NOT NULL CHECK(cardinality(closure_envelope)>0 AND closure_envelope<@ARRAY['NONE','PARTIAL','FULL','UNKNOWN']),lane_envelope text[] NOT NULL CHECK(cardinality(lane_envelope)>0 AND lane_envelope<@ARRAY['NONE','ONE','MULTIPLE','ALL','UNKNOWN']),allowed_timing text[] NOT NULL CHECK(cardinality(allowed_timing)>0 AND allowed_timing<@ARRAY['PLANNED','UNPLANNED']),review_policy text NOT NULL CHECK(review_policy='PHASE29-INDEPENDENT-v1'),authority_evidence text NOT NULL CHECK(length(authority_evidence) BETWEEN 1 AND 200),evidence_class text NOT NULL CHECK(evidence_class IN('N','R','X','U')),renewal_revision integer NOT NULL DEFAULT 0,FOREIGN KEY(organization_id,grant_id) REFERENCES dispatch_private.capability_grants(organization_id,id),FOREIGN KEY(organization_id,scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id),FOREIGN KEY(scope_id,scope_version) REFERENCES dispatch_private.operational_scopes(id,version),UNIQUE(organization_id,grant_id));
CREATE TABLE dispatch_private.capability_grant_units(organization_id uuid NOT NULL,grant_id uuid NOT NULL,unit_id uuid NOT NULL,PRIMARY KEY(grant_id,unit_id),FOREIGN KEY(organization_id,grant_id) REFERENCES dispatch_private.capability_grant_constraints(organization_id,grant_id),FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
CREATE TABLE dispatch_private.report_details(record_id uuid PRIMARY KEY,organization_id uuid NOT NULL,unit_id uuid NOT NULL,subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,contract_version text NOT NULL REFERENCES dispatch_private.report_contract_versions,source_revision integer NOT NULL,revision integer NOT NULL DEFAULT 1,timing text NOT NULL CHECK(timing IN('PLANNED','UNPLANNED')),hazard_declared boolean NOT NULL DEFAULT false,screening_state text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(screening_state IN('PENDING_REVIEW','APPROVED','REJECTED_PROHIBITED_CONTENT','QUARANTINED','REDACTED')),author_token uuid NOT NULL,subject text CHECK(length(subject) BETWEEN 1 AND 160),body text CHECK(length(body) BETWEEN 1 AND 1000),notice_effective_at timestamptz,notice_expires_at timestamptz,linked_record_id uuid REFERENCES dispatch_private.operational_records,correction_of uuid REFERENCES dispatch_private.operational_records,withdrawn_at timestamptz,FOREIGN KEY(organization_id,record_id,source_revision) REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number),FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id),CHECK(subtype<>'OFFICIAL_PUBLIC_NOTICE' OR (subject IS NOT NULL AND body IS NOT NULL AND notice_effective_at IS NOT NULL AND notice_expires_at>notice_effective_at)),UNIQUE(organization_id,record_id));
-- Governed geometry is explicit local evidence, never derived from client claims.
CREATE TABLE dispatch_private.report_scope_segments(id uuid PRIMARY KEY,organization_id uuid NOT NULL,scope_id uuid NOT NULL,scope_version integer NOT NULL,road_reference text NOT NULL,min_lat numeric NOT NULL,max_lat numeric NOT NULL,min_lon numeric NOT NULL,max_lon numeric NOT NULL,authority_evidence text NOT NULL,valid_until timestamptz NOT NULL,CHECK(min_lat>=-90 AND max_lat<=90 AND min_lat<=max_lat AND min_lon>=-180 AND max_lon<=180 AND min_lon<=max_lon),FOREIGN KEY(organization_id,scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id),FOREIGN KEY(scope_id,scope_version) REFERENCES dispatch_private.operational_scopes(id,version),UNIQUE(organization_id,id));
CREATE TABLE dispatch_private.road_impacts(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,record_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1,segment_id uuid,direction_affected text NOT NULL DEFAULT 'UNKNOWN' CHECK(direction_affected IN('NORTHBOUND','SOUTHBOUND','EASTBOUND','WESTBOUND','BOTH_DIRECTIONS','ALL_DIRECTIONS','NOT_APPLICABLE','UNKNOWN')),lane_extent text NOT NULL DEFAULT 'UNKNOWN' CHECK(lane_extent IN('NONE','ONE','MULTIPLE','ALL','UNKNOWN')),lanes_affected_count integer CHECK(lanes_affected_count>0),total_lanes_count integer CHECK(total_lanes_count>0),closure_extent text NOT NULL DEFAULT 'UNKNOWN' CHECK(closure_extent IN('NONE','PARTIAL','FULL','UNKNOWN')),traffic_operation text NOT NULL DEFAULT 'UNKNOWN' CHECK(traffic_operation IN('NORMAL','ALTERNATING','NARROWED','STOPPED','UNKNOWN')),public_passable text NOT NULL DEFAULT 'UNKNOWN' CHECK(public_passable IN('YES','NO','UNKNOWN')),emergency_vehicles_passable text NOT NULL DEFAULT 'UNKNOWN' CHECK(emergency_vehicles_passable IN('YES','NO','UNKNOWN')),start_lat numeric CHECK(start_lat BETWEEN -90 AND 90),start_lon numeric CHECK(start_lon BETWEEN -180 AND 180),end_lat numeric CHECK(end_lat BETWEEN -90 AND 90),end_lon numeric CHECK(end_lon BETWEEN -180 AND 180),duration_state text NOT NULL DEFAULT 'UNKNOWN' CHECK(duration_state IN('ESTIMATED','UNKNOWN')),estimated_end_at timestamptz,reason_subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,last_confirmed_at timestamptz NOT NULL DEFAULT statement_timestamp(),timing text NOT NULL CHECK(timing IN('PLANNED','UNPLANNED')),scheduled_start_at timestamptz,effective_start_at timestamptz,impact_status text NOT NULL CHECK(impact_status IN('SCHEDULED','ACTIVE','CLEARED','EXPIRED','CANCELLED')),valid_until timestamptz NOT NULL,FOREIGN KEY(organization_id,record_id) REFERENCES dispatch_private.report_details(organization_id,record_id),FOREIGN KEY(organization_id,segment_id) REFERENCES dispatch_private.report_scope_segments(organization_id,id),CHECK(lanes_affected_count IS NULL OR total_lanes_count IS NULL OR lanes_affected_count<=total_lanes_count),CHECK(lane_extent<>'ONE' OR lanes_affected_count IS NULL OR lanes_affected_count=1),CHECK(lane_extent<>'MULTIPLE' OR lanes_affected_count IS NULL OR lanes_affected_count>=2),CHECK(lane_extent<>'ALL' OR lanes_affected_count IS NULL OR total_lanes_count IS NULL OR lanes_affected_count=total_lanes_count),CHECK(closure_extent<>'FULL' OR (lane_extent='ALL' AND traffic_operation='STOPPED' AND public_passable='NO')),CHECK(traffic_operation<>'ALTERNATING' OR closure_extent='PARTIAL'),CHECK(duration_state<>'ESTIMATED' OR estimated_end_at IS NOT NULL),CHECK(duration_state<>'UNKNOWN' OR estimated_end_at IS NULL),CHECK(timing<>'PLANNED' OR scheduled_start_at IS NOT NULL),CHECK((start_lat IS NULL)=(start_lon IS NULL) AND (end_lat IS NULL)=(end_lon IS NULL)),CHECK((start_lat IS NULL AND end_lat IS NULL) OR segment_id IS NOT NULL),UNIQUE(organization_id,id));
CREATE INDEX phase29_impacts_record ON dispatch_private.road_impacts(record_id);
CREATE TABLE dispatch_private.road_impact_revisions(impact_id uuid NOT NULL REFERENCES dispatch_private.road_impacts,revision integer NOT NULL,record_id uuid NOT NULL REFERENCES dispatch_private.report_details,source_revision integer NOT NULL,actor_token uuid NOT NULL,snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(impact_id,revision));
CREATE TABLE dispatch_private.content_screening_decisions(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,record_id uuid REFERENCES dispatch_private.report_details,source_revision integer,state text NOT NULL CHECK(state IN('PENDING_REVIEW','APPROVED','REJECTED_PROHIBITED_CONTENT','QUARANTINED','REDACTED')),rule_version text NOT NULL CHECK(rule_version='PHASE29-SCREEN-v1'),content_digest bytea NOT NULL CHECK(octet_length(content_digest)=32),actor_token uuid NOT NULL,independent_reviewer_token uuid,created_at timestamptz NOT NULL DEFAULT now(),CHECK(state<>'APPROVED' OR (independent_reviewer_token IS NOT NULL AND independent_reviewer_token<>actor_token)));
-- Quarantine deliberately retains only an opaque digest and stable incident identity.
-- No rejected plaintext is stored in ordinary records, quarantine, receipts or logs.
CREATE TABLE dispatch_private.content_quarantine(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,screening_decision_id uuid NOT NULL REFERENCES dispatch_private.content_screening_decisions,record_id uuid REFERENCES dispatch_private.report_details,state text NOT NULL CHECK(state IN('QUARANTINED','REDACTED')),created_at timestamptz NOT NULL DEFAULT now(),redacted_at timestamptz,policy_reference text);
CREATE TABLE dispatch_audit.content_remediation_events(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,quarantine_id uuid NOT NULL REFERENCES dispatch_private.content_quarantine,record_id uuid REFERENCES dispatch_private.report_details,actor_token uuid NOT NULL,policy_reference text NOT NULL CHECK(length(policy_reference) BETWEEN 1 AND 200),event_type text NOT NULL CHECK(event_type IN('QUARANTINED','REDACTED')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_private.publication_reviews(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,record_id uuid NOT NULL,source_revision integer NOT NULL,details_revision integer NOT NULL,contract_version text NOT NULL REFERENCES dispatch_private.report_contract_versions,policy_version text NOT NULL CHECK(policy_version='PHASE29-INDEPENDENT-v1'),author_token uuid NOT NULL,reviewer_token uuid,state text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(state IN('PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN')),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 1000),grant_ids uuid[] NOT NULL CHECK(cardinality(grant_ids)>0),valid_until timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,FOREIGN KEY(organization_id,record_id,source_revision) REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number),CHECK(state<>'APPROVED' OR (reviewer_token IS NOT NULL AND reviewer_token<>author_token)),UNIQUE(organization_id,id));
CREATE TABLE dispatch_private.sharing_agreements(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),source_organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,recipient_organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,revision integer NOT NULL DEFAULT 1,scope_id uuid NOT NULL,scope_version integer NOT NULL,purpose text NOT NULL CHECK(length(purpose) BETWEEN 1 AND 200),allowed_subtypes text[] NOT NULL CHECK(cardinality(allowed_subtypes)>0),allowed_fields text[] NOT NULL CHECK(cardinality(allowed_fields)>0 AND allowed_fields<@ARRAY['title','summary','subtype','timing']),valid_from timestamptz NOT NULL DEFAULT now(),valid_until timestamptz NOT NULL,revoked_at timestamptz,onward_sharing boolean NOT NULL DEFAULT false CHECK(NOT onward_sharing),CHECK(source_organization_id<>recipient_organization_id),CHECK(valid_until>valid_from),FOREIGN KEY(source_organization_id,scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id),FOREIGN KEY(scope_id,scope_version) REFERENCES dispatch_private.operational_scopes(id,version));
CREATE TABLE dispatch_private.sharing_agreement_parties(agreement_id uuid NOT NULL REFERENCES dispatch_private.sharing_agreements,organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,agreement_revision integer NOT NULL,approver_membership_id uuid NOT NULL,approver_token uuid NOT NULL,approved_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(agreement_id,organization_id),FOREIGN KEY(organization_id,approver_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id));
CREATE TABLE dispatch_private.sharing_agreement_units(agreement_id uuid NOT NULL REFERENCES dispatch_private.sharing_agreements,organization_id uuid NOT NULL,unit_id uuid NOT NULL,PRIMARY KEY(agreement_id,unit_id),FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
CREATE TABLE dispatch_private.shared_awareness_representations(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,record_id uuid NOT NULL,source_revision integer NOT NULL,details_revision integer NOT NULL,agreement_id uuid REFERENCES dispatch_private.sharing_agreements,revision integer NOT NULL DEFAULT 1,author_token uuid NOT NULL,reviewer_token uuid NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 500),valid_until timestamptz NOT NULL,revoked_at timestamptz,CHECK(author_token<>reviewer_token),FOREIGN KEY(organization_id,record_id,source_revision) REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number),UNIQUE(organization_id,id));
CREATE TABLE dispatch_private.shared_awareness_recipients(share_id uuid NOT NULL REFERENCES dispatch_private.shared_awareness_representations,organization_id uuid NOT NULL,unit_id uuid NOT NULL,PRIMARY KEY(share_id,unit_id),FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
-- No new public API or public grants are installed before command certification.
-- The schema is intentionally inert until the reviewed command boundary is complete.
-- Seed/ACL/forced-RLS statements are generated from the hashed versioned registry.
-- Exact validators; no client-supplied identity, confirmation or geometry authority.
CREATE FUNCTION dispatch_private.report_department(p_unit uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$ SELECT CASE unit_type WHEN 'LAW_ENFORCEMENT' THEN 'POLICE' ELSE unit_type::text END FROM dispatch_private.organization_units WHERE id=p_unit $$;
CREATE FUNCTION dispatch_private.report_keys(p jsonb,allowed text[]) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$ BEGIN IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'PHASE29_UNEXPECTED_FIELDS'; END IF; END $$;
CREATE FUNCTION dispatch_private.report_screen(p jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT p::text ~* '(patient|diagnos|treatment|medical.record|clinical|symptom|prescription|medical.history|patient.destination|victim|witness|suspect|juvenile|cjis|ncic|tcic|informant|investigat|tactical|body.camera|criminal.history|protected.identity|confidential|transport.destination)' $$;
CREATE FUNCTION dispatch_private.report_impact_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ DECLARE s dispatch_private.report_scope_segments%ROWTYPE; d dispatch_private.report_details%ROWTYPE; BEGIN
 IF TG_OP='UPDATE' AND (OLD.impact_status IN('CLEARED','EXPIRED','CANCELLED') OR (OLD.impact_status='SCHEDULED' AND NEW.impact_status NOT IN('SCHEDULED','ACTIVE','EXPIRED','CANCELLED')) OR (OLD.impact_status='ACTIVE' AND NEW.impact_status NOT IN('ACTIVE','CLEARED','EXPIRED','CANCELLED'))) THEN RAISE EXCEPTION 'PHASE29_IMPACT_LIFECYCLE'; END IF;
 SELECT * INTO d FROM dispatch_private.report_details WHERE record_id=NEW.record_id;
 IF NEW.last_confirmed_at>statement_timestamp() OR NEW.valid_until<=statement_timestamp() OR NEW.valid_until>statement_timestamp()+interval '1 day' OR NEW.reason_subtype IS DISTINCT FROM d.subtype OR NEW.timing IS DISTINCT FROM d.timing THEN RAISE EXCEPTION 'PHASE29_IMPACT_TIME_OR_CAUSE'; END IF;
 IF NEW.estimated_end_at IS NOT NULL AND NEW.estimated_end_at<=coalesce(NEW.effective_start_at,NEW.scheduled_start_at,statement_timestamp()) THEN RAISE EXCEPTION 'PHASE29_ESTIMATE'; END IF;
 IF NEW.impact_status='ACTIVE' AND (NEW.effective_start_at IS NULL OR NEW.effective_start_at>statement_timestamp()) THEN RAISE EXCEPTION 'PHASE29_ACTIVATION'; END IF;
 IF NEW.impact_status='SCHEDULED' AND (NEW.timing<>'PLANNED' OR NEW.scheduled_start_at IS NULL) THEN RAISE EXCEPTION 'PHASE29_SCHEDULE'; END IF;
 IF NEW.segment_id IS NOT NULL THEN
 SELECT * INTO s FROM dispatch_private.report_scope_segments WHERE id=NEW.segment_id AND organization_id=NEW.organization_id AND valid_until>statement_timestamp();
 IF NOT FOUND OR s.scope_id<>(SELECT operational_scope_id FROM dispatch_private.operational_records WHERE id=NEW.record_id) OR s.scope_version<>(SELECT version FROM dispatch_private.operational_scopes WHERE id=s.scope_id) OR (NEW.start_lat IS NOT NULL AND (NEW.start_lat NOT BETWEEN s.min_lat AND s.max_lat OR NEW.start_lon NOT BETWEEN s.min_lon AND s.max_lon)) OR (NEW.end_lat IS NOT NULL AND (NEW.end_lat NOT BETWEEN s.min_lat AND s.max_lat OR NEW.end_lon NOT BETWEEN s.min_lon AND s.max_lon)) THEN RAISE EXCEPTION 'PHASE29_GEOMETRY_SCOPE'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER report_impact_guard BEFORE INSERT OR UPDATE ON dispatch_private.road_impacts FOR EACH ROW EXECUTE FUNCTION dispatch_private.report_impact_guard();
CREATE FUNCTION dispatch_private.report_required_keys(p_record uuid) RETURNS text[] LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT ARRAY['awareness.report.'||lower(d.subtype)||'.publish']||CASE WHEN s.hazard_required OR d.hazard_declared OR EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id AND i.reason_subtype IN(SELECT code FROM dispatch_private.report_subtypes WHERE hazard_required)) THEN ARRAY['awareness.hazard.publish'] ELSE ARRAY[]::text[] END||CASE WHEN EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id AND i.closure_extent='FULL') THEN ARRAY['awareness.road_closure.publish'] ELSE ARRAY[]::text[] END FROM dispatch_private.report_details d JOIN dispatch_private.report_subtypes s ON s.code=d.subtype WHERE d.record_id=p_record $$;
CREATE FUNCTION dispatch_private.report_grants_valid(p_record uuid,p_grants uuid[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.report_details d JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.operational_scopes scope ON scope.id=r.operational_scope_id WHERE d.record_id=p_record AND NOT EXISTS(
 SELECT 1 FROM unnest(dispatch_private.report_required_keys(p_record)) required WHERE NOT EXISTS(
 SELECT 1 FROM dispatch_private.capability_grants g JOIN dispatch_private.capability_grant_constraints c ON c.grant_id=g.id JOIN dispatch_private.capability_grant_units u ON u.grant_id=g.id AND u.unit_id=d.unit_id
 WHERE g.id=ANY(p_grants) AND g.organization_id=d.organization_id AND g.capability_key=required AND g.status='ACTIVE' AND g.valid_from<=now() AND g.valid_until>now() AND g.valid_until<=g.valid_from+interval '90 days' AND g.operational_scope_id=scope.id AND g.operational_scope_version=scope.version AND c.organization_id=d.organization_id AND c.scope_id=scope.id AND c.scope_version=scope.version AND c.subtype=d.subtype AND d.timing=ANY(c.allowed_timing) AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id AND (NOT i.closure_extent=ANY(c.closure_envelope) OR NOT i.lane_extent=ANY(c.lane_envelope)))))) $$;
-- DAYTON-REVIEW-01 additive authorization and exact candidate-state binding.
-- Actor tokens are opaque immutable lineage; no FK to the erasable identity mapping.
CREATE TABLE dispatch_private.reviewer_authorizations(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,
 reviewer_token uuid NOT NULL,acting_unit_id uuid NOT NULL,target_unit_id uuid NOT NULL,
 subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,risk_gates text[] NOT NULL DEFAULT '{}' CHECK(risk_gates<@ARRAY['awareness.hazard.publish','awareness.road_closure.publish']),
 scope_id uuid NOT NULL,scope_version integer NOT NULL,scope_source_version text NOT NULL,valid_from timestamptz NOT NULL DEFAULT now(),valid_until timestamptz NOT NULL,revoked_at timestamptz,
 authority_evidence text NOT NULL CHECK(length(authority_evidence) BETWEEN 1 AND 200),issued_by_token uuid NOT NULL,
 governance_approval_reference text CHECK(length(governance_approval_reference) BETWEEN 1 AND 200),policy_version text NOT NULL CHECK(policy_version='DAYTON-REVIEW-01-v1'),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valid_until>valid_from),CHECK(acting_unit_id=target_unit_id OR governance_approval_reference IS NOT NULL),
 FOREIGN KEY(organization_id,acting_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id),
 FOREIGN KEY(organization_id,target_unit_id) REFERENCES dispatch_private.organization_units(organization_id,id),
 FOREIGN KEY(organization_id,scope_id) REFERENCES dispatch_private.operational_scopes(organization_id,id),
 FOREIGN KEY(scope_id,scope_version) REFERENCES dispatch_private.operational_scopes(id,version),UNIQUE(organization_id,id));
CREATE INDEX reviewer_authorizations_actor ON dispatch_private.reviewer_authorizations(organization_id,reviewer_token,target_unit_id);
ALTER TABLE dispatch_private.publication_reviews ADD COLUMN candidate_revision integer NOT NULL DEFAULT 1 CHECK(candidate_revision>0),
 ADD COLUMN reviewer_authorization_id uuid REFERENCES dispatch_private.reviewer_authorizations,
 ADD COLUMN acting_unit_id uuid REFERENCES dispatch_private.organization_units,
 ADD COLUMN reviewer_policy_version text NOT NULL DEFAULT 'DAYTON-REVIEW-01-v1' CHECK(reviewer_policy_version='DAYTON-REVIEW-01-v1');
CREATE TABLE dispatch_private.review_state_snapshots(review_id uuid PRIMARY KEY REFERENCES dispatch_private.publication_reviews,state_digest bytea NOT NULL CHECK(octet_length(state_digest)=32),impact_revisions jsonb NOT NULL CHECK(jsonb_typeof(impact_revisions)='array'),created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION dispatch_private.report_review_state(p_review uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('candidate',to_jsonb(v)-ARRAY['state','reviewer_token','reviewed_at','reviewer_authorization_id','acting_unit_id'],
 'report',jsonb_build_object('id',r.id,'source_revision',r.current_revision,'status',r.status,'details_revision',d.revision,'detail_source_revision',d.source_revision,'subtype',d.subtype,'contract',d.contract_version,'contract_hash',cv.contract_hash,'policy',cv.policy_version,'scope',s.id,'scope_version',s.version,'scope_source_version',(SELECT source_version FROM dispatch_private.scope_governance WHERE scope_id=s.id),'unit_id',d.unit_id,'source_unit_id',r.owning_unit_id),
 'impacts',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id),'[]'::jsonb),
 'linked',CASE WHEN d.linked_record_id IS NOT NULL THEN (SELECT jsonb_build_object('details',to_jsonb(ld),'source_revision',lr.current_revision,'status',lr.status,'impacts',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dispatch_private.road_impacts i WHERE i.record_id=ld.record_id),'[]'::jsonb)) FROM dispatch_private.report_details ld JOIN dispatch_private.operational_records lr ON lr.id=ld.record_id WHERE ld.record_id=d.linked_record_id) END)
 FROM dispatch_private.publication_reviews v JOIN dispatch_private.report_details d ON d.record_id=v.record_id JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.report_contract_versions cv ON cv.version=d.contract_version JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id WHERE v.id=p_review $$;
CREATE FUNCTION dispatch_private.report_capture_review_state() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 INSERT INTO dispatch_private.review_state_snapshots(review_id,state_digest,impact_revisions) VALUES(NEW.id,extensions.digest(convert_to(dispatch_private.report_review_state(NEW.id)::text,'UTF8'),'sha256'),coalesce((SELECT jsonb_agg(jsonb_build_object('record_id',i.record_id,'impact_id',i.id,'revision',i.revision) ORDER BY i.record_id,i.id) FROM dispatch_private.road_impacts i WHERE i.record_id=NEW.record_id OR i.record_id=(SELECT linked_record_id FROM dispatch_private.report_details WHERE record_id=NEW.record_id)),'[]'::jsonb)); RETURN NEW; END $$;
CREATE TRIGGER report_capture_review_state AFTER INSERT ON dispatch_private.publication_reviews FOR EACH ROW EXECUTE FUNCTION dispatch_private.report_capture_review_state();
CREATE FUNCTION dispatch_private.report_review_state_valid(p_review uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce((SELECT v.source_revision=r.current_revision AND v.details_revision=d.revision AND v.contract_version=d.contract_version AND v.policy_version=cv.policy_version AND v.reviewer_policy_version='DAYTON-REVIEW-01-v1' AND ss.state_digest=extensions.digest(convert_to(dispatch_private.report_review_state(v.id)::text,'UTF8'),'sha256') FROM dispatch_private.publication_reviews v JOIN dispatch_private.review_state_snapshots ss ON ss.review_id=v.id JOIN dispatch_private.report_details d ON d.record_id=v.record_id JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.report_contract_versions cv ON cv.version=d.contract_version WHERE v.id=p_review),false) $$;
CREATE FUNCTION dispatch_private.report_reviewer_authorized(p_record uuid,p_authorization uuid,p_acting_unit uuid,p_token uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.report_details d JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id JOIN dispatch_private.reviewer_authorizations a ON a.id=p_authorization AND a.organization_id=d.organization_id JOIN dispatch_private.actor_tokens t ON t.token=a.reviewer_token AND t.organization_id=a.organization_id JOIN dispatch_private.profiles p ON p.user_id=t.user_id JOIN dispatch_private.organization_memberships m ON m.organization_id=a.organization_id AND m.user_id=t.user_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template AND rp.permission_key='projection.review'
 WHERE d.record_id=p_record AND a.reviewer_token=p_token AND a.acting_unit_id=p_acting_unit AND a.target_unit_id=d.unit_id AND a.subtype=d.subtype AND a.scope_id=s.id AND a.scope_version=s.version AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND EXISTS(SELECT 1 FROM dispatch_private.scope_governance sg WHERE sg.scope_id=a.scope_id AND sg.organization_id=a.organization_id AND sg.source_version=a.scope_source_version AND sg.valid_until>now()) AND a.valid_from<=now() AND a.valid_until>now() AND a.revoked_at IS NULL AND a.policy_version='DAYTON-REVIEW-01-v1' AND p.status='ACTIVE' AND m.status='ACTIVE'
 AND NOT EXISTS(SELECT 1 FROM unnest(dispatch_private.report_required_keys(d.record_id)||coalesce(dispatch_private.report_required_keys(d.linked_record_id),ARRAY[]::text[])) k WHERE k IN('awareness.hazard.publish','awareness.road_closure.publish') AND NOT k=ANY(a.risk_gates))
 AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY[a.acting_unit_id,a.target_unit_id]) target WHERE NOT EXISTS(SELECT 1 FROM dispatch_private.unit_memberships um JOIN dispatch_private.organization_units u ON u.id=um.unit_id WHERE um.unit_id=target AND um.organization_id=a.organization_id AND um.membership_id=m.id AND um.status='ACTIVE' AND u.status='ACTIVE' AND u.onboarding_state IN('PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED')))
 AND EXISTS(SELECT 1 FROM dispatch_private.unit_scope_grants us WHERE us.unit_id=a.target_unit_id AND us.organization_id=a.organization_id AND us.scope_id=a.scope_id)
 AND (a.acting_unit_id=a.target_unit_id OR a.governance_approval_reference IS NOT NULL)) $$;
CREATE FUNCTION dispatch_private.report_review_authorization_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' OR OLD.revoked_at IS NOT NULL OR (to_jsonb(OLD)-'revoked_at')<>(to_jsonb(NEW)-'revoked_at') OR NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_IMMUTABLE'; END IF; RETURN NEW; END $$;
CREATE TRIGGER report_review_authorization_guard BEFORE UPDATE OR DELETE ON dispatch_private.reviewer_authorizations FOR EACH ROW EXECUTE FUNCTION dispatch_private.report_review_authorization_guard();

CREATE FUNCTION dispatch_private.report_review_prerequisites(p_review uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.publication_reviews v JOIN dispatch_private.report_details d ON d.record_id=v.record_id JOIN dispatch_private.report_contract_versions cv ON cv.version=d.contract_version JOIN dispatch_private.report_subtypes st ON st.code=d.subtype JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.organizations o ON o.id=d.organization_id JOIN dispatch_private.organization_units u ON u.id=d.unit_id JOIN dispatch_private.pilot_governance pg ON pg.organization_id=o.id JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id JOIN dispatch_private.scope_governance sg ON sg.scope_id=s.id AND sg.organization_id=o.id JOIN dispatch_private.department_report_policies dp ON dp.department=dispatch_private.report_department(d.unit_id) AND dp.subtype=d.subtype
 WHERE v.id=p_review AND v.state='APPROVED' AND v.valid_until>now() AND dispatch_private.report_review_state_valid(v.id) AND dispatch_private.report_reviewer_authorized(d.record_id,v.reviewer_authorization_id,v.acting_unit_id,v.reviewer_token) AND v.source_revision=r.current_revision AND v.details_revision=d.revision AND d.source_revision=r.current_revision AND d.withdrawn_at IS NULL AND d.screening_state='APPROVED' AND st.public_eligible AND dp.public_allowed AND cv.policy_version=v.policy_version AND o.status='ACTIVE' AND o.verification_level='VERIFIED_PUBLIC_ENTITY' AND u.status='ACTIVE' AND u.onboarding_state IN('PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED') AND pg.verification_expires_at>now() AND pg.attestation_expires_at>now() AND sg.valid_until>now() AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND r.status IN('OPEN','IN_PROGRESS','MONITORING') AND dispatch_private.report_grants_valid(r.id,v.grant_ids)
 AND EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id JOIN dispatch_private.profiles p ON p.user_id=m.user_id JOIN dispatch_private.unit_memberships um ON um.membership_id=m.id AND um.unit_id=d.unit_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.token=v.reviewer_token AND t.organization_id=d.organization_id AND m.status='ACTIVE' AND um.status='ACTIVE' AND p.status='ACTIVE' AND rp.permission_key='projection.review')
 AND EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id JOIN dispatch_private.profiles ap ON ap.user_id=m.user_id JOIN dispatch_private.unit_memberships um ON um.membership_id=m.id AND um.unit_id=d.unit_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.token=v.author_token AND t.organization_id=d.organization_id AND m.status='ACTIVE' AND um.status='ACTIVE' AND ap.status='ACTIVE' AND rp.permission_key='projection.submit')
 AND (d.subtype='OFFICIAL_PUBLIC_NOTICE' AND d.notice_effective_at<=now() AND d.notice_expires_at>now() OR EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id))
 AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id AND (i.valid_until<=now() OR i.last_confirmed_at<now()-interval '15 minutes' OR i.impact_status NOT IN('ACTIVE','SCHEDULED') OR i.segment_id IS NULL OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_scope_segments seg WHERE seg.id=i.segment_id AND seg.organization_id=d.organization_id AND seg.scope_id=s.id AND seg.scope_version=s.version AND seg.valid_until>now()) OR i.direction_affected='UNKNOWN' OR i.closure_extent='UNKNOWN' OR i.lane_extent='UNKNOWN' OR i.public_passable='UNKNOWN'))
 AND (d.subtype<>'OFFICIAL_PUBLIC_NOTICE' OR d.linked_record_id IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.report_details ld WHERE ld.record_id=d.linked_record_id AND ld.organization_id=d.organization_id AND ld.unit_id=d.unit_id AND ld.screening_state='APPROVED' AND ld.withdrawn_at IS NULL AND ld.subtype<>'OFFICIAL_PUBLIC_NOTICE' AND ld.source_revision=(SELECT current_revision FROM dispatch_private.operational_records WHERE id=ld.record_id AND status IN('OPEN','IN_PROGRESS','MONITORING')) AND EXISTS(SELECT 1 FROM dispatch_private.road_impacts li WHERE li.record_id=ld.record_id) AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts li WHERE li.record_id=ld.record_id AND (li.valid_until<=now() OR li.last_confirmed_at<now()-interval '15 minutes' OR li.segment_id IS NULL OR li.direction_affected='UNKNOWN' OR li.closure_extent='UNKNOWN' OR li.lane_extent='UNKNOWN' OR li.public_passable='UNKNOWN')) AND dispatch_private.report_grants_valid(ld.record_id,v.grant_ids)))) $$;
CREATE FUNCTION dispatch_private.report_review_attempt_eligible(p_review uuid,p_authorization uuid,p_acting_unit uuid,p_token uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.publication_reviews v JOIN dispatch_private.report_details d ON d.record_id=v.record_id JOIN dispatch_private.report_contract_versions cv ON cv.version=d.contract_version JOIN dispatch_private.report_subtypes st ON st.code=d.subtype JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.organizations o ON o.id=d.organization_id JOIN dispatch_private.organization_units u ON u.id=d.unit_id JOIN dispatch_private.pilot_governance pg ON pg.organization_id=o.id JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id JOIN dispatch_private.scope_governance sg ON sg.scope_id=s.id AND sg.organization_id=o.id JOIN dispatch_private.department_report_policies dp ON dp.department=dispatch_private.report_department(d.unit_id) AND dp.subtype=d.subtype
 WHERE v.id=p_review AND v.state IN('PENDING_REVIEW','APPROVED','REJECTED') AND v.valid_until>now() AND dispatch_private.report_review_state_valid(v.id) AND dispatch_private.report_reviewer_authorized(d.record_id,p_authorization,p_acting_unit,p_token) AND v.source_revision=r.current_revision AND v.details_revision=d.revision AND d.source_revision=r.current_revision AND d.withdrawn_at IS NULL AND d.screening_state='APPROVED' AND st.public_eligible AND dp.public_allowed AND cv.policy_version=v.policy_version AND o.status='ACTIVE' AND o.verification_level='VERIFIED_PUBLIC_ENTITY' AND u.status='ACTIVE' AND u.onboarding_state IN('PRIVATE_PILOT_READY','PUBLISHING_REVIEW_REQUIRED','PUBLISHING_ENABLED') AND pg.verification_expires_at>now() AND pg.attestation_expires_at>now() AND sg.valid_until>now() AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND r.status IN('OPEN','IN_PROGRESS','MONITORING') AND dispatch_private.report_grants_valid(r.id,v.grant_ids)
 AND EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id JOIN dispatch_private.profiles p ON p.user_id=m.user_id JOIN dispatch_private.unit_memberships um ON um.membership_id=m.id AND um.unit_id=d.unit_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.token=p_token AND t.organization_id=d.organization_id AND m.status='ACTIVE' AND um.status='ACTIVE' AND p.status='ACTIVE' AND rp.permission_key='projection.review')
 AND EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id JOIN dispatch_private.profiles ap ON ap.user_id=m.user_id JOIN dispatch_private.unit_memberships um ON um.membership_id=m.id AND um.unit_id=d.unit_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.token=v.author_token AND t.organization_id=d.organization_id AND m.status='ACTIVE' AND um.status='ACTIVE' AND ap.status='ACTIVE' AND rp.permission_key='projection.submit')
 AND (d.subtype='OFFICIAL_PUBLIC_NOTICE' AND d.notice_effective_at<=now() AND d.notice_expires_at>now() OR EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id))
 AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id AND (i.valid_until<=now() OR i.last_confirmed_at<now()-interval '15 minutes' OR i.impact_status NOT IN('ACTIVE','SCHEDULED') OR i.segment_id IS NULL OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_scope_segments seg WHERE seg.id=i.segment_id AND seg.organization_id=d.organization_id AND seg.scope_id=s.id AND seg.scope_version=s.version AND seg.valid_until>now()) OR i.direction_affected='UNKNOWN' OR i.closure_extent='UNKNOWN' OR i.lane_extent='UNKNOWN' OR i.public_passable='UNKNOWN'))
 AND (d.subtype<>'OFFICIAL_PUBLIC_NOTICE' OR d.linked_record_id IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.report_details ld WHERE ld.record_id=d.linked_record_id AND ld.organization_id=d.organization_id AND ld.unit_id=d.unit_id AND ld.screening_state='APPROVED' AND ld.withdrawn_at IS NULL AND ld.subtype<>'OFFICIAL_PUBLIC_NOTICE' AND ld.source_revision=(SELECT current_revision FROM dispatch_private.operational_records WHERE id=ld.record_id AND status IN('OPEN','IN_PROGRESS','MONITORING')) AND EXISTS(SELECT 1 FROM dispatch_private.road_impacts li WHERE li.record_id=ld.record_id) AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts li WHERE li.record_id=ld.record_id AND (li.valid_until<=now() OR li.last_confirmed_at<now()-interval '15 minutes' OR li.segment_id IS NULL OR li.direction_affected='UNKNOWN' OR li.closure_extent='UNKNOWN' OR li.lane_extent='UNKNOWN' OR li.public_passable='UNKNOWN')) AND dispatch_private.report_grants_valid(ld.record_id,v.grant_ids)))) $$;
CREATE FUNCTION dispatch_private.report_public_eligible(p_review uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.publication_reviews v JOIN dispatch_private.report_details d ON d.record_id=v.record_id JOIN dispatch_private.report_contract_versions cv ON cv.version=d.contract_version JOIN dispatch_private.report_subtypes st ON st.code=d.subtype JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.organizations o ON o.id=d.organization_id JOIN dispatch_private.organization_units u ON u.id=d.unit_id JOIN dispatch_private.pilot_governance pg ON pg.organization_id=o.id JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id JOIN dispatch_private.scope_governance sg ON sg.scope_id=s.id AND sg.organization_id=o.id JOIN dispatch_private.department_report_policies dp ON dp.department=dispatch_private.report_department(d.unit_id) AND dp.subtype=d.subtype
 WHERE v.id=p_review AND v.state='APPROVED' AND v.valid_until>now() AND dispatch_private.report_review_state_valid(v.id) AND dispatch_private.report_reviewer_authorized(d.record_id,v.reviewer_authorization_id,v.acting_unit_id,v.reviewer_token) AND v.source_revision=r.current_revision AND v.details_revision=d.revision AND d.source_revision=r.current_revision AND d.withdrawn_at IS NULL AND d.screening_state='APPROVED' AND st.public_eligible AND dp.public_allowed AND cv.publishing_enabled AND cv.policy_version=v.policy_version AND o.status='ACTIVE' AND o.verification_level='VERIFIED_PUBLIC_ENTITY' AND u.status='ACTIVE' AND u.onboarding_state='PUBLISHING_ENABLED' AND pg.publishing_enabled AND pg.verification_expires_at>now() AND pg.attestation_expires_at>now() AND sg.valid_until>now() AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND r.status IN('OPEN','IN_PROGRESS','MONITORING') AND dispatch_private.report_grants_valid(r.id,v.grant_ids)
 AND EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id JOIN dispatch_private.profiles p ON p.user_id=m.user_id JOIN dispatch_private.unit_memberships um ON um.membership_id=m.id AND um.unit_id=d.unit_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.token=v.reviewer_token AND t.organization_id=d.organization_id AND m.status='ACTIVE' AND um.status='ACTIVE' AND p.status='ACTIVE' AND rp.permission_key='projection.review')
 AND EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.user_id JOIN dispatch_private.profiles ap ON ap.user_id=m.user_id JOIN dispatch_private.unit_memberships um ON um.membership_id=m.id AND um.unit_id=d.unit_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.token=v.author_token AND t.organization_id=d.organization_id AND m.status='ACTIVE' AND um.status='ACTIVE' AND ap.status='ACTIVE' AND rp.permission_key='projection.submit')
 AND (d.subtype='OFFICIAL_PUBLIC_NOTICE' AND d.notice_effective_at<=now() AND d.notice_expires_at>now() OR EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id))
 AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts i WHERE i.record_id=d.record_id AND (i.valid_until<=now() OR i.last_confirmed_at<now()-interval '15 minutes' OR i.impact_status NOT IN('ACTIVE','SCHEDULED') OR i.segment_id IS NULL OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_scope_segments seg WHERE seg.id=i.segment_id AND seg.organization_id=d.organization_id AND seg.scope_id=s.id AND seg.scope_version=s.version AND seg.valid_until>now()) OR i.direction_affected='UNKNOWN' OR i.closure_extent='UNKNOWN' OR i.lane_extent='UNKNOWN' OR i.public_passable='UNKNOWN'))
 AND (d.subtype<>'OFFICIAL_PUBLIC_NOTICE' OR d.linked_record_id IS NULL OR EXISTS(SELECT 1 FROM dispatch_private.report_details ld WHERE ld.record_id=d.linked_record_id AND ld.organization_id=d.organization_id AND ld.unit_id=d.unit_id AND ld.screening_state='APPROVED' AND ld.withdrawn_at IS NULL AND ld.subtype<>'OFFICIAL_PUBLIC_NOTICE' AND ld.source_revision=(SELECT current_revision FROM dispatch_private.operational_records WHERE id=ld.record_id AND status IN('OPEN','IN_PROGRESS','MONITORING')) AND EXISTS(SELECT 1 FROM dispatch_private.road_impacts li WHERE li.record_id=ld.record_id) AND NOT EXISTS(SELECT 1 FROM dispatch_private.road_impacts li WHERE li.record_id=ld.record_id AND (li.valid_until<=now() OR li.last_confirmed_at<now()-interval '15 minutes' OR li.segment_id IS NULL OR li.direction_affected='UNKNOWN' OR li.closure_extent='UNKNOWN' OR li.lane_extent='UNKNOWN' OR li.public_passable='UNKNOWN')) AND dispatch_private.report_grants_valid(ld.record_id,v.grant_ids)))) $$;
CREATE FUNCTION dispatch_private.report_shared_eligible(p_share uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM dispatch_private.shared_awareness_representations sh JOIN dispatch_private.report_details d ON d.record_id=sh.record_id JOIN dispatch_private.operational_records r ON r.id=d.record_id JOIN dispatch_private.operational_scopes s ON s.id=r.operational_scope_id JOIN dispatch_private.organization_units source_unit ON source_unit.id=d.unit_id
 WHERE sh.id=p_share AND sh.revoked_at IS NULL AND sh.valid_until>now() AND d.withdrawn_at IS NULL AND d.screening_state='APPROVED' AND sh.source_revision=r.current_revision AND sh.details_revision=d.revision AND source_unit.status='ACTIVE' AND s.status='ACTIVE' AND (s.valid_until IS NULL OR s.valid_until>now()) AND r.status NOT IN('CLOSED','CANCELLED')
 AND EXISTS(SELECT 1 FROM dispatch_private.shared_awareness_recipients x WHERE x.share_id=sh.id AND dispatch_private.unit_access(x.organization_id,x.unit_id,'internal.read') AND (x.organization_id=sh.organization_id AND sh.agreement_id IS NULL OR EXISTS(
 SELECT 1 FROM dispatch_private.sharing_agreements a JOIN dispatch_private.sharing_agreement_units au ON au.agreement_id=a.id AND au.unit_id=x.unit_id WHERE a.id=sh.agreement_id AND a.source_organization_id=sh.organization_id AND a.recipient_organization_id=x.organization_id AND a.revoked_at IS NULL AND a.valid_from<=now() AND a.valid_until>now() AND a.scope_id=s.id AND a.scope_version=s.version AND d.subtype=ANY(a.allowed_subtypes) AND a.allowed_fields@>ARRAY['title','summary'] AND (SELECT count(*) FROM dispatch_private.sharing_agreement_parties p JOIN dispatch_private.organization_memberships m ON m.id=p.approver_membership_id JOIN dispatch_private.profiles pr ON pr.user_id=m.user_id JOIN dispatch_private.organizations po ON po.id=m.organization_id WHERE p.agreement_id=a.id AND p.agreement_revision=a.revision AND m.status='ACTIVE' AND po.status='ACTIVE' AND pr.status='ACTIVE' AND m.role_template IN('OWNER','ORGANIZATION_ADMIN'))=2)))) $$;
-- Legacy records remain usable privately. Broad grants never qualify a new subtype.
CREATE OR REPLACE FUNCTION dispatch_private.pilot_candidate_eligible(p_record uuid,p_cap uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT false $$;
-- No legacy projection can silently become Phase 29 eligible.
CREATE TABLE dispatch_projection.report_public_projections(id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),review_id uuid NOT NULL REFERENCES dispatch_private.publication_reviews,organization_id uuid NOT NULL,unit_id uuid NOT NULL,subtype text NOT NULL REFERENCES dispatch_private.report_subtypes,title text NOT NULL,summary text NOT NULL,public_impacts jsonb NOT NULL,expires_at timestamptz NOT NULL,withdrawn_at timestamptz,FOREIGN KEY(organization_id,unit_id) REFERENCES dispatch_private.organization_units(organization_id,id));
CREATE FUNCTION dispatch_private.report_projection_eligible(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM dispatch_projection.report_public_projections p WHERE p.id=p_id AND p.withdrawn_at IS NULL AND p.expires_at>now() AND dispatch_private.report_public_eligible(p.review_id)) $$;
CREATE FUNCTION dispatch_private.report_safe_impacts(p_record uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'direction_affected',i.direction_affected,'lane_extent',i.lane_extent,'lanes_affected_count',i.lanes_affected_count,'total_lanes_count',i.total_lanes_count,'closure_extent',i.closure_extent,'traffic_operation',i.traffic_operation,'public_passable',i.public_passable,'duration_state',i.duration_state,'estimated_end_at',i.estimated_end_at,'road_reference',(SELECT road_reference FROM dispatch_private.report_scope_segments WHERE id=i.segment_id),'start_point',CASE WHEN i.start_lat IS NOT NULL THEN jsonb_build_object('lat',i.start_lat,'lon',i.start_lon) END,'end_point',CASE WHEN i.end_lat IS NOT NULL THEN jsonb_build_object('lat',i.end_lat,'lon',i.end_lon) END,'timing',i.timing,'scheduled_start_at',i.scheduled_start_at,'effective_start_at',i.effective_start_at,'impact_status',i.impact_status,'valid_until',i.valid_until,'last_confirmed_at',i.last_confirmed_at) ORDER BY i.id),'[]'::jsonb) FROM dispatch_private.road_impacts i WHERE i.record_id=p_record $$;
CREATE TABLE dispatch_private.report_redaction_context(transaction_id bigint PRIMARY KEY,record_id uuid NOT NULL REFERENCES dispatch_private.operational_records,policy_reference text NOT NULL);

-- Trigger functions cannot call another trigger function directly; preserve the frozen
-- guard by renaming its existing trigger and adding a constrained redaction trigger
-- only on the record-revision table in the generated package.
CREATE FUNCTION dispatch_private.report_execute(p_command text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
#variable_conflict use_variable
<<report_command>>
DECLARE org uuid:=(p->>'organization_id')::uuid; actor uuid:=dispatch_private.current_actor_id(); k uuid:=(p->>'idempotency_key')::uuid; oid uuid:=(p->>'object_id')::uuid; rid uuid:=(p->>'record_id')::uuid; impact_revision integer; uid uuid:=(p->>'unit_id')::uuid; mid uuid; tok uuid; dept text; subtype text:=p->>'subtype'; r dispatch_private.operational_records%ROWTYPE; d dispatch_private.report_details%ROWTYPE; v dispatch_private.publication_reviews%ROWTYPE; a dispatch_private.sharing_agreements%ROWTYPE; h bytea:=dispatch_private.request_hash(p-'idempotency_key'); receipt dispatch_audit.command_receipts%ROWTYPE; result jsonb; source jsonb; flag boolean; expected integer:=(p->>'expected_revision')::integer; x jsonb; cap uuid; grants uuid[]; deadline timestamptz; qid uuid; sid uuid; recipients uuid[]; permission text; constraints dispatch_private.capability_grant_constraints%ROWTYPE;
BEGIN
 IF NOT dispatch_private.has_live_aal2() OR actor IS NULL OR org IS NULL OR k IS NULL THEN RAISE EXCEPTION 'PHASE29_FORBIDDEN'; END IF;
 IF p_command='invite_member' THEN RAISE EXCEPTION 'DAYTON_INVITE_SERVER_ISSUANCE_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(280028);
 PERFORM 1 FROM dispatch_private.organizations WHERE id=org AND status='ACTIVE' FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'PHASE29_ORGANIZATION'; END IF;
 IF p_command NOT IN('grant_review_authorization','revoke_review_authorization','create_report','revise_report','set_road_impact','approve_report_content','submit_report_publication','review_report_publication','publish_report','withdraw_report','quarantine_report','redact_report','grant_report_capability','renew_report_capability','create_sharing_agreement','approve_sharing_agreement','revoke_sharing_agreement','share_report','revoke_report_share') THEN
 -- Legacy intake remains private/unclassified and may not import arbitrary content.
 IF p_command IN('create_operational_record','update_operational_record') THEN
  IF p ? 'private_payload' AND p->'private_payload'<>'{}'::jsonb THEN RAISE EXCEPTION 'PHASE29_LEGACY_INTAKE_REFUSED'; END IF;
  IF dispatch_private.report_screen(p) THEN RAISE EXCEPTION 'PHASE29_CONTENT_REFUSED'; END IF;
 END IF;
 IF p_command IN('create_internal_share','submit_projection_candidate') THEN
  rid:=(p->>'record_id')::uuid;
  IF EXISTS(SELECT 1 FROM dispatch_private.report_details WHERE record_id=rid) THEN RAISE EXCEPTION 'PHASE29_REVIEWED_REPORT_PATH_REQUIRED'; END IF;
  IF dispatch_private.report_screen(p) THEN RAISE EXCEPTION 'PHASE29_CONTENT_REFUSED'; END IF;
 END IF;
 IF p_command IN('update_operational_record','transition_operational_record','close_operational_record') AND EXISTS(SELECT 1 FROM dispatch_private.report_details WHERE record_id=oid) AND p_command='update_operational_record' THEN RAISE EXCEPTION 'PHASE29_REVISION_PATH_REQUIRED'; END IF;
 RETURN dispatch_private.execute_command(p_command,p);
 END IF;
 tok:=dispatch_private.token_for(org,actor);
 permission:=CASE WHEN p_command IN('grant_report_capability','renew_report_capability','grant_review_authorization','revoke_review_authorization') THEN 'platform.capability.manage' WHEN p_command IN('approve_report_content','review_report_publication','quarantine_report','redact_report') THEN 'projection.review' WHEN p_command='publish_report' THEN 'projection.publish' WHEN p_command='submit_report_publication' THEN 'projection.submit' WHEN p_command IN('create_sharing_agreement','approve_sharing_agreement','revoke_sharing_agreement') THEN 'organization.manage' WHEN p_command IN('share_report','revoke_report_share') THEN 'internal.share' WHEN p_command='create_report' THEN 'operations.create' ELSE 'operations.update' END;
 IF permission LIKE 'platform.%' THEN IF NOT EXISTS(SELECT 1 FROM dispatch_private.platform_admin_grants WHERE user_id=actor AND permission_key=permission AND active) THEN RAISE EXCEPTION 'PHASE29_PLATFORM_PERMISSION'; END IF;
 ELSE mid:=dispatch_private.actor_membership(org,permission); IF mid IS NULL THEN RAISE EXCEPTION 'PHASE29_PERMISSION'; END IF; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k::text,0));
 IF p_command='review_report_publication' AND NOT dispatch_private.report_review_attempt_eligible(oid,(p->>'reviewer_authorization_id')::uuid,(p->>'acting_unit_id')::uuid,tok) THEN RAISE EXCEPTION 'DAYTON_REVIEW_LIVE_ATTEMPT_DENIED'; END IF;
 SELECT * INTO receipt FROM dispatch_audit.command_receipts WHERE organization_id=org AND actor_user_id=actor AND command_name=p_command AND idempotency_key=k;
 IF FOUND THEN IF receipt.request_hash<>h THEN RAISE EXCEPTION 'PHASE29_REPLAY_MISMATCH'; END IF; RETURN receipt.result_payload||jsonb_build_object('replay',true); END IF;
 IF p_command IN('grant_review_authorization','revoke_review_authorization') THEN
 IF p_command='revoke_review_authorization' THEN
  PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id']);
  UPDATE dispatch_private.reviewer_authorizations SET revoked_at=now() WHERE id=oid AND organization_id=org AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_BOUNDARY'; END IF;
 ELSE
  PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','reviewer_membership_id','acting_unit_id','target_unit_id','subtype','risk_gates','scope_id','scope_version','valid_from','valid_until','authority_evidence','governance_approval_reference']);
  IF dispatch_private.report_screen(jsonb_build_object('evidence',p->>'authority_evidence','governance',p->>'governance_approval_reference')) THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_EVIDENCE'; END IF;
  SELECT m.user_id INTO cap FROM dispatch_private.organization_memberships m JOIN dispatch_private.profiles pr ON pr.user_id=m.user_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template AND rp.permission_key='projection.review' WHERE m.id=(p->>'reviewer_membership_id')::uuid AND m.organization_id=org AND m.status='ACTIVE' AND pr.status='ACTIVE';
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_subtypes st JOIN dispatch_private.department_report_policies dp ON dp.subtype=st.code AND dp.department=dispatch_private.report_department((p->>'target_unit_id')::uuid) WHERE st.code=subtype AND st.public_eligible AND dp.public_allowed) THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_RECIPIENT'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dispatch_private.operational_scopes sc JOIN dispatch_private.scope_governance sg ON sg.scope_id=sc.id AND sg.organization_id=sc.organization_id WHERE sc.id=(p->>'scope_id')::uuid AND sc.organization_id=org AND sc.version=(p->>'scope_version')::integer AND sc.status='ACTIVE' AND (sc.valid_until IS NULL OR sc.valid_until>now()) AND sg.valid_until>now()) THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_SCOPE'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY[(p->>'acting_unit_id')::uuid,(p->>'target_unit_id')::uuid]) target WHERE NOT EXISTS(SELECT 1 FROM dispatch_private.unit_memberships um JOIN dispatch_private.organization_units u ON u.id=um.unit_id WHERE um.organization_id=org AND um.unit_id=target AND um.membership_id=(p->>'reviewer_membership_id')::uuid AND um.status='ACTIVE' AND u.status='ACTIVE')) THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_UNITS'; END IF;
  deadline:=(p->>'valid_until')::timestamptz; IF deadline IS NULL OR deadline<=now() OR deadline>now()+interval '90 days' THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_DURATION'; END IF;
  oid:=extensions.gen_random_uuid();
  INSERT INTO dispatch_private.reviewer_authorizations(id,organization_id,reviewer_token,acting_unit_id,target_unit_id,subtype,risk_gates,scope_id,scope_version,scope_source_version,valid_from,valid_until,authority_evidence,issued_by_token,governance_approval_reference,policy_version)
  VALUES(oid,org,dispatch_private.token_for(org,cap),(p->>'acting_unit_id')::uuid,(p->>'target_unit_id')::uuid,subtype,ARRAY(SELECT jsonb_array_elements_text(p->'risk_gates')),(p->>'scope_id')::uuid,(p->>'scope_version')::integer,(SELECT source_version FROM dispatch_private.scope_governance WHERE scope_id=(p->>'scope_id')::uuid),coalesce((p->>'valid_from')::timestamptz,now()),deadline,p->>'authority_evidence',tok,p->>'governance_approval_reference','DAYTON-REVIEW-01-v1');
 END IF;
 ELSIF p_command IN('create_report','revise_report') THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','unit_id','scope_id','subtype','timing','title','body','subject','notice_effective_at','notice_expires_at','linked_record_id','correction_of','hazard_declared','expected_revision','warning_acknowledged']);
 IF p->>'warning_acknowledged' IS DISTINCT FROM 'true' OR length(p->>'title') NOT BETWEEN 1 AND 160 OR length(coalesce(p->>'body',''))>1000 THEN RAISE EXCEPTION 'PHASE29_BOUNDED_INTAKE'; END IF;
 IF p_command='revise_report' THEN SELECT * INTO r FROM dispatch_private.operational_records WHERE id=oid AND organization_id=org FOR UPDATE; IF NOT FOUND OR NOT dispatch_private.record_access(oid,permission) OR r.current_revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'PHASE29_STALE_SOURCE'; END IF; uid:=r.owning_unit_id; END IF;
 dept:=dispatch_private.report_department(uid);
 IF uid IS NULL OR NOT dispatch_private.unit_access(org,uid,permission) OR NOT EXISTS(SELECT 1 FROM dispatch_private.department_report_policies WHERE department=dept AND department_report_policies.subtype=report_command.subtype AND internal_allowed) THEN RAISE EXCEPTION 'PHASE29_DEPARTMENT_DENIED'; END IF;
 flag:=dispatch_private.report_screen(jsonb_build_object('title',p->>'title','body',p->>'body','subject',p->>'subject'));
 IF flag THEN
 INSERT INTO dispatch_private.content_screening_decisions(organization_id,state,rule_version,content_digest,actor_token) VALUES(org,'QUARANTINED','PHASE29-SCREEN-v1',h,tok) RETURNING id INTO sid;
 INSERT INTO dispatch_private.content_quarantine(organization_id,screening_decision_id,state) VALUES(org,sid,'QUARANTINED') RETURNING id INTO oid;
 result:=jsonb_build_object('object_id',oid,'state','QUARANTINED','replay',false);
 ELSE
 IF p_command='create_report' THEN source:=dispatch_private.execute_command('create_operational_record',jsonb_build_object('organization_id',org,'idempotency_key',k,'unit_id',uid,'scope_id',p->>'scope_id','record_type',CASE WHEN subtype='OFFICIAL_PUBLIC_NOTICE' THEN 'OPERATIONAL_NOTICE' WHEN subtype='PLANNED_WORK' THEN 'PLANNED_WORK' WHEN subtype IN(SELECT code FROM dispatch_private.report_subtypes WHERE hazard_required) THEN 'HAZARD' ELSE 'CONDITION' END,'title',p->>'title','private_payload','{}'::jsonb,'data_attestation','OPERATIONAL_AWARENESS_ONLY','safety_class',CASE WHEN subtype='RESTRICTED_LAW_ENFORCEMENT_NOTE' THEN 'UNREVIEWED' ELSE 'GENERAL_AWARENESS' END)); oid:=(source->>'object_id')::uuid;
 ELSE PERFORM dispatch_private.execute_command('update_operational_record',jsonb_build_object('organization_id',org,'idempotency_key',k,'object_id',oid,'expected_revision',expected,'title',p->>'title','private_payload','{}'::jsonb,'data_attestation','OPERATIONAL_AWARENESS_ONLY')); END IF;
 SELECT * INTO r FROM dispatch_private.operational_records WHERE id=oid;
 IF p ? 'linked_record_id' AND NOT EXISTS(SELECT 1 FROM dispatch_private.operational_records lr JOIN dispatch_private.report_details ld ON ld.record_id=lr.id WHERE lr.id=(p->>'linked_record_id')::uuid AND lr.organization_id=org AND lr.owning_unit_id=uid AND lr.operational_scope_id=r.operational_scope_id AND ld.subtype<>'OFFICIAL_PUBLIC_NOTICE' AND dispatch_private.record_access(lr.id,'operations.read')) THEN RAISE EXCEPTION 'PHASE29_NOTICE_LINK'; END IF;
 IF subtype='OFFICIAL_PUBLIC_NOTICE' AND (coalesce((p->>'hazard_declared')::boolean,false) OR coalesce(p->>'body','')~*'(hazard|collision|crash|closure|closed|restriction|spill|high.water|power.line|smoke)') AND NOT p ? 'linked_record_id' THEN RAISE EXCEPTION 'PHASE29_NOTICE_STRUCTURED_LINK_REQUIRED'; END IF;
 IF subtype='OFFICIAL_PUBLIC_NOTICE' AND ((p->>'notice_expires_at')::timestamptz>now()+interval '1 day' OR (p->>'notice_expires_at')::timestamptz<=now()) THEN RAISE EXCEPTION 'PHASE29_NOTICE_EXPIRY'; END IF;
 INSERT INTO dispatch_private.report_details(record_id,organization_id,unit_id,subtype,contract_version,source_revision,timing,hazard_declared,author_token,subject,body,notice_effective_at,notice_expires_at,linked_record_id,correction_of)
 VALUES(oid,org,uid,subtype,'PHASE29-v1',r.current_revision,p->>'timing',coalesce((p->>'hazard_declared')::boolean,false),tok,p->>'subject',p->>'body',(p->>'notice_effective_at')::timestamptz,(p->>'notice_expires_at')::timestamptz,(p->>'linked_record_id')::uuid,(p->>'correction_of')::uuid)
 ON CONFLICT(record_id) DO UPDATE SET subtype=EXCLUDED.subtype,source_revision=EXCLUDED.source_revision,timing=EXCLUDED.timing,hazard_declared=EXCLUDED.hazard_declared,author_token=EXCLUDED.author_token,subject=EXCLUDED.subject,body=EXCLUDED.body,notice_effective_at=EXCLUDED.notice_effective_at,notice_expires_at=EXCLUDED.notice_expires_at,linked_record_id=EXCLUDED.linked_record_id,screening_state='PENDING_REVIEW',revision=dispatch_private.report_details.revision+1;
 IF p ? 'correction_of' THEN IF NOT dispatch_private.record_access((p->>'correction_of')::uuid,'operations.update') THEN RAISE EXCEPTION 'PHASE29_CORRECTION_SOURCE'; END IF; UPDATE dispatch_private.report_details SET withdrawn_at=now(),revision=revision+1 WHERE record_id=(p->>'correction_of')::uuid AND organization_id=org AND unit_id=uid; IF NOT FOUND THEN RAISE EXCEPTION 'PHASE29_CORRECTION_BOUNDARY'; END IF; END IF;
 INSERT INTO dispatch_private.content_screening_decisions(organization_id,record_id,source_revision,state,rule_version,content_digest,actor_token) VALUES(org,oid,r.current_revision,'PENDING_REVIEW','PHASE29-SCREEN-v1',h,tok);
 END IF;
 ELSIF p_command IN('grant_report_capability','renew_report_capability') THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','capability_key','subtype','scope_id','scope_version','unit_ids','closure_envelope','lane_envelope','allowed_timing','authority_evidence','evidence_class','valid_until','expected_revision']);
 IF p_command='renew_report_capability' THEN SELECT * INTO constraints FROM dispatch_private.capability_grant_constraints WHERE grant_id=oid AND organization_id=org FOR UPDATE; IF NOT FOUND OR expected IS DISTINCT FROM (SELECT revision FROM dispatch_private.capability_grants WHERE id=oid AND status='ACTIVE') THEN RAISE EXCEPTION 'PHASE29_STALE_GRANT'; END IF; PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','valid_until','expected_revision']);
 ELSE
 IF NOT EXISTS(SELECT 1 FROM dispatch_private.capability_catalog c WHERE c.capability_key=p->>'capability_key' AND (c.subtype=subtype OR c.high_risk_gate)) OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_subtypes WHERE code=subtype AND public_eligible) THEN RAISE EXCEPTION 'PHASE29_EXACT_CAPABILITY'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dispatch_private.operational_scopes s JOIN dispatch_private.scope_governance sg ON sg.scope_id=s.id WHERE s.id=(p->>'scope_id')::uuid AND s.organization_id=org AND s.version=(p->>'scope_version')::int AND s.status='ACTIVE' AND sg.valid_until>now()) THEN RAISE EXCEPTION 'PHASE29_GOVERNED_SCOPE'; END IF;
 oid:=extensions.gen_random_uuid();
 INSERT INTO dispatch_private.capability_grants(id,organization_id,capability_key,operational_scope_id,operational_scope_version,status,valid_until,granted_by_platform_actor,actor_token) VALUES(oid,org,p->>'capability_key',(p->>'scope_id')::uuid,(p->>'scope_version')::int,'ACTIVE',(p->>'valid_until')::timestamptz,actor,tok);
 INSERT INTO dispatch_private.capability_grant_constraints(grant_id,organization_id,scope_id,scope_version,subtype,closure_envelope,lane_envelope,allowed_timing,review_policy,authority_evidence,evidence_class) VALUES(oid,org,(p->>'scope_id')::uuid,(p->>'scope_version')::int,subtype,ARRAY(SELECT jsonb_array_elements_text(p->'closure_envelope')),ARRAY(SELECT jsonb_array_elements_text(p->'lane_envelope')),ARRAY(SELECT jsonb_array_elements_text(p->'allowed_timing')),'PHASE29-INDEPENDENT-v1',p->>'authority_evidence',p->>'evidence_class');
 IF jsonb_array_length(p->'unit_ids') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'PHASE29_EXPLICIT_UNITS'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'unit_ids') LOOP uid:=(x#>>'{}')::uuid; IF NOT EXISTS(SELECT 1 FROM dispatch_private.organization_units u JOIN dispatch_private.department_report_policies dp ON dp.department=dispatch_private.report_department(u.id) AND dp.subtype=report_command.subtype WHERE u.id=uid AND u.organization_id=org AND u.status='ACTIVE' AND dp.public_allowed AND dp.evidence_class=p->>'evidence_class') THEN RAISE EXCEPTION 'PHASE29_GRANT_UNIT_DENIED'; END IF; INSERT INTO dispatch_private.capability_grant_units VALUES(org,oid,uid); END LOOP;
 END IF;
 deadline:=(p->>'valid_until')::timestamptz; IF deadline IS NULL OR deadline<=now() OR deadline>now()+interval '90 days' THEN RAISE EXCEPTION 'PHASE29_GRANT_DURATION'; END IF;
 IF p_command='renew_report_capability' THEN UPDATE dispatch_private.capability_grants SET valid_from=now(),valid_until=deadline,revision=revision+1 WHERE id=oid; UPDATE dispatch_private.capability_grant_constraints SET renewal_revision=renewal_revision+1 WHERE grant_id=oid; END IF;
 ELSIF p_command IN('create_sharing_agreement','approve_sharing_agreement','revoke_sharing_agreement') THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','recipient_organization_id','scope_id','scope_version','purpose','allowed_subtypes','allowed_fields','recipient_unit_ids','valid_until','expected_revision']);
 IF p_command='create_sharing_agreement' THEN
 oid:=extensions.gen_random_uuid(); INSERT INTO dispatch_private.sharing_agreements(id,source_organization_id,recipient_organization_id,scope_id,scope_version,purpose,allowed_subtypes,allowed_fields,valid_until) VALUES(oid,org,(p->>'recipient_organization_id')::uuid,(p->>'scope_id')::uuid,(p->>'scope_version')::int,p->>'purpose',ARRAY(SELECT jsonb_array_elements_text(p->'allowed_subtypes')),ARRAY(SELECT jsonb_array_elements_text(p->'allowed_fields')),(p->>'valid_until')::timestamptz);
 SELECT * INTO a FROM dispatch_private.sharing_agreements WHERE id=oid;
 IF a.valid_until>now()+interval '90 days' OR dispatch_private.report_screen(jsonb_build_object('purpose',a.purpose)) OR EXISTS(SELECT 1 FROM unnest(a.allowed_subtypes) c WHERE NOT EXISTS(SELECT 1 FROM dispatch_private.report_subtypes s WHERE s.code=c AND s.public_eligible)) OR NOT EXISTS(SELECT 1 FROM dispatch_private.operational_scopes WHERE id=a.scope_id AND status='ACTIVE' AND version=a.scope_version) THEN RAISE EXCEPTION 'PHASE29_AGREEMENT_POLICY'; END IF;
 IF jsonb_array_length(p->'recipient_unit_ids') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'PHASE29_EXPLICIT_RECIPIENTS'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'recipient_unit_ids') LOOP uid:=(x#>>'{}')::uuid; IF NOT EXISTS(SELECT 1 FROM dispatch_private.organization_units WHERE id=uid AND organization_id=a.recipient_organization_id AND status='ACTIVE') THEN RAISE EXCEPTION 'PHASE29_AGREEMENT_RECIPIENT'; END IF; INSERT INTO dispatch_private.sharing_agreement_units VALUES(oid,a.recipient_organization_id,uid); END LOOP;
 ELSE PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','expected_revision']); SELECT * INTO a FROM dispatch_private.sharing_agreements WHERE id=oid AND org IN(source_organization_id,recipient_organization_id) FOR UPDATE;
 IF NOT FOUND OR a.revoked_at IS NOT NULL OR a.valid_until<=now() OR expected IS DISTINCT FROM a.revision THEN RAISE EXCEPTION 'PHASE29_STALE_AGREEMENT'; END IF;
 IF p_command='approve_sharing_agreement' THEN INSERT INTO dispatch_private.sharing_agreement_parties VALUES(oid,org,a.revision,mid,tok,now()); ELSE UPDATE dispatch_private.sharing_agreements SET revoked_at=now(),revision=revision+1 WHERE id=oid; END IF;
 END IF;
 ELSE
 IF p_command IN('review_report_publication','publish_report') THEN SELECT * INTO v FROM dispatch_private.publication_reviews WHERE id=oid AND organization_id=org FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'PHASE29_REVIEW_BOUNDARY'; END IF; rid:=v.record_id;
 ELSIF p_command='revoke_report_share' THEN SELECT record_id INTO rid FROM dispatch_private.shared_awareness_representations WHERE id=oid AND organization_id=org; END IF;
 SELECT * INTO d FROM dispatch_private.report_details WHERE record_id=coalesce(rid,oid) AND organization_id=org FOR UPDATE; IF NOT FOUND OR NOT dispatch_private.record_access(d.record_id,permission) THEN RAISE EXCEPTION 'PHASE29_SOURCE_BOUNDARY'; END IF; rid:=d.record_id;
 SELECT * INTO r FROM dispatch_private.operational_records WHERE id=rid;
 IF expected IS DISTINCT FROM d.revision OR d.source_revision<>r.current_revision THEN RAISE EXCEPTION 'PHASE29_STALE_REPORT'; END IF;
 IF p_command='set_road_impact' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','record_id','object_id','expected_revision','impact_revision','impact']); x:=p->'impact';
 PERFORM dispatch_private.report_keys(x,ARRAY['segment_id','direction_affected','lane_extent','lanes_affected_count','total_lanes_count','closure_extent','traffic_operation','public_passable','emergency_vehicles_passable','start_lat','start_lon','end_lat','end_lon','duration_state','estimated_end_at','scheduled_start_at','impact_status','valid_until','passable_with_caution']);
 IF x->>'passable_with_caution'='true' AND (x->>'closure_extent' IS DISTINCT FROM 'PARTIAL' OR x->>'public_passable' IS DISTINCT FROM 'YES') THEN RAISE EXCEPTION 'PHASE29_CAUTION_RESTRICTION'; END IF;
 IF oid IS NOT NULL THEN SELECT revision INTO impact_revision FROM dispatch_private.road_impacts WHERE id=oid AND record_id=rid AND organization_id=org FOR UPDATE; IF NOT FOUND OR impact_revision IS DISTINCT FROM (p->>'impact_revision')::integer THEN RAISE EXCEPTION 'PHASE29_STALE_IMPACT'; END IF; ELSE oid:=extensions.gen_random_uuid(); END IF;
 INSERT INTO dispatch_private.road_impacts(id,organization_id,record_id,segment_id,direction_affected,lane_extent,lanes_affected_count,total_lanes_count,closure_extent,traffic_operation,public_passable,emergency_vehicles_passable,start_lat,start_lon,end_lat,end_lon,duration_state,estimated_end_at,reason_subtype,timing,scheduled_start_at,effective_start_at,impact_status,valid_until)
 VALUES(oid,org,rid,(x->>'segment_id')::uuid,coalesce(x->>'direction_affected','UNKNOWN'),coalesce(x->>'lane_extent','UNKNOWN'),(x->>'lanes_affected_count')::int,(x->>'total_lanes_count')::int,coalesce(x->>'closure_extent','UNKNOWN'),coalesce(x->>'traffic_operation','UNKNOWN'),coalesce(x->>'public_passable','UNKNOWN'),coalesce(x->>'emergency_vehicles_passable','UNKNOWN'),(x->>'start_lat')::numeric,(x->>'start_lon')::numeric,(x->>'end_lat')::numeric,(x->>'end_lon')::numeric,coalesce(x->>'duration_state','UNKNOWN'),(x->>'estimated_end_at')::timestamptz,d.subtype,d.timing,(x->>'scheduled_start_at')::timestamptz,CASE WHEN x->>'impact_status'='ACTIVE' THEN statement_timestamp() END,x->>'impact_status',(x->>'valid_until')::timestamptz) ON CONFLICT(id) DO UPDATE SET revision=dispatch_private.road_impacts.revision+1,segment_id=EXCLUDED.segment_id,direction_affected=EXCLUDED.direction_affected,lane_extent=EXCLUDED.lane_extent,lanes_affected_count=EXCLUDED.lanes_affected_count,total_lanes_count=EXCLUDED.total_lanes_count,closure_extent=EXCLUDED.closure_extent,traffic_operation=EXCLUDED.traffic_operation,public_passable=EXCLUDED.public_passable,emergency_vehicles_passable=EXCLUDED.emergency_vehicles_passable,start_lat=EXCLUDED.start_lat,start_lon=EXCLUDED.start_lon,end_lat=EXCLUDED.end_lat,end_lon=EXCLUDED.end_lon,duration_state=EXCLUDED.duration_state,estimated_end_at=EXCLUDED.estimated_end_at,reason_subtype=EXCLUDED.reason_subtype,last_confirmed_at=statement_timestamp(),timing=EXCLUDED.timing,scheduled_start_at=EXCLUDED.scheduled_start_at,effective_start_at=coalesce(dispatch_private.road_impacts.effective_start_at,EXCLUDED.effective_start_at),impact_status=EXCLUDED.impact_status,valid_until=EXCLUDED.valid_until;
 INSERT INTO dispatch_private.road_impact_revisions SELECT oid,i.revision,rid,d.source_revision,tok,to_jsonb(i),now() FROM dispatch_private.road_impacts i WHERE id=oid;
 UPDATE dispatch_private.report_details SET revision=revision+1,screening_state='PENDING_REVIEW' WHERE record_id=rid;
 ELSIF p_command='approve_report_content' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','record_id','expected_revision']);
 IF d.author_token=tok OR d.screening_state<>'PENDING_REVIEW' OR dispatch_private.report_screen(jsonb_build_object('body',d.body,'subject',d.subject,'title',r.title)) THEN RAISE EXCEPTION 'PHASE29_CONTENT_APPROVAL_DENIED'; END IF;
 UPDATE dispatch_private.report_details SET screening_state='APPROVED' WHERE record_id=rid;
 INSERT INTO dispatch_private.content_screening_decisions(organization_id,record_id,source_revision,state,rule_version,content_digest,actor_token,independent_reviewer_token) VALUES(org,rid,d.source_revision,'APPROVED','PHASE29-SCREEN-v1',h,d.author_token,tok); oid:=rid;
 ELSIF p_command='submit_report_publication' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','record_id','expected_revision','title','summary','grant_ids','valid_until']);
 IF d.screening_state<>'APPROVED' OR dispatch_private.report_screen(jsonb_build_object('title',p->>'title','summary',p->>'summary')) OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_subtypes WHERE code=d.subtype AND public_eligible) THEN RAISE EXCEPTION 'PHASE29_PUBLIC_CONTENT'; END IF;
 grants:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p->'grant_ids')); IF NOT dispatch_private.report_grants_valid(rid,grants) OR (d.linked_record_id IS NOT NULL AND NOT dispatch_private.report_grants_valid(d.linked_record_id,grants)) THEN RAISE EXCEPTION 'PHASE29_CONJUNCTIVE_GATES'; END IF;
 deadline:=(p->>'valid_until')::timestamptz;
 IF deadline IS NULL OR deadline<=now() OR deadline>now()+interval '15 minutes' OR deadline>(SELECT min(valid_until) FROM dispatch_private.capability_grants WHERE id=ANY(grants)) OR deadline>(SELECT least(verification_expires_at,attestation_expires_at) FROM dispatch_private.pilot_governance WHERE organization_id=org) OR deadline>(SELECT valid_until FROM dispatch_private.scope_governance WHERE scope_id=r.operational_scope_id) OR deadline>coalesce((SELECT valid_until FROM dispatch_private.operational_scopes WHERE id=r.operational_scope_id),'infinity'::timestamptz) OR deadline>coalesce(d.notice_expires_at,'infinity'::timestamptz) OR EXISTS(SELECT 1 FROM dispatch_private.road_impacts WHERE record_id=rid AND deadline>least(valid_until,last_confirmed_at+interval '15 minutes')) THEN RAISE EXCEPTION 'PHASE29_PUBLIC_DEADLINE'; END IF;
 INSERT INTO dispatch_private.publication_reviews(organization_id,record_id,source_revision,details_revision,contract_version,policy_version,author_token,title,summary,grant_ids,valid_until) VALUES(org,rid,d.source_revision,d.revision,d.contract_version,'PHASE29-INDEPENDENT-v1',tok,p->>'title',p->>'summary',grants,deadline) RETURNING id INTO oid;
 ELSIF p_command='review_report_publication' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','record_id','expected_revision','expected_candidate_revision','reviewer_authorization_id','acting_unit_id','decision']);
 IF (p->>'record_id')::uuid IS DISTINCT FROM v.record_id OR (p->>'expected_candidate_revision')::integer IS DISTINCT FROM v.candidate_revision OR NOT dispatch_private.report_review_state_valid(v.id) THEN RAISE EXCEPTION 'DAYTON_REVIEW_STALE_CANDIDATE'; END IF;
 IF NOT dispatch_private.report_reviewer_authorized(rid,(p->>'reviewer_authorization_id')::uuid,(p->>'acting_unit_id')::uuid,tok) THEN RAISE EXCEPTION 'DAYTON_REVIEW_AUTHORIZATION_DENIED'; END IF;
 IF v.state<>'PENDING_REVIEW' OR v.author_token=tok OR d.author_token=tok OR p->>'decision' NOT IN('APPROVED','REJECTED') THEN RAISE EXCEPTION 'PHASE29_INDEPENDENT_REVIEW'; END IF;
 UPDATE dispatch_private.publication_reviews SET state=p->>'decision',reviewer_token=tok,reviewer_authorization_id=(p->>'reviewer_authorization_id')::uuid,acting_unit_id=(p->>'acting_unit_id')::uuid,reviewed_at=now() WHERE id=oid;
 IF p->>'decision'='APPROVED' AND NOT dispatch_private.report_review_prerequisites(oid) THEN RAISE EXCEPTION 'DAYTON_REVIEW_LIVE_ELIGIBILITY_DENIED'; END IF;
 ELSIF p_command='publish_report' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','expected_revision']);
 IF NOT dispatch_private.report_public_eligible(oid) THEN RAISE EXCEPTION 'PHASE29_PUBLICATION_DISABLED_OR_INELIGIBLE'; END IF;
 INSERT INTO dispatch_projection.report_public_projections(review_id,organization_id,unit_id,subtype,title,summary,public_impacts,expires_at) VALUES(oid,org,d.unit_id,d.subtype,v.title,v.summary,dispatch_private.report_safe_impacts(rid),v.valid_until) RETURNING id INTO oid;
 ELSIF p_command='withdraw_report' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','record_id','expected_revision','reason_code']);
 IF p->>'reason_code' NOT IN('CORRECTION','EXPIRED','SAFETY','WITHDRAWN') THEN RAISE EXCEPTION 'PHASE29_REASON_CODE'; END IF;
 UPDATE dispatch_private.report_details SET withdrawn_at=now(),revision=revision+1 WHERE record_id=rid; oid:=rid;
 ELSIF p_command IN('quarantine_report','redact_report') THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','record_id','expected_revision','policy_reference']);
 IF length(p->>'policy_reference') NOT BETWEEN 1 AND 200 OR dispatch_private.report_screen(jsonb_build_object('policy',p->>'policy_reference')) THEN RAISE EXCEPTION 'PHASE29_POLICY_REFERENCE'; END IF;
 UPDATE dispatch_private.report_details SET screening_state='QUARANTINED',withdrawn_at=now(),revision=revision+1 WHERE record_id=rid;
 INSERT INTO dispatch_private.content_screening_decisions(organization_id,record_id,source_revision,state,rule_version,content_digest,actor_token) VALUES(org,rid,d.source_revision,'QUARANTINED','PHASE29-SCREEN-v1',h,tok) RETURNING id INTO sid;
 INSERT INTO dispatch_private.content_quarantine(organization_id,screening_decision_id,record_id,state,policy_reference) VALUES(org,sid,rid,'QUARANTINED',p->>'policy_reference') RETURNING id INTO qid;
 IF p_command='redact_report' THEN
 INSERT INTO dispatch_private.report_redaction_context VALUES(txid_current(),rid,p->>'policy_reference');
 UPDATE dispatch_audit.record_revisions SET snapshot=jsonb_build_object('redacted',true,'record_id',rid,'revision',revision_number) WHERE record_id=rid;
 UPDATE dispatch_private.operational_records SET title='[REDACTED]',private_payload='{}'::jsonb WHERE id=rid;
 UPDATE dispatch_private.report_details SET subject=CASE WHEN subject IS NOT NULL THEN '[REDACTED]' END,body=CASE WHEN body IS NOT NULL THEN '[REDACTED]' END,screening_state='REDACTED' WHERE record_id=rid;
 UPDATE dispatch_private.publication_reviews SET title='[REDACTED]',summary='[REDACTED]',state='WITHDRAWN' WHERE record_id=rid;
 UPDATE dispatch_projection.report_public_projections SET title='[REDACTED]',summary='[REDACTED]',withdrawn_at=now() WHERE review_id IN(SELECT id FROM dispatch_private.publication_reviews WHERE record_id=rid);
 UPDATE dispatch_private.shared_awareness_representations SET title='[REDACTED]',summary='[REDACTED]',revoked_at=now() WHERE record_id=rid;
 UPDATE dispatch_private.content_quarantine SET state='REDACTED',redacted_at=now() WHERE id=qid;
 DELETE FROM dispatch_private.report_redaction_context WHERE transaction_id=txid_current();
 END IF;
 INSERT INTO dispatch_audit.content_remediation_events(organization_id,quarantine_id,record_id,actor_token,policy_reference,event_type) VALUES(org,qid,rid,tok,p->>'policy_reference',CASE WHEN p_command='redact_report' THEN 'REDACTED' ELSE 'QUARANTINED' END); oid:=qid;
 ELSIF p_command='share_report' THEN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','record_id','expected_revision','title','summary','agreement_id','recipient_unit_ids','valid_until','reviewer_token']);
 IF d.screening_state<>'APPROVED' OR NOT EXISTS(SELECT 1 FROM dispatch_private.report_subtypes WHERE code=d.subtype AND public_eligible) OR dispatch_private.report_screen(jsonb_build_object('title',p->>'title','summary',p->>'summary')) THEN RAISE EXCEPTION 'PHASE29_SHARE_CONTENT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dispatch_private.content_screening_decisions WHERE record_id=rid AND source_revision=d.source_revision AND state='APPROVED' AND independent_reviewer_token=(p->>'reviewer_token')::uuid AND independent_reviewer_token<>tok) THEN RAISE EXCEPTION 'PHASE29_SHARE_REVIEW'; END IF;
 deadline:=(p->>'valid_until')::timestamptz; IF deadline IS NULL OR deadline<=now() OR deadline>now()+interval '1 day' OR jsonb_array_length(p->'recipient_unit_ids') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'PHASE29_SHARE_VALIDITY'; END IF;
 IF p ? 'agreement_id' THEN SELECT * INTO a FROM dispatch_private.sharing_agreements WHERE id=(p->>'agreement_id')::uuid AND source_organization_id=org AND revoked_at IS NULL AND valid_from<=now() AND valid_until>now() AND scope_id=r.operational_scope_id AND scope_version=(SELECT version FROM dispatch_private.operational_scopes WHERE id=r.operational_scope_id); IF NOT FOUND OR NOT d.subtype=ANY(a.allowed_subtypes) OR NOT a.allowed_fields@>ARRAY['title','summary'] OR (SELECT count(*) FROM dispatch_private.sharing_agreement_parties WHERE agreement_id=a.id AND agreement_revision=a.revision)<>2 OR deadline>a.valid_until THEN RAISE EXCEPTION 'PHASE29_BILATERAL_AGREEMENT'; END IF; END IF;
 oid:=extensions.gen_random_uuid();
 INSERT INTO dispatch_private.shared_awareness_representations(id,organization_id,record_id,source_revision,details_revision,agreement_id,author_token,reviewer_token,title,summary,valid_until) VALUES(oid,org,rid,d.source_revision,d.revision,(p->>'agreement_id')::uuid,tok,(p->>'reviewer_token')::uuid,p->>'title',p->>'summary',deadline);
 FOR x IN SELECT value FROM jsonb_array_elements(p->'recipient_unit_ids') LOOP uid:=(x#>>'{}')::uuid; SELECT organization_id INTO cap FROM dispatch_private.organization_units WHERE id=uid AND status='ACTIVE'; IF cap IS NULL OR (p ? 'agreement_id' AND (cap<>a.recipient_organization_id OR NOT EXISTS(SELECT 1 FROM dispatch_private.sharing_agreement_units WHERE agreement_id=a.id AND unit_id=uid))) OR (NOT p ? 'agreement_id' AND cap<>org) THEN RAISE EXCEPTION 'PHASE29_RECIPIENT_BOUNDARY'; END IF; INSERT INTO dispatch_private.shared_awareness_recipients VALUES(oid,cap,uid); END LOOP;
 ELSIF p_command='revoke_report_share' THEN PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','idempotency_key','object_id','expected_revision']); UPDATE dispatch_private.shared_awareness_representations SET revoked_at=now(),revision=revision+1 WHERE id=oid AND organization_id=org;
 END IF;
 END IF;
 result:=coalesce(result,jsonb_build_object('object_id',oid,'replay',false));
 INSERT INTO dispatch_audit.command_receipts(organization_id,actor_user_id,session_id,command_name,idempotency_key,request_hash,result_payload,actor_token) VALUES(org,actor,dispatch_private.current_session_id(),p_command,k,h,result,tok);
 INSERT INTO dispatch_audit.command_versions(organization_id,command_name,object_id,expected_revision,revision,actor_token) VALUES(org,p_command,oid,expected,coalesce((SELECT revision FROM dispatch_private.report_details WHERE record_id=rid),1),tok);
 INSERT INTO dispatch_audit.pilot_events(organization_id,actor_token,command_name,target_id,revision,payload) VALUES(org,tok,p_command,oid,expected,jsonb_build_object('contract_version','PHASE29-v1','request_hash',encode(h,'hex'))||CASE WHEN p_command='review_report_publication' THEN (SELECT jsonb_build_object('author_token',pv.author_token,'reviewer_token',pv.reviewer_token,'decision',pv.state,'record_id',pv.record_id,'source_revision',pv.source_revision,'details_revision',pv.details_revision,'candidate_revision',pv.candidate_revision,'policy_version',pv.policy_version,'reviewer_policy_version',pv.reviewer_policy_version,'reviewer_authorization_id',pv.reviewer_authorization_id,'acting_unit_id',pv.acting_unit_id,'reviewed_at',pv.reviewed_at,'state_digest',(SELECT encode(state_digest,'hex') FROM dispatch_private.review_state_snapshots WHERE review_id=pv.id),'impact_revisions',(SELECT impact_revisions FROM dispatch_private.review_state_snapshots WHERE review_id=pv.id)) FROM dispatch_private.publication_reviews pv WHERE pv.id=oid) ELSE '{}'::jsonb END);
 RETURN result;
END $$;

INSERT INTO dispatch_private.report_contract_versions VALUES('PHASE29-v1','0ac80f48d3f6aa663cf3ae5f5ec04543a8b3196daa78188af0bbda295a7e7182','PHASE29-INDEPENDENT-v1',now(),false);
INSERT INTO dispatch_private.report_families VALUES ('OFFICIAL_COMMUNICATION'),('COLLISION'),('ROAD_CONDITION'),('UTILITY_INFRASTRUCTURE'),('RAIL_CROSSING'),('FIRE_SCENE_ENVIRONMENT'),('WORK_TRAFFIC_CONTROL'),('TRAVEL_RESTRICTION'),('INTERNAL'),('LEGACY');
INSERT INTO dispatch_private.report_subtypes VALUES ('OFFICIAL_PUBLIC_NOTICE','OFFICIAL_COMMUNICATION',true,false,'PHASE29-v1'),('TRAFFIC_COLLISION','COLLISION',true,true,'PHASE29-v1'),('ROAD_CONDITION','ROAD_CONDITION',true,false,'PHASE29-v1'),('HIGH_WATER','ROAD_CONDITION',true,true,'PHASE29-v1'),('DEBRIS_OBSTRUCTION','ROAD_CONDITION',true,true,'PHASE29-v1'),('DOWNED_TREE','ROAD_CONDITION',true,true,'PHASE29-v1'),('DOWNED_POWER_LINE','UTILITY_INFRASTRUCTURE',true,true,'PHASE29-v1'),('UTILITY_INFRASTRUCTURE_ISSUE','UTILITY_INFRASTRUCTURE',true,false,'PHASE29-v1'),('INFRASTRUCTURE_TRAVEL_CONDITION','UTILITY_INFRASTRUCTURE',true,false,'PHASE29-v1'),('RAIL_CROSSING_BLOCKED','RAIL_CROSSING',true,false,'PHASE29-v1'),('RAIL_CROSSING_DELAY','RAIL_CROSSING',true,false,'PHASE29-v1'),('RAIL_CROSSING_CONDITION','RAIL_CROSSING',true,false,'PHASE29-v1'),('FIRE_SMOKE_TRAVEL_IMPACT','FIRE_SCENE_ENVIRONMENT',true,true,'PHASE29-v1'),('HAZMAT_SPILL','FIRE_SCENE_ENVIRONMENT',true,true,'PHASE29-v1'),('EMERGENCY_SCENE_TRAVEL_IMPACT','FIRE_SCENE_ENVIRONMENT',true,true,'PHASE29-v1'),('PLANNED_WORK','WORK_TRAFFIC_CONTROL',true,false,'PHASE29-v1'),('TRAFFIC_CONTROL','WORK_TRAFFIC_CONTROL',true,false,'PHASE29-v1'),('TRAVEL_RESTRICTION','TRAVEL_RESTRICTION',true,false,'PHASE29-v1'),('RESPONDER_SAFETY_NOTE','INTERNAL',false,false,'PHASE29-v1'),('STAGING_COORDINATION','INTERNAL',false,false,'PHASE29-v1'),('INTERNAL_OPERATIONAL_AWARENESS','INTERNAL',false,false,'PHASE29-v1'),('RESTRICTED_LAW_ENFORCEMENT_NOTE','INTERNAL',false,false,'PHASE29-v1'),('UNIT_COORDINATION_NOTE','INTERNAL',false,false,'PHASE29-v1'),('NONPUBLIC_INFRASTRUCTURE_DETAIL','INTERNAL',false,false,'PHASE29-v1'),('RESPONDER_ACCESS_NOTE','INTERNAL',false,false,'PHASE29-v1'),('LEGACY_UNCLASSIFIED','LEGACY',false,false,'PHASE29-v1');
INSERT INTO dispatch_private.department_report_policies VALUES ('POLICE','OFFICIAL_PUBLIC_NOTICE',true,true,'N','PHASE29-v1'),('POLICE','TRAFFIC_COLLISION',true,true,'R','PHASE29-v1'),('POLICE','ROAD_CONDITION',false,false,'R','PHASE29-v1'),('POLICE','HIGH_WATER',true,true,'R','PHASE29-v1'),('POLICE','DEBRIS_OBSTRUCTION',true,true,'R','PHASE29-v1'),('POLICE','DOWNED_TREE',true,true,'R','PHASE29-v1'),('POLICE','DOWNED_POWER_LINE',true,true,'U','PHASE29-v1'),('POLICE','UTILITY_INFRASTRUCTURE_ISSUE',false,false,'U','PHASE29-v1'),('POLICE','INFRASTRUCTURE_TRAVEL_CONDITION',false,false,'U','PHASE29-v1'),('POLICE','RAIL_CROSSING_BLOCKED',true,true,'X','PHASE29-v1'),('POLICE','RAIL_CROSSING_DELAY',true,true,'X','PHASE29-v1'),('POLICE','RAIL_CROSSING_CONDITION',false,false,'X','PHASE29-v1'),('POLICE','FIRE_SMOKE_TRAVEL_IMPACT',false,false,'R','PHASE29-v1'),('POLICE','HAZMAT_SPILL',true,true,'R','PHASE29-v1'),('POLICE','EMERGENCY_SCENE_TRAVEL_IMPACT',false,false,'R','PHASE29-v1'),('POLICE','PLANNED_WORK',false,false,'R','PHASE29-v1'),('POLICE','TRAFFIC_CONTROL',true,true,'R','PHASE29-v1'),('POLICE','TRAVEL_RESTRICTION',true,true,'R','PHASE29-v1'),('POLICE','RESPONDER_SAFETY_NOTE',false,false,'INTERNAL','PHASE29-v1'),('POLICE','STAGING_COORDINATION',false,false,'INTERNAL','PHASE29-v1'),('POLICE','INTERNAL_OPERATIONAL_AWARENESS',true,false,'INTERNAL','PHASE29-v1'),('POLICE','RESTRICTED_LAW_ENFORCEMENT_NOTE',true,false,'INTERNAL','PHASE29-v1'),('POLICE','UNIT_COORDINATION_NOTE',true,false,'INTERNAL','PHASE29-v1'),('POLICE','NONPUBLIC_INFRASTRUCTURE_DETAIL',false,false,'U','PHASE29-v1'),('POLICE','RESPONDER_ACCESS_NOTE',false,false,'INTERNAL','PHASE29-v1'),('POLICE','LEGACY_UNCLASSIFIED',false,false,'INTERNAL','PHASE29-v1'),('FIRE','OFFICIAL_PUBLIC_NOTICE',true,true,'N','PHASE29-v1'),('FIRE','TRAFFIC_COLLISION',true,true,'R','PHASE29-v1'),('FIRE','ROAD_CONDITION',false,false,'R','PHASE29-v1'),('FIRE','HIGH_WATER',true,true,'R','PHASE29-v1'),('FIRE','DEBRIS_OBSTRUCTION',true,true,'R','PHASE29-v1'),('FIRE','DOWNED_TREE',true,true,'R','PHASE29-v1'),('FIRE','DOWNED_POWER_LINE',true,true,'U','PHASE29-v1'),('FIRE','UTILITY_INFRASTRUCTURE_ISSUE',false,false,'U','PHASE29-v1'),('FIRE','INFRASTRUCTURE_TRAVEL_CONDITION',false,false,'U','PHASE29-v1'),('FIRE','RAIL_CROSSING_BLOCKED',true,true,'X','PHASE29-v1'),('FIRE','RAIL_CROSSING_DELAY',true,true,'X','PHASE29-v1'),('FIRE','RAIL_CROSSING_CONDITION',false,false,'X','PHASE29-v1'),('FIRE','FIRE_SMOKE_TRAVEL_IMPACT',true,true,'R','PHASE29-v1'),('FIRE','HAZMAT_SPILL',true,true,'R','PHASE29-v1'),('FIRE','EMERGENCY_SCENE_TRAVEL_IMPACT',true,true,'R','PHASE29-v1'),('FIRE','PLANNED_WORK',false,false,'R','PHASE29-v1'),('FIRE','TRAFFIC_CONTROL',true,true,'R','PHASE29-v1'),('FIRE','TRAVEL_RESTRICTION',true,true,'R','PHASE29-v1'),('FIRE','RESPONDER_SAFETY_NOTE',true,false,'INTERNAL','PHASE29-v1'),('FIRE','STAGING_COORDINATION',true,false,'INTERNAL','PHASE29-v1'),('FIRE','INTERNAL_OPERATIONAL_AWARENESS',true,false,'INTERNAL','PHASE29-v1'),('FIRE','RESTRICTED_LAW_ENFORCEMENT_NOTE',false,false,'INTERNAL','PHASE29-v1'),('FIRE','UNIT_COORDINATION_NOTE',true,false,'INTERNAL','PHASE29-v1'),('FIRE','NONPUBLIC_INFRASTRUCTURE_DETAIL',false,false,'U','PHASE29-v1'),('FIRE','RESPONDER_ACCESS_NOTE',true,false,'INTERNAL','PHASE29-v1'),('FIRE','LEGACY_UNCLASSIFIED',false,false,'INTERNAL','PHASE29-v1'),('EMS','OFFICIAL_PUBLIC_NOTICE',true,true,'N','PHASE29-v1'),('EMS','TRAFFIC_COLLISION',true,true,'R','PHASE29-v1'),('EMS','ROAD_CONDITION',false,false,'R','PHASE29-v1'),('EMS','HIGH_WATER',true,true,'R','PHASE29-v1'),('EMS','DEBRIS_OBSTRUCTION',true,true,'R','PHASE29-v1'),('EMS','DOWNED_TREE',true,true,'R','PHASE29-v1'),('EMS','DOWNED_POWER_LINE',true,true,'U','PHASE29-v1'),('EMS','UTILITY_INFRASTRUCTURE_ISSUE',false,false,'U','PHASE29-v1'),('EMS','INFRASTRUCTURE_TRAVEL_CONDITION',false,false,'U','PHASE29-v1'),('EMS','RAIL_CROSSING_BLOCKED',true,true,'X','PHASE29-v1'),('EMS','RAIL_CROSSING_DELAY',true,true,'X','PHASE29-v1'),('EMS','RAIL_CROSSING_CONDITION',false,false,'X','PHASE29-v1'),('EMS','FIRE_SMOKE_TRAVEL_IMPACT',true,true,'R','PHASE29-v1'),('EMS','HAZMAT_SPILL',true,true,'R','PHASE29-v1'),('EMS','EMERGENCY_SCENE_TRAVEL_IMPACT',true,true,'R','PHASE29-v1'),('EMS','PLANNED_WORK',false,false,'R','PHASE29-v1'),('EMS','TRAFFIC_CONTROL',true,true,'R','PHASE29-v1'),('EMS','TRAVEL_RESTRICTION',true,true,'R','PHASE29-v1'),('EMS','RESPONDER_SAFETY_NOTE',false,false,'INTERNAL','PHASE29-v1'),('EMS','STAGING_COORDINATION',true,false,'INTERNAL','PHASE29-v1'),('EMS','INTERNAL_OPERATIONAL_AWARENESS',true,false,'INTERNAL','PHASE29-v1'),('EMS','RESTRICTED_LAW_ENFORCEMENT_NOTE',false,false,'INTERNAL','PHASE29-v1'),('EMS','UNIT_COORDINATION_NOTE',true,false,'INTERNAL','PHASE29-v1'),('EMS','NONPUBLIC_INFRASTRUCTURE_DETAIL',false,false,'U','PHASE29-v1'),('EMS','RESPONDER_ACCESS_NOTE',true,false,'INTERNAL','PHASE29-v1'),('EMS','LEGACY_UNCLASSIFIED',false,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','OFFICIAL_PUBLIC_NOTICE',true,true,'N','PHASE29-v1'),('PUBLIC_WORKS','TRAFFIC_COLLISION',false,false,'R','PHASE29-v1'),('PUBLIC_WORKS','ROAD_CONDITION',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','HIGH_WATER',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','DEBRIS_OBSTRUCTION',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','DOWNED_TREE',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','DOWNED_POWER_LINE',false,false,'U','PHASE29-v1'),('PUBLIC_WORKS','UTILITY_INFRASTRUCTURE_ISSUE',true,true,'U','PHASE29-v1'),('PUBLIC_WORKS','INFRASTRUCTURE_TRAVEL_CONDITION',true,true,'U','PHASE29-v1'),('PUBLIC_WORKS','RAIL_CROSSING_BLOCKED',false,false,'X','PHASE29-v1'),('PUBLIC_WORKS','RAIL_CROSSING_DELAY',false,false,'X','PHASE29-v1'),('PUBLIC_WORKS','RAIL_CROSSING_CONDITION',true,true,'X','PHASE29-v1'),('PUBLIC_WORKS','FIRE_SMOKE_TRAVEL_IMPACT',false,false,'R','PHASE29-v1'),('PUBLIC_WORKS','HAZMAT_SPILL',false,false,'R','PHASE29-v1'),('PUBLIC_WORKS','EMERGENCY_SCENE_TRAVEL_IMPACT',false,false,'R','PHASE29-v1'),('PUBLIC_WORKS','PLANNED_WORK',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','TRAFFIC_CONTROL',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','TRAVEL_RESTRICTION',true,true,'R','PHASE29-v1'),('PUBLIC_WORKS','RESPONDER_SAFETY_NOTE',false,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','STAGING_COORDINATION',false,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','INTERNAL_OPERATIONAL_AWARENESS',true,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','RESTRICTED_LAW_ENFORCEMENT_NOTE',false,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','UNIT_COORDINATION_NOTE',true,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','NONPUBLIC_INFRASTRUCTURE_DETAIL',true,false,'U','PHASE29-v1'),('PUBLIC_WORKS','RESPONDER_ACCESS_NOTE',false,false,'INTERNAL','PHASE29-v1'),('PUBLIC_WORKS','LEGACY_UNCLASSIFIED',false,false,'INTERNAL','PHASE29-v1');
INSERT INTO dispatch_private.capability_catalog(capability_key,subtype,legacy,high_risk_gate) VALUES ('awareness.report.official_public_notice.publish','OFFICIAL_PUBLIC_NOTICE',false,false),('awareness.report.traffic_collision.publish','TRAFFIC_COLLISION',false,false),('awareness.report.road_condition.publish','ROAD_CONDITION',false,false),('awareness.report.high_water.publish','HIGH_WATER',false,false),('awareness.report.debris_obstruction.publish','DEBRIS_OBSTRUCTION',false,false),('awareness.report.downed_tree.publish','DOWNED_TREE',false,false),('awareness.report.downed_power_line.publish','DOWNED_POWER_LINE',false,false),('awareness.report.utility_infrastructure_issue.publish','UTILITY_INFRASTRUCTURE_ISSUE',false,false),('awareness.report.infrastructure_travel_condition.publish','INFRASTRUCTURE_TRAVEL_CONDITION',false,false),('awareness.report.rail_crossing_blocked.publish','RAIL_CROSSING_BLOCKED',false,false),('awareness.report.rail_crossing_delay.publish','RAIL_CROSSING_DELAY',false,false),('awareness.report.rail_crossing_condition.publish','RAIL_CROSSING_CONDITION',false,false),('awareness.report.fire_smoke_travel_impact.publish','FIRE_SMOKE_TRAVEL_IMPACT',false,false),('awareness.report.hazmat_spill.publish','HAZMAT_SPILL',false,false),('awareness.report.emergency_scene_travel_impact.publish','EMERGENCY_SCENE_TRAVEL_IMPACT',false,false),('awareness.report.planned_work.publish','PLANNED_WORK',false,false),('awareness.report.traffic_control.publish','TRAFFIC_CONTROL',false,false),('awareness.report.travel_restriction.publish','TRAVEL_RESTRICTION',false,false),('awareness.condition.publish',NULL,true,false),('awareness.hazard.publish',NULL,true,true),('awareness.planned_work.publish',NULL,true,false),('awareness.official_notice.publish',NULL,true,false),('awareness.road_closure.publish',NULL,true,true);
INSERT INTO dispatch_private.capability_requirements VALUES ('OFFICIAL_PUBLIC_NOTICE','awareness.report.official_public_notice.publish','ALWAYS'),('OFFICIAL_PUBLIC_NOTICE','awareness.hazard.publish','HAZARD'),('OFFICIAL_PUBLIC_NOTICE','awareness.road_closure.publish','FULL_CLOSURE'),('TRAFFIC_COLLISION','awareness.report.traffic_collision.publish','ALWAYS'),('TRAFFIC_COLLISION','awareness.hazard.publish','HAZARD'),('TRAFFIC_COLLISION','awareness.road_closure.publish','FULL_CLOSURE'),('ROAD_CONDITION','awareness.report.road_condition.publish','ALWAYS'),('ROAD_CONDITION','awareness.hazard.publish','HAZARD'),('ROAD_CONDITION','awareness.road_closure.publish','FULL_CLOSURE'),('HIGH_WATER','awareness.report.high_water.publish','ALWAYS'),('HIGH_WATER','awareness.hazard.publish','HAZARD'),('HIGH_WATER','awareness.road_closure.publish','FULL_CLOSURE'),('DEBRIS_OBSTRUCTION','awareness.report.debris_obstruction.publish','ALWAYS'),('DEBRIS_OBSTRUCTION','awareness.hazard.publish','HAZARD'),('DEBRIS_OBSTRUCTION','awareness.road_closure.publish','FULL_CLOSURE'),('DOWNED_TREE','awareness.report.downed_tree.publish','ALWAYS'),('DOWNED_TREE','awareness.hazard.publish','HAZARD'),('DOWNED_TREE','awareness.road_closure.publish','FULL_CLOSURE'),('DOWNED_POWER_LINE','awareness.report.downed_power_line.publish','ALWAYS'),('DOWNED_POWER_LINE','awareness.hazard.publish','HAZARD'),('DOWNED_POWER_LINE','awareness.road_closure.publish','FULL_CLOSURE'),('UTILITY_INFRASTRUCTURE_ISSUE','awareness.report.utility_infrastructure_issue.publish','ALWAYS'),('UTILITY_INFRASTRUCTURE_ISSUE','awareness.hazard.publish','HAZARD'),('UTILITY_INFRASTRUCTURE_ISSUE','awareness.road_closure.publish','FULL_CLOSURE'),('INFRASTRUCTURE_TRAVEL_CONDITION','awareness.report.infrastructure_travel_condition.publish','ALWAYS'),('INFRASTRUCTURE_TRAVEL_CONDITION','awareness.hazard.publish','HAZARD'),('INFRASTRUCTURE_TRAVEL_CONDITION','awareness.road_closure.publish','FULL_CLOSURE'),('RAIL_CROSSING_BLOCKED','awareness.report.rail_crossing_blocked.publish','ALWAYS'),('RAIL_CROSSING_BLOCKED','awareness.hazard.publish','HAZARD'),('RAIL_CROSSING_BLOCKED','awareness.road_closure.publish','FULL_CLOSURE'),('RAIL_CROSSING_DELAY','awareness.report.rail_crossing_delay.publish','ALWAYS'),('RAIL_CROSSING_DELAY','awareness.hazard.publish','HAZARD'),('RAIL_CROSSING_DELAY','awareness.road_closure.publish','FULL_CLOSURE'),('RAIL_CROSSING_CONDITION','awareness.report.rail_crossing_condition.publish','ALWAYS'),('RAIL_CROSSING_CONDITION','awareness.hazard.publish','HAZARD'),('RAIL_CROSSING_CONDITION','awareness.road_closure.publish','FULL_CLOSURE'),('FIRE_SMOKE_TRAVEL_IMPACT','awareness.report.fire_smoke_travel_impact.publish','ALWAYS'),('FIRE_SMOKE_TRAVEL_IMPACT','awareness.hazard.publish','HAZARD'),('FIRE_SMOKE_TRAVEL_IMPACT','awareness.road_closure.publish','FULL_CLOSURE'),('HAZMAT_SPILL','awareness.report.hazmat_spill.publish','ALWAYS'),('HAZMAT_SPILL','awareness.hazard.publish','HAZARD'),('HAZMAT_SPILL','awareness.road_closure.publish','FULL_CLOSURE'),('EMERGENCY_SCENE_TRAVEL_IMPACT','awareness.report.emergency_scene_travel_impact.publish','ALWAYS'),('EMERGENCY_SCENE_TRAVEL_IMPACT','awareness.hazard.publish','HAZARD'),('EMERGENCY_SCENE_TRAVEL_IMPACT','awareness.road_closure.publish','FULL_CLOSURE'),('PLANNED_WORK','awareness.report.planned_work.publish','ALWAYS'),('PLANNED_WORK','awareness.hazard.publish','HAZARD'),('PLANNED_WORK','awareness.road_closure.publish','FULL_CLOSURE'),('TRAFFIC_CONTROL','awareness.report.traffic_control.publish','ALWAYS'),('TRAFFIC_CONTROL','awareness.hazard.publish','HAZARD'),('TRAFFIC_CONTROL','awareness.road_closure.publish','FULL_CLOSURE'),('TRAVEL_RESTRICTION','awareness.report.travel_restriction.publish','ALWAYS'),('TRAVEL_RESTRICTION','awareness.hazard.publish','HAZARD'),('TRAVEL_RESTRICTION','awareness.road_closure.publish','FULL_CLOSURE');
GRANT dispatch_function_owner TO postgres;
ALTER TABLE dispatch_private.report_contract_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.report_contract_versions FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.report_contract_versions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.report_families ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.report_families FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.report_families FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.report_subtypes ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.report_subtypes FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.report_subtypes FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.department_report_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.department_report_policies FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.department_report_policies FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.capability_catalog ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.capability_catalog FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.capability_catalog FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.capability_requirements ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.capability_requirements FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.capability_requirements FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.capability_grant_constraints ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.capability_grant_constraints FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.capability_grant_constraints FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.capability_grant_units ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.capability_grant_units FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.capability_grant_units FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.report_details ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.report_details FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.report_details FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.report_scope_segments ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.report_scope_segments FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.report_scope_segments FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.road_impacts ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.road_impacts FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.road_impacts FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.road_impact_revisions ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.road_impact_revisions FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.road_impact_revisions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.content_screening_decisions ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.content_screening_decisions FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.content_screening_decisions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.content_quarantine ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.content_quarantine FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.content_quarantine FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_audit.content_remediation_events ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_audit.content_remediation_events FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_audit.content_remediation_events FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.publication_reviews ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.publication_reviews FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.publication_reviews FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.sharing_agreements ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.sharing_agreements FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.sharing_agreements FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.sharing_agreement_parties ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.sharing_agreement_parties FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.sharing_agreement_parties FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.sharing_agreement_units ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.sharing_agreement_units FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.sharing_agreement_units FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.shared_awareness_representations ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.shared_awareness_representations FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.shared_awareness_representations FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.shared_awareness_recipients ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.shared_awareness_recipients FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.shared_awareness_recipients FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.reviewer_authorizations ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.reviewer_authorizations FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.reviewer_authorizations FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.review_state_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.review_state_snapshots FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.review_state_snapshots FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_projection.report_public_projections ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_projection.report_public_projections FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_projection.report_public_projections FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE dispatch_private.report_redaction_context ENABLE ROW LEVEL SECURITY; ALTER TABLE dispatch_private.report_redaction_context FORCE ROW LEVEL SECURITY; REVOKE ALL ON dispatch_private.report_redaction_context FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON dispatch_private.report_contract_versions TO dispatch_function_owner;
GRANT SELECT ON dispatch_private.report_families TO dispatch_function_owner;
GRANT SELECT ON dispatch_private.report_subtypes TO dispatch_function_owner;
GRANT SELECT ON dispatch_private.department_report_policies TO dispatch_function_owner;
GRANT SELECT ON dispatch_private.capability_catalog TO dispatch_function_owner;
GRANT SELECT ON dispatch_private.capability_requirements TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.capability_grant_constraints TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.capability_grant_units TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.report_details TO dispatch_function_owner;
GRANT SELECT ON dispatch_private.report_scope_segments TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.road_impacts TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.road_impact_revisions TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.content_screening_decisions TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.content_quarantine TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_audit.content_remediation_events TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.publication_reviews TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.sharing_agreements TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.sharing_agreement_parties TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.sharing_agreement_units TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.shared_awareness_representations TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.shared_awareness_recipients TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_private.reviewer_authorizations TO dispatch_function_owner;
GRANT SELECT,INSERT ON dispatch_private.review_state_snapshots TO dispatch_function_owner;
GRANT SELECT,INSERT,UPDATE ON dispatch_projection.report_public_projections TO dispatch_function_owner;
GRANT SELECT,INSERT,DELETE ON dispatch_private.report_redaction_context TO dispatch_function_owner;
CREATE OR REPLACE FUNCTION dispatch_private.reject_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE subject uuid; token uuid; expected jsonb; BEGIN
 IF TG_TABLE_NAME='record_revisions' AND TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM dispatch_private.report_redaction_context c WHERE c.transaction_id=txid_current() AND c.record_id=(to_jsonb(OLD)->>'record_id')::uuid) AND (to_jsonb(NEW)-'snapshot')=(to_jsonb(OLD)-'snapshot') AND NEW.snapshot=jsonb_build_object('redacted',true,'record_id',(to_jsonb(OLD)->>'record_id')::uuid,'revision',(to_jsonb(OLD)->>'revision_number')::integer) THEN RETURN NEW; END IF;
 SELECT user_id INTO subject FROM dispatch_private.erasure_context WHERE transaction_id=txid_current();
 IF TG_OP='UPDATE' AND subject IS NOT NULL THEN
  SELECT t.token INTO token FROM dispatch_private.actor_tokens t WHERE t.organization_id=(to_jsonb(OLD)->>'organization_id')::uuid AND t.user_id=subject;
  expected:=dispatch_private.erase_json(to_jsonb(OLD),subject,token);
  IF to_jsonb(OLD)->>'actor_user_id'=subject::text THEN expected:=jsonb_set(jsonb_set(expected,'{actor_user_id}','null'),'{actor_token}',to_jsonb(token)); END IF;
  IF TG_TABLE_NAME='command_receipts' AND to_jsonb(OLD)->>'actor_user_id'=subject::text THEN expected:=jsonb_set(expected,'{session_id}','null'); END IF;
  IF to_jsonb(NEW)=expected THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'append-only';
END $$;
CREATE TRIGGER phase29_append_only BEFORE UPDATE OR DELETE ON dispatch_private.review_state_snapshots FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER phase29_append_only BEFORE UPDATE OR DELETE ON dispatch_private.road_impact_revisions FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER phase29_append_only BEFORE UPDATE OR DELETE ON dispatch_private.content_screening_decisions FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER phase29_append_only BEFORE UPDATE OR DELETE ON dispatch_audit.content_remediation_events FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
GRANT CREATE ON SCHEMA dispatch_private TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.report_department(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_department(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_keys(jsonb,text[]) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_keys(jsonb,text[]) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_screen(jsonb) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_screen(jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_impact_guard() OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_impact_guard() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_required_keys(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_required_keys(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_grants_valid(uuid,uuid[]) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_grants_valid(uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_review_state(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_review_state(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_capture_review_state() OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_capture_review_state() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_review_state_valid(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_review_state_valid(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_reviewer_authorized(uuid,uuid,uuid,uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_reviewer_authorized(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_review_authorization_guard() OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_review_authorization_guard() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_review_prerequisites(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_review_prerequisites(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_review_attempt_eligible(uuid,uuid,uuid,uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_review_attempt_eligible(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_public_eligible(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_public_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_shared_eligible(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_shared_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.pilot_candidate_eligible(uuid,uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.pilot_candidate_eligible(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_projection_eligible(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_projection_eligible(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_safe_impacts(uuid) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_safe_impacts(uuid) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION dispatch_private.report_execute(text,jsonb) OWNER TO dispatch_function_owner; REVOKE ALL ON FUNCTION dispatch_private.report_execute(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE CREATE ON SCHEMA dispatch_private FROM dispatch_function_owner;
REVOKE EXECUTE ON FUNCTION dispatch_private.execute_command(text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION dispatch_private.report_execute(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.grant_review_authorization(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('grant_review_authorization',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.grant_review_authorization(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.grant_review_authorization(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_review_authorization(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_review_authorization',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_review_authorization(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_review_authorization(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.create_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('create_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.create_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.create_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revise_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revise_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revise_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revise_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.set_road_impact(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('set_road_impact',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.set_road_impact(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.set_road_impact(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.approve_report_content(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('approve_report_content',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.approve_report_content(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.approve_report_content(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.submit_report_publication(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('submit_report_publication',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.submit_report_publication(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.submit_report_publication(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.review_report_publication(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('review_report_publication',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.review_report_publication(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.review_report_publication(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.publish_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('publish_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.publish_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.publish_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.withdraw_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('withdraw_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.withdraw_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.withdraw_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.quarantine_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('quarantine_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.quarantine_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.quarantine_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.redact_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('redact_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.redact_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.redact_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.grant_report_capability(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('grant_report_capability',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.grant_report_capability(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.grant_report_capability(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.renew_report_capability(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('renew_report_capability',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.renew_report_capability(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.renew_report_capability(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.create_sharing_agreement(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('create_sharing_agreement',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.create_sharing_agreement(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.create_sharing_agreement(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.approve_sharing_agreement(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('approve_sharing_agreement',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.approve_sharing_agreement(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.approve_sharing_agreement(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_sharing_agreement(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_sharing_agreement',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_sharing_agreement(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_sharing_agreement(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.share_report(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('share_report',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.share_report(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.share_report(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_report_share(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_report_share',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_report_share(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_report_share(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.create_operational_record(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('create_operational_record',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.create_operational_record(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.create_operational_record(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.update_operational_record(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('update_operational_record',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.update_operational_record(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.update_operational_record(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.assign_operational_record(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('assign_operational_record',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.assign_operational_record(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.assign_operational_record(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.close_operational_record(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('close_operational_record',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.close_operational_record(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.close_operational_record(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.transition_operational_record(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('transition_operational_record',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.transition_operational_record(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.transition_operational_record(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.invite_member(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('invite_member',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.invite_member(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.invite_member(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_invitation(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_invitation',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_invitation(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_invitation(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.accept_invitation(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('accept_invitation',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.accept_invitation(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.accept_invitation(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.change_member_role(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('change_member_role',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.change_member_role(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.change_member_role(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.suspend_member(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('suspend_member',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.suspend_member(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.suspend_member(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.reactivate_member(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('reactivate_member',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.reactivate_member(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.reactivate_member(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_member(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_member',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_member(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_member(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.initiate_ownership_transfer(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('initiate_ownership_transfer',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.initiate_ownership_transfer(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.initiate_ownership_transfer(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.accept_ownership_transfer(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('accept_ownership_transfer',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.accept_ownership_transfer(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.accept_ownership_transfer(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.cancel_ownership_transfer(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('cancel_ownership_transfer',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.cancel_ownership_transfer(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.cancel_ownership_transfer(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.grant_capability(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('grant_capability',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.grant_capability(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.grant_capability(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.suspend_capability(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('suspend_capability',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.suspend_capability(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.suspend_capability(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_capability(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_capability',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_capability(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_capability(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.renew_capability(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('renew_capability',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.renew_capability(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.renew_capability(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.submit_projection_candidate(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('submit_projection_candidate',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.submit_projection_candidate(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.submit_projection_candidate(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.approve_projection(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('approve_projection',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.approve_projection(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.approve_projection(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.reject_projection(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('reject_projection',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.reject_projection(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.reject_projection(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.publish_projection(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('publish_projection',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.publish_projection(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.publish_projection(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.withdraw_projection(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('withdraw_projection',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.withdraw_projection(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.withdraw_projection(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.start_ownership_recovery(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('start_ownership_recovery',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.start_ownership_recovery(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.start_ownership_recovery(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.approve_ownership_recovery(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('approve_ownership_recovery',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.approve_ownership_recovery(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.approve_ownership_recovery(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.set_organization_verification(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('set_organization_verification',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.set_organization_verification(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.set_organization_verification(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.set_organization_status(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('set_organization_status',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.set_organization_status(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.set_organization_status(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.renew_verification(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('renew_verification',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.renew_verification(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.renew_verification(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.renew_attestation(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('renew_attestation',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.renew_attestation(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.renew_attestation(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.offboard_organization(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('offboard_organization',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.offboard_organization(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.offboard_organization(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.create_unit(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('create_unit',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.create_unit(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.create_unit(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.set_unit_membership(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('set_unit_membership',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.set_unit_membership(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.set_unit_membership(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.advance_onboarding(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('advance_onboarding',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.advance_onboarding(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.advance_onboarding(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.offboard_unit(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('offboard_unit',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.offboard_unit(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.offboard_unit(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.create_internal_share(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('create_internal_share',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.create_internal_share(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.create_internal_share(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.replace_internal_share_recipients(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('replace_internal_share_recipients',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.replace_internal_share_recipients(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.replace_internal_share_recipients(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.revoke_internal_share(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('revoke_internal_share',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.revoke_internal_share(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.revoke_internal_share(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.begin_user_offboarding(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('begin_user_offboarding',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.begin_user_offboarding(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.begin_user_offboarding(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION dispatch_api.complete_user_offboarding(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$ SELECT dispatch_private.report_execute('complete_user_offboarding',p_payload) $fn$; REVOKE ALL ON FUNCTION dispatch_api.complete_user_offboarding(jsonb) FROM PUBLIC,anon,service_role; GRANT EXECUTE ON FUNCTION dispatch_api.complete_user_offboarding(jsonb) TO authenticated;
CREATE POLICY report_public_read ON dispatch_projection.report_public_projections FOR SELECT TO anon,authenticated USING(dispatch_private.report_projection_eligible(id));
GRANT SELECT(id,organization_id,unit_id,subtype,title,summary,public_impacts,expires_at) ON dispatch_projection.report_public_projections TO anon,authenticated;
GRANT EXECUTE ON FUNCTION dispatch_private.report_projection_eligible(uuid) TO anon,authenticated;
CREATE VIEW dispatch_api.durable_public_reports WITH(security_invoker=true) AS SELECT id,organization_id,unit_id,subtype,title,summary,public_impacts,expires_at FROM dispatch_projection.report_public_projections;
GRANT SELECT ON dispatch_api.durable_public_reports TO anon,authenticated;
CREATE POLICY report_shared_read ON dispatch_private.shared_awareness_representations FOR SELECT TO authenticated USING(dispatch_private.report_shared_eligible(id));
GRANT SELECT(id,title,summary,valid_until) ON dispatch_private.shared_awareness_representations TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_private.report_shared_eligible(uuid) TO authenticated;
CREATE VIEW dispatch_api.durable_shared_awareness WITH(security_invoker=true) AS SELECT id,title,summary,valid_until FROM dispatch_private.shared_awareness_representations;
GRANT SELECT ON dispatch_api.durable_shared_awareness TO authenticated;
REVOKE dispatch_function_owner FROM postgres;
NOTIFY pgrst,'reload schema';

-- PHASE D
GRANT dispatch_function_owner TO postgres;
-- Phase prerequisite independently checked by installer A and single transaction.

CREATE TABLE dispatch_private.invitation_delivery_attempts(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,
 invitation_id uuid NOT NULL UNIQUE REFERENCES dispatch_private.organization_invitations,recipient_token uuid NOT NULL,
 prior_invitation_id uuid REFERENCES dispatch_private.organization_invitations,request_id uuid NOT NULL UNIQUE,request_digest bytea NOT NULL,
 mode text NOT NULL CHECK(mode IN('EMAIL','MANUAL')),status text NOT NULL CHECK(status IN('PENDING','SENDING','SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED')),
 provider_message_id text UNIQUE CHECK(provider_message_id ~ '^[-a-zA-Z0-9_]{1,100}$'),actor_token uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),fallback_reason text CHECK(fallback_reason IN('DELIVERY_RECOVERY','ACCESSIBILITY','PROVIDER_OUTAGE')),
 disclosed_at timestamptz, CHECK((mode='MANUAL')=(disclosed_at IS NOT NULL)));
CREATE TABLE dispatch_private.invitation_provider_events(
 provider_event_id text PRIMARY KEY CHECK(provider_event_id ~ '^[-a-zA-Z0-9_]{1,100}$'),attempt_id uuid NOT NULL REFERENCES dispatch_private.invitation_delivery_attempts,
 status text NOT NULL CHECK(status IN('SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED')),occurred_at timestamptz NOT NULL,received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE dispatch_private.invitation_delivery_suppressions(
 organization_id uuid NOT NULL REFERENCES dispatch_private.organizations,recipient_token uuid NOT NULL,active boolean NOT NULL,
 reason text NOT NULL CHECK(reason IN('BOUNCED','COMPLAINED','MANUAL','CLEARED')),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(organization_id,recipient_token));
CREATE TABLE dispatch_audit.invitation_delivery_events(
 id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),organization_id uuid NOT NULL,actor_token uuid,invitation_id uuid,
 request_id uuid UNIQUE,request_digest bytea CHECK(request_digest IS NULL OR octet_length(request_digest)=32),
 event_type text NOT NULL CHECK(event_type IN('ISSUED','REISSUED','MANUAL_DISCLOSED','SUPPRESSED','SUPPRESSION_CLEARED','PROVIDER_STATUS')),
 reason text CHECK(reason IN('DELIVERY_RECOVERY','ACCESSIBILITY','PROVIDER_OUTAGE','BOUNCED','COMPLAINED','MANUAL','CLEARED','SENT','DELIVERED','FAILED','DELAYED')),
 created_at timestamptz NOT NULL DEFAULT now(),policy_version text NOT NULL DEFAULT 'DAYTON-INVITE-01-v1');
CREATE FUNCTION dispatch_private.invitation_issue(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid:=(p->>'organization_id')::uuid; actor uuid:=dispatch_private.current_actor_id(); mid uuid; previous dispatch_private.organization_invitations%ROWTYPE;
 target uuid:=(p->>'target_user_id')::uuid; req uuid:=(p->>'idempotency_key')::uuid; inv uuid:=extensions.gen_random_uuid(); attempt uuid:=extensions.gen_random_uuid(); tok uuid; mode text:=p->>'mode'; unitname text;
BEGIN
 IF NOT dispatch_private.has_live_aal2() OR actor IS NULL OR org IS NULL OR req IS NULL OR target IS NULL THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN'; END IF;
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','target_user_id','role','idempotency_key','prior_invitation_id','expected_revision','token_digest','mode','fallback_reason','recipient_confirmed','unit_id']);
 PERFORM pg_advisory_xact_lock(280028);PERFORM 1 FROM dispatch_private.organizations WHERE id=org AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN';END IF;
 mid:=dispatch_private.actor_membership(org,'members.invite');IF mid IS NULL THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN';END IF;
 IF p->>'unit_id' IS NOT NULL THEN IF NOT dispatch_private.unit_access(org,(p->>'unit_id')::uuid,'members.invite') THEN RAISE EXCEPTION 'DELIVERY_UNIT';END IF;SELECT display_name INTO unitname FROM dispatch_private.organization_units WHERE id=(p->>'unit_id')::uuid AND organization_id=org;END IF;
 tok:=dispatch_private.token_for(org,actor);
 IF EXISTS(SELECT 1 FROM dispatch_private.invitation_delivery_attempts WHERE request_id=req) THEN RAISE EXCEPTION 'DELIVERY_ALREADY_CONSUMED';END IF;
 IF mode NOT IN('EMAIL','MANUAL') OR mode IS NULL OR coalesce(p->>'token_digest','') !~ '^[a-f0-9]{64}$' OR p->>'role'='OWNER' OR p->>'role' IS NULL THEN RAISE EXCEPTION 'DELIVERY_INPUT';END IF;
 IF mode='EMAIL' AND EXISTS(SELECT 1 FROM dispatch_private.invitation_delivery_suppressions WHERE organization_id=org AND recipient_token=dispatch_private.token_for(org,target) AND active) THEN RAISE EXCEPTION 'DELIVERY_SUPPRESSED';END IF;
 IF p->>'prior_invitation_id' IS NOT NULL THEN
  SELECT * INTO previous FROM dispatch_private.organization_invitations WHERE id=(p->>'prior_invitation_id')::uuid AND organization_id=org FOR UPDATE;
  IF NOT FOUND OR previous.target_identity<>'user:'||target::text OR previous.status<>'PENDING' OR previous.revision IS DISTINCT FROM (p->>'expected_revision')::int THEN RAISE EXCEPTION 'DELIVERY_STALE';END IF;
  UPDATE dispatch_private.organization_invitations SET status='REVOKED',revoked_at=now(),revision=revision+1 WHERE id=previous.id;
 END IF;
 IF mode='MANUAL' AND (previous.id IS NULL OR coalesce((p->>'recipient_confirmed')::boolean,false)=false OR coalesce(p->>'fallback_reason','') NOT IN('DELIVERY_RECOVERY','ACCESSIBILITY','PROVIDER_OUTAGE')) THEN RAISE EXCEPTION 'DELIVERY_MANUAL_BOUNDARY';END IF;
 INSERT INTO dispatch_private.organization_invitations(id,organization_id,target_identity,role_template,token_digest,expires_at,created_by_membership_id)
 VALUES(inv,org,'user:'||target::text,(p->>'role')::dispatch_private.role_template_key,decode(p->>'token_digest','hex'),now()+interval '168 hours',mid);
 INSERT INTO dispatch_private.invitation_delivery_attempts(id,organization_id,invitation_id,recipient_token,prior_invitation_id,request_id,request_digest,mode,status,actor_token,fallback_reason,disclosed_at)
 VALUES(attempt,org,inv,dispatch_private.token_for(org,target),previous.id,req,dispatch_private.request_hash(p),mode,CASE WHEN mode='MANUAL' THEN 'SENT' ELSE 'PENDING' END,tok,CASE WHEN mode='MANUAL' THEN p->>'fallback_reason' END,CASE WHEN mode='MANUAL' THEN now() END);
 INSERT INTO dispatch_audit.invitation_delivery_events(organization_id,actor_token,invitation_id,event_type,reason) VALUES(org,tok,inv,CASE WHEN mode='MANUAL' THEN 'MANUAL_DISCLOSED' WHEN previous.id IS NOT NULL THEN 'REISSUED' ELSE 'ISSUED' END,CASE WHEN mode='MANUAL' THEN p->>'fallback_reason' END);
 RETURN jsonb_build_object('invitationId',inv,'attemptId',attempt,'expiresAt',now()+interval '168 hours','organization',(SELECT display_name FROM dispatch_private.organizations WHERE id=org),'unit',unitname);
END $$;
CREATE FUNCTION dispatch_private.invitation_suppress(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid:=(p->>'organization_id')::uuid; target uuid:=(p->>'target_user_id')::uuid; tok uuid; active boolean:=(p->>'active')::boolean; req uuid:=(p->>'idempotency_key')::uuid; prior dispatch_audit.invitation_delivery_events%ROWTYPE;
BEGIN
 PERFORM dispatch_private.report_keys(p,ARRAY['organization_id','target_user_id','active','idempotency_key']);
 IF NOT dispatch_private.has_live_aal2() OR dispatch_private.actor_membership(org,'members.invite') IS NULL OR target IS NULL OR active IS NULL OR req IS NULL THEN RAISE EXCEPTION 'DELIVERY_FORBIDDEN';END IF;
 PERFORM pg_advisory_xact_lock(280028);tok:=dispatch_private.token_for(org,dispatch_private.current_actor_id());
 SELECT * INTO prior FROM dispatch_audit.invitation_delivery_events WHERE request_id=req;IF FOUND THEN IF prior.organization_id<>org OR prior.actor_token<>tok OR prior.request_digest<>dispatch_private.request_hash(p) THEN RAISE EXCEPTION 'DELIVERY_REPLAY_MISMATCH';END IF;RETURN jsonb_build_object('status','RECORDED','replay',true);END IF;
 INSERT INTO dispatch_private.invitation_delivery_suppressions VALUES(org,dispatch_private.token_for(org,target),active,CASE WHEN active THEN 'MANUAL' ELSE 'CLEARED' END,now()) ON CONFLICT(organization_id,recipient_token) DO UPDATE SET active=EXCLUDED.active,reason=EXCLUDED.reason,updated_at=now();
 INSERT INTO dispatch_audit.invitation_delivery_events(organization_id,actor_token,event_type,reason,request_id,request_digest) VALUES(org,tok,CASE WHEN active THEN 'SUPPRESSED' ELSE 'SUPPRESSION_CLEARED' END,CASE WHEN active THEN 'MANUAL' ELSE 'CLEARED' END,req,dispatch_private.request_hash(p));
 RETURN jsonb_build_object('status','RECORDED');
END $$;
-- Transport role is a trusted server port, never granted to browser/service_role.
CREATE ROLE dispatch_delivery_transport NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE FUNCTION dispatch_private.invitation_claim_send(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a dispatch_private.invitation_delivery_attempts%ROWTYPE;
BEGIN
 SELECT * INTO a FROM dispatch_private.invitation_delivery_attempts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR a.mode<>'EMAIL' OR a.status<>'PENDING' THEN RETURN false;END IF;
 PERFORM 1 FROM dispatch_private.organization_invitations i JOIN dispatch_private.organizations o ON o.id=i.organization_id WHERE i.id=a.invitation_id AND i.status='PENDING' AND i.expires_at>now() AND o.status='ACTIVE' FOR UPDATE OF i;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM dispatch_private.invitation_delivery_suppressions WHERE organization_id=a.organization_id AND recipient_token=a.recipient_token AND active) THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM dispatch_private.actor_tokens t JOIN dispatch_private.profiles p ON p.user_id=t.user_id JOIN dispatch_private.organization_memberships m ON m.user_id=t.user_id AND m.organization_id=t.organization_id JOIN dispatch_private.role_permissions rp ON rp.role_key=m.role_template WHERE t.organization_id=a.organization_id AND t.token=a.actor_token AND p.status='ACTIVE' AND m.status='ACTIVE' AND rp.permission_key='members.invite') THEN RETURN false;END IF;
 UPDATE dispatch_private.invitation_delivery_attempts SET status='SENDING' WHERE id=p_id;RETURN true;
END $$;
CREATE FUNCTION dispatch_private.invitation_transport_result(p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a dispatch_private.invitation_delivery_attempts%ROWTYPE; s text:=p->>'status';msg text:=p->>'messageId';eid text:=p->>'eventId';t timestamptz:=coalesce((p->>'occurredAt')::timestamptz,now());rank int;
BEGIN
 PERFORM dispatch_private.report_keys(p,ARRAY['attemptId','status','messageId','eventId','occurredAt','reason']);
 IF s NOT IN('SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED') OR s IS NULL OR t>now()+interval '5 minutes' THEN RAISE EXCEPTION 'DELIVERY_EVENT_INPUT';END IF;
 IF p->>'attemptId' IS NOT NULL THEN SELECT * INTO a FROM dispatch_private.invitation_delivery_attempts WHERE id=(p->>'attemptId')::uuid FOR UPDATE;
 ELSE SELECT * INTO a FROM dispatch_private.invitation_delivery_attempts WHERE provider_message_id=msg FOR UPDATE; END IF;
 IF NOT FOUND OR a.mode<>'EMAIL' THEN RAISE EXCEPTION 'DELIVERY_UNKNOWN';END IF;
 IF eid IS NOT NULL THEN
  IF a.provider_message_id IS DISTINCT FROM msg THEN RAISE EXCEPTION 'DELIVERY_CORRELATION';END IF;
  IF EXISTS(SELECT 1 FROM dispatch_private.invitation_provider_events WHERE provider_event_id=eid) THEN
   IF NOT EXISTS(SELECT 1 FROM dispatch_private.invitation_provider_events WHERE provider_event_id=eid AND attempt_id=a.id AND status=s AND occurred_at=t) THEN RAISE EXCEPTION 'DELIVERY_EVENT_CONFLICT';END IF;RETURN;
  END IF;
  INSERT INTO dispatch_private.invitation_provider_events VALUES(eid,a.id,s,t,now());
 ELSE
  IF s NOT IN('SENT','FAILED') OR a.status<>'SENDING' THEN RAISE EXCEPTION 'DELIVERY_RESULT_CONSUMED';END IF;
  IF s='SENT' AND (msg IS NULL OR msg !~ '^[-a-zA-Z0-9_]{1,100}$') THEN RAISE EXCEPTION 'DELIVERY_MESSAGE';END IF;
  UPDATE dispatch_private.invitation_delivery_attempts SET provider_message_id=msg WHERE id=a.id;
 END IF;
 -- Adverse terminal status cannot be downgraded by a late successful event.
 IF (CASE s WHEN 'COMPLAINED' THEN 6 WHEN 'BOUNCED' THEN 5 WHEN 'FAILED' THEN 4 WHEN 'DELIVERED' THEN 3 WHEN 'DELAYED' THEN 2 ELSE 1 END) >= (CASE a.status WHEN 'COMPLAINED' THEN 6 WHEN 'BOUNCED' THEN 5 WHEN 'FAILED' THEN 4 WHEN 'DELIVERED' THEN 3 WHEN 'DELAYED' THEN 2 WHEN 'SENT' THEN 1 ELSE 0 END) THEN UPDATE dispatch_private.invitation_delivery_attempts SET status=s WHERE id=a.id;END IF;
 IF s IN('BOUNCED','COMPLAINED') THEN
  INSERT INTO dispatch_private.invitation_delivery_suppressions VALUES(a.organization_id,a.recipient_token,true,s,now()) ON CONFLICT(organization_id,recipient_token) DO UPDATE SET active=true,reason=EXCLUDED.reason,updated_at=now();
 END IF;
 INSERT INTO dispatch_audit.invitation_delivery_events(organization_id,invitation_id,event_type,reason) VALUES(a.organization_id,a.invitation_id,'PROVIDER_STATUS',s);
END $$;
DO $$ DECLARE n text;BEGIN FOREACH n IN ARRAY ARRAY['dispatch_private.invitation_delivery_attempts','dispatch_private.invitation_provider_events','dispatch_private.invitation_delivery_suppressions','dispatch_audit.invitation_delivery_events'] LOOP EXECUTE 'ALTER TABLE '||n||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||n||' FORCE ROW LEVEL SECURITY';EXECUTE 'REVOKE ALL ON '||n||' FROM PUBLIC,anon,authenticated,service_role';EXECUTE 'GRANT SELECT,INSERT,UPDATE ON '||n||' TO dispatch_function_owner';END LOOP; END $$;
CREATE TRIGGER invitation_event_immutable BEFORE UPDATE OR DELETE ON dispatch_private.invitation_provider_events FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
CREATE TRIGGER invitation_audit_immutable BEFORE UPDATE OR DELETE ON dispatch_audit.invitation_delivery_events FOR EACH ROW EXECUTE FUNCTION dispatch_private.reject_append_only();
GRANT CREATE ON SCHEMA dispatch_private TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_issue(jsonb) OWNER TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_suppress(jsonb) OWNER TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_transport_result(jsonb) OWNER TO dispatch_function_owner;
ALTER FUNCTION dispatch_private.invitation_claim_send(uuid) OWNER TO dispatch_function_owner;
REVOKE ALL ON FUNCTION dispatch_private.invitation_claim_send(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.invitation_claim_send(uuid) TO dispatch_delivery_transport;
REVOKE CREATE ON SCHEMA dispatch_private FROM dispatch_function_owner;
REVOKE ALL ON FUNCTION dispatch_private.invitation_issue(jsonb),dispatch_private.invitation_suppress(jsonb),dispatch_private.invitation_transport_result(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dispatch_private.invitation_issue(jsonb),dispatch_private.invitation_suppress(jsonb) TO authenticated;
GRANT USAGE ON SCHEMA dispatch_private TO dispatch_delivery_transport;
GRANT EXECUTE ON FUNCTION dispatch_private.invitation_transport_result(jsonb) TO dispatch_delivery_transport;
CREATE FUNCTION dispatch_api.issue_dispatch_invitation(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT dispatch_private.invitation_issue(p_payload) $$;
CREATE FUNCTION dispatch_api.set_delivery_suppression(p_payload jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT dispatch_private.invitation_suppress(p_payload) $$;
REVOKE ALL ON FUNCTION dispatch_api.issue_dispatch_invitation(jsonb),dispatch_api.set_delivery_suppression(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION dispatch_api.issue_dispatch_invitation(jsonb),dispatch_api.set_delivery_suppression(jsonb) TO authenticated;
REVOKE dispatch_function_owner FROM postgres;
NOTIFY pgrst,'reload schema';

-- PHASE E
-- Phase prerequisite independently checked by installer A and single transaction.

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

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('dispatch_private','dispatch_audit','dispatch_projection') AND c.relkind='r' AND NOT(c.relrowsecurity AND c.relforcerowsecurity)) THEN RAISE EXCEPTION 'RLS drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'dispatch_%' AND p.prosecdef AND p.proconfig IS DISTINCT FROM ARRAY['search_path=""']) THEN RAISE EXCEPTION 'search_path drift'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner WHERE n.nspname LIKE 'dispatch_%' AND p.prosecdef AND r.rolname='postgres')<>1 THEN RAISE EXCEPTION 'Auth bridge owner drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.proname IN('current_actor_id','current_session_id') AND p.prosecdef) THEN RAISE EXCEPTION 'identity bridge drift'; END IF;
 IF has_table_privilege('authenticated','dispatch_private.operational_records','SELECT') OR has_column_privilege('authenticated','dispatch_private.operational_records','private_payload','SELECT') OR has_any_column_privilege('anon','dispatch_projection.projection_candidates','SELECT') OR has_any_column_privilege('authenticated','dispatch_projection.projection_candidates','SELECT') THEN RAISE EXCEPTION 'raw grant drift'; END IF;
 IF has_function_privilege('authenticated','dispatch_private.phase26_command(text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'legacy bypass'; END IF;
 IF has_function_privilege('authenticated','dispatch_private.phase28_partial_command(text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','dispatch_private.pseudonymize_user(uuid)','EXECUTE') OR has_function_privilege('authenticated','dispatch_private.check_proof(uuid,uuid,text,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'closure helper bypass'; END IF;
 IF has_any_column_privilege('authenticated','dispatch_private.auth_check_context','SELECT') OR has_table_privilege('authenticated','dispatch_private.auth_check_context','INSERT') OR has_table_privilege('authenticated','dispatch_private.erasure_context','INSERT') OR has_any_column_privilege('authenticated','dispatch_private.approval_proofs','SELECT') THEN RAISE EXCEPTION 'proof/context exposure'; END IF;
 IF EXISTS(SELECT 1 FROM dispatch_private.auth_check_context) OR EXISTS(SELECT 1 FROM dispatch_private.erasure_context) THEN RAISE EXCEPTION 'transaction context residue'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='dispatch_private.has_live_aal2()'::regprocedure AND pronargs=0 AND prorettype='boolean'::regtype AND proowner=(SELECT oid FROM pg_roles WHERE rolname='postgres')) THEN RAISE EXCEPTION 'bounded bridge contract drift'; END IF;
 IF has_schema_privilege('dispatch_function_owner','dispatch_private','CREATE') THEN RAISE EXCEPTION 'DDL grant drift'; END IF;
 IF has_any_column_privilege('dispatch_function_owner','auth.users','SELECT') OR has_any_column_privilege('dispatch_function_owner','auth.sessions','SELECT') OR has_any_column_privilege('dispatch_function_owner','auth.mfa_factors','SELECT') THEN RAISE EXCEPTION 'Auth table grant drift'; END IF;
 IF to_regclass('dispatch_api.responder_public_projection') IS NOT NULL THEN RAISE EXCEPTION 'permanent compatibility forbidden'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='dispatch_function_owner' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR NOT rolbypassrls)) THEN RAISE EXCEPTION 'owner role drift'; END IF;
END $$;
SELECT 'PHASE28_POSTFLIGHT_PASS';
DO $post$ DECLARE r text; BEGIN
 IF (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'dispatch\_%' ESCAPE '\')<>3 THEN RAISE EXCEPTION 'POSTFLIGHT roles'; END IF;
 FOREACH r IN ARRAY ARRAY['dispatch_delivery_connection','dispatch_delivery_transport'] LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r AND NOT rolinherit AND NOT rolbypassrls AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND rolcanlogin=(r='dispatch_delivery_connection')) THEN RAISE EXCEPTION 'POSTFLIGHT transport attributes'; END IF; END LOOP;
 IF (SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='dispatch_delivery_connection'))<>1 OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='dispatch_delivery_connection') AND roleid=(SELECT oid FROM pg_roles WHERE rolname='dispatch_delivery_transport') AND NOT admin_option AND NOT inherit_option AND set_option) THEN RAISE EXCEPTION 'POSTFLIGHT membership'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND (set_option OR inherit_option) AND roleid IN(SELECT oid FROM pg_roles WHERE rolname LIKE 'dispatch\_%' ESCAPE '\')) THEN RAISE EXCEPTION 'POSTFLIGHT elevated installer membership'; END IF;
 IF has_schema_privilege('dispatch_delivery_connection','public','CREATE') OR has_database_privilege('dispatch_delivery_connection','postgres','CREATE') THEN RAISE EXCEPTION 'POSTFLIGHT connection DDL'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'dispatch\_%' ESCAPE '\' AND c.relkind IN('r','p') AND (has_any_column_privilege('dispatch_delivery_connection',c.oid,'SELECT') OR has_table_privilege('dispatch_delivery_transport',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) THEN RAISE EXCEPTION 'POSTFLIGHT transport table access'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'dispatch\_%' ESCAPE '\' AND has_function_privilege('dispatch_delivery_transport',p.oid,'EXECUTE') AND p.proname NOT IN('invitation_claim_send','invitation_transport_result')) THEN RAISE EXCEPTION 'POSTFLIGHT transport command access'; END IF;
 IF (SELECT count(*) FROM dispatch_private.report_subtypes WHERE public_eligible)<>18 OR (SELECT count(*) FROM dispatch_private.department_report_policies)<>104 OR (SELECT count(*) FROM dispatch_private.capability_catalog WHERE NOT legacy)<>18 THEN RAISE EXCEPTION 'POSTFLIGHT registry'; END IF;
 IF EXISTS(SELECT 1 FROM dispatch_private.report_contract_versions WHERE publishing_enabled) OR EXISTS(SELECT 1 FROM dispatch_private.organizations) OR EXISTS(SELECT 1 FROM dispatch_private.organization_units) OR EXISTS(SELECT 1 FROM dispatch_private.capability_grants) OR EXISTS(SELECT 1 FROM dispatch_private.organization_invitations) THEN RAISE EXCEPTION 'POSTFLIGHT activation forbidden'; END IF;
 IF to_regclass('dispatch_private.reviewer_authorizations') IS NULL OR to_regprocedure('dispatch_private.report_review_attempt_eligible(uuid,uuid,uuid,uuid)') IS NULL OR to_regclass('dispatch_private.invitation_delivery_suppressions') IS NULL THEN RAISE EXCEPTION 'POSTFLIGHT governance objects'; END IF;
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname='postgres') AND d.defaclnamespace IN(0,(SELECT oid FROM pg_namespace WHERE nspname='public')) AND a.grantee IN(0,(SELECT oid FROM pg_roles WHERE rolname='anon'),(SELECT oid FROM pg_roles WHERE rolname='authenticated'),(SELECT oid FROM pg_roles WHERE rolname='service_role')) AND d.defaclobjtype IN('r','S')) THEN RAISE EXCEPTION 'POSTFLIGHT future table ACL'; END IF;
 IF to_regnamespace('gridly_rehearsal') IS NOT NULL OR to_regnamespace('report_retention') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p','v','m')) THEN RAISE EXCEPTION 'POSTFLIGHT unexpected application namespace'; END IF;
END $post$;
DO $inventory$ BEGIN IF (SELECT array_agg(n.nspname||'.'||c.relname ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'dispatch\_%' ESCAPE '\' AND c.relkind IN('r','p')) IS DISTINCT FROM ARRAY['dispatch_audit.audit_events','dispatch_audit.command_receipts','dispatch_audit.command_versions','dispatch_audit.content_remediation_events','dispatch_audit.invitation_delivery_events','dispatch_audit.pilot_events','dispatch_audit.record_revisions','dispatch_private.actor_tokens','dispatch_private.approval_proofs','dispatch_private.auth_check_context','dispatch_private.capability_catalog','dispatch_private.capability_grant_constraints','dispatch_private.capability_grant_units','dispatch_private.capability_grants','dispatch_private.capability_requirements','dispatch_private.content_quarantine','dispatch_private.content_screening_decisions','dispatch_private.department_report_policies','dispatch_private.erasure_context','dispatch_private.internal_awareness','dispatch_private.internal_share_recipients','dispatch_private.invitation_delivery_attempts','dispatch_private.invitation_delivery_suppressions','dispatch_private.invitation_provider_events','dispatch_private.operational_records','dispatch_private.operational_scope_members','dispatch_private.operational_scopes','dispatch_private.organization_invitations','dispatch_private.organization_memberships','dispatch_private.organization_units','dispatch_private.organizations','dispatch_private.ownership_recovery_cases','dispatch_private.ownership_transfers','dispatch_private.permissions','dispatch_private.pilot_governance','dispatch_private.platform_admin_grants','dispatch_private.profiles','dispatch_private.publication_reviews','dispatch_private.record_assignments','dispatch_private.record_provenance','dispatch_private.recovery_approvals','dispatch_private.report_contract_versions','dispatch_private.report_details','dispatch_private.report_families','dispatch_private.report_redaction_context','dispatch_private.report_scope_segments','dispatch_private.report_subtypes','dispatch_private.review_state_snapshots','dispatch_private.reviewer_authorizations','dispatch_private.road_impact_revisions','dispatch_private.road_impacts','dispatch_private.role_permissions','dispatch_private.role_templates','dispatch_private.scope_governance','dispatch_private.shared_awareness_recipients','dispatch_private.shared_awareness_representations','dispatch_private.sharing_agreement_parties','dispatch_private.sharing_agreement_units','dispatch_private.sharing_agreements','dispatch_private.unit_memberships','dispatch_private.unit_scope_grants','dispatch_private.user_offboarding','dispatch_projection.projection_candidates','dispatch_projection.public_safe_projections','dispatch_projection.report_public_projections']::text[] THEN RAISE EXCEPTION 'POSTFLIGHT exact table inventory'; END IF; END $inventory$;
COMMIT;
