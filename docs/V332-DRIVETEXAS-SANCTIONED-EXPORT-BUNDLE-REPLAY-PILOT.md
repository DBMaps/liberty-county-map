# V332 — DriveTexas Sanctioned Export Bundle Replay Pilot

## Purpose

V332 adds an audit-only replay pilot for a larger static, approved, non-live DriveTexas export bundle. It validates whether DriveTexas-style records can be replayed over simulated time while preserving Gridly's product posture: Awareness Platform First, Route Intelligence Second.

## Scope Guardrails

- Audit-only helper: `window.gridlyDriveTexasExportBundleReplayAudit?.()`.
- No live DriveTexas ingestion.
- No external network calls.
- No UI, map, marker, alert, routing, Supabase, crossing, community-report, or production behavior changes.
- Static fixture data is embedded in the existing DriveTexas audit-only section of `js/app.js`.

## Fixture Coverage

The replay bundle includes three simulated snapshots covering:

- Stable official event identity updated over time.
- Crash resolved/removed behavior.
- High-water update cadence.
- Flooded roadway continuing over multiple snapshots.
- Road closure reopened behavior.
- Long-duration construction updates.
- Lane closure records.
- Detour/alternate-route language retained as awareness context only.
- Road/county-only records that are not marker-ready.
- Geometry-rich records that are marker-ready in audit evidence only.

## Reused V326/V330/V331 Concepts

The pilot reuses the existing DriveTexas audit helpers and concepts:

- `classifyDriveTexasEvent()` for V326-style canonical event normalization.
- `parseDriveTexasStaticExportRecord()` for V331 static export parsing.
- V330 shadow ingestion compatibility concepts such as official-source trust labels, lifecycle states, community counts, non-renderable incidents, and no production incident creation.

## Audit Contract

The helper returns the V332 contract:

- `available: true`
- `policyVersion: "V332"`
- `productionBehaviorChanged: false`
- `liveIngestionUsed: false`
- `externalNetworkUsed: false`
- `uiChanged: false`
- `mapChanged: false`
- `routingChanged: false`
- Replay, normalization, lifecycle, identity, marker-readiness, awareness-only, and V330 compatibility counts.
- Per-record rows with snapshot id/time, official id, normalized stable id, canonical type, lifecycle status, trust label, geometry readiness, marker readiness, awareness-only reason, identity stability result, and V330 compatibility result.

## Explicit Proof Points

V332 explicitly proves that:

1. Detour and alternate-route language remains awareness context only and is never treated as routing.
2. Road/county-only records are not treated as exact markers.
3. Official source events stay separate from community reports.
4. Production behavior does not change.

## Expected Validation

Run:

```bash
node --check js/app.js
git diff --check
```

Manual browser validation:

```js
window.gridlyDriveTexasExportBundleReplayAudit?.()
```

Expected highlights:

- `available: true`
- `policyVersion: "V332"`
- `productionBehaviorChanged: false`
- `liveIngestionUsed: false`
- `externalNetworkUsed: false`
- `uiChanged: false`
- `mapChanged: false`
- `routingChanged: false`
- `failedNormalizationCount: 0`
- `identityInstabilityCount: 0`
- `v330CompatibilityIssueCount: 0`
- `detourTreatedAsRouting: false`
- `safeForNextOfficialSourceMilestone: true`
