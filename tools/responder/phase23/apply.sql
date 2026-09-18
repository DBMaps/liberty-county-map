-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Faithful Auth/JWT/TOTP integration harness loaded after Phases 21 and 22.

BEGIN;

CREATE SCHEMA dispatch_phase23_auth;
REVOKE ALL ON SCHEMA dispatch_phase23_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA dispatch_phase23_auth TO dispatch_phase21_app;

CREATE TYPE dispatch_phase23_auth.user_status AS ENUM ('ACTIVE','DISABLED','DELETED');
CREATE TYPE dispatch_phase23_auth.factor_status AS ENUM ('UNVERIFIED','VERIFIED','REVOKED','DELETED');
CREATE TYPE dispatch_phase23_auth.assurance_level AS ENUM ('aal1','aal2');

CREATE TABLE dispatch_phase23_auth.auth_users (
  id uuid PRIMARY KEY,
  email_normalized text NOT NULL UNIQUE,
  email_verified_at timestamptz,
  status dispatch_phase23_auth.user_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CHECK (email_normalized=lower(btrim(email_normalized))),
  CHECK (char_length(email_normalized) BETWEEN 3 AND 248)
);

CREATE TABLE dispatch_phase23_auth.auth_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES dispatch_phase23_auth.auth_users(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('email','google','azure')),
  provider_subject text NOT NULL,
  email_normalized text NOT NULL,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (provider,provider_subject),
  CHECK (email_normalized=lower(btrim(email_normalized))),
  CHECK (char_length(provider_subject) BETWEEN 1 AND 512)
);
CREATE INDEX auth_identities_user_idx ON dispatch_phase23_auth.auth_identities(user_id);
CREATE INDEX auth_identities_verified_email_idx ON dispatch_phase23_auth.auth_identities(email_normalized,user_id)
  WHERE email_verified_at IS NOT NULL;

CREATE TABLE dispatch_phase23_auth.auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES dispatch_phase23_auth.auth_users(id) ON DELETE RESTRICT,
  issued_at timestamptz NOT NULL,
  refreshed_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (refreshed_at>=issued_at),
  CHECK (expires_at>issued_at)
);
CREATE INDEX auth_sessions_user_live_idx ON dispatch_phase23_auth.auth_sessions(user_id,expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE dispatch_phase23_auth.auth_factors (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES dispatch_phase23_auth.auth_users(id) ON DELETE RESTRICT,
  factor_type text NOT NULL CHECK (factor_type='totp'),
  status dispatch_phase23_auth.factor_status NOT NULL,
  secret_reference text NOT NULL CHECK (secret_reference LIKE 'local-opaque:%'),
  enrolled_at timestamptz NOT NULL,
  verified_at timestamptz,
  revoked_at timestamptz,
  deleted_at timestamptz,
  CHECK ((status='VERIFIED')=(verified_at IS NOT NULL AND revoked_at IS NULL AND deleted_at IS NULL)),
  CHECK ((status='REVOKED')=(revoked_at IS NOT NULL)),
  CHECK ((status='DELETED')=(deleted_at IS NOT NULL))
);
CREATE INDEX auth_factors_user_status_idx ON dispatch_phase23_auth.auth_factors(user_id,status);

CREATE TABLE dispatch_phase23_auth.auth_session_amr (
  session_id uuid NOT NULL REFERENCES dispatch_phase23_auth.auth_sessions(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (method IN ('password','oauth','totp')),
  factor_id uuid REFERENCES dispatch_phase23_auth.auth_factors(id) ON DELETE RESTRICT,
  authenticated_at timestamptz NOT NULL,
  PRIMARY KEY (session_id,method),
  CHECK ((method='totp')=(factor_id IS NOT NULL))
);
CREATE INDEX auth_session_amr_factor_idx ON dispatch_phase23_auth.auth_session_amr(factor_id)
  WHERE factor_id IS NOT NULL;

-- This relation stands in for claims already signature-verified by the Auth/API tier.
-- Application roles cannot write it and no request GUC is consulted.
CREATE TABLE dispatch_phase23_auth.trusted_claim_bindings (
  session_role name PRIMARY KEY,
  subject uuid NOT NULL,
  session_id uuid NOT NULL,
  aal dispatch_phase23_auth.assurance_level NOT NULL,
  amr jsonb NOT NULL CHECK (jsonb_typeof(amr)='array'),
  email_normalized text,
  email_verified boolean NOT NULL,
  token_issued_at timestamptz NOT NULL,
  token_expires_at timestamptz NOT NULL,
  CHECK (token_expires_at>token_issued_at)
);
CREATE INDEX trusted_claim_bindings_session_idx ON dispatch_phase23_auth.trusted_claim_bindings(session_id);
CREATE INDEX trusted_claim_bindings_subject_idx ON dispatch_phase23_auth.trusted_claim_bindings(subject);

CREATE TABLE dispatch_phase23_auth.auth_security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES dispatch_phase23_auth.auth_users(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES dispatch_phase23_auth.auth_sessions(id) ON DELETE RESTRICT,
  factor_id uuid REFERENCES dispatch_phase23_auth.auth_factors(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN
    ('USER_CREATED','LOGIN','LOGOUT','FACTOR_ENROLLED','FACTOR_VERIFIED','FACTOR_REVOKED','PASSWORD_RECOVERY_REQUESTED')),
  event_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object')
);
CREATE INDEX auth_security_events_user_time_idx ON dispatch_phase23_auth.auth_security_events(user_id,event_at DESC);
CREATE INDEX auth_security_events_session_idx ON dispatch_phase23_auth.auth_security_events(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX auth_security_events_factor_idx ON dispatch_phase23_auth.auth_security_events(factor_id) WHERE factor_id IS NOT NULL;

CREATE FUNCTION dispatch_phase23_auth.reject_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'phase23 auth security events are append-only'; END $$;
CREATE TRIGGER auth_security_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE
  ON dispatch_phase23_auth.auth_security_events FOR EACH STATEMENT
  EXECUTE FUNCTION dispatch_phase23_auth.reject_append_only_mutation();

ALTER TABLE dispatch_phase22_local.command_receipts DROP CONSTRAINT command_receipts_session_id_fkey;
ALTER TABLE dispatch_phase22_local.command_receipts ADD CONSTRAINT command_receipts_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES dispatch_phase23_auth.auth_sessions(id) ON DELETE RESTRICT;
ALTER TABLE dispatch_phase22_local.recovery_approvals DROP CONSTRAINT recovery_approvals_session_id_fkey;
ALTER TABLE dispatch_phase22_local.recovery_approvals ADD CONSTRAINT recovery_approvals_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES dispatch_phase23_auth.auth_sessions(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION dispatch_phase22_local.current_session_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT c.session_id FROM dispatch_phase23_auth.trusted_claim_bindings c
  WHERE c.session_role=session_user
$$;

CREATE OR REPLACE FUNCTION dispatch_phase22_local.current_actor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT c.subject FROM dispatch_phase23_auth.trusted_claim_bindings c
  WHERE c.session_role=session_user
$$;

CREATE OR REPLACE FUNCTION dispatch_phase22_local.session_has_live_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE((SELECT
    c.aal='aal2' AND c.amr @> '[{"method":"totp"}]'::jsonb
    AND c.token_issued_at<=statement_timestamp() AND c.token_expires_at>statement_timestamp()
    AND c.email_verified
    AND u.id=c.subject AND u.status='ACTIVE' AND u.email_verified_at IS NOT NULL
    AND s.id=c.session_id AND s.user_id=c.subject AND s.issued_at<=statement_timestamp()
    AND s.expires_at>statement_timestamp() AND s.revoked_at IS NULL
    AND p.status='ACTIVE'
    AND EXISTS (
      SELECT 1 FROM dispatch_phase23_auth.auth_session_amr a
      JOIN dispatch_phase23_auth.auth_factors f ON f.id=a.factor_id
      WHERE a.session_id=s.id AND a.method='totp' AND a.authenticated_at>=s.issued_at
        AND a.authenticated_at<=statement_timestamp()
        AND f.user_id=s.user_id AND f.factor_type='totp' AND f.status='VERIFIED'
        AND f.verified_at IS NOT NULL AND f.revoked_at IS NULL AND f.deleted_at IS NULL)
  FROM dispatch_phase23_auth.trusted_claim_bindings c
  JOIN dispatch_phase23_auth.auth_users u ON u.id=c.subject
  JOIN dispatch_phase23_auth.auth_sessions s ON s.id=c.session_id
  JOIN dispatch_phase21_local.profiles p ON p.user_id=c.subject
  WHERE c.session_role=session_user),false)
$$;

CREATE FUNCTION dispatch_phase23_auth.invitation_target_matches(p_target text,p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE
    WHEN p_target LIKE 'user:%' THEN p_target='user:'||p_user::text
    WHEN p_target LIKE 'email:%' THEN EXISTS (
      SELECT 1 FROM dispatch_phase23_auth.auth_identities i
      JOIN dispatch_phase23_auth.auth_users u ON u.id=i.user_id
      WHERE i.user_id=p_user AND i.email_verified_at IS NOT NULL AND u.email_verified_at IS NOT NULL
        AND u.status='ACTIVE' AND i.email_normalized=substring(p_target FROM 7))
    ELSE false END
$$;

CREATE FUNCTION dispatch_phase23_auth.enforce_invitation_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.status<>'PENDING' OR NEW.status NOT IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','REVOKED') THEN
    RAISE EXCEPTION 'terminal invitation state is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase23_invitation_transitions BEFORE UPDATE OF status
  ON dispatch_phase21_local.organization_invitations FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION dispatch_phase23_auth.enforce_invitation_transition();

CREATE FUNCTION dispatch_phase23_auth.invite_member(
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
  IF v_target LIKE 'user:%' AND NOT EXISTS (SELECT 1 FROM dispatch_phase23_auth.auth_users
      WHERE id=substring(v_target FROM 6)::uuid AND status='ACTIVE') THEN RAISE EXCEPTION 'invalid invitation'; END IF;
  IF v_target LIKE 'email:%' AND (substring(v_target FROM 7) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'invalid invitation'; END IF;
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',2,'org_revision',p_expected_org_revision,
    'target',v_target,'role',p_role,'token_digest',pg_catalog.encode(p_token_digest,'hex'),'expires',p_expires_at));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'invite_member_v2',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_org FROM dispatch_phase21_local.organizations WHERE id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_org.governance_revision<>p_expected_org_revision THEN RAISE EXCEPTION 'stale or forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM dispatch_phase21_local.organization_memberships m
      WHERE m.organization_id=p_organization_id AND m.status IN ('INVITED','ACTIVE','SUSPENDED')
        AND dispatch_phase23_auth.invitation_target_matches(v_target,m.user_id)) THEN RAISE EXCEPTION 'duplicate live membership'; END IF;
  INSERT INTO dispatch_phase21_local.organization_invitations
    (id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id)
  VALUES (v_invitation,p_organization_id,v_target,p_role,p_token_digest,'PENDING',p_expires_at,v_membership);
  UPDATE dispatch_phase21_local.organizations SET governance_revision=governance_revision+1,
    updated_at=statement_timestamp() WHERE id=p_organization_id;
  PERFORM dispatch_phase22_local.emit_audit(p_organization_id,v_membership,'MEMBER_INVITED',
    'organization_invitation',v_invitation,pg_catalog.jsonb_build_object('role',p_role,'target_kind',split_part(v_target,':',1)),p_idempotency_key);
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'invite_member_v2',p_idempotency_key,
    v_hash,v_invitation,pg_catalog.jsonb_build_object('outcome','accepted','organization_revision',p_expected_org_revision+1));
  RETURN v_invitation;
END $$;

CREATE FUNCTION dispatch_phase23_auth.accept_invitation(
  p_organization_id uuid,p_invitation_id uuid,p_plaintext_token text,p_idempotency_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_hash bytea; v_token_digest bytea; v_replay uuid; v_membership uuid:=gen_random_uuid();
  v_inv dispatch_phase21_local.organization_invitations%ROWTYPE;
BEGIN
  v_actor:=dispatch_phase22_local.assert_live_session();
  IF p_plaintext_token IS NULL OR char_length(p_plaintext_token)<32 OR char_length(p_plaintext_token)>512 THEN RAISE EXCEPTION 'invalid invitation'; END IF;
  IF dispatch_phase21_local.requested_organization_id() IS DISTINCT FROM p_organization_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organizations WHERE id=p_organization_id AND status='ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_token_digest:=public.digest(pg_catalog.convert_to(p_plaintext_token,'UTF8'),'sha256');
  v_hash:=dispatch_phase22_local.request_hash(pg_catalog.jsonb_build_object('v',2,'invitation',p_invitation_id,
    'token_digest',pg_catalog.encode(v_token_digest,'hex')));
  v_replay:=dispatch_phase22_local.begin_command(p_organization_id,'accept_invitation_v2',p_idempotency_key,v_hash);
  IF v_replay IS NOT NULL THEN RETURN v_replay; END IF;
  SELECT * INTO v_inv FROM dispatch_phase21_local.organization_invitations
    WHERE id=p_invitation_id AND organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND OR v_inv.status<>'PENDING' OR v_inv.expires_at<=statement_timestamp()
    OR v_inv.token_digest<>v_token_digest
    OR NOT dispatch_phase23_auth.invitation_target_matches(v_inv.email_or_identity_target,v_actor) THEN
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
  PERFORM dispatch_phase22_local.finish_command(p_organization_id,'accept_invitation_v2',p_idempotency_key,
    v_hash,v_membership,pg_catalog.jsonb_build_object('outcome','accepted','invitation_id',p_invitation_id));
  RETURN v_membership;
END $$;

REVOKE EXECUTE ON FUNCTION dispatch_phase22_local.invite_member(uuid,integer,uuid,dispatch_phase21_local.role_template_key,bytea,timestamptz,uuid) FROM dispatch_phase21_app;
REVOKE EXECUTE ON FUNCTION dispatch_phase22_local.accept_invitation(uuid,uuid,bytea,uuid) FROM dispatch_phase21_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_phase23_auth FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_phase23_auth.invite_member(uuid,integer,text,dispatch_phase21_local.role_template_key,bytea,timestamptz,uuid) TO dispatch_phase21_app;
GRANT EXECUTE ON FUNCTION dispatch_phase23_auth.accept_invitation(uuid,uuid,text,uuid) TO dispatch_phase21_app;

COMMIT;
