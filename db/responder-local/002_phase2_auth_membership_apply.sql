-- LOCAL/DISPOSABLE Phase 2 fixture only. Requires 001_agency_private_apply.sql.
-- No Supabase Auth, production RPC, RLS, email, or publication integration.
BEGIN;

-- Phase 0 requires revoked membership to stay terminal and a later return to use
-- a NEW invite/membership. Phase 1's all-history unique key prevented this.
ALTER TABLE agency_private.organization_memberships
  DROP CONSTRAINT organization_memberships_organization_id_user_id_key;
CREATE UNIQUE INDEX memberships_one_current_org_user_idx
  ON agency_private.organization_memberships (organization_id, user_id)
  WHERE status IN ('invited','active','suspended');
-- membership_one_active_org_per_user_idx from Phase 1 remains intact.

CREATE TABLE agency_private.local_auth_identities (
  user_id uuid PRIMARY KEY,
  normalized_email text NOT NULL UNIQUE CHECK (char_length(normalized_email) BETWEEN 3 AND 254
    AND normalized_email = lower(trim(normalized_email)) AND normalized_email LIKE '%@%'),
  identity_kind text NOT NULL CHECK (identity_kind IN ('RESPONDER','GRIDLY_ADMIN')),
  assurance text NOT NULL CHECK (assurance IN ('aal1','aal2')),
  session_active boolean NOT NULL DEFAULT false,
  eligibility text NOT NULL DEFAULT 'ineligible' CHECK (eligibility IN ('eligible','ineligible')),
  session_epoch bigint NOT NULL DEFAULT 0 CHECK (session_epoch >= 0),
  CHECK (identity_kind <> 'GRIDLY_ADMIN' OR eligibility = 'eligible')
);
REVOKE ALL ON agency_private.local_auth_identities FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON agency_private.local_auth_identities TO responder_owner_fixture;

CREATE FUNCTION agency_private.phase2_identity_ok(p_user uuid, p_aal2 boolean DEFAULT true)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, agency_private AS $$
  SELECT EXISTS (SELECT 1 FROM agency_private.local_auth_identities
    WHERE user_id = p_user AND session_active AND eligibility = 'eligible'
      AND (NOT p_aal2 OR assurance = 'aal2'));
$$;

CREATE FUNCTION agency_private.phase2_membership_access(p_actor uuid, p_organization uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = pg_catalog, agency_private AS $$
DECLARE m record; o record;
BEGIN
  IF NOT agency_private.phase2_identity_ok(p_actor, true) THEN RETURN 'forbidden'; END IF;
  SELECT role, status INTO m FROM agency_private.organization_memberships
    WHERE organization_id = p_organization AND user_id = p_actor AND status IN ('active','suspended')
    ORDER BY (status = 'active') DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;
  SELECT verification_state, operation_state INTO o FROM agency_private.organizations WHERE id = p_organization;
  IF m.status = 'suspended' OR o.operation_state = 'suspended' THEN RETURN 'suspended'; END IF;
  IF m.status <> 'active' OR o.verification_state <> 'verified' OR o.operation_state <> 'active' THEN RETURN 'forbidden'; END IF;
  RETURN 'accepted';
END $$;

CREATE FUNCTION agency_private.phase2_dashboard_access(p_actor uuid)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = pg_catalog, agency_private AS $$
DECLARE m record; o record;
BEGIN
  IF NOT agency_private.phase2_identity_ok(p_actor, true) THEN RETURN 'forbidden'; END IF;
  SELECT organization_id, status INTO m FROM agency_private.organization_memberships
    WHERE user_id = p_actor AND status IN ('active','suspended')
    ORDER BY (status = 'active') DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;
  SELECT verification_state, operation_state INTO o FROM agency_private.organizations WHERE id = m.organization_id;
  IF m.status = 'suspended' OR o.operation_state = 'suspended' THEN RETURN 'suspended'; END IF;
  IF m.status <> 'active' OR o.verification_state <> 'verified' OR o.operation_state <> 'active' THEN RETURN 'forbidden'; END IF;
  RETURN 'accepted';
END $$;

CREATE FUNCTION agency_private.phase2_audit(
  p_organization uuid, p_actor uuid, p_membership uuid, p_action text,
  p_before jsonb, p_after jsonb, p_reason text, p_correlation uuid)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
BEGIN
  INSERT INTO agency_private.organization_governance_events
    (organization_id, actor_user_id, affected_membership_id, action,
     before_snapshot, after_snapshot, reason, correlation_id)
  VALUES (p_organization, p_actor, p_membership, p_action,
    coalesce(p_before,'{}'::jsonb), coalesce(p_after,'{}'::jsonb), p_reason, p_correlation);
END $$;

CREATE FUNCTION agency_private.phase2_membership_command(
  p_action text, p_actor uuid, p_organization uuid, p_target uuid DEFAULT NULL,
  p_role text DEFAULT NULL, p_invite uuid DEFAULT NULL, p_digest bytea DEFAULT NULL,
  p_reason text DEFAULT NULL, p_correlation uuid DEFAULT NULL, p_reviewed boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
DECLARE actor_identity record; target_identity record; actor_member record; target_member record;
DECLARE org record; inv record; admin_count integer; old_state jsonb; new_state jsonb;
DECLARE new_member_id uuid; new_invite_id uuid; old_rank integer; new_rank integer;
BEGIN
  -- The actor UUID is supplied by the TRUSTED LOCAL HARNESS ONLY. No app fixture
  -- role can execute this helper. Future production binding must use auth.uid().
  SELECT * INTO actor_identity FROM agency_private.local_auth_identities WHERE user_id = p_actor;
  IF NOT FOUND OR NOT actor_identity.session_active OR actor_identity.eligibility <> 'eligible'
    OR actor_identity.assurance <> 'aal2' THEN RETURN 'forbidden'; END IF;
  IF p_organization IS NULL OR p_correlation IS NULL THEN RETURN 'invalid_request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization::text, 0));
  SELECT * INTO org FROM agency_private.organizations WHERE id = p_organization FOR UPDATE;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;

  IF p_action = 'recover_admin' THEN
    IF actor_identity.identity_kind <> 'GRIDLY_ADMIN' OR p_target = p_actor OR NOT p_reviewed
      OR nullif(trim(coalesce(p_reason,'')),'') IS NULL OR char_length(p_reason) > 1000
      OR org.verification_state <> 'verified' THEN RETURN 'forbidden'; END IF;
    SELECT count(*) INTO admin_count FROM agency_private.organization_memberships
      WHERE organization_id = p_organization AND role = 'AGENCY_ADMIN' AND status = 'active';
    IF admin_count > 0 THEN RETURN 'forbidden'; END IF;
    SELECT * INTO target_identity FROM agency_private.local_auth_identities WHERE user_id = p_target;
    IF NOT FOUND OR target_identity.identity_kind <> 'RESPONDER' OR target_identity.eligibility <> 'eligible'
      OR NOT target_identity.session_active OR target_identity.assurance <> 'aal2' THEN RETURN 'forbidden'; END IF;
    SELECT * INTO target_member FROM agency_private.organization_memberships
      WHERE organization_id = p_organization AND user_id = p_target AND status IN ('invited','active','suspended') FOR UPDATE;
    IF FOUND AND target_member.status = 'suspended' AND target_member.role = 'AGENCY_ADMIN' THEN
      UPDATE agency_private.organization_memberships SET status = 'active', suspended_at = NULL,
        joined_at = coalesce(joined_at,now()) WHERE id = target_member.id;
      PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,'admin_recovered',
        jsonb_build_object('status','suspended','role','AGENCY_ADMIN'),
        jsonb_build_object('status','active','role','AGENCY_ADMIN'),p_reason,p_correlation);
      RETURN 'accepted';
    END IF;
    IF FOUND OR p_digest IS NULL OR octet_length(p_digest) <> 32 THEN RETURN 'invalid_request'; END IF;
    INSERT INTO agency_private.organization_invites
      (organization_id, inviter_user_id, intended_email, proposed_role, token_digest, expires_at)
      VALUES (p_organization,p_actor,target_identity.normalized_email,'AGENCY_ADMIN',p_digest,now()+interval '7 days')
      RETURNING id INTO new_invite_id;
    INSERT INTO agency_private.organization_memberships
      (organization_id,user_id,role,status,invited_by,approved_by)
      VALUES (p_organization,p_target,'AGENCY_ADMIN','invited',p_actor,p_actor)
      RETURNING id INTO new_member_id;
    PERFORM agency_private.phase2_audit(p_organization,p_actor,new_member_id,'admin_recovery_invited',
      '{}'::jsonb,jsonb_build_object('status','invited','role','AGENCY_ADMIN','invite_id',new_invite_id),p_reason,p_correlation);
    RETURN 'accepted';
  END IF;

  IF org.verification_state <> 'verified' OR org.operation_state <> 'active' THEN
    RETURN CASE WHEN org.operation_state = 'suspended' THEN 'suspended' ELSE 'forbidden' END;
  END IF;

  IF p_action = 'redeem_invite' THEN
    IF actor_identity.identity_kind <> 'RESPONDER' OR p_invite IS NULL OR p_digest IS NULL THEN RETURN 'invalid_request'; END IF;
    SELECT * INTO inv FROM agency_private.organization_invites WHERE id = p_invite AND organization_id = p_organization FOR UPDATE;
    IF NOT FOUND OR inv.token_digest IS DISTINCT FROM p_digest OR inv.intended_email <> actor_identity.normalized_email THEN RETURN 'forbidden'; END IF;
    IF inv.status = 'redeemed' THEN RETURN 'already_processed'; END IF;
    IF inv.status = 'revoked' THEN RETURN 'forbidden'; END IF;
    IF inv.status = 'expired' OR inv.expires_at <= clock_timestamp() THEN RETURN 'expired'; END IF;
    SELECT * INTO target_member FROM agency_private.organization_memberships
      WHERE organization_id = p_organization AND user_id = p_actor AND status = 'invited' FOR UPDATE;
    IF NOT FOUND OR target_member.role <> inv.proposed_role THEN RETURN 'forbidden'; END IF;
    IF EXISTS (SELECT 1 FROM agency_private.organization_memberships WHERE user_id = p_actor AND status = 'active') THEN RETURN 'forbidden'; END IF;
    UPDATE agency_private.organization_invites SET status='redeemed',redeemed_at=now() WHERE id=inv.id;
    UPDATE agency_private.organization_memberships SET status='active',joined_at=now(),approved_by=inv.inviter_user_id
      WHERE id=target_member.id;
    PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,'invite_redeemed',
      jsonb_build_object('status','created'),jsonb_build_object('status','redeemed','invite_id',inv.id),NULL,p_correlation);
    PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,'member_activated',
      jsonb_build_object('status','invited'),jsonb_build_object('status','active','role',target_member.role),NULL,p_correlation);
    RETURN 'accepted';
  END IF;

  IF actor_identity.identity_kind <> 'RESPONDER' THEN RETURN 'forbidden'; END IF;
  SELECT * INTO actor_member FROM agency_private.organization_memberships
    WHERE organization_id=p_organization AND user_id=p_actor AND status='active' FOR UPDATE;
  IF NOT FOUND OR actor_member.role <> 'AGENCY_ADMIN' THEN RETURN 'forbidden'; END IF;

  IF p_action = 'invite_member' THEN
    IF p_role IS NULL OR p_role NOT IN ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN')
      OR p_digest IS NULL OR octet_length(p_digest) <> 32 THEN RETURN 'invalid_request'; END IF;
    SELECT * INTO target_identity FROM agency_private.local_auth_identities WHERE user_id=p_target;
    IF NOT FOUND OR target_identity.identity_kind <> 'RESPONDER' OR target_identity.eligibility <> 'eligible' THEN RETURN 'forbidden'; END IF;
    IF EXISTS (SELECT 1 FROM agency_private.organization_memberships
      WHERE organization_id=p_organization AND user_id=p_target AND status IN ('invited','active','suspended')) THEN RETURN 'invalid_request'; END IF;
    IF EXISTS (SELECT 1 FROM agency_private.organization_invites
      WHERE organization_id=p_organization AND intended_email=target_identity.normalized_email
        AND status='created' AND expires_at>clock_timestamp()) THEN RETURN 'invalid_request'; END IF;
    INSERT INTO agency_private.organization_invites
      (organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at)
      VALUES (p_organization,p_actor,target_identity.normalized_email,p_role,p_digest,now()+interval '7 days')
      RETURNING id INTO new_invite_id;
    INSERT INTO agency_private.organization_memberships
      (organization_id,user_id,role,status,invited_by)
      VALUES (p_organization,p_target,p_role,'invited',p_actor) RETURNING id INTO new_member_id;
    PERFORM agency_private.phase2_audit(p_organization,p_actor,new_member_id,'invite_created',
      '{}'::jsonb,jsonb_build_object('status','created','role',p_role,'invite_id',new_invite_id),p_reason,p_correlation);
    RETURN 'accepted';
  END IF;

  IF p_action = 'revoke_invite' THEN
    IF p_invite IS NULL OR nullif(trim(coalesce(p_reason,'')),'') IS NULL THEN RETURN 'invalid_request'; END IF;
    SELECT * INTO inv FROM agency_private.organization_invites WHERE id=p_invite AND organization_id=p_organization FOR UPDATE;
    IF NOT FOUND OR inv.status <> 'created' THEN RETURN 'forbidden'; END IF;
    SELECT * INTO target_identity FROM agency_private.local_auth_identities WHERE normalized_email=inv.intended_email;
    SELECT * INTO target_member FROM agency_private.organization_memberships
      WHERE organization_id=p_organization AND user_id=target_identity.user_id AND status='invited' FOR UPDATE;
    UPDATE agency_private.organization_invites SET status='revoked',revoked_at=now() WHERE id=inv.id;
    IF FOUND THEN UPDATE agency_private.organization_memberships SET status='revoked',revoked_at=now() WHERE id=target_member.id; END IF;
    PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,'invite_revoked',
      jsonb_build_object('status','created'),jsonb_build_object('status','revoked','invite_id',inv.id),p_reason,p_correlation);
    RETURN 'accepted';
  END IF;

  IF p_target IS NULL OR nullif(trim(coalesce(p_reason,'')),'') IS NULL OR char_length(p_reason)>1000 THEN RETURN 'invalid_request'; END IF;
  SELECT * INTO target_member FROM agency_private.organization_memberships
    WHERE organization_id=p_organization AND user_id=p_target AND status IN ('invited','active','suspended') FOR UPDATE;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;
  old_state := jsonb_build_object('status',target_member.status,'role',target_member.role);

  IF p_action = 'change_member_role' THEN
    IF target_member.status <> 'active' THEN RETURN 'invalid_request'; END IF;
    IF p_target=p_actor AND (p_role IS NULL OR p_role NOT IN ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN')) THEN RETURN 'forbidden'; END IF;
    IF p_role IS NULL OR p_role NOT IN ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN') THEN RETURN 'invalid_request'; END IF;
    old_rank := array_position(ARRAY['VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN'],target_member.role);
    new_rank := array_position(ARRAY['VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN'],p_role);
    IF p_target=p_actor AND new_rank>old_rank THEN RETURN 'forbidden'; END IF;
    IF target_member.role='AGENCY_ADMIN' AND p_role<>'AGENCY_ADMIN' THEN
      SELECT count(*) INTO admin_count FROM agency_private.organization_memberships
        WHERE organization_id=p_organization AND role='AGENCY_ADMIN' AND status='active';
      IF admin_count<=1 THEN RETURN 'forbidden'; END IF;
    END IF;
    IF p_role=target_member.role THEN RETURN 'already_processed'; END IF;
    UPDATE agency_private.organization_memberships SET role=p_role,last_role_change=now() WHERE id=target_member.id;
    new_state := jsonb_build_object('status','active','role',p_role);
    PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,'member_role_changed',old_state,new_state,p_reason,p_correlation);
    RETURN 'accepted';
  ELSIF p_action IN ('suspend_member','revoke_member') THEN
    IF p_action='suspend_member' AND target_member.status<>'active' THEN RETURN 'invalid_request'; END IF;
    IF p_action='revoke_member' AND target_member.status NOT IN ('active','suspended','invited') THEN RETURN 'invalid_request'; END IF;
    IF target_member.role='AGENCY_ADMIN' AND target_member.status='active' THEN
      SELECT count(*) INTO admin_count FROM agency_private.organization_memberships
        WHERE organization_id=p_organization AND role='AGENCY_ADMIN' AND status='active';
      IF admin_count<=1 THEN RETURN 'forbidden'; END IF;
    END IF;
    IF p_action='suspend_member' THEN
      UPDATE agency_private.organization_memberships SET status='suspended',suspended_at=now() WHERE id=target_member.id;
      new_state := jsonb_build_object('status','suspended','role',target_member.role);
    ELSE
      UPDATE agency_private.organization_memberships SET status='revoked',revoked_at=now() WHERE id=target_member.id;
      UPDATE agency_private.organization_invites SET status='revoked',revoked_at=now()
        WHERE organization_id=p_organization AND intended_email=(SELECT normalized_email FROM agency_private.local_auth_identities WHERE user_id=p_target)
          AND status='created';
      new_state := jsonb_build_object('status','revoked','role',target_member.role);
    END IF;
    UPDATE agency_private.local_auth_identities SET session_active=false,session_epoch=session_epoch+1 WHERE user_id=p_target;
    PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,
      CASE WHEN p_action='suspend_member' THEN 'member_suspended' ELSE 'member_revoked' END,
      old_state,new_state,p_reason,p_correlation);
    RETURN 'accepted';
  ELSIF p_action='reactivate_member' THEN
    IF target_member.status<>'suspended' THEN RETURN 'invalid_request'; END IF;
    IF NOT agency_private.phase2_identity_ok(p_target,true) THEN RETURN 'forbidden'; END IF;
    IF EXISTS (SELECT 1 FROM agency_private.organization_memberships WHERE user_id=p_target AND status='active') THEN RETURN 'forbidden'; END IF;
    UPDATE agency_private.organization_memberships SET status='active',suspended_at=NULL WHERE id=target_member.id;
    new_state := jsonb_build_object('status','active','role',target_member.role);
    PERFORM agency_private.phase2_audit(p_organization,p_actor,target_member.id,'member_reinstated',old_state,new_state,p_reason,p_correlation);
    RETURN 'accepted';
  END IF;
  RETURN 'invalid_request';
EXCEPTION WHEN unique_violation OR check_violation OR foreign_key_violation OR not_null_violation THEN
  RETURN 'invalid_request';
END $$;

-- These helpers take a trusted synthetic actor UUID. They are callable only by
-- the disposable fixture owner; the app fixture cannot impersonate an actor.
REVOKE ALL ON FUNCTION agency_private.phase2_identity_ok(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase2_membership_access(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase2_dashboard_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase2_audit(uuid,uuid,uuid,text,jsonb,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase2_membership_command(text,uuid,uuid,uuid,text,uuid,bytea,text,uuid,boolean) FROM PUBLIC;
COMMIT;
