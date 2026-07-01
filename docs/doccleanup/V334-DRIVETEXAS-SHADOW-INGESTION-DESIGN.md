# V334 — DriveTexas Sanctioned Shadow Ingestion Design

V334 defines the first sanctioned shadow-ingestion architecture for DriveTexas official-source data. This milestone is architecture and audit only: no production ingestion, no live data, no network calls, and no user-facing behavior changes.

V333 concluded `readyForShadowIngestionPlanning: true` and `readyForProductionIngestion: false`. V334 accepts only the planning readiness outcome and does not approve production ingestion.

## Required conclusion

- Production ingestion is **not approved**.
- Live acquisition is **not implemented**.
- Shadow incidents remain **non-production**.
- Official-source events remain separate from community reports.
- Detour and alternate-route language remains awareness-only.
- Gridly remains an awareness platform: Awareness Platform First, Route Intelligence Second.

## Architecture flow

```text
Sanctioned Export
↓
Acquisition Layer
↓
Validation Layer
↓
Normalization Layer
↓
Identity Layer
↓
Lifecycle Layer
↓
Trust Layer
↓
Shadow Incident Store
↓
Audit Layer
```

The flow is a design contract only. It does not create fetches, polling, APIs, background jobs, Supabase writes, map layers, markers, awareness cards, alerts, notifications, routing behavior, or production incident generation.

## Acquisition layer

The acquisition layer describes acceptable future source shapes. It does not implement any live acquisition.

### Static export ingestion

- Accept manually sanctioned DriveTexas export files for offline audit review.
- Preserve the original file name, export timestamp, source attribution, and checksum in audit evidence.
- Reject ad-hoc scraped data and unsanctioned copies.
- Require replay/archive retention rules before repeated use.

### Feed export ingestion

- Accept sanctioned export bundles captured outside Gridly production behavior.
- Preserve bundle id, snapshot timestamps, record counts, and source attribution.
- Validate bundle order before replaying lifecycle transitions.
- Treat feed exports as replay evidence only until production ingestion is separately approved.

### Future API ingestion

- Requires a separate sanctioned API contract, credential policy, attribution policy, rate-limit policy, retention policy, and incident-response plan before implementation.
- No API client, endpoint, fetch request, polling loop, scheduled job, or live credential handling is added in V334.
- API data must remain quarantined from production incidents until a later production gate approves writes and behavior.

### Acquisition governance requirements

- **Attribution:** every shadow record must retain DriveTexas/TXDOT source attribution, source id, export id, and export timestamp.
- **Rate limits:** future recurring acquisition must document official rate limits and backoff behavior before implementation.
- **Retention:** raw exports, normalized shadow records, and audit decisions must have explicit retention windows before storage exists.
- **Replay/archive:** every recurring export must be replayable from immutable archives so identity, lifecycle, stale, removal, and reopen behavior can be audited.

## Validation layer

Required checks before a record can enter the shadow incident store design:

1. **Schema validation** — verify the sanctioned export shape and supported field aliases.
2. **Required fields** — require official source id, event type, lifecycle/status value, update timestamp, roadway/county context, and source attribution.
3. **Identity validation** — verify a stable official id or documented fallback identity strategy; reject identities that collide with community reports.
4. **Geometry validation** — classify geometry as marker-grade, segment-grade, area-level, or unsupported. Unsupported geometry is quarantined from shadow incident readiness.
5. **Lifecycle validation** — accept only planned lifecycle states: active, updated, removed, reopened, or stale.
6. **Timestamp validation** — require parseable source update timestamps and export snapshot timestamps; flag future, missing, or non-monotonic values for audit review.

Validation failures do not become production incidents and do not render.

## Normalization layer

The normalization layer maps official DriveTexas vocabulary into the existing Gridly canonical awareness taxonomy validated by V326 through V333. It preserves raw source text, normalized type, confidence, flood-related classification, and lifecycle class.

Normalization remains audit-only. Ambiguous records are retained as evidence for review and are not forced into user-facing labels.

## Identity layer

- **Official source ids:** primary identity must use DriveTexas/TXDOT official ids when present.
- **Stable identity generation:** future fallback identity may be generated only from sanctioned stable fields such as source system, official id, route, county, event type, and source timestamp. Fallback identity must be deterministic and auditable.
- **Update behavior:** updates with the same official identity modify only the shadow incident version history in the design, not production state.
- **Remove behavior:** removed records close or tombstone the shadow identity in audit state only.
- **Reopen behavior:** reopened records retain official identity lineage and are treated as lifecycle transitions, not new community reports.
- **Community separation:** official identities are separate from community report ids. Community evidence may annotate trust context but may not overwrite official identity or lifecycle authority.

## Lifecycle layer

Supported lifecycle states:

- `active` — official source indicates the event is current.
- `updated` — official source has changed details for the same official identity.
- `removed` — official source removed or cleared the event.
- `reopened` — official source states the road/event reopened or closure ended.
- `stale` — official source remains unresolved beyond the approved freshness threshold.

Lifecycle state is audit-only until a separate production gate approves ingestion and write behavior.

## Trust layer

V334 uses only the already justified trust labels:

- `Official Source`
- `Official Source + Community Active`
- `Official Source + Community Confirmed`
- `Stale Official Source`

No new trust labels are added. Community evidence may increase context but does not merge official and community records.

## Shadow incident store design

The shadow incident store is a design artifact only. It is not implemented in memory, local storage, Supabase, production incident tables, or any background system.

### Record structure

- `shadowIncidentId` — official-only stable identity.
- `source` — DriveTexas/TXDOT attribution and export metadata.
- `officialSourceId` — official source id or approved deterministic fallback.
- `normalizedType` — Gridly canonical awareness type.
- `rawSourceType` — original DriveTexas vocabulary.
- `geometry` — validated geometry or area-level context.
- `lifecycleState` — active, updated, removed, reopened, or stale.
- `trustState` — one of the V334 trust labels.
- `auditOnly` — always true.
- `productionIncident` — always false.
- `renderable` — always false.

### Evidence structure

- Raw sanctioned record reference.
- Export or bundle id.
- Snapshot timestamp.
- Parser and validation results.
- Normalization decision and confidence.
- Identity decision and collision checks.
- Lifecycle transition evidence.
- Trust-context evidence.
- Attribution and retention metadata.

## Production safeguards

- Shadow incidents do not render.
- Shadow incidents do not create alerts.
- Shadow incidents do not create notifications.
- Shadow incidents do not create markers.
- Shadow incidents do not create awareness cards.
- Shadow incidents do not create map layers.
- Shadow incidents do not modify routing.
- Shadow incidents do not write production state.
- Shadow incidents do not write Supabase records.
- Shadow incidents do not generate production incidents.

## Audit helper

V334 exposes:

```js
window.gridlyDriveTexasShadowIngestionDesignAudit?.()
```

Expected key output:

```js
{
  available: true,
  policyVersion: "V334",
  productionBehaviorChanged: false,
  liveIngestionImplemented: false,
  networkAccessImplemented: false,
  shadowStoreImplemented: false,
  uiChanged: false,
  mapChanged: false,
  routingChanged: false,
  officialCommunitySeparationPreserved: true,
  detourRemainsAwarenessOnly: true,
  readyForProductionIngestion: false
}
```

## Remaining blockers

- Production ingestion approval remains absent.
- Approved live acquisition method remains absent.
- Attribution, rate-limit, retention, replay/archive, caching, and credential policies remain incomplete.
- Recurring official export behavior has not validated removal, stale, reopen, and identity cadence for production.
- Shadow incident storage and audit archives remain design-only.
- UI, map, alert, notification, and routing integration remain explicitly out of scope.

## Merge recommendation

Merge V334 only as an architecture and audit milestone. The next milestone may proceed to V335 audit planning, but production ingestion must remain blocked until a separate production approval gate explicitly authorizes live acquisition, storage, and user-facing behavior.
