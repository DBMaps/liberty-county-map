# Owner-led Dayton onboarding and offboarding

This runbook is for planning and synthetic rehearsal. No step authorizes real Dayton activation or bulk onboarding.

1. PLANNED: owner meets department, approves bounded awareness use cases, determines independent organization versus unit, records accountable reviewer and explicitly excludes prohibited data.
2. IDENTITY_VERIFIED: validate legal entity and organizational relationship. Record evidence source/version and renewal deadline. No legal identity is inferred from department name.
3. ADMIN_ASSIGNED: identify individual accountable admin and owner accounts; review fixed roles and least privilege.
4. MEMBERSHIP_CONFIGURED: approve each organization membership and unit membership. Cross-unit supervisors need explicit assignments; platform admins receive no tenant membership automatically.
5. SCOPE_CONFIGURED: review private operational scopes and unit-scope grants. An organization-declared scope is sufficient only for private use. Public authority requires separately governed, current source/version evidence.
6. MFA_VERIFIED: each participant enrolls/verifies TOTP and receives real AAL2. Test next-request revocation. Never lower assurance for onboarding convenience.
7. PRIVATE_PILOT_READY: owner signs the bounded private-use review. Private use needs no consumer capability. Verify memberships, scope, safety training, containment contacts and exclusion acknowledgement.
8. PUBLISHING_REVIEW_REQUIRED: optional, separate gate. Review exact capability, independent reviewer, governed scope evidence, verification, attestation, removal behavior and staffing.
9. PUBLISHING_ENABLED: only after independent platform capability authorization, current governance and unit readiness. The planning artifact never sets this automatically.

The local state command requires sequential transitions, expected unit revision and a nonempty owner-review reference. Membership and scope must exist before private readiness. These references model manual owner review; the database does not certify external evidence or completion of staff training. A production activation workflow still needs independently verifiable approval records rather than an admin-supplied reference alone.

SUSPENDED stops unit access. OFFBOARDED is terminal in the pilot API: revoke unit memberships, stop outgoing and incoming shares, deny source access and consumer eligibility, retain evidence. For an organization-wide offboarding, also suspend/close the organization, revoke memberships and all organization capability grants, withdraw consumer projections and invalidate sessions where appropriate. For a user with other legitimate departments, revoke the affected membership rather than deleting their whole identity. Unit offboarding does not revoke an organization-wide capability needed by another unit; unit-source eligibility is nevertheless removed immediately.

The local unit command performs unit revocation and sharing removal atomically. The closure organization command revokes organization memberships, units, capabilities and pending invitations, stops sharing and closes the organization. `offboard-user.mjs` implements the retryable user sequence using authenticated platform commands and the server-only Auth administration API; the final SQL step verifies Auth absence and converts retained identity references. These are rehearsed local engineering implementations, not production activation executors. Never supply server credentials to a browser.

Invitations expire at seven days. Primary delivery is transactional email with controlled one-time manual-copy fallback. Only an owner-approved exact Dispatch HTTPS origin and redirect allowlist may be used. Provider and exact origin remain null in configuration. Do not log tokens, send from this rehearsal, or use consumer origins. Reissue must revoke the old digest; delivery readiness remains a later activation gate.

Verification renews annually. A public entity with active public capability needs six-month evidence attestation. Pilot grants last at most 90 days, have no automatic renewal and no grace period. Later low-risk grants are capped at 12 months; future separately enabled hazard/road-closure grants at six months. Renewal is a new governed decision with evidence and audit, never a silent date extension.

Recovery staffing target: at least three trained named administrators, individual accounts, AAL2/TOTP, two distinct approvers, five-minute same-user step-up, quarterly access review and semiannual drill. No bypass if staffing is unavailable. The closure recovery API binds and live-revalidates both approvers at completion. Ownership transfer requires each actor's same-user TOTP within ten minutes, explicit recipient acceptance and final initiator revalidation. The execution report determines local certification; actual staffing remains a pre-production gate.
