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
