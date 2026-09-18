# Gridly Dispatch Phase 27 — Neutral Owner + Security Decision Closure

**DECISION / CONTRACT CLOSURE ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

## 1. Executive Summary

Phase 27 converts every open Phase 25/26 owner or security question into `FROZEN`, `OWNER_APPROVAL_REQUIRED`, or `DEFERRED_POST_MVP`. It makes no schema, SQL, migration, runtime, Supabase, Consumer Gridly, public-site, or native-app change.

The security architecture recommendation is to retain a dedicated `NOLOGIN BYPASSRLS` command owner with an exact object allowlist; redesign `current_actor_id()` and `current_session_id()` as invoker helpers; retain only `has_live_aal2()` as a tightly bounded postgres-owned Auth bridge; and remove broad table grants made solely to support security-invoker views. These are Phase 28 package-hardening requirements, not changes made here.

The recommended pilot is municipal public works with three initial capabilities: condition, planned work, and official notice. Hazard and road-closure publication remain disabled at pilot start. The owner must still approve the commercial/policy choices identified in the decision register. Phase 28 is not open until every security-critical `OWNER_APPROVAL_REQUIRED` row is explicitly approved and the other entrance criteria in section 24 are met.

Current Supabase guidance supports this posture: use invoker functions by default, pin an empty `search_path` and revoke default execution for definers, treat grants and RLS as separate controls, use `security_invoker` views deliberately, and explicitly configure Data API exposure. The 2026 Data API default change and Postgres 17 transition must be included in Phase 28 preflight rather than assumed ([Database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [API security](https://supabase.com/docs/guides/api/securing-your-api), [Supabase changelog](https://supabase.com/changelog?types=breaking-change)).

## 2. Phase 26 Evidence Basis

The authoritative starting point is Phase 26 commit `71a082ee54fd3ae78c92944ca5d6b0ca91c11d71`. Its disposable, unlinked local Supabase rehearsal proved the exact four-schema, 23-enum, 22-table, 64-function, 17-policy package shape; real local Auth/TOTP/AAL2; all 26 command names; five concurrency races; forced RLS; projection invalidation; conditional compatibility; rollback/reapply; catalog certification; and teardown.

Phase 26 also produced four explicit findings that require closure:

1. forced-RLS command mutations required a `NOLOGIN BYPASSRLS` function owner;
2. `current_actor_id()`, `current_session_id()`, and `has_live_aal2()` remained postgres-owned because Supabase reserves Auth-role membership;
3. security-invoker views required underlying `USAGE`/`SELECT` grants, including grants broader than the view columns;
4. enum values received exhaustive static but representative runtime coverage.

Phase 26 is strong local evidence, not production evidence. It does not prove current production inventory, compatibility state, project settings, backup restorability, provider configuration, staffing, legal retention requirements, or owner acceptance.

## 3. Command Owner Decision

**Decision: FROZEN — retain option A, a dedicated `NOLOGIN BYPASSRLS` command-function owner, with a smaller privilege envelope than the rehearsal.**

| Option | Assessment |
| --- | --- |
| Dedicated `NOLOGIN BYPASSRLS` owner | Recommended. Isolates the unavoidable forced-RLS bypass from `postgres`, has no login, and permits object-level grants and catalog assertions. |
| Postgres-owned commands | Rejected. It expands blast radius to the database administrative principal and makes accidental privilege inheritance harder to distinguish from intended command authority. |
| Non-BYPASSRLS owner | Rejected for the current forced-RLS command architecture. It cannot perform the atomic writes without weakening forced RLS or adding a wider set of privileged escape helpers. |

Production rule:

- role attributes are exactly `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS`;
- it receives no membership in Supabase roles and is not usable by an application connection;
- it owns only the private command dispatcher/implementations and narrowly necessary private helpers, never tables, schemas, Auth objects, API views, extensions, or unrelated functions;
- it gets schema `USAGE`, exact column/table mutation privileges needed by commands, and exact function execution—never `ALL ON ALL TABLES` in the production package;
- schema `CREATE`, object ownership delegation, DDL, role administration, and Data API exposure are denied;
- every owned definer uses `search_path=''`, fully qualified names, no dynamic SQL/identifier interpolation, complete live authorization, expected revision/idempotency, locks, and atomic audit/receipt writes;
- `PUBLIC`, `anon`, `authenticated`, and `service_role` execution is revoked by default; authenticated users call only reviewed API wrappers;
- package lint and postflight assert owner OIDs, role attributes, ACLs, dependencies, `prosecdef`, `proconfig`, and absence of unexpected objects;
- changing this role, its ownership set, or grants is a security review event.

The bypass is accepted only inside the command boundary. It is never evidence that a caller is authorized.

## 4. Auth Bridge Ownership Decision

The three Phase 26 functions are classified individually:

| Function | Classification | Production decision |
| --- | --- | --- |
| `dispatch_private.current_actor_id()` | **REDESIGN** | Make it `SECURITY INVOKER` (or inline the schema-qualified `auth.uid()` expression). It accepts no input and needs no privileged table access. It must not remain postgres-owned merely for convenience. |
| `dispatch_private.current_session_id()` | **REDESIGN** | Make it `SECURITY INVOKER` (or inline a strict parse of `auth.jwt()->>'session_id'`). It accepts no input and needs no privileged Auth-table access. Malformed/missing claims return null and fail closed. |
| `dispatch_private.has_live_aal2()` | **ACCEPT AS POSTGRES-OWNED** | This is the sole bounded bridge that must read reserved `auth.users`, `auth.sessions`, and `auth.mfa_factors`. Keep it no-argument and boolean-only, with no row or identity disclosure. |

The retained bridge must have `search_path=''`; every relation/function/operator reference must be schema-qualified where applicable; no user-supplied parameters, dynamic SQL, writes, or generic query facility are allowed; execution is revoked from `PUBLIC`, `anon`, and `service_role`; execution is granted only to the command owner and to authenticated policy evaluation if a documented policy still requires it. It must re-read the signed `sub`/`session_id`, live non-deleted user, session user/AAL, verified same-user TOTP factor, TOTP AMR, and active Dispatch profile and return only true/false. Direct-call allow/deny tests, tampered claims, deleted user, revoked session/factor, cross-user factor, and catalog ACL tests are mandatory.

If the production Supabase inventory offers a supported narrower Auth-owned interface, Phase 28 may replace the internal implementation without weakening this contract. Missing reserved-object access is a stop condition, not a reason to grant the command owner broad Auth access.

## 5. Security-Invoker Grant Decision

**Decision: FROZEN — a view may never justify broad raw-table access.**

Exact production rule:

- `dispatch_api` is the only candidate exposed schema; `dispatch_private`, `dispatch_audit`, and `dispatch_projection` remain unexposed.
- Views remain `security_invoker=true` so underlying RLS and caller privileges apply.
- Grant schema `USAGE` only where PostgreSQL requires it and grant `SELECT` only on the exact underlying columns projected by an approved view. Do not grant table-wide `SELECT` when the view exposes fewer columns.
- The Phase 26 anon/authenticated grant on `dispatch_projection.projection_candidates` is not accepted for production. Projection eligibility must move behind a no-input-leak, boolean security helper or an equivalent safe shape so public roles never receive raw candidate access.
- The Phase 26 table-wide authenticated grant on `dispatch_private.operational_records` is not accepted. Replace it with column-level grants for the exact view columns, with RLS still forced and tested.
- No public role receives `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, trigger, sequence, or schema `CREATE` privileges on underlying objects.
- Sensitive JSON, notes, identity, evidence, audit, receipt, and correlation columns receive no direct public-role grant.
- Phase 28 tests both view access and attempted direct underlying access through PostgREST and a role-switched SQL session. Accidental schema exposure must still fail safely.
- Data API schema and object exposure is an explicit configuration manifest/postflight assertion, not an inference from SQL grants.

If PostgreSQL cannot express the exact safe column/function boundary without exposing a sensitive relation, the view is redesigned or withheld. The requirement to expose a view never wins over least privilege.

## 6. Runtime Coverage Standard

**Decision: FROZEN — option B, strengthened: exhaustive static validation plus branch-complete representative runtime tests.**

Production readiness does not require running every Cartesian combination of enum values. It does require:

- exact catalog comparison for every enum label, order, constraint, seed identifier, command name, policy, and compatibility field;
- a create/read or cast/constraint assertion for every enum value;
- runtime execution of every behaviorally distinct authorization, lifecycle, transition, projection, and error branch;
- boundary tests for every status that changes eligibility, every high-risk capability, every scope family admitted to the pilot, every role template, and every command;
- at least one representative value only where values are proven to share the same code path and constraints;
- a maintained enum-to-runtime-equivalence matrix; any new branch or special case requires its own runtime vector.

This is more defensible than redundant execution of behaviorally identical labels and stronger than Phase 26's undocumented equivalence assumption.

## 7. Pilot Sector Decision

**Recommendation: municipal public works. Status: OWNER_APPROVAL_REQUIRED.**

| Sector | Value / fit | Sensitivity and verification | Commercial/support/legal burden |
| --- | --- | --- | --- |
| Municipal public works | High; best match for conditions, planned work, notices, and bounded public awareness; reuses the most proven workflows | Moderate; public-entity identity and jurisdiction/scope still require evidence | Lowest implementation/support uncertainty; public procurement and authority wording still require care |
| Bounded utility field operations | High private/public split and strong commercial potential | Higher infrastructure sensitivity and service-territory authority burden | Higher incident, security, data-source, and customer-support burden |
| School district facilities/transportation | Useful facility/route test and clear community value | Highest child-safety/privacy sensitivity of the three | More complex privacy, route, staffing, and communications review |

Municipal public works offers the highest operational value with the simplest already-rehearsed workflow and lowest novel data sensitivity. The owner must approve the market/pilot choice before sector-specific implementation or external commitment.

## 8. Initial Capability Recommendation

**Recommendation: OWNER_APPROVAL_REQUIRED.** Enable only:

1. `awareness.condition.publish` — consumer-projection eligible after review;
2. `awareness.planned_work.publish` — consumer-projection eligible after review;
3. `awareness.official_notice.publish` — consumer-projection eligible after review and source-explicit labeling.

Keep `awareness.hazard.publish` disabled until severity taxonomy, escalation, support, and wording are approved. Keep `awareness.road_closure.publish` disabled until two-person author/approver workflow, authoritative roadway scope, staffing, and removal SLA are operational. Private `CONDITION`, `HAZARD`, `PLANNED_WORK`, and `OPERATIONAL_NOTICE` records remain available according to organization permissions; a public capability is not required for private operations.

Pilot grants are scope-bound, time-bounded, revocable, and independently approved. No organization verification level self-grants a capability.

## 9. Retention Decision Matrix

These are proposed MVP operational defaults, not statements of law. Every exact duration is **OWNER_APPROVAL_REQUIRED** with legal/privacy review before production data. Legal hold, litigation, public-records, contractual, backup, export, and incident duties override scheduled disposition through a documented hold process.

| Category | Class | Proposed default operational need | Disposition / pseudonymization | Decision status |
| --- | --- | --- | --- | --- |
| Organization memberships/history | Security/governance | Active relationship plus 7 years after terminal membership or organization closure | Keep organization, role/status, times, and pseudonymous actor token; remove profile/contact linkage when no longer required | OWNER_APPROVAL_REQUIRED |
| Invitations | Ephemeral security | Pending for 7 days; terminal metadata/digest for 1 year | Destroy unusable digest and target address after the terminal-retention window; keep bounded event counts/IDs | OWNER_APPROVAL_REQUIRED |
| Private operational records | Private operational | 3 years after terminal state or organization closure | Delete/archive private payload after holds; keep minimized audit/projection lineage | OWNER_APPROVAL_REQUIRED |
| Record revisions | Immutable operational history | Same 3-year window as owning record, never shorter while the record survives | Dispose as one record lineage; pseudonymize actor presentation, not event integrity | OWNER_APPROVAL_REQUIRED |
| Assignments | Private workforce data | Active record plus 1 year after terminal state, capped by record retention | Remove assignee display/contact data; retain pseudonymous assignment event if needed for audit | OWNER_APPROVAL_REQUIRED |
| Audit events | Security/governance evidence | 7 years | Append-only during retention; pseudonymize presentation and retain stable actor token; holds suspend disposition | OWNER_APPROVAL_REQUIRED |
| Command receipts | Idempotency/security | 2 years and never less than the accepted replay/restore horizon | Remove bounded result payload first where possible; retain request hash/outcome/correlation as required | OWNER_APPROVAL_REQUIRED |
| Projection candidates | Projection history | 2 years after terminal review/withdrawal/expiry | Delete sanitized candidate payload after lineage window; retain minimized decision event | OWNER_APPROVAL_REQUIRED |
| Public projections | Public derived | Visible only while eligible; historical lineage for 3 years | Remove consumer visibility immediately under section 18; later delete public payload while retaining minimized audit correlation | OWNER_APPROVAL_REQUIRED |
| Platform recovery evidence | High-risk governance | 7 years after case closure | Retain case, distinct approver tokens, target, evidence reference, and outcome; minimize narrative/PII | OWNER_APPROVAL_REQUIRED |

Consumer Gridly's community-report 180-day rule is not reused.

## 10. User Deletion / Pseudonymization

**Recommendation: OWNER_APPROVAL_REQUIRED.** Separate access termination, Auth deletion, profile erasure, and historical evidence.

- Leaving an organization immediately ends live membership authorization; the terminal membership and its audit history remain organization-owned governance records.
- Before deleting a Supabase Auth user, revoke sessions/factors and active memberships. Token expiry alone is not a strict revocation control.
- Delete or erase the mutable profile/contact layer when no longer required.
- Historical membership, revision, assignment, receipt, audit, and recovery rows retain a non-reversible, scope-specific pseudonymous actor token plus the original event's integrity fields. Do not expose a raw deleted Auth UUID in normal organization or consumer views.
- If a narrowly controlled legal/incident identity vault is approved, it is separate, access-logged, purpose-limited, and retention-governed; it is not available to routine Dispatch queries.
- Never cascade-delete immutable operational/governance evidence because an Auth user is deleted. Never retain display name/email merely because a UUID reference exists.

This selects the pseudonymous actor-token model. A retained legal identity is exceptional and policy-controlled, not the default.

## 11. Ownership Transfer Step-Up

**Decision: FROZEN — option C, a fresh TOTP challenge within 10 minutes, for both initiation and acceptance.**

An existing AAL2 session older than 10 minutes is insufficient. Each actor must complete a fresh same-user TOTP challenge, and the server must validate a trusted challenge/assurance timestamp bound to the live session before the command. The recipient remains a distinct eligible active member and supplies independent acceptance. Freshness augments, and never replaces, live user/session/factor, permission, organization revision, transfer expiry, and idempotency checks.

Phase 24 proved AAL1→AAL2, not operation-specific recency. Phase 28 must implement and test the recency evidence; until then ownership transfer stays disabled in a production package.

## 12. Platform Recovery Step-Up

**Decision: FROZEN.** Each of two distinct eligible platform approvers must:

- have a live AAL2 session and verified same-user TOTP factor;
- complete a fresh TOTP challenge within 5 minutes of that approver's action;
- confirm the immutable recovery case ID, organization, target membership, and expected organization revision;
- provide a bounded reason/evidence reference; and
- act from an individual account. Shared accounts, delegated sessions, self-second-approval, and stale approval reuse are forbidden.

The second approval must re-read all live eligibility and unchanged-case predicates. Any target, organization revision, approver eligibility, session, or factor change invalidates pending completion. Recovery never grants publication authority. A missing second approver means the recovery cannot proceed.

## 13. Invitation Expiry

**Decision: FROZEN — 7 days for MVP.** Twenty-four or 72 hours creates unnecessary failure for part-time/public-sector invitees; 14 days lengthens token exposure. An unaccepted invitation expires at seven 24-hour periods from server issuance. Reissue creates a new digest, expires/revokes the old invitation, and records the event. Expiry is enforced at acceptance time without depending on a scheduled status mutation.

## 14. Invitation Delivery

**Recommendation: OWNER_APPROVAL_REQUIRED for provider/origin readiness; delivery contract is FROZEN as email plus a controlled manual-copy fallback.**

- Primary delivery is transactional email from an approved Dispatch sender/provider.
- The link uses the exact approved Dispatch HTTPS origin (proposed `https://dispatch.gridlygo.com`), never the Consumer Gridly application origin.
- A manual-copy fallback is shown once to an authorized inviter over `no-store`; its use is audited. It is for controlled pilot recovery, not routine bulk delivery.
- Tokens have cryptographic entropy, appear only in the recipient link/one-time display, are never logged or placed in analytics/referrers, and are stored only as a digest.
- Reissue revokes the old invitation. Expired, revoked, accepted, wrong-identity, or replayed tokens fail closed.
- Email ownership alone grants nothing; acceptance still requires the canonical authenticated identity, live AAL2/factor, active organization, exact invitation binding, and transaction-safe single use.

No provider is selected or implemented in Phase 27.

## 15. Organization Verification Renewal

**Recommendation: OWNER_APPROVAL_REQUIRED.** Keep verification separate from capability authority.

- `VERIFIED_ORGANIZATION`: annual (12-month) reverification plus immediate event-triggered review.
- `VERIFIED_PUBLIC_ENTITY`: annual reverification, with a six-month evidence attestation while any public capability is active, plus immediate event-triggered review.
- Triggers include legal-name/entity change, domain/contact-control change, organization type/scope change, credible abuse report, authority dispute, merger/dissolution, repeated security incident, or evidence-source withdrawal.
- Expiry/downgrade blocks new public grants and makes grants requiring that level ineligible; private access follows the separate organization/membership policy.

Verification proves identity/classification only. It never grants a scope, capability, membership, role, or public label by itself.

## 16. Capability Grant Renewal

**Recommendation: OWNER_APPROVAL_REQUIRED.** No capability is permanent or auto-renewing.

- Pilot grants: maximum 90 days for every public capability.
- After a successful pilot: condition, planned-work, and official-notice grants may be issued for at most 12 months; hazard and road-closure grants for at most 6 months.
- Every renewal revalidates organization verification, governed scope/version, authority evidence, named responsible contacts, incident history, and current operational need.
- A new source/scope version, authority dispute, verification downgrade, incident, organization suspension, or material control change triggers immediate review and may suspend eligibility before the nominal end date.
- Manual renewal creates new immutable decision evidence. No grace period permits publication after `valid_until`.

## 17. Non-County Scope Data Sources

The schema may represent these scopes, but none is approved for public authority until a source/version/topology review succeeds.

| Scope | Private operations | Public-projection authority | Classification / later source work |
| --- | --- | --- | --- |
| `SERVICE_TERRITORY` | Organization-declared, versioned boundary is acceptable for private workflow | Not approved from self-assertion | `NEEDS SOURCE RESEARCH`: regulator/franchise/tariff or other legally authoritative territory source, licensing, overlap, update cadence |
| `CORRIDOR` | Organization-declared linear/area scope is acceptable privately | Not approved until topology/containment semantics are governed | `NEEDS SOURCE RESEARCH`: relevant state/local DOT linear-reference or roadway-network source and version |
| `ROUTE` | Organization-declared ordered segments/stops are acceptable privately | Not approved until route operator/authority and version are verified | `NEEDS SOURCE RESEARCH`: authoritative operator data; GTFS may describe transit service but does not alone prove publication authority |
| `FACILITY` | Organization asset registry reference is acceptable privately | Requires verified control/authority and a governed public-safe location/boundary | `ORGANIZATION-DECLARED ONLY` for private use; `NEEDS SOURCE RESEARCH` for public use, potentially parcel/public asset registries |
| `SITE` | Organization-declared site is acceptable privately | Requires verified control/authority and privacy/safety review | `ORGANIZATION-DECLARED ONLY` for private use; `NEEDS SOURCE RESEARCH` for public use |

Thus authoritative datasets are **NOT REQUIRED FOR PRIVATE OPERATIONS** but are required before a scope supports public projection authority. Dataset acquisition is deferred until the pilot's actual scope requires it; manufacturing a placeholder dataset is forbidden.

## 18. Consumer Projection Cache SLA

**Recommendation: OWNER_APPROVAL_REQUIRED before Consumer integration.**

- Server eligibility removal is transactional/immediate when the invalidating command commits or a time predicate expires.
- API/CDN and online-client target removal is under 1 minute.
- Hard connected-client upper bound is under 5 minutes, including poll/push retry.
- Dispatch-derived public responses use `no-store` until a separately reviewed cache design exists. The Consumer service worker must not cache Dispatch-private responses or retain a projection past its signed server expiry.
- If bounded offline projection caching is later approved, each entry has an absolute maximum five-minute offline display lifetime and is purged on the next connectivity event. After the TTL, the client hides it even without network access.
- Organization suspension, capability revoke/expiry, scope invalidation, source revision change, withdrawal, and terminal record state all use the same invalidation path.

Monitoring measures commit-to-origin, origin-to-edge, and edge-to-client latency. Missing invalidation acknowledgement raises an incident; it never causes the projection to remain eligible at the server.

## 19. Platform Recovery Staffing

**Recommendation: OWNER_APPROVAL_REQUIRED before Phase 28 because this is security-critical.**

- Maintain at least three trained, named platform administrators so two distinct approvers are reasonably available despite absence or conflict.
- Maintain at least two distinct eligible approvers in the documented recovery coverage window; each uses an individual account, hardware/device hygiene, live TOTP, and separate session.
- No shared accounts, shared TOTP seeds, pre-approval, blanket approval, or break-glass bypass of the two-person rule.
- The incident lead may coordinate but cannot manufacture the second approval.
- If a second eligible approver is unavailable, recovery stops. Emergency containment may suspend an organization/capability or revoke sessions through separately approved controls, but ownership does not transfer.
- Quarterly access review and semiannual recovery drill are required; departures and lost factors trigger immediate roster review.

The owner must accept the staffing/coverage obligation or remove live platform recovery from the MVP.

## 20. Responder Compatibility Mode

**Decision: FROZEN as an evidence-selected rule; current production mode remains `NEEDS PRODUCTION READ-ONLY VERIFICATION`.**

Default to **no live compatibility wrapper**. If Phase 28 read-only preflight proves responder objects and dependencies are `ABSENT` or `EMPTY` with no real consumer, install the neutral package without compatibility views/wrappers. If any responder object is populated or referenced, stop package preparation and require a separately approved migration-only compatibility plan, reconciliation, and retirement criteria. Do not carry the Phase 26 rehearsal wrapper into production merely because it passed locally.

This combines options B/C: no compatibility when evidence proves it unnecessary; migration-only compatibility when real evidence requires it. Permanent dual contracts are rejected.

## 21. Privileged Constructs Register

| Construct | Why required | Owner | Grants / input surface | Mitigations and Phase 26 evidence | Review requirement |
| --- | --- | --- | --- | --- | --- |
| Command dispatcher and 26 private command implementations | Atomic writes through forced RLS | Dedicated `dispatch_function_owner` | Execute only via exact authenticated API wrapper allowlist; bounded `jsonb` payload validated internally | No login; BYPASSRLS only here; empty search path; qualified names; no dynamic SQL; live auth; locks; receipts/audit; Phase 26 all commands and revocation/concurrency passed | Catalog/ACL lint every package; security review on code/owner/grant change |
| `has_live_aal2()` Auth bridge | Read reserved live Auth user/session/TOTP state | `postgres` only because reserved Auth membership prevents narrower owner in rehearsed stack | No arguments; boolean result; execute only to command owner and documented policy caller | Empty search path; fully qualified reads; no writes/row disclosure; Phase 24/26 tamper, expiry, factor/user/session denial passed | Revalidate against production Auth catalog/version; direct-call negative tests |
| `current_actor_id()` / `current_session_id()` | Claim parsing convenience | Redesign to invoker/minimal owner | No input; UUID/null output | No privileged reads needed; remove from postgres-owned exception | Phase 28 must prove `prosecdef=false` and ACLs |
| Other private authorization/eligibility helpers | Reusable live tenant/scope/projection checks | Dedicated command owner only if RLS bypass is necessary; otherwise invoker/minimal owner | Exact function-only execution; scalar IDs, boolean/UUID results | Per-helper necessity review; empty search path; no general query surface | Catalog register and allow/deny tests |
| Platform recovery command path | Two-person ownership restoration | Same command owner; never a database platform-admin role | Two exact commands; bounded case/target/revision payload | Two distinct live platform grants, fresh step-up, immutable approvals, unchanged revision, no publisher shortcut; Phase 26 two-person separation passed | Staffing approval, drills, and every release security test |
| Projection publication/withdrawal commands | Controlled creation/removal of public-safe data | Same command owner | Exact wrappers and bounded sanitized payload | Capability/scope/org/source/revision/review gates; allowlist sanitizer; immediate ineligibility; Phase 26 invalidation vectors passed | Privacy/schema review for every public field change |
| Projection eligibility helper | Hide ineligible rows while underlying candidate data stays private | Minimal private definer only if needed | Boolean by projection ID; public callers receive no private fields | No candidate-table grants to public roles; empty search path; row-ID probing must not disclose existence | Direct access/probing tests; owner/ACL inspection |

No other privileged construct is implicitly approved. Phase 28 must generate the register from the catalog and fail on any unregistered definer, BYPASSRLS owner, postgres-owned function, or public execution grant.

## 22. Owner Decision Register

| ID | Topic | Recommendation | Alternatives | Primary risk | Security Critical? | Required Before Phase 28? | Required Before Production? | Owner Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D27-01 | Command owner | Dedicated narrow `NOLOGIN BYPASSRLS` owner | Postgres owner; weaken forced RLS; helper-only bypass | Privilege escalation/blast radius | Yes | Yes | Yes | FROZEN |
| D27-02 | Auth bridge owners | Two invoker helpers; one bounded postgres-owned live-AAL2 bridge | Keep all three; redesign all through external service | Reserved Auth access / claim trust | Yes | Yes | Yes | FROZEN |
| D27-03 | Security-invoker grants | Exact column grants; no candidate/raw-table grants | Broad table grants; definer views | Raw private data exposure | Yes | Yes | Yes | FROZEN |
| D27-04 | Runtime coverage | Exhaustive static + branch-complete representative runtime | Every permutation; representative only | Untested special-case behavior | Yes | Yes | Yes | FROZEN |
| D27-05 | Pilot sector | Municipal public works | Utility; school district; defer | Commercial/support mismatch | No | No | Yes | OWNER_APPROVAL_REQUIRED |
| D27-06 | Initial capabilities | Condition, planned work, official notice | Add hazard/road closure; smaller set | Overbroad public authority | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-07 | Retention schedule | Proposed 1/2/3/7-year class schedule | Different legal schedule; no production data | Privacy, records, evidentiary duties | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-08 | User deletion | Revoke access, erase profile, retain pseudonymous immutable evidence | Raw UUID; hard delete; identity vault by default | Privacy vs audit integrity | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-09 | Ownership step-up | Fresh TOTP within 10 minutes for each actor | Session AAL2; other threshold | Account takeover / stale assurance | Yes | Yes | Yes | FROZEN |
| D27-10 | Recovery step-up | Fresh TOTP within 5 minutes + case confirmation for each approver | Live AAL2 only; other threshold | Tenant takeover | Yes | Yes | Yes | FROZEN |
| D27-11 | Invitation expiry | 7 days | 24h; 72h; 14d | Token exposure vs onboarding failure | Yes | Yes | Yes | FROZEN |
| D27-12 | Invitation delivery | Approved email + controlled one-time manual fallback | Email only; manual only | Token leakage/provider risk | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-13 | Verification renewal | Annual; 6-month public-capability attestation; event review | Event-only; other interval | Stale identity evidence | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-14 | Capability renewal | 90-day pilot; later 6/12-month maximums; no auto-renew | Permanent/manual revoke; other interval | Stale publication authority | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-15 | Non-county datasets | Private declaration only; research/approve authoritative public sources per type | Enable self-asserted public scopes; defer all | False authority/geographic mismatch | Yes | Yes for enabled pilot scope | Yes | FROZEN |
| D27-16 | Projection removal SLA | Immediate server, <1m target, <5m hard online/offline TTL | Next refresh; no-store only | Stale safety information | Yes | Yes before Consumer package work | Yes | OWNER_APPROVAL_REQUIRED |
| D27-17 | Recovery staffing | Three trained admins; two distinct available; no bypass | Two admins; remove recovery | Unavailable or collusive recovery | Yes | Yes | Yes | OWNER_APPROVAL_REQUIRED |
| D27-18 | Compatibility mode | No live wrapper if absent/empty; migration-only plan if populated/referenced | Permanent wrapper; unconditional none | Collision/data loss/legacy bypass | Yes | Yes | Yes | FROZEN |
| D27-19 | Provider expansion | Email/password only for MVP | Social/enterprise providers | Identity-link/recovery expansion | No | No | No | DEFERRED_POST_MVP |
| D27-20 | Lower-assurance viewer/custom roles | Keep TOTP and fixed roles | AAL1 viewer; custom roles | Authorization/test expansion | Yes | No | No | DEFERRED_POST_MVP |

## 23. Production Readiness Delta

| Classification | Remaining delta |
| --- | --- |
| CLOSED | Neutral contract, tenant model, live-auth predicate shape, command envelope, forced RLS strategy, owner model recommendation, Auth bridge minimization, view-grant rule, runtime test standard, step-up thresholds, invitation expiry, scope-source rule, and compatibility decision algorithm |
| NEEDS OWNER APPROVAL | Pilot/capabilities; retention; deletion/pseudonymization; delivery provider/origin; verification/capability renewal; consumer cache SLA; recovery staffing |
| NEEDS PRODUCTION READ-ONLY VERIFICATION | Exact project/environment, roles/versions/extensions, existing schemas/functions/grants/policies, responder state/dependencies, Data API settings, Auth catalog/function compatibility, production migration head, Consumer/reporting baseline, backup/restore evidence |
| NEEDS IMPLEMENTATION | Phase 28 hardened inert package: exact grants, helper ownership redesign, fresh-step-up enforcement, retention/disposition jobs only after policy approval, delivery integration only after provider approval, monitors/tests/manifests/rollback and operator runbook |
| BLOCKED | Any unapproved security-critical row; broad underlying grants; more than one necessary postgres-owned Auth bridge; unknown compatibility state; missing restorable backup; missing two-person staffing if recovery is enabled; any production drift from signed manifest |

No deployment readiness is asserted.

## 24. Phase 28 Entrance Criteria

Phase 28 guarded production-package preparation may begin only when all of the following are recorded:

1. every security-critical decision register row is `FROZEN` or has explicit dated owner approval of the recommended alternative;
2. owner approval exists for D27-06 through D27-08 and D27-12 through D27-14, plus D27-17; D27-16 is required before any Consumer integration package work;
3. the selected pilot sector and capabilities are written as bounded scope, with no external commitment implied by code;
4. legal/privacy review accepts or replaces every retention duration and the deletion/pseudonymization procedure;
5. the invitation sender, exact HTTPS origin, redirect allowlist, and token-handling controls are approved;
6. a fresh production read-only inventory selects the compatibility path and proves the expected head/settings without mutation;
7. the Phase 28 design explicitly removes broad underlying grants and implements the one-bridge Auth-owner rule;
8. production Auth/Postgres/Supabase versions and 2026 breaking changes are checked against the package;
9. backup restorability, rollback/refusal modes, named operators/reviewers, monitoring, incident containment, and change window requirements are documented;
10. Consumer Gridly, reporting, public site, native apps, and production remain outside Phase 28 unless separately authorized.

Approval to begin Phase 28 is not approval to connect to, migrate, or deploy production. Any unmet criterion is NO-GO.

## 25. Consumer Protection Confirmation

Consumer Gridly remains anonymous/login-free and independent. Its reporting flow, data, public application, service worker, storage, and deployment are unchanged. Dispatch Auth, cookies, storage, CSP/CORS, assets, Data API schema, private tables, commands, and service worker (if any) remain separately scoped. Android and iOS are unchanged. Consumer reads may eventually receive only approved sanitized public projections through a separately authorized integration; they never read Dispatch-private tables or invoke Dispatch commands.

## 26. Gridly Public Website Follow-Up Note

After the Phase 27 owner/security review, the owner intends to return to the `gridlygo.com` public-website track for a live visual/functional review and any remaining fixes before further Dispatch implementation proceeds. This is a scheduling note only. Phase 27 makes no public-site change and authorizes none.

## 27. Exact Next Branch Recommendation

After all Phase 28 entrance criteria are met, create:

`RESPONDER-PHASE28-dispatch-guarded-production-package-preparation`

Phase 28 should manufacture a hardened, inert, production-targeted package and verification plan only under its own explicit authorization. Do not deploy, connect mutably to production, or carry forward a rehearsal-only exception that conflicts with this closure.
