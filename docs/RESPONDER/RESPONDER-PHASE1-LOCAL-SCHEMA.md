# Responder Phase 1 local private schema fixture

Implementation version: `responder.agency.v1.phase1.1`. Frozen source contract: `responder.agency.v1.phase0.1` at commit `808c20bd4172b0644f8d1d997d2352413ed1bc21`. This is disposable local SQL under `db/responder-local`, **not** a production migration, Supabase deployment, Auth integration, RLS policy, command RPC, dashboard, or consumer projection.

## Files and execution boundary

- [Apply](../../db/responder-local/001_agency_private_apply.sql) creates only `agency_private` objects and two local fixture roles. The disposable database must already have PostGIS 3.6.2 installed. It never changes `public.reports`, `reporting_enabled`, community replay evidence, device links, or production migration history.
- [Rollback](../../db/responder-local/001_agency_private_rollback.sql) drops only `agency_private` and the two responder fixture roles. It does not drop PostGIS or any shared table.
- [Test harness](../../tests/responder-phase1-local-schema.test.mjs) refuses a non-loopback host, requires an explicit port/user and an expected `gridly-responder-phase1-*` data directory under Temp, verifies that the connected server owns that exact directory and is PostgreSQL 17.10/PostGIS 3.6.2, creates a unique database, registers teardown, and drops it after apply/rollback/reapply tests. It uses only synthetic UUIDs and square geometry.
- [Vector mapping](../../reports/responder/responder-phase1-vector-map.json) classifies every frozen Phase 0 vector. No full command vector is executable yet because Phase 1 has no Auth, bounded command status, or consumer visibility implementation. Structural analogues of N25, N28, N29, and N33 are exercised without claiming the corresponding full vectors passed.

An example for an **already initialized disposable** cluster, using PowerShell:

```powershell
$env:RESPONDER_LOCAL_PGPORT = '55461'
$env:RESPONDER_LOCAL_PGUSER = 'gulfi'
$env:RESPONDER_LOCAL_PGDATA = 'C:\Users\gulfi\AppData\Local\Temp\gridly-responder-phase1-preflight-20260914-01'
node tests/responder-phase1-local-schema.test.mjs
```

The example path is a disposable fixture identity, not a persistent project setting. The harness creates and drops its own uniquely named database; its caller owns cluster startup and shutdown.

## Ten-table contract

| Table | Structural purpose and critical constraints | Targeted indexes |
| --- | --- | --- |
| `organizations` | Private legal/public identity, canonical unique key, verification `requested/pending_review/verified/rejected/revoked`, operation `inactive/active/suspended`, private contact fields, operation epoch; active requires verified. No verified or active default. | Verification/operation, public name; canonical unique key. |
| `organization_memberships` | Auth-compatible placeholder user UUID, one row per org/user, one **active** org per user via partial unique index, four agency roles and invited/active/suspended/revoked states; no GRIDLY_ADMIN membership. | Org/status/role; user/status; unique active user. |
| `organization_authorities` | County-only `Polygon,4326`, Texas-format FIPS, source path/hash/schema, effective interval, reviewer and version. Valid nonempty polygon, one approved version per org/county, monotonically increasing version, immutable approved provenance, terminal revoked row, no hard delete. | Org/status/effective dates, polygon GiST, approved unique. |
| `agency_updates` | Fixed `AGENCY_OFFICIAL`, exact five condition types, bounded visible copy, `Point,4326`, same-org authority FKs, status `draft/pending_review/active/resolved/withdrawn`; `effective_expired` is derived. Revision starts at **0**, increments exactly one per SQL update. Active rows require current authority, activation, and expiry within 24 hours. Terminal/effectively expired rows cannot reactivate; hard delete denied. | Org/status/expiry, condition, point GiST. |
| `agency_update_events` | Append-only bounded snapshots, actor, authority, operation UUID and unique update/revision; same-org update/authority FKs. | Org/time, update/revision unique, optional operation UUID. |
| `organization_verification_events` | Append-only reviewer, bounded method references, transition states, reason and time. | Org/time. |
| `organization_governance_events` | Append-only actor, same-org optional membership/authority, bounded before/after snapshots, reason and correlation. | Org/time, optional correlation. |
| `organization_invites` | Normalized intended email, proposed agency role, 32-byte digest only, created/redeemed/expired/revoked states and expiry. Advisory-locked insert rejects another **unexpired** created invite for an org/email; an effectively expired row does not block a new invite. Expired redemption and terminal mutation fail. | Digest unique, org/email/status, pending expiry. |
| `agency_operation_receipts` | Separate agency digest primary key, actor/org/update binding, payload digest, bounded result and acceptance time. No raw token column. Append-only. | Org/time, actor/time. |
| `agency_program_controls` | One key `1` row; `agency_publishing_enabled` defaults and initializes **false**, policy version and change metadata. Duplicate or removal is denied. | Singleton primary key only. |

The organization type is a storage classification, never an authority grant. `impact_level` is bounded text because Phase 0 did not approve an exact severity enum. The FIPS format check is structural; existence in the canonical 254-county source and point-in-polygon decisions remain Phase 3 authority logic. The fixture polygon is deliberately synthetic and grants no real-world county permission.

## Local write boundary and next phase

The private schema is revoked from PUBLIC. `responder_app_fixture` has no schema usage or table grants; direct inserts, updates, and deletes of updates, events, authorities, and controls are denied. `responder_owner_fixture` can read and set up private fixture rows but cannot update/delete/truncate append-only events or receipts, or delete/truncate updates, authorities, or the singleton control. SQL guards test structural lifecycle and revision rules; they do not authenticate a real user or append an event automatically. Future commands must make accepted row changes and event append atomic, verify `aal2`, reviewer separation, county scope, and the independent agency gate. No app role is mapped to production Supabase roles here.

Phase 2 may begin only after owner review of this local fixture. It must implement a separately scoped local Auth/MFA integration contract before any command or dashboard claim. No publication gate, consumer output, production RLS, or runtime behavior is activated by this phase.
