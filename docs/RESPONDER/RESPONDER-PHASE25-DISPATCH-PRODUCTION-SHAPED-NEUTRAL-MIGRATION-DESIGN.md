# Gridly Dispatch Phase 25 — Production-Shaped Neutral Migration Design

**DESIGN ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

## 1. Executive Summary

Phase 25 defines, but does not execute, a production-shaped neutral Dispatch database package. It preserves the Phase 20–24 authorization, transaction, invitation, real Supabase Auth, MFA, projection, and compatibility invariants. The target is four schemas, 23 enum types, 22 RLS-protected tables, 26 API commands, 26 private implementations, 12 helpers/triggers, and 17 policies. Production connections, SQL execution, migrations, Auth changes, users, application changes, reporting changes, pushes, merges, and deployments are all zero.

## 2. Authoritative Inputs

The frozen chain is Phase 20 commit `b30aebba132e618fd55705a61259279173c7381e`, Phase 21 `b69ccd8bb345d9e732929a0a118353d2593301d8`, Phase 22 `bff41bb18f328767376c0a8103bade516c8dd7c6`, Phase 23 `11b59730557291fa718ea86fd5e29c94e558d5db`, and Phase 24 `a510f95788bba294b3d165ac9d42a077763bd190`. Phase 12–19 inventory and rehearsal evidence informs compatibility but cannot substitute for a fresh preflight.

Current Supabase guidance also informs the design: exposed schemas are an explicit API boundary, unexposed schemas are preferred for private data, and exposed-schema tables still require RLS ([Securing your API](https://supabase.com/docs/guides/api/securing-your-api)). Database functions should prefer invoker semantics; any definer must pin `search_path` and revoke default execution ([Database Functions](https://supabase.com/docs/guides/database/functions)).

## 3. Target Schema Architecture

`dispatch_private` holds current state, authorization, scope, and command internals. `dispatch_audit` holds immutable revisions, receipts, and business audit. `dispatch_projection` holds private candidates and projection storage. `dispatch_api` holds only explicit views and wrappers and is the sole schema recommended for Data API exposure. The first three remain unexposed. A separate `dispatch_ops` schema adds no security value and is not adopted.

## 4. Table Inventory

The exact 22-table inventory is specified in `tools/responder/phase25/migration-plan.md`: 17 private tables, three audit tables, and two projection tables. It records each table's purpose, keys, tenant relationships, sensitive fields, retention class, RLS requirement, and command ownership. Tenant-bearing FKs include `organization_id`; identity/history deletions are restricted rather than cascaded.

## 5. Type / Enum Inventory

`schema-design.sql` freezes 23 enums: profile, organization status/type/verification, membership, role, invitation, permission scope, operational scope/status, capability status, record type/status/priority, assignment, source, visibility, review, projection, ownership transfer, recovery, receipt, and audit event. Five capability identifiers and 26 permission identifiers remain constrained/static text inventories. Login bindings and `_local` prototype types are explicitly excluded.

## 6. Auth Dependencies

Required signed claims are `sub`, `session_id`, `aal`, `amr`, `iat`, and `exp`; none grants organization authority. Commands validate signature/expiry upstream and re-read `auth.users`, live session state, same-user verified TOTP factor, profile, membership, role/permission, organization, scope, and capability. Missing, deleted, expired, suspended, revoked, mismatched, or unavailable evidence fails closed. Only display hints may be cached; authorization state is live.

## 7. MFA Production Contract

All Dispatch access requires AAL2 plus a live verified same-user TOTP factor and session. Phase 24 proved enrollment, challenge, verification, AMR, AAL1→AAL2, refresh/rotation, factor removal, deleted user, and token tamper/expiry behavior locally. Supabase MFA documents AAL and factor status as distinct checks, which is why this design requires both ([MFA](https://supabase.com/docs/guides/auth/auth-mfa)). MVP does not claim fresh step-up; a disabled `minimum_iat` hook permits a future owner-approved recency policy.

## 8. RLS Architecture

All 22 tables enable and force RLS. Seventeen read policies cover self, live tenant membership, platform-bounded reads, audit, and public-safe projection. No mutation policy exists; writes are command-only. Policies are restrictive and re-evaluate current session, AAL/factor, membership, organization, scope, and grants so revocation applies on the next request. Platform administration never implies tenant membership or publisher identity.

## 9. Command / RPC Architecture

The 26-command inventory covers operational records (4), invitation/membership (7), ownership transfer (3), capabilities (3), projection (5), recovery (2), and organization governance (2). Each `dispatch_api` wrapper is invoker; each private implementation is a narrowly granted definer. Every mutating call is atomic and includes authorization, expected revision where applicable, request hash/idempotency, append-only audit, and receipt/result.

## 10. SECURITY DEFINER Requirements

Every definer must be owned by a minimal NOLOGIN owner; set `search_path=''`; use fully qualified identifiers; avoid dynamic SQL and identifier interpolation; revoke execution from PUBLIC, anon, and service_role; grant only the exact authenticated command allowlist; perform complete live authorization internally; lock transition rows; and append audit/receipt atomically. Phase 26 must inspect every function's catalog owner, ACL, `prosecdef`, and `proconfig`.

## 11. Invitation Design

Tokens require cryptographic entropy; only a 32-byte digest is stored. An invitation binds organization, normalized target identity, non-owner role, expiry, inviter, and lifecycle. Acceptance requires signed live AAL2 Auth, canonical verified-identity match, a row lock, one-use digest, and atomic membership/audit/receipt creation. Existing membership returns a deterministic result or conflict, never a duplicate. One identity may belong to many organizations. Email delivery is an external boundary and awaits provider/expiry approval.

## 12. Ownership / Recovery

Normal transfer uses a pending row, current owner, eligible active recipient, expected governance revision, recipient acceptance, and AAL2. A partial unique constraint preserves exactly one active owner for every non-closed organization. Recovery requires a case and two distinct live platform actors, neither deriving tenant membership; recovery sets ownership only to an eligible target membership and writes complete immutable evidence. A recovered owner becomes publisher only through normal membership permissions and an active capability.

## 13. Operational Scope Storage

COUNTY, MULTI_COUNTY, STATEWIDE, SERVICE_TERRITORY, CORRIDOR, ROUTE, FACILITY, SITE, and NON_GEOGRAPHIC are typed/versioned rows. Normalized members represent sets/order and governed dataset IDs; scalar jurisdiction/reference fields handle singular identities; authoritative geometry stays versioned in governed datasets or approved snapshots. JSON is descriptive only. Non-county sources, topology, licensing, and privacy are production owner gates.

## 14. Capability Grant Design

A grant binds organization, one of five frozen capability IDs, scope/version, status, validity interval, platform actor, evidence, and revision. Issuance/suspension/revocation are platform commands with AAL2 and audit. Expiry is evaluated live. Any status, validity, scope, organization, or source failure invalidates dependent candidate/public projection eligibility immediately.

## 15. Private Record Storage

Records are CONDITION, HAZARD, PLANNED_WORK, or OPERATIONAL_NOTICE with DRAFT, OPEN, IN_PROGRESS, MONITORING, CLOSED, or CANCELLED lifecycle. The current row contains tenant, scope, type, state, priority, bounded private fields, location reference, and current revision. Assignments and provenance are separate relations. Closure/cancellation is revisioned and triggers projection re-evaluation; private payload never appears directly in public storage.

## 16. Revision / Event Model

The recommendation is an immutable full bounded JSON snapshot per revision, plus normalized current state and provenance. Full snapshots make reconstruction and audit deterministic; payload schemas remain command-validated. The record's revision increments by exactly one under lock and is supplied as `expected_revision`, so concurrent stale mutation fails. Actor membership/user, source, transaction correlation, and timestamp are immutable.

## 17. Command Receipts

Uniqueness is `(organization_id, actor_user_id, command_name, idempotency_key)`; platform calls use a package-defined sentinel scope. Receipts store request hash, accepted result reference/payload, session evidence, and timestamps. Exact replay returns the stored result; same key with a different hash fails. Failed transactions leave neither domain mutation, audit, nor receipt.

## 18. Audit Architecture

Supabase/Auth provider security logs remain provider evidence. `dispatch_audit.audit_events` is separate business/governance evidence with event type, actor/session, organization, target, correlation, bounded payload, and timestamp. It is append-only, RLS-bounded for organization auditors, separately available to `platform.audit.investigate`, and has no client mutation grant. Exact retention duration is `OWNER_DECISION_REQUIRED`.

## 19. Projection Architecture

Private record → candidate → live eligibility → review → allowlist sanitation → public-safe projection → future Consumer Gridly. Gates cover source class, capability/scope/version, active organization, record lifecycle, visibility/privacy, taxonomy, freshness, reviewer, and channel. Organization suspension, grant revoke/expiry, scope invalidation, new source revision, terminal record, or projection expiry makes the public relation ineligible on the next request. Consumer integration is not implemented.

## 20. Responder Compatibility

The 13 explicit decisions in `compatibility-design.sql` use REUSE DIRECTLY, COMPATIBILITY VIEW/WRAPPER, DATA MIGRATION, SUPERSEDE, or RETIRE. Agency data maps explicitly to organizations; legacy roles map VIEWER→VIEWER, RESPONDER→OPERATOR, SUPERVISOR→SUPERVISOR, and AGENCY_ADMIN→ORGANIZATION_ADMIN. `AGENCY_OFFICIAL` remains immutable historical vocabulary. County authority becomes scope plus capability. The exact legacy 18-field projection and RPCs may receive adapters, but never weaker authorization. Fixtures retire; legacy RLS/package/dashboard are superseded.

## 21. Existing Production Impact

Phase 12 evidence found no responder-object collision and Phase 17/18 artifacts were rehearsed, not shown deployed. That evidence is historical, not authority to act. Fourteen items require fresh verification: environment, actor, migration head, versions/extensions, relations, functions, RLS/ACLs, Data API exposure, Auth capability, responder state/dependencies, row assumptions, consumer baseline, reporting state, and backup/rollback/approval evidence. Any drift selects a new design review.

## 22. Migration Ordering

The deterministic 15 steps are: read-only preflight; backup checkpoint; schemas/owner; types; core tables; audit/projection tables; constraints/indexes; frozen seeds; helpers/triggers; RLS/policies; commands/wrappers; conditional compatibility; exact revokes/grants; postflight; separate Data API configuration gate. The transaction/window boundaries and package hashes are manufactured and rehearsed in Phase 26.

## 23. Rollback Strategy

Pre-data rollback may reverse exact objects only with matching hash, zero rows/dependencies, and approval. Post-synthetic rollback exists only on a disposable clone after registered fixture teardown. Once real data exists, DROP is forbidden: freeze entry points, preserve data/evidence, restore versioned policies/functions/grants/routing, and forward-repair. Missing backup, hash, inventory, pre-state, or dependency certainty is an explicit refusal condition.

## 24. Retention Gates

Classes are current security/governance, ephemeral security, private operational, immutable history, idempotency history, projection history, public derived, and provider security. Tables include status/timestamps and restrictive references so schedules can later archive/pseudonymize without redesign. Exact durations, deletion/pseudonymization, legal holds, and provider-log treatment remain `OWNER_DECISION_REQUIRED`; Consumer reporting's 180-day rule is not imported.

## 25. Roles / Grants

Use existing anon/authenticated/service_role and, if approved, one minimal NOLOGIN function owner. Do not model platform admin as a database role. anon reads only the allowlisted public-safe API view. authenticated reads explicit invoker views and executes explicit wrapper/private-command allowlists with no table mutation. service_role receives no command execution by default. Default privileges are revoked.

## 26. Data API Exposure

Expose only `dispatch_api`; keep `dispatch_private`, `dispatch_audit`, and `dispatch_projection` unexposed. This follows Supabase's current explicit schema-exposure model and avoids treating RLS as the sole API boundary. A May 2026 platform change notes that newly created public-schema tables are no longer automatically exposed, reinforcing the need to assert rather than assume exposure ([Supabase Changelog](https://supabase.com/changelog)). Configuration is a separate owner action, never Phase 25 SQL.

## 27. Hostname / Auth Dependencies

Future `dispatch.gridlygo.com` work must approve exact Auth redirect/callback URLs, email-link origins, cookie domain/SameSite/Secure behavior, CORS allowlist, CSP connect/form/frame directives, service-worker scope/cache exclusions, logout/session refresh behavior, and recovery links. No DNS, CSP, CORS, Auth, email, cookie, or service-worker setting changes occur here.

## 28. Production Preflight

`preflight-design.sql` specifies a repeatable-read, read-only, time-bounded inventory and fourteen fail-closed assertions. It requires an operator-supplied expected-environment manifest rather than embedding a project ref or secret. Backup restorability, clone certificate, consumer health, and approvals are external evidence. Any mismatch is NO-GO.

## 29. Deployment GO/NO-GO Gates

GO requires all owner production decisions, fresh exact inventory, verified restore, signed package hashes, Phase 26 clone apply and deterministic reapply, complete Auth/RLS/command/adversarial vectors, tested rollback modes, consumer/reporting isolation, approved Data API/Auth/hostname configuration, named operators, monitoring, window, and incident rollback team. One missing or ambiguous gate is NO-GO.

## 30. Production Postflight

Postflight checks the exact four schemas, 23 types, 22 tables, constraints/indexes, 17 forced-RLS policies, 64 functions, owners/search paths/ACLs, seeds, and exposure. Behavioral vectors cover Auth/MFA invalidation, cross-tenant denial, platform separation, invitations, concurrency, idempotency, recovery, audit immutability, and projection privacy. Preservation hashes confirm all out-of-scope rows, consumer output, reporting, and Auth state are unchanged.

## 31. Owner Decisions Required

The 11-row register at `tools/responder/phase25/owner-decisions.md` covers pilot sector, initial capability set, retention, deletion/pseudonymization, fresh step-up, invitation delivery/expiry, verification renewal, non-county datasets, cache SLA, recovery staffing, and compatibility mode. Only compatibility mode is required before Phase 26; all are required before production as marked.

## 32. Phase 26 Rehearsal Contract

Manufacture a disposable production-shaped clone from an approved sanitized inventory; compile these inert designs into a separate versioned rehearsal package; apply from the exact expected head; seed synthetic Auth/tenant fixtures only; run Phase 21–24 plus adversarial RLS/Auth/command/concurrency/projection vectors; test all rollback modes; run database/security/performance advisors; prove consumer/reporting isolation; reapply deterministically; and certify file/catalog hashes. Do not use production credentials, users, traffic, or mutable source data.

## 33. Exact Next Branch Recommendation

Proceed only after owner review to `RESPONDER-PHASE26-dispatch-neutral-production-shaped-clone-rehearsal`. If fresh compatibility evidence cannot select ABSENT, EMPTY, or POPULATED_OR_REFERENCED, insert a compatibility-only prototype phase instead. Phase 25 does not create that branch or implement Phase 26.
