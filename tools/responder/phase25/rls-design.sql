-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
Phase 25 RLS design. This entire file is inert commentary.
PHASE25_EXPECTED_POLICY_COUNT=17

Classification:
NO CLIENT ACCESS: role_templates, permissions, role_permissions, operational_scope_members,
  record_provenance, recovery_approvals, command_receipts.
READ VIA RLS / COMMAND-ONLY WRITE: profiles, organizations, organization_memberships,
  organization_invitations, operational_scopes, operational_records, record_assignments,
  ownership_transfers, record_revisions, audit_events, projection_candidates.
PLATFORM-ONLY: platform_admin_grants, capability_grants, ownership_recovery_cases.
PUBLIC-SAFE READ: public_safe_projections, through dispatch_api only.

ALTER TABLE dispatch_private.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_private.profiles FORCE ROW LEVEL SECURITY;
-- Repeat ENABLE + FORCE for every one of the 22 tables. The package linter verifies inventory.

-- P01 profile_self_read: authenticated, user_id = auth.uid(), active signed session.
-- P02 organizations_member_read: authenticated, live active membership + active organization.
-- P03 memberships_org_read: authenticated, members.read + live organization context.
-- P04 invitations_org_read: authenticated, members.invite + live organization context.
-- P05 scopes_org_read: authenticated, scope.read + live organization context.
-- P06 records_org_read: authenticated, operations.read + scope membership when applicable.
-- P07 assignments_org_read: authenticated, operations.read + parent record visibility.
-- P08 transfers_org_read: authenticated, organization.manage or transfer participant.
-- P09 revisions_org_read: authenticated, parent record visibility.
-- P10 candidates_org_read: authenticated, projection.review or candidate submitter.
-- P11 platform_grants_self_read: authenticated platform principal sees own live grant only.
-- P12 capability_grants_org_read: authenticated organization admin or platform governor.
-- P13 recovery_cases_platform_read: authenticated two-person recovery operators only.
-- P14 public_projection_anon_read: anon sees only current eligible sanitized rows.
-- P15 public_projection_authenticated_read: same safe columns and eligibility as anon.
-- P16 organizations_platform_read: live platform grant; never implies membership.
-- P17 audit_org_read: audit.read for matching org, or platform.audit.investigate.

-- Representative shape (not executable here):
CREATE POLICY records_org_read ON dispatch_private.operational_records
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    dispatch_private.has_live_session(auth.uid())
    AND dispatch_private.has_live_verified_totp_aal2(auth.uid())
    AND dispatch_private.has_permission(auth.uid(), organization_id, 'operations.read')
    AND dispatch_private.organization_is_active(organization_id)
    AND dispatch_private.record_scope_is_allowed(auth.uid(), id)
  );

CREATE POLICY public_projection_anon_read ON dispatch_projection.public_safe_projections
  AS RESTRICTIVE FOR SELECT TO anon
  USING (dispatch_private.projection_is_current_eligible(id));

-- No INSERT, UPDATE, or DELETE policies exist. Mutations are command-owned.
-- Every helper is STABLE only when semantically valid, schema-qualified, and fail-closed.
-- Membership, organization, scope, grant, session, factor, and projection eligibility are
-- read live so suspension/revocation is effective on the next request.
-- Platform administration never supplies organization membership or publisher identity.
-- dispatch_api views are security_invoker and expose an explicit safe-column list.
*/
-- PHASE25_INERT_SQL_END
