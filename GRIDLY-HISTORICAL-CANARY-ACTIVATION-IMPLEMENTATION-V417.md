# V417 — Historical Canary Activation Implementation

## Summary

V417 adds the minimum read-only operator control needed before a future passive historical capture canary: `window.gridlyHistoricalCanaryAudit?.()`.

The historical system remains dormant after this milestone:

- Capture is not enabled by default.
- Writer operation is not enabled by default.
- No historical writes occur automatically.
- No historical reads are introduced.
- No history UI is introduced.
- Awareness, alerts, markers, Route Watch, and other protected live systems remain unchanged.

## Files changed

- `js/app.js` — adds the read-only `gridlyHistoricalCanaryAudit()` helper and exposes it on `window`.
- `GRIDLY-HISTORICAL-CANARY-ACTIVATION-IMPLEMENTATION-V417.md` — documents the audit helper, procedures, non-approvals, and testing evidence for this milestone.

## Canary audit helper

Run this in the browser console after Gridly loads:

```js
window.gridlyHistoricalCanaryAudit?.()
```

The helper returns:

- `available`
- `captureEnabled`
- `writerEnabled`
- `storageClientAvailable`
- `writerAvailable`
- `monitoringAvailable`
- `historicalReadsEnabled`
- `historyUiEnabled`
- `sidecarsLoaded`
- `canWriteIfEnabled`
- `currentlyDormant`
- `protectedSystemsUnchanged`
- `canaryReady`
- `blockers`

Readiness semantics:

- `canaryReady: true` means required runtime dependencies are present, dormant defaults remain intact, protected systems report unchanged, and no blockers were found.
- `canaryReady: true` does **not** activate capture or writing.
- Any non-empty `blockers` array is a NO-GO for future canary activation.

Recommended baseline command:

```js
JSON.stringify(window.gridlyHistoricalCanaryAudit?.(), null, 2)
```

Expected pre-canary posture:

```js
{
  "available": true,
  "captureEnabled": false,
  "writerEnabled": false,
  "storageClientAvailable": true,
  "writerAvailable": true,
  "monitoringAvailable": true,
  "historicalReadsEnabled": false,
  "historyUiEnabled": false,
  "sidecarsLoaded": true,
  "canWriteIfEnabled": true,
  "currentlyDormant": true,
  "protectedSystemsUnchanged": true,
  "canaryReady": true,
  "blockers": []
}
```

## Activation procedure

V417 does not provide an automatic activation switch. A future canary may proceed only after a separate approval milestone authorizes the exact runtime flag override and operator window.

Future exact console commands for execution, once separately approved:

1. Confirm dormant readiness before any activation attempt:

   ```js
   window.gridlyHistoricalCanaryAudit?.()
   ```

2. Confirm the existing wiring audit remains clean:

   ```js
   window.gridlyHistoricalCaptureWiringAudit?.()
   ```

3. Confirm monitoring is available before activation:

   ```js
   window.gridlyPassiveHistoryCaptureMonitoring?.getHistoryCaptureMonitoringState?.()
   ```

4. Apply only the separately approved canary flag override mechanism from the future activation milestone. Do not invent an ad hoc override in production.

5. Re-run readiness immediately after the approved override is applied:

   ```js
   window.gridlyHistoricalCanaryAudit?.()
   ```

6. If `captureEnabled` and `writerEnabled` are not exactly the values approved for the canary window, stop immediately and roll back.

## Monitoring procedure

During an approved future canary window, collect monitoring evidence with these exact console commands:

```js
window.gridlyHistoricalCanaryAudit?.()
```

```js
window.gridlyHistoricalCaptureWiringAudit?.()
```

```js
window.gridlyPassiveHistoryCaptureMonitoring?.getHistoryCaptureMonitoringState?.()
```

```js
window.gridlyPassiveHistoryCaptureWriter?.getWriterState?.()
```

Evidence to record:

- Canary audit output.
- Wiring audit output.
- Monitoring counters, including write success, write failure, malformed payload, duplicate suppression, disabled capture, and writer-disabled counters.
- Writer state, including last result, last reason, success count, failure count, duplicate count, and malformed count.
- Browser timestamp and deployment/version identifier.

NO-GO / stop conditions:

- `historicalReadsEnabled: true`.
- `historyUiEnabled: true`.
- `protectedSystemsUnchanged: false`.
- Unexpected blockers.
- Unexpected write failures or malformed payload growth.
- Any observed user-facing behavior change in awareness, alerts, markers, or Route Watch.

## Rollback procedure

Immediate rollback command sequence for a future canary:

1. Remove the separately approved canary flag override using the future milestone's documented disable command.
2. Refresh the application session.
3. Verify dormant state:

   ```js
   window.gridlyHistoricalCanaryAudit?.()
   ```

4. Verify monitoring after rollback:

   ```js
   window.gridlyPassiveHistoryCaptureMonitoring?.getHistoryCaptureMonitoringState?.()
   ```

5. Verify writer state after rollback:

   ```js
   window.gridlyPassiveHistoryCaptureWriter?.getWriterState?.()
   ```

Rollback is complete only when the canary audit reports:

- `captureEnabled: false`
- `writerEnabled: false`
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `currentlyDormant: true`
- `blockers: []`

## Protected-system validation procedure

Before, during, and after a future canary, validate that the protected live systems remain unchanged by confirming:

```js
window.gridlyHistoricalCanaryAudit?.().protectedSystemsUnchanged
```

```js
window.gridlyHistoricalCaptureWiringAudit?.().protectedSystemsUnchanged
```

Operators must also perform a visual/runtime smoke check of the live app surfaces:

- Live reports still load through the existing live path.
- Active hazards remain visible exactly as before.
- Alerts do not change copy, timing, suppression, or eligibility.
- Awareness text and state remain unchanged.
- Markers remain based only on approved live incidents and hazards.
- Route Watch behavior remains unchanged.

## Explicit non-approvals

V417 does not approve:

- Enabling capture by default.
- Enabling writer operation by default.
- Creating historical writes automatically.
- Historical reads.
- History UI.
- Awareness changes.
- Alert changes.
- Marker changes.
- Route Watch changes.
- DriveTexas work.
- Supabase schema changes.
- SQL migrations.
- Backfills.
- Framework additions.
- Major rewrites.

## Testing performed

- `git status --short`
- `git diff --check`
- `node --check js/app.js`

## Recommended next milestone

Recommended next milestone: **V418 — Historical Canary Runtime Flag Override Approval and Dry-Run Procedure**.

V418 should define the exact temporary canary flag override mechanism, operator authorization boundary, start/stop commands, evidence collection template, rollback owner, and maximum canary duration. V418 should still avoid historical reads, history UI, protected-system changes, schema changes, and any DriveTexas work.
