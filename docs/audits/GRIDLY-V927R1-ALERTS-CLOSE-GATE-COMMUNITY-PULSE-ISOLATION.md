# GRIDLY V927R.1 — Alerts Close Gate + Community Pulse Isolation

## Manual browser evidence

Manual testing showed the Alerts portrait sheet opens as `#gridlyPortraitV2Sheet` with `gridly-v2-sheet is-open active open` and the real production close control is `#gridlyPortraitV2SheetClose` with `aria-label="Close panel"`.

Clicking that real button changed the sheet from visible/open to `gridly-v2-sheet is-closing is-closed`, with `is-open`, `active`, and `open` absent and the sheet no longer visibly rendered.

After manual close, the portrait refresh adapter returned valid unchanged-reuse evidence: `cacheReuseApplied: true`, `unchangedDomWriteSkipped: 3`, `desktopCommunityPulseDomRenderSkipped: 1`, `previewCardRenderSkippedForPortraitSharedModel: 1`, `sharedActiveAwarenessReuseApplied: 1`, and `quietFastPathExpensiveSnapshotSkipped: 1`.

## Narrow repair scope

V927R.1 changes only the test harness. It does not change Community Pulse product behavior, portrait refresh implementation, V923 reuse behavior, Alerts product behavior, crossings, markers, popups, map movement, restoration, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase contracts, production writes, or protected flags.

## Alerts close gate

The full performance regression simulation now gates the Alerts scenario by locating `#gridlyPortraitV2Sheet` and `#gridlyPortraitV2SheetClose`, confirming the sheet is open, clicking the real close button, waiting two animation frames, and verifying the sheet is not visible and no longer has `is-open`, `active`, or `open`.

If the gate fails, the simulation records `alerts_sheet_not_closed` and stops before Community Pulse and final validation.

## Community Pulse isolation runner

`window.gridlyRunCommunityPulsePerformanceIsolation?.()` creates a unique run id, resets only Community Pulse isolation state, arms the existing V926/V927 capture lifecycle, invokes `window.gridlyInvokePortraitLocalizedRefreshForAudit("community-pulse-isolation")`, waits two frames, flushes capture, stops collectors, persists a focused result, and avoids popup, viewport, zoom, Alerts, marker restoration, and full-suite scenarios.

`window.gridlyCommunityPulseIsolationAudit?.()` returns the latest isolation result. `window.gridlyResetCommunityPulsePerformanceIsolation?.()` clears only isolation-run state.

## Valid reuse classification

A focused run passes as `reused_unchanged` when invocation was attempted, the adapter was available, the production function entered and exited, a result object returned, and explicit reuse evidence exists from `cacheReuseApplied` or one of the grounded skip/reuse counters. Reuse does not fabricate timing samples: `p50` and `p95` remain `null`.

A rendered outcome remains valid when a real finite Community Pulse timing sample is captured.

## Browser test commands

```js
window.gridlyResetCommunityPulsePerformanceIsolation?.();
const isolated = await window.gridlyRunCommunityPulsePerformanceIsolation?.();
const isolatedAudit = window.gridlyCommunityPulseIsolationAudit?.();
({ isolated, isolatedAudit });
```

After the isolation run passes:

```js
window.gridlyResetPerformanceRegressionSimulation?.();
const result = await window.gridlyRunPerformanceRegressionSimulation?.();
const summary = window.gridlyPerformanceRegressionSummary?.();
({ result, summary });
```

## Protected systems unchanged

This branch is audit-first and harness-only. Production writes remain blocked; protected system markers remain read-only or unchanged.
