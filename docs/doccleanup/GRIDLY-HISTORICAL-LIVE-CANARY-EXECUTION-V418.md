# Gridly Historical Live Canary Execution V418

## Summary

V418 adds the minimum explicit operator-controlled live canary mechanism for passive historical Phase 1A capture. Capture and writer remain disabled by default on page load. The only activation path is the console helper `window.gridlyStartHistoricalCanary?.()`, and the canary is bounded by 6 observed historical events or 30 minutes, whichever comes first.

Historical reads and history UI remain disabled. The canary does not change user-facing awareness behavior, alerts, markers, Route Watch, protected live incident systems, DriveTexas, Supabase schema, SQL migrations, or framework structure.

## Files changed

- `js/history-capture/historyCaptureFlags.js` — adds dormant canary-only flag controls for capture and writer.
- `js/app.js` — adds console canary start, stop, status, audit integration, bounded monitoring, and writer-first rollback behavior.
- `GRIDLY-HISTORICAL-LIVE-CANARY-EXECUTION-V418.md` — documents operator procedures and guardrails.

## Canary controls added

- `window.gridlyStartHistoricalCanary?.()`
  - Starts only when `window.gridlyHistoricalCanaryAudit?.().canaryReady === true`.
  - Requires capture disabled, writer disabled, historical reads disabled, and history UI disabled before activation.
  - Enables capture and writer only through canary flags.
- `window.gridlyStopHistoricalCanary?.()`
  - Immediately disables writer first, then capture.
- `window.gridlyHistoricalCanaryStatus?.()`
  - Reports availability, active state, timestamps, stop reason, gates, limits, observed/written counts, writer errors, monitoring events, last event, protected-system posture, rollback readiness, and blockers.
- `window.gridlyHistoricalCanaryAudit?.()`
  - Includes `canaryControlsAvailable`, `canaryActive`, and `canaryStatus`.

## Start procedure

1. Open the production browser console as an operator.
2. Confirm readiness:
   ```js
   window.gridlyHistoricalCanaryAudit?.()
   ```
3. Start only if `canaryReady === true` and `blockers` is empty:
   ```js
   window.gridlyStartHistoricalCanary?.()
   ```
4. Confirm status immediately:
   ```js
   window.gridlyHistoricalCanaryStatus?.()
   ```

## Stop procedure

Manual stop is immediate and writer-first:

```js
window.gridlyStopHistoricalCanary?.()
```

The canary also stops automatically after either:

- 6 observed Phase 1A historical events, or
- 30 minutes.

## Status procedure

Use:

```js
window.gridlyHistoricalCanaryStatus?.()
```

Confirm:

- `active` reflects the intended canary state.
- `captureEnabled` and `writerEnabled` are true only during active canary mode.
- `historicalReadsEnabled === false`.
- `historyUiEnabled === false`.
- `eventLimit === 6`.
- `durationLimitMs === 1800000`.
- `rollbackReady === true`.
- `blockers` is empty.

## Monitoring procedure

Use:

```js
window.gridlyHistoricalCanaryStatus?.().monitoringEvents
```

Review:

- `canary_started`
- `canary_event_observed`
- `canary_write_success`
- `canary_writer_error`
- `canary_stopped`

The status object also exposes:

- `eventsObserved`
- `eventsWritten`
- `writerErrors`
- `lastEvent`
- `stopReason`

## Failure handling

If a canary writer error or capture exception is detected, the runtime stops the canary and disables writer first, then capture. Passive historical capture remains fail-open and must not block live reporting or protected systems.

Operator rollback command:

```js
window.gridlyStopHistoricalCanary?.()
```

Then verify:

```js
window.gridlyHistoricalCanaryStatus?.()
window.gridlyHistoricalCanaryAudit?.()
```

## Protected-system validation

Protected systems remain unchanged by V418:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- `alerts`
- `awareness`
- `markers`
- Route Watch
- DriveTexas

V418 does not add historical reads, history UI, awareness changes, alert changes, marker changes, Route Watch changes, DriveTexas changes, Supabase schema changes, SQL migrations, or a framework.

## Exact console commands

```js
window.gridlyHistoricalCanaryAudit?.()
window.gridlyStartHistoricalCanary?.()
window.gridlyHistoricalCanaryStatus?.()
window.gridlyHistoricalCanaryStatus?.().monitoringEvents
window.gridlyStopHistoricalCanary?.()
window.gridlyHistoricalCanaryAudit?.()
```

## Explicit non-approvals

V418 does not approve:

- Default historical capture enablement.
- Default historical writer enablement.
- Historical reads.
- History UI.
- Awareness behavior changes.
- Alert behavior changes.
- Marker behavior changes.
- Route Watch changes.
- DriveTexas changes.
- Supabase schema changes.
- SQL migrations.
- Backfills.
- Full evidence collection beyond canary limits.

## Testing performed

- `git status --short`
- `git diff --check`
- `node --check js/app.js`
- `node --check js/history-capture/historyCaptureFlags.js`

## Recommended next milestone

V419 should be a post-canary evidence review and governance decision milestone. It should review canary status output, append-only write evidence outside the production UI, writer errors if any, auto-stop/manual-stop reason, protected-system validation, and beta reset implications before approving any continuation or full evidence collection.
