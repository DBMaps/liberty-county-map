# Responder Phase 15 — production Auth / MFA capability audit

## Executive decision

**Decision: CONDITIONAL GO.** The frozen Responder V1 identity and authorization model is structurally implementable against the current Gridly Platform Supabase production database, but it is not safe to treat native `aal2` or Auth sign-out as the entire control. Phase 16 needs a small private Auth adapter that combines verified JWT authentication evidence with live session/factor state, a server-controlled `valid_after` cutoff, and current responder authorization rows.

**B01 disposition: OPEN.** The catalog proves the required storage types and PostgreSQL helpers. Current Supabase documentation defines the JWT and session semantics. The project has **zero** Auth users, sessions, refresh tokens, factors, and AMR rows, however, and Dashboard-only settings were unavailable without a fresh interactive GitHub sign-in. Therefore this read-only phase cannot prove the actual project's TOTP enrollment/challenge, issued JWT shape, factor removal, or session-revocation behavior. Those mutation-dependent cases are explicitly **REQUIRES CONTROLLED FOLLOW-UP VERIFICATION**, not inferred as passed.

This is an architecture/capability decision only. It does not authorize a responder migration, production implementation, user/factor creation, or publishing.

## Evidence boundary

The four evidence classes remain separate:

1. **Repository evidence.** The frozen [V1 contract](RESPONDER-V1-CONTRACT.md), [role matrix](RESPONDER-V1-ROLE-MATRIX.md), [command contract](RESPONDER-V1-COMMAND-CONTRACT.md), [owner decisions](RESPONDER-V1-OWNER-DECISIONS.md), Phase 2/4/5/6 local fixtures, [Phase 9 readiness audit](RESPONDER-PHASE9-PRODUCTION-READINESS-AUDIT.md), [Phase 11 Auth mapping](RESPONDER-PHASE11-AUTH-MFA-PRODUCTION-MAPPING-AUDIT.md), and [Phase 12 production inventory](RESPONDER-PHASE12-PRODUCTION-SCHEMA-INVENTORY.md) define the frozen behavior and prior unknowns. Local fixtures are not production Auth proof.
2. **Actual production evidence.** On 2026-09-15, bounded catalog and aggregate queries against project `Gridly Platform` ran inside `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, returned `transaction_read_only=on`, and ended with `ROLLBACK`. They read no user row, email, IP, agent, token, factor secret, password, Vault value, or key. The bounded result is preserved in the [Phase 15 evidence](../../reports/responder/responder-phase15-production-auth-mfa-capability.json).
3. **Public platform semantics.** Current official Supabase documentation was used only where the database cannot explain Auth server behavior: [MFA and AAL](https://supabase.com/docs/guides/auth/auth-mfa), [JWT claims](https://supabase.com/docs/guides/auth/jwt-fields), [sessions and revocation](https://supabase.com/docs/guides/auth/sessions), and [RLS/Auth helpers](https://supabase.com/docs/guides/database/postgres/row-level-security).
4. **Unproved assumptions.** Anything needing enrollment, challenge, token issuance, sign-out, factor removal, reset, user deletion, or a configuration change is a controlled follow-up item. No such mutation was performed.

The Supabase changelog was reviewed for current Auth/security changes. The material platform change for database design remains that managed `auth` objects must not be modified; the adapter belongs in Gridly's private schema. Newer passkey/WebAuthn capability reinforces that `aal2` does not uniquely mean TOTP.

## Actual production Auth capability snapshot

Production identified PostgreSQL 17.6, database `postgres`, UTC, with no `agency_private` or `responder_public` schema. Exact bounded counts were:

| Object | Exact rows |
| --- | ---: |
| `auth.users` | 0 |
| `auth.sessions` | 0 |
| `auth.refresh_tokens` | 0 |
| `auth.mfa_factors` | 0 |
| `auth.mfa_amr_claims` | 0 |

The production catalog proves:

- `auth.users.id` is `uuid NOT NULL PRIMARY KEY`; email is a separate mutable `varchar` field.
- `auth.sessions.id` and `user_id` are UUIDs; `user_id` references `auth.users(id) ON DELETE CASCADE`. Sessions expose nullable `factor_id`, `aal`, `not_after`, and refresh timing/state fields.
- `auth.mfa_factors` binds a UUID factor to a UUID user, with factor type and status enums. The production enum values are `totp`, `webauthn`, and `phone`; statuses are `unverified` and `verified`.
- `auth.mfa_amr_claims` binds an `authentication_method` to `auth.sessions.id` and cascades with the session.
- Production AAL enum values are `aal1`, `aal2`, and `aal3`. Current public JWT documentation describes `aal1`/`aal2`; until the frozen contract reviews any future `aal3` semantics, an unknown or `aal3` value must fail closed rather than silently bypass an exact `aal2` rule.
- `auth.uid()` is a `STABLE`, security-invoker UUID function that reads request JWT `sub` and casts it to UUID. `auth.jwt()` is a `STABLE`, security-invoker function returning request JWT claims as JSONB. This is direct production proof of the PostgreSQL mapping.
- `anon`, `authenticated`, and `service_role` have no direct `SELECT` privilege on `auth.users`, `auth.sessions`, or `auth.mfa_factors`; `postgres` does. A narrowly owned private `SECURITY DEFINER` helper is therefore required for live session/factor lookup. Ordinary clients must never receive direct Auth-table access.

## Production capability matrix

| Requirement | Production capability | Proven? | Evidence | Adapter needed? | Blocker? |
| --- | --- | --- | --- | --- | --- |
| Immutable Auth UUID identity | `auth.users.id` is UUID PK | Yes | Production catalog | No | No |
| `auth.uid()` | Returns verified request JWT `sub` cast to UUID | Yes | Production function definition | No | No |
| JWT `sub` | Required UUID user subject | Platform + DB mapping proven; no issued project token sampled | Catalog + official JWT claims | No | Follow-up token-shape acceptance |
| Email independence | Email is separate from UUID identity | Yes | Production `auth.users` columns | No | No |
| `aal2` visibility | `auth.jwt()->>'aal'`; production Auth AAL enum includes `aal2` | Yes structurally | Helper definition, enum, official MFA/RLS guidance | Narrow helper/policy | Flow verification remains |
| TOTP capability | Production factor enum/table support `totp`; public Auth API documents enrollment/challenge | Structural only | Catalog + official MFA guide | Enrollment UX/server policy | **Controlled follow-up** |
| MFA method evidence | JWT `amr` can contain `totp`; production session AMR table stores method | Yes structurally | JWT claims + catalog | Yes; exact TOTP predicate | No architectural blocker |
| `session_id` | Required JWT UUID maps to `auth.sessions.id` | Yes structurally | Official sessions guide + catalog | Yes; live lookup | Flow verification remains |
| `iat` | Required JWT numeric issuance time | Yes as platform contract | Official JWT claims | Yes; compare with `valid_after` | Token sample remains |
| `exp` | Required JWT expiry enforced by gateway | Yes as platform contract | Official JWT claims | Check for server APIs; gateway handles Data API | No |
| Live membership override | Private live rows can be checked per statement/command | Yes by existing local design and PostgreSQL semantics | Phases 2–6 | Yes | No |
| Stale JWT role defeat | Do not authorize from JWT membership/app metadata | Yes | Live database design; official warning that JWT metadata stays stale until refresh | Yes | No |
| Offboarding | Live enabled/membership state gives immediate denial | Yes with adapter | Database semantics | Yes; disable + cutoff + session revoke | Operational control |
| Factor reset | Native `aal2` can remain until refresh after unenroll | Yes, unsafe alone | Official MFA guide | Live factor/session check + cutoff | **Controlled follow-up** |
| Session revocation | Sign-out removes `auth.sessions`; issued JWT otherwise remains cryptographically acceptable until expiry | Yes as platform semantics | Official sessions guide | Require live `session_id` | Flow verification remains |
| GRIDLY_ADMIN mapping | Normal individual Auth UUID plus separate private live grant | Yes | UUID/Auth/RLS primitives | Yes | No additional Auth feature |
| Browser/service-role separation | Public publishable client is present; server key lookup is confined to Edge Function/operator code | Yes for current repository | Source scan | Preserve boundary | No current responder exposure |

## Frozen B01 contract compatibility

| Frozen B01 element | Classification | Production-compatible implementation |
| --- | --- | --- |
| Canonical identity is `auth.users.id`, not email | **SUPPORTED DIRECTLY** | UUID PK plus `auth.uid()`/JWT `sub`; email stays contact data |
| Identity history binds the immutable UUID | **SUPPORTED WITH ADAPTER** | Store UUID evidence without cascading historical FKs |
| One active organization and live membership | **SUPPORTED WITH ADAPTER** | Private unique-active membership plus per-request live lookup |
| Agency roles are VIEWER/RESPONDER/SUPERVISOR/AGENCY_ADMIN | **SUPPORTED WITH ADAPTER** | Private enum/state; never JWT role metadata |
| GRIDLY_ADMIN is separate and individual | **SUPPORTED WITH ADAPTER** | Separate private UUID grant and governance helper |
| Every dashboard/command/governance request requires `aal2` | **SUPPORTED WITH ADAPTER** | Restrictive RLS/command helper reads signed `aal` and live session state |
| The required MFA method is authenticator-app TOTP | **REQUIRES CONTROLLED FOLLOW-UP VERIFICATION** | Production supports the type, but a real project enrollment/challenge/JWT must prove it |
| Live DB state defeats stale role/org/authority/gate claims | **SUPPORTED WITH ADAPTER** | Resolve every authorization input from current private rows |
| Factor reset invalidates otherwise-valid responder sessions | **REQUIRES OPERATIONAL CONTROL** | Disable + next-second `valid_after` + Auth session revoke + post-cutoff TOTP reauthentication |
| Complete offboarding defeats an old signed token | **SUPPORTED WITH ADAPTER** | Live principal/membership denial, cutoff, and live `session_id` existence check |
| No shared governance account | **REQUIRES OPERATIONAL CONTROL** | Provision and audit named individual Auth identities only |
| No browser/client service role | **SUPPORTED DIRECTLY** | Current browser uses publishable credentials; preserve server-only administration |

No B01 element is blocked by a missing database primitive. The two controlled-verification/operational rows are why the decision is conditional and B01 remains open.

## Identity, claims, and TOTP findings

Canonical responder identity is the immutable Auth UUID. Future current-state tables may reference `auth.users(id)` where deletion semantics are intentionally bounded. Historical membership, author, reviewer, governance, event, and receipt UUIDs must not cascade from Auth deletion. Email change cannot transfer membership or authorship. No existing Gridly application table uses an FK to `auth.users`; there is no deployed pattern to inherit.

Authentication claims and authorization state are different:

| Claim/state | Safe use |
| --- | --- |
| `sub` / `auth.uid()` | Canonical caller UUID after Supabase verifies the JWT. Explicitly require non-null. Never accept an actor parameter. |
| `role` | Require the normal `authenticated` gateway role only. It is not an agency role and not GRIDLY_ADMIN. |
| `aal` | Authentication assurance evidence. Require exact `aal2` under the frozen contract. It is insufficient by itself to prove TOTP or post-reset freshness. |
| `amr` | Authentication-method evidence only. Require a well-formed array containing `method = "totp"`; reject missing/malformed/alternate-only values. |
| `session_id` | Authentication-session identity. Parse as UUID and require a matching live Auth session owned by `auth.uid()`. |
| `iat` | Signed issuance time. Parse as an integer and compare to the private cutoff. It is not client time. |
| `exp` | Token expiry. It limits lifetime but does not replace immediate live revocation/cutoff checks. |
| `email` | Contact/invite matching only after current verification; never durable identity or authority. |
| `app_metadata` | Not used for responder organization, role, county, publishing, or governance authority because it is stale until token refresh. |
| `user_metadata` | Never authorization; authenticated users can change it. |
| Organization, membership, agency role, county authority, publishing gate, GRIDLY_ADMIN | Resolve from current private database rows on every protected read and command. |

`aal2` means that some second factor was used; it does not identify which one. Production itself has TOTP, WebAuthn, and phone factor types, and current public semantics permit more than TOTP. The frozen authenticator-app rule therefore needs both `aal='aal2'` and TOTP method evidence. The safest Phase 16 target is also a live session-to-factor check so removing the factor immediately fails the session. The exact `auth.sessions.factor_id` behavior for a real TOTP session must be verified before making that join a release predicate.

## Stale-session and offboarding threat table

| Case | Already defeated by live DB state? | Additional cutoff/session control | Required result |
| --- | --- | --- | --- |
| 1. Responder removed from organization while JWT remains valid | Yes: no active membership | Optional session revoke; not required for correctness | Immediate denial on next protected request |
| 2. AGENCY_ADMIN changed to VIEWER | Yes: current role controls every action | None beyond normal live check | Admin commands fail; allowed VIEWER reads still require fresh TOTP session |
| 3. Organization suspended | Yes: current verified/active organization predicate | Optional organization-wide session revoke for incident containment | All responder reads/commands fail; affected public posts follow frozen withdrawal rules |
| 4. County authority revoked | Yes: current approved authority/version/geometry predicate | None | Publication-changing actions and projection fail closed |
| 5. `agency_publishing_enabled=false` | Yes: current independent gate | None | Activation/edit-active/renew and consumer projection fail; frozen resolve/withdraw exceptions remain |
| 6. MFA factor reset/removed with old `aal2` JWT | **No, not from JWT alone** | Live session/factor predicate, user `valid_after`, disable-before-reset, server-side session revoke | Old token fails immediately; recovery needs new post-cutoff TOTP `aal2` session |
| 7. Responder completely offboarded | Yes when principal disabled and membership revoked; JWT alone is insufficient | Advance cutoff and revoke all Auth sessions | No responder or governance access even before JWT expiry |

Role, membership, organization, authority, and gate changes do not need a JWT epoch because their source of truth is already live. Use a cutoff only for authentication-security events and emergency account revocation, not as a substitute for current authorization rows.

## Minimum robust session-freshness design

Phase 16 should introduce one private principal-security row per privileged Auth UUID, shared by agency responders and individual Gridly governance users:

- `user_id uuid PRIMARY KEY`
- `enabled boolean NOT NULL DEFAULT false`
- `valid_after timestamptz NOT NULL`

The private helper must return true only when all of the following are true:

1. `auth.uid()` is non-null; the signed JWT role is `authenticated`; `is_anonymous` is false.
2. JWT `sub` is the same UUID represented by `auth.uid()`.
3. JWT `aal` is exactly `aal2`.
4. JWT `amr` is well-formed and contains a TOTP method.
5. JWT `session_id` parses as UUID and a row currently exists in `auth.sessions` for that ID and `auth.uid()`.
6. After controlled verification, the live session must also be `aal2` and bind to the currently verified TOTP factor/method. Missing or inconsistent session/factor state denies.
7. JWT `iat` is an integer and `to_timestamp(iat) >= valid_after`. At cutoff, store a next-whole-second boundary (or equivalent integer-second minimum) so a token issued in the same second cannot straddle the reset. Reauthentication begins after that boundary.
8. The principal is enabled, then the separate live membership/org/role/authority/gate/command predicate passes.

Security event sequence is mandatory: (a) disable the principal and advance `valid_after` in Gridly's private control transaction; (b) revoke affected Auth sessions through a dedicated server-only administrative path; (c) perform the membership/factor/offboarding action and append the bounded receipt; (d) after recovery, require a new verified TOTP factor and a post-cutoff `aal2` session before re-enabling. Session revocation is defense in depth; because the helper checks live session existence it also becomes immediately effective for database access instead of waiting for `exp`.

This is smaller and clearer than a custom `security_epoch`: no epoch claim or per-session allowlist is needed. A user-level `valid_after` plus native session existence handles all old tokens. Organization and membership cutoffs are unnecessary because those states are already read live. All factor removal/reset paths for responders must be controlled or reconciled; an out-of-band reset that does not advance the cutoff must fail launch acceptance.

## GRIDLY_ADMIN and browser boundary

GRIDLY_ADMIN needs no special production Auth feature. Each administrator uses an individual normal Auth user UUID, TOTP `aal2`, the same live principal/session checks, and a separate private `gridly_admin_grants` row. The governance helper checks that live grant and never derives governance authority from an agency membership or JWT metadata. Revoking the grant fails on the next request; suspected compromise also disables the principal, advances its cutoff, and revokes sessions.

The existing public client in `js/app.js` contains only the project's publishable key. Repository-wide scanning found `SUPABASE_SERVICE_ROLE_KEY` use in the unrelated `gridly-geocode` Edge Function and references in server/operator scripts, SQL, and runbooks; no service-role reference was found in `js/app.js` or `index.html`. The Edge Function reads the key from its server environment and sets `persistSession:false`. Its `verify_jwt=false` configuration is unrelated and must never be copied to responder endpoints.

Future responder browsers may use only a publishable key plus the individual user's access token. They receive no secret/service-role key, Auth admin API, direct private-table mutation grant, or factor-reset authority. Auth provisioning, factor recovery/reset, and session revocation stay behind a dedicated authenticated, rate-limited, audited server/operational boundary. Private responder responses remain outside the public PWA service-worker cache scope and use `no-store`.

## Production Auth configuration dependencies

The following are release dependencies, not Phase 15 changes:

| Setting/control | Required posture | Current production proof |
| --- | --- | --- |
| MFA enrollment/challenge/verify | TOTP enrollment and verification enabled; responder UI exposes only approved TOTP path | **Controlled follow-up**; catalog support only |
| Alternate MFA | Phone/WebAuthn must not satisfy frozen responder predicate without owner contract change | Adapter requirement; enum proves alternates exist |
| JWT expiry | At or below a reviewed short lifetime; do not set below Supabase's supported/recommended floor merely to solve revocation | **Dashboard setting unverified** |
| Session lifetime/inactivity/single-session | Owner-reviewed shared-workstation posture; useful defense in depth, not authorization correctness | **Dashboard setting/plan entitlement unverified** |
| Refresh-token reuse detection | Keep platform protection enabled unless a reviewed reason exists | **Dashboard setting unverified** |
| Email/password provider | Individual accounts only; disable unintended anonymous/self-signup paths for responder eligibility; enforce reviewed password policy | **Dashboard setting unverified** |
| Email confirmation/change | Current verified email needed only for invite redemption/contact; secure email-change behavior reviewed | **Dashboard setting unverified** |
| Recovery/reset | Independent identity proof, authorized reviewer, disable/cutoff/revoke before factor reset, durable receipt | **Operational SOP and flow verification required** |
| Invitations/SMTP | Approved SMTP or tightly bounded owner-approved pilot delivery; generic errors and no enumeration | Deferred owner gate; not an Auth-capability blocker |
| Auth audit/monitoring | Detect out-of-band factor/user/session changes and reconcile principal state fail closed | Operational implementation required |

## Phase 16 security contract

Phase 16 must obey all of these implementation constraints:

1. Keep `agency_private` outside exposed Data API schemas. Put authorization helpers there, not in `public` or managed `auth`.
2. Use `TO authenticated` plus explicit predicates. `auth.uid()` must be non-null. `TO authenticated` alone is not authorization.
3. Use direct RLS predicates for simple row ownership/org projection only after a single private eligibility helper passes. Put session/factor lookup and multi-table membership/org/role checks in narrowly scoped `STABLE SECURITY DEFINER` helpers to avoid policy recursion and per-row repeated work.
4. Every definer function has an explicit reviewed owner, `SET search_path = ''`, fully schema-qualified names, default `PUBLIC` execute revoked, only the minimum role-specific execute grants, and no dynamic SQL. Never expose a general Auth-table reader.
5. Definer helpers derive the actor internally from `(select auth.uid())`. No production signature accepts authoritative actor UUID, database role, assurance, membership role, organization, county grant, governance flag, `valid_after`, or epoch from the caller.
6. Parse JWT JSON defensively. Missing/malformed `aal`, `amr`, `session_id`, or `iat` denies without leaking whether a membership/grant exists. Require the TOTP method in addition to exact `aal2`.
7. Recheck live enabled principal, session existence/ownership, issuance cutoff, active membership, one-active-org invariant, verified/active organization, current role, current county authority/version/geometry, publishing gate, and command-specific rules in the same command transaction.
8. RLS provides bounded reads. Browser clients receive no direct INSERT/UPDATE/DELETE on private tables. Mutations occur only through narrowly granted command functions that repeat the full authorization predicate and preserve revision/replay/event rules.
9. GRIDLY_ADMIN uses a separate private UUID grant and governance helper. It is not an agency role and gains no implicit agency command rights.
10. Current/historical actor UUID evidence never cascades from Auth deletion. Any direct FK to `auth.users` is limited to disposable current principal state and receives an explicit delete/reconciliation design.
11. Access-token expiration is not emergency revocation. Security-sensitive reset/offboarding first disables and advances the cutoff, then revokes Auth sessions server-side. Re-enable only after new post-cutoff TOTP `aal2` proof.
12. Test real `anon`, `authenticated`, responder roles, GRIDLY_ADMIN, function owner, and server administration paths. Include cross-org, malformed-claim, missing-session, removed-factor, stale-`iat`, role downgrade, suspension, gate-off, revoked authority, and deleted-user negatives.
13. Treat production's currently observed `aal3` as unsupported/fail-closed until deliberately reconciled with the frozen contract.
14. Do not modify managed `auth` schema objects or install triggers there. If out-of-band Auth changes cannot be prevented, add controlled reconciliation/monitoring outside `auth` and fail closed.

## Remaining controlled-verification items

Before B01 may close, an authorized non-pilot disposable Auth identity must prove, without exposing token contents:

- current project TOTP enrollment, challenge, verification, unenrollment, and re-enrollment APIs are enabled;
- the post-challenge JWT has UUID `sub`/`session_id`, integer `iat`/`exp`, exact `aal2`, and `amr.method=totp`;
- `auth.sessions.factor_id`, `auth.sessions.aal`, `auth.mfa_amr_claims`, and verified factor rows correlate as expected;
- the proposed private helper allows a fresh TOTP session and denies `aal1`, missing/malformed claims, alternate-factor-only `aal2`, removed factor, deleted/revoked session, and pre-cutoff JWT;
- single/global/admin session revocation removes the intended `auth.sessions` rows and the old access token is denied by the live-session predicate before JWT expiry;
- factor removal/reset advances the cutoff or is immediately caught by the live factor predicate, including any self-service or Dashboard administrative path;
- user ban/deactivation/deletion behavior is reconciled with principal disablement and historical UUID retention;
- Dashboard values for JWT expiry, session limits, refresh reuse, provider/self-signup, email confirmation/change, password policy, recovery, and MFA verification are recorded and approved;
- the factor-recovery reviewer/SOP, emergency lockout owner, individual GRIDLY_ADMIN coverage, and shared-workstation persistence policy are owner-approved.

## Audit integrity

- **Production mutations performed:** NONE
- **Secrets exposed:** NONE
- **Responder schema/table/function/policy/config changes:** NONE
- **Production Auth users/factors/sessions changed:** NONE
- **Migrations altered:** NONE
- **Community reporting/publishing changed:** NONE
- **Original LP244.26 worktree:** not accessed or modified; all work remained in the responder worktree
- **Push/merge:** NONE

**Final blocker disposition: B01 OPEN.** There is no discovered architectural NO-GO: the current platform has the necessary primitives, and the minimum adapter is precise. B01 remains open only because the current empty Auth tenant cannot supply mutation-dependent behavioral evidence under this phase's read-only rules and the project-level settings were not readable without interactive sign-in.

B01 OPEN — CONTROLLED PRODUCTION AUTH FLOW VERIFICATION REQUIRED
