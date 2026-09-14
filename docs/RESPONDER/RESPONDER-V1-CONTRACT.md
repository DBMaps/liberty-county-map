# Responder / Agency V1 contract freeze

Contract version: `responder.agency.v1.phase0.1`
Status: **repository design contract; owner approval pending**. This package defines intended future behavior. It creates no agency runtime, schema, grant, user, publication channel, or production authorization.

## Frozen V1 invariants

- One active organization per responder; individual Supabase Auth identity; authenticator-app TOTP (`aal2`) for responder dashboard access and every agency mutation. An unaffiliated claim request may begin at `aal1` but grants no agency permission.
- Roles are `VIEWER`, `RESPONDER`, `SUPERVISOR`, `AGENCY_ADMIN`, and platform-scoped `GRIDLY_ADMIN`. Gridly Admin governs organizations; it does not impersonate an agency publisher.
- `agency_publishing_enabled` defaults **false**, is independent of community `reporting_enabled`, and gates activation, active-content edits/renewals, and public agency reads. It does not obstruct draft preparation, resolution/withdrawal, offboarding, or governance while off.
- `AGENCY_OFFICIAL` is its own lineage. It never writes `public.reports`, `report_retention.replay_evidence`, `report_retention.device_links`, or community receipts, and never labels agency content as DriveTexas, NWS, crossing authority, community reporting, or a Gridly system notice.
- Every public agency update is Supervisor-reviewed. `road_closed` additionally requires an approver with a different authenticated user ID from the draft author, including when that author is a Supervisor or Agency Admin.
- V1 types are exactly `road_closed`, `high_water`, `obstruction`, `construction`, and `public_works_notice`. Active updates default to 12 hours and cannot exceed 24 hours; no automatic renewal or Cron is assumed.
- V1 publication is county-first. A canonical five-digit Texas county FIPS and a separately approved, versioned county polygon are necessary. A PLACE GEOID, presentation point, or county-membership list is never an authority polygon. Municipal and district publication remain closed.
- Consumers may see an approved organization identity labeled “Verified Agency” and an “Agency update”; responder names, Auth identifiers, roles, contacts, review evidence, and audit content remain private. A badge verifies organization identity, not Gridly confirmation of the condition.
- Every accepted command is atomic with an append-only event and agency-specific operation receipt. Business-state denial leaves no partial business write. Bounded denial telemetry is distinct from update/governance history.

## Contract map

| Area | Normative artifact |
| --- | --- |
| Roles and action identifiers | [Role matrix](RESPONDER-V1-ROLE-MATRIX.md) |
| Allowed and prohibited transitions | [State machines](RESPONDER-V1-STATE-MACHINES.md) |
| Command actions, payloads, statuses, replay | [Command contract](RESPONDER-V1-COMMAND-CONTRACT.md) |
| County source and geographic checks | [Authority contract](RESPONDER-V1-AUTHORITY-CONTRACT.md) and [county manifest](../../reports/responder/responder-v1-county-authority-manifest.json) |
| Public/private field classification | [Consumer projection](RESPONDER-V1-CONSUMER-PROJECTION.md) |
| Independent source lineage | [Source governance](RESPONDER-V1-SOURCE-GOVERNANCE.md) |
| Frozen versus open owner decisions | [Owner decisions](RESPONDER-V1-OWNER-DECISIONS.md) |
| Next local-only gate | [Phase 1 entry gate](RESPONDER-V1-PHASE1-ENTRY-GATE.md) |
| Synthetic non-executing cases | [Negative vectors](../../tests/contracts/responder/responder-v1-negative-vectors.json) and [positive vectors](../../tests/contracts/responder/responder-v1-positive-vectors.json) |

## Existing Gridly boundary

The current [community protocol-v2 migration](../../supabase/migrations/20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql) owns `reporting_enabled`, community replay evidence, device links, and `public.reports`. This contract does not change or reuse them. The [official-source strategy](../doccleanup/V339-OFFICIAL-SOURCE-PRODUCT-INTEGRATION-STRATEGY.md) requires source-separated presentation and forbids implied confirmation. Existing [owner export](../../tools/retention/owner-export.mjs) and [archive](../../tools/retention/owner-archive.mjs) patterns may inform future agency manifests and redaction, but their data classes and privacy rules are not copied. No consumer direct write path is created.

The current [county geometry manifest](../../assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json) approves package generation but explicitly reports `activateRuntimeAuthorized=false` and `deployAuthorized=false`. Its bytes are a proposed V1 county-source candidate, **not** approved agency runtime activation or deployment.

## Non-executing vector vocabulary

Each JSON vector explicitly records `actorRole` (one of the five roles or `null` for public/invitee), `actorClass`, organization verification/operation state, membership state, `aal`, authority scenario, optional update/invite state, canonical `action`, fixed `payloadCondition`, bounded `expectedResult`, expected business/receipt side effects, audit behavior, and public visibility. The common fixture catalog is synthetic and is **not** an assertion that its square is the real county polygon. `expectedAuditBehavior=bounded_denial_telemetry_only` means no agency business event is written; a separate minimal security log may record the denial. `time_derived_no_event` covers expiry without Cron. The [state machines](RESPONDER-V1-STATE-MACHINES.md) and [authority contract](RESPONDER-V1-AUTHORITY-CONTRACT.md) define all state labels.
