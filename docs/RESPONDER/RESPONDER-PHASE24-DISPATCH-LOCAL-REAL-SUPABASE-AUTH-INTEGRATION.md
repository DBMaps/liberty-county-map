# Gridly Responder / Dispatch — Phase 24 Local Real Supabase Auth Integration

## 1. Executive Summary

Phase 24 passed against a real, disposable, unlinked local Supabase stack. Real
GoTrue users, sessions, ES256 JWTs, TOTP factors, refresh tokens, and Auth state
were integrated with the Phase 22 command model without weakening Phase 20–23
authorization or transaction invariants. The Phase 23 synthetic harness was not
used as evidence.

## 2. Environment / Tooling

- Supabase CLI: 2.117.0, invoked offline from the pinned npm dependency
- Docker CLI / Engine: 29.8.0, linux/amd64
- Docker Desktop: 4.91.0
- Supabase Auth / GoTrue: 2.196.0
- PostgreSQL container: 17.6.1.167
- PostgREST: 16.2
- Node.js: 24.17.0

## 3. Local Supabase Isolation

The runner creates a new temporary project, rejects project-link metadata, and
uses a dedicated Docker bridge whose published ports bind to loopback. Endpoints
are `http://127.0.0.1:54321` (API), `127.0.0.1:54322` (PostgreSQL), and
`http://127.0.0.1:54324` (Mailpit). Unneeded services are excluded. Existing
checkout link metadata was neither read nor used.

## 4. Auth User Model

Signup created canonical UUIDs and identities in real Auth tables. Dispatch
profiles reference the Auth UUID; command payload identity fields cannot replace
the authenticated actor.

## 5. Email / Identity Verification

Local signup auto-confirmed the synthetic addresses. Invitation matching uses
the confirmed server-side Auth identity, not raw client input. A manual email
confirmation UI was not applicable to this local configuration.

## 6. Session Model

Real signup issued access and refresh tokens and a session associated with the
same Auth user. Evidence was inspected without logging credential values.

## 7. JWT Claims

`sub` identifies the actor. `session_id`, `aal`, AMR, `iat`, and `exp` supply
authentication evidence. Organization, membership, role, permissions, scope,
and capabilities remain live database authorization state.

## 8. JWT Signature Validation

Local user tokens used ES256. Valid tokens were accepted; tampered payloads,
random signatures, and a genuinely expired token signed in memory with the
disposable Auth JWK were rejected. No signing material was persisted.

## 9. TOTP Enrollment

Real TOTP factors were enrolled through Auth. RFC 6238 codes were generated in
memory from ephemeral seeds; neither seeds nor codes were written to artifacts.

## 10. Challenge / Verification

Real challenge and verification calls succeeded with the current code. A
deliberately different code and cross-user factor challenge failed.

## 11. AAL / AMR Results

Initial sessions were AAL1. TOTP verification produced AAL2 with password and
TOTP in AMR. Refresh preserved AAL2 and TOTP AMR. Auth session, factor, and AMR
rows remained bound to the same user/session.

## 12. MFA Freshness Conclusion

**KEEP AAL2-ONLY MVP.** Real Auth provides durable AAL2/TOTP evidence and the
bridge independently rechecks the live session and factor. Recent-operation
step-up for ownership transfer or recovery remains an owner policy decision.

## 13. Refresh Token Results

Refresh preserved user and session identity, rotated the token, and retained
AAL2/TOTP. Reuse was exercised inside and outside the configured interval; the
suite accepts server rejection or a newly rotated token. Cross-type refresh was
denied, and logout invalidated refresh continuity.

## 14. Factor Removal Results

Real unenrollment removed the factor. The prior JWT remained cryptographically
valid and claimed AAL2, but the next Dispatch check denied because no live
same-user verified factor remained. The live factor check is required.

## 15. User Disable/Delete Results

A banned user's prior token failed the next Dispatch check. After deletion,
Auth rejected user lookup and Dispatch continued to deny the prior token.

## 16. Auth-to-Dispatch Bridge

Actor and session derive from `auth.uid()` and the signed `session_id`. The live
predicate cross-checks JWT evidence, Auth user/session, verified same-user
factor, TOTP AMR, and active Dispatch profile. Only bounded RPCs are exposed.

## 17. Existing User Invitation

A matching verified AAL2 user activated one membership. Wrong-user, expired,
revoked, and non-idempotent replay attempts were denied; idempotent replay
returned the original result without duplicate audit.

## 18. New User Invitation

An invite preceded signup. The new account was denied at AAL1, then enrolled
TOTP, reached AAL2, accepted the invitation, and activated membership.

## 19. Multi-Organization Results

One real identity accepted invitations into two organizations with different
roles and permissions. Explicit organization selection was required and no
authority inherited across organizations.

## 20. Revocation Results

With still-valid JWTs, membership suspension and revocation, organization
suspension, capability revocation, and factor removal caused the next applicable
Dispatch operation to deny.

## 21. Platform Admin Results

A real AAL2 user with a platform grant could run the platform capability command.
The grant implied neither organization membership nor ordinary organization
authority; recovery remains separately governed.

## 22. Spoof Resistance

Tampered, wrongly signed, fabricated, and expired tokens were rejected.
Cross-user factors failed. Payload user/membership identifiers were ignored in
favor of the Auth actor, and cross-organization operations were denied.

## 23. Concurrency

Two simultaneous accepts converged on one membership. Accept-versus-revoke
produced one success, one denial, and a valid terminal state. Second-organization
acceptance succeeded; Phase 22 locking and idempotency invariants held.

## 24. Auth / Dispatch Audit Boundary

Auth login/logout/refresh/factor events remained in Auth audit/state. Dispatch
recorded invitation, membership, command, capability, and projection events.
No plaintext invitation token or Auth credential appeared in Dispatch audit.

## 25. Secrets Hygiene

JWTs, refresh tokens, TOTP seeds, passwords, service-role keys, and private keys
exist only in process memory or disposable state. Changed-file scans found no
token-shaped values, local credentials, production URLs, or project references.

## 26. Production Gaps

This is not a production migration. Production configuration, provider behavior,
monitoring, recovery policy, neutral migrations, and rollout remain open. The
local bridge is evidence, not deployable production SQL.

## 27. Deviations

The resumed Docker engine cleared the blocker. Current local Supabase issued
ES256 user tokens and preserved AAL2 through refresh, superseding observations
from one degraded post-reset stack. Local auto-confirm precluded a separate
unverified-email UI flow. Refresh reuse is version/configuration dependent, so
the suite proves rotation and records rejection or re-rotation.

## 28. Phase 25 Recommendation

Choose **A. production-shaped neutral migration package design** next. It is the
smallest step that turns the proven boundary into reviewable environment-neutral
artifacts while retaining a no-deploy gate. Phase 25 was not implemented.
