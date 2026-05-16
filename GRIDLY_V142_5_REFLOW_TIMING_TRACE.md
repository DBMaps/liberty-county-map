# GRIDLY V142.5 — Forced Reflow Timing Trace Audit

This patch adds **passive, temporary timing trace instrumentation** for forced-reflow debugging without changing runtime behavior.

## Added helper

- `window.gridlyReflowTraceAudit()`
  - Returns in-memory trace entries from the last 10 seconds.
  - Includes:
    - `timestamp` (`ts`)
    - `label`
    - `phase` (`start` / `end` / `read` / `write` / `raf` / `timeout`)
    - `duration` (when available)
    - `source` (when available)

## Traced areas

- `applyPortraitV2SurfaceContainment`
- `gridlyPortraitV2SheetState`
- `scheduleMapResize`
- map invalidate guard
- `renderAlerts`
- `renderUnifiedIncidents`
- `refreshReportHazardViews`
- route setup open/close
- Manage Places open/close
- Route Watch open/view route
- post-submit refresh

## Constraints respected

- No MutationObservers added.
- No polling added.
- No default noisy logging added.
- Passive in-memory collection only.
- No functional optimization/refactor/behavior changes intended.

## Manual check

1. Hard refresh.
2. Interact until the forced reflow warning appears.
3. Run `window.gridlyReflowTraceAudit()`.
4. Inspect `recent` entries for the immediate pre-warning flow.
