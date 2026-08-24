# LP225 — Idle Long Task Root-Cause Isolation

## Static idle-owner candidate inventory

| Priority | Production entry point | Trigger | Idle reachable / cadence | Major downstream work and visible state | Prior instrumentation | Evidence |
|---|---|---|---|---|---|---|
| High | `loadSharedReports` | startup promise, Supabase realtime, and live-refresh interval completion | Yes; startup, realtime, and configured refresh interval | normalize/reconcile reports, hazards, crossings, awareness refresh, map scheduling | network and startup diagnostics | Strong static reachability; live ownership not yet proved |
| High | `renderCrossings` / `renderCrossingMarkersFromList` | crossing package completion, report refresh, map completion handlers | Yes after async package/report completion | viewport filtering and Leaflet marker reconciliation | V920 measured boundary and crossing audit | Strong boundary, live overlap pending |
| High | hazard/unified incident render chain | report completion and delayed convergence callbacks | Yes | marker and layer reconciliation; map-visible state | V920 measured boundaries | Strong static lineage, live overlap pending |
| High | DriveTexas processing/promotion | source fetch completion or refresh | Yes | normalize/filter/convert official incidents; governed evidence | V920 measurement where routed through existing boundary | LP224 proves promotion cadence, not severe-task causation |
| Medium | weather completion/promotion | source fetch completion | Yes, source cadence dependent | classification and awareness evidence | V920 measurement where routed through existing boundary | Static candidate |
| Medium | awareness/KBYG/Location Context/Community Pulse builds | report/source completion and state convergence | Yes | consumer models and DOM writers | V920 measured boundaries plus writer counters | Static candidate; protected output |
| Medium | roadway dataset activation | startup or county transition fetch completion | Only during delayed startup/transition | geometry parsing and roadway state/map work | V920 measured boundary | Idle-reachable during convergence, not steady idle |
| Medium | audit/diagnostic V919/V920 helpers | measured production calls or explicit diagnostic invocation | Potentially | registries and census aggregation; no intended visible output | explicit `auditOnly` classification | Must be controlled in live evidence |
| Low | storage/profile/home synchronization | explicit transition, restore, focus/visibility paths | Mostly convergence-only | parse/stringify and persisted/canonical state | transition audit | Weak steady-idle candidate |
| Not idle-reachable | report writers and consumer controls | owner submit/clear/click | No without interaction | persistence and hazard lifecycle mutation | writer/network audit | Excluded from untouched-idle trigger set |

## Subsystem instrumentation map

LP225 extends the LP224 bounded authority with one passive recorder. Existing `gridlyV920Measure` boundaries opt into `CROSSINGS`, `ROADWAYS`, `MAP`, `DRIVETEXAS`, `WEATHER`, `AWARENESS`, `SUPABASE_REPORTS`, or `AUDIT`. Each record requires an explicit trigger and caller and stores cheap counts and supplied mutation/no-op facts. It performs no stack capture, equality scan, scheduling, browser API patch, production invocation, or output mutation.

Long Tasks are correlated by half-open time-window overlap and classified as `EXACT_OWNER_OVERLAP`, `MULTIPLE_OWNER_OVERLAP`, `BROWSER_OR_UNINSTRUMENTED`, or `AUDIT_OVERHEAD_CANDIDATE`. Every row says `causationClaimed: false`. Duration families are derived from bounded live entries: 50–299 ms, 300–599 ms, and 600+ ms. They are descriptive, not causal.

## Current attribution status

No new live-browser trace is fabricated by this code milestone. Therefore root-cause confidence remains `UNKNOWN`, `rootCauseCandidate` remains `null`, unexplained count is computed from the owner's next bounded result, and `safeToOptimize` remains false. LP224's Alerts finding remains **independent/unknown with respect to most severe Long Tasks**: redundant and measurable, but not established as causal or materially contributory to the unowned families.

Audit overhead is reported separately when a Long Task overlaps only boundaries marked `auditOnly`. A mixed overlap remains multiple-owner evidence. Production logic is never disabled. The appropriate recommendation until repeatable owner acceptance is captured is **LP225 NEEDS MORE LIVE ATTRIBUTION**.

## Exact owner console acceptance workflow

```js
gridlyRuntimePerformanceAudit("reset")
const id = gridlyRuntimePerformanceAudit("begin", "IDLE")
// Wait manually without interacting with Gridly, then run:
const result = gridlyRuntimePerformanceAudit("end", id)
console.log("=== LP225 IDLE LONG TASK ROOT-CAUSE ACCEPTANCE ===")
console.log("Transaction:", result.transactionId, result.label)
console.log("Duration:", result.durationMs)
console.log("Long Task Count:", result.longTasks.length)
console.log("Max Long Task:", result.maxLongTaskDurationMs)
console.log("Long Task Families:", result.longTaskFamilies)
console.log("Top Idle Owner:", result.topIdleOwner)
console.log("Top Owner By Total Duration:", result.topOwnerByTotalDuration)
console.log("Top Owner By Max Invocation:", result.topOwnerByMaxInvocationDuration)
console.log("Owner Lineage:", result.ownerLineage)
console.log("Long Task Owner Overlap:", result.longTaskOwnerOverlap)
console.log("Audit Overhead Assessment:", result.auditOverheadAssessment)
console.log("Unexplained Long Tasks:", result.unexplainedLongTaskCount)
console.log("Root Cause Candidate:", result.rootCauseCandidate)
console.log("Root Cause Confidence:", result.rootCauseConfidence)
console.log("Safe To Optimize:", result.safeToOptimize)
result
```

**NO PERFORMANCE OPTIMIZATION WAS APPLIED.**

## Final audit-overhead control

The bounded live-owner trace classified all three 1,343–1,381 ms Long Tasks as
`AUDIT_OVERHEAD_CANDIDATE` because each task overlapped one or more measured
subsystem boundaries and **every** overlapping boundary was explicitly marked
`auditOnly: true`. Consequently the audit-only overlap count was three, no task
was left browser/uninstrumented, and the overlap remained correlation rather
than a causation claim. The trace therefore does not authorize production work.

`FULL_ATTRIBUTION` is the unchanged LP224/LP225 path: transaction baseline and
final audit censuses, Alerts stage records, subsystem records, counter and
surface deltas, repeated-work deltas, trigger/owner lineage, and Long Task
overlap/family aggregation are collected. `MINIMAL_LONG_TASK_CONTROL` retains
only the boundary reset, synchronous bounded transaction timestamps, and the
existing `PerformanceObserver` Long Task collection. It does not call the
optional census helpers at begin/end, accept stage or subsystem records, or
calculate attribution, lineage, overlap, repeated-work, scheduler, writer,
render, or surface deltas. Neither mode invokes production work or modifies
production scheduling, writers, rendering, data flow, or browser APIs.

Run similarly sized, untouched windows with these synchronous console steps
(there are no Promise wrappers or automatic timers):

```js
// FULL_ATTRIBUTION
gridlyRuntimePerformanceAuditSetMode("FULL_ATTRIBUTION")
gridlyRuntimePerformanceAuditReset()
const fullId = gridlyRuntimePerformanceAuditBegin("IDLE")
// Wait manually without interacting, then:
const full = gridlyRuntimePerformanceAuditControlEnd(fullId)

// MINIMAL_LONG_TASK_CONTROL
gridlyRuntimePerformanceAuditSetMode("MINIMAL_LONG_TASK_CONTROL")
gridlyRuntimePerformanceAuditReset()
const minimalId = gridlyRuntimePerformanceAuditBegin("IDLE")
// Wait manually without interacting, then:
const minimal = gridlyRuntimePerformanceAuditControlEnd(minimalId)
```

Both `full` and `minimal` have only this comparison contract:

```js
{ mode, durationMs, longTaskCount, maxLongTaskDurationMs, longTasks }
```

Decision rule: severe tasks in FULL but not MINIMAL are
`AUDIT_OVERHEAD_CONFIRMED_OR_STRONGLY_SUPPORTED`; similar tasks in both are
`PRODUCTION_OR_BROWSER_WORK_REMAINS`; mixed evidence is `INCONCLUSIVE`. The
latter two outcomes do not authorize optimization, and confirmed audit tasks
must not be treated as production defects.
