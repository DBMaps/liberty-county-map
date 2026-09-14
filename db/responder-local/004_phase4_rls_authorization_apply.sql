-- LOCAL/DISPOSABLE ONLY. Synthetic PostgreSQL login roles stand in for Auth sessions.
-- Requires Phase 1/2/3 local schema; never deploy as a production policy or RPC.
BEGIN;

CREATE ROLE responder_rls_agency_fixture NOLOGIN;
CREATE ROLE responder_rls_governance_fixture NOLOGIN;
GRANT USAGE ON SCHEMA agency_private TO responder_rls_agency_fixture, responder_rls_governance_fixture;

CREATE TABLE agency_private.phase4_session_bindings (
  db_role name PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES agency_private.local_auth_identities(user_id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('RESPONDER','GRIDLY_ADMIN'))
);
REVOKE ALL ON agency_private.phase4_session_bindings FROM PUBLIC;

-- SECURITY DEFINER is limited to this disposable fixture: policy lookups must read
-- live identity, organization, and membership rows without recursive RLS. Each
-- helper derives the actor from PostgreSQL session_user, has no caller actor input,
-- has a fixed search_path, and returns only a bounded scalar.
CREATE FUNCTION agency_private.phase4_actor_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT b.user_id FROM agency_private.phase4_session_bindings b
  JOIN agency_private.local_auth_identities i ON i.user_id=b.user_id
  WHERE b.db_role=session_user::name AND b.actor_kind='RESPONDER'
    AND i.identity_kind='RESPONDER' AND i.session_active
    AND i.assurance='aal2' AND i.eligibility='eligible';
$$;

CREATE FUNCTION agency_private.phase4_member_role(p_organization uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT m.role FROM agency_private.phase4_session_bindings b
  JOIN agency_private.local_auth_identities i ON i.user_id=b.user_id
  JOIN agency_private.organization_memberships m ON m.user_id=b.user_id
    AND m.organization_id=p_organization AND m.status='active'
  JOIN agency_private.organizations o ON o.id=m.organization_id
  WHERE b.db_role=session_user::name AND b.actor_kind='RESPONDER'
    AND i.identity_kind='RESPONDER' AND i.session_active
    AND i.assurance='aal2' AND i.eligibility='eligible'
    AND o.verification_state='verified' AND o.operation_state='active';
$$;

CREATE FUNCTION agency_private.phase4_governance_ok() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (SELECT 1 FROM agency_private.phase4_session_bindings b
    JOIN agency_private.local_auth_identities i ON i.user_id=b.user_id
    WHERE b.db_role=session_user::name AND b.actor_kind='GRIDLY_ADMIN'
      AND i.identity_kind='GRIDLY_ADMIN' AND i.session_active
      AND i.assurance='aal2' AND i.eligibility='eligible');
$$;

REVOKE ALL ON FUNCTION agency_private.phase4_actor_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase4_member_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION agency_private.phase4_governance_ok() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agency_private.phase4_actor_id(),
  agency_private.phase4_member_role(uuid) TO responder_rls_agency_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase4_governance_ok()
  TO responder_rls_governance_fixture;

-- The owner-fixture/superuser still performs synthetic setup; all ordinary
-- fixture roles are subject to these forced policies and column grants.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations','organization_memberships','organization_authorities',
    'agency_updates','agency_update_events','organization_verification_events',
    'organization_governance_events','organization_invites','agency_operation_receipts',
    'agency_program_controls','local_auth_identities','county_geometry_catalog',
    'phase4_session_bindings'] LOOP
    EXECUTE format('ALTER TABLE agency_private.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE agency_private.%I FORCE ROW LEVEL SECURITY',table_name);
  END LOOP;
END $$;

CREATE POLICY phase4_organization_read ON agency_private.organizations
  FOR SELECT TO responder_rls_agency_fixture
  USING (agency_private.phase4_member_role(id) IS NOT NULL);
CREATE POLICY phase4_membership_read ON agency_private.organization_memberships
  FOR SELECT TO responder_rls_agency_fixture
  USING (agency_private.phase4_member_role(organization_id) IS NOT NULL
    AND (user_id=(SELECT agency_private.phase4_actor_id())
      OR agency_private.phase4_member_role(organization_id) IN ('SUPERVISOR','AGENCY_ADMIN')));
CREATE POLICY phase4_authority_read ON agency_private.organization_authorities
  FOR SELECT TO responder_rls_agency_fixture
  USING (agency_private.phase4_member_role(organization_id) IS NOT NULL
    AND status='approved' AND revoked_at IS NULL AND effective_from<=now()
    AND (effective_until IS NULL OR effective_until>now()));
CREATE POLICY phase4_invite_read ON agency_private.organization_invites
  FOR SELECT TO responder_rls_agency_fixture
  USING (agency_private.phase4_member_role(organization_id)='AGENCY_ADMIN');
CREATE POLICY phase4_update_read ON agency_private.agency_updates
  FOR SELECT TO responder_rls_agency_fixture
  USING (CASE agency_private.phase4_member_role(organization_id)
    WHEN 'AGENCY_ADMIN' THEN true
    WHEN 'SUPERVISOR' THEN true
    WHEN 'RESPONDER' THEN status NOT IN ('draft','pending_review')
      OR author_user_id=(SELECT agency_private.phase4_actor_id())
    WHEN 'VIEWER' THEN status NOT IN ('draft','pending_review')
    ELSE false END);

-- Base-table access is column-limited; invoker views recheck the caller's RLS.
GRANT SELECT (id,canonical_key,public_name,organization_type,verification_state,operation_state)
  ON agency_private.organizations TO responder_rls_agency_fixture;
GRANT SELECT (id,organization_id,user_id,role,status,joined_at)
  ON agency_private.organization_memberships TO responder_rls_agency_fixture;
GRANT SELECT (id,organization_id,county_fips,authority_version,status,effective_from,effective_until)
  ON agency_private.organization_authorities TO responder_rls_agency_fixture;
GRANT SELECT (id,organization_id,intended_email,proposed_role,status,created_at,expires_at)
  ON agency_private.organization_invites TO responder_rls_agency_fixture;
GRANT SELECT (id,organization_id,author_user_id,status,condition_type,impact_level,title,revision,created_at,expires_at)
  ON agency_private.agency_updates TO responder_rls_agency_fixture;

CREATE VIEW agency_private.responder_organization_context WITH (security_invoker=true) AS
  SELECT id,canonical_key,public_name,organization_type,verification_state,operation_state
  FROM agency_private.organizations;
CREATE VIEW agency_private.responder_membership_roster WITH (security_invoker=true) AS
  SELECT id,organization_id,user_id,role,status,joined_at
  FROM agency_private.organization_memberships;
CREATE VIEW agency_private.responder_current_authority WITH (security_invoker=true) AS
  SELECT id,organization_id,county_fips,authority_version,status,effective_from,effective_until
  FROM agency_private.organization_authorities;
CREATE VIEW agency_private.responder_invite_summary WITH (security_invoker=true) AS
  SELECT id,organization_id,intended_email,proposed_role,status,created_at,expires_at
  FROM agency_private.organization_invites;
CREATE VIEW agency_private.responder_update_queue WITH (security_invoker=true) AS
  SELECT id,organization_id,author_user_id,status,condition_type,impact_level,title,
    revision,created_at,expires_at,
    CASE WHEN status='active' AND expires_at<=now() THEN 'expired' ELSE status END AS display_status
  FROM agency_private.agency_updates;
REVOKE ALL ON agency_private.responder_organization_context,
  agency_private.responder_membership_roster,agency_private.responder_current_authority,
  agency_private.responder_invite_summary,agency_private.responder_update_queue FROM PUBLIC;
GRANT SELECT ON agency_private.responder_organization_context,
  agency_private.responder_membership_roster,agency_private.responder_current_authority,
  agency_private.responder_invite_summary,agency_private.responder_update_queue
  TO responder_rls_agency_fixture;

-- Explicit synthetic governance path: no agency membership or raw-table grant.
CREATE FUNCTION agency_private.phase4_governance_organization_context()
RETURNS TABLE(id uuid,canonical_key text,public_name text,verification_state text,operation_state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT o.id,o.canonical_key,o.public_name,o.verification_state,o.operation_state
  FROM agency_private.organizations o
  WHERE agency_private.phase4_governance_ok();
$$;
REVOKE ALL ON FUNCTION agency_private.phase4_governance_organization_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agency_private.phase4_governance_organization_context()
  TO responder_rls_governance_fixture;

-- No ordinary SELECT policy or grant on raw audit, receipt, program-control,
-- identity, catalog, or session-binding tables. No ordinary DML/TRUNCATE grants.
COMMIT;
