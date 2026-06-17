# Gridly Historical Activation Wiring Package V414

## Mission guardrail

Gridly remains **Awareness Platform First, Route Intelligence Second**.

This V414 package is a documentation-first implementation/design milestone. It defines the minimum safe runtime wiring required for a future historical capture activation milestone, but it does **not** activate capture, enable the writer, create writes, add reads, add UI, alter awareness behavior, alter alerts, alter markers, alter Route Watch, modify Supabase schema, or run SQL.

## Current state

### Implemented Today

- Historical storage artifacts exist in repository migrations, including the append-only historical event storage target referenced by the writer.
- Historical sidecar JavaScript exists under `js/history-capture/`:
  - `historyCaptureFlags.js`
  - `historyCaptureEnvelope.js`
  - `historyCaptureIdempotency.js`
  - `historyCaptureMonitoring.js`
  - `historyCaptureWriter.js`
  - `historyCapturePhase1A.js`
- Production app hooks exist in `js/app.js` through `gridlyTryPassiveHistoryCapturePhase1A(eventInput)`, but the wrapper is fail-open and returns silently when the Phase 1A sidecar API is unavailable.
- The default flag module returns disabled gates:
  - `captureEnabled: false`
  - `writesEnabled: false`
  - `productionHooksInstalled: false`
  - `historicalReadsExposed: false`
  - `uiExposed: false`
- The writer has an explicit per-call gate. It only proceeds past the disabled no-op path when `options.writerEnabled === true`.
- The writer requires a Supabase-like storage client passed as `options.storageClient` with a `.from()` function.
- Monitoring is implemented in memory through the sidecar monitoring module and writer event recorder.
- Production `index.html` currently loads app/runtime scripts but does not load any `js/history-capture/*.js` sidecar scripts.

### Future Activation

Future activation cannot be configuration-only in the current runtime. A future implementation milestone would need to:

1. Load the Phase 1A sidecar scripts in production runtime in dependency order.
2. Add a disabled-by-default runtime activation configuration source.
3. Translate approved activation config into `captureEnabled` and, separately, `writerEnabled`.
4. Instantiate or obtain a historical storage client without making live report success depend on it.
5. Pass that storage client to the historical writer only after canary activation is explicitly approved.
6. Wire monitoring access without persisting monitoring events unless separately approved.

## Architectural findings

### 1. Sidecar loading is currently absent from production

The sidecar files are present in the repository, but production runtime cannot use them until `index.html` loads them or an approved bundling equivalent includes them before `js/app.js` needs them.

Current production page loading includes Leaflet, Supabase JS, optional local overrides, live service/prototype scripts, Route Watch geometry audit script, and `js/app.js`. It does not include the Phase 1A sidecar files.

### 2. The app hook is already fail-open

The `gridlyTryPassiveHistoryCapturePhase1A(eventInput)` wrapper checks for `window.gridlyPassiveHistoryCapturePhase1A.capturePhase1AEvent`. If the sidecar API is unavailable, it returns. If the sidecar call throws, the catch block suppresses the failure so reporting remains unaffected.

### 3. Capture and writer activation are separate gates

There are two distinct future gates:

- Capture gate: `flags.captureEnabled === true` inside `capturePhase1AEvent()`.
- Writer gate: `options.writerEnabled === true` inside `writePhase1AEnvelope()`.

`writesEnabled` exists in the flag object, but the current Phase 1A controller does not pass it to the writer as `writerEnabled`.

### 4. Storage client wiring is missing

The app has a live Supabase client for active report workflows, but the historical writer does not import, instantiate, or read that client directly. The writer only accepts a client through `options.storageClient`.

### 5. Monitoring is in-memory only

The monitoring sidecar tracks counters in runtime memory. It does not currently persist monitoring rows. Any future persistent monitoring write path must be separately approved because it would create additional database writes.

## Required runtime wiring

### Implemented Today

No new runtime wiring is implemented by this V414 package. This document only describes the minimum wiring required for a future milestone.

### Future Activation

The minimum future runtime wiring should be introduced in two phases: dormant wiring first, canary activation second.

#### Dormant wiring phase

A future implementation milestone may introduce the following while preserving zero production behavior changes:

1. Add sidecar script tags to production runtime in dependency order.
2. Keep all default flags disabled.
3. Keep `writerEnabled` false/absent.
4. Do not pass a storage client to the writer unless the writer gate is explicitly enabled.
5. Preserve the app-level fail-open wrapper.
6. Expose monitoring only for maintainer inspection through existing in-memory APIs, not user-facing UI.

#### Canary activation phase

A later future milestone, after explicit approval, may:

1. Enable capture only for an approved canary scope.
2. Enable writer separately only for the same approved canary scope.
3. Pass a storage client only when both capture and writer activation gates are true.
4. Verify append-only insert behavior and fail-open handling.
5. Roll back by disabling writer first, then capture.

## Sidecar loading plan

### Implemented Today

No sidecar scripts are loaded by production `index.html`.

### Future Activation

A future implementation milestone should load the following scripts before `js/app.js` and after the Supabase SDK is available:

1. `js/history-capture/historyCaptureFlags.js`
2. `js/history-capture/historyCaptureEnvelope.js`
3. `js/history-capture/historyCaptureIdempotency.js`
4. `js/history-capture/historyCaptureMonitoring.js`
5. `js/history-capture/historyCaptureWriter.js`
6. `js/history-capture/historyCapturePhase1A.js`

Recommended location: in `index.html`, after the Supabase SDK and optional local override loader, before `js/app.js`.

Reasoning:

- Flags should load before the Phase 1A controller reads them.
- Envelope and idempotency helpers should load before the controller attempts to build or key an envelope.
- Monitoring should load before writer/controller events are recorded.
- Writer should load before the controller attempts to call it.
- Phase 1A controller should load last because it composes the other sidecar modules.
- `js/app.js` should remain last among these because its hook wrapper can then see the sidecar API when future capture is enabled.

Dormant-safe implementation requirement: loading these scripts alone must not activate capture, because `captureEnabled` remains false by default and `writerEnabled` remains false/absent.

## Writer enablement plan

### Implemented Today

- `historyCaptureFlags.js` defaults `writesEnabled` to false.
- `historyCaptureWriter.js` requires `options.writerEnabled === true`.
- `historyCapturePhase1A.js` currently calls the writer with only `idempotencyKey` and `hook`.
- Therefore, writer activation is impossible through the current production hook path.

### Future Activation

A future implementation milestone should introduce a small sidecar-owned activation resolver that:

1. Reads disabled-by-default runtime config.
2. Returns `captureEnabled: false` unless an approved canary condition is met.
3. Returns `writesEnabled: false` unless an approved canary writer condition is met.
4. Ensures `writerEnabled` passed to the writer is exactly `flags.writesEnabled === true` plus any additional canary guard.
5. Keeps writer enablement separate from capture enablement so capture can be tested without writes if needed.

Minimum future code change:

```js
const writerEnabled = flags.writesEnabled === true && isApprovedHistoricalCanary(eventInput);
writer.writePhase1AEnvelope(envelope, {
  idempotencyKey,
  hook,
  writerEnabled,
  storageClient: writerEnabled ? historicalStorageClient : null
});
```

This pseudocode is not implemented today and must not be activated without a future approval milestone.

## Storage-client wiring plan

### Implemented Today

No historical storage client is instantiated by the sidecar, and no storage client is passed to `writePhase1AEnvelope()`.

### Future Activation

The safest future storage-client plan is:

1. Create a sidecar-specific storage client provider rather than allowing the writer to reach into `js/app.js` internals.
2. Instantiate the client lazily so disabled capture does not create new operational dependencies.
3. Use the same public Supabase SDK only if already available in the page and only with approved public configuration.
4. Return `null` fail-open if Supabase SDK, URL, key, or canary config is unavailable.
5. Pass the client to the writer only when writer canary activation is true.

Recommended future component:

- `js/history-capture/historyCaptureStorageClient.js`

Recommended future API:

```js
window.gridlyPassiveHistoryCaptureStorageClient = Object.freeze({
  getHistoricalStorageClient
});
```

Recommended future behavior:

- `getHistoricalStorageClient()` returns `null` by default.
- It creates/returns a client only when historical canary writer activation is explicitly approved.
- It catches all errors and returns `null`.
- It never blocks live report creation, clearing, awareness refresh, marker rendering, alerts, or Route Watch.

Potential source of Supabase URL/key:

- Reuse already approved browser configuration constants only if exposed safely to the sidecar.
- Do not duplicate secrets.
- Do not add service-role keys to browser code.
- Do not modify Supabase schema, grants, RLS, or migrations in this wiring milestone.

## Monitoring wiring plan

### Implemented Today

Monitoring is in-memory only through `gridlyPassiveHistoryCaptureMonitoring`.

### Future Activation

Dormant wiring may load monitoring alongside the sidecar with no behavior change except availability of maintainer-only runtime counters.

Future monitoring should remain fail-open:

1. Monitoring record failures must never throw into report workflows.
2. Monitoring should stay in memory during dormant wiring.
3. Persistent monitoring writes must require a separate milestone because they would create database writes.
4. Canary validation may inspect existing in-memory counters:
   - `disabledCaptureCount`
   - `writerDisabledCount`
   - `captureAttemptCount`
   - `writeFailureCount`
   - `writeSuccessCount`
5. During dormant wiring, expected counters should show disabled/no-op behavior only.

## Failure-isolation plan

### Implemented Today

- App hook wrapper is fail-open.
- Phase 1A controller returns no-op results on disabled capture, unsupported event types, missing envelopes, writer unavailability, and thrown errors.
- Writer returns no-op results on disabled writer, malformed payload, duplicate suppression, missing storage client, and write failure.
- Monitoring write attempts are wrapped and must not block writer flow.

### Future Activation

A future implementation milestone must preserve these isolation rules:

1. Historical sidecar load failure must not prevent `js/app.js` from loading.
2. Historical capture failure must not prevent report creation or clearing.
3. Historical writer failure must not prevent live Supabase report writes.
4. Storage-client creation failure must return `null` and force writer fail-open/no-op behavior.
5. Monitoring failure must be swallowed.
6. Activation config parsing failure must default all gates to disabled.
7. Canary mismatch must default writer to disabled.
8. No protected-system data structure may depend on historical capture success.

## Rollback plan

### Implemented Today

Rollback is currently trivial because capture and writer are not active and sidecar scripts are not loaded in production.

### Future Activation

Rollback order for a future activated canary:

1. Disable writer gate first by forcing `writerEnabled` false.
2. Confirm no additional accepted writes after the writer-disable timestamp.
3. Disable capture gate by forcing `captureEnabled` false.
4. Leave sidecar scripts loaded only if dormant loading has been validated as no-op; otherwise remove sidecar script tags in a follow-up rollback patch.
5. Confirm app reporting, awareness, alerts, markers, and Route Watch remain normal.
6. If storage-client provider was added, leave it returning `null` or remove it with the sidecar loading rollback.
7. Do not run SQL as part of application rollback unless a separate database-governance milestone explicitly approves it.

## Canary activation plan

### Implemented Today

No canary activation exists.

### Future Activation

Recommended future canary sequence:

1. **V414.1 Dormant sidecar load**
   - Load sidecar scripts in dependency order.
   - Keep flags disabled.
   - Do not pass `writerEnabled`.
   - Do not pass storage client.
   - Validate no user-facing change and no historical writes.

2. **V414.2 Runtime activation resolver**
   - Add disabled-by-default config resolver.
   - Preserve default `captureEnabled: false` and `writesEnabled: false`.
   - Add canary predicate scaffolding without enabling it.

3. **V414.3 Storage-client provider**
   - Add lazy sidecar storage-client provider.
   - Default provider returns `null`.
   - Add tests or static checks confirming disabled default.

4. **V414.4 Writer option bridge**
   - Pass `writerEnabled` and `storageClient` from the Phase 1A controller to the writer.
   - Ensure both remain disabled/null by default.
   - Validate no writes occur by default.

5. **V414.5 Monitoring validation**
   - Validate in-memory disabled/no-op counters.
   - Do not persist monitoring events.

6. **V415 Canary approval gate**
   - Separately approve a narrowly scoped canary.
   - Verify Supabase table/grants/RLS posture outside app code.
   - Enable capture and writer only for canary scope.
   - Observe write success/failure counters.
   - Roll back writer first if any unexpected behavior occurs.

## Protected-system review

### Implemented Today

This package does not modify any protected system.

### Future Activation

Future wiring must not alter or depend on these protected systems:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness
- markers
- Route Watch
- DriveTexas

Historical capture must remain passive and downstream of successful report events. It must not change live report loading, active hazard derivation, alert computation, marker rendering, awareness text, or route behavior.

## Explicit non-approvals

This V414 package does not approve:

- Capture activation.
- Writer activation.
- Any historical write.
- Any historical read.
- Any history UI.
- Any user-facing behavior change.
- Any awareness behavior change.
- Any alert behavior change.
- Any marker behavior change.
- Any Route Watch behavior change.
- Any DriveTexas change.
- Any Supabase schema, migration, grant, policy, or SQL execution.
- Any persistent monitoring writes.
- Any production dependency on historical capture success.
- Any service-role key or privileged database credential in browser code.

## Recommended future milestone sequence

| Milestone | Purpose | Default behavior | Writes possible? |
| --- | --- | --- | --- |
| V414.1 | Dormant sidecar loading | Disabled/no-op | No |
| V414.2 | Disabled activation resolver | Disabled/no-op | No |
| V414.3 | Lazy storage-client provider | Returns `null` by default | No |
| V414.4 | Writer option bridge | `writerEnabled: false`, `storageClient: null` | No |
| V414.5 | In-memory monitoring validation | Maintainer-only counters | No |
| V415 | Explicit canary activation | Canary-only if approved | Yes, only if all gates approved |

## Zero-production-change determination

Wiring can be introduced while preserving zero production behavior changes only if it is split into dormant implementation milestones and every new gate defaults to disabled.

Acceptable dormant changes in a future implementation milestone:

- Loading sidecar scripts before `js/app.js`.
- Adding a disabled-by-default activation resolver.
- Adding a lazy storage-client provider that returns `null` by default.
- Adding a writer option bridge that passes `writerEnabled: false` and no storage client by default.
- Keeping monitoring in memory only.

Unacceptable without future activation approval:

- Setting `captureEnabled` true.
- Setting `writesEnabled` true.
- Passing `writerEnabled: true`.
- Passing a non-null storage client to the writer for normal production users.
- Creating rows in `history_capture.historical_events`.
- Persisting monitoring rows.
- Adding historical reads or UI.

## Final recommendation

V414 should remain a design package. The next implementation milestone should be dormant sidecar wiring only, with all gates disabled and no storage client passed to the writer. Future canary activation should require separate approval after dormant runtime loading, disabled writer bridging, lazy storage-client wiring, monitoring validation, and database permission verification are complete.
