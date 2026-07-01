# Gridly Historical Writer Error Diagnosis — V419

## Summary

V419 diagnoses the V418 canary writer failure without enabling capture, enabling the writer, restarting the canary, creating historical writes, adding historical reads, adding history UI, changing Supabase schema, or changing protected live systems.

The canary failure path is fully identified in code: `crossing.report_created` reached the Phase 1A passive capture sidecar, the canary supplied the existing Supabase client as `storageClient`, the writer attempted an append-only insert, the insert path threw or returned an error, and `historyCaptureWriter.js` converted that failure to the fail-open reason `passive_history_capture_sidecar_writer_fail_open`.

The exact original exception is **not preserved by the current runtime result or canary status**, so V419 cannot prove the single deployed error object from repository evidence alone. The most likely root cause in code is the storage table reference: the writer calls `storageClient.from('history_capture.historical_events').insert(...)`. Supabase JS v2 custom-schema access is normally expressed through schema-scoped clients/query builders, not by treating `schema.table` as a plain table name on the default client. If deployed unchanged, this can address the wrong PostgREST schema/table path or trigger a relation/schema API error before any row is written. A second plausible cause is production database authorization: the V410 migration enables RLS on `history_capture.historical_events` but defines no insert policy or grants in the repository artifact, so an anon/public browser client insert can fail with a permission/RLS/schema-exposure error even if the table reference is corrected.

V420 is required for any fix. V419 is documentation-only and intentionally does not patch the writer.

## Canary failure recap

Observed V418 canary evidence:

- Canary started successfully.
- `captureEnabled` became `true` only during the controlled canary window.
- `writerEnabled` became `true` only during the controlled canary window.
- `historicalReadsEnabled` remained `false`.
- `historyUiEnabled` remained `false`.
- One event was observed.
- Zero events were written.
- `writerErrors: 1`.
- `stopReason: writer_error`.
- Protected systems were reported unchanged.
- Writer-first rollback worked; writer and capture returned to `false`.
- Observed event: `eventType: report_created`, `hook: crossing.report_created`.
- Observed monitoring reason: `passive_history_capture_sidecar_writer_fail_open`.

No further canary activation, capture enablement, writer enablement, or write creation is approved by V419.

## Error source

The exact code path emitting `passive_history_capture_sidecar_writer_fail_open` is the catch block in `writePhase1AEnvelope()` in `js/history-capture/historyCaptureWriter.js`.

The writer defines:

- `WRITER_FAIL_OPEN_REASON = 'passive_history_capture_sidecar_writer_fail_open'`
- `WRITE_FAILURE_REASON = 'passive_history_capture_write_failed'`

When any exception reaches the outer `try/catch`, the writer:

1. Sets `writerState.lastWriteResult = 'fail_open'`.
2. Sets `writerState.lastReason = WRITE_FAILURE_REASON`.
3. Increments `writerState.writeFailureCount`.
4. Records an in-memory monitoring event `write_failure` with only the generic reason `passive_history_capture_write_failed`.
5. Returns `{ ok: true, noop: true, writesEnabled: true, reason: WRITER_FAIL_OPEN_REASON }`.

Therefore, the canary reason is not the original Supabase/storage exception. It is the writer's fail-open wrapper reason.

## Writer path trace

### 1. Crossing live report succeeds first

`createSharedReport()` builds the live `reports` row and calls `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)`. Only after the live insert succeeds does the historical sidecar hook run. This preserves the intended awareness-first behavior: live reporting is not dependent on historical capture.

### 2. Crossing Phase 1A hook is invoked

After the live crossing report write succeeds, `createSharedReport()` invokes:

```js
gridlyTryPassiveHistoryCapturePhase1A({
  eventType: reportType === "cleared" ? "report_cleared" : "report_created",
  hook: reportType === "cleared" ? "crossing.report_cleared" : "crossing.report_created",
  observedAt: new Date().toISOString(),
  report: localCrossingRows[0] || row
});
```

For the observed canary event, `reportType` was not `cleared`, so the hook was `crossing.report_created` and the event type was `report_created`.

### 3. Canary wrapper injects storage client and writer flag

`gridlyTryPassiveHistoryCapturePhase1A()` calls `sidecar.capturePhase1AEvent(...)` and adds:

- `storageClient: gridlyGetHistoricalCaptureStorageClient()`
- `writerEnabled: canaryActive`

`gridlyGetHistoricalCaptureStorageClient()` returns the existing browser `supabaseClient` only if it has a `.from` function.

### 4. Phase 1A capture gate and envelope construction pass

`capturePhase1AEvent()` reads flags, requires `flags.captureEnabled === true`, verifies `report_created` is supported, builds the envelope, creates an idempotency key, and invokes:

```js
gridlyPassiveHistoryCaptureWriter.writePhase1AEnvelope(envelope, {
  idempotencyKey,
  hook,
  storageClient,
  writerEnabled
})
```

Because the canary observed a writer failure rather than capture-disabled, unsupported-event, or malformed-envelope reason, the flow reached the writer invocation.

### 5. Writer validates inputs and attempts storage insert

`writePhase1AEnvelope()` requires:

- `options.writerEnabled === true`
- envelope is a plain object
- `schemaVersion === 'history_capture.phase_1a.v1'`
- `phase === '1A'`
- event type is `report_created` or `report_cleared`
- `observedAt` is a non-empty string
- `report` is a plain object
- idempotency key exists
- `storageClient.from` exists

It then builds a row and attempts:

```js
await storageClient
  .from('history_capture.historical_events')
  .insert(buildRow(envelope, idempotencyKey, options));
```

If the returned object contains `insertResult.error`, that error is thrown. Any thrown error is caught by the writer's fail-open catch block.

### 6. Canary auto-stop observes fail-open reason

The canary wrapper handles the resolved result. If `result.reason === "passive_history_capture_sidecar_writer_fail_open"`, it increments `writerErrors`, records `canary_writer_error`, and calls `gridlyStopHistoricalCanary("writer_error")`. The stop path disables the writer before capture, which matches the observed rollback behavior.

## Storage-client analysis

### Existing client availability

The failure is unlikely to be caused by a completely missing storage client method. `gridlyGetHistoricalCaptureStorageClient()` only returns a client when `supabaseClient.from` is a function, and the canary got to the writer fail-open result rather than the explicit `history capture storage client unavailable` throw path being diagnosable in status. However, the current monitoring does not preserve the original error, so this cannot be ruled out with absolute certainty from status alone.

### Method name / schema reference risk

The writer currently uses:

```js
storageClient.from('history_capture.historical_events')
```

This is the strongest code-level suspect. In Supabase JS v2, the app loads `@supabase/supabase-js@2` from CDN, and custom-schema access is generally schema-scoped. Passing a dotted `schema.table` string to `.from()` on the default client can be interpreted as a table/relation name in the client's current schema rather than as a schema-qualified PostgREST target. The likely V420 code fix is to use a schema-scoped query builder/client, for example conceptually:

```js
storageClient.schema('history_capture').from('historical_events').insert(row)
```

or an equivalent approved wrapper, after confirming the deployed Supabase JS API and project schema exposure.

V419 does not implement that change because it could alter write behavior during the next activation and should be separately approved.

### Table/schema artifact comparison

The repository migration defines `history_capture.historical_events`, so the intended storage object name exists in the migration artifact. The writer row fields match the migration's required fields:

| Writer field | Migration column | Required? | Assessment |
| --- | --- | --- | --- |
| `schema_version` | `schema_version text not null` | Yes | Present |
| `phase` | `phase text not null` | Yes | Present |
| `event_type` | `event_type text not null check (...)` | Yes | Present and limited to approved values |
| `source_kind` | `source_kind text` | No | Present nullable |
| `source_report_id` | `source_report_id text` | No | Present nullable |
| `idempotency_key` | `idempotency_key text not null unique` | Yes | Present if idempotency helper succeeds |
| `observed_at` | `observed_at timestamptz not null` | Yes | Present ISO string |
| `hook_name` | `hook_name text` | No | Present nullable |
| `envelope` | `envelope jsonb not null` | Yes | Present object |
| `payload` | `payload jsonb not null default '{}'` | Yes | Present object |
| `metadata` | `metadata jsonb not null default '{}'` | Yes | Present object |
| `received_at` | default `now()` | No client value needed | Safe |
| `retained_until` | default expression | No client value needed | Safe |

Based on repository code alone, payload shape mismatch or missing required field is less likely than schema reference or permission/RLS failure.

## Payload analysis

The observed `crossing.report_created` payload comes from `localCrossingRows[0] || row` after live report insertion. The envelope builder copies that report snapshot into `envelope.report`. The writer validates only that `report` is a plain object; it does not require a particular crossing field.

The row maps report identifiers defensively:

- `source_kind` is `envelope.report.reportType` when it is a string, otherwise `null`.
- `source_report_id` is `envelope.report.id || envelope.report.reportId || envelope.report.uuid || null`.
- `payload` is `envelope.report || {}`.

Because nullable fields are used for source kind and source report ID, and the required JSON fields are supplied, the current payload shape is unlikely to be the direct failure cause unless the live report snapshot contains a value that Supabase/PostgREST cannot serialize to JSON. The local crossing row is normalized application data, so that is not the primary suspect.

One minor data-quality issue remains: the envelope metadata currently hard-codes `writesDisabled: true` and `runtimeIntegrated: false` even during canary writer activation. That is misleading metadata but should not cause the insert failure because it is stored inside a JSONB column and is not constrained by the migration.

## Supabase/schema/RLS considerations

The V410 migration artifact enables row-level security on `history_capture.historical_events`, `history_capture.writer_monitoring_events`, and `history_capture.retention_runs`. It does not define insert policies, grants, or an app-facing writer role in the repository artifact.

If the migration was deployed exactly as written, then a browser anon/public client attempting to insert into `history_capture.historical_events` can fail because:

- the custom schema may not be exposed to PostgREST/API settings;
- the anon/authenticated role may not have usage/insert grants on the schema/table;
- RLS is enabled without a matching insert policy;
- the app is using the default Supabase client rather than a schema-scoped client.

Those conditions are compatible with the observed `writerErrors: 1`, `eventsWritten: 0`, and fail-open stop. V419 did not query Supabase and did not run SQL, so the deployed RLS/grant/schema exposure state remains unverified.

## Monitoring diagnostic gaps

Current canary status does **not** capture enough diagnostic detail to identify the original error with certainty.

Current gaps:

1. The writer catch block discards the caught `error` object.
2. The returned result exposes only `passive_history_capture_sidecar_writer_fail_open`.
3. The writer state stores only generic `passive_history_capture_write_failed` as `lastReason`.
4. Canary monitoring records only `{ reason: result.reason }` for writer errors.
5. Supabase error fields such as `message`, `code`, `details`, `hint`, HTTP status, or exception name are not preserved.
6. There is no read-only storage diagnostic helper showing whether the client supports `.schema`, whether the writer is currently disabled, or which storage method would be chosen.

V420 should add safe diagnostic capture before re-running any canary. It should preserve a redacted, bounded diagnostic object such as:

- `name`
- `code`
- `message` truncated to a safe length
- `details` truncated to a safe length
- `hint` truncated to a safe length
- `status` / `statusCode` if present
- `storagePathMode`, for example `default_from_dotted_name` versus `schema_scoped_from`

It must not log Supabase keys, Authorization headers, cookies, full URLs with tokens, report PII beyond already-present event metadata, or credentials.

## Read-only diagnostics needed before fixing

Additional read-only diagnostics are recommended before V420 changes writer behavior:

1. Inspect runtime writer state after rollback:
   ```js
   window.gridlyPassiveHistoryCaptureWriter?.getWriterState?.()
   ```

2. Inspect canary status after rollback:
   ```js
   window.gridlyHistoricalCanaryStatus?.()
   ```

3. Confirm storage client capabilities without writing:
   ```js
   ({
     hasSupabaseClient: Boolean(window.supabase),
     appClientAvailable: Boolean(window.gridlyHistoricalCanaryAudit?.().storageClientAvailable),
     clientHasFrom: Boolean(window.gridlyHistoricalCanaryAudit?.().storageClientAvailable),
     clientHasSchema: typeof window?.supabaseClient?.schema === 'function'
   })
   ```

The third command may need adjustment because `supabaseClient` is a module/global variable in `js/app.js`, not guaranteed to be exposed as `window.supabaseClient`. V420 should provide an approved read-only helper if operator-side capability confirmation is required.

No read-only diagnostic helper was added in V419 because documentation-only diagnosis was sufficient to identify the failure wrapper and likely root-cause class, and adding runtime helpers would change the shipped app surface.

## Protected-system review

V419 made no changes to:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness behavior
- markers
- Route Watch
- DriveTexas
- Supabase schema
- SQL migrations
- history reads
- history UI
- canary activation behavior
- writer behavior
- capture behavior

The traced existing path remains sidecar-only and fail-open: the live crossing report write succeeds before historical capture is attempted, and the canary stop path handles writer errors without making live report success dependent on historical storage.

## Recommended fix scope

V420 should be a small, isolated writer-diagnostics-and-storage-target fix milestone. Recommended scope:

1. Add safe redacted original-error capture in `historyCaptureWriter.js` and canary status/monitoring.
2. Add a read-only storage capability diagnostic helper if needed.
3. Correct the Supabase custom-schema insert method after confirming API behavior, likely by using schema-scoped access instead of `.from('history_capture.historical_events')`.
4. Preserve fail-open behavior and default-disabled gates.
5. Do not enable capture or writer by default.
6. Do not start the canary automatically.
7. Do not add reads or UI.
8. Do not alter live awareness, alerts, markers, Route Watch, DriveTexas, or any protected system.
9. Do not modify Supabase schema or run migrations in the app-code fix.
10. Separately verify deployed Supabase schema exposure, grants, and RLS policy posture before any future canary restart.

## Whether V420 is required

Yes. V420 is required.

Reason: the most likely fixes affect writer behavior and/or diagnostic surface. Even though the code change may be small, it should be separately reviewed because it changes the path that can create historical writes during a future explicitly approved activation. V419 should remain documentation-only.

## Explicit non-approvals

V419 does not approve:

- enabling capture by default;
- enabling writer by default;
- restarting the canary;
- creating additional historical writes;
- adding historical reads;
- adding history UI;
- changing awareness behavior;
- changing alerts;
- changing markers;
- changing Route Watch;
- changing DriveTexas;
- modifying Supabase schema;
- running SQL migrations;
- running destructive SQL;
- changing RLS policies or grants;
- implementing the writer fix;
- full evidence collection;
- any production behavior change.

## Testing performed

Required checks performed for V419:

```bash
git status --short
git diff --check
```

No JavaScript files were changed, so `node --check` was not required.

## Final recommendation

Treat the V418 canary as a successful safety rollback and a failed writer-storage integration test. The exact fail-open source is `writePhase1AEnvelope()` in `historyCaptureWriter.js`; the original caught exception is currently lost. The leading code-level diagnosis is incorrect Supabase custom-schema table targeting via `.from('history_capture.historical_events')`, with deployed schema/RLS/grant/API exposure as the second major suspect. Payload shape and missing required fields are less likely based on the writer row and migration contract.

Proceed to V420 only after approving a narrowly scoped writer diagnostic and storage-target correction. Keep Gridly Awareness Platform First and Route Intelligence Second. Keep historical capture and writer disabled until a separate future activation is explicitly approved.
