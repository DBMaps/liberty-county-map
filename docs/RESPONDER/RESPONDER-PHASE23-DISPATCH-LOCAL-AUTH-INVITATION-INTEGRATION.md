# Gridly Responder / Dispatch — Phase 23 Local Auth + Invitation Integration

## 1. Executive Summary

Phase 23 proves, in a disposable local environment, that the Phase 20–22 neutral
Dispatch contract can consume production-shaped Supabase Auth evidence without
trusting actor identity, MFA state, membership, role, or permissions from a
business payload. Eleven integration tests pass and the local cluster is removed.
This artifact is not a production migration and changes no production surface.

## 2. Local Auth Architecture

Option C was selected: a faithful Auth/JWT/TOTP harness in disposable PostgreSQL
17.10. Supabase CLI and Docker were absent, and the repository contains no
isolated GoTrue runner. The harness binds only to loopback, uses a random temp
data directory, accepts no remote URL or credential, and tears down in `finally`.

The private `dispatch_phase23_auth` schema models Auth users, identities,
sessions, factors, session AMR, trusted signed-claim projections, and Auth event
logs. The application role has no table mutation rights. The trusted-claim table
stands in for claims already signature-verified by the future API/Auth tier.

## 3. Canonical User Identity

`auth_users.id` is the canonical UUID. `profiles.user_id`, session `user_id`,
identity `user_id`, factor `user_id`, JWT `sub`, and Dispatch audit actor must
converge on it. Tests show a payload `user_id`, a request GUC containing another
session, and a session/subject mismatch cannot change the derived actor.

## 4. Session Model

The model records session ID, canonical user ID, issue/refresh/expiry timestamps,
and revocation. A trusted claim projection records `sub`, `session_id`, `aal`,
`amr`, verified email state, and JWT issue/expiry. Authorization requires the
claim and live session row to agree. Expired, revoked, mismatched, or missing
sessions fail closed on the next protected request.

## 5. TOTP Factor Model

Factors have explicit `UNVERIFIED`, `VERIFIED`, `REVOKED`, and `DELETED` states,
with enrollment/verification/revocation timestamps. A TOTP AMR row references a
specific factor and session. Authorization joins session user to factor user, so
a user A session paired with user B's factor fails. The harness does not hold a
TOTP seed or validate RFC 6238 codes; it models the state transition produced by
successful Auth Enroll/Challenge/Verify APIs.

## 6. AAL/AMR Validation

The predicate requires all of: active Auth user, verified Auth email, unexpired
signed claim, live matching session, `aal2`, a TOTP entry in signed `amr`, a live
TOTP AMR row, the same canonical user on session and factor, a verified and
unrevoked factor, and an active profile. A boolean supplied by a client is never
consulted. This follows Supabase's documented `aal`, `amr`, and `session_id`
semantics: <https://supabase.com/docs/guides/auth/auth-mfa>,
<https://supabase.com/docs/guides/auth/jwt-fields>, and
<https://supabase.com/docs/guides/auth/sessions>.

## 7. MFA Freshness Findings

Recommendation **A: AAL2 is sufficient for the Dispatch MVP**, coupled with a
short-lived JWT and live checks of session and factor state for protected
commands. Phase 22's arbitrary 15-minute MFA timestamp is removed. Supabase
documents AAL and AMR evidence but does not make an application-specific
"recent challenge" policy automatic. Whether ownership transfer, platform
recovery, or similar commands require a new step-up interval remains
`OWNER_DECISION_REQUIRED` for a later production contract refinement.

## 8. Invitation Token Model

The Node harness creates 32 random bytes (256 bits) and Base64URL-encodes them.
Only SHA-256 digests are stored. Acceptance receives the plaintext once, hashes
it inside the security-definer command, and places only the digest in its request
hash. Receipt and audit payloads exclude plaintext. Expiry, revocation, terminal
state immutability, one acceptance, and deterministic exact replay are enforced.

## 9. Existing-User Acceptance

A live AAL2 user with a verified matching identity accepts a valid invitation
and receives exactly one active membership. Wrong user, wrong token, expired,
revoked, already accepted, and duplicate-live-membership cases fail without a
success receipt or audit event.

## 10. New-User Acceptance Contract

An email-targeted invitation may precede account creation. The test then creates
the Auth user and verified provider identity, profile, AAL1 session, unverified
factor, verified factor, TOTP AMR, and AAL2 claim in order. Acceptance fails
before AAL2 and succeeds only after the full chain exists.

## 11. Identity Matching Policy

Freeze recommendation: use either `user:<canonical-uuid>` or
`email:<trimmed-lowercase-email>`. Email targets require a current verified Auth
identity and verified Auth user email belonging to the signed-in canonical user.
Email, Google, and Azure identity mappings are modeled. Raw unverified email is
insufficient. A changed email stops matching an old email invitation; reissue or
an explicitly governed retarget operation is required. Supabase warns against
linking unverified email identities because of account-takeover risk:
<https://supabase.com/docs/guides/auth/auth-identity-linking>.

## 12. Membership Activation Rules

Activation requires a live AAL2 Auth chain, matching invitation identity and
digest, active organization, pending unexpired/unrevoked invitation, valid
non-owner role, and absence of a live membership. Organization ID, token,
claimed email, or sign-in alone cannot activate membership.

## 13. Offboarding / Revocation

Revoked membership, suspended organization, disabled profile/Auth user, revoked
session, expired token, or revoked/deleted factor denies the next protected
request. A still-valid JWT is not sole authority for mutable business state.

## 14. Recovery Boundary

The Auth provider owns credential and password recovery. Dispatch membership is
separate: a password-recovery event does not reactivate revoked membership and
does not bypass AAL2. Ownership recovery remains the Phase 22 two-person,
separately audited platform process; Phase 23 verifies its AAL2 gate.

## 15. Platform Admin Auth

Platform operations require the same live Auth/AAL2 chain plus a live platform
grant. Platform status does not supply organization membership, publisher rights,
or an organization identity. An AAL1 platform actor is denied recovery initiation.

## 16. Command Integration

Phase 22's `current_actor_id`, `current_session_id`, and live-AAL2 predicate are
superseded by Phase 23 Auth context. Existing protected commands therefore gain
the new Auth checks without duplicating their membership, role, organization,
scope, capability, revision, receipt, and audit logic. Legacy Phase 22 invitation
entry points are revoked from the application role; Phase 23 commands replace them.

## 17. Multi-Organization Results

One Auth user and AAL2 session hold independent memberships in organizations A
and B. The user is a Viewer in A and Operator in B. The selector is checked
against the chosen organization's live membership, so permissions do not bleed
between organizations. Invitation into B leaves A unchanged.

## 18. Security Vectors

Passed vectors cover canonical identity, payload spoofing, session spoofing,
session/user mismatch, AAL1, expired session, wrong-user factor, unverified and
revoked factors, wrong invitation user/token, expiry, revocation, replay,
duplicate membership, live offboarding, platform separation, append-only logs,
least privilege, and pinned security-definer search paths.

Partial: real JWT signature verification and real TOTP code generation are
represented by trusted harness state rather than GoTrue. Deferred: provider API
error behavior, refresh-token rotation, and a production recent-step-up policy.

## 19. Concurrency Results

Two simultaneous exact acceptances with one idempotency key converge on one
membership and one result. Acceptance racing revocation yields exactly one safe
terminal outcome. A transition trigger prevents accepted invitations from being
changed to revoked after acceptance. Database uniqueness prevents duplicate live
memberships.

## 20. Auth vs Dispatch Audit Boundary

Auth/security logs own login, logout, factor enrollment/verification/revocation,
and password recovery. Dispatch audit owns invitation issue/acceptance,
membership activation/changes, ownership actions, capabilities, and business
commands. Tests prove Auth events are not duplicated into Dispatch audit.

## 21. Production Gaps

The harness does not verify a cryptographic JWT, call GoTrue, exercise refresh
token rotation, generate TOTP codes, or test provider callbacks. Production must
use supported Supabase APIs and must not create custom objects in the managed
`auth` schema; Supabase announced restrictions on writes/custom objects there in
2025. The integration must map verified provider output into an application-owned
private schema or direct supported Auth reads.

## 22. Deviations

The requested preference order was followed, but options A and B were unavailable
locally. Option C is therefore explicit. No email delivery or signup UI was
built. No production policy was invented for recent MFA challenge freshness.

## 23. Phase 24 Recommendation

Choose **D: local real Supabase Auth integration**. Provision an isolated local
Supabase CLI stack, then rerun the same contract against actual Auth signup,
identity verification, TOTP Enroll/Challenge/Verify, JWT refresh, factor removal,
and session revocation. Do not begin a production migration package until that
gap is closed.
