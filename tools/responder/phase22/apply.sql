-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Phase 22 production-shaped session, authorization, RLS, and receipt layer.

BEGIN;

CREATE SCHEMA dispatch_phase22_local;
REVOKE ALL ON SCHEMA dispatch_phase22_local FROM PUBLIC;
GRANT USAGE ON SCHEMA dispatch_phase22_local TO dispatch_phase21_app;

CREATE TYPE dispatch_phase22_local.synthetic_aal AS ENUM ('aal1','aal2');
CREATE TYPE dispatch_phase22_local.receipt_status AS ENUM ('ACCEPTED');
CREATE TYPE dispatch_phase22_local.recovery_status AS ENUM
  ('FIRST_APPROVED','RECOVERED','CANCELLED');

CREATE TABLE dispatch_phase22_local.synthetic_sessions (
  session_id uuid PRIMARY KEY,
  auth_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  aal_level dispatch_phase22_local.synthetic_aal NOT NULL,
  totp_verified boolean NOT NULL DEFAULT false,
  issued_at timestamptz NOT NULL,
  mfa_verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  note text NOT NULL DEFAULT 'SYNTHETIC LOCAL MFA EVIDENCE - NOT PRODUCTION AUTH',
  CHECK (expires_at > issued_at),
  CHECK ((aal_level='aal2' AND totp_verified AND mfa_verified_at IS NOT NULL)
    OR (aal_level='aal1' AND NOT totp_verified AND mfa_verified_at IS NULL))
);
CREATE INDEX synthetic_sessions_user_live_idx
  ON dispatch_phase22_local.synthetic_sessions(auth_user_id,expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE dispatch_phase22_local.session_bindings (
  session_role name PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES dispatch_phase22_local.synthetic_sessions(session_id) ON DELETE RESTRICT,
  asserted_auth_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  note text NOT NULL DEFAULT 'TEST HARNESS SERVER-SIDE SESSION BINDING'
);
CREATE INDEX session_bindings_session_idx ON dispatch_phase22_local.session_bindings(session_id);
CREATE INDEX session_bindings_user_idx ON dispatch_phase22_local.session_bindings(asserted_auth_user_id);

CREATE TABLE dispatch_phase22_local.command_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES dispatch_phase22_local.synthetic_sessions(session_id) ON DELETE RESTRICT,
  command_name text NOT NULL CHECK (char_length(command_name) BETWEEN 1 AND 120),
  idempotency_key uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash)=32),
  result_ref uuid NOT NULL,
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload)='object'),
  status dispatch_phase22_local.receipt_status NOT NULL DEFAULT 'ACCEPTED',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE UNIQUE INDEX command_receipts_org_key_idx
  ON dispatch_phase22_local.command_receipts
    (organization_id,actor_user_id,command_name,idempotency_key)
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX command_receipts_platform_key_idx
  ON dispatch_phase22_local.command_receipts(actor_user_id,command_name,idempotency_key)
  WHERE organization_id IS NULL;
CREATE INDEX command_receipts_actor_time_idx
  ON dispatch_phase22_local.command_receipts(actor_user_id,created_at DESC);
CREATE INDEX command_receipts_session_idx
  ON dispatch_phase22_local.command_receipts(session_id);

CREATE TABLE dispatch_phase22_local.ownership_recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  target_membership_id uuid NOT NULL,
  organization_revision integer NOT NULL CHECK (organization_revision >= 0),
  status dispatch_phase22_local.recovery_status NOT NULL DEFAULT 'FIRST_APPROVED',
  evidence_reference text NOT NULL CHECK (char_length(evidence_reference) BETWEEN 1 AND 240),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  first_approver_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  second_approver_user_id uuid REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  recovered_at timestamptz,
  FOREIGN KEY (organization_id,target_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (second_approver_user_id IS NULL OR second_approver_user_id<>first_approver_user_id),
  CHECK ((status='RECOVERED')=(recovered_at IS NOT NULL))
);
CREATE UNIQUE INDEX ownership_recovery_one_open_org_idx
  ON dispatch_phase22_local.ownership_recovery_cases(organization_id)
  WHERE status='FIRST_APPROVED';
CREATE INDEX ownership_recovery_target_idx
  ON dispatch_phase22_local.ownership_recovery_cases(target_membership_id);
CREATE INDEX ownership_recovery_first_approver_idx
  ON dispatch_phase22_local.ownership_recovery_cases(first_approver_user_id);
CREATE INDEX ownership_recovery_second_approver_idx
  ON dispatch_phase22_local.ownership_recovery_cases(second_approver_user_id)
  WHERE second_approver_user_id IS NOT NULL;

CREATE TABLE dispatch_phase22_local.recovery_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recovery_case_id uuid NOT NULL REFERENCES dispatch_phase22_local.ownership_recovery_cases(id) ON DELETE RESTRICT,
  approver_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  approval_order smallint NOT NULL CHECK (approval_order IN (1,2)),
  session_id uuid NOT NULL REFERENCES dispatch_phase22_local.synthetic_sessions(session_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (recovery_case_id,approver_user_id),
  UNIQUE (recovery_case_id,approval_order)
);
CREATE INDEX recovery_approvals_approver_idx
  ON dispatch_phase22_local.recovery_approvals(approver_user_id);
CREATE INDEX recovery_approvals_session_idx
  ON dispatch_phase22_local.recovery_approvals(session_id);

CREATE TABLE dispatch_phase22_local.failure_injections (
  session_role name NOT NULL,
  command_name text NOT NULL,
  fail_after_step text NOT NULL CHECK (fail_after_step IN ('BUSINESS_MUTATION')),
  PRIMARY KEY (session_role,command_name),
  note text NOT NULL DEFAULT 'TEST HARNESS CONTROLLED ROLLBACK PROBE'
);

ALTER TABLE dispatch_phase21_local.capability_grants
  ADD COLUMN revoked_by_platform_actor uuid
    REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX capability_grants_one_live_binding_idx
  ON dispatch_phase21_local.capability_grants
    (organization_id,capability_key,operational_scope_id)
  WHERE status IN ('PENDING','ACTIVE','SUSPENDED');
CREATE INDEX capability_grants_revoker_idx
  ON dispatch_phase21_local.capability_grants(revoked_by_platform_actor)
  WHERE revoked_by_platform_actor IS NOT NULL;

CREATE FUNCTION dispatch_phase22_local.reject_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION 'phase22 append-only relation cannot be mutated';
END $$;

CREATE TRIGGER command_receipts_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON dispatch_phase22_local.command_receipts
FOR EACH STATEMENT EXECUTE FUNCTION dispatch_phase22_local.reject_append_only_mutation();
CREATE TRIGGER recovery_approvals_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON dispatch_phase22_local.recovery_approvals
FOR EACH STATEMENT EXECUTE FUNCTION dispatch_phase22_local.reject_append_only_mutation();

CREATE FUNCTION dispatch_phase22_local.current_session_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT b.session_id
  FROM dispatch_phase22_local.session_bindings b
  JOIN dispatch_phase22_local.synthetic_sessions s ON s.session_id=b.session_id
  WHERE b.session_role=session_user AND b.asserted_auth_user_id=s.auth_user_id
$$;

CREATE FUNCTION dispatch_phase22_local.current_actor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT s.auth_user_id
  FROM dispatch_phase22_local.session_bindings b
  JOIN dispatch_phase22_local.synthetic_sessions s ON s.session_id=b.session_id
  WHERE b.session_role=session_user AND b.asserted_auth_user_id=s.auth_user_id
$$;

CREATE FUNCTION dispatch_phase22_local.session_has_live_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE((SELECT p.status='ACTIVE'
      AND s.aal_level='aal2' AND s.totp_verified
      AND s.mfa_verified_at IS NOT NULL
      AND s.mfa_verified_at >= statement_timestamp()-interval '15 minutes'
      AND s.issued_at <= statement_timestamp()
      AND s.expires_at > statement_timestamp()
      AND s.revoked_at IS NULL
    FROM dispatch_phase22_local.session_bindings b
    JOIN dispatch_phase22_local.synthetic_sessions s ON s.session_id=b.session_id
    JOIN dispatch_phase21_local.profiles p ON p.user_id=s.auth_user_id
    WHERE b.session_role=session_user AND b.asserted_auth_user_id=s.auth_user_id),false)
$$;

CREATE OR REPLACE FUNCTION dispatch_phase21_local.current_actor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.current_actor_id()
$$;

CREATE OR REPLACE FUNCTION dispatch_phase21_local.has_permission(
  p_organization_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.session_has_live_aal2() AND EXISTS (
    SELECT 1
    FROM dispatch_phase21_local.organization_memberships m
    JOIN dispatch_phase21_local.organizations o ON o.id=m.organization_id
    JOIN dispatch_phase21_local.profiles pr ON pr.user_id=m.user_id
    JOIN dispatch_phase21_local.role_permissions rp ON rp.role_key=m.role_template
    JOIN dispatch_phase21_local.permissions p ON p.permission_key=rp.permission_key
    WHERE m.user_id=dispatch_phase22_local.current_actor_id()
      AND m.organization_id=p_organization_id AND m.status='ACTIVE'
      AND (m.expires_at IS NULL OR m.expires_at > statement_timestamp())
      AND o.status='ACTIVE' AND pr.status='ACTIVE'
      AND p.permission_key=p_permission AND p.scope_class='ORGANIZATION')
$$;

CREATE OR REPLACE FUNCTION dispatch_phase21_local.can_user_access_organization(
  p_organization_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE(
    p_organization_id=dispatch_phase21_local.requested_organization_id()
      AND dispatch_phase21_local.has_permission(p_organization_id,p_permission),false)
$$;

CREATE OR REPLACE FUNCTION dispatch_phase21_local.has_platform_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT dispatch_phase22_local.session_has_live_aal2() AND EXISTS (
    SELECT 1 FROM dispatch_phase21_local.platform_admin_grants g
    JOIN dispatch_phase21_local.permissions p ON p.permission_key=g.permission_key
    WHERE g.user_id=dispatch_phase22_local.current_actor_id() AND g.active
      AND p.permission_key=p_permission AND p.scope_class='PLATFORM')
$$;

CREATE OR REPLACE FUNCTION dispatch_phase21_local.projection_candidate_is_eligible(p_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE((SELECT c.status='APPROVED' AND c.freshness_deadline > statement_timestamp()
    AND g.status='ACTIVE' AND g.valid_from <= statement_timestamp()
    AND (g.valid_until IS NULL OR g.valid_until > statement_timestamp())
    AND s.status='ACTIVE' AND s.valid_from <= statement_timestamp()
    AND (s.valid_until IS NULL OR s.valid_until > statement_timestamp())
    AND o.status='ACTIVE' AND r.status NOT IN ('CLOSED','CANCELLED')
    AND r.operational_scope_id=g.operational_scope_id AND r.current_revision=c.source_revision
    AND CASE g.required_verification
      WHEN 'UNVERIFIED' THEN true
      WHEN 'VERIFIED_ORGANIZATION' THEN o.verification_level IN ('VERIFIED_ORGANIZATION','VERIFIED_PUBLIC_ENTITY')
      WHEN 'VERIFIED_PUBLIC_ENTITY' THEN o.verification_level='VERIFIED_PUBLIC_ENTITY'
    END
  FROM dispatch_phase21_local.projection_candidates c
  JOIN dispatch_phase21_local.operational_records r
    ON r.id=c.source_record_id AND r.organization_id=c.organization_id
  JOIN dispatch_phase21_local.capability_grants g
    ON g.id=c.capability_grant_id AND g.organization_id=c.organization_id
  JOIN dispatch_phase21_local.operational_scopes s
    ON s.id=g.operational_scope_id AND s.organization_id=g.organization_id
  JOIN dispatch_phase21_local.organizations o ON o.id=c.organization_id
  WHERE c.id=p_candidate_id),false)
$$;

CREATE OR REPLACE FUNCTION dispatch_phase21_local.enforce_exactly_one_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_org uuid; v_status dispatch_phase21_local.organization_status; v_count integer;
BEGIN
  IF TG_TABLE_NAME='organizations' THEN
    v_org:=COALESCE(NEW.id,OLD.id);
  ELSE
    v_org:=COALESCE(NEW.organization_id,OLD.organization_id);
  END IF;
  SELECT status INTO v_status FROM dispatch_phase21_local.organizations WHERE id=v_org;
  IF NOT FOUND OR v_status='CLOSED' THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_count FROM dispatch_phase21_local.organization_memberships
    WHERE organization_id=v_org AND status='ACTIVE' AND role_template='OWNER'
      AND (expires_at IS NULL OR expires_at>statement_timestamp());
  IF v_count<>1 THEN RAISE EXCEPTION 'non-closed organization requires exactly one active owner'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.enforce_exactly_one_owner() FROM PUBLIC;

DROP POLICY profiles_self_read ON dispatch_phase21_local.profiles;
CREATE POLICY profiles_self_read ON dispatch_phase21_local.profiles FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase22_local.session_has_live_aal2()
    AND user_id=dispatch_phase22_local.current_actor_id());

DROP POLICY memberships_scoped_read ON dispatch_phase21_local.organization_memberships;
CREATE POLICY memberships_scoped_read ON dispatch_phase21_local.organization_memberships
  FOR SELECT TO dispatch_phase21_app USING (
    dispatch_phase21_local.can_user_access_organization(organization_id,'organization.read')
    AND (user_id=dispatch_phase21_local.current_actor_id()
      OR dispatch_phase21_local.has_permission(organization_id,'members.read')));

REVOKE EXECUTE ON FUNCTION dispatch_phase21_local.local_accept_ownership_transfer(uuid)
  FROM dispatch_phase21_app;

ALTER TABLE dispatch_phase22_local.synthetic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.synthetic_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.session_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.session_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.command_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.ownership_recovery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.ownership_recovery_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.recovery_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.recovery_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.failure_injections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase22_local.failure_injections FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA dispatch_phase22_local
  FROM PUBLIC,dispatch_phase21_app,dispatch_phase21_public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA dispatch_phase22_local
  FROM PUBLIC,dispatch_phase21_app,dispatch_phase21_public;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dispatch_phase22_local
  FROM PUBLIC,dispatch_phase21_app,dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase22_local.session_has_live_aal2()
  TO dispatch_phase21_app;

COMMIT;
