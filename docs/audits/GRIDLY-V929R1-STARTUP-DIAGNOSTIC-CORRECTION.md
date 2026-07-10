# GRIDLY V929R1 Startup Diagnostic Correction

## Runtime evidence captured

Denise's V929 startup trace showed a total startup duration of **182,059 ms**. The `DOMContentLoaded application bootstrap` stage consumed **181,225.3 ms**, while map initialization was **80.1 ms**, Supabase initialization was **10.6 ms**, crossing package loading and first marker rendering was **1,271.6 ms**, roadway dataset loading was **473.2 ms**, and `initial report and incident loading` consumed **179,137.3 ms**.

The original audit result was incorrect because the report stage had a **15,000 ms** timeout yet was later recorded as completed, with `timedOutStages`, `warnings`, and `failures` empty. It also reported `stalled: false`, `degradedStartup: false`, `safeForBeta: true`, and a healthy recommendation even though the dark prepaint/startup lock left the application visually unavailable for a multi-minute interval.

## Corrected interpretation

A startup that crosses the watchdog or stage-timeout threshold is now durable degraded evidence even if the underlying operation eventually resolves. The expected interpretation for the captured trace is:

- `startupCompleted: true` only after bootstrap completion.
- `uiUsable: true` only after the prepaint/startup lock has been released and a visible Gridly frame can accept interaction.
- `slowStartup: true` for multi-minute startup duration.
- `watchdogTriggered: true` and `stalled`/`previouslyStalled: true` when the watchdog threshold is crossed.
- `degradedStartup: true` and `safeForBeta: false` while the excessive report-stage cause remains unresolved.
- `warnings` must include the excessively slow report stage or watchdog event.

## V929R1 implementation notes

`loadSharedReports("initial_bootstrap")` is no longer treated as an opaque stage. The startup audit now records nested child stages for Supabase report fetch, local filtering and normalization, active/cleared/stale reconciliation, report visibility processing, marker/model preparation, unified incident render calls, and report/awareness/route-watch render refresh work.

The startup timeout wrapper now records timeout as durable state, prevents late completion from overwriting `timed-out`, and records late completion separately. If synchronous work blocks the main thread long enough that timer callbacks cannot run on time, the stage is still marked `timed-out` when control returns because its measured duration exceeded the configured timeout.

Initial report hydration is started during bootstrap but is no longer awaited before startup completion. The visible shell and map can unlock first; live reports hydrate afterward and update UI surfaces when available. This preserves report integrity without showing stale live reports as current and without introducing extra Supabase requests.

## Updated console validation commands

```js
window.gridlyStartupAudit?.()
```

```js
await window.gridlyRunStartupDiagnosticsValidation?.()
```

```js
window.gridlyStartupAudit?.().stages.filter((stage) => stage.parentStage === "initial report and incident loading")
```

```js
window.gridlyStartupSummary?.()
```
