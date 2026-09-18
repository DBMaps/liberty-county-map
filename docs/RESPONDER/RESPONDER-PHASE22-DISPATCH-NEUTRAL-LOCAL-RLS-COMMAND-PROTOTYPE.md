# Gridly Dispatch Phase 22 Neutral Local RLS and Command Prototype

Status: **LOCAL DISPOSABLE PROTOTYPE ONLY — NOT A PRODUCTION MIGRATION**

Authoritative inputs:

- Phase 20 neutral contract freeze at `b30aebba132e618fd55705a61259279173c7381e`.
- Phase 21 local schema prototype at `b69ccd8bb345d9e732929a0a118353d2593301d8`.

## Outcome

The Phase 21 neutral schema supports a production-shaped local mutation path. The Phase 22 layer passed live synthetic AAL2/TOTP checks, forced-RLS isolation, command-only mutation, exact replay handling, optimistic concurrency, membership governance, two-step ownership transfer, two-person platform recovery, capability governance, projection review/publication, immediate public invalidation, immutable evidence, and controlled failure rollback.

Nothing in this phase connects to Supabase, changes a production migration, or activates a product surface.

## Architecture

The disposable runner loads, in order:

1. Phase 21 schema and synthetic fixtures.
2. Phase 22 session/RLS layer from `apply.sql`.
3. Phase 22 bounded command functions from `commands.sql`.
4. Phase 22 synthetic actor/session fixtures.
5. The Node structural, authorization, command, failure, and concurrency suite.
6. Phase 22 and Phase 21 rollback scripts before database and cluster deletion.

Phase 22 adds six private, forced-RLS tables: synthetic sessions, server-side session bindings, command receipts, ownership-recovery cases, recovery approvals, and harness-only failure injections. Ordinary application and public roles receive no table privileges in the Phase 22 schema.

## Actor, session, and MFA model

The test harness binds each PostgreSQL `session_user` to a synthetic session and an asserted auth user. The binding is the local stand-in for trusted server/Auth context. Business payloads cannot choose actor or session identity.

The live predicate requires all of the following on every private read and command:

- binding role, asserted user, and session user agree;
- profile is active;
- session is unrevoked and unexpired;
- `aal_level = aal2`;
- the synthetic factor is explicitly TOTP-verified;
- `mfa_verified_at` exists and is no older than the local 15-minute prototype window.

The organization selector remains a transaction-local request setting. It is compared with every command's organization ID and never supplies actor identity or authority.

## RLS model

Phase 21 private tables retain enabled and forced RLS. Phase 22 replaces the actor and permission predicates with live session-aware versions and hardens membership self-read so it cannot bypass MFA or live membership/organization state.

Private reads require live MFA, an active profile, active and unexpired membership, active organization, requested organization equality, and the relevant frozen permission. Platform grants are queried separately and never satisfy organization policies. The public role holds only the Phase 21 allowlisted projection-table read grant.

All direct table writes by application/public roles remain revoked. Commands execute through a private, reviewed definer surface.

## Command model

Twenty public command entry points were prototyped:

- Records: `create_operational_record`, `update_operational_record`, `assign_operational_record`, `close_operational_record`.
- Membership: `invite_member`, `accept_invitation`, `change_member_role`, `suspend_member`, `activate_membership`, `revoke_member`.
- Ownership: `initiate_ownership_transfer`, `accept_ownership_transfer`.
- Platform recovery: `start_ownership_recovery`, `approve_ownership_recovery`.
- Capabilities: `grant_capability`, `revoke_capability`.
- Projection: `submit_projection_candidate`, `approve_projection`, `reject_projection`, `publish_projection`.

Every command derives the actor/session internally, checks live MFA, validates organization context and current database state, checks its exact permission, validates scope/capability/revision where applicable, serializes its operation token, performs the business mutation, emits immutable evidence, writes an accepted receipt, and commits as one caller transaction. Exceptions roll back every step.

## Idempotency and replay

`command_receipts` stores organization, actor, session, command, UUIDv4 operation token, canonical JSON request digest, result reference, bounded result, and server time. Partial unique indexes separate organization-bound and platform-bound receipt domains.

Commands take a transaction advisory lock derived from organization, actor, command, and token. Exact replay returns the original result. The same token with a different request digest raises an error. Failed commands leave no receipt.

The same token can be used independently in two organizations without collision, while duplicate acceptance of one invitation with the same token deterministically returns the single membership.

## Record revisions and concurrency

Record updates lock the record row and compare the expected revision. A successful mutation advances the record revision exactly once and appends both a revision snapshot and provenance row before audit and receipt emission.

Two simultaneous updates with the same expected revision produced one success and one stale failure. Assignment and closure also advance the record revision. Terminal status remains immutable under the Phase 21 lifecycle trigger.

The controlled failure-injection table is owner-only harness infrastructure. A forced exception after the business insert demonstrated that the record, revision, audit event, and receipt all roll back.

## Invitations and memberships

Invitations store only a 32-byte token digest and a synthetic `user:<uuid>` target. Acceptance requires the matching live actor, matching digest, pending state, unexpired interval, active organization, and no duplicate live membership.

Commands prove exact invitation replay, concurrent single-use acceptance, expired/revoked denial, fixed role assignment, expected membership revision, role-change audit, suspend/reactivate/revoke lifecycles, viewer/operator administration denial, and final-owner protection. Owner assignment remains possible only through the ownership contract.

## Ownership transfer and platform recovery

Normal transfer requires the current owner, expected organization revision, active organization-admin recipient, reason, expiry, and a second live-AAL2 acceptance by that named recipient. Acceptance locks the transfer, organization, and both membership rows in stable order, atomically swaps roles, advances revisions, and emits both-actor evidence. Concurrent acceptance produced one winner.

Recovery uses a documented case, immutable first and second approval rows, two distinct live platform actors with `platform.ownership.recover`, unchanged organization revision, and an eligible pre-existing active organization member. A platform actor cannot be the recovery recipient. Final recovery emits `OWNERSHIP_RECOVERED`; first approval remains immutably evidenced by its case approval and receipt because Phase 20 defines no separate first-approval business event.

## Capability governance

Capability grant/revoke commands require the platform capability permission, explicit organization context, active organization, exact frozen capability identifier, current organization revision or grant revision, scope binding, verification prerequisites, validity interval, and governance evidence.

The local layer records the revoking platform actor and prevents more than one pending/active/suspended grant for one organization/capability/scope binding. Concurrent revoke produced one winner. Organization roles cannot grant capabilities, and platform actors gain no organization publication identity.

## Projection review and public invalidation

Projection submission requires the current source-record revision, active matching capability/scope, eligible source class, nonterminal source record, exact taxonomy mapping, future freshness deadline, and a strict payload allowlist containing only `title`, `summary`, and optional `public_location`. Unknown or recursively forbidden fields fail before a candidate or receipt is created.

Approval and publication remain separate commands, as frozen in Phase 20. Review requires `projection.review`; publication requires `projection.publish`. Road-closure review retains distinct submitter/reviewer enforcement. Rejection records a bounded reason and never creates a public row.

Public RLS recomputes current eligibility. Tests proved immediate hiding after organization suspension, scope suspension, source-revision change, terminal record closure, capability revocation, and normal projection expiry/current-revision rules. Private source and audit history remain intact.

## Audit and immutable evidence

The test run emitted and verified all sensitive events exercised by this phase:

`MEMBER_INVITED`, `INVITATION_ACCEPTED`, `MEMBER_SUSPENDED`, `MEMBER_REACTIVATED`, `MEMBER_REVOKED`, `ROLE_CHANGED`, `OWNERSHIP_TRANSFER_INITIATED`, `OWNERSHIP_TRANSFERRED`, `OWNERSHIP_RECOVERED`, `CAPABILITY_GRANTED`, `CAPABILITY_REVOKED`, `RECORD_CREATED`, `RECORD_UPDATED`, `RECORD_ASSIGNED`, `RECORD_CLOSED`, `PROJECTION_SUBMITTED`, `PROJECTION_APPROVED`, `PROJECTION_REJECTED`, and `PROJECTION_PUBLISHED`.

The suite's required minimum query checks 16 distinct event types. Audit events, receipts, record revisions, provenance, and recovery approvals reject destructive mutation.

## Security-definer review

All Phase 22 definer functions have an empty `search_path`, fully qualified relations/functions, no dynamic SQL, and explicit privilege revocation. `PUBLIC` and the synthetic public role cannot execute them. The application role receives only the 20 command entry points plus the bounded live-MFA predicate needed by RLS. Internal replay, audit, failure, and authorization helpers remain uncallable.

The Phase 21 deferred exactly-one-owner checker was locally hardened to a pinned, uncallable definer. This is required because a constraint trigger running with client RLS visibility cannot reliably count every owner row.

## Security vector matrix

| Vector group | Covered cases | Result |
| --- | --- | --- |
| Actor/session/MFA | valid AAL2, AAL1, stale AAL2, binding mismatch, revoked session | PASS |
| Live governance | suspended/revoked membership, suspended/closed organization, stale client state | PASS |
| Tenant RLS | cross-organization read, stale selector, platform non-membership | PASS |
| Consumer boundary | private records, memberships, audit, commands denied; public-safe projection allowed | PASS |
| Direct-write bypass | records, memberships, capabilities, projections, audit, receipts | PASS |
| Record commands | create/update/assign/close, lifecycle, revisions, provenance | PASS |
| Replay and atomicity | exact replay, payload mismatch, cross-org key, forced rollback | PASS |
| Record concurrency | simultaneous expected-revision updates | PASS |
| Invitations/memberships | digest-only, expired/revoked, duplicate acceptance, role/status revisions, final owner | PASS |
| Ownership/recovery | two-step transfer, concurrent acceptance, distinct recovery approvers, non-platform recipient | PASS |
| Capability/projection | platform separation, scope/verification, sanitization, review/publish split, concurrent review/revoke | PASS |
| Public invalidation | organization, scope, source revision, terminal record, capability, freshness | PASS |
| Definer/evidence | pinned paths, no dynamic SQL, minimal grants, append-only audit/receipt/approval | PASS |

Required Phase 22 vectors: **PASS 13 groups, PARTIAL 0, DEFERRED 0**. The test source contains 62 assertion sites and 34 explicit expected-denial sites. Production integration gaps below are not failures of the requested local prototype.

## Prototype choices and production gaps

- Synthetic session tables replace Supabase Auth, `auth.sessions`, factor rows, AMR, signed/live-user consistency, and session revocation APIs.
- The 15-minute MFA freshness window is a conservative local test value, not a frozen production setting.
- Phase 21 JSON scope representations remain; governed geographic topology is not implemented.
- Invitation delivery, rate limiting, abuse telemetry, denial telemetry, receipt retention, and recovery case operations remain unimplemented.
- Publication withdrawal is not implemented; current visibility invalidation is proven through live eligibility.
- The Phase 22 layer extends the disposable Phase 21 capability table with a revoking actor and one-live-binding index. No production schema is changed.
- Recovery first approval uses immutable recovery approval and receipt evidence; only completed recovery emits the frozen `OWNERSHIP_RECOVERED` event.
- No settings command exists, so `SETTINGS_CHANGED` is intentionally not emitted.

## Reproduction and teardown

Run from the repository root:

```powershell
& tools/responder/phase22/run-local-prototype.ps1
```

The runner initializes `%TEMP%\gridly-dispatch-phase22-<uuid>` with PostgreSQL 17.10, binds only to `127.0.0.1` on a random port, creates a random database and synthetic roles, runs 15 tests, executes both rollback layers, drops the database, stops PostgreSQL, validates the cleanup path, removes the uniquely prefixed directory, and clears its environment variables. Connection-related password, service, Supabase, and database URL variables are removed from the child test environment.

## Phase 23 recommendation

Recommend **C. local invitation/auth integration**. The command kernel, RLS, replay, and concurrency contracts are proven; the largest remaining security uncertainty is translating the synthetic session evidence into live Supabase Auth session, verified same-user TOTP factor, TOTP AMR, signed/live consistency, and revocation checks without weakening the database predicates.

Phase 23 is not implemented here.
