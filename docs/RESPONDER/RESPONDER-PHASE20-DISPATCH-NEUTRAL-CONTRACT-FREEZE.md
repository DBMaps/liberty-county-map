# Gridly Dispatch v1 neutral contract freeze

Contract version: `gridly.dispatch.v1.phase20.1`

Recorded: 2026-09-18

Branch: `RESPONDER-PHASE20-dispatch-neutral-contract-freeze`

Authoritative baseline: Phase 19 commit `6fb1464bad5aaf147d66a8a57d61429ba65018c0`

Status: **FROZEN FOR OWNER CONTRACT REVIEW**

This document is the authoritative logical contract for Gridly Dispatch v1. It freezes vocabulary, security invariants, state models, permissions, command semantics, data boundaries, compatibility requirements, and the limit of the next phase. It does not create or authorize a schema, migration, RPC, runtime, Auth configuration, Data API exposure, consumer integration, deployment, publication, push, or merge.

Normative words `MUST`, `MUST NOT`, `REQUIRED`, and `ONLY` are binding for later design and implementation. Canonical enum and identifier values appear in uppercase or code formatting and are exact contract values unless a later owner-approved contract version supersedes them. Existing responder artifact names remain unchanged.

## 1. Executive Summary

Gridly Dispatch is a separate authenticated organizational operations product. Consumer Gridly remains an anonymous public-awareness product. Dispatch uses the Phase 0–18 responder security kernel—live Auth and MFA, deny-by-default tenancy, atomic commands, replay protection, immutable audit evidence, governed geography, and sanitized projection—but replaces agency-only assumptions with neutral organizations, multiple memberships, explicit organization context, fixed role templates, permissions, versioned scopes, capability grants, and private operational records.

The frozen identity chain is:

```text
AUTH USER
    ↓
PROFILE
    ↓
ORGANIZATION MEMBERSHIP
    ↓
ROLE TEMPLATE / PERMISSIONS
    ↓
ACTIVE ORGANIZATION (explicit UI context; validated on every server request)
    ↓
OPERATIONAL SCOPE
    ↓
PRIVATE DISPATCH DATA
    ↓
SOURCE / PROVENANCE
    ↓
OPTIONAL GOVERNED CONSUMER PROJECTION
```

The neutral tenant is `organization`. A user may belong to zero, one, or many organizations. Each organization-scoped operation names one organization as a selector, but the server re-derives a live membership, role, permission, organization state, and scope eligibility. A client-provided organization ID, JWT organization claim, UI selection, or route alone never grants access.

All Dispatch users require the production-proven live TOTP/AAL2 predicate for MVP. The initial fixed role templates are `OWNER`, `ORGANIZATION_ADMIN`, `SUPERVISOR`, `OPERATOR`, and `VIEWER`. There is exactly one active owner membership per organization. Operational scope and public authority are separate. Private data is the default; public projection is an explicit, reviewed, sanitized capability.

Phase 21 may implement only a disposable local neutral schema prototype after owner review. It may not implement production Auth, production RLS, a migration, runtime RPCs, UI, consumer integration, or deployment.

## 2. Contract Status / Authority

| Contract area | Status | Authority / consequence |
| --- | --- | --- |
| Canonical terminology and responder compatibility | FROZEN | Later artifacts MUST use the neutral terms and preserve compatibility mappings. |
| Organization, membership, active-context, role, permission, MFA, and ownership security | FROZEN | No security-critical owner decision remains before a local Phase 21 prototype. |
| Operational scope, verification, capability grant, private record, provenance, and projection models | FROZEN | Phase 21 may model these concepts locally without activating them. |
| RLS, command, audit, application, and repository boundaries | FROZEN | Later implementation may strengthen but MUST NOT weaken them. |
| Pilot sector and first live capability selection | OWNER_DECISION_REQUIRED | Not required for Phase 21; required before pilot implementation or seeding. |
| Exact legal retention durations and deletion/hold rules | OWNER_DECISION_REQUIRED | Not required for a disposable fixture; required before production data. |
| Invitation delivery channel and expiry duration | OWNER_DECISION_REQUIRED | Not required for structural prototype; required before onboarding implementation. |
| Non-county canonical scope datasets and approval processes | OWNER_DECISION_REQUIRED | Not required for enum/schema prototype; required before any such scope becomes active. |
| Consumer wording, icons, ranking, and channel launch | OWNER_DECISION_REQUIRED | Required before consumer projection integration, not Phase 21. |
| Alternate Auth providers, lower-assurance viewer policy, custom roles, and cross-org sharing | DEFERRED_POST_MVP | Not permitted in Dispatch v1 without a new contract version. |

This contract inherits the Phase 15A live Auth findings and the Phase 18 security/migration evidence as design constraints. It does not inherit deployment authorization. Phase 18's responder migration remains a reference implementation, not the Dispatch schema.

## 3. Canonical Terminology

Contract status: **FROZEN**.

| Term | Frozen meaning |
| --- | --- |
| `user` | One global authenticated human identity, canonically keyed by immutable Auth user UUID. Email, provider, profile, and display name are not authority. |
| `profile` | Non-authoritative user presentation/contact data. Profile fields MUST NOT grant membership, role, permission, scope, or verification. |
| `organization` | The tenant that owns private Dispatch records, memberships, settings, and capability/scope grants. |
| `organization_type` | A classification that may choose defaults, capabilities, verification expectations, and presentation; it MUST NOT change tenancy isolation. |
| `membership` | A versioned relationship between one user and one organization, with status and one role template. |
| `membership_status` | The current eligibility state: `INVITED`, `ACTIVE`, `SUSPENDED`, or `REVOKED`. |
| `role` | One fixed MVP template that maps to a frozen permission set within one membership. |
| `permission` | A stable organization- or platform-scoped action identifier enforced server-side. |
| `active_organization` | UI/request context selecting one organization for an operation; never an independent grant. |
| `operational_scope` | A versioned geographic, asset, facility, route, or non-geographic boundary in which a capability may operate. |
| `verification_level` | Current confidence in the organization's identity/classification, not a universal public-authority badge. |
| `capability_grant` | A time-bounded, revocable grant allowing a named capability for one organization and scope under recorded governance. |
| `private_operational_record` | Organization-owned work/awareness data that is private by default and versioned through commands. |
| `source` | The identity/class of the party or system from which a record or projection originates. |
| `provenance` | Immutable lineage: organization, actor/membership, source class, revision, scope, verification, capability, review, and time. |
| `consumer_projection` | A sanitized public-safe record derived through explicit eligibility and review; never a private-table view. |
| `platform_admin` | A separately granted Gridly operator with platform permissions; never an inherited organization role. |
| `organization_admin` | An organization-scoped role template that manages members/settings but has no platform authority. |

## 4. Deprecated / Compatibility Terminology

Contract status: **FROZEN**.

| Responder-era term | Classification | Dispatch v1 rule |
| --- | --- | --- |
| `agency` | COMPATIBILITY ALIAS | Maps to `organization` only for responder records/APIs. New neutral contracts MUST use `organization`. |
| `agency_member` | COMPATIBILITY ALIAS | Maps to `membership` in responder compatibility surfaces. |
| `responder` as a generic user | DEPRECATED | Use `user`, `member`, or `operator`. |
| `RESPONDER` role | COMPATIBILITY ALIAS | Maps to `OPERATOR` for permission comparison; historical value remains unchanged. |
| `responder_role` | DEPRECATED | Use `role` plus permissions. |
| `county_authority` | RETAINED DOMAIN TERM | Valid only for the responder/county public-authority capability; generalized contract term is `operational_scope` plus `capability_grant`. |
| `AGENCY_OFFICIAL` | RETAINED DOMAIN TERM | Preserved as the responder projection source family; new neutral records use `ORGANIZATION` provenance and capability-specific public labeling. |
| `agency_update` | COMPATIBILITY ALIAS | Maps to an awareness-oriented `private_operational_record` and optional projection. |
| `agency_publishing_enabled` | COMPATIBILITY ALIAS | Existing responder gate remains; target model uses capability/channel grants and controls. |
| `GRIDLY_ADMIN` | COMPATIBILITY ALIAS | Maps to separately granted `platform_admin` permissions, never an organization role. |
| `incident_command` | RETAINED DOMAIN TERM | A specialized external/public-safety domain, explicitly outside the neutral MVP kernel. |

Compatibility aliases do not authorize broad renames or data reinterpretation. Historical labels, event types, receipts, and hashes remain immutable.

## 5. Organization Contract

Contract status: **FROZEN**.

An organization conceptually contains:

| Field | Contract |
| --- | --- |
| `id` | Immutable UUID tenant identity. |
| `display_name` | Bounded product-facing name; not verification evidence. |
| `legal_name` | Private governed legal/registered name where applicable. |
| `organization_type` | One frozen type value. |
| `status` | One organization status value. |
| `verification_level` | One current verification level, supported by versioned decision history. |
| `created_at`, `updated_at` | Server timestamps; client time is not authoritative. |
| `governance_revision` | Monotonic optimistic-concurrency value for sensitive organization changes. |

An organization owns zero or more memberships, operational scopes, capability grants, private records, settings, and audit events. It may have multiple active scopes. Type never grants permission, verification, scope, or consumer publication. Closing an organization preserves audit/history and disables all commands and projection eligibility.

## 6. Organization Status Contract

Contract status: **FROZEN**.

Exact values:

- `PENDING` — organization exists but normal operational access is not activated; owner/platform onboarding may proceed through bounded commands.
- `ACTIVE` — eligible memberships may use granted private capabilities.
- `SUSPENDED` — all organization-scoped commands and private reads deny except explicitly bounded platform investigation/recovery; public projections become ineligible.
- `CLOSED` — terminal business state; no reactivation in v1, no new commands/projections, history retained under policy.

Allowed transitions are `PENDING → ACTIVE`, `PENDING → CLOSED`, `ACTIVE → SUSPENDED`, `SUSPENDED → ACTIVE`, and `ACTIVE/SUSPENDED → CLOSED`. Each transition requires permission, expected revision, MFA, reason, and audit event. `CLOSED → *` is prohibited; a successor is a new organization.

## 7. Organization Type Contract

Contract status: **FROZEN**.

Exact v1 values:

`FIRE`, `EMS`, `LAW_ENFORCEMENT`, `EMERGENCY_MANAGEMENT`, `UTILITY`, `FLEET`, `TRUCKING`, `MUNICIPALITY`, `SCHOOL_DISTRICT`, `CONTRACTOR`, `PRIVATE_COMPANY`, `INDUSTRIAL_OPERATOR`, `TRANSPORTATION_OPERATOR`, `INFRASTRUCTURE_OPERATOR`, `OTHER`.

Type may set onboarding copy, recommended role assignments, capability requests, verification evidence expectations, and presentation. It MUST NOT change the organization key, RLS predicate, membership mechanics, or default public authority.

Type changes require `organization.manage`, owner MFA, expected organization revision, a reason, compatibility validation against active capabilities/scopes, and `ORGANIZATION_UPDATED`. A type change that would invalidate a capability MUST first suspend or revoke that capability. `VERIFIED_PUBLIC_ENTITY` organizations cannot change to a private-sector type without platform review. Type history is retained.

## 8. Membership Contract

Contract status: **FROZEN**.

A user may belong to zero, one, or many organizations. Roles may differ per organization. Every organization-scoped operation resolves exactly one membership. A live membership is unique per `(organization_id, user_id)`; terminated history may have older rows, but no more than one row may be in `INVITED`, `ACTIVE`, or `SUSPENDED` for that pair.

Conceptual fields: immutable membership ID, organization ID, user ID, role, status, invited/accepted/suspended/revoked timestamps, optional membership expiry, inviter, current revision, and reason/evidence references. Email is invitation delivery/matching data, never membership identity after acceptance.

Invitation is a separate lifecycle object with exact states `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, and `REVOKED`. `DECLINED` and `EXPIRED` are invitation states/events, not membership statuses. Voluntary departure produces `MEMBERSHIP_LEFT` and sets membership status to `REVOKED` with a bounded reason. A revoked membership is terminal; rejoining creates a new membership and invitation while preserving history.

## 9. Membership Status Contract

Contract status: **FROZEN**.

Exact membership values:

- `INVITED` — reserved relationship awaiting acceptance; grants no organization access.
- `ACTIVE` — eligible for role/permission evaluation.
- `SUSPENDED` — temporarily ineligible; all organization access denies immediately.
- `REVOKED` — terminal; all organization access denies and a future return requires a new membership.

Allowed transitions: absent to `INVITED`; `INVITED → ACTIVE/REVOKED`; `ACTIVE → SUSPENDED/REVOKED`; `SUSPENDED → ACTIVE/REVOKED`. Effective invitation expiry is read from the invitation and prevents acceptance without requiring a scheduled mutation. Membership expiry, if present, makes an otherwise active membership ineligible at server read time and requires a new/renewed governed membership action.

## 10. Active Organization Contract

Contract status: **FROZEN**.

**FROZEN transport:** option A, an explicit `organization_id` selector in every organization-scoped RPC/read contract, combined with live server/database validation. It is not accepted as proof of authorization.

The UI may persist the last selected organization in Dispatch-origin convenience state, but this state grants nothing. The server MUST resolve:

```text
authenticated Auth UUID
+ live TOTP/AAL2 session predicate
+ requested organization_id
+ one live ACTIVE, unexpired membership for that user and organization
+ membership role
+ required permission
+ organization status = ACTIVE
+ command/read-specific operational scope and capability eligibility
```

JWT/custom organization claims, user metadata, app metadata, a database session variable, a persistent server “active organization” row, URL path, local storage, or UI state MUST NOT replace live validation. No global active-organization property exists on the user. A two-organization user can switch UI context without mutating authorization state; the next request is independently authorized. Cross-org batch requests are outside MVP.

## 11. Role Templates

Contract status: **FROZEN**.

| Role | Purpose | Baseline permissions | Assignability / removal | Ownership effect |
| --- | --- | --- | --- | --- |
| `OWNER` | Exactly one accountable organization controller | All organization-scoped MVP permissions | Not directly assignable/removable; only ownership transfer or platform recovery | Transfer is atomic; organization may never have zero or two active owners |
| `ORGANIZATION_ADMIN` | Membership, settings, scope requests, and operational administration | All except `ownership.transfer`; projection publication only when also allowed by capability policy | Owner or another admin with `members.manage`; last admin cannot be removed if no replacement | Eligible ownership recipient after explicit acceptance |
| `SUPERVISOR` | Operational review, assignment, closure, and projection review/publication | Operational permissions, `members.read`, `audit.read`, projection review/publish subject to grant | Organization admin/owner | No ownership effect |
| `OPERATOR` | Create and update operational work and submit projection candidates | Operational read/create/update, own/allowed assignment, awareness read, projection submit | Organization admin/owner | No ownership effect |
| `VIEWER` | Bounded read-only awareness | Organization/operations/awareness/settings read | Organization admin/owner | No ownership effect |

All roles require MFA under the MVP policy. Organization admins may assign `VIEWER`, `OPERATOR`, `SUPERVISOR`, and `ORGANIZATION_ADMIN`, subject to no self-promotion, no last-admin loss, expected revision, and audit. They cannot assign or remove `OWNER`. Role templates are fixed; custom roles are `DEFERRED_POST_MVP`.

## 12. Permission Vocabulary

Contract status: **FROZEN**.

Exact organization-scoped v1 identifiers:

| Permission | Meaning | Role templates |
| --- | --- | --- |
| `organization.read` | Read bounded organization context | All roles |
| `organization.manage` | Change bounded organization profile/type requests | OWNER, ORGANIZATION_ADMIN |
| `members.read` | Read bounded organization roster | OWNER, ORGANIZATION_ADMIN, SUPERVISOR |
| `members.invite` | Create/revoke invitations | OWNER, ORGANIZATION_ADMIN |
| `members.manage` | Change roles; suspend/reactivate/revoke members | OWNER, ORGANIZATION_ADMIN |
| `ownership.transfer` | Initiate/accept ownership transfer | OWNER initiates; eligible recipient accepts |
| `scope.read` | Read current bounded scope summaries | All roles |
| `scope.manage` | Request/change/revoke private scope use, subject to governance | OWNER, ORGANIZATION_ADMIN |
| `operations.read` | Read permitted private operational records | All roles |
| `operations.create` | Create private operational records | OWNER, ORGANIZATION_ADMIN, SUPERVISOR, OPERATOR |
| `operations.update` | Edit records allowed by assignment/workflow | OWNER, ORGANIZATION_ADMIN, SUPERVISOR, OPERATOR |
| `operations.assign` | Assign/reassign eligible members | OWNER, ORGANIZATION_ADMIN, SUPERVISOR |
| `operations.close` | Close/cancel operational records | OWNER, ORGANIZATION_ADMIN, SUPERVISOR |
| `awareness.read` | Read source-separated awareness context | All roles |
| `projection.submit` | Submit an eligible record as a projection candidate | OWNER, ORGANIZATION_ADMIN, SUPERVISOR, OPERATOR |
| `projection.review` | Approve/reject candidate content under policy | OWNER, ORGANIZATION_ADMIN, SUPERVISOR |
| `projection.publish` | Publish/withdraw an approved projection under an active capability grant | OWNER, ORGANIZATION_ADMIN, SUPERVISOR |
| `audit.read` | Read bounded organization audit history | OWNER, ORGANIZATION_ADMIN, SUPERVISOR |
| `settings.read` | Read bounded organization settings/capability status | All roles |
| `settings.manage` | Change organization settings that do not grant platform authority | OWNER, ORGANIZATION_ADMIN |

Exact platform-scoped v1 identifiers: `platform.organization.verify`, `platform.organization.suspend`, `platform.capability.manage`, `platform.ownership.recover`, `platform.audit.investigate`, and `platform.abuse.manage`. They belong only to separate platform grants and never to an organization role.

Permissions are necessary but not sufficient: every action also checks MFA, organization/membership state, scope, record state, revision, and capability policy. UI visibility is not permission enforcement.

No `reports.*` permission exists in v1. Community reports remain a separate Consumer Gridly domain, and Dispatch organization roles receive no implicit report moderation power.

## 13. MFA Policy

Contract status: **FROZEN**.

**FROZEN MVP minimum:** every Dispatch user, including `VIEWER`, and every `platform_admin` MUST satisfy the complete Phase 15A/16 live TOTP/AAL2 predicate before any Dispatch private read or command.

Required evidence is signed/live user agreement, a live same-user session, live `aal2`, live same-user verified TOTP factor, live TOTP AMR, signed/live consistency, and active private principal. Membership, organization, permission, scope, and capability state are then checked live. JWT assurance alone is insufficient. Phone/WebAuthn or a generic `aal2` without TOTP does not satisfy v1. `minimum_iat` remains optional additive defense in depth.

Organizations may later configure a stricter session/re-authentication policy but cannot lower this floor. Alternate providers may authenticate a user later, but privileged Dispatch use still requires the frozen factor predicate until a new contract version. A lower-assurance read-only viewer policy is `DEFERRED_POST_MVP`.

## 14. Ownership Transfer

Contract status: **FROZEN**.

Each non-closed organization MUST have exactly one active `OWNER` membership. The initial owner is created only through a governed organization-creation/onboarding process.

Normal transfer is two-step and atomic at acceptance:

1. Current owner with live MFA calls `initiate_ownership_transfer`, naming an active `ORGANIZATION_ADMIN` membership, expected organization revision, expiry, and reason.
2. The recipient independently satisfies live MFA and calls `accept_ownership_transfer` before expiry.
3. One transaction promotes the recipient to `OWNER`, demotes the prior owner to `ORGANIZATION_ADMIN`, advances revisions, invalidates the transfer, and appends `OWNERSHIP_TRANSFERRED` with both actor UUIDs/membership IDs.

The current owner remains owner until acceptance. Self-transfer, transfer to an invited/suspended/revoked/expired member, concurrent transfer, removal of the sole owner, and owner departure without completed transfer are denied. The owner may cancel a pending transfer.

If the owner is unavailable, platform recovery requires a case, independent organization evidence, two distinct live `platform.ownership.recover` approvers, an eligible active recipient, immutable audit, and no platform actor becoming organization owner. Platform administrators cannot silently appoint themselves or publish as the organization.

## 15. Operational Scope Contract

Contract status: **FROZEN**.

Exact v1 scope types:

| Type | Meaning / conceptual representation | Private records | Public projection |
| --- | --- | --- | --- |
| `COUNTY` | Canonical county FIPS plus immutable governed geometry/version | Yes | Yes, only with matching active capability grant and authority review |
| `MULTI_COUNTY` | Immutable versioned set of canonical county scopes | Yes | Yes, grant must cover the set or each member as policy defines |
| `STATEWIDE` | Explicit governed state/jurisdiction identity and version; never implicit 254-county expansion | Yes | Yes, only for capabilities approved statewide |
| `SERVICE_TERRITORY` | Governed versioned Polygon/MultiPolygon with source provenance | Yes | Yes after separate source/authority verification |
| `CORRIDOR` | Governed route-network/linear segment set with explicit containment/tolerance policy | Yes | Yes after capability-specific verification |
| `ROUTE` | Ordered governed roadway/transit segments or stops with version | Yes | Yes after capability-specific verification |
| `FACILITY` | Canonical governed facility identity and boundary/location version | Yes | Yes where consumer-safe and capability-approved |
| `SITE` | Governed organization site identity with bounded point/polygon and provenance | Yes | Yes only after public-location and authority review |
| `NON_GEOGRAPHIC` | Explicit absence of geographic boundary for administrative/private work | Yes | No by default; a later capability may explicitly allow non-geographic notices |

Each scope has immutable ID/version, owning/eligible organization, status, effective interval, source/provenance, representation reference, review evidence, and revocation history. Organizations may have multiple scopes. Records bind exactly one primary scope in v1; cross-scope aggregation is a read concern, not shared ownership.

Operational scope permits bounded private operation only. It does not imply public authority, verified identity, a capability grant, or consumer eligibility. Client geometry and string labels never grant scope. County preserves strict `ST_Contains`, edge denial, and immutable source-version binding. Other geographic scope types require separately governed canonical datasets and explicit topology semantics before activation.

## 16. Verification Contract

Contract status: **FROZEN**.

Exact organization verification levels:

- `UNVERIFIED` — self-asserted identity; private onboarding/evaluation only.
- `VERIFIED_ORGANIZATION` — legal/business identity established through recorded review.
- `VERIFIED_PUBLIC_ENTITY` — public/government institution identity established through recorded review.

`VERIFIED_AUTHORITY` is **not** an organization verification level. It may appear only as a consumer presentation derived from a current capability grant for a specific capability and scope. Verification never grants tenancy access, role, permission, scope, or publication by itself.

Verification changes require a live platform permission, expected revision, bounded evidence reference, reason, effective time, and immutable event. Suspension/closure makes all capability grants ineligible. Revocation/downgrade must not erase historical verification decisions.

## 17. Capability Grant Contract

Contract status: **FROZEN**.

Exact initial capability identifiers:

- `awareness.condition.publish`
- `awareness.hazard.publish`
- `awareness.planned_work.publish`
- `awareness.official_notice.publish`
- `awareness.road_closure.publish`

The road-closure capability retains the responder two-person author/approver separation. Capability status values are `PENDING`, `ACTIVE`, `SUSPENDED`, `REVOKED`, and derived `EXPIRED` at/after `valid_until`.

A grant binds organization, capability identifier, operational scope ID/version, required verification level, effective interval, governing decision/evidence, granted/revoked platform actors, revision, and status. Only an `ACTIVE`, unexpired grant with matching current organization/verification/scope state is eligible. One grant cannot broaden another scope. An organization may hold multiple grants.

Platform permission `platform.capability.manage` is required to grant, suspend, or revoke public-authority capabilities. Organization roles may request them but cannot self-grant. Grant revocation immediately makes projections ineligible and must preserve private records/history.

## 18. Private Operational Record Contract

Contract status: **FROZEN**.

The neutral base record conceptually contains:

- immutable `id`, `organization_id`, and current revision;
- `record_type`, `status`, and `priority`;
- bounded `title` and `description`;
- required `operational_scope_id` and scope version;
- optional governed location/reference appropriate to that scope;
- optional active `assigned_membership_id`;
- immutable creator user/membership identity and current updater identity;
- server `created_at`, `updated_at`, optional `closed_at`;
- source/provenance and visibility classification;
- optimistic expected revision and append-only revision/event lineage.

Exact record types: `CONDITION`, `HAZARD`, `PLANNED_WORK`, and `OPERATIONAL_NOTICE`.

Exact record states: `DRAFT`, `OPEN`, `IN_PROGRESS`, `MONITORING`, `CLOSED`, and `CANCELLED`. Allowed lifecycle is `DRAFT → OPEN/CANCELLED`, `OPEN → IN_PROGRESS/MONITORING/CLOSED/CANCELLED`, `IN_PROGRESS ↔ MONITORING`, and `IN_PROGRESS/MONITORING → CLOSED/CANCELLED`. `CLOSED` and `CANCELLED` are terminal. Public projection lifecycle is separate and never inferred solely from record status.

Exact priorities: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`. Priority is private-only by default and does not grant publication or alter tenant isolation.

Assignments target active memberships in the same organization. Notes/comments are separate private append-only or versioned records; they are not part of the public projection candidate. Attachments and sector-specific record types are `DEFERRED_POST_MVP`.

## 19. Private Data Boundary

Contract status: **FROZEN**.

Every field is classified:

- `PRIVATE_ONLY` — never copied directly to Consumer Gridly.
- `PROJECTION_ELIGIBLE` — may enter a candidate but requires explicit mapping, review, and sanitization.
- `PUBLIC_SAFE` — exact fields in an approved projection contract after all gates pass.

Always `PRIVATE_ONLY`: internal assignments, assignee/team identity, private notes/comments, staff/Auth/membership identity, phone/email/contact data, internal status, priority, response plans, audit trail, permission/role state, membership details, verification evidence, capability evidence, replay/receipt/session data, private timestamps, internal reasons, sensitive locations, and unapproved metadata.

Potentially `PROJECTION_ELIGIBLE`: approved title/summary, consumer taxonomy, public-safe location, public organization display identity, source label, observed/updated time, expiry, and bounded public impact. No field becomes public because it is empty, hidden in CSS, returned to a trusted client, or present in a private view.

`PUBLIC_SAFE` is defined only by the versioned consumer projection allowlist. Unknown keys fail projection construction.

## 20. Source / Provenance Contract

Contract status: **FROZEN**.

Exact source classes:

- `COMMUNITY`
- `OFFICIAL_PUBLIC`
- `ORGANIZATION`
- `PRIVATE_OPERATIONAL`

Organization-created private records retain immutable/traceable organization ID, author user ID, author membership ID, record/revision, source class, verification level/version, capability grant ID/version when relevant, operational scope ID/version, visibility, review state, projection lineage, and server creation/update times.

Visibility values are `PRIVATE`, `ORGANIZATION`, `PROJECTION_CANDIDATE`, and `PUBLIC_PROJECTION`. Visibility is not permission by itself; RLS/commands remain authoritative. Review states are `NOT_SUBMITTED`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, and `WITHDRAWN`.

A public projection preserves stable projection ID, private-origin correlation internally, organization public identity, source class/public source label, approved verification/capability presentation, consumer-safe taxonomy/location/content, public timestamps/expiry, and projection revision. Author UUID, membership ID, internal record status/priority, evidence, scope internals, and review actor remain private.

Sources remain distinct even when colocated or consistent. No automatic corroboration, overwrite, destructive deduplication, or “confirmed by Gridly” claim is permitted without a separately frozen rule.

## 21. Consumer Projection Contract

Contract status: **FROZEN**.

The only permitted flow is:

```text
private organization record
  → projection candidate
  → eligibility checks
  → required review/policy
  → sanitized immutable projection revision
  → current public projection
  → Consumer Gridly awareness adapter
```

All gates are required:

1. source class and record type are eligible;
2. matching capability grant is active, unexpired, and scope-bound;
3. operational scope/version is current and valid;
4. organization is `ACTIVE` at the required verification level;
5. membership/permission/MFA and record revision are current;
6. record state is eligible and not terminally withdrawn/cancelled;
7. review policy passes, including distinct actors where required;
8. exact consumer-safe taxonomy and field allowlist validate;
9. privacy sanitization finds no private or unknown field;
10. freshness/expiry and current projection lineage pass;
11. channel/capability control is enabled;
12. no suspension, revocation, abuse hold, or stale source version applies.

Failure returns no public row. Consumer Gridly never reads Dispatch-private tables or invokes Dispatch organization commands. Projection withdrawal, expiry, organization suspension, or grant/scope revocation must remove current visibility while preserving private and projection history. Cache/service-worker/CDN invalidation is required before consumer launch.

## 22. Community Reporting Relationship

Contract status: **FROZEN**.

Community reports, organization records, official public sources, and Dispatch projections remain separate identities, lifecycles, receipts, retention domains, and presentation labels.

A Dispatch user may submit an ordinary community report only through the Consumer Gridly community flow under that flow's identity/consent contract; organization membership confers no special community authority. Organization-authored information is created as an `ORGANIZATION` or `PRIVATE_OPERATIONAL` Dispatch record and never written into community report tables.

Organization roles receive no community moderation permission in v1. Reviewing/moderating community reports requires a future explicit platform permission and contract; it is not implied by `OWNER`, `ORGANIZATION_ADMIN`, `SUPERVISOR`, organization verification, or a capability grant. Dispatch may display community evidence as source-separated read-only context through a governed shared-data contract.

## 23. RLS Invariants

Contract status: **FROZEN**.

The following are non-negotiable:

1. Default deny for every private table and command.
2. Every organization-private read requires a live authenticated user, the complete live MFA predicate, an `ACTIVE` unexpired membership for the requested organization, required permission, and `ACTIVE` organization.
3. The explicit organization selector is validated, never trusted.
4. Authorization state comes from current database rows, not user metadata, stale JWT organization/role claims, UI state, or hidden controls.
5. Private schemas remain outside Data API exposed schemas; exposure and grants are separate controls.
6. RLS remains enabled on every exposed table and defense-in-depth private table; FORCE RLS posture must be explicitly tested with owners/definers.
7. `TO authenticated` alone is never authorization.
8. Direct browser mutation of command-owned tables is denied; mutation occurs through bounded authoritative commands.
9. Safe views are security-invoker or an equivalently reviewed bounded interface and never broaden base-table access.
10. Any necessary private definer has empty search path, fully qualified objects, actor derived internally, no dynamic caller SQL, revoked PUBLIC/service-role execution, minimal grants, and dedicated review.
11. Revoked, suspended, or expired membership loses access on the next request even if a token or UI context is stale.
12. Platform grants are separate from organization membership and confer no organization publishing identity.
13. Consumer/anonymous roles cannot access Dispatch-private rows, functions, evidence, or schemas.
14. Projection relations expose only exact `PUBLIC_SAFE` fields and recheck current eligibility.
15. Cross-organization access requires a future explicit shared contract; there is no implicit multi-org union or platform impersonation.

No executable SQL is authorized by this contract.

## 24. Command Contract

Contract status: **FROZEN**.

All commands use the responder-proven contract kernel: versioned action, UUIDv4 operation token, explicit organization selector where applicable, action payload allowlist, target ID, expected revision for mutation, server-derived actor/membership/permission, bounded result vocabulary, one transaction, exact replay detection, and immutable audit event. Denial produces no business mutation/event/accepted receipt.

| Conceptual command | Required permission | Revision / replay / event |
| --- | --- | --- |
| `create_operational_record` | `operations.create` | No target revision; idempotent create; `RECORD_CREATED` |
| `update_operational_record` | `operations.update` | Expected current revision; `RECORD_UPDATED` |
| `assign_operational_record` | `operations.assign` | Expected current revision and eligible same-org assignee; `RECORD_ASSIGNED` |
| `close_operational_record` | `operations.close` | Expected current revision; `RECORD_CLOSED` |
| `invite_member` | `members.invite` | Organization revision; digest-only invitation; `MEMBER_INVITED` |
| `accept_invitation` | Matching authenticated invitee | Invitation single-use state; `INVITATION_ACCEPTED` |
| `change_member_role` | `members.manage` | Membership revision; no owner assignment; `ROLE_CHANGED` |
| `suspend_member` / `revoke_member` | `members.manage` | Membership revision and orphan/last-admin checks; corresponding event |
| `initiate_ownership_transfer` | `ownership.transfer` | Organization revision and expiring transfer; `OWNERSHIP_TRANSFER_INITIATED` |
| `accept_ownership_transfer` | Eligible named recipient | Transfer and organization revisions; atomic `OWNERSHIP_TRANSFERRED` |
| `submit_projection_candidate` | `projection.submit` | Record revision; `PROJECTION_SUBMITTED` |
| `approve_projection` / `reject_projection` | `projection.review` | Candidate revision and separation policy; `PROJECTION_APPROVED/REJECTED` |
| `publish_projection` / `withdraw_projection` | `projection.publish` | Approved candidate revision, capability/scope checks; `PROJECTION_PUBLISHED/WITHDRAWN` |

Responder-era RPCs are **compatibility wrappers**, not the neutral API. A future wrapper may translate a frozen responder request to a neutral command only if it preserves all responder-specific stricter predicates, operation-token semantics, status vocabulary, and audit lineage. Direct silent reinterpretation is prohibited.

## 25. Audit Event Contract

Contract status: **FROZEN**.

Exact minimum business/governance event vocabulary:

`ORGANIZATION_CREATED`, `ORGANIZATION_UPDATED`, `ORGANIZATION_ACTIVATED`, `ORGANIZATION_SUSPENDED`, `ORGANIZATION_REINSTATED`, `ORGANIZATION_CLOSED`, `MEMBER_INVITED`, `INVITATION_ACCEPTED`, `INVITATION_DECLINED`, `INVITATION_EXPIRED`, `MEMBER_SUSPENDED`, `MEMBER_REACTIVATED`, `MEMBER_REVOKED`, `MEMBERSHIP_LEFT`, `ROLE_CHANGED`, `OWNERSHIP_TRANSFER_INITIATED`, `OWNERSHIP_TRANSFER_CANCELLED`, `OWNERSHIP_TRANSFERRED`, `OWNERSHIP_RECOVERED`, `SCOPE_GRANTED`, `SCOPE_REVOKED`, `CAPABILITY_GRANTED`, `CAPABILITY_SUSPENDED`, `CAPABILITY_REVOKED`, `RECORD_CREATED`, `RECORD_UPDATED`, `RECORD_ASSIGNED`, `RECORD_CLOSED`, `RECORD_CANCELLED`, `PROJECTION_SUBMITTED`, `PROJECTION_APPROVED`, `PROJECTION_REJECTED`, `PROJECTION_PUBLISHED`, `PROJECTION_WITHDRAWN`, `SETTINGS_CHANGED`.

Events are append-only, server-timestamped, organization/platform scoped, and carry bounded before/after state, actor UUID/membership or platform grant, target/revision, correlation/operation identity, and reason where required. They do not store raw credentials, tokens, TOTP data, invitation secrets, or unbounded payloads.

Routine login, logout, challenge, factor, session, and failed-auth activity remains in dedicated Auth/security logs. A sensitive recovery/offboarding action records a bounded business governance event and may reference, but does not copy, security-log evidence. Denial/abuse telemetry remains separate from successful business history.

## 26. Retention Architecture

Architecture status: **FROZEN**. Duration/legal policy status: **OWNER_DECISION_REQUIRED**.

No legal duration is invented. Consumer community-report retention MUST NOT be reused.

| Category | Architectural requirement | Deletion implications | Status |
| --- | --- | --- | --- |
| Membership history | Preserve role/status/ownership accountability and offboarding events | Organization close does not erase; Auth deletion removes current profile/link where required but historical actor identity remains a non-cascading pseudonymous/UUID reference under policy | POLICY DECISION REQUIRED |
| Audit history | Append-only and restore-consistent with commands/receipts | No destructive cascade from organization/user deletion; legal hold/export rules required | POLICY DECISION REQUIRED |
| Private operational records | Retain revisions needed for operations, disputes, recovery, and linked projections | Organization close disables access and starts governed retention, not immediate cascade | POLICY DECISION REQUIRED |
| Public projections | Preserve projection lineage sufficient to explain public history while removing current visibility when ineligible | Public removal does not delete private/audit lineage | POLICY DECISION REQUIRED |
| Invitations | Retain bounded lifecycle and digest evidence only as long as security/audit policy requires | Secrets never stored; expired/revoked invitations cannot be reused | POLICY DECISION REQUIRED |
| Security/Auth events | Provider/security-log domain with access controls and incident needs | Auth user deletion/session revocation does not erase required Gridly governance evidence | POLICY DECISION REQUIRED |
| Replay receipts | Retain at least for the full period in which a replayed operation could be accepted, including restore scenarios | Cleanup requires archival/rejection rule and restore test | POLICY DECISION REQUIRED |

Before production, the owner/legal policy must decide exact durations, erasure/pseudonymization, legal holds, exports, backups, and restore behavior. A disposable Phase 21 fixture uses synthetic data and may test structural preservation without selecting durations.

## 27. Application Boundary

Contract status: **FROZEN**.

Target hostname is **`dispatch.gridlygo.com`** — FROZEN.

Dispatch has independent HTML/JS/CSS assets, CSP/security headers, service worker (if any), Auth bootstrap, origin-scoped storage keys, deployment, rollback, cache rules, monitoring, and incident controls. It has no consumer boot dependency, consumer localStorage keys, consumer Auth initialization, public PWA service-worker control, or native Android/iOS packaging dependency.

Private responses use `no-store`; tokens/credentials never enter URLs, analytics, or persistent public caches. Parent-domain cookies are avoided unless a later reviewed SSO design proves isolation. Consumer Gridly remains usable without login and cannot require Dispatch assets or sessions.

## 28. Repository Boundary

Contract status: **FROZEN**.

Recommended future structure, not created in this phase:

```text
dispatch/
  index.html
  js/
  css/
  assets/
shared/
  contracts/
  map-primitives/
  governed-data/
```

`dispatch/` owns the authenticated app. `shared/` may contain pure, reviewed modules or static contracts with no consumer DOM boot assumptions, service-worker registration, Auth client singleton, localStorage namespace, secret, or implicit source merging. Shared governed data may include canonical PLACE/county/crossing/POI identifiers and source adapters through explicit interfaces.

Dispatch MUST NOT import the consumer `js/app.js`, consumer shell, or consumer service worker. Copying code is preferable to unsafe coupling only as a temporary reviewed step; durable common behavior belongs in a small neutral shared module with independent tests. Runtime implementation is outside Phase 20/21 unless separately authorized.

## 29. Responder Compatibility Matrix

Contract status: **FROZEN**.

| Responder concept | Decision | Database migration | API/RPC migration | Historical records | Documentation |
| --- | --- | --- | --- | --- | --- |
| Agency | MIGRATE conceptually to organization | Preserve IDs and explicit type mapping; no blind rename | Neutral APIs use organization; wrapper may retain agency field | Preserve original labels/type | Mark compatibility alias |
| Agency membership | MIGRATE | Convert/associate to membership while preserving status/events | Wrapper maps one-org responder context explicitly | Preserve revoked/invite history | Neutral terminology authoritative |
| Responder roles | MIGRATE | Map VIEWER→VIEWER, RESPONDER→OPERATOR, SUPERVISOR→SUPERVISOR, AGENCY_ADMIN→ORGANIZATION_ADMIN | Wrapper preserves stricter responder action rules | Preserve original role in audit | Record mapping |
| County authority | KEEP as responder domain capability | Retain county source/version and grants | Wrap as scope + capability checks | Preserve authority decisions | Retained domain term |
| `AGENCY_OFFICIAL` source | KEEP for historical/responder projection | Never rewrite source family | New neutral projection adapter can label through policy | Immutable | Retained domain term |
| Responder commands | COMPATIBILITY WRAPPER | Preserve receipts/events/token domain | Translate only under versioned wrapper; no semantic weakening | Preserve correlations | Document deprecation path |
| Responder dashboard | SUPERSEDE | None | Neutral Dispatch reads replace it | N/A | Preserve Phase 8 contract as evidence |
| Responder projection | COMPATIBILITY WRAPPER | Preserve exact 18-field/history contract until migrated | Consumer adapter remains source-separated | Preserve public lineage | Neutral projection contract governs new types |
| Responder MFA policy | KEEP | Reuse live TOTP principal/session predicate | Same or stronger for all Dispatch roles | Security evidence retained | Phase 15A remains authority |
| Responder RLS | MIGRATE pattern | Rebuild around explicit multi-org context; do not loosen | Neutral wrappers validate membership/permissions | No cross-tenant reinterpretation | Phase 18 is regression floor |
| Responder audit log | KEEP | Preserve immutable events/UUID actors | New events use neutral vocabulary; wrapper retains old types | Never rewrite | Compatibility mapping required |
| Fixture identity/session roles | RETIRE | Never migrate | No wrapper | Test evidence only | Mark fixture-only |

No compatibility action is authorized until a later migration-design phase determines whether responder objects are undeployed, empty, populated, or externally referenced. Documentation compatibility is required immediately; runtime/database compatibility is conditional on actual state.

## 30. Pilot Sector Evaluation

Decision status: **OWNER_DECISION_REQUIRED** before pilot work; not required before Phase 21.

| Candidate | Operational value | Sensitivity / verification burden | Workflow fit | Consumer projection value | Support / sales considerations |
| --- | --- | --- | --- | --- | --- |
| Municipal public works | High: closures, hazards, planned work, notices | Moderate public-entity verification; strong scope/source expectations | Excellent match to all four neutral record types and proven county awareness | High | Closest to responder evidence; risk of appearing government-only |
| Utility field operations | High: outages, hazards, planned work, service notices | High infrastructure sensitivity; territory verification required | Strong private/public split and scope test | High | Strong commercial value; greater security/support burden |
| School district facilities/transportation | Moderate-high: hazards, closures, planned work, notices | High privacy/safety constraints; district/facility scope | Good test of facility/site and private-data controls | Moderate-high for closures/notices | Tests neutrality well; requires careful child-safety privacy boundaries |

Recommendation: owner should choose between municipal public works and a tightly bounded utility pilot after confirming verification operations and support capacity; a school district is the preferred third candidate after privacy review. The decision is not required for the Phase 21 disposable schema prototype but is required before sector-specific workflow or live pilot work.

## 31. MVP Record Type Evaluation

Contract status: **FROZEN** for the four included types; additional types are **DEFERRED_POST_MVP**.

| Type | Cross-sector applicability | Decision |
| --- | --- | --- |
| `CONDITION` | Road/site/facility/service condition across municipalities, utilities, fleets, schools, contractors, industrial, transportation, and public safety | FROZEN IN MVP |
| `HAZARD` | Safety or access hazard without assuming emergency incident command | FROZEN IN MVP |
| `PLANNED_WORK` | Maintenance, construction, planned outage, closure preparation, contractor/facility work | FROZEN IN MVP |
| `OPERATIONAL_NOTICE` | Bounded operational/public notice not otherwise typed | FROZEN IN MVP |
| `CLOSURE` | Useful but overlaps condition/notice and carries roadway/public-safety semantics | DEFERRED as a subtype/taxonomy; road closure uses a capability and consumer taxonomy |
| `INCIDENT` | Often sector-specific and risks CAD/RMS expansion | DEFERRED_POST_MVP |
| `TASK` / `WORK_ORDER` | Risks maintenance/scheduling product expansion | DEFERRED_POST_MVP |

The four frozen types are the smallest neutral set. Sector-specific taxonomies belong in bounded subtype/capability policy after owner review, not in the tenant kernel.

## 32. Platform Admin Contract

Contract status: **FROZEN**.

Platform admins are individual Auth users with live MFA, active private principals, and explicit platform permissions. They may verify/suspend organizations, manage capability grants, recover ownership through the two-approver process, investigate bounded audit evidence, and handle abuse.

They MUST NOT silently impersonate members, inherit organization roles, bypass audit, expose service-role credentials, read private records without a case-bound investigation permission, or publish as an organization. Every sensitive platform action requires current permission, organization/target revision where relevant, case/reason, operation token, immutable event/receipt, and least-privilege output.

Emergency behavior: suspend the organization or capability, revoke relevant grants/sessions through approved controls, preserve evidence, and provide read-only case-bound investigation. Recovery restores eligibility only after evidence review; it never republishes withdrawn projections automatically. A platform admin cannot be the recipient of recovered organization ownership unless independently a pre-existing eligible organization member and the normal owner contract is followed; platform status provides no shortcut.

## 33. Security Test Vectors

Contract status: **FROZEN**.

The following future tests are mandatory and authoritative. Every denial returns a bounded result, leaks no target existence/private field, and produces no accepted business mutation/event/receipt unless the vector explicitly tests a recorded governance denial.

| ID | Scenario | Required result |
| --- | --- | --- |
| S01 | User guesses another organization ID | Deny; zero cross-org rows/effects |
| S02 | Suspended membership attempts read and command | Immediate deny despite valid token |
| S03 | Revoked membership reuses stale token/session | Immediate deny from live membership state |
| S04 | User belongs to two organizations and switches UI context | Each request sees only explicitly selected eligible organization; no union/leak |
| S05 | Client/JWT/local storage claims an organization without membership | Deny; selector/claim grants nothing |
| S06 | `VIEWER` attempts any write | Deny |
| S07 | `OPERATOR` invites member, changes settings, assigns unrestricted work, or approves projection | Deny each unauthorized action |
| S08 | Organization admin attempts platform verification/suspension/capability grant | Deny; organization role gives no platform power |
| S09 | Consumer/anon path queries private table/function | SQL/API denial; no schema/row metadata leak |
| S10 | Projection candidate contains assignment, staff UUID, note, contact, private priority, or unknown key | Fail sanitization; no public row |
| S11 | Expired/suspended/revoked capability grant attempts publish | Deny; existing projection becomes ineligible |
| S12 | Record scope does not match capability grant | Deny publish; private record unchanged |
| S13 | Exact command replay | Return bounded `already_processed`; no duplicate mutation/event |
| S14 | Operation token reused with changed actor/org/action/target/payload | `invalid_request`; no mutation |
| S15 | Stale revision updates/assigns/closes record | `stale_revision`; no mutation |
| S16 | Owner suspension/removal/leave would orphan organization | Deny unless atomic completed transfer/recovery creates exactly one owner |
| S17 | Owner transfer recipient is suspended, wrong-org, or fails MFA | Deny; original owner remains |
| S18 | MFA-required user has `aal1`, generic non-TOTP `aal2`, stale TOTP JWT, missing live session/factor/AMR, or cross-user factor | Deny every private read/command |
| S19 | Disabled/suspended/closed organization attempts read/command/project | Deny; public projection hidden |
| S20 | Private operating scope exists without public capability grant | Private operation may proceed by permission; public projection denied |
| S21 | Organization verification is valid but capability/scope grant absent | Publication denied |
| S22 | Platform admin tries to publish as organization | Deny unless separately an eligible member using normal org context; platform grant ignored for publication |
| S23 | Organization type changes with incompatible active capability | Deny until capability is suspended/revoked through governance |
| S24 | Community report is queried/rewritten as an organization record | Preserve separate identity; no destructive conversion |
| S25 | Road-closure author attempts own approval | Deny; distinct qualified reviewer required |
| S26 | Projection expires or source/scope version becomes stale | Public row disappears without deleting private/audit history |
| S27 | Direct authenticated INSERT/UPDATE/DELETE bypasses command tables | Deny through grants/RLS |
| S28 | Definer called by PUBLIC/service role or with spoofed actor | Deny/not executable; actor always server-derived |
| S29 | Two concurrent owner-transfer acceptances or record revisions | Exactly one succeeds; other is stale/conflict |
| S30 | Organization closure or Auth user deletion cascades toward immutable audit | Destructive cascade denied; policy-compliant identity handling preserves accountability |

Phase 21 must map every vector to `STRUCTURAL`, `EXECUTABLE_LOCAL`, or `DEFERRED_TO_AUTH/RLS_COMMAND_PHASE` without claiming deferred vectors passed.

## 34. Unresolved Owner Decisions

All unresolved decisions are listed here; none is hidden only in prose.

| Decision | Options | Recommendation | Why | Required Before Phase 21? | Owner Status |
| --- | --- | --- | --- | --- | --- |
| First pilot sector | Municipal public works; bounded utility; school district | Choose municipal public works or bounded utility after support/verification review | Best value and contract coverage; materially different burden | No | OWNER_DECISION_REQUIRED |
| First live capability set | Any subset of five frozen capability IDs | Start with condition, hazard, planned work, and official notice; add road closure only with two-person staffing | Limits high-impact publication risk | No; required before pilot | OWNER_DECISION_REQUIRED |
| Retention durations and legal treatment | Owner/legal schedules per category | Approve separate Dispatch schedule; do not reuse community rules | Private workforce/operations data differs from community reports | No; required before production data | OWNER_DECISION_REQUIRED |
| User deletion/pseudonymization details | Retain UUID; pseudonymous actor key; governed erasure variants | Preserve immutable accountability with minimized/pseudonymized presentation | Must reconcile privacy and audit | No; required before production | OWNER_DECISION_REQUIRED |
| Invitation expiry and delivery | Approved SMTP; bounded manual pilot; later enterprise provider | Use approved SMTP if available; otherwise separately governed manual pilot | Default delivery is not production-certified | No; required before onboarding | OWNER_DECISION_REQUIRED |
| Non-county scope source/approval | Governed internal datasets; external authoritative datasets; defer | Activate only scope kinds with immutable source/version and reviewed topology | Enum support does not prove authoritative data | No; required before enabling each kind | OWNER_DECISION_REQUIRED |
| Consumer public wording/taxonomy | Capability-specific labels and icons | User-test source-explicit wording; never generic “verified authority” | Prevents overclaiming | No; required before consumer integration | OWNER_DECISION_REQUIRED |
| Consumer cache/offline removal SLA | No-store/polling; push invalidation; bounded offline expiry | Fail closed with bounded freshness and explicit offline expiry | Revocation must remove stale awareness | No; required before consumer launch | OWNER_DECISION_REQUIRED |
| Organization verification renewal intervals | Fixed interval by level/type; event-driven review | Risk-based interval plus immediate review triggers | Identity confidence changes over time | No; required before live verification | OWNER_DECISION_REQUIRED |
| Platform staffing/recovery quorum | Two named admins; larger quorum/on-call | At least two named individual admins; two distinct approvers for ownership recovery | Avoids shared accounts and unilateral takeover | No; required before live platform governance | OWNER_DECISION_REQUIRED |
| Provider expansion | Email/password only; Google; Microsoft; combinations | Defer provider expansion until identity linking/recovery is separately contracted | Provider does not grant authorization but changes recovery risk | No | DEFERRED_POST_MVP |
| Lower-assurance viewer access | Keep TOTP floor; allow bounded AAL1 viewer later | Keep TOTP for MVP | Uses production-proven predicate and avoids privacy regression | No; contract already frozen for MVP | DEFERRED_POST_MVP |
| Custom roles/cross-org collaboration | Fixed templates only; custom roles; delegated sharing | Fixed templates only for MVP | Keeps permissions and tests bounded | No | DEFERRED_POST_MVP |

No SECURITY-CRITICAL contract item required for the Phase 21 disposable schema prototype remains `OWNER_DECISION_REQUIRED`. Phase 21 MUST stop if owner review reopens active-organization validation, MFA floor, ownership cardinality, permission enforcement, tenant isolation, or private/projection boundaries.

## 35. Phase 21 Allowed Scope

Phase 21 may create a **local/disposable neutral schema prototype only**, outside production migrations, to test:

- organization types/statuses and exactly-one-owner structural invariants;
- multiple memberships per user and one live membership per user/organization;
- fixed role templates and permission mapping tables/contracts;
- operational-scope and capability-grant shapes with synthetic references;
- private record types/statuses/revisions and append-only audit structures;
- projection-candidate/public-safe field separation with no consumer runtime;
- uniqueness, state transitions, rollback, and structural mappings for the security vectors;
- clean apply/rollback in an isolated local database using synthetic data only.

Phase 21 MUST NOT create a file under `supabase/migrations`, connect to Supabase/production, implement production Auth or managed Auth reads, expose a Data API schema, implement production RLS or RPCs, alter existing responder SQL/RPCs, build Dispatch UI/runtime, modify Consumer Gridly/mobile/public site, enable reporting/publishing, load real organizations/users, deploy, push, or merge.

Phase 21 must retain the Phase 18 responder package unchanged as regression evidence and clearly label all local identities/helpers as non-deployable fixtures. Production RLS/Auth/command work requires later separately authorized phases.

## 36. Exact Next Branch Recommendation

`RESPONDER-PHASE21-dispatch-neutral-local-schema-prototype`

Phase 21 entry requires owner review of this document and confirmation that no security-critical frozen decision is reopened. Pilot, retention, invitation delivery, scope-source, and consumer-presentation decisions may remain open because Phase 21 is disposable, synthetic, and non-production.

## Owner Review Verdict

**READY FOR OWNER CONTRACT REVIEW**
