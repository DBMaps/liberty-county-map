# GRIDLY V733 — Liberty Awareness Refresh Performance Audit

## Final determination

**LIBERTY AWARENESS REFRESH PERFORMANCE AUDIT — BLOCKED**

1. **Is Liberty launch readiness blocked by refresh performance?** Yes. The V732 device evidence showed a single refresh cycle at **32,757.9 ms**, with the largest children concentrated in awareness/community/localized intelligence and unified marker rendering.
2. **Highest-confidence root cause:** repeated refresh-cycle rebuilds of the same Awareness / Community Pulse / localized-intelligence model stack, where the mobile refresh path invokes `refreshGridlyCommunityPulseSharedModel`, then `refreshPortraitV2LocalizedIntelligence`, and both share/rebuild active-awareness inputs. The lower-level commute/localized builders include per-incident label, road, corridor, route-relevance, and awareness-area work, and the current signatures do not prove that unchanged inputs are reused before the expensive stack runs.
3. **Function V734 should target first:** `refreshGridlyCommunityPulseSharedModel`, because it directly builds `buildGridlyCommunityPulseModel`, which in turn builds the community presence dataset, active awareness, community awareness summary, corridor scoring, copy selection, and synced portrait copy before the portrait refresh consumes the shared model.
4. **Smallest safe V734 fix:** add a narrow input-signature reuse guard around the shared Community Pulse / active-awareness model for unchanged Liberty inputs, then have `refreshPortraitV2LocalizedIntelligence` consume that reused model and skip any category-only fallback localized rebuild unless its category/location inputs changed. This should preserve launch correctness because it reuses the same model only when active reports, active hazards, selected awareness area, route-watch state, and county context are unchanged.
5. **V734 performance target:** reduce the measured Liberty portrait/mobile refresh from ~32.8s to **under 5s p95 on the same physical-device scenario**, with `refreshGridlyCommunityPulseSharedModel` and `refreshPortraitV2LocalizedIntelligence` each **under 1.5s p95**, and `renderUnifiedIncidents` **under 500ms** when only two active incidents render.
6. **Is Dispatch Board work safe to begin before this is fixed?** No. Dispatch Board work should wait because its surfaces would sit on top of the refresh cycle currently dominated by Awareness / Community Pulse work and could mask or worsen the Liberty launch blocker.

## Scope confirmation

This audit is documentation/evidence only. No runtime behavior, UI behavior, county status, Dispatch Board behavior, directional systems, or onboarding state was changed.

## Protected systems confirmation

The audit did not alter these protected modes:

| System | Required state | Audit state |
|---|---:|---:|
| `historicalReadsEnabled` | `false` | unchanged |
| `historyUiEnabled` | `false` | unchanged |
| `DriveTexasPaused` | `true` | unchanged |
| `TransportationIntelligenceEnabled` | `false` | unchanged |
| `TransportationIntelligenceDisplay` | `false` | unchanged |
| `TransportationIntelligenceActivation` | `false` | unchanged |

County posture was not changed by this audit. Liberty remains the launch-focus county for this audit; Montgomery and San Jacinto were not modified; Jefferson remains deferred for this audit scope.

## Runtime evidence reviewed

The following existing helper outputs were reviewed statically and mapped to the V732 evidence. A fresh browser capture was not added because the scope forbids broad helper systems and this environment does not provide the V732 physical device session state.

| Helper | Existing coverage | Gap |
|---|---|---|
| `gridlyRefreshBreakdownAudit` | Exposes last refresh duration, sorted child durations, item counts, cache-reuse indicator, unchanged DOM write skips, and route-intelligence idle/active state. | Needs a fresh physical-device capture after V734 to verify the target. |
| `gridlyBackgroundLoopAudit` | Exposes top-panel write counts, repeated same-value write suppression, owner-check counts, refresh counts, active timers, and suspected loops. | It identifies loop/write pressure but not the full cost inside Community Pulse builders. |
| `gridlyAuditPerformanceReview` | Summarizes performance audit state and recommendations. | Depends on prior runtime measurements being populated. |
| `gridlyUiSmokeTest` | Confirms core UI surfaces/helper availability. | Smoke only; not a timing profiler. |
| `gridlyActiveHazardCountReconciliationAudit` | Reconciles active hazards through marker/alert/awareness count paths. | Count correctness only; not sufficient to explain 14s builder costs. |
| `gridlyRouteIntelligenceDebug` | Reports route-relevant hazards and route watch confidence state. | Calls route hazard assessment and unified incidents; use after V734 to verify idle route work stays low. |
| `gridlyRouteWatchDebug` | Reports route-watch active/selection/activation state. | Needs paired timing evidence from refresh breakdown. |

## Static findings by primary audit question

### 1. Why is `refreshPortraitV2LocalizedIntelligence` taking ~14.5s?

The portrait function now appears intended to be a reuse path: it collects DOM nodes, computes a quiet-fast-path preflight, and builds a portrait shared localized intelligence snapshot from the Community Pulse audit state. The expensive risk is that the shared snapshot can still call `buildUnifiedLocalizedCommuteIntelligence({ limit: 6 })` when the current primary headline is category-only, and the function also runs hazard-count consistency, active-state evidence ownership, portrait panel sync, community pulse copy sync, top-panel ownership diagnostics, and a `getUnifiedIncidents()` signature update for daily habit status.

The V732 timing is therefore most consistent with the portrait refresh paying for reused-model assembly plus fallback localized/commute intelligence and ownership/DOM synchronization, not with simple text writes alone.

### 2. Why is `refreshGridlyCommunityPulseSharedModel` taking ~14s?

`refreshGridlyCommunityPulseSharedModel` always calls `buildGridlyCommunityPulseModel`. That model builds the community presence dataset, builds lightweight active awareness, builds or validates a community awareness summary, scores dominant corridors, selects phrase templates, and then syncs Community Pulse copy. The community presence dataset itself scores all candidate incidents and sorts them before selecting a small visible subset.

The strongest V734 target is a signature cache at this boundary because the shared model is immediately consumed by portrait refresh on the same refresh cycle, and unchanged inputs do not need a full rebuild.

### 3. Why is `renderUnifiedIncidents` taking ~4.3s with only 2 active incidents?

`renderUnifiedIncidents` clears the entire unified incident layer, rebuilds unified incidents, filters/dedupes, checks crossing-layer ownership suppression, creates Leaflet marker HTML/icons, binds popups, updates layer state, and calls `renderGridlyCommunityPulse` afterward. Even with two active incidents, the measured time can include upstream `getUnifiedIncidents()` work, layer clearing/recreation, popup HTML generation, and the post-render Community Pulse call.

V734 should not start here unless new runtime evidence shows marker creation/layer updates are the slowest nested render phase. It is the third-largest child and likely downstream of the same rebuild pattern.

### 4. Are these functions doing repeated scans over large county assets, roads, crossings, or unified incident arrays?

Yes, static review shows repeated array scans are possible:

- Liberty road segments contain **8,407** features, so any per-incident nearest-road fallback can become expensive if cache misses occur.
- Liberty rail crossings contain **5** local crossings, so crossing-count scans alone are unlikely to explain 14s.
- `buildGridlyCommunityAwarenessIntelligenceSummary` filters active hazards and active reports by awareness area and resolves crossings in area.
- `buildCommuteConsequenceIntelligence` maps active unified incidents and performs label generation, crossing disruption checks, route relevance checks, road priority, town mentions, corridor inference, sorting, filtering, corridor grouping, top-status diagnostics, and recommendation generation.
- `renderUnifiedIncidents` rebuilds and filters unified incidents, then recreates marker layer contents.

### 5. Is route/commute intelligence being rebuilt when Route Watch is inactive?

Partly. Route hazard scoring is guarded by `routeWatchActivated`, but `buildCommuteConsequenceIntelligence` still performs `isIncidentRouteRelevant` inside the per-incident map. Existing route relevance audit text already flags this as unnecessary idle work if checks run while route watch is inactive. Static review also shows suspected-misattribution fields for inactive route watch, so V734 should verify route relevance is not the 14s source before changing routing behavior.

### 6. Is Community Pulse recomputing when inputs have not changed?

Yes, by static call structure. The mobile refresh path calls `refreshGridlyCommunityPulseSharedModel` every refresh cycle before portrait refresh. No narrow unchanged-input return was identified at `refreshGridlyCommunityPulseSharedModel` itself.

### 7. Is localized intelligence recomputing when inputs have not changed?

Likely yes in category-only or fallback cases. Portrait refresh has a shared-model reuse path, but `buildGridlyPortraitSharedLocalizedIntelligenceSnapshot` can still call `buildUnifiedLocalizedCommuteIntelligence` when primary text lacks usable location detail. That fallback can rebuild localized/commute labels even when incident inputs are unchanged.

### 8. Are repeated DOM writes, owner diagnostics, or top-panel checks contributing?

They contribute but are unlikely to be the primary 14s root cause. `setGridlyTopPanelTextIfChanged` suppresses same-value writes and records diagnostics, while `gridlyBackgroundLoopAudit` exposes repeated writes and owner-check counts. The portrait function still calls ownership diagnostics every refresh, so V734 should preserve write suppression and consider gating diagnostics under existing debug/audit needs only after builder reuse is fixed.

### 9. Is the slowdown Liberty-specific or platform-wide?

The pattern is platform-wide, but Liberty has the most launch-critical exposure because Liberty owns production road/crossing assets and is the primary launch county. The 8,407-feature Liberty road-segment asset increases the penalty of repeated road-name/corridor lookup cache misses. Montgomery has missing road segments, which may avoid the same road-scan cost. San Jacinto has road geometry, but this audit did not validate San Jacinto runtime performance and did not change its status.

### 10. What is the smallest safe fix that preserves launch correctness?

Implement a V734 reuse guard around the shared awareness model, not a broad refactor:

1. Compute a compact Liberty awareness signature from county id, selected awareness area, active report IDs/status/updated timestamps, active hazard IDs/status/updated timestamps, route-watch active/configured state, and latest unified incident IDs/status/updated timestamps.
2. In `refreshGridlyCommunityPulseSharedModel`, return the last model when the signature is unchanged, while still recording audit reuse state.
3. Pass that reused model into `refreshPortraitV2LocalizedIntelligence` and skip fallback `buildUnifiedLocalizedCommuteIntelligence` unless the category-only primary or selected active detail changed.
4. Keep DOM write guards unchanged.
5. Do not alter county status, Dispatch Board, route behavior, or marker semantics.

## Slowest sections and repeated equivalent calls

| Rank | V732 observed child | Duration | Static root-cause candidate | V734 action |
|---:|---|---:|---|---|
| 1 | `refreshPortraitV2LocalizedIntelligence` | 14,471 ms | Shared snapshot plus fallback localized/commute rebuild and ownership/copy sync. | Consume cached shared model and cache category-only fallback result by active detail signature. |
| 2 | `refreshGridlyCommunityPulseSharedModel` | 14,003.3 ms | Full `buildGridlyCommunityPulseModel` on every refresh. | Add unchanged-input model reuse here first. |
| 3 | `renderUnifiedIncidents` | 4,280.5 ms | Layer clear/recreate, unified incident build, popup/marker work, and post-render Community Pulse render. | Re-measure after model reuse; only then consider marker diffing. |

## Candidate V734 fix path

**Recommended V734 scope:** Awareness-model memoization only.

In scope:

- Add one compact signature and last-result cache for `refreshGridlyCommunityPulseSharedModel` / `buildGridlyCommunityPulseModel` outputs.
- Add audit fields for `communityPulseModelReuseApplied`, `communityPulseModelSignature`, and cache hit/miss reason.
- Reuse the shared model inside `refreshPortraitV2LocalizedIntelligence`.
- Guard category-only localized fallback with a small active-detail signature.
- Verify route watch inactive state does not rebuild route geometry or route hazard assessment.

Out of scope for V734:

- Dispatch Board changes.
- County status changes.
- Directional system changes.
- Marker rendering diff refactor unless V734 evidence still shows `renderUnifiedIncidents` over 500ms after model reuse.
- Broad helper/profiler systems.

## Denise validation steps

1. Open Liberty on the same physical device/profile used for V732.
2. Ensure Route Watch is inactive.
3. Trigger the same refresh scenario that produced the 32,757.9 ms cycle.
4. In DevTools console, run:
   - `gridlyRefreshBreakdownAudit()`
   - `gridlyBackgroundLoopAudit()`
   - `gridlyAuditPerformanceReview()`
   - `gridlyUiSmokeTest()`
   - `gridlyActiveHazardCountReconciliationAudit()`
   - `gridlyRouteIntelligenceDebug()`
   - `gridlyRouteWatchDebug()`
5. Capture the returned JSON for each helper.
6. Confirm `gridlyRefreshBreakdownAudit().itemCounts.routeIntelligenceState` is `idle` when Route Watch is inactive.
7. Confirm `gridlyRefreshBreakdownAudit().lastRefreshDuration` is under 5,000 ms after V734.
8. Confirm `refreshGridlyCommunityPulseSharedModel` and `refreshPortraitV2LocalizedIntelligence` child durations are each under 1,500 ms after V734.
9. Confirm `renderUnifiedIncidents` is under 500 ms with the same two active incidents.
10. Confirm helper outputs still show active hazard count reconciliation passing and no protected system/county status changes.

## Merge recommendation

Merge this audit as **BLOCKED documentation/evidence only**. Do not begin Dispatch Board work until V734 reduces the Liberty refresh cycle and Denise validates the physical-device target.
