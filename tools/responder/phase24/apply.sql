-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Real local Supabase Auth bridge loaded after Phase 21 and Phase 22.

BEGIN;

CREATE SCHEMA dispatch_phase24_local;
REVOKE ALL ON SCHEMA dispatch_phase24_local FROM PUBLIC;

ALTER TABLE dispatch_phase22_local.command_receipts
  DROP CONSTRAINT command_receipts_session_id_fkey;
ALTER TABLE dispatch_phase22_local.recovery_approvals
  DROP CONSTRAINT recovery_approvals_session_id_fkey;

CREATE OR REPLACE FUNCTION dispatch_phase22_local.current_session_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN COALESCE(auth.jwt()->>'session_id','') ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (auth.jwt()->>'session_id')::uuid END
$$;

CREATE OR REPLACE FUNCTION dispatch_phase22_local.current_actor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid()
$$;

CREATE OR REPLACE FUNCTION dispatch_phase22_local.session_has_live_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE((SELECT
    c->>'aal'='aal2'
    AND c->'amr' @> '[{"method":"totp"}]'::jsonb
    AND (c->>'exp')::bigint > extract(epoch FROM statement_timestamp())::bigint
    AND (c->>'iat')::bigint <= extract(epoch FROM statement_timestamp())::bigint
    AND u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
    AND u.deleted_at IS NULL
    AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
    AND s.user_id=u.id AND s.aal='aal2'
    AND (s.not_after IS NULL OR s.not_after>statement_timestamp())
    AND f.user_id=u.id AND f.factor_type='totp' AND f.status='verified'
    AND EXISTS (SELECT 1 FROM auth.mfa_amr_claims a
      WHERE a.session_id=s.id AND a.authentication_method='totp')
    AND p.status='ACTIVE'
  FROM (SELECT auth.jwt() c) claims
  JOIN auth.users u ON u.id=auth.uid()
  JOIN auth.sessions s ON s.id=dispatch_phase22_local.current_session_id()
  JOIN auth.mfa_factors f ON f.id=s.factor_id
  JOIN dispatch_phase21_local.profiles p ON p.user_id=u.id),false)
$$;

CREATE FUNCTION dispatch_phase24_local.invitation_target_matches(p_target text,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN p_target LIKE 'user:%' THEN p_target='user:'||p_user::text
    WHEN p_target LIKE 'email:%' THEN EXISTS (
      SELECT 1 FROM auth.identities i JOIN auth.users u ON u.id=i.user_id
      WHERE i.user_id=p_user AND lower(i.email)=substring(p_target FROM 7)
        AND lower(u.email)=substring(p_target FROM 7)
        AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
        AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp()))
    ELSE false END
$$;

CREATE FUNCTION dispatch_phase24_local.enforce_invitation_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.status<>'PENDING' OR NEW.status NOT IN ('ACCEPTED','DECLINED','EXPIRED','REVOKED') THEN
    RAISE EXCEPTION 'terminal invitation state is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase24_invitation_transitions BEFORE UPDATE OF status
  ON dispatch_phase21_local.organization_invitations FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION dispatch_phase24_local.enforce_invitation_transition();

CREATE FUNCTION dispatch_phase24_local.invite_member(
  p_organization_id uuid,p_expected_org_revision integer,p_target text,
  p_role dispatch_phase21_local.role_template_key,p_token_digest bytea,p_expires_at timestamptz,
  p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_invitation uuid:=gen_random_uuid();
  v_org dispatch_phase21_local.organizations%ROWTYPE; v_target text;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'members.invite');
  v_target:=CASE WHEN p_target LIKE 'email:%' THEN 'email:'||lower(btrim(substring(p_target FROM 7))) ELSE lower(p_target) END;
  IF p_role='OWNER' OR octet_length(p_token_digest)<>32 OR p_expires_at<=statement_timestamp()
    OR (v_target NOT LIKE 'user:%' AND v_target NOT LIKE 'email:%') THEN RAISE EXCEPTION 'invalid invitation'; END IF;
  IF v_target LIKE 'email:%' AND substring(v_target FROM 7) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid invitation'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',24,'org_revision',p_expected_org_revision,
    'target',v_target,'role',p_role,'token_digest',pg_catalog.encode(p_token_digest,'hex'),'expires',p_expires_at));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'phase24_invite_member',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_org FROM dispatch_phase21_local.organizations WHERE id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_org.governance_revision<>p_expected_org_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships m
    WHERE m.organization_id=p_organization_id AND m.status IN ('INVITED','ACTIVE','SUSPENDED')
      AND dispatch_phase24_local.invitation_target_matches(v_target,m.user_id)) THEN
    RAISE EXCEPTION 'duplicate live membership'; END IF;
  INSERT INTO dispatch_phase21_local.organization_invitations
    (id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id)
  VALUES (v_invitation,p_organization_id,v_target,p_role,p_token_digest,'PENDING',p_expires_at,v_membership);
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'MEMBER_INVITED',
    'organization_invitation',v_invitation,pg_catalog.jsonb_build_object('role',p_role,'target_kind',split_part(v_target,':',1)),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'phase24_invite_member',p_idempotency_key,
    v_hash,v_invitation,pg_catalog.jsonb_build_object('outcome','accepted','organization_revision',p_expected_org_revision+1));
  RETURN v_invitation;
END $$;

CREATE FUNCTION dispatch_phase24_local.accept_invitation(
  p_organization_id uuid,p_invitation_id uuid,p_plaintext_token text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_digest bytea; v_replay uuid; v_membership uuid:=gen_random_uuid();
  v_inv dispatch_phase21_local.organization_invitations%ROWTYPE;
BEGIN
  v_actor:=dispatch_phase22_local.assert_live_session();
  IF p_plaintext_token IS NULL OR char_length(p_plaintext_token)<32 OR char_length(p_plaintext_token)>512 THEN
    RAISE EXCEPTION 'invalid invitation'; END IF;
  IF dispatch_phase21_local.requested_organization_id() IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organizations WHERE id=p_organization_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_digest:=public.digest(pg_catalog.convert_to(p_plaintext_token,'UTF8'),'sha256');
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',24,'invitation',p_invitation_id,
    'token_digest',pg_catalog.encode(v_digest,'hex')));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'phase24_accept_invitation',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_inv FROM dispatch_phase21_local.organization_invitations
    WHERE id=p_invitation_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status<>'PENDING' OR v_inv.expires_at<=statement_timestamp()
    OR v_inv.token_digest<>v_digest
    OR NOT dispatch_phase24_local.invitation_target_matches(v_inv.email_or_identity_target,v_actor) THEN
    RAISE EXCEPTION 'invalid invitation'; END IF;
  IF EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships
    WHERE organization_id=p_organization_id AND user_id=v_actor
      AND status IN ('INVITED','ACTIVE','SUSPENDED')) THEN RAISE EXCEPTION 'duplicate live membership'; END IF;
  INSERT INTO dispatch_phase21_local.organization_memberships
    (id,organization_id,user_id,status,role_template,activated_at)
  VALUES (v_membership,p_organization_id,v_actor,'ACTIVE',v_inv.role_template,statement_timestamp());
  UPDATE dispatch_phase21_local.organization_invitations SET status='ACCEPTED',accepted_at=statement_timestamp()
    WHERE id=p_invitation_id;
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'INVITATION_ACCEPTED',
    'organization_invitation',p_invitation_id,pg_catalog.jsonb_build_object('membership_id',v_membership),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'phase24_accept_invitation',p_idempotency_key,
    v_hash,v_membership,pg_catalog.jsonb_build_object('outcome','accepted','invitation_id',p_invitation_id));
  RETURN v_membership;
END $$;

CREATE FUNCTION dispatch_phase24_local.revoke_invitation(
  p_organization_id uuid,p_invitation_id uuid,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_membership uuid; v_hash bytea; v_replay uuid; v_inv dispatch_phase21_local.organization_invitations%ROWTYPE;
BEGIN
  v_membership:=dispatch_phase22_local.assert_org_permission(p_organization_id,'members.invite');
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',24,'invitation',p_invitation_id));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'phase24_revoke_invitation',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_inv FROM dispatch_phase21_local.organization_invitations
    WHERE id=p_invitation_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status<>'PENDING' THEN RAISE EXCEPTION 'invalid invitation'; END IF;
  UPDATE dispatch_phase21_local.organization_invitations SET status='REVOKED',revoked_at=statement_timestamp()
    WHERE id=p_invitation_id;
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'phase24_revoke_invitation',p_idempotency_key,
    v_hash,p_invitation_id,pg_catalog.jsonb_build_object('outcome','revoked'));
  RETURN p_invitation_id;
END $$;

CREATE FUNCTION public.phase24_create_record(p_organization_id uuid,p_title text,p_scope_id uuid,
  p_location jsonb,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase22_local.create_operational_record(p_organization_id,'CONDITION','OPEN','NORMAL',
    p_title,'real local Auth command',p_scope_id,p_location,p_idempotency_key);
END $$;

CREATE FUNCTION public.phase24_invite(p_organization_id uuid,p_expected_revision integer,p_email text,
  p_role text,p_token_digest_hex text,p_expires_at timestamptz,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase24_local.invite_member(p_organization_id,p_expected_revision,'email:'||p_email,
    p_role::dispatch_phase21_local.role_template_key,pg_catalog.decode(p_token_digest_hex,'hex'),p_expires_at,p_idempotency_key);
END $$;

CREATE FUNCTION public.phase24_accept_invitation(p_organization_id uuid,p_invitation_id uuid,
  p_plaintext_token text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase24_local.accept_invitation(p_organization_id,p_invitation_id,p_plaintext_token,p_idempotency_key);
END $$;

CREATE FUNCTION public.phase24_revoke_invitation(p_organization_id uuid,p_invitation_id uuid,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase24_local.revoke_invitation(p_organization_id,p_invitation_id,p_idempotency_key);
END $$;

CREATE FUNCTION public.phase24_has_permission(p_organization_id uuid,p_permission text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase21_local.has_permission(p_organization_id,p_permission);
END $$;

CREATE FUNCTION public.phase24_has_platform_permission(p_permission text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT dispatch_phase21_local.has_platform_permission(p_permission)
$$;

CREATE FUNCTION public.phase24_grant_capability(p_organization_id uuid,p_expected_revision integer,
  p_capability_key text,p_scope_id uuid,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase22_local.grant_capability(p_organization_id,p_expected_revision,p_capability_key,
    p_scope_id,'VERIFIED_ORGANIZATION',statement_timestamp(),statement_timestamp()+interval '1 day',
    'phase24 real local Auth evidence',p_idempotency_key);
END $$;

CREATE FUNCTION public.phase24_submit_projection(p_organization_id uuid,p_record_id uuid,p_capability_id uuid,
  p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM pg_catalog.set_config('dispatch_phase21.requested_organization',p_organization_id::text,true);
  RETURN dispatch_phase22_local.submit_projection_candidate(p_organization_id,p_record_id,0,p_capability_id,
    '{"title":"Phase 24","summary":"Real local Auth"}'::jsonb,'condition',
    statement_timestamp()+interval '1 hour',p_idempotency_key);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_phase24_local FROM PUBLIC;
REVOKE ALL ON FUNCTION public.phase24_create_record(uuid,text,uuid,jsonb,uuid),
  public.phase24_invite(uuid,integer,text,text,text,timestamptz,uuid),
  public.phase24_accept_invitation(uuid,uuid,text,uuid),
  public.phase24_revoke_invitation(uuid,uuid,uuid),
  public.phase24_has_permission(uuid,text),public.phase24_has_platform_permission(text),
  public.phase24_grant_capability(uuid,integer,text,uuid,uuid),
  public.phase24_submit_projection(uuid,uuid,uuid,uuid) FROM PUBLIC;

GRANT USAGE ON SCHEMA dispatch_phase21_local,dispatch_phase22_local,dispatch_phase24_local TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.create_operational_record(
  uuid,dispatch_phase21_local.record_type,dispatch_phase21_local.record_status,
  dispatch_phase21_local.record_priority,text,text,uuid,jsonb,uuid),
  dispatch_phase22_local.session_has_live_aal2(),
  dispatch_phase22_local.grant_capability(uuid,integer,text,uuid,dispatch_phase21_local.verification_level,
    timestamptz,timestamptz,text,uuid),
  dispatch_phase22_local.submit_projection_candidate(uuid,uuid,integer,uuid,jsonb,text,timestamptz,uuid),
  dispatch_phase24_local.invite_member(uuid,integer,text,dispatch_phase21_local.role_template_key,bytea,timestamptz,uuid),
  dispatch_phase24_local.accept_invitation(uuid,uuid,text,uuid),
  dispatch_phase24_local.revoke_invitation(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.has_permission(uuid,text),
  dispatch_phase21_local.has_platform_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.phase24_create_record(uuid,text,uuid,jsonb,uuid),
  public.phase24_invite(uuid,integer,text,text,text,timestamptz,uuid),
  public.phase24_accept_invitation(uuid,uuid,text,uuid),
  public.phase24_revoke_invitation(uuid,uuid,uuid),
  public.phase24_has_permission(uuid,text),public.phase24_has_platform_permission(text),
  public.phase24_grant_capability(uuid,integer,text,uuid,uuid),
  public.phase24_submit_projection(uuid,uuid,uuid,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
