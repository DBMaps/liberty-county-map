-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Phase 22 bounded SECURITY DEFINER command surface.

BEGIN;

CREATE FUNCTION dispatch_phase22_local.request_hash(p_payload jsonb)
RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT public.digest(pg_catalog.convert_to(p_payload::text,'UTF8'),'sha256')
$$;

CREATE FUNCTION dispatch_phase22_local.assert_uuid_v4(p_key uuid)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
  IF pg_catalog.substr(p_key::text,15,1)<>'4' THEN
    RAISE EXCEPTION 'operation token must be UUIDv4';
  END IF;
END $$;

CREATE FUNCTION dispatch_phase22_local.assert_live_session()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;
BEGIN
  IF NOT dispatch_phase22_local.session_has_live_aal2() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_actor := dispatch_phase22_local.current_actor_id();
  IF v_actor IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN v_actor;
END $$;

CREATE FUNCTION dispatch_phase22_local.assert_org_permission(
  p_organization_id uuid,p_permission text,p_scope_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_membership uuid;
BEGIN
  v_actor := dispatch_phase22_local.assert_live_session();
  IF dispatch_phase21_local.requested_organization_id() IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT m.id INTO v_membership
  FROM dispatch_phase21_local.organization_memberships m
  JOIN dispatch_phase21_local.organizations o ON o.id=m.organization_id
  JOIN dispatch_phase21_local.role_permissions rp ON rp.role_key=m.role_template
  JOIN dispatch_phase21_local.permissions p ON p.permission_key=rp.permission_key
  WHERE m.organization_id=p_organization_id AND m.user_id=v_actor
    AND m.status='ACTIVE' AND (m.expires_at IS NULL OR m.expires_at>statement_timestamp())
    AND o.status='ACTIVE' AND p.permission_key=p_permission AND p.scope_class='ORGANIZATION';
  IF v_membership IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_scope_id IS NOT NULL
    AND NOT dispatch_phase21_local.scope_allows(p_organization_id,p_scope_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN v_membership;
END $$;

CREATE FUNCTION dispatch_phase22_local.assert_platform_permission(
  p_permission text,p_organization_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := dispatch_phase22_local.assert_live_session();
  IF p_organization_id IS NOT NULL
    AND dispatch_phase21_local.requested_organization_id() IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT dispatch_phase21_local.has_platform_permission(p_permission) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN v_actor;
END $$;

CREATE FUNCTION dispatch_phase22_local.begin_command(
  p_organization_id uuid,p_command text,p_key uuid,p_hash bytea)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_existing dispatch_phase22_local.command_receipts%ROWTYPE;
  v_lock text;
BEGIN
  PERFORM dispatch_phase22_local.assert_uuid_v4(p_key);
  v_actor := dispatch_phase22_local.assert_live_session();
  v_lock := coalesce(p_organization_id::text,'platform')||':'||v_actor::text||':'||p_command||':'||p_key::text;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_lock,0));
  SELECT * INTO v_existing FROM dispatch_phase22_local.command_receipts
  WHERE organization_id IS NOT DISTINCT FROM p_organization_id
    AND actor_user_id=v_actor AND command_name=p_command AND idempotency_key=p_key;
  IF FOUND THEN
    IF v_existing.request_hash<>p_hash THEN RAISE EXCEPTION 'idempotency payload mismatch'; END IF;
    RETURN v_existing.result_ref;
  END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION dispatch_phase22_local.finish_command(
  p_organization_id uuid,p_command text,p_key uuid,p_hash bytea,p_result uuid,p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO dispatch_phase22_local.command_receipts
    (organization_id,actor_user_id,session_id,command_name,idempotency_key,request_hash,result_ref,result_payload)
  VALUES (p_organization_id,dispatch_phase22_local.current_actor_id(),
    dispatch_phase22_local.current_session_id(),p_command,p_key,p_hash,p_result,p_payload);
END $$;

CREATE FUNCTION dispatch_phase22_local.emit_audit(
  p_org uuid,p_membership uuid,p_event dispatch_phase21_local.audit_event_type,
  p_target_type text,p_target uuid,p_payload jsonb,p_key uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO dispatch_phase21_local.dispatch_audit_events
    (organization_id,actor_user_id,actor_membership_id,event_type,target_type,target_id,event_payload,operation_correlation_id)
  VALUES (p_org,dispatch_phase22_local.current_actor_id(),p_membership,p_event,
    p_target_type,p_target,p_payload,p_key);
END $$;

CREATE FUNCTION dispatch_phase22_local.maybe_fail(p_command text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM dispatch_phase22_local.failure_injections
    WHERE session_role=session_user AND command_name=p_command
      AND fail_after_step='BUSINESS_MUTATION') THEN
    RAISE EXCEPTION 'synthetic failure after business mutation';
  END IF;
END $$;

CREATE FUNCTION dispatch_phase22_local.append_record_evidence(
  p_org uuid,p_record uuid,p_revision integer,p_membership uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_record dispatch_phase21_local.operational_records%ROWTYPE;
  v_verification dispatch_phase21_local.verification_level;
BEGIN
  SELECT * INTO STRICT v_record FROM dispatch_phase21_local.operational_records WHERE id=p_record;
  SELECT verification_level INTO STRICT v_verification
    FROM dispatch_phase21_local.organizations WHERE id=p_org;
  INSERT INTO dispatch_phase21_local.record_revisions
    (organization_id,record_id,revision_number,actor_membership_id,payload_snapshot)
  VALUES (p_org,p_record,p_revision,p_membership,
    pg_catalog.jsonb_build_object('record_type',v_record.record_type,'status',v_record.status,
      'priority',v_record.priority,'title',v_record.title,'description',v_record.description,
      'operational_scope_id',v_record.operational_scope_id,'location',v_record.location));
  INSERT INTO dispatch_phase21_local.record_provenance
    (organization_id,record_id,revision_number,author_user_id,membership_id,source_class,
     verification_level,operational_scope_id,visibility,review_state)
  VALUES (p_org,p_record,p_revision,dispatch_phase22_local.current_actor_id(),p_membership,
    'ORGANIZATION',v_verification,v_record.operational_scope_id,'PRIVATE','NOT_SUBMITTED');
END $$;

CREATE FUNCTION dispatch_phase22_local.create_operational_record(
  p_organization_id uuid,p_record_type dispatch_phase21_local.record_type,
  p_status dispatch_phase21_local.record_status,p_priority dispatch_phase21_local.record_priority,
  p_title text,p_description text,p_scope_id uuid,p_location jsonb,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_record uuid:=gen_random_uuid();
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'operations.create',p_scope_id);
  IF p_status NOT IN ('DRAFT','OPEN') THEN RAISE EXCEPTION 'invalid initial record status'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'type',p_record_type,
    'status',p_status,'priority',p_priority,'title',p_title,'description',p_description,
    'scope',p_scope_id,'location',p_location));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'create_operational_record',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  INSERT INTO dispatch_phase21_local.operational_records
    (id,organization_id,record_type,status,priority,title,description,operational_scope_id,
     location,created_by_membership_id,current_revision,closed_at)
  VALUES (v_record,p_organization_id,p_record_type,p_status,p_priority,p_title,p_description,
    p_scope_id,p_location,v_membership,0,NULL);
  PERFORM dispatch_phase22_local.maybe_fail('create_operational_record');
  PERFORM dispatch_phase22_local.append_record_evidence(p_organization_id,v_record,0,v_membership);
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'RECORD_CREATED',
    'operational_record',v_record,pg_catalog.jsonb_build_object('revision',0),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'create_operational_record',
    p_idempotency_key,v_hash,v_record,pg_catalog.jsonb_build_object('outcome','accepted','revision',0));
  RETURN v_record;
END $$;

CREATE FUNCTION dispatch_phase22_local.update_operational_record(
  p_organization_id uuid,p_record_id uuid,p_expected_revision integer,
  p_status dispatch_phase21_local.record_status,p_priority dispatch_phase21_local.record_priority,
  p_title text,p_description text,p_location jsonb,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid;
  v_record dispatch_phase21_local.operational_records%ROWTYPE; v_next integer;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'operations.update');
  IF p_status IN ('CLOSED','CANCELLED') THEN RAISE EXCEPTION 'use close command'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'record',p_record_id,
    'expected_revision',p_expected_revision,'status',p_status,'priority',p_priority,'title',p_title,
    'description',p_description,'location',p_location));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'update_operational_record',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_record FROM dispatch_phase21_local.operational_records
    WHERE id=p_record_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_record.current_revision<>p_expected_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  v_next:=v_record.current_revision+1;
  UPDATE dispatch_phase21_local.operational_records SET status=p_status,priority=p_priority,
    title=p_title,description=p_description,location=p_location,current_revision=v_next,
    updated_at=statement_timestamp() WHERE id=p_record_id;
  PERFORM dispatch_phase22_local.maybe_fail('update_operational_record');
  PERFORM dispatch_phase22_local.append_record_evidence(p_organization_id,p_record_id,v_next,v_membership);
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'RECORD_UPDATED',
    'operational_record',p_record_id,pg_catalog.jsonb_build_object('revision',v_next),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'update_operational_record',
    p_idempotency_key,v_hash,p_record_id,pg_catalog.jsonb_build_object('outcome','accepted','revision',v_next));
  RETURN p_record_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.assign_operational_record(
  p_organization_id uuid,p_record_id uuid,p_expected_revision integer,
  p_assigned_membership_id uuid,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid;
  v_record dispatch_phase21_local.operational_records%ROWTYPE; v_next integer; v_assignment uuid:=gen_random_uuid();
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'operations.assign');
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'record',p_record_id,
    'expected_revision',p_expected_revision,'assignee',p_assigned_membership_id));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'assign_operational_record',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_record FROM dispatch_phase21_local.operational_records
    WHERE id=p_record_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_record.current_revision<>p_expected_revision OR v_record.status IN ('CLOSED','CANCELLED') THEN
    RAISE EXCEPTION 'stale or forbidden';
  END IF;
  PERFORM 1 FROM dispatch_phase21_local.organization_memberships WHERE id=p_assigned_membership_id
    AND organization_id=p_organization_id AND status='ACTIVE'
    AND (expires_at IS NULL OR expires_at>statement_timestamp()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE dispatch_phase21_local.record_assignments SET status='CLEARED',cleared_at=statement_timestamp()
    WHERE record_id=p_record_id AND status='ASSIGNED';
  INSERT INTO dispatch_phase21_local.record_assignments
    (id,organization_id,record_id,assigned_membership_id,assigned_by_membership_id)
  VALUES (v_assignment,p_organization_id,p_record_id,p_assigned_membership_id,v_membership);
  v_next:=v_record.current_revision+1;
  UPDATE dispatch_phase21_local.operational_records SET current_revision=v_next,updated_at=statement_timestamp()
    WHERE id=p_record_id;
  PERFORM dispatch_phase22_local.maybe_fail('assign_operational_record');
  PERFORM dispatch_phase22_local.append_record_evidence(p_organization_id,p_record_id,v_next,v_membership);
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'RECORD_ASSIGNED',
    'operational_record',p_record_id,pg_catalog.jsonb_build_object('revision',v_next,'assignment_id',v_assignment),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'assign_operational_record',
    p_idempotency_key,v_hash,v_assignment,pg_catalog.jsonb_build_object('outcome','accepted','record_id',p_record_id,'revision',v_next));
  RETURN v_assignment;
END $$;

CREATE FUNCTION dispatch_phase22_local.close_operational_record(
  p_organization_id uuid,p_record_id uuid,p_expected_revision integer,
  p_terminal_status dispatch_phase21_local.record_status,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid;
  v_record dispatch_phase21_local.operational_records%ROWTYPE; v_next integer;
  v_event dispatch_phase21_local.audit_event_type;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'operations.close');
  IF p_terminal_status NOT IN ('CLOSED','CANCELLED') THEN RAISE EXCEPTION 'invalid terminal status'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'record',p_record_id,
    'expected_revision',p_expected_revision,'terminal_status',p_terminal_status));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'close_operational_record',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_record FROM dispatch_phase21_local.operational_records
    WHERE id=p_record_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_record.current_revision<>p_expected_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  v_next:=v_record.current_revision+1;
  UPDATE dispatch_phase21_local.operational_records SET status=p_terminal_status,current_revision=v_next,
    updated_at=statement_timestamp(),closed_at=statement_timestamp() WHERE id=p_record_id;
  PERFORM dispatch_phase22_local.maybe_fail('close_operational_record');
  PERFORM dispatch_phase22_local.append_record_evidence(p_organization_id,p_record_id,v_next,v_membership);
  v_event:=CASE WHEN p_terminal_status='CLOSED' THEN 'RECORD_CLOSED'::dispatch_phase21_local.audit_event_type
    ELSE 'RECORD_CANCELLED'::dispatch_phase21_local.audit_event_type END;
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,v_event,
    'operational_record',p_record_id,pg_catalog.jsonb_build_object('revision',v_next),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'close_operational_record',
    p_idempotency_key,v_hash,p_record_id,pg_catalog.jsonb_build_object('outcome','accepted','revision',v_next));
  RETURN p_record_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.invite_member(
  p_organization_id uuid,p_expected_org_revision integer,p_target_user_id uuid,
  p_role dispatch_phase21_local.role_template_key,p_token_digest bytea,p_expires_at timestamptz,
  p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_invitation uuid:=gen_random_uuid();
  v_org dispatch_phase21_local.organizations%ROWTYPE;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'members.invite');
  IF p_role='OWNER' OR octet_length(p_token_digest)<>32 OR p_expires_at<=statement_timestamp() THEN
    RAISE EXCEPTION 'invalid invitation';
  END IF;
  PERFORM 1 FROM dispatch_phase21_local.profiles WHERE user_id=p_target_user_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invitation'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'org_revision',p_expected_org_revision,
    'target',p_target_user_id,'role',p_role,'token_digest',pg_catalog.encode(p_token_digest,'hex'),'expires',p_expires_at));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'invite_member',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_org FROM dispatch_phase21_local.organizations WHERE id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_org.governance_revision<>p_expected_org_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships
    WHERE organization_id=p_organization_id AND user_id=p_target_user_id
      AND status IN ('INVITED','ACTIVE','SUSPENDED')) THEN RAISE EXCEPTION 'duplicate live membership'; END IF;
  INSERT INTO dispatch_phase21_local.organization_invitations
    (id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id)
  VALUES (v_invitation,p_organization_id,'user:'||p_target_user_id::text,p_role,p_token_digest,
    'PENDING',p_expires_at,v_membership);
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  PERFORM dispatch_phase22_local.maybe_fail('invite_member');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'MEMBER_INVITED',
    'organization_invitation',v_invitation,pg_catalog.jsonb_build_object('role',p_role),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'invite_member',p_idempotency_key,
    v_hash,v_invitation,pg_catalog.jsonb_build_object('outcome','accepted','organization_revision',p_expected_org_revision+1));
  RETURN v_invitation;
END $$;

CREATE FUNCTION dispatch_phase22_local.accept_invitation(
  p_organization_id uuid,p_invitation_id uuid,p_token_digest bytea,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_replay uuid; v_membership uuid:=gen_random_uuid();
  v_inv dispatch_phase21_local.organization_invitations%ROWTYPE;
BEGIN
  v_actor:=dispatch_phase22_local.assert_live_session();
  IF dispatch_phase21_local.requested_organization_id() IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organizations WHERE id=p_organization_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'invitation',p_invitation_id,
    'token_digest',pg_catalog.encode(p_token_digest,'hex')));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'accept_invitation',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_inv FROM dispatch_phase21_local.organization_invitations
    WHERE id=p_invitation_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status<>'PENDING' OR v_inv.expires_at<=statement_timestamp()
    OR v_inv.token_digest<>p_token_digest OR v_inv.email_or_identity_target<>'user:'||v_actor::text THEN
    RAISE EXCEPTION 'invalid invitation';
  END IF;
  IF EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships
    WHERE organization_id=p_organization_id AND user_id=v_actor
      AND status IN ('INVITED','ACTIVE','SUSPENDED')) THEN RAISE EXCEPTION 'duplicate live membership'; END IF;
  INSERT INTO dispatch_phase21_local.organization_memberships
    (id,organization_id,user_id,status,role_template,activated_at)
  VALUES (v_membership,p_organization_id,v_actor,'ACTIVE',v_inv.role_template,statement_timestamp());
  UPDATE dispatch_phase21_local.organization_invitations SET status='ACCEPTED',accepted_at=statement_timestamp()
    WHERE id=p_invitation_id;
  PERFORM dispatch_phase22_local.maybe_fail('accept_invitation');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'INVITATION_ACCEPTED',
    'organization_invitation',p_invitation_id,pg_catalog.jsonb_build_object('membership_id',v_membership),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'accept_invitation',p_idempotency_key,
    v_hash,v_membership,pg_catalog.jsonb_build_object('outcome','accepted','invitation_id',p_invitation_id));
  RETURN v_membership;
END $$;

CREATE FUNCTION dispatch_phase22_local.change_member_role(
  p_organization_id uuid,p_membership_id uuid,p_expected_revision integer,
  p_new_role dispatch_phase21_local.role_template_key,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor_membership uuid; v_hash bytea; v_replay uuid;
  v_target dispatch_phase21_local.organization_memberships%ROWTYPE;
BEGIN
  v_actor_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'members.manage');
  IF p_new_role='OWNER' THEN RAISE EXCEPTION 'owner role requires transfer'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'membership',p_membership_id,
    'expected_revision',p_expected_revision,'new_role',p_new_role));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'change_member_role',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_target FROM dispatch_phase21_local.organization_memberships
    WHERE id=p_membership_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_target.status<>'ACTIVE' OR v_target.revision<>p_expected_revision
    OR v_target.role_template='OWNER' THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  IF v_target.role_template='ORGANIZATION_ADMIN' AND p_new_role<>'ORGANIZATION_ADMIN'
    AND NOT EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships
      WHERE organization_id=p_organization_id AND status='ACTIVE' AND role_template='ORGANIZATION_ADMIN'
        AND id<>p_membership_id) THEN RAISE EXCEPTION 'last organization admin'; END IF;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template=p_new_role,
    revision=revision+1,updated_at=statement_timestamp() WHERE id=p_membership_id;
  PERFORM dispatch_phase22_local.maybe_fail('change_member_role');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_actor_membership,'ROLE_CHANGED',
    'organization_membership',p_membership_id,
    pg_catalog.jsonb_build_object('from',v_target.role_template,'to',p_new_role,'revision',p_expected_revision+1),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'change_member_role',p_idempotency_key,
    v_hash,p_membership_id,pg_catalog.jsonb_build_object('outcome','accepted','revision',p_expected_revision+1));
  RETURN p_membership_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.set_membership_status(
  p_command text,p_organization_id uuid,p_membership_id uuid,p_expected_revision integer,
  p_new_status dispatch_phase21_local.membership_status,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor_membership uuid; v_hash bytea; v_replay uuid;
  v_target dispatch_phase21_local.organization_memberships%ROWTYPE;
  v_event dispatch_phase21_local.audit_event_type;
BEGIN
  v_actor_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'members.manage');
  IF (p_command,p_new_status) NOT IN (('suspend_member','SUSPENDED'),('revoke_member','REVOKED'),('activate_membership','ACTIVE')) THEN
    RAISE EXCEPTION 'invalid membership command';
  END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'membership',p_membership_id,
    'expected_revision',p_expected_revision,'new_status',p_new_status));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,p_command,p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_target FROM dispatch_phase21_local.organization_memberships
    WHERE id=p_membership_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_target.revision<>p_expected_revision OR v_target.role_template='OWNER' THEN
    RAISE EXCEPTION 'stale or forbidden';
  END IF;
  IF p_new_status='ACTIVE' AND v_target.status<>'SUSPENDED' THEN RAISE EXCEPTION 'invalid membership state'; END IF;
  IF p_new_status<>'ACTIVE' AND v_target.status<>'ACTIVE' THEN RAISE EXCEPTION 'invalid membership state'; END IF;
  IF v_target.role_template='ORGANIZATION_ADMIN' AND p_new_status<>'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships
      WHERE organization_id=p_organization_id AND status='ACTIVE' AND role_template='ORGANIZATION_ADMIN'
        AND id<>p_membership_id) THEN RAISE EXCEPTION 'last organization admin'; END IF;
  UPDATE dispatch_phase21_local.organization_memberships SET status=p_new_status,
    suspended_at=CASE WHEN p_new_status='SUSPENDED' THEN statement_timestamp() ELSE suspended_at END,
    revoked_at=CASE WHEN p_new_status='REVOKED' THEN statement_timestamp() ELSE revoked_at END,
    activated_at=CASE WHEN p_new_status='ACTIVE' THEN statement_timestamp() ELSE activated_at END,
    revision=revision+1,updated_at=statement_timestamp() WHERE id=p_membership_id;
  PERFORM dispatch_phase22_local.maybe_fail(p_command);
  v_event:=CASE p_new_status WHEN 'SUSPENDED' THEN 'MEMBER_SUSPENDED'::dispatch_phase21_local.audit_event_type
    WHEN 'REVOKED' THEN 'MEMBER_REVOKED'::dispatch_phase21_local.audit_event_type
    ELSE 'MEMBER_REACTIVATED'::dispatch_phase21_local.audit_event_type END;
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_actor_membership,v_event,
    'organization_membership',p_membership_id,pg_catalog.jsonb_build_object('revision',p_expected_revision+1),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,p_command,p_idempotency_key,
    v_hash,p_membership_id,pg_catalog.jsonb_build_object('outcome','accepted','revision',p_expected_revision+1));
  RETURN p_membership_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.suspend_member(uuid,uuid,integer,uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.set_membership_status('suspend_member',$1,$2,$3,'SUSPENDED',$4)
$$;
CREATE FUNCTION dispatch_phase22_local.revoke_member(uuid,uuid,integer,uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.set_membership_status('revoke_member',$1,$2,$3,'REVOKED',$4)
$$;
CREATE FUNCTION dispatch_phase22_local.activate_membership(uuid,uuid,integer,uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.set_membership_status('activate_membership',$1,$2,$3,'ACTIVE',$4)
$$;

CREATE FUNCTION dispatch_phase22_local.initiate_ownership_transfer(
  p_organization_id uuid,p_expected_org_revision integer,p_to_membership_id uuid,
  p_reason text,p_expires_at timestamptz,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner_membership uuid; v_hash bytea; v_replay uuid; v_transfer uuid:=gen_random_uuid();
  v_org dispatch_phase21_local.organizations%ROWTYPE;
BEGIN
  v_owner_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'ownership.transfer');
  IF p_expires_at<=statement_timestamp() OR char_length(p_reason) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid transfer'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'org_revision',p_expected_org_revision,
    'recipient',p_to_membership_id,'reason',p_reason,'expires',p_expires_at));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'initiate_ownership_transfer',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_org FROM dispatch_phase21_local.organizations WHERE id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_org.governance_revision<>p_expected_org_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organization_memberships WHERE id=p_to_membership_id
    AND organization_id=p_organization_id AND status='ACTIVE' AND role_template='ORGANIZATION_ADMIN'
    AND (expires_at IS NULL OR expires_at>statement_timestamp()) AND id<>v_owner_membership FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ineligible recipient'; END IF;
  INSERT INTO dispatch_phase21_local.ownership_transfers
    (id,organization_id,from_membership_id,to_membership_id,initiated_by_user_id,reason,expires_at)
  VALUES (v_transfer,p_organization_id,v_owner_membership,p_to_membership_id,
    dispatch_phase22_local.current_actor_id(),p_reason,p_expires_at);
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  PERFORM dispatch_phase22_local.maybe_fail('initiate_ownership_transfer');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_owner_membership,'OWNERSHIP_TRANSFER_INITIATED',
    'ownership_transfer',v_transfer,pg_catalog.jsonb_build_object('recipient_membership_id',p_to_membership_id,
      'organization_revision',p_expected_org_revision+1),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'initiate_ownership_transfer',p_idempotency_key,
    v_hash,v_transfer,pg_catalog.jsonb_build_object('outcome','accepted','organization_revision',p_expected_org_revision+1));
  RETURN v_transfer;
END $$;

CREATE FUNCTION dispatch_phase22_local.accept_ownership_transfer(
  p_organization_id uuid,p_transfer_id uuid,p_expected_org_revision integer,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_replay uuid; v_transfer dispatch_phase21_local.ownership_transfers%ROWTYPE;
  v_from dispatch_phase21_local.organization_memberships%ROWTYPE;
  v_to dispatch_phase21_local.organization_memberships%ROWTYPE; v_org_revision integer;
BEGIN
  v_actor:=dispatch_phase22_local.assert_live_session();
  IF dispatch_phase21_local.requested_organization_id() IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'transfer',p_transfer_id,
    'org_revision',p_expected_org_revision));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'accept_ownership_transfer',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_transfer FROM dispatch_phase21_local.ownership_transfers
    WHERE id=p_transfer_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_transfer.status<>'PENDING' OR v_transfer.expires_at<=statement_timestamp() THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  SELECT governance_revision INTO v_org_revision FROM dispatch_phase21_local.organizations
    WHERE id=p_organization_id AND status='ACTIVE' FOR UPDATE;
  IF v_org_revision IS DISTINCT FROM p_expected_org_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organization_memberships
    WHERE id IN (v_transfer.from_membership_id,v_transfer.to_membership_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_from FROM dispatch_phase21_local.organization_memberships WHERE id=v_transfer.from_membership_id;
  SELECT * INTO v_to FROM dispatch_phase21_local.organization_memberships WHERE id=v_transfer.to_membership_id;
  IF v_to.user_id<>v_actor OR v_to.status<>'ACTIVE' OR v_to.role_template<>'ORGANIZATION_ADMIN'
    OR v_from.status<>'ACTIVE' OR v_from.role_template<>'OWNER' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template='ORGANIZATION_ADMIN',
    revision=revision+1,updated_at=statement_timestamp() WHERE id=v_from.id;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template='OWNER',
    revision=revision+1,updated_at=statement_timestamp() WHERE id=v_to.id;
  UPDATE dispatch_phase21_local.ownership_transfers SET status='ACCEPTED',accepted_at=statement_timestamp()
    WHERE id=p_transfer_id;
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  PERFORM dispatch_phase22_local.maybe_fail('accept_ownership_transfer');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_to.id,'OWNERSHIP_TRANSFERRED',
    'organization',p_organization_id,pg_catalog.jsonb_build_object('from_membership_id',v_from.id,
      'to_membership_id',v_to.id,'initiated_by_user_id',v_transfer.initiated_by_user_id,
      'accepted_by_user_id',v_actor,'organization_revision',p_expected_org_revision+1),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'accept_ownership_transfer',p_idempotency_key,
    v_hash,p_transfer_id,pg_catalog.jsonb_build_object('outcome','accepted','organization_revision',p_expected_org_revision+1));
  RETURN p_transfer_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.start_ownership_recovery(
  p_organization_id uuid,p_target_membership_id uuid,p_expected_org_revision integer,
  p_evidence_reference text,p_reason text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_replay uuid; v_case uuid:=gen_random_uuid();
BEGIN
  v_actor:=dispatch_phase22_local.assert_platform_permission('platform.ownership.recover',p_organization_id);
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'target',p_target_membership_id,
    'org_revision',p_expected_org_revision,'evidence',p_evidence_reference,'reason',p_reason));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'start_ownership_recovery',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organizations WHERE id=p_organization_id
    AND status IN ('ACTIVE','SUSPENDED') AND governance_revision=p_expected_org_revision FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organization_memberships m
    WHERE m.id=p_target_membership_id AND m.organization_id=p_organization_id AND m.status='ACTIVE'
      AND m.role_template<>'OWNER' AND (m.expires_at IS NULL OR m.expires_at>statement_timestamp())
      AND NOT EXISTS (SELECT 1 FROM dispatch_phase21_local.platform_admin_grants g
        WHERE g.user_id=m.user_id AND g.active) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ineligible recipient'; END IF;
  INSERT INTO dispatch_phase22_local.ownership_recovery_cases
    (id,organization_id,target_membership_id,organization_revision,evidence_reference,reason,first_approver_user_id)
  VALUES (v_case,p_organization_id,p_target_membership_id,p_expected_org_revision,
    p_evidence_reference,p_reason,v_actor);
  INSERT INTO dispatch_phase22_local.recovery_approvals(recovery_case_id,approver_user_id,approval_order,session_id)
  VALUES (v_case,v_actor,1,dispatch_phase22_local.current_session_id());
  PERFORM dispatch_phase22_local.maybe_fail('start_ownership_recovery');
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'start_ownership_recovery',p_idempotency_key,
    v_hash,v_case,pg_catalog.jsonb_build_object('outcome','first_approved','organization_id',p_organization_id));
  RETURN v_case;
END $$;

CREATE FUNCTION dispatch_phase22_local.approve_ownership_recovery(
  p_organization_id uuid,p_recovery_case_id uuid,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_replay uuid; v_case dispatch_phase22_local.ownership_recovery_cases%ROWTYPE;
  v_owner dispatch_phase21_local.organization_memberships%ROWTYPE;
  v_target dispatch_phase21_local.organization_memberships%ROWTYPE; v_org_revision integer;
BEGIN
  v_actor:=dispatch_phase22_local.assert_platform_permission('platform.ownership.recover',p_organization_id);
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'case',p_recovery_case_id));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'approve_ownership_recovery',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_case FROM dispatch_phase22_local.ownership_recovery_cases
    WHERE id=p_recovery_case_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_case.status<>'FIRST_APPROVED' OR v_case.first_approver_user_id=v_actor THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT governance_revision INTO v_org_revision FROM dispatch_phase21_local.organizations
    WHERE id=p_organization_id AND status IN ('ACTIVE','SUSPENDED') FOR UPDATE;
  IF v_org_revision IS DISTINCT FROM v_case.organization_revision THEN RAISE EXCEPTION 'stale recovery case'; END IF;
  SELECT * INTO v_owner FROM dispatch_phase21_local.organization_memberships
    WHERE organization_id=p_organization_id AND status='ACTIVE' AND role_template='OWNER' FOR UPDATE;
  SELECT * INTO v_target FROM dispatch_phase21_local.organization_memberships
    WHERE id=v_case.target_membership_id AND organization_id=p_organization_id AND status='ACTIVE'
      AND role_template<>'OWNER' AND (expires_at IS NULL OR expires_at>statement_timestamp()) FOR UPDATE;
  IF NOT FOUND OR v_target.user_id=v_actor OR EXISTS (SELECT 1 FROM dispatch_phase21_local.platform_admin_grants
    WHERE user_id=v_target.user_id AND active) THEN RAISE EXCEPTION 'ineligible recipient'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organization_memberships
    WHERE id IN (v_owner.id,v_target.id) ORDER BY id FOR UPDATE;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template='ORGANIZATION_ADMIN',
    revision=revision+1,updated_at=statement_timestamp() WHERE id=v_owner.id;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template='OWNER',
    revision=revision+1,updated_at=statement_timestamp() WHERE id=v_target.id;
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  UPDATE dispatch_phase22_local.ownership_recovery_cases SET status='RECOVERED',
    second_approver_user_id=v_actor,recovered_at=statement_timestamp() WHERE id=p_recovery_case_id;
  INSERT INTO dispatch_phase22_local.recovery_approvals(recovery_case_id,approver_user_id,approval_order,session_id)
  VALUES (p_recovery_case_id,v_actor,2,dispatch_phase22_local.current_session_id());
  PERFORM dispatch_phase22_local.maybe_fail('approve_ownership_recovery');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,NULL,'OWNERSHIP_RECOVERED',
    'organization',p_organization_id,pg_catalog.jsonb_build_object('case_id',p_recovery_case_id,
      'first_approver_user_id',v_case.first_approver_user_id,'second_approver_user_id',v_actor,
      'from_membership_id',v_owner.id,'to_membership_id',v_target.id),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'approve_ownership_recovery',p_idempotency_key,
    v_hash,p_recovery_case_id,pg_catalog.jsonb_build_object('outcome','recovered','organization_id',p_organization_id));
  RETURN p_recovery_case_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.grant_capability(
  p_organization_id uuid,p_expected_org_revision integer,p_capability_key text,p_scope_id uuid,
  p_required_verification dispatch_phase21_local.verification_level,p_valid_from timestamptz,
  p_valid_until timestamptz,p_governance_reference text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_replay uuid; v_grant uuid:=gen_random_uuid();
  v_org dispatch_phase21_local.organizations%ROWTYPE;
BEGIN
  v_actor:=dispatch_phase22_local.assert_platform_permission('platform.capability.manage',p_organization_id);
  IF p_capability_key NOT IN ('awareness.condition.publish','awareness.hazard.publish',
    'awareness.planned_work.publish','awareness.official_notice.publish','awareness.road_closure.publish')
    OR p_valid_until IS NULL OR p_valid_until<=p_valid_from THEN RAISE EXCEPTION 'invalid capability'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'org_revision',p_expected_org_revision,
    'capability',p_capability_key,'scope',p_scope_id,'verification',p_required_verification,
    'valid_from',p_valid_from,'valid_until',p_valid_until,'governance',p_governance_reference));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'grant_capability',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_org FROM dispatch_phase21_local.organizations WHERE id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_org.status<>'ACTIVE' OR v_org.governance_revision<>p_expected_org_revision
    OR (p_required_verification='VERIFIED_ORGANIZATION' AND v_org.verification_level='UNVERIFIED')
    OR (p_required_verification='VERIFIED_PUBLIC_ENTITY' AND v_org.verification_level<>'VERIFIED_PUBLIC_ENTITY') THEN
    RAISE EXCEPTION 'stale or forbidden';
  END IF;
  IF NOT dispatch_phase21_local.scope_allows(p_organization_id,p_scope_id) THEN RAISE EXCEPTION 'invalid scope'; END IF;
  INSERT INTO dispatch_phase21_local.capability_grants
    (id,organization_id,capability_key,operational_scope_id,status,required_verification,
     valid_from,valid_until,granted_by_platform_actor,governance_reference)
  VALUES (v_grant,p_organization_id,p_capability_key,p_scope_id,'ACTIVE',p_required_verification,
    p_valid_from,p_valid_until,v_actor,p_governance_reference);
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  PERFORM dispatch_phase22_local.maybe_fail('grant_capability');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,NULL,'CAPABILITY_GRANTED','capability_grant',
    v_grant,pg_catalog.jsonb_build_object('capability',p_capability_key,'scope_id',p_scope_id,
      'organization_revision',p_expected_org_revision+1),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'grant_capability',p_idempotency_key,
    v_hash,v_grant,pg_catalog.jsonb_build_object('outcome','accepted','organization_id',p_organization_id));
  RETURN v_grant;
END $$;

CREATE FUNCTION dispatch_phase22_local.revoke_capability(
  p_organization_id uuid,p_grant_id uuid,p_expected_revision integer,p_reason text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_replay uuid; v_grant dispatch_phase21_local.capability_grants%ROWTYPE;
BEGIN
  v_actor:=dispatch_phase22_local.assert_platform_permission('platform.capability.manage',p_organization_id);
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'grant',p_grant_id,
    'expected_revision',p_expected_revision,'reason',p_reason));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'revoke_capability',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_grant FROM dispatch_phase21_local.capability_grants
    WHERE id=p_grant_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_grant.status<>'ACTIVE' OR v_grant.revision<>p_expected_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  UPDATE dispatch_phase21_local.capability_grants SET status='REVOKED',revoked_at=statement_timestamp(),
    revoked_by_platform_actor=v_actor,revision=revision+1 WHERE id=p_grant_id;
  PERFORM dispatch_phase22_local.maybe_fail('revoke_capability');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,NULL,'CAPABILITY_REVOKED','capability_grant',
    p_grant_id,pg_catalog.jsonb_build_object('revision',p_expected_revision+1,'reason',p_reason),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'revoke_capability',p_idempotency_key,
    v_hash,p_grant_id,pg_catalog.jsonb_build_object('outcome','accepted','revision',p_expected_revision+1));
  RETURN p_grant_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.submit_projection_candidate(
  p_organization_id uuid,p_record_id uuid,p_expected_record_revision integer,p_capability_grant_id uuid,
  p_sanitized_payload jsonb,p_consumer_taxonomy text,p_freshness_deadline timestamptz,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_candidate uuid:=gen_random_uuid();
  v_record dispatch_phase21_local.operational_records%ROWTYPE; v_grant dispatch_phase21_local.capability_grants%ROWTYPE;
  v_expected_taxonomy text;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'projection.submit');
  IF p_freshness_deadline<=statement_timestamp() OR jsonb_typeof(p_sanitized_payload)<>'object'
    OR dispatch_phase21_local.projection_has_forbidden_key(p_sanitized_payload)
    OR NOT (p_sanitized_payload ? 'title' AND p_sanitized_payload ? 'summary')
    OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_sanitized_payload) k
      WHERE k NOT IN ('title','summary','public_location')) THEN RAISE EXCEPTION 'unsafe projection payload'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'record',p_record_id,
    'record_revision',p_expected_record_revision,'grant',p_capability_grant_id,'payload',p_sanitized_payload,
    'taxonomy',p_consumer_taxonomy,'freshness',p_freshness_deadline));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'submit_projection_candidate',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_record FROM dispatch_phase21_local.operational_records
    WHERE id=p_record_id AND organization_id=p_organization_id FOR UPDATE;
  SELECT * INTO v_grant FROM dispatch_phase21_local.capability_grants
    WHERE id=p_capability_grant_id AND organization_id=p_organization_id;
  IF NOT FOUND OR v_record.current_revision<>p_expected_record_revision
    OR v_record.status IN ('CLOSED','CANCELLED') OR v_record.operational_scope_id<>v_grant.operational_scope_id
    OR NOT dispatch_phase21_local.capability_allows(p_organization_id,v_grant.capability_key,v_grant.operational_scope_id)
    OR NOT EXISTS (SELECT 1 FROM dispatch_phase21_local.record_provenance
      WHERE record_id=p_record_id AND revision_number=p_expected_record_revision
        AND source_class IN ('ORGANIZATION','OFFICIAL_PUBLIC')) THEN RAISE EXCEPTION 'ineligible projection source'; END IF;
  v_expected_taxonomy:=CASE v_grant.capability_key
    WHEN 'awareness.condition.publish' THEN 'condition'
    WHEN 'awareness.hazard.publish' THEN 'hazard'
    WHEN 'awareness.planned_work.publish' THEN 'planned_work'
    WHEN 'awareness.official_notice.publish' THEN 'operational_notice'
    WHEN 'awareness.road_closure.publish' THEN 'road_closure' END;
  IF p_consumer_taxonomy<>v_expected_taxonomy THEN RAISE EXCEPTION 'invalid consumer taxonomy'; END IF;
  INSERT INTO dispatch_phase21_local.projection_candidates
    (id,source_record_id,organization_id,source_revision,capability_grant_id,status,
     requested_by_membership_id,sanitized_payload,consumer_taxonomy,freshness_deadline)
  VALUES (v_candidate,p_record_id,p_organization_id,p_expected_record_revision,p_capability_grant_id,
    'SUBMITTED',v_membership,p_sanitized_payload,p_consumer_taxonomy,p_freshness_deadline);
  PERFORM dispatch_phase22_local.maybe_fail('submit_projection_candidate');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'PROJECTION_SUBMITTED',
    'projection_candidate',v_candidate,pg_catalog.jsonb_build_object('record_id',p_record_id,
      'source_revision',p_expected_record_revision),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'submit_projection_candidate',p_idempotency_key,
    v_hash,v_candidate,pg_catalog.jsonb_build_object('outcome','accepted','source_revision',p_expected_record_revision));
  RETURN v_candidate;
END $$;

CREATE FUNCTION dispatch_phase22_local.review_projection(
  p_command text,p_organization_id uuid,p_candidate_id uuid,p_expected_revision integer,
  p_rejection_reason text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_candidate dispatch_phase21_local.projection_candidates%ROWTYPE;
  v_capability text; v_event dispatch_phase21_local.audit_event_type; v_status dispatch_phase21_local.projection_status;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'projection.review');
  IF p_command NOT IN ('approve_projection','reject_projection') THEN RAISE EXCEPTION 'invalid review command'; END IF;
  IF p_command='reject_projection' AND (p_rejection_reason IS NULL OR char_length(p_rejection_reason) NOT BETWEEN 1 AND 1000) THEN
    RAISE EXCEPTION 'rejection reason required';
  END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'candidate',p_candidate_id,
    'expected_revision',p_expected_revision,'reason',p_rejection_reason));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,p_command,p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_candidate FROM dispatch_phase21_local.projection_candidates
    WHERE id=p_candidate_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_candidate.status<>'SUBMITTED' OR v_candidate.revision<>p_expected_revision
    OR v_candidate.freshness_deadline<=statement_timestamp() THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  SELECT capability_key INTO v_capability FROM dispatch_phase21_local.capability_grants
    WHERE id=v_candidate.capability_grant_id;
  IF v_capability='awareness.road_closure.publish'
    AND v_candidate.requested_by_membership_id=v_membership THEN RAISE EXCEPTION 'two-person review required'; END IF;
  v_status:=CASE WHEN p_command='approve_projection' THEN 'APPROVED'::dispatch_phase21_local.projection_status
    ELSE 'REJECTED'::dispatch_phase21_local.projection_status END;
  UPDATE dispatch_phase21_local.projection_candidates SET status=v_status,
    reviewed_by_membership_id=v_membership,reviewed_at=statement_timestamp(),
    rejection_reason=CASE WHEN v_status='REJECTED' THEN p_rejection_reason ELSE NULL END,
    revision=revision+1 WHERE id=p_candidate_id;
  PERFORM dispatch_phase22_local.maybe_fail(p_command);
  v_event:=CASE WHEN v_status='APPROVED' THEN 'PROJECTION_APPROVED'::dispatch_phase21_local.audit_event_type
    ELSE 'PROJECTION_REJECTED'::dispatch_phase21_local.audit_event_type END;
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,v_event,
    'projection_candidate',p_candidate_id,pg_catalog.jsonb_build_object('revision',p_expected_revision+1,
      'reason',p_rejection_reason),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,p_command,p_idempotency_key,
    v_hash,p_candidate_id,pg_catalog.jsonb_build_object('outcome',lower(v_status::text),'revision',p_expected_revision+1));
  RETURN p_candidate_id;
END $$;

CREATE FUNCTION dispatch_phase22_local.approve_projection(uuid,uuid,integer,uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.review_projection('approve_projection',$1,$2,$3,NULL,$4)
$$;
CREATE FUNCTION dispatch_phase22_local.reject_projection(uuid,uuid,integer,text,uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.review_projection('reject_projection',$1,$2,$3,$4,$5)
$$;

CREATE FUNCTION dispatch_phase22_local.publish_projection(
  p_organization_id uuid,p_candidate_id uuid,p_expected_revision integer,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_projection uuid:=gen_random_uuid();
  v_candidate dispatch_phase21_local.projection_candidates%ROWTYPE; v_org_name text;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'projection.publish');
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',1,'candidate',p_candidate_id,
    'expected_revision',p_expected_revision));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'publish_projection',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_candidate FROM dispatch_phase21_local.projection_candidates
    WHERE id=p_candidate_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_candidate.status<>'APPROVED' OR v_candidate.revision<>p_expected_revision
    OR NOT dispatch_phase21_local.projection_candidate_is_eligible(p_candidate_id) THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  SELECT display_name INTO STRICT v_org_name FROM dispatch_phase21_local.organizations WHERE id=p_organization_id;
  INSERT INTO dispatch_phase21_local.public_safe_projections
    (id,candidate_id,organization_public_name,source_label,consumer_taxonomy,title,summary,public_location,expires_at)
  VALUES (v_projection,p_candidate_id,v_org_name,'Organization update',v_candidate.consumer_taxonomy,
    v_candidate.sanitized_payload->>'title',v_candidate.sanitized_payload->>'summary',
    v_candidate.sanitized_payload->'public_location',v_candidate.freshness_deadline);
  PERFORM dispatch_phase22_local.maybe_fail('publish_projection');
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'PROJECTION_PUBLISHED',
    'public_projection',v_projection,pg_catalog.jsonb_build_object('candidate_id',p_candidate_id),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'publish_projection',p_idempotency_key,
    v_hash,v_projection,pg_catalog.jsonb_build_object('outcome','published','candidate_id',p_candidate_id));
  RETURN v_projection;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_phase22_local
  FROM PUBLIC,dispatch_phase21_app,dispatch_phase21_public;

GRANT EXECUTE ON FUNCTION dispatch_phase22_local.create_operational_record(
  uuid,dispatch_phase21_local.record_type,dispatch_phase21_local.record_status,
  dispatch_phase21_local.record_priority,text,text,uuid,jsonb,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.update_operational_record(
  uuid,uuid,integer,dispatch_phase21_local.record_status,dispatch_phase21_local.record_priority,
  text,text,jsonb,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.assign_operational_record(uuid,uuid,integer,uuid,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.close_operational_record(
  uuid,uuid,integer,dispatch_phase21_local.record_status,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.invite_member(
  uuid,integer,uuid,dispatch_phase21_local.role_template_key,bytea,timestamptz,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.accept_invitation(uuid,uuid,bytea,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.change_member_role(
  uuid,uuid,integer,dispatch_phase21_local.role_template_key,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.suspend_member(uuid,uuid,integer,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.revoke_member(uuid,uuid,integer,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.activate_membership(uuid,uuid,integer,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.initiate_ownership_transfer(
  uuid,integer,uuid,text,timestamptz,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.accept_ownership_transfer(uuid,uuid,integer,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.start_ownership_recovery(
  uuid,uuid,integer,text,text,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.approve_ownership_recovery(uuid,uuid,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.grant_capability(
  uuid,integer,text,uuid,dispatch_phase21_local.verification_level,timestamptz,timestamptz,text,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.revoke_capability(uuid,uuid,integer,text,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.submit_projection_candidate(
  uuid,uuid,integer,uuid,jsonb,text,timestamptz,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.approve_projection(uuid,uuid,integer,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.reject_projection(uuid,uuid,integer,text,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.publish_projection(uuid,uuid,integer,uuid)
  TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.session_has_live_aal2() TO dispatch_phase21_app;

COMMIT;
