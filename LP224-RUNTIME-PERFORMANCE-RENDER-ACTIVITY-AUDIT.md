# LP224 — Runtime Performance & Render Activity Audit

## Scope and evidence rule

LP224 adds passive diagnostics only. It does not remove, debounce, defer, or replace any production callback, writer, refresh, eligibility rule, or publication path. Static risk is not a defect; only a live trace may promote `UNKNOWN`.

## Static performance inventory

| Path | Trigger and cadence | Coalescing / cancellation | Surface | Classification |
|---|---|---|---|---|
| Crossing render frame | state or viewport change | one pending frame; reasons merge | crossings | EXPECTED; runtime duration needed |
| Crossing batches | render generation | generation-cancellable bounded batches | crossing markers | EXPECTED |
| Alerts location sync | Alerts writer | scheduled identity sync | Alerts | EXPECTED; protects LP223 |
| Alerts background refresh | Alerts open | paint boundary then timeout, not polling | reports/Alerts | EXPECTED |
| Shared-report interval | bootstrap/live refresh | existing interval lifecycle | all report consumers | UNKNOWN pending idle sample |
| Official roadway publisher | interval plus publication rAF | scheduled publication | roadway consumers | UNKNOWN pending trace |
| Provider activation | provider publication rAF | narrow callback | consumers | EXPECTED |
| Portrait spatial ownership | interaction rAF and delayed sync | established lifecycle | portrait | POTENTIAL_LAYOUT_RISK |
| Map resize/invalidate | panel/viewport transition | rAF in relevant flows | Leaflet/map | POTENTIAL_LAYOUT_RISK |
| Map events | Leaflet move/moveend/zoom/zoomend | crossings path is frame-coalesced | map/crossings | UNKNOWN |
| Mutation/resize observers | established UI/runtime changes | disconnectable | responsive/runtime surfaces | LEGACY-BUT-HARMLESS until invocation evidence |
| Supabase realtime | provider/report subscription | subscription lifecycle controlled | synchronization | EXPECTED |

Static review found bounding-rectangle, size, computed-style, and Leaflet sizing reads near UI writes. They remain `POTENTIAL_LAYOUT_RISK`; LP224 does not claim a forced layout without live write/read ordering evidence.

## Render / writer ownership map

| Surface | Authoritative path | Secondary path | Expected transaction baseline |
|---|---|---|---|
| Alerts | open → background refresh → `renderAlerts` → portrait synchronization/authoritative DOM | shell/provisional content | one open path; live write count required |
| KBYG | governed projection → Awareness Brief build/presentation → existing writer | diagnostic projections | one converged presentation |
| Location Context | governed active summary → reconciliation → portrait writer | diagnostic projections | one converged presentation |
| Community Pulse | model build → `renderGridlyCommunityPulse` / portrait copy sync | legacy audit state | one decision and bounded write |
| Map hazards | active incident collection → list/map marker rendering | portrait hazard list | bounded reconciliation |
| Crossings | active county inventory → render/viewport filters → frame-coalesced render → generation batches | crossing diagnostics | bounded generation |
| Report submit | persistence → lifecycle → shared refresh → consumers → map | post-submit diagnostics | one persistence and bounded refresh |
| Community/county transition | canonical selection → county → crossings/roadways → awareness/map/consumers | transition diagnostics | one canonical transition |

The authoritative Alerts writer remains `renderAlerts`; LP224 neither wraps nor replaces it.

## Existing helper assessment

- Background-loop, reflow, refresh-breakdown, post-submit, network, and domain audits remain useful source-specific evidence.
- Older performance aggregators do not provide LP224 transaction identity.
- Optional V919 instrumentation replaces browser functions while enabled and can suppress selected hidden-tab callbacks. It is **not** LP224 passive authority and is classified `AUDIT-ONLY` here.
- Domain helpers are authoritative only for their contracts; naming does not prove runtime ownership.

## Passive instrumentation and authoritative helper

`window.gridlyRuntimePerformanceAudit()` aggregates existing measured boundaries without wrapping writers or schedulers. A native `PerformanceObserver`, when available, records Long Tasks against explicit transaction timestamps. Unsupported APIs fail closed. Reset advances a measurement generation and records a monotonic cutoff; because browser-buffered performance entries cannot be deleted, entries older than that cutoff are truthfully excluded rather than represented as removed.

LP224.3 adds transaction-scoped records from explicit Alerts production boundaries. Each record carries the production owner supplied at the call site (or `null`), timing, mutation/output/write facts, and generation identity. Explicit stage call sites supply ownership; the top-level snapshot boundary also records its immediate available production stack frame rather than inventing a semantic trigger. End results now include `stageTimings`, `triggerLineage`, `longTaskStageOverlap`, `topStageByTotalDuration`, `topStageByMaxInvocationDuration`, `topIdleTrigger`, and the deliberately conservative `firstExpensiveStage`.

## Owner synchronous console workflow

Reset once before each measurement, begin a named transaction, perform or wait for the action manually, and end it. No Promise wrapper is needed.

```js
gridlyRuntimePerformanceAudit("reset")
const id = gridlyRuntimePerformanceAudit("begin", "IDLE")
// Wait manually, then:
gridlyRuntimePerformanceAudit("end", id)
```

```js
gridlyRuntimePerformanceAudit("reset")
const id = gridlyRuntimePerformanceAudit("begin", "OPEN_ALERTS")
// Tap Alerts and wait for visible completion, then:
gridlyRuntimePerformanceAudit("end", id)
```

The same `begin` call accepts `COMMUNITY_CHANGE`, `MAP_PAN`, `MAP_ZOOM`, or `REPORT_SUBMIT`. The direct aliases remain available: `gridlyRuntimePerformanceAuditReset()`, `gridlyRuntimePerformanceAuditBegin(label, reason)`, and `gridlyRuntimePerformanceAuditEnd(id)`.

Each end result includes transaction identity and bounds, canonical `durationMs` Long Tasks, maximum Long Task duration, surface/render/writer/scheduling/repeated-work deltas, stage timings, explicit trigger lineage, and overlap-only Long Task correlation. `EXACT_STAGE_OVERLAP` means exactly one measured stage window intersects a Long Task; it does not mean that stage caused the Long Task.

For the final owner pass, run the first block, leave the application untouched for the same bounded window, then run the second block exactly:

```js
gridlyRuntimePerformanceAudit("reset");
window.__lp224FinalId = gridlyRuntimePerformanceAudit("begin", "IDLE", "owner final live attribution pass");
```

```js
window.__lp224FinalResult = gridlyRuntimePerformanceAudit("end", window.__lp224FinalId);
console.table(window.__lp224FinalResult.stageTimings);
console.table(window.__lp224FinalResult.triggerLineage);
console.table(window.__lp224FinalResult.longTaskStageOverlap);
console.log({
  topStageByTotalDuration: window.__lp224FinalResult.topStageByTotalDuration,
  topStageByMaxInvocationDuration: window.__lp224FinalResult.topStageByMaxInvocationDuration,
  topIdleTrigger: window.__lp224FinalResult.topIdleTrigger,
  firstExpensiveStage: window.__lp224FinalResult.firstExpensiveStage,
  safeToOptimize: window.gridlyRuntimePerformanceAudit().safeToOptimize
});
window.__lp224FinalResult;
```

## Owner aggregate console block

```js
(() => {
  const a = window.gridlyRuntimePerformanceAudit?.();
  console.log("=== LP224 RUNTIME PERFORMANCE ACCEPTANCE ===");
  console.log("Community:", a?.session?.canonicalCommunity);
  console.log("County:", a?.session?.activeCountyId);
  console.log("Idle:", a?.idle);
  console.log("Alerts:", a?.surfaces?.alerts);
  console.log("Awareness:", { kbygWrites: a?.surfaces?.kbyg?.writes, locationContextWrites: a?.surfaces?.locationContext?.writes, communityPulseWrites: a?.surfaces?.communityPulse?.writes });
  console.log("Map:", { hazardRenderCount: a?.surfaces?.mapHazards?.renderCount, crossingRenderCount: a?.surfaces?.crossings?.renderCount });
  console.log("Layout:", { forcedLayoutRisks: a?.layout?.suspectedForcedLayouts, sites: a?.layout?.confirmedRiskSites });
  console.log("Long Tasks:", { count: a?.longTasks?.length, maxDuration: Math.max(0, ...(a?.longTasks || []).map(x => x.durationMs)) });
  console.log("Repeated Work:", a?.repeatedWork);
  console.log("First Expensive Stage:", a?.firstExpensiveStage);
  console.log("Safe To Optimize:", a?.safeToOptimize);
  return a;
})()
```

Canonical community context is read passively from `gridlyGetCanonicalActiveCommunityState().selectedAwarenessArea`; it remains null when that governed authority has no selected community and is never inferred from county.

## Classified findings and optimization candidates

1. **CONFIRMED PERFORMANCE DEFECT FAMILY:** the bounded owner trace establishes repeated Alerts preparation during untouched idle. The committed evidence does not yet establish which measured stage overlaps the 1176–1255 ms Long Tasks.
2. **STRONGEST ROOT-CAUSE CANDIDATE, awaiting LP224.3 owner trace:** a production consumer repeatedly calling `getAlertsSurfaceSnapshot`, because that explicit boundary owns community collection, provider promotions, area eligibility/deduplication, and official-situation merge. The final trace must identify its upstream call-site lineage before optimization is authorized.
3. **UNKNOWN / NEEDS LIVE BROWSER:** application interval activity in a bounded idle window.
4. **POTENTIAL_LAYOUT_RISK:** UI/map write/read adjacency; promote only with runtime evidence.
5. **BENIGN / EXPECTED:** frame-coalesced crossings and generation batches unless redundant generations are observed.
6. **AUDIT OVERHEAD:** opt-in legacy wrappers and simulations; exclude them from the production baseline.

LP224 can close the defect-family confirmation, but not expensive-stage attribution, until the final LP224.3 owner result is captured. A separate LP225 optimization milestone is justified only after that result identifies a narrow repeated production entry path. `firstExpensiveStage` remains null and `safeToOptimize` remains false in this pass.

## Regression statement

LP224 changes no consumer membership, presentation contract, location precedence, lifecycle or UUID semantics, governance, crossings/roadway activation, persistence, hazard lifecycle, or Supabase synchronization.

**NO PERFORMANCE OPTIMIZATION WAS APPLIED.**
