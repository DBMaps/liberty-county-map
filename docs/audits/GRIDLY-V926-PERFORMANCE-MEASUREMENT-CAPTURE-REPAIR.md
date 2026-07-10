# Gridly V926 — Performance Measurement Capture Repair

## Root cause

The V925 correctness simulation executed the production interaction paths, but its performance snapshot read from `window.gridlyPerformanceSimulationSummary?.()`, which was not present in the current runtime. Missing percentile inputs were coerced with `Number(value || 0)`, so unavailable collectors and empty sample arrays were reported as zero. The public `window.gridlyPerformanceRegressionSimulationResult` was also never intentionally assigned, while the private `gridlyV925PerformanceRegressionResult` variable was assigned, causing the summary helper and public global to diverge.

## Collector lifecycle

V926 adds an explicit per-run measurement lifecycle scoped to `window.gridlyRunPerformanceRegressionSimulation?.()`:

1. Reset per-run timing, long-task, duplicate-request, and duplicate-render sample arrays.
2. Generate a unique `runId` and arm collectors before the baseline scenario.
3. Execute the same production scenario interactions used by V925.
4. Await bounded render/animation-frame completion and drain V921/V922 timing calls after each scenario.
5. Flush `PerformanceObserver.takeRecords()` before the final snapshot.
6. Snapshot finite samples, percentiles, capture statuses, and raw diagnostics.
7. Stop/disarm temporary collectors and restore any previous `window.gridlyV920MeasureFunction`.
8. Persist the finalized result to both the private result and `window.gridlyPerformanceRegressionSimulationResult`.

Collectors are not left permanently armed after the simulation.

## Synchronization strategy

The helper waits through bounded animation-frame settling and the existing V921 crossing generation active-generation signal. It does not use long arbitrary sleeps as the primary synchronization mechanism. If the crossing generation signal does not settle within the short bounded wait, V926 records a `completion_signal_timeout` warning for diagnosis.

## Metric semantics

V926 no longer treats missing measurements as zero. Percentiles are calculated only from valid finite samples. Missing required samples are represented as `null` percentile values with explicit capture status and reasons such as `percentile_input_empty`, `production_path_not_triggered`, `observer_unsupported`, or `completion_signal_timeout`.

A valid zero-duration sample remains distinguishable from a missing sample through `captureStatus: "captured_zero"` and `reason: "valid_zero_duration_sample"`.

## Long-task behavior

Long-task collection is armed only during the simulation run. Unsupported browsers report `observer_unsupported`; supported browsers with no entries report `supported_no_entries`. Blocked main-thread time is calculated as `sum(max(0, longTask.duration - 50))`, which documents the portion over the Long Tasks API threshold.

## Public result persistence

`window.gridlyPerformanceRegressionSimulationResult` is assigned when a run begins with `completed: false`, updated while scenarios complete, finalized on success/failure, and cleared by `window.gridlyResetPerformanceRegressionSimulation?.()`. The summary helper reads the same persisted result, so public and internal run IDs should match.

## Protected systems unchanged

The V926 patch is measurement-capture only. It does not add production writes and keeps these systems marked unchanged/protected: Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase contracts, report creation, report clearing, public roadway filtering, popup behavior, viewport behavior, crossing marker lifecycle, crossing visibility, Alerts behavior, and Community Pulse behavior.

## Browser helpers

- `await window.gridlyRunPerformanceRegressionSimulation?.()`
- `window.gridlyResetPerformanceRegressionSimulation?.()`
- `window.gridlyPerformanceRegressionSummary?.()`
- `window.gridlyPerformanceRegressionSimulationResult`
- `window.gridlyPerformanceMeasurementCaptureAudit?.()`
