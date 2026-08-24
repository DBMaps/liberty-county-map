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

`window.gridlyRuntimePerformanceAudit()` aggregates existing measured boundaries without wrapping writers or schedulers. A native `PerformanceObserver`, when available, records long tasks with the contemporaneous LP224 transaction ID. Unsupported APIs fail closed. Manual transaction boundaries use monotonic IDs; reset is explicit and deterministic.

The helper reports unknowns rather than inventing attribution. `safeToOptimize` is true only after an existing measured function exceeds 50 ms; a Long Task entry alone is never assigned to a function.

## Owner single console acceptance block

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

Call `gridlyRuntimePerformanceAuditBegin(type, reason)` before an action and `gridlyRuntimePerformanceAuditEnd(id)` after convergence. Baseline labels are `FRESH_LOAD`, `COMMUNITY_CHANGE`, `OPEN_ALERTS`, `REOPEN_ALERTS`, `OPEN_SETTINGS`, `MAP_PAN`, `MAP_ZOOM`, `REPORT_SUBMIT`, `ACTIVE_EVIDENCE_REFRESH`, and `IDLE`.

## Classified findings and optimization candidates

1. **UNKNOWN / NEEDS LIVE BROWSER:** owner of historical 119–353 ms violations. Capture transactions and a Performance profile; Long Task entries do not prove function ownership.
2. **LIKELY PERFORMANCE DEFECT, not confirmed:** repeated shared-refresh/consumer work if live evidence records equivalent post-convergence writers.
3. **UNKNOWN / NEEDS LIVE BROWSER:** application interval activity in a bounded idle window.
4. **POTENTIAL_LAYOUT_RISK:** UI/map write/read adjacency; promote only with runtime evidence.
5. **BENIGN / EXPECTED:** frame-coalesced crossings and generation batches unless redundant generations are observed.
6. **AUDIT OVERHEAD:** opt-in legacy wrappers and simulations; exclude them from the production baseline.

No confirmed defect is asserted from static evidence. Once evidence exists, candidate order is: first attributable >50 ms writer/render stage; duplicate refresh publication; idle application work; confirmed write/read layout thrash.

## Regression statement

LP224 changes no consumer membership, presentation contract, location precedence, lifecycle or UUID semantics, governance, crossings/roadway activation, persistence, hazard lifecycle, or Supabase synchronization.

**NO PERFORMANCE OPTIMIZATION WAS APPLIED.**
