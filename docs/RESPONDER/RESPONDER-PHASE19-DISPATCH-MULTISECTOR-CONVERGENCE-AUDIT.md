# Responder Phase 19 — Dispatch multi-sector convergence audit

Recorded: 2026-09-18

Branch: `RESPONDER-PHASE19-dispatch-multisector-convergence-audit`

Starting HEAD: `4c522a78e8c765eb433fef8fbde5f339645bbdc3`

Scope: architecture audit and target design only

Decision: **READY FOR OWNER ARCHITECTURE REVIEW**

This audit reconstructs the authoritative Responder Phase 0–18 work and defines how it can evolve into Gridly Dispatch without weakening tenant isolation, auditability, source governance, or consumer privacy. It does not authorize or implement schema changes, migrations, Auth configuration, RLS changes, application code, Data API exposure, deployment, publishing, or consumer changes.

Evidence reviewed includes the Phase 0 contract suite, every Phase 1–18 document (including all Phase 14 variants and Phase 15A), the responder reports, the local fixture SQL, the Phase 16/17 production candidate and rollback/preflight/postflight package, the generated migration, and the Phase 18 clone-rehearsal record. Machine-readable evidence was used to cross-check prose claims. The Phase 18 migration remains rehearsed but not deployed.

## 1. Executive Summary

Responder is not a throwaway prototype. It contains a reusable security and operations kernel:

- immutable Supabase Auth UUID identity with a production-proven live TOTP/AAL2 predicate;
- private organization-scoped storage with deny-by-default RLS and no direct client mutations;
- current database membership/role checks rather than stale JWT authorization claims;
- server-authoritative command RPCs with bounded inputs/results, optimistic revision control, atomic events, and replay receipts;
- separate platform governance, append-only evidence, suspension/revocation controls, and fail-closed behavior;
- certified shared county geometry and strict spatial authorization;
- a private-to-public projection boundary with exact allowlists and current-state eligibility checks;
- deterministic migration, rollback-refusal, Data API, security, and production-shaped clone evidence.

The architecture is not yet a general Dispatch model. Although the Phase 16/17 candidate already names its tenant table `organizations`, it still enforces one active organization per user, fixed responder roles, county-only authority, five public-awareness condition types, an `AGENCY_OFFICIAL` source, a publication-centric lifecycle, universal TOTP for all dashboard access, and agency-specific API/schema vocabulary. It lacks neutral organization typing, multiple concurrent memberships, explicit active-organization context, a composable operational-scope model, permission identifiers independent of roles, organization-private work assignment/status/comment models, ownership transfer, and sector-neutral verification.

The recommended evolution is therefore:

1. **Keep** the security kernel and the shared governed data foundations.
2. **Generalize** tenant, membership, roles, scopes, source identity, controls, and private operational records through a new contract before touching SQL.
3. **Wrap/adapt** proven responder commands and the consumer projection as one public-awareness capability within Dispatch.
4. **Supersede** the one-active-org, county-as-universal-authority, fixed agency-role, and universal-agency-publication assumptions.
5. **Retire** only fixture-only identity/session machinery and public-safety labels that have no neutral semantic value; preserve historical responder evidence and do not rewrite it.

The target identity chain is `User → Organization → Membership → Role template → Permissions`, with an explicit session-scoped active organization and zero or more versioned operational scopes. Organization type may drive defaults, verification, feature flags, workflow availability, and presentation, but never tenancy isolation. County remains an important shared geographic primitive and a governed public-projection scope; it is not the universal tenant boundary.

The recommended application surface is `dispatch.gridlygo.com`, independently deployed from Consumer Gridly. Consumer Gridly remains anonymous/public and receives only governed projections. The smallest useful Dispatch MVP is four workflows: sign in/select organization, view an operational awareness map, create/manage private organization records, and deliberately publish eligible awareness through a governed review/projection step. Activity history is part of those workflows, not a fifth operational system.

## 2. Phase 0–18 Architecture Reconstruction

| Phase | Authoritative contribution | Current standing for Dispatch |
| --- | --- | --- |
| 0 | Frozen agency contract: identity, roles, lifecycle, command vocabulary, county authority, source separation, projection allowlist, owner decisions, and 54 vectors. | Historical behavioral baseline; preserve evidence, generalize domain language. |
| 1 | Ten-table private `agency_private` fixture, immutable evidence, independent publishing control, and no client writes. | Proven private-domain pattern; later production design supersedes exact table layout. |
| 2 | Synthetic Auth mapping, membership/invite lifecycle, one-active-org rule, role changes, suspension/revocation, and recovery fixture. | Membership controls are reusable; synthetic identity machinery is fixture-only. |
| 3 | Certified 254-county catalog and strict `ST_Contains`/edge-denial authority checks. | County capability is reusable as one scope provider, not universal tenancy. |
| 4 | FORCE RLS, own-org reads, safe invoker views, cross-org/direct-write negatives, and platform/organization separation. | Core tenant-isolation pattern is authoritative and must not be weakened. |
| 5 | Atomic update command, bounded statuses, replay receipts, revisions, lifecycle events, review, expiry, and two-person road closure. | Command kernel is reusable; update vocabulary/workflow is a public-awareness capability. |
| 6 | Verification/governance command, separate governance receipts, org suspension/reinstatement, authority approval/revocation, and atomic withdrawal. | Platform-governance separation and evidence are reusable; agency verification semantics need tiers. |
| 7 | Organization-scoped 60/60-minute successful-activation limit and exact 18-field consumer projection. | Rate/projection mechanisms are reusable by capability; fixed policy and agency labels are not global Dispatch defaults. |
| 8 | Bounded dashboard read contract: queue, map, inspector, roster, authority, invites, and UI affordances as hints only. | Read-model discipline is reusable; dashboard content must become capability-driven. |
| 9 | Production-readiness threat model, rollout/rollback layers, blockers, backups, legal/retention, hosting, and incident controls. | Operational safety baseline remains relevant; several original blockers were later closed. |
| 10 | Chose the shared Gridly county geometry lineage, while keeping responder edge semantics separate from consumer resolution. | Authoritative shared-data reuse decision. |
| 11 | Defined production Auth/MFA mapping and live-state authorization requirements. | Superseded in detail by Phase 15/15A/16; conceptual separation remains valid. |
| 12 | Read-only production catalog inventory: no responder objects, community-domain separation, compatible but empty county table, no exact name collisions. | Authoritative snapshot for the later migration design; do not infer current deployment from it. |
| 13 | Deterministic county population payload, atomic load/no-op policy, validation, recovery, and runbook. | Historical preparation evidence for the shared county source. |
| 14A–14D | Repaired transaction ownership, established recovery checkpoint, stopped safely on connector limits, and certified psql file streaming. | Strong production-change discipline and failure evidence. |
| 14E | Populated and independently certified all 254 production county rows; closed B03/P12-01. | Shared county data is production-certified; no Dispatch authority follows automatically. |
| 15 | Production Auth catalog/capability audit and preliminary live-state predicate. | Superseded where Phase 15A provides behavioral proof. |
| 15A | Proved TOTP enrollment/challenge, AAL2, stale-token behavior, logout/session removal, factor removal/downgrade, and selected the live-session/factor/AMR predicate. | Authoritative Auth/MFA evidence; implementation requirements remain. Temporary test-user cleanup was recorded as pending owner execution. |
| 16 | Production candidate: 13 private tables, public projection, live Auth helpers, FORCE RLS, three commands, replay, audit, rate, county authority, and rollback guard. | Strongest concrete responder database design; not deployed and still sector-biased. |
| 17 | Deterministic migration/preflight/postflight/rollback package and future deployment runbook. | Migration-safety authority; deployment stayed unauthorized. |
| 18 | Exact PostgreSQL 17.6/PostGIS 3.3.7 production-shaped clone rehearsal; CLI migration, Data API, PostgREST, advisors, rollback, refusal, and deterministic reapply passed. | Highest-confidence non-production evidence; not proof of current production state or approval to deploy. |

The Phase 18 package reports 38/38 behavioral security vectors, 22/22 database security checks, 13/13 dirty fail-closed cases, 20/20 migration checks, zero advisor errors/warnings, and identical catalog fingerprints after reapply. Those results validate the responder candidate as a reference implementation, not as the final Dispatch schema.

## 3. Existing Schema Assessment

The production candidate has a sound separation between `agency_private` and `responder_public`. Its current-state tables, immutable revision/evidence tables, replay domain, and public projection are deliberately distinct. Current actor state may cascade with Auth deletion only in `principals`; immutable historical UUID evidence does not, preserving accountability.

The schema is partly neutral already:

- `organizations`, `organization_memberships`, `principals`, and `governance_events` use reusable concepts.
- `organization_id` is the consistent tenant key.
- membership and organization state are normalized rather than embedded in JWT metadata.
- append-only revisions/events separate identity from mutable current pointers.

The exact candidate is not a general Dispatch schema:

- `organizations` has no organization type or sector-neutral verification profile.
- the membership role enum is `VIEWER/RESPONDER/SUPERVISOR/AGENCY_ADMIN`.
- one partial unique index permits only one active organization per user.
- `(organization_id,user_id)` is unique across all membership history, preventing a clean rejoin-as-new-membership model.
- authority is only `organization_county_authorities`.
- `agency_updates`, `agency_update_revisions`, `AGENCY_OFFICIAL`, the five condition types, and the fixed projection are public-awareness specific.
- there is no neutral private work record, assignment, internal status, internal comment, facility, service territory, corridor, route, or statewide scope relation.
- organization ownership and ownership transfer are not represented.

Conclusion: preserve the schema principles and evidence; do not deploy the responder migration and rename it in place. Phase 20 should freeze a neutral logical contract first, then a later phase should produce a superseding Dispatch migration design with an explicit compatibility path for responder objects.

## 4. Existing Auth/MFA Assessment

Production-capable and evidenced:

- immutable user identity is `auth.users.id`, never email;
- actor identity is derived from `auth.uid()` and signed subject agreement;
- the signed `session_id` must map to a live same-user `auth.sessions` row;
- privileged operations require live `aal2`, a live same-user verified TOTP factor, live TOTP AMR evidence, and signed/live consistency;
- a private active principal is an immediate application eligibility kill switch;
- current membership, role, organization, scope, gate, and command rules are read live;
- optional `minimum_iat` is defense in depth, not a substitute for live checks;
- service-role/Auth administration remains server/operator-only.

Phase 15A proved that stale JWTs can outlive logout or factor changes for some stateless API behavior. Therefore JWT `aal`, `amr`, `app_metadata`, or UI state cannot be the authorization source. Phase 16 correctly encodes the full live predicate in a narrowly owned private definer.

Architecture-only or operationally incomplete:

- no Dispatch browser sign-in, enrollment, recovery, or organization selection UX exists;
- provider configuration, password/session policy, recovery SOP, outbound invitation delivery, monitoring, and temporary Phase 15A identity cleanup/zero-state evidence are outside the completed database design;
- Microsoft, Google, and email/password sign-in are not product-approved integrations.

Dispatch recommendation: support provider-neutral Auth identities later, but do not make the login provider an authorization dimension. Email/password, Microsoft, or Google may authenticate the same immutable user. Linking, verified-domain hints, and provider claims must never auto-create membership, role, verification, or operational scope. Require MFA by privilege and risk, not by organization type alone:

- mandatory fresh TOTP-equivalent strong assurance for platform administration, organization administration, membership/ownership changes, public projection approval, sensitive scope changes, and high-impact commands;
- initially preserve the proven exact TOTP predicate for every Dispatch authenticated surface until Phase 20 explicitly approves a lower-risk viewer policy;
- organization type may raise requirements, never lower a permission's required assurance.

## 5. Existing Membership Assessment

Already present:

- invite, redeem, role change, suspension, reactivation, revocation, and invite revocation actions;
- live state checks on every protected operation;
- one-active-org enforcement;
- last-admin protection and no self-promotion;
- separate platform administrator grants;
- bounded invitation state with digest-only token storage and single use;
- historical evidence and immediate future-command denial after suspension/revocation.

Missing for Dispatch:

- multiple simultaneous organization memberships;
- a session-scoped active organization selection distinct from membership eligibility;
- per-membership permissions or role-template versioning;
- membership start/end reason and explicit offboarding workflow completion;
- ownership, ownership acceptance, and two-party ownership transfer;
- re-invitation/rejoin semantics compatible with preserved history;
- contractor/temporary membership expiry;
- cross-organization collaboration or delegated access;
- organization-level identity-provider/domain policy without domain-based autoauthorization.

Target rule: a user may have multiple active memberships, but every organization-scoped request must bind exactly one active organization context derived from an eligible membership. Switching context is explicit, auditable for sensitive operations, and never changes data tenancy. No query or command may infer “all my organizations” when one acting organization is required.

## 6. Existing RLS Assessment

Decision: **GENERALIZE, preserving the validated isolation pattern**.

Keep these invariants:

- every private/exposed table has RLS enabled; private tables remain outside exposed schemas;
- private tables use FORCE RLS where compatible with the reviewed owner/function model;
- browser roles receive no direct private INSERT/UPDATE/DELETE grants or policies;
- reads require `TO authenticated` plus current organization membership/permission predicates;
- functions derive the actor and acting organization server-side;
- private definers use empty search paths, fully qualified objects, narrowly reviewed owners, revoked default execution, no caller-controlled SQL, and minimal grants;
- public projections recheck current eligibility and expose no private table;
- real-role tests cover cross-org reads/writes, suspended/revoked membership, stale Auth, malformed claims, function ownership, and service-role posture.

Change the policy input from “the one active membership” to “the explicitly selected active organization context backed by a live membership.” Permissions, not role-name comparisons scattered across policies, should answer whether a capability is allowed. Role templates remain the source of permission grants for MVP. Client-side hiding remains only an affordance.

No evidence supports weakening isolation. The Phase 18 pass is a floor for the future Dispatch security suite: every generalized policy needs equivalent or stronger cross-tenant, direct-write, wrapper, definer, and dirty-install tests.

## 7. Existing Command/RPC Assessment

| Existing command/action | Classification | Dispatch disposition |
| --- | --- | --- |
| Shared envelope, operation token, bounded JSON, status vocabulary, server actor derivation, revision and atomic event/receipt | Generic organizational operation | **KEEP AS-IS conceptually**; use a neutral command protocol/version. |
| `invite_member`, `redeem_invite`, `change_member_role`, `suspend_member`, `reactivate_member`, `revoke_member`, `revoke_invite` | Generic membership with agency naming/one-org constraints | **GENERALIZE** to organization membership and permissions. |
| `start_verification_review`, `verify_organization`, `reject_organization`, `revoke_organization_verification`, `suspend_organization`, `reinstate_organization`, publishing-gate change | Generic platform governance mixed with publication | **WRAP / ADAPT** into platform organization, verification, and capability controls. |
| `approve_authority`, `revoke_authority`, `activate_organization` | County-authority/public-safety specific | **SUPERSEDE** with versioned operational-scope grants plus capability-specific public authority. |
| `create_draft`, draft edits, submit/return, activate/edit/renew/resolve/withdraw | Public-awareness workflow, reusable beyond responders but not all Dispatch work | **WRAP / ADAPT** as an `awareness_record` capability. |
| `activate_road_closed` distinct-author check | High-impact public-safety safeguard | **KEEP** for road closures; express as capability/action policy, not global Dispatch behavior. |
| 60 successful activations/60 minutes | Publication abuse control | **WRAP / ADAPT** as a configurable policy for public-awareness activation, not all operations. |
| Agency governance denial shim | Fixture/dashboard integration detail | **RETIRE** when neutral routing returns bounded permission denial directly. |

Recommended future namespace: versioned neutral logical families such as `dispatch.organization_command`, `dispatch.membership_command`, `dispatch.scope_command`, `dispatch.record_command`, and `dispatch.projection_command`. This is a contract recommendation, not an instruction to rename current RPCs. Preserve idempotency and bounded responses. Never put authorization-bearing `actor_user_id`, `role`, `permission`, `organization_id` without context validation, or scope grants under caller control.

## 8. Existing County Authority Assessment

County authority currently combines four concerns:

1. a shared canonical geographic dataset;
2. an organization operational scope grant;
3. source/publication governance for agency-authored awareness;
4. a county-first public-safety product assumption.

Only the first is universally reusable. The second and third remain valid for organizations whose capability is county-governed public awareness. The fourth must not define Dispatch tenancy.

County is therefore **not fundamental tenancy**. The tenant is organization membership. County is a scope kind and a shared geographic primitive. Existing strict geometry, immutable version binding, provenance, edge denial, grant/revocation evidence, and revalidation are authoritative for `COUNTY` scopes.

The generalized scope model is a versioned `operational_scope` owned or granted to an organization, with:

- `scope_kind`: `county`, `multi_county`, `statewide`, `service_territory`, `corridor`, `route`, `facility`, `site`, or `none/non_geographic`;
- a canonical governed reference or immutable geometry/version, not arbitrary client geometry;
- purpose/capability binding, because permission to operate privately is not automatically permission to publish publicly;
- effective interval, status, provenance, approving actor, evidence reference, and revocation history;
- explicit overlap and boundary semantics per scope kind;
- zero or more scopes per organization and optional hierarchy/composition;
- fail-closed handling for stale, missing, invalid, or ambiguous versions.

`statewide` should be an explicit governed scope, not 254 implicit grants. `multi_county` should reference a governed set/version. Corridors/routes need linear geometry and distance/segment semantics. Facilities/sites need canonical place/facility identity plus governed polygon/point rules. Organizations with no governmental authority may use private operational scopes but cannot thereby claim official public authority.

## 9. Existing Consumer Projection Assessment

The current architecture already supports the essential pattern:

`private record → reviewed current revision → governed projection row → public read`

It is strong because the public table contains an exact field allowlist, terminal commands remove the row, RLS rechecks current eligibility, expiry is derived, authority/organization/gate state is live, and employee/reviewer/audit/receipt fields never cross the boundary. The projection is distinct from community reports and other official sources.

Decision: **WRAP / ADAPT**. Preserve the mechanism and privacy protections. Replace the single assumed `AGENCY_OFFICIAL` product with capability-specific source/projection policy. Not every Dispatch record is projection-eligible; private is the default. A public projection requires an explicit projection policy, permission, review state, verified source identity, allowed fields, active scope, expiry/removal behavior, and consumer channel approval.

Consumer Gridly must not query Dispatch private tables, use Dispatch membership, require login, or inherit a service worker/session from Dispatch. No organization-internal field becomes public through CSS hiding, client filtering, or an empty value.

## 10. Existing Source Governance Assessment

Existing source separation is a major asset. Community, DriveTexas, NWS/weather, crossings, Gridly system messages, and `AGENCY_OFFICIAL` retain separate identity, lifecycle, timestamp, and attribution. Spatial proximity does not silently become corroboration, deduplication, or overwrite.

Target organization-authored provenance should carry:

- stable organization ID and approved public display identity where projection is allowed;
- private author UUID and acting membership ID;
- source class (`organization`, `official_public`, `community`, `private_operational`, or another governed class);
- source subtype/capability rather than an overloaded organization type;
- record and immutable revision IDs;
- authored/observed/updated timestamps with defined semantics;
- operational scope ID/version and source-data version;
- verification level and verification decision version;
- visibility (`private`, `organization`, `shared_contract`, `projection_candidate`, `public`);
- review/approval lineage and current projection eligibility;
- expiry/withdrawal status and reason privately;
- consumer-safe attribution generated from an allowlist, never from private evidence.

An organization record must remain organization-authored even if it is near or consistent with an official or community record. Any future corroboration claim requires a separately governed matching rule.

## 11. Public-Safety-Specific Assumptions

- “agency” is treated as the universal organization class.
- “responder” is both a product persona and a role.
- every user is limited to one active organization.
- every dashboard user requires TOTP/AAL2 regardless of the operation's sensitivity.
- all organizations progress through one agency verification workflow.
- operation activation depends on verified status, a current county authority, and an initial Agency Admin.
- authority is county-only and defined through Texas FIPS/polygons.
- only five road/weather/public-works condition types exist.
- the central business record is a publicly activatable awareness update, not a private operational record.
- Supervisor review is universal before public activation; road closures require two actors.
- `AGENCY_OFFICIAL`, “Verified Agency,” and “Agency update” are fixed public semantics.
- the fixed 12-hour default/24-hour maximum expiry fits alerts, not general work.
- the 60/60-minute rate limit applies to agency activations, not general commands.
- organization suspension and authority revocation withdraw all active public posts.
- municipality/district scopes are treated mainly as future public authority, not ordinary tenant operating areas.
- the dashboard is organized around incident/update queue, map, and inspector.
- county FIPS is the dashboard's jurisdiction label.
- platform verification assumes independent government/agency contact procedures.
- the proposed host name was `responders.gridlygo.com`.

These assumptions are valid for the responder public-awareness capability but cannot define all of Dispatch.

## 12. Multi-Sector Gaps

- Neutral organization type, subtype, lifecycle, and feature/capability enrollment.
- Concurrent memberships and explicit active organization selection.
- Fixed neutral role templates backed by stable permission identifiers.
- Ownership and two-party ownership transfer.
- Temporary/contractor membership expiry and complete offboarding state.
- Non-geographic, multi-county, statewide, territory, corridor/route, facility, and site scopes.
- Separation between private operating scope and public authority scope.
- Private operational records with assignments, internal statuses, notes, contacts, and timestamps.
- Sector/capability-specific workflows without an unlimited workflow builder.
- Verification tiers and evidence policies suitable for private business, public entity, and delegated authority.
- Organization-level controls and feature flags independent of type.
- Neutral source identity and visibility policy.
- Per-capability MFA, review, expiry, rate-limit, and projection policies.
- Shared-data contracts for PLACE, county, crossing, roadway, weather, POI, and community context.
- Platform support/recovery/ownership-dispute tools with bounded impersonation-free access.
- Independent Dispatch frontend/session/cache/deployment boundary.
- Retention/legal schedules for general workforce and private operations data.
- Migration compatibility plan that does not strand or silently reinterpret responder history.

## 13. Keep / Generalize / Adapt / Supersede Matrix

| Existing Component | Current Meaning | Sector Bias | Reuse Decision | Target Dispatch Meaning | Required Change | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `agency` / `organizations` | Verified county-level publishing organization | Agency/public safety | GENERALIZE | Tenant organization of any supported type | Add neutral type/profile/capabilities; retain stable IDs | Renaming without semantic migration can misclassify history |
| Agency membership | One active org/user; invite and four agency roles | Agency and single-org | SUPERSEDE | Multiple memberships plus explicit active org context | Remove one-active-org invariant in future design; preserve live checks/history | Cross-tenant leakage if context is ambiguous |
| Roles | VIEWER, RESPONDER, SUPERVISOR, AGENCY_ADMIN | Public safety | GENERALIZE | Fixed templates: owner, organization_admin, supervisor, operator, viewer | Map templates to permissions; define responder compatibility aliases | Role-name checks can drift across policies/RPCs |
| Permissions | Encoded inside role checks/actions | Workflow-specific | GENERALIZE | Stable permission IDs enforced server-side | Introduce a bounded permission catalog and template mapping | Unlimited custom RBAC would add untestable complexity |
| County authority | Current approved org/county publication grant | County/public authority | WRAP / ADAPT | One versioned operational/public-authority scope kind | Add general scopes and capability binding; keep strict county semantics | Conflating operating area with official authority |
| Commands | Three agency/membership/governance RPC families | Agency/publication | WRAP / ADAPT | Neutral versioned organization, membership, scope, record, projection commands | Preserve envelope/replay/atomicity; generalize action contracts | A mega-RPC can become opaque and overprivileged |
| RLS | Own active agency org, live Auth, role-based reads, no direct writes | Low; one-org coupling | GENERALIZE | Active-organization tenant isolation plus permissions | Context-safe org selection and equivalent negative tests | Highest-risk area; do not weaken or rely on UI |
| MFA | Exact live TOTP/AAL2 for all responder surfaces | Risk posture, not sector | WRAP / ADAPT | Assurance policy by privilege/action, with strong floor for sensitive operations | Keep proven predicate; decide low-risk viewer policy separately | Relaxation without action classification can expose private data |
| Audit log | Immutable revisions/events/governance evidence and UUID actors | Low | KEEP AS-IS conceptually | Append-only organization/platform audit domains | Add membership/scope/record types and retention policy | Auth deletion/retention conflicts must preserve accountability |
| Source governance | `AGENCY_OFFICIAL` separated from other families | Agency label | GENERALIZE | Organization/public/community/private source classes with immutable provenance | Add visibility and verification-version fields | False corroboration or misleading official labels |
| Consumer projection | Exact 18 fields, current eligibility, privacy denylist | Agency awareness | WRAP / ADAPT | Optional capability-owned public projection | Policy/versioned allowlists per record type; private default | Accidental private field or stale-cache exposure |
| Private records | Agency update current pointer + immutable revisions | Incident/publication | SUPERSEDE | General private operational records plus optional awareness subtype | Define record/assignment/status/comment boundaries before schema | A generic entity blob would defeat constraints/auditability |
| Rate limits | 60 successful activations/org/60 min | Publication-specific | WRAP / ADAPT | Per-command/capability abuse and safety policy | Keep transactional successful-activation limiter for awareness | Applying globally can block safety/offboarding actions |
| Dashboard contract | Queue/map/inspector for agency updates | Incident operations | WRAP / ADAPT | Capability-driven operational workspace | Preserve bounded read models; add org switcher/private work views | One universal dashboard may become sector-specific clutter |
| Auth principal | Live Auth/session/factor/AMR plus active private principal | Low | KEEP AS-IS | User security eligibility independent of membership | Rename only through planned compatibility; add provider-neutral UX | Managed Auth drift and stale token behavior |
| Gridly Admin | Separate UUID grant; no agency impersonation | Low | KEEP AS-IS conceptually | Platform admin with bounded support/governance permissions | Split platform permissions and require case-bound support access | Highest-impact compromise domain |
| Publishing gate | Per-org `agency_publishing_enabled`, default false | Agency publication | GENERALIZE | Capability/channel controls default off | Replace one global meaning with explicit capability gates | Gate ambiguity can unintentionally expose records |
| Two-person closure | Author cannot approve own road closure | Public-safety/high impact | KEEP AS-IS for capability | Action-level separation-of-duties policy | Keep for road closure; allow other actions to define policy | Overgeneralization creates unnecessary operational friction |
| Fixture identities/session bindings | Synthetic local Auth and PostgreSQL login mapping | Test-only | RETIRE | None in production | Preserve test history; never ship | Accidental deployment would permit spoofed identity |
| Responder migration package | Rehearsed agency schema and API | Agency contract | SUPERSEDE before deployment | Reference implementation/evidence for Dispatch migration | Do not deploy then rename; design neutral contract first | Deploying now creates avoidable compatibility debt |

## 14. Target Dispatch Product Boundary

Gridly Dispatch is the authenticated organizational operations product. It owns organization membership, permissions, private operational data, operational scopes, controlled organization-authored awareness, and auditable actions.

Consumer Gridly is the public awareness product. It owns anonymous/public presentation and consumer-safe source-separated awareness. It does not authenticate Dispatch users, expose private organization records, or become an employee operations surface.

Shared governed data is neither application's tenant data. It is accessed through versioned contracts and source-specific rules. Dispatch can use public/community context for awareness without copying its lifecycle or claiming authority over it. Consumer can receive a Dispatch projection without access to Dispatch tenancy.

Dispatch is not CAD, 911 call-taking, records management, workforce scheduling, fleet telematics, navigation, or incident command software. Integrations with such systems, if ever approved, are sources/adapters rather than a license to recreate them.

## 15. Target Identity Model

```text
AUTH USER
    ↓
PROFILE
    ↓
ORGANIZATION MEMBERSHIP
    ↓
ROLE TEMPLATE / PERMISSIONS
    ↓
ACTIVE ORGANIZATION (session/request context)
    ↓
OPERATIONAL SCOPE
    ↓
DISPATCH PRIVATE DATA
    ↓
GOVERNED SOURCE / PROVENANCE
    ↓
OPTIONAL CONSUMER PROJECTION
    ↓
PUBLIC GRIDLY AWARENESS

SHARED GOVERNED DATA
    ├──→ PLACE
    ├──→ COUNTY
    ├──→ CROSSINGS
    ├──→ DRIVETEXAS
    ├──→ WEATHER
    └──→ POI
```

The Auth user is global. Profile is non-authoritative presentation/contact data. Membership binds the user to an organization. A fixed role template grants a bounded permission set. The active organization is an explicit acting context, not a global user property and not caller authority by itself. Scope further constrains an allowed operation. Every command re-derives all of these from live server state.

## 16. Target Organization Model

The organization is the tenant. Recommended initial types are `fire`, `ems`, `law_enforcement`, `emergency_management`, `utility`, `fleet`, `trucking`, `municipality`, `school_district`, `contractor`, `private_company`, `industrial`, `transportation`, `infrastructure`, and `other`.

Organization type may influence:

- default role-template assignments and recommended permissions;
- available workflow/capability templates;
- verification evidence and review level;
- source labels and trust presentation;
- feature flags and onboarding copy;
- default retention proposals, subject to approved policy.

Organization type must not influence:

- the tenant key or RLS boundary;
- whether a user may read another tenant;
- implicit public authority;
- automatic verification;
- automatic scope grants;
- hard-coded authentication bypasses.

Use explicit capability enrollment and verification/scope decisions. A utility and a school district can share the same tenancy machinery while receiving different capabilities and public-source labels.

## 17. Target Membership Model

A membership is a versioned relationship between one user and one organization. Users may hold multiple active memberships. Each membership has status, role template, optional expiry, join/invite evidence, and offboarding metadata. Historical memberships remain durable; a rejoin should create or deliberately reactivate under a frozen rule rather than overwrite revoked history.

Required lifecycle: `invited → active → suspended/revoked/expired`, with reviewed reactivation where allowed. Add explicit ownership acceptance/transfer, prevent loss of the last owner and last organization admin, and require two-party or platform-mediated recovery for ownership disputes. Offboarding must disable future commands immediately, revoke or reconcile active sessions when warranted, remove assignments through explicit workflow rather than destructive deletion, and preserve authored history.

An active organization context contains `(user_id, membership_id, organization_id)` and is accepted only while all three remain current and eligible. It should not be stored in user-editable metadata. Requests that omit or mismatch context fail closed.

## 18. Target Role / Permission Model

Recommended MVP role templates:

| Template | Intent | Typical permissions |
| --- | --- | --- |
| `owner` | Legal/product control of one organization | Organization profile, ownership transfer, admins, capabilities, audit export; no platform powers |
| `organization_admin` | Day-to-day tenant administration | Membership, role assignment, configuration, scopes requested, full organization audit |
| `supervisor` | Operational review and oversight | Review/approve records, assignments, public-projection approval where granted, organization operational audit |
| `operator` | Create and maintain operational work | Create/update assigned or permitted records; submit projection candidates |
| `viewer` | Read-only awareness | Bounded private reads only |

Permissions should be stable identifiers such as `organization.read`, `membership.manage`, `record.create`, `record.assign`, `record.review`, `awareness.publish`, `scope.manage`, and `audit.read`. Role templates map to permissions. MVP should not offer arbitrary custom roles or arbitrary per-row ACLs. A bounded exception mechanism may follow only after real demand and security design.

`GRIDLY_ADMIN` becomes platform permissions such as `platform.organization.verify`, `platform.organization.suspend`, `platform.support.recover`, and `platform.audit.investigate`; it remains outside organization role inheritance. Sector-specific titles are presentation aliases only. Existing `RESPONDER` maps most closely to `operator`, `AGENCY_ADMIN` to `organization_admin`, and existing `VIEWER`/`SUPERVISOR` map directly in intent. Ownership is new.

## 19. Target Operational Scope Model

Separate three questions:

1. **Tenant:** which organization owns this record?
2. **Operating scope:** where or for what assets may the organization use a capability privately?
3. **Public authority:** where and under what verified claim may the organization publish to Consumer Gridly?

Model scope as immutable/versioned definitions plus organization grants. Scope checks are capability-specific and server-side. A fleet may privately operate on routes without governmental authority. A utility may have a service territory and separately approved public-awareness rights. A municipality may have a governed boundary. A contractor may be assigned to facilities or routes for a limited interval. `none/non_geographic` supports administrative records without inventing geography.

County reuse retains the certified table, strict containment, version binding, and edge denial for authority-sensitive commands. Other scope kinds need their own canonical data, topology rules, provenance, tests, and approval. No point proxy, string label, client polygon, proximity, or UI filter grants scope.

## 20. Target Source / Provenance Model

Use a source record/descriptor independent of the tenant row. Recommended top-level classes:

- `community_source` — public/community observations with their own consent and retention contract;
- `official_public_source` — government or authoritative external feeds such as DriveTexas/NWS;
- `organization_source` — attributable organization-authored material;
- `private_operational_source` — organization-private work/evidence never consumer-visible by default.

An organization's verification level and a record's source class are separate. A verified business can author an organization source without becoming a public authority. Projection policy decides the label and eligibility. Preserve canonical IDs, timestamps, versions, authorship privately, review lineage, scope binding, visibility, and withdrawal/expiry. Public attribution is generated from approved fields and the verification decision current at projection time.

## 21. Target Private Data Boundary

Organization-private by default:

- assignments, assignees, teams, dispatch ownership, and acceptance state;
- internal status, priority, queues, escalation, and SLA timestamps;
- staff notes, operational comments, attachments, and internal reasons;
- employee/auth identity, role, membership history, contact data, and presence;
- internal location detail when more precise than public-safe location;
- organization contacts, customer/vendor contacts, and facility access information;
- verification evidence, authority evidence, reviewer identity, support cases, and ownership disputes;
- command payloads beyond bounded audit fields, replay digests, session/factor evidence, and security telemetry;
- private creation/update/assignment/acknowledgement timestamps where not explicitly projected;
- records with no approved public-projection capability.

The responder schema already demonstrates the boundary for authors, reviewers, memberships, evidence, receipts, and private revisions, but it does not model assignments, staff notes, internal comments, or general operational statuses. Those require typed, constrained records rather than an unconstrained JSON “everything” table.

## 22. Target Consumer Projection Boundary

Projection is optional, explicit, and one-way:

```text
private Dispatch record
  → capability-specific eligibility
  → scope + verification + review + visibility checks
  → allowlisted projection revision
  → Consumer Gridly source adapter
  → public source-separated presentation
```

No projection is created merely because an organization or record is verified. Eligibility must include current organization operation, capability gate, source verification, public-authority scope where required, approved review lineage, allowlisted fields, current revision, expiry, and absence of holds. Gate disable, suspension, scope revocation, withdrawal, or expiry must hide/remove the public row and invalidate caches without deleting private history.

Preserve community privacy and identity contracts. Dispatch never writes community `public.reports`, community replay evidence, device links, or reporting controls. Consumer never displays employee identity, assignments, notes, audit evidence, contacts, or private timestamps.

## 23. Target Application Boundary

Dispatch should be a separate browser application with:

- its own build and deploy lifecycle;
- independent rollback and release gates;
- a strict CSP and security headers suitable for authenticated private data;
- private responses and APIs marked `no-store`;
- a service-worker scope that cannot intercept or cache Consumer Gridly and no consumer service worker controlling Dispatch;
- a dedicated Auth redirect allowlist and tested session storage/cookie posture;
- no secret/service-role credentials in client assets;
- organization context visible and explicit on every private screen;
- server-authoritative reads/commands; UI affordances remain hints.

Shared design primitives and map/data libraries may be packaged dependencies, but the public consumer shell should not host the authenticated operations runtime.

## 24. Target URL / Deployment Recommendation

Recommend **`dispatch.gridlygo.com`**, not `gridlygo.com/dispatch`.

The subdomain provides the clearest deployment, CSP, cache, service-worker, rollback, and incident-containment boundary. It reduces the chance that the public PWA caches private assets or that Dispatch changes destabilize Consumer Gridly. It also permits independent release cadence and branding while retaining the Gridly parent identity.

Session isolation needs deliberate configuration: prefer token storage scoped to the Dispatch origin and avoid broad parent-domain cookies. Cross-subdomain SSO convenience must not override isolation. Auth redirect URLs, CORS, cookie attributes, logout, browser persistence, and shared-workstation behavior require a staging test. A path deployment saves DNS/configuration work but materially couples service workers, CSP, caching, and rollback, so it is not recommended for private operational data.

No DNS, hosting, Auth redirect, cookie, or deployment change is authorized here.

## 25. Target Platform Admin Model

Platform administrators are individual Auth users with separate, live, least-privilege platform grants and strong MFA. They do not inherit organization roles and cannot impersonate organization publishers.

Required platform functions:

- review organization identity and verification level;
- suspend/reinstate organizations and capability gates;
- resolve ownership disputes and lost-admin recovery using independent evidence;
- investigate abuse and bounded audit history;
- revoke public projection eligibility or operational scopes under recorded cases;
- support account recovery without learning passwords/TOTP seeds or editing managed Auth tables directly;
- export bounded evidence under an approved legal/support process.

Sensitive actions require case ID/reason, immutable receipt/event, current platform permission, and separation of duties where impact warrants. Support access should be case-bound and time-bounded; “log in as customer” is not an MVP capability. At least two named operators and an independent recovery path remain an operational prerequisite.

## 26. Organization Verification Model

Recommended levels:

| Level | Meaning | Possible use |
| --- | --- | --- |
| `UNVERIFIED` | Self-asserted organization record | Private evaluation/onboarding only; no verified badge or authority claim |
| `VERIFIED_ORGANIZATION` | Legal/business identity established | Organization attribution and ordinary private operations |
| `VERIFIED_PUBLIC_ENTITY` | Government/public institution identity established | Public-entity presentation and eligible public workflows, subject to scope |
| `VERIFIED_AUTHORITY` | Specific authority/capability/scope independently established | Authority-bearing public projection for that capability and scope only |

Authority must not be a global top badge that implies all powers. It is a separate grant bound to capability, scope, evidence version, effective interval, and revocation. A private company, contractor, school, utility, or municipality can be a verified organization without having the same public authority. Verification level may affect feature defaults and public presentation, never tenant isolation.

## 27. Dispatch MVP

Limit the first broader MVP to four workflows:

1. **Sign in and select organization.** Strong Auth, membership bootstrap, explicit active organization, and bounded organization switcher.
2. **Operational awareness map.** Read shared governed context plus organization-private records allowed by scope and permission; source-separated display.
3. **Create and manage private operational records.** Bounded types, internal status, assignment, notes, revisions, and audit; no public projection by default.
4. **Create/manage organization-originated awareness.** Deliberate submit/review/publish/withdraw flow using the proven responder projection kernel, with current verification/scope/gate checks.

Activity/audit history is a bounded view within records and administration, not a separate workflow. Membership administration is necessary onboarding support but should not expand the operational MVP. Do not add CAD call-taking, dispatch optimization, fleet location streaming, payroll/scheduling, navigation, RMS, or incident-command features.

## 28. Explicit Non-Goals

- No production migration or responder migration deployment.
- No schema/RLS/RPC rename or implementation in Phase 19.
- No consumer login or consumer application change.
- No Android/iOS/public-site change.
- No Auth provider, SMTP, factor, redirect, or session configuration.
- No Data API exposed-schema change.
- No reporting or organization publishing activation.
- No DNS, hosting, deployment, push, or merge.
- No custom-role builder or arbitrary per-row ACL system.
- No CAD, 911 dispatch, records management, employee scheduling, telematics, navigation, or incident command.
- No claim that organization verification equals condition verification.
- No claim that county scope grants statewide, municipal, route, facility, or private-property authority.

## 29. Migration Safety Assessment

Ready and reusable for a future migration program:

- certified production county source and strict responder boundary evidence;
- production-observed Auth/MFA behavior and a concrete live-state predicate;
- deterministic preflight/migration/postflight/rollback-refusal patterns;
- exact-version PostgreSQL/PostGIS clone and PostgREST rehearsal method;
- explicit grant/RLS/definer audits, negative security suite, advisors, and catalog fingerprinting;
- false-by-default gates, zero-seed install, separate Data API exposure, and forward-recovery rules after evidence exists.

Not ready for a Dispatch production migration:

- the target neutral contract is not frozen;
- no compatibility mapping for deployed/future responder IDs, roles, events, receipts, or projection records exists;
- multi-org context and permission enforcement are not designed/tested;
- operational-scope tables and per-kind rules are not designed;
- private operational record categories/lifecycles are not frozen;
- organization verification tiers and ownership transfer are not frozen;
- retention/legal policy for broader private operations is unresolved;
- no Dispatch frontend/session/deployment package exists;
- production preflight, fresh recovery checkpoint, exact owner approval, Data API exposure, and post-deploy advisors remain future gates;
- repository evidence says the Phase 16/17 responder migration was not deployed; current production state must still be rechecked immediately before any later work.

Do not deploy the responder migration merely to “get started” and then rename it. That would harden the very single-org/county/agency assumptions this audit identifies. Treat the Phase 18 package as a tested reference and source of reusable SQL/security patterns.

## 30. Risks / Open Questions

1. What is the approved stable permission catalog for MVP, and which actions require step-up MFA?
2. Should viewer access retain mandatory TOTP at launch, or can a later risk-reviewed policy permit AAL1 for narrowly bounded reads?
3. How is active organization context conveyed and protected across browser sessions and RPCs without trusting client authority?
4. What is the membership rejoin rule, and how are historical revoked memberships retained?
5. What legal entity is “owner,” and what evidence/two-party process transfers ownership?
6. Which private operational record types and statuses are genuinely common across the first target sectors?
7. Which organization types and capabilities are in the first pilot? “All sectors” is a product direction, not a safe simultaneous launch scope.
8. Which scope kinds enter MVP, and what canonical datasets govern service territories, corridors/routes, and facilities?
9. Which scopes represent private operating areas versus verified public authority?
10. What verification evidence, renewal interval, and appeal/revocation process apply to each verification level?
11. What source labels are consumer-safe for verified businesses versus public entities versus verified authorities?
12. Which Dispatch fields have approved retention, export, deletion, legal-hold, and backup treatment?
13. How are stale public projection caches invalidated across CDN/service-worker/offline paths?
14. Does the pending Phase 15A temporary Auth identity cleanup now have certified zero-state evidence?
15. Which first sector/workflow validates the neutral model without pulling the product into CAD, telematics, or scheduling?
16. Are existing responder contracts retained indefinitely as `v1` compatibility or migrated once under a separately approved mapping?

## 31. Phase 20 Recommendation

Phase 20 should be a **neutral Dispatch contract freeze**, not an implementation phase. It should produce:

- a canonical vocabulary and compatibility map from responder concepts to Dispatch concepts;
- organization types, lifecycle, capability flags, and verification levels;
- multi-organization membership, active-context, ownership-transfer, and offboarding contracts;
- fixed role templates and a stable permission/action matrix;
- operational-scope types, capability binding, and private-versus-public authority rules;
- private operational record categories and minimum state machines;
- neutral command envelopes/namespaces while preserving replay and atomicity;
- source/provenance/visibility and consumer-projection contracts;
- RLS invariants and exhaustive positive/negative vectors, including cross-org context switching;
- a migration compatibility decision: adapt existing responder names behind contracts, create new neutral objects, or stage a versioned coexistence path;
- explicit owner decisions and entry criteria for a later schema-design phase.

Phase 20 must not create migrations, change production, configure Auth/providers, expose schemas, build the UI, or deploy. Its exit gate is owner approval of the neutral contract and test vectors.

## 32. Exact Next Branch

`RESPONDER-PHASE20-dispatch-neutral-contract-freeze`

This branch name keeps the proven responder lineage visible while making the next deliverable explicit: a Dispatch contract freeze, not a migration or runtime implementation.

## Final Verdict

**READY FOR OWNER ARCHITECTURE REVIEW**

The existing work is strong enough to serve as Dispatch's security and governance foundation, but the exact responder migration is too sector-specific to deploy as the neutral product core. Preserve its evidence, generalize deliberately, and freeze the neutral contract before implementation.
