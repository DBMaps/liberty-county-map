# GRIDLY V143.9b — Commute Audit State Consistency Fix

## Goal
Ensure commute intelligence audit helper sub-state is reset and published consistently per active audit cycle, so helper timings cannot appear stale relative to incident counts.

## What was fixed
- Added a cycle marker to commute audit state (`auditCycleId`) and increment it at the start of each `buildCommuteConsequenceIntelligence` cycle.
- Added a collection gate (`auditCollectionEnabled`) so helper timing collectors only record while an active commute audit cycle is running.
- Ensured helper timing collectors do not mutate audit state outside an active cycle.
- Added `auditCycleId` publication in `gridlyCommuteIntelligenceAudit()` output, including per-helper/per-step timing outputs.
- Added `auditCycleId` onto per-incident helper timing entries and slowest-step/slowest-call summaries.

## Why this resolves the issue
Previously, helper audit recorders could update state outside the currently audited commute cycle, which allowed stale timing summaries to persist even when `incidentsProcessed` was 0 for the latest cycle.

Now, helper audit writes are accepted only during the active cycle and cycle metadata is surfaced in outputs, keeping counts and helper timing data aligned.

## Behavioral constraints kept
- No optimization changes were introduced.
- No commute label generation behavior/output was changed.
- This change only addresses audit-state lifecycle consistency.

## Manual verification
In browser console:

```js
window.gridlyCommuteIntelligenceAudit()
```

Expected:
- `counts` and helper timing data correspond to the same `auditCycleId`.
- No stale helper timing data appears from prior/direct helper calls.
- When `incidentsProcessed` is `0`, helper timing arrays/summaries are empty/null for that cycle.
