# Gridly Dispatch Phase 21 Neutral Local Schema Prototype

Status: **LOCAL DISPOSABLE PROTOTYPE ONLY — NOT A PRODUCTION MIGRATION**

Authoritative input: `RESPONDER-PHASE20-DISPATCH-NEUTRAL-CONTRACT-FREEZE.md` at commit `b30aebba132e618fd55705a61259279173c7381e`.

## Outcome

The Phase 20 neutral Dispatch contract is representable in an isolated PostgreSQL 17.10 schema. The disposable rehearsal loaded synthetic multi-sector fixtures, exercised database roles and forced row-level security, passed the twenty requested schema-level security vectors, proved rollback, and removed its temporary cluster. It did not contact Supabase or any remote host.

## Prototype boundary

The prototype lives only under `tools/responder/phase21/`. It creates `dispatch_phase21_local`, two local NOLOGIN database roles, and synthetic login bindings inside a uniquely named local test cluster. It creates no file under `supabase/migrations/` and is not packaged as a production RPC or migration.

`local_actor_bindings` is deliberately labeled test-harness identity. It binds PostgreSQL `session_user` to a synthetic profile so callers cannot supply their own user UUID. It is not a substitute for future Auth, signed/live-user, or TOTP/AAL2 enforcement.

## Phase 20 schema mapping

| Frozen contract area | Local relational representation |
| --- | --- |
| Auth-linked profile | `profiles`; canonical synthetic auth UUID is the primary key |
| Neutral tenant | `organizations`; exact status, type, and verification enums |
| Membership and invitation | `organization_memberships`, `organization_invitations`; one live user/org membership and token digest only |
| Fixed authorization | `role_templates`, `permissions`, `role_permissions`; five roles, 20 organization permissions, six separate platform permissions |
| Request context | transaction-local requested-organization setting plus server-derived synthetic actor; selector is checked against live state |
| Operational boundary | version/source-bound `operational_scopes`; scope never supplies tenant authority |
| Public authority | time-bounded `capability_grants` bound to organization, exact capability identifier, scope, verification, and governance reference |
| Private work | organization-owned `operational_records`, `record_revisions`, and private `record_assignments` |
| Source lineage | append-only `record_provenance`, separate from record type |
| Publication boundary | `projection_candidates` followed by allowlisted `public_safe_projections`; eligibility is recomputed on read |
| Evidence | append-only `dispatch_audit_events` and `operation_receipts` |
| Ownership | deferred exactly-one-owner constraint and explicit, recipient-accepted local transfer simulation |
| Platform authority | `platform_admin_grants`, separate from organization membership and role mappings |

The local schema contains 20 base tables. Seventeen private/sensitive tables use enabled and forced RLS. The remaining reference tables are explicitly granted as read-only to the local app role. The public role can select only the allowlisted projection table.

## Constraints and prototype behavior

- Every non-`CLOSED` organization must end a transaction with exactly one active, unexpired `OWNER` membership. Deferred triggers permit atomic transfer but reject zero or two owners.
- Membership authorization requires an active profile, active membership, unexpired membership, active organization, matching organization context, and mapped permission.
- Organization type is classification only and is absent from authorization predicates.
- Scope and capability are independent checks. Capability eligibility requires matching organization and current scope, active intervals, adequate verification, matching record scope, and the candidate's current record revision.
- Record identity and organization are immutable. Updates advance `current_revision` by exactly one and follow the frozen lifecycle graph. Terminal records reject mutation.
- Revision, provenance, audit, and receipt relations reject update/delete/truncate. Receipt token digests demonstrate replay rejection.
- The public projection has only organization public identity, public source/taxonomy, sanitized content/location, and public time fields. A recursive JSON constraint rejects forbidden private keys at any nesting depth.
- Projection reads fail closed when the candidate, organization, scope, capability, verification, source revision, or expiry ceases to be eligible.

## Synthetic fixtures

Fixtures use reserved-looking synthetic UUIDs and `.invalid` identity data only. They model municipal public works, an electric utility, a suspended school district, and a closed fleet company. One user has active memberships in two organizations with different roles. Separate viewer, operator, organization-admin, disabled-membership, owner, and platform-admin actors cover authorization edges.

## Security vector results

All twenty requested vectors pass at the local schema/prototype level:

| # | Vector | Result |
| ---: | --- | --- |
| 1 | Guess another organization ID | PASS — forced RLS returns no private rows |
| 2 | Suspended membership | PASS — permission predicate denies |
| 3 | Revoked membership | PASS — permission predicate denies |
| 4 | Membership in two organizations | PASS — both contexts work independently |
| 5 | Different role per organization | PASS — owner/admin permission differs from operator permission |
| 6 | Viewer write | PASS — no table mutation grant |
| 7 | Operator admin action | PASS — `members.manage` denied |
| 8 | Organization admin platform action | PASS — platform permissions are absent from role mappings |
| 9 | Inactive organization | PASS — a real member of the suspended organization is denied |
| 10 | Expired capability | PASS — eligibility is false |
| 11 | Wrong scope | PASS — capability/scope mismatch is false |
| 12 | Private field projection | PASS — forbidden nested key rejected; public columns are allowlisted |
| 13 | Stale revision | PASS — non-sequential update rejected |
| 14 | Replay/idempotency | PASS — duplicate token digest rejected |
| 15 | Owner removal/orphaning | PASS — deferred commit fails |
| 16 | Direct cross-tenant private row | PASS — forced RLS returns no row |
| 17 | Platform admin becomes organization publisher | PASS — no organization permission or membership is acquired |
| 18 | Unauthorized projection | PASS — unapproved candidate rejected |
| 19 | Closed organization operates | PASS — a real member of the closed organization is denied |
| 20 | Organization type bypass | PASS — cross-type organization selection does not authorize |

Additional passing checks cover exact role-map cardinalities, exact permission counts, append-only mutation denial, live capability suspension hiding an existing projection, explicit owner-transfer acceptance, one-time transfer outcome, and isolated rollback.

## Prototype-only choices and deviations

There is no deviation from a frozen Phase 20 identifier, enum, role mapping, or tenant rule. The following implementation details are intentionally incomplete because this phase is disposable:

- `jsonb` holds local scope/location definitions; governed PostGIS topology and source adapters are deferred.
- Synthetic `session_user` bindings replace production Auth only in the harness. Live same-user evidence, TOTP/AAL2, AMR, factor verification, session revocation, and signed/live consistency are not simulated.
- RLS proves private read isolation. General production command functions, mutation policies, MFA gates, expected-revision receipts, two-approver platform recovery, and complete audit emission are deferred. Only ownership acceptance is simulated as an atomic local command.
- `EXPIRED` is derived from `valid_until`, as frozen, rather than stored as a capability status.
- The public-safe relation is a local boundary proof, not a Consumer Gridly integration.
- No compatibility bridge to responder production tables is attempted.

## Reproduction and teardown

From the repository root:

```powershell
& tools/responder/phase21/run-local-prototype.ps1
```

The runner discovers the installed PostgreSQL 17 binaries, allocates a loopback-only random port, initializes `%TEMP%\gridly-dispatch-phase21-<uuid>`, creates a random database, applies schema and fixtures, executes the Node test suite, rolls back the schema/roles, drops the database, stops PostgreSQL, validates the cleanup path, and recursively removes only that uniquely prefixed temporary directory. Environment variables that could redirect PostgreSQL or Supabase connectivity are removed from the child test environment.

## Phase 22 recommendation

Recommend **A. neutral local RLS/command prototype**. Phase 21 proved the relational shapes, read isolation, constraints, and projection boundary. The next highest-value risk reduction is to model the full frozen command envelope locally: production-shaped Auth/TOTP predicates, mutation authorization, expected revisions, receipts, immutable audit emission, invitation acceptance, and the two-person recovery flow. Do not start compatibility migration work until that command surface passes the Phase 20 concurrency and live-auth vectors.

Phase 22 is not implemented here.
