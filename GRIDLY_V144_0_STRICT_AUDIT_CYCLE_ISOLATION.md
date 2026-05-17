# GRIDLY V144.0 Strict Audit Cycle Isolation

## What changed

- Added strict cycle ownership guards for helper audit recorders.
- Recorder writes now reject when collection is disabled or the incoming cycle ID mismatches the active cycle.
- Added rejection counters and categorized rejection reasons for visibility.
- Added publish-time snapshot isolation by deep-cloning and recursively freezing the published audit payload.
- Added explicit publish lifecycle state tracking (`idle` -> `collecting` -> `publishing` -> `published`).
- Added zero-incident hard reset behavior:
  - helper timing arrays are forced to empty arrays
  - helper summaries are forced to `null`
  - slowest helper entries are forced to `null`
- Added `window.gridlyAuditCycleDebug()` diagnostics.

## New debug helper

`window.gridlyAuditCycleDebug()` returns:

```js
{
  activeCycleId,
  auditCollectionEnabled,
  pendingWritesRejected,
  rejectedReasons,
  cyclePublishState
}
```

## Validation checklist

1. Hard refresh.
2. Run:
   - `window.gridlyAuditCycleDebug()`
   - `window.gridlyCommuteIntelligenceAudit()`
3. Confirm empty cycles contain no helper timing artifacts.
4. Confirm no stale helper mutation appears after publish.
