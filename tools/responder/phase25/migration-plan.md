# Phase 25 migration plan

**DESIGN ONLY — NOT AUTHORIZED FOR PRODUCTION EXECUTION**

## Target inventory

The target contains 22 tables. `RLS` below means enabled and forced. Every write
is command-owned unless explicitly described as static seed installation.

| # | Table | Schema | Purpose / key relationships | Sensitive data | Retention class | Client classification |
|---:|---|---|---|---|---|---|
| 1 | `profiles` | `dispatch_private` | PK `user_id`; canonical link to `auth.users.id`; current eligibility only | Auth UUID, display name, status | CURRENT_SECURITY | READ VIA RLS (self) |
| 2 | `organizations` | `dispatch_private` | PK UUID; typed tenant, verification/status, governance revision | legal identity, governance state | CURRENT_GOVERNANCE | READ VIA RLS |
| 3 | `role_templates` | `dispatch_private` | PK frozen role enum | none | REFERENCE_STATIC | NO CLIENT ACCESS; optional API summary view |
| 4 | `permissions` | `dispatch_private` | PK frozen permission key and scope class | none | REFERENCE_STATIC | NO CLIENT ACCESS; optional API summary view |
| 5 | `role_permissions` | `dispatch_private` | composite PK/FKs to roles and permissions | authorization map | REFERENCE_STATIC | NO CLIENT ACCESS; optional API summary view |
| 6 | `organization_memberships` | `dispatch_private` | tenant/user membership; one live pair; one active owner | roles, status, timestamps | CURRENT_GOVERNANCE + HISTORY | READ VIA RLS; COMMAND-ONLY WRITE |
| 7 | `organization_invitations` | `dispatch_private` | tenant target, digest-only token, lifecycle, inviter FK | target identity, digest | EPHEMERAL_SECURITY | READ VIA RLS; COMMAND-ONLY WRITE |
| 8 | `operational_scopes` | `dispatch_private` | tenant-owned typed/versioned scope and governed source | governed geometry/reference metadata | CURRENT_GOVERNANCE | READ VIA RLS; COMMAND-ONLY WRITE |
| 9 | `operational_scope_members` | `dispatch_private` | normalized ordered members for county/route/facility sets | governed external identifiers | CURRENT_GOVERNANCE | NO CLIENT ACCESS; summarized through scope API |
| 10 | `platform_admin_grants` | `dispatch_private` | user/permission PK, independent platform plane | platform authority | CURRENT_SECURITY + HISTORY | PLATFORM-ONLY |
| 11 | `capability_grants` | `dispatch_private` | tenant/capability/scope/version/effective interval | public-authority evidence reference | CURRENT_GOVERNANCE + HISTORY | READ VIA RLS; PLATFORM-ONLY WRITE |
| 12 | `operational_records` | `dispatch_private` | tenant private record and current revision pointer | private content, priority, location | PRIVATE_OPERATIONAL | READ VIA RLS; COMMAND-ONLY WRITE |
| 13 | `record_assignments` | `dispatch_private` | record/member assignments; one current assignment | workforce identity | PRIVATE_OPERATIONAL | READ VIA RLS; COMMAND-ONLY WRITE |
| 14 | `record_provenance` | `dispatch_private` | record revision/source/scope/capability lineage | author and governance lineage | IMMUTABLE_HISTORY | NO CLIENT ACCESS; APPEND-ONLY COMMAND WRITE |
| 15 | `ownership_transfers` | `dispatch_private` | one pending transfer per tenant; from/to memberships | ownership reason and parties | GOVERNANCE_HISTORY | READ VIA RLS; COMMAND-ONLY WRITE |
| 16 | `ownership_recovery_cases` | `dispatch_private` | case, target tenant/member, state, two-person outcome | recovery evidence reference | SECURITY_GOVERNANCE | PLATFORM-ONLY |
| 17 | `recovery_approvals` | `dispatch_private` | case/approver PK; distinct Auth/session evidence | platform actor/session | SECURITY_GOVERNANCE | PLATFORM-ONLY; APPEND-ONLY |
| 18 | `record_revisions` | `dispatch_audit` | record/revision unique snapshot and actor membership | historical private payload | IMMUTABLE_HISTORY | READ VIA RLS; APPEND-ONLY |
| 19 | `command_receipts` | `dispatch_audit` | org/actor/command/idempotency unique domains and request hash | replay/session evidence | IDEMPOTENCY_HISTORY | NO CLIENT ACCESS; APPEND-ONLY |
| 20 | `audit_events` | `dispatch_audit` | identity PK; bounded actor/target/correlation event | business/governance history | IMMUTABLE_HISTORY | READ VIA RLS; APPEND-ONLY |
| 21 | `projection_candidates` | `dispatch_projection` | source revision, capability, review, sanitized payload | review actors and private correlation | PROJECTION_HISTORY | READ VIA RLS; COMMAND-ONLY WRITE |
| 22 | `public_safe_projections` | `dispatch_projection` | candidate lineage, exact public allowlist, expiry | public-safe only | PUBLIC_DERIVED + HISTORY | PUBLIC-SAFE READ; COMMAND-ONLY WRITE |

All organization-owned foreign keys carry `organization_id` in the referenced
key to prevent cross-tenant linkage. Immutable history uses `ON DELETE RESTRICT`
or retained UUID evidence; no cascade from Auth, organization, or membership may
erase audit, revision, receipt, provenance, or projection history.

## Type and value freeze

The exact values are declared in `schema-design.sql`. Prototype-only values that
must not ship are Phase 21 login roles/bindings; Phase 22 synthetic sessions and
failure injections; Phase 23 synthetic Auth tables/claims; and every `_local`
schema name. Capability identifiers remain constrained text rather than a
Postgres enum so future additions can be governed migrations without rewriting
dependent column types.

## Operational scope representation

| Scope | Relational representation | Governed spatial/reference requirement | Production gate |
|---|---|---|---|
| COUNTY | one `operational_scope_members` row with canonical FIPS | reuse certified county geometry/version; strict containment/edge denial for publication | fresh county inventory |
| MULTI_COUNTY | ordered, unique county member rows | immutable governed set/version | owner data-source approval |
| STATEWIDE | scalar jurisdiction code/version | explicit governed state identity, never implicit county expansion | platform approval |
| SERVICE_TERRITORY | canonical dataset/reference plus Polygon/MultiPolygon snapshot reference | reviewed topology and source license | owner data-source approval |
| CORRIDOR | normalized governed segment member rows | linear network version and tolerance semantics | owner data-source approval |
| ROUTE | ordered roadway/transit segment or stop rows | network/route version | owner data-source approval |
| FACILITY | canonical facility member/reference | governed identity and boundary/location version | privacy/authority review |
| SITE | organization site member/reference | governed point/polygon and public-location review | privacy/authority review |
| NON_GEOGRAPHIC | scalar explicit marker; no members/geometry | no public projection by default | future capability decision |

Relational membership is authoritative when cardinality matters. JSON metadata
is limited to non-authoritative descriptive attributes and never grants scope.

## Deterministic migration order

1. Read-only preflight and owner-bound package/hash assertion.
2. Recovery checkpoint/PITR evidence and rollback operator confirmation.
3. Create unexposed schemas and minimal NOLOGIN owner role if approved.
4. Create types/domains and extension dependencies without version pinning.
5. Create core/private tables in FK order.
6. Create immutable audit/evidence and projection tables.
7. Add composite tenant FKs, checks, unique/partial indexes, and query indexes.
8. Seed frozen role templates, permissions, and role-permission mappings only.
9. Create private Auth/authorization helpers and append-only triggers.
10. Enable and force RLS; create the exact policy allowlist.
11. Create private command implementations and exposed invoker wrappers.
12. Create compatibility objects only for the preflight-selected mode.
13. Revoke defaults, grant exact usage/read/execute allowlists, and configure no exposure by SQL.
14. Run postflight in the same controlled window; fail closed on any mismatch.
15. Data API exposure of `dispatch_api` is a separate owner-controlled configuration gate.

## Production gates

No package may be manufactured until Phase 26. No production attempt may occur
until an exact-version clone passes apply, adversarial Auth/RLS/command tests,
rollback modes, deterministic reapply, advisors, and catalog fingerprinting.
Production additionally requires a fresh read-only inventory, verified backup,
explicit project/operator/window authorization, approved owner decisions, and a
postflight/rollback incident team.
