\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
BEGIN;
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

\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
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
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- Additive hardening applied in the SAME transaction as the Phase 26 baseline.
GRANT dispatch_function_owner TO postgres;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM gridly_rehearsal.environment WHERE marker='GRIDLY_PHASE26_LOCAL_SYNTHETIC' AND NOT production_access_authorized)
 THEN RAISE EXCEPTION 'PHASE28_STOP local synthetic marker required'; END IF;
 IF EXISTS(SELECT 1 FROM dispatch_private.organizations) THEN RAISE EXCEPTION 'PHASE28_STOP populated baseline'; END IF;
END $$;

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

-- LOCAL DISPOSABLE REHEARSAL ONLY. Applied in the same transaction as extension.sql.
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

COMMIT;
