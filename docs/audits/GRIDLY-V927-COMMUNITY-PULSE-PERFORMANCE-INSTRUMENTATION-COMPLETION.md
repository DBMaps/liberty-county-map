# GRIDLY V927 — Community Pulse Performance Instrumentation Completion

## V926 Browser Evidence

V926 browser validation confirmed the repaired performance framework persisted public results, matched run IDs across result/summary/global state, captured panel-opening, Alerts-rendering, crossing-rendering, long-task, blocked-main-thread, duplicate request/render, correctness, popup, marker membership, crossing generation, restoration, and protected-system evidence. The isolated failure was `missingRequiredSamples: ["communityPulse"]` with `communityPulseP50: null`, `communityPulseP95: null`, and `communityPulseSamples: 0`.

## Root Cause

The automated scenario named `community pulse portrait refresh` invoked `refreshPortraitV2LocalizedIntelligence()`, not `renderGridlyCommunityPulse()`. The V922 Community Pulse timing samples were recorded by `renderGridlyCommunityPulse()` under the `communityPulse` pipeline, while the portrait refresh path recorded its work as a `panel` pipeline call. During unchanged-input runs, V923 reuse guards could safely reuse the existing presentation model and skip panel/DOM writes. That legitimate reuse path produced no `communityPulse` timing sample, so V926 classified the result as missing evidence even though the production portrait path had run.

## Production Path Traced

The simulation calls `refreshPortraitV2LocalizedIntelligence({ reason: "v927-performance-regression-simulation" })` and repeats it with `v927-performance-regression-simulation-repeat`. The production function evaluates `refreshGridlyCommunityPulseSharedModel()` when the shared pulse signature is not already current, compares the portrait presentation model signature, may reuse the prior presentation model, and then enters guarded panel/DOM synchronization sections. The timer for classic Community Pulse samples remains in `renderGridlyCommunityPulse()`; the portrait path is now instrumented with explicit rendered-versus-reuse outcomes rather than forcing desktop Community Pulse rendering.

## Rendered Versus Reused Semantics

V927 distinguishes a real rendered measurement from a valid reuse outcome:

- `rendered`: finite duration, start/end timestamps, production function name, run ID, DOM/panel write indicators, and V923 counters before/after are captured and committed as a real Community Pulse sample.
- `reused`: duration remains `null`, `validOutcome` is true, reason is `unchanged_presentation_model`, and the record carries model reuse, skipped panel update, skipped DOM write, and counter evidence.

A reuse outcome is not a zero-duration timing sample and is excluded from percentile input. Null P50/P95 are correct when the only valid Community Pulse result is unchanged reuse.

## Classification Change

Community Pulse is now considered measured when either a finite rendered timing sample exists or a validated reuse outcome is captured from the production portrait path. The summary reports `communityPulseMeasurementPass`, `communityPulseRenderedSampleAvailable`, `communityPulseReuseOutcomeAvailable`, `communityPulseCaptureStatus`, rendered/reuse counts, and P50/P95 separately. `missingRequiredSamples` only excludes Community Pulse when production-path evidence and a valid outcome exist.

## Synchronization Behavior

V927 keeps V926's bounded render-settling flow. The scenario waits through the existing short animation-frame and active-generation settling helper, then flushes collectors. Completion timeouts continue to be recorded as `completion_signal_timeout`; no arbitrary long sleeps were added.

## Audit Helpers

`window.gridlyPerformanceMeasurementCaptureAudit?.()` now includes a `communityPulse` diagnostic section with production-path, collector, rendered/reuse count, status, reasons, and raw event evidence. V927 also exposes `window.gridlyCommunityPulsePerformanceCaptureAudit?.()` for focused Community Pulse capture review.

## Protected Systems Unchanged

This milestone is instrumentation and classification only. It does not change Community Pulse product copy, portrait refresh behavior, presentation-model reuse, skipped panel updates, skipped DOM writes, crossing rendering/candidate selection, marker lifecycle, popup behavior, Alerts behavior, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase contracts, production write behavior, or protected-system flags.

## Browser Validation Steps

Run the browser validation command from the V927 milestone after loading the app. Valid outcomes are either a finite rendered Community Pulse sample or a `reused_unchanged` capture with production-path and evaluation evidence. Do not treat null P50/P95 as a failure when `communityPulseReuseOutcomeAvailable` is true and `communityPulseMeasurementPass` is true.
