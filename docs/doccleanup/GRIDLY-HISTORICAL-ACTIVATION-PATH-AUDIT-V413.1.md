# Gridly Historical Activation Path Audit V413.1

## Current state

Gridly remains Awareness Platform First, Route Intelligence Second. This audit is documentation-only and does not activate capture, activate the writer, modify production behavior, modify Supabase, create writes, add historical reads, add history UI, or change protected live systems.

The current runtime contains two different historical-related paths:

1. Existing local in-app hazard/crossing history helper calls in `js/app.js` that are outside this V413.1 storage activation path.
2. The passive Phase 1A sidecar path under `js/history-capture/`, which is the only path that can build a `history_capture.phase_1a.v1` envelope and call the historical writer.

The Phase 1A sidecar code is present in repository files and covered by tests, but it is not currently loaded by `index.html`. `index.html` loads Leaflet, Supabase JS, optional local overrides, `js/gridlyTxdotService.js`, `js/gridlyTxdotGeometryRetentionPrototype.js`, `js/gridlyRouteWatchGeometryRuntimeShadowAudit.js`, and `js/app.js`; it does not load any `js/history-capture/*.js` files. Therefore, in the production browser runtime represented by `index.html`, `window.gridlyPassiveHistoryCapturePhase1A` is not created by the loaded scripts, and the app-level hook wrapper returns without calling capture.

Even if the Phase 1A sidecar files are loaded by a test harness or future runtime, the default flag module returns all capture/write/read/UI gates disabled. The capture gate defaults to `captureEnabled: false`; the writer also requires a separate per-call `options.writerEnabled === true`; and the writer requires a storage client passed as `options.storageClient`.

## Activation flow diagram

```text
Production report success boundary
  |
  | js/app.js calls gridlyTryPassiveHistoryCapturePhase1A(eventInput)
  v
Is window.gridlyPassiveHistoryCapturePhase1A.capturePhase1AEvent available?
  |-- no --> return silently; no event emitted; no write
  |-- yes
       v
capturePhase1AEvent(eventInput)
  |
  v
readFlags().captureEnabled === true?
  |-- no --> monitor disabled_capture in memory; return noop
  |-- yes
       v
Is eventType supported? report_created or report_cleared
  |-- no --> return unsupported noop
  |-- yes
       v
Can build history_capture.phase_1a.v1 envelope?
  |-- no --> return envelope-unavailable noop
  |-- yes
       v
Can compute idempotency key?
  |-- no --> writer later classifies malformed/noop
  |-- yes
       v
writePhase1AEnvelope(envelope, { idempotencyKey, hook })
  |
  v
options.writerEnabled === true?
  |-- no --> monitor writer_disabled in memory; return noop
  |-- yes
       v
Envelope validates?
  |-- no --> monitor malformed in memory; return noop
  |-- yes
       v
Idempotency key exists and has not been attempted in memory?
  |-- duplicate --> monitor duplicate in memory; return noop
  |-- new
       v
options.storageClient.from is a function?
  |-- no --> fail-open; monitor write_failure in memory; return noop
  |-- yes
       v
storageClient.from('history_capture.historical_events').insert(row)
  |-- insert error --> fail-open; monitor write_failure in memory; return noop
  |-- success --> monitor write_success in memory; return write accepted
```

## Runtime gate inventory

| Gate | Location | Required pass condition | Current result |
| --- | --- | --- | --- |
| Sidecar scripts loaded | `index.html` runtime script list | Browser must load `historyCaptureFlags.js`, `historyCaptureEnvelope.js`, `historyCaptureIdempotency.js`, `historyCaptureMonitoring.js`, `historyCaptureWriter.js`, and `historyCapturePhase1A.js` before app hooks need them. | Fails in production page because no `js/history-capture/*.js` script is included. |
| Hook wrapper availability | `gridlyTryPassiveHistoryCapturePhase1A()` | `window.gridlyPassiveHistoryCapturePhase1A.capturePhase1AEvent` must exist. | Fails when sidecar scripts are not loaded; wrapper silently returns. |
| Capture flag | `capturePhase1AEvent()` | `readFlags().captureEnabled === true`. | Fails by default; flags module returns `captureEnabled: false`. |
| Supported event type | `capturePhase1AEvent()` | Event type must be `report_created` or `report_cleared`. | Capable for current app hook calls. |
| Envelope builder | `capturePhase1AEvent()` plus `historyCaptureEnvelope.js` | Envelope builder must be loaded and return an envelope. | Capable only if sidecar scripts are loaded. |
| Writer availability | `capturePhase1AEvent()` | `gridlyPassiveHistoryCaptureWriter.writePhase1AEnvelope` must exist. | Fails in production page unless sidecar writer script is loaded. |
| Writer enable option | `writePhase1AEnvelope()` | `options.writerEnabled === true`. | Fails for current hook calls because `capturePhase1AEvent()` passes only `{ idempotencyKey, hook }`. |
| Envelope validation | `writePhase1AEnvelope()` | Plain object; schema version `history_capture.phase_1a.v1`; phase `1A`; supported event type; non-empty `observedAt`; object `report`. | Capable after envelope creation. |
| Idempotency key | `writePhase1AEnvelope()` | Supplied or computed idempotency key must be non-empty. | Capable after envelope and idempotency module load. |
| In-memory duplicate suppression | `writePhase1AEnvelope()` | Key must not already be in writer module's `attemptedKeys` set. | Capable; duplicate attempts suppress writes. |
| Storage client | `writePhase1AEnvelope()` | `options.storageClient` exists and has `.from()`. | Fails for current hook calls because no storage client is passed. |
| Storage insert | `writePhase1AEnvelope()` | `storageClient.from('history_capture.historical_events').insert(row)` succeeds. | Not reachable currently. |

## Flag inventory

| Flag/config value | Source | Default | Effect |
| --- | --- | --- | --- |
| `captureEnabled` | `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` | `false` | Global sidecar kill switch. If false, `capturePhase1AEvent()` records in-memory `disabled_capture` and returns noop. |
| `writesEnabled` | `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` and audit reporting | `false` | Reported by audit as disabled, but it is not currently passed into `writePhase1AEnvelope()` and therefore does not by itself enable writes. |
| `productionHooksInstalled` | `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` | `false` | Declared flag only in current code. `auditSidecar()` separately reports installed hooks from static inventory. |
| `historicalReadsExposed` | `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` | `false` | Confirms no historical read exposure. |
| `uiExposed` | `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` | `false` | Confirms no history UI exposure. |
| `options.writerEnabled` | Per-call writer options | absent/false | Exact writer gate. Must be `true` or writer returns disabled noop. Current hook wiring never supplies it. |
| `options.storageClient` | Per-call writer options | absent | Required storage dependency. Current hook wiring never supplies it. |

## Dependency inventory

Required for a historical event to reach `history_capture.historical_events`:

1. Production success boundary must call `gridlyTryPassiveHistoryCapturePhase1A()` after an approved report insert succeeds.
2. The Phase 1A sidecar modules must be loaded into `window` in dependency order: flags, envelope, idempotency, monitoring, writer, then phase controller.
3. `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` must return `captureEnabled: true`.
4. The event input must contain a supported `eventType` and report object.
5. The envelope service must build a valid `history_capture.phase_1a.v1` envelope.
6. The idempotency service must create a non-empty idempotency key.
7. The writer service must be loaded and callable.
8. The writer call must receive `writerEnabled: true`.
9. The writer call must receive a storage client with a Supabase-like `.from().insert()` interface.
10. The storage client's permissions, schema access, RLS policy posture, network state, and table availability must allow inserting into `history_capture.historical_events`.

## Storage-client analysis

A general Supabase client is instantiated in `js/app.js` when `window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY)` is available. That client is used for live report operations.

The historical writer does not read `supabaseClient` from `js/app.js`, does not read a global Supabase client, and does not instantiate its own client. It only accepts a storage client through `options.storageClient`. The current sidecar controller calls the writer with `{ idempotencyKey, hook }` only. Therefore:

- A live Supabase client can exist for production report workflows.
- No historical storage client is currently instantiated inside the historical sidecar.
- No storage client is currently passed to the historical writer from production hooks.
- The writer's insert path is unreachable from current hook wiring.

## Capture-hook analysis

Current app-level hook calls exist after successful report creation/clear paths:

- Road hazard created calls `gridlyTryPassiveHistoryCapturePhase1A()` with `eventType: "report_created"` and hook `road_hazard.report_created`.
- Road hazard cleared calls it with `eventType: "report_cleared"` and hook `road_hazard.report_cleared`.
- Crossing report success calls it with `eventType` mapped to `report_created` or `report_cleared` and hook `crossing.report_created` or `crossing.report_cleared`.

These hook calls are capable of emitting Phase 1A event inputs only if the sidecar exists at runtime and the capture flag is enabled. In the current production page, the sidecar is not loaded, so the wrapper returns before emission. In a runtime where the sidecar is loaded, default flags still prevent emission beyond the disabled-capture no-op.

## Writer analysis

`writePhase1AEnvelope()` is implemented as fail-open and append-only in intent. Its exact write requirements are stricter than the public flags:

1. It records `capture_attempt` in memory.
2. It sets internal `writerState.writesEnabled` from `options.writerEnabled === true`.
3. If writer-enabled is not exactly true, it records `writer_disabled` in memory and returns noop.
4. It validates envelope shape and supported event type.
5. It obtains a supplied or computed idempotency key.
6. It suppresses duplicates using the module-local `attemptedKeys` set.
7. It requires `options.storageClient.from`.
8. It inserts a row into `history_capture.historical_events`.
9. Insert errors are swallowed as fail-open no-ops and recorded in memory as write failure.

`writerEnabled` cannot currently become true through existing production hook flow. The flag object contains `writesEnabled`, but `capturePhase1AEvent()` does not translate that flag into `options.writerEnabled`, and no configuration mechanism currently passes `writerEnabled: true` to the writer.

## Monitoring analysis

Monitoring is currently in memory only. `historyCaptureMonitoring.js` maintains counters such as capture attempts, disabled captures, malformed payloads, duplicate suppressions, write failures, writer-disabled counts, sidecar failures, and write successes. It exposes `getHistoryCaptureMonitoringState()`, `recordHistoryCaptureAudit()`, and `recordHistoryCaptureWriterEvent()`.

There is a storage table artifact named `history_capture.writer_monitoring_events` in the migration, but current JavaScript does not insert monitoring events into that table. Monitoring events can currently persist only for the lifetime of the JavaScript runtime memory; they do not persist to Supabase.

## Conditions currently blocking writes

Writes are currently blocked by all of the following:

1. `index.html` does not load the Phase 1A sidecar JavaScript files, so production runtime does not create `window.gridlyPassiveHistoryCapturePhase1A`.
2. The default flags return `captureEnabled: false`.
3. The default flags return `writesEnabled: false`.
4. `writesEnabled` is not wired into the writer call.
5. `capturePhase1AEvent()` calls `writePhase1AEnvelope()` without `writerEnabled: true`.
6. `capturePhase1AEvent()` calls `writePhase1AEnvelope()` without `storageClient`.
7. The historical writer does not instantiate a storage client.
8. Monitoring persistence to `history_capture.writer_monitoring_events` is not implemented.
9. The actual deployed Supabase `history_capture` schema/table/grants/RLS state was not queried or modified by this audit, so database insert readiness remains unverified here.

## Minimum required V414 activation steps

The minimum future V414 activation set requires code changes plus controlled configuration/operational validation. Configuration-only activation is not sufficient.

Required before any canary write activation:

1. Load the Phase 1A sidecar modules in production runtime in a safe order, or bundle them through an approved equivalent mechanism.
2. Add a disabled-by-default activation configuration source that can return `captureEnabled: true` only for an explicitly approved canary scope.
3. Add a separately disabled-by-default writer activation mechanism that can pass `writerEnabled: true` to `writePhase1AEnvelope()`.
4. Provide an approved historical storage client to the writer through sidecar wiring without making production report success depend on it.
5. Ensure the writer uses only append-only writes to `history_capture.historical_events` and remains fail-open.
6. Verify, outside this audit, that the deployed `history_capture.historical_events` table, grants, RLS posture, and client identity permit only the intended insert operation.
7. Preserve no historical reads, no history UI, no awareness changes, no alert changes, no marker changes, no Route Watch changes, and no protected-system dependencies.
8. Define rollback order: disable writer first, disable capture second, then verify no new historical rows after the disable timestamp.
9. Decide whether monitoring remains in-memory for V414 or whether a separate future milestone will implement database monitoring writes. Do not assume monitoring rows persist today.

## Explicit non-approvals

This audit does not approve:

- Activating capture.
- Activating the writer.
- Enabling any historical write.
- Adding or exposing historical reads.
- Adding history UI.
- Modifying Supabase, migrations, grants, RLS, or production data.
- Running SQL or creating historical rows.
- Changing `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, alerts, awareness, markers, Route Watch, or DriveTexas.
- Making production report success depend on historical capture success.
- Persisting monitoring events without a separately approved implementation.

## Final recommendation

| Option | Recommendation | Reason |
| --- | --- | --- |
| Configuration-only activation | Not recommended / not currently possible | Existing production runtime does not load sidecar files, the writer requires `options.writerEnabled === true`, and no storage client is passed. These cannot be solved by the current flag defaults alone. |
| Code-change activation | Required for any future V414 canary | Minimal code must load/wire sidecar modules, expose approved disabled-by-default activation config, pass writer enablement, and pass an approved storage client while preserving fail-open isolation. |
| Blocked / needs follow-up | Yes, before activation | Follow-up must define the exact storage-client source, deployment/runtime loading mechanism, canary flag source, writer option wiring, and Supabase insert-permission verification. |

V414 should therefore be treated as blocked pending a narrowly scoped activation-wiring design. The future activation cannot be a simple flag flip in the current codebase.
