# Phase 28 implementation closure

Local engineering certification only. No production access, deployment, real Dayton entities or real personnel. The authoritative verdict is the generated execution report; this design document is not a passing test certificate.

## Recovery and ownership transfer

The sole postgres-owned Auth bridge remains `has_live_aal2()`: no arguments, boolean result, empty search path, read-only SQL, and no identity/row disclosure. `current_actor_id()` and `current_session_id()` remain invokers. No command role receives Auth table access.

A private transaction-context row lets the bridge additionally examine an exact pending recovery or transfer operation. Only the dedicated command owner can populate this context. Neither a client-selected organization nor a caller-set GUC selects a peer identity. The proof records bind operation, organization, target membership and actor, expected organization revision, approving actor, session, factor and signed TOTP timestamp. A supplied factor ID is checked against the live same-user session and verified TOTP factor; it is not trusted on receipt.

Recovery requires two distinct live platform recovery grants. Completion rechecks both proofs and the current first approver's Auth existence, deletion/ban state, profile, session user/AAL/expiry, exact factor, and five-minute freshness. A changed case/target/revision fails. Completion consumes the case. A repeated acceptance, even with the same idempotency key, is denied without new effects.

Ownership transfer requires the current owner and a distinct active recipient member. Each proof needs same-user TOTP within ten minutes. Acceptance rechecks the initiator's proof and owner membership, recipient eligibility, unchanged binding and organization revision. An existing unique pending-transfer index and serialized commands allow one concurrent pending transfer. The old owner is demoted and the recipient promoted inside one transaction; readers cannot observe the intermediate state. A cancelled or accepted transfer cannot be accepted again.

## Identity erasure and offboarding

`begin_user_offboarding` requires a live platform abuse-management grant. It refuses self-offboarding and refuses any active owner whose organization has not been closed. Ownership must first be transferred or the organization explicitly offboarded. Beginning a job disables the subject profile immediately, so surviving JWTs lose Dispatch access even if the external Auth step fails.

The orchestration then uses the server-only Auth administrator API to delete the synthetic Auth user. Auth owns removal of sessions and factors. No SQL function writes reserved Auth tables. `complete_user_offboarding` rechecks through the same boolean bridge that the target Auth user is absent, validates the job organization/revision, revokes memberships/unit memberships/pending invitations, erases the mutable profile, and converts retained actor references. The same job/idempotency key is retry-safe. A failed external step leaves a disabled subject and an unfinished job; it never reports successful erasure.

Each organization uses an independently generated random UUID actor token. Tokens are not derived from an Auth UUID, email, phone, encryption key or global identifier. Historical rows within that organization share the token; unrelated organizations get different tokens. The private user-to-token mapping is destroyed after conversion. Platform-only coordination jobs may correlate the administrative operation; tenant evidence does not receive a global person token.

Historical audit, receipt, revision, membership, capability-grant, candidate, share-decision and recovery evidence is retained. Raw nullable actor references are cleared; token fields and stable record/membership/revision relationships retain lineage. Nested historical JSON replaces exact actor UUID strings with the scoped token. Recovery proofs retain their binding and token but lose raw actor/session/factor identifiers. Immutable evidence triggers allow only the defined identity transformation inside a protected erasure context; ordinary update/delete remains denied. Profile/Auth deletion cannot cascade into operational evidence.

Organization offboarding closes the organization, revokes memberships and capabilities, offboards units, revokes pending invitations, stops internal sharing and removes public eligibility. It preserves organization/unit containers and historical evidence. Shared user accounts retain valid relationships in other organizations; tenant membership checks invalidate organization-specific access immediately. Capabilities are organization-bound, not personal publishing grants.

## Record lifecycle

| From | Allowed next states |
|---|---|
| DRAFT | OPEN, CANCELLED |
| OPEN | IN_PROGRESS, MONITORING, CLOSED, CANCELLED |
| IN_PROGRESS | MONITORING, CLOSED, CANCELLED |
| MONITORING | IN_PROGRESS, CLOSED, CANCELLED |
| CLOSED | None |
| CANCELLED | None |

Every unlisted pair, including same-state writes and reopen, is denied. An exact authorized idempotent retry returns its accepted receipt without another mutation. Transitions add one revision, provenance, receipt and audit decision atomically. Closure/cancellation suppresses internal sharing and consumer candidates/projections through live eligibility. Terminal records cannot be updated or assigned.

The runtime matrix tests all 144 type/from/to combinations. Fixture setup uses local postgres; mutation checks switch to authenticated with claims from a real local Auth session. They use the same command function as PostgREST. The REST suites independently exercise real signature/AAL/user/session/factor enforcement.

## Explicit renewals

`renew_capability` retains capability key, organization, scope and scope version. An ACTIVE grant, including one whose time window expired, may receive an explicit new window after current governance review. SUSPENDED/REVOKED grants are not renewable. Pilot windows never exceed 90 days. Replaying an old renewal never reactivates a subsequently revoked grant.

`renew_verification` and `renew_attestation` require platform verification authority, current expected governance revision, evidence source/version and bounded expiration. Their ceilings are one calendar year and six calendar months. Each decision records lineage. Expired verification/attestation denies publication immediately. No background renewal or grace period exists. The later 12-month low-risk and six-month hazard/road-closure designs remain inert; pilot APIs cannot activate them.

## Historical Phase 25 result

The historical manifest test is replayed from Git objects in disposable directories, without checkout or edits. The classification artifact records the source commit, Phase 28 starting HEAD and current result. A proven `KNOWN_PREEXISTING_NON_PHASE28_FAILURE` is reported separately from Phase 28 regressions, as expressly authorized in the closure request.

## Certification artifacts

The rehearsal produces `command-certification.json`, `enum-coverage.json`, `closure-vectors.json`, catalog evidence and teardown evidence under `reports/responder/phase28-evidence/`. Command inventory comes from the actual exposed API. Missing successful command coverage fails the suite. Static enum coverage compares every live label and its order with the inherited/additive source. Runtime equivalence descriptions distinguish descriptive/reserved catalog values from states that alter authorization.

Final certification must also include prior phase regressions, Phase 27 contract checks, deterministic security catalog, noninterference and whitespace checks. Only the final report and closed acceptance-gap document authorize the one local commit.
