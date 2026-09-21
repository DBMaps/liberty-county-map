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
