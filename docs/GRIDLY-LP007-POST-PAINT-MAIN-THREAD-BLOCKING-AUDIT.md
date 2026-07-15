# GRIDLY LP007 Post-Paint Main-Thread Blocking Audit

## 1. Observed user symptom

The page can become visually visible before Gridly is interaction-ready. During that gap, Alerts, Report, Settings, Search, and other controls can all appear tappable while click/pointer work waits behind synchronous main-thread JavaScript. LP007 treats Alerts as one affected surface, not as the assumed owner.

## 2. Visual-ready versus interaction-ready timeline

Gridly already has separate readiness concepts:

1. **Visual Ready** — the inline prepaint guard releases after DOMContentLoaded plus two animation frames and a short timeout, then records `firstVisibleFrame` and `uiUsable`.
2. **Interaction Ready** — button handlers can run only when the browser main thread is free after startup work and queued promise/timer callbacks complete.

LP007 adds timestamps for `scriptStartAt`, `domContentLoadedAt`, `mobilePortraitVisibleAt`, `dockHandlersInstalledAt`, `startupWorkCompletedAt`, and `firstResponsiveInteractionAt` through `window.gridlyPostPaintBlockingAudit?.()`.

## 3. Complete post-paint execution map

Static startup order from the current runtime:

1. `gridlyStartupDiagnostics.js` evaluates and starts the LP007 passive probe.
2. Inline prepaint release schedules visual unlock after DOMContentLoaded, two `requestAnimationFrame` turns, and `setTimeout(..., 180)`.
3. `app.js` DOMContentLoaded bootstrap hydrates elements, initializes search, initializes the map, initializes Supabase, binds events, applies settings, and opens first-run setup when needed.
4. `loadCrossings()` fetches and parses the crossing package, normalizes crossing records, applies awareness context, schedules crossing marker rendering, and triggers incident rendering.
5. `loadRoadwayDataset()` loads road geometry.
6. `loadSharedReports("initial_bootstrap")` starts as a non-awaited startup child stage. After network returns, it synchronously normalizes rows, filters lifecycle state, updates active collections, refreshes incident/hazard views, and calls `renderUnifiedIncidents()` multiple times.
7. `renderCrossings()` runs from the scheduled crossing render frame and may perform marker model/signature work plus marker creation.
8. Desktop-only community pulse and awareness preview renders run during bootstrap when in desktop layout.
9. Startup diagnostics mark UI usable and complete; however, LP007 measures whether additional long tasks continue after the visible frame.

## 4. Major synchronous phases now instrumented

LP007 passively measures these top-level owners:

- `crossing package loading and initial marker rendering` / `loadCrossings`
- `roadway dataset loading` / `loadRoadwayDataset`
- `initial report and incident loading` / `loadSharedReports(initial_bootstrap)`
- `loadSharedReports:<reason>` child timing
- `renderCrossings:<reason>`
- `alert snapshot creation` / `getAlertsSurfaceSnapshot`

The instrumentation records phase start, end, duration, whether the phase occurred after visible paint, and the active function name.

## 5. Long-task evidence

The new audit installs a passive `PerformanceObserver` for `longtask` entries when supported. Each long task records:

- `startTime`
- `duration`
- closest active Gridly phase/stage
- active instrumented function

Until the branch is validated in a browser, exact ownership remains evidence-pending. The helper reports `evidenceConfidence: "architecture-only-pending-browser-validation"` when no browser long task has been captured and upgrades to `browser-measured-longtask` once a long task is observed.

## 6. Interaction event-queue evidence

LP007 adds capture listeners for the first pointer and click events and handler-entry probes in the V2 dock handler plus the Alerts opener. The audit distinguishes:

- event timestamp (`event.timeStamp`)
- capture listener execution time
- Gridly handler entry time
- first surface-open time

This allows the audit to answer whether the event was received late by JavaScript, received promptly but dispatched late, or delayed by surface construction.

## 7. Narrowest proven call chain before browser validation

The narrowest static call chain currently consistent with the symptom is:

`DOMContentLoaded bootstrap` → `loadCrossings()` / `loadRoadwayDataset()` / non-awaited `loadSharedReports("initial_bootstrap")` continuation → synchronous normalization / lifecycle filtering / incident rendering / crossing render scheduling → `renderCrossings()` and/or `renderUnifiedIncidents()` work after visible paint.

Browser validation is required to identify which of those owners dominates the post-paint long task window.

## 8. Why all buttons are affected

A blocked JavaScript main thread delays all event dispatch, not just Alerts. If LP007 records a large `eventQueueDelayMs` before any Gridly handler entry, then buttons visually existed but their handlers could not execute because the browser could not run JavaScript. In that case, Alerts is a victim of startup work rather than the cause.

## 9. Startup completion risk

The current diagnostics can mark UI usable/complete at the visual unlock checkpoint while non-awaited startup hydration and scheduled/timer/render work may still continue. LP007 explicitly separates visible timing from first responsive interaction timing so browser evidence can show whether startup completion is being declared too early for interaction readiness.

## 10. Safest future optimization boundary

Do not optimize Alerts first unless LP007 browser evidence shows Alerts snapshot/render work owns the longest post-paint long task. The safest next milestone is the smallest owner-specific change to the measured dominant phase, preserving startup ordering and outputs. Candidate boundaries include splitting only the proven synchronous loop, moving only the proven provider/normalization work, or deferring only non-required post-visible computation after handlers are responsive.

## 11. Risk assessment

LP007 changes are passive timing/probe additions only. They do not disable providers, change startup ordering, change Alerts rendering, implement Display Candidate, remove data, add overlays, or change presentation output. Runtime risk is limited to tiny `performance.now()` calls and first-event capture listeners.

## 12. Recommendation

Do not merge by default. Run browser validation first, capture the helper output after a clean reload and after the unresponsive period ends, then compare the longest long task and active phase against DevTools.

## 13. Smallest future implementation milestone

After validation, create a follow-up milestone that addresses only the measured dominant owner. The milestone should include one production behavior change and one regression guard proving protected systems and output semantics are preserved.

## 14. Edge DevTools profiler guide

1. Open Edge DevTools → **Performance**.
2. Enable CPU screenshots if useful, then click **Record**.
3. Reload the page while recording is active.
4. Do not tap anything until the visually loaded but unresponsive period completes; optionally tap once during the blocked period to correlate event delay.
5. Stop recording after controls become responsive.
6. In the timeline, locate the longest **Main** thread task after the first visible paint.
7. Open **Bottom-Up** and sort by **Self Time** to find the dominant Gridly function.
8. Open **Call Tree** for the same task and expand until the top Gridly owner is visible.
9. In the console, run `window.gridlyPostPaintBlockingAudit?.()` and compare `longTasks[].startTime`, `phases[]`, `longestPostPaintTaskMs`, and `likelyBlockingOwner` against the DevTools task.
10. If the longest task has no LP007 active function, use the DevTools call tree as the authoritative owner and add a narrower wrapper in the next audit-only pass.
