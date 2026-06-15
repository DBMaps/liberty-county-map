# V335 — DriveTexas Sanctioned Acquisition Contract Design

## Purpose

V335 defines the sanctioned acquisition contract that must exist before any DriveTexas shadow-ingestion implementation can be built.

This milestone is **contract, design, and audit only**. It does **not** approve live acquisition, network calls, polling, scheduled jobs, Supabase writes, local storage writes, shadow-store implementation, production ingestion, UI, alerts, markers, map layers, routing behavior, notifications, or production incidents.

## Context

V333 concluded:

- `readyForShadowIngestionPlanning: true`
- `readyForProductionIngestion: false`

V334 concluded:

- `readyForV335: true`
- `readyForProductionIngestion: false`

Gridly remains:

1. **Awareness Platform First**
2. **Route Intelligence Second**

Official-source events remain separate from community reports. Detour and alternate-route language remains awareness-only and must not become routing guidance.

## Audit helper

Run:

```js
window.gridlyDriveTexasAcquisitionContractAudit?.()
```

Expected identity and safety flags:

```js
{
  available: true,
  policyVersion: "V335",
  productionBehaviorChanged: false,
  liveAcquisitionImplemented: false,
  networkAccessImplemented: false,
  credentialsImplemented: false,
  storageImplemented: false,
  shadowStoreImplemented: false,
  uiChanged: false,
  mapChanged: false,
  routingChanged: false,
  readyForProductionIngestion: false
}
```

## Acquisition contract categories

### A. Static Export Contract

A sanctioned static export is a non-live, audit-only payload bundle. It may be used only for sanctioned replay, planning, and sample validation.

Required fields:

- source name
- export timestamp
- record id
- event type / condition
- lifecycle status
- last updated timestamp
- roadway identity
- location text
- geometry or coordinate payload
- attribution text

Readiness classification: `ready_for_shadow_planning`.

### B. Feed Export Contract

A sanctioned feed export is a recurring or batch export contract. It includes all Static Export Contract fields plus recurring-feed metadata.

Required fields include everything in the Static Export Contract plus:

- feed generated timestamp
- batch id
- sequence or version id
- removed/reopened representation
- update cadence expectation

Readiness classification: `needs_contract_review`.

Feed exports require contract review before implementation because recurrence, batch identity, sequence/version behavior, removed/reopened representation, update cadence, replay/archive expectations, and governance obligations must be approved first.

### C. Future API Contract

A future API contract includes all Feed Export Contract fields plus API-specific operational and legal requirements.

Required fields include everything in the Feed Export Contract plus:

- endpoint ownership
- authentication/credential policy
- rate limit policy
- retry policy
- cache policy
- retention policy
- failure handling policy
- attribution/display requirement
- terms-of-use review requirement

Readiness classification: `not_ready`.

API acquisition is not implementation-ready. It cannot begin until sanctioned access, endpoint ownership, credentials, authentication, rate limits, retry behavior, caching, retention, failure handling, attribution/display, and terms-of-use requirements are reviewed and approved.

## Governance requirements

Before any DriveTexas acquisition implementation can exist, the following governance requirements must be reviewed and approved:

- approved acquisition path
- attribution policy
- credential policy
- cache policy
- retention policy
- replay/archive policy
- rate-limit policy
- failure policy
- audit logging policy
- terms-of-use review

These requirements are defined by V335, but definition is not implementation approval.

## Readiness summary

| Acquisition type | Readiness | V335 decision |
| --- | --- | --- |
| Static export | `ready_for_shadow_planning` | May be used only for sanctioned, audit-only replay/planning or sanctioned sample validation. |
| Feed export | `needs_contract_review` | Requires contract review before implementation. |
| Future API | `not_ready` | Not implementation-ready. |

## Blocker summary

### Static export blockers

None for sanctioned, audit-only replay/planning.

### Feed export blockers

- Feed generated timestamp, batch identity, sequence/version behavior, update cadence, and removed/reopened semantics require contract review before implementation.
- Replay/archive expectations for recurring feed bundles must be approved before any shadow feed pipeline is built.

### API blockers

- Endpoint ownership, credentials, authentication, rate limits, retry behavior, cache policy, retention policy, failure handling, attribution/display duties, and terms-of-use review are not approved.
- No API implementation may begin until sanctioned access and governance policies are reviewed.

### Governance blockers

- Production-grade acquisition governance is documented as required but not approved for implementation.
- Credential, cache, retention, replay/archive, rate-limit, failure, audit logging, attribution, and terms-of-use policies must be reviewed before live or recurring acquisition.

### Production blockers

- Production ingestion is not approved.
- No live acquisition, network access, credentials, storage, shadow store, UI, map, routing, alert, notification, or production incident behavior is implemented.
- Feed export and API acquisition contracts require review before implementation.
- A separate production approval gate is required before any official-source ingestion writes or user-facing behavior changes.

## Production-safety conclusions

- Static exports may be used only for sanctioned, audit-only replay/planning.
- Feed exports require contract review before implementation.
- API acquisition is not implementation-ready.
- Production ingestion is not approved.
- No credentials are implemented.
- No network access is implemented.
- No storage is implemented.
- No UI, map, routing, marker, layer, alert, notification, or production incident behavior is changed.
- Official-source events remain separate from community reports.
- Detour language remains awareness-only and is not routing guidance.

## Recommendation

Proceed to V336 only if it remains audit-only shadow pipeline planning or sanctioned sample validation. Do not implement live acquisition, fetch requests, API calls, polling, scheduled jobs, Supabase writes, local storage writes, shadow-store persistence, UI, map layers, alerts, notifications, routing behavior, or production ingestion.
