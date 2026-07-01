# GRIDLY V728 — Liberty County Production Readiness Audit #1

**Mission:** Know Before You Go  
**Mode:** GRIDLY LAUNCH FOCUS MODE  
**Primary launch county:** Liberty County  
**Support counties:** Montgomery County, San Jacinto County  
**Deferred:** Jefferson County and future counties  
**Scope:** Audit only. No runtime/UI/county activation/directional/Dispatch Board changes were made.

## Final Determination

**LIBERTY PRODUCTION READINESS AUDIT #1 — PASS WITH OBSERVATIONS**

The reported combined state — **“No active local issues reported”** plus **“2 active issues nearby”** — is explainable by existing source ownership only if the two messages were produced by different geographic scopes or different surfaces: local awareness can be quiet for the selected awareness area while route/nearby/mobile surfaces can still count active unified incidents outside that selected area. Static review also found a platform-wide count-reconciliation risk: several surfaces deliberately fall back to broader active/unified collections, so a stale or broader count could survive when area-scoped awareness is quiet.

No Liberty-specific county registry or activation logic was changed or identified as the root cause. The risk is shared platform logic that Liberty, Montgomery, and San Jacinto inherit.

## Required Answers

1. **Is the “2 active issues nearby” state explainable as correct behavior?**  
   **Yes, with observations.** It is correct if the two active issues are active unified incidents near the user/route but outside the current selected local awareness area. It is not proven correct if the same surface simultaneously claims the selected area has zero active records and two active issues from the same source/scope.

2. **If not, what source or surface is most likely stale?**  
   Most likely stale/broad source: **route/nearby/mobile active issue copy sourced from `getUnifiedIncidents()` / `getActiveUnifiedIncidents()` or route-watch alert rows**, because those sources are broader than the selected awareness-area lists and can include active route-relevant incidents not visible in the selected bottom/local panel. The primary suspect for a same-scope mismatch is the reconciler that takes the maximum across multiple counts rather than a single area-scoped active truth.

3. **Are cleared road hazards excluded from active counts?**  
   **Generally yes.** Cleared road hazards are excluded by `gridlyIsActiveHazardRecord()`, destination route hazard source filtering, active unified filtering, and road hazard lifecycle filtering. Recently cleared hazards are retained in `recentlyClearedRoadHazards` / unified cleared incidents for “Recently Cleared” visibility and suppression, not active status.

4. **Are cleared crossing reports excluded from active counts?**  
   **Generally yes.** Crossing active counts are expected to use `getIncidentLifecycleState(report) === "active"`; `getUnifiedIncidents()` maps rail incidents to `status: "active"` only when the latest report lifecycle is active and otherwise to `status: "cleared"`. However, broad raw `activeReports.length` is still used in some diagnostics/cache payloads and should not be treated as active-user-facing count without lifecycle filtering.

5. **Are route-panel counts reconciled with alert/awareness counts?**  
   **Partially.** They share active/unified incident primitives, but not one identical scoped count. Awareness uses selected-area active hazards/reports; route/mobile panels often use route-relevant hazards, alert-surface rows, user-facing road hazards, or active unified incidents. This is acceptable only when copy makes the scope difference explicit.

6. **Is Liberty safe to continue toward launch readiness?**  
   **Yes, with observations.** Liberty can continue as launch reference county, but V729 should tighten count-source labeling/reconciliation before treating this as final production confidence.

7. **Smallest recommended V729 fix, if needed:**  
   Add a read-only reconciliation assertion/helper or small UI-copy source audit that logs the exact source/scope behind each displayed count: selected-area awareness count, active unified count, route-relevant count, alert rows, marker rows, and bottom-panel count. If a visible copy says “nearby,” bind it to the same area filter or rename it to “on/near your route” when route-scoped.

## Source Ownership Inventory

| System / Surface | Static owner | Active truth observed | Audit note |
|---|---|---|---|
| Road hazard creation lifecycle | `activeHazards` local collection; post-submit normalization/registration; Supabase insert path | Active until expired, lifecycle-cleared, or suppressed by newer matching clear | Platform-wide, not Liberty-only |
| Road hazard clear lifecycle | `clearHazard()` inserts `report_type: "hazard_cleared"`, filters matching rows from `activeHazards`, refreshes alerts/community pulse/daily status | Clear row is a signal and should not be active | Good containment, but needs browser proof against route/mobile caches |
| Crossing blocked lifecycle | `activeReports` normalized crossing report rows | Active when `getIncidentLifecycleState()` resolves active | Platform-wide |
| Crossing clear lifecycle | Crossing report submission creates `cleared` event; latest report per crossing drives lifecycle | Latest cleared report maps unified rail incident to `status: "cleared"` | Good model; watch raw count uses |
| Active hazard collection | `activeHazards` | Raw collection can include rows requiring lifecycle filtering | User-facing surfaces should use lifecycle filters |
| Active crossing report collection | `activeReports` | Raw collection can include cleared/recent rows; active truth requires lifecycle filtering | Raw `activeReports.length` is not enough |
| Recently cleared collection | `recentlyClearedRoadHazards`; unified incidents with `status: "cleared"` inside recent window | Not active; used for “Recently Cleared” and clear suppression | Correct if not included in active filters |
| Alert panel count | `renderAlerts()` → `buildCommuteConsequenceIntelligence()` → `getActiveUnifiedIncidents()` plus recently cleared block | Active sections use active unified incidents; recently cleared block is separate | Broad route/intel scope |
| Awareness/header count | `refreshPortraitV2LocalizedIntelligence()` and awareness models | `getGridlyAwarenessLifecycleActiveReports()` + user-facing active road hazard incidents + selected area filter | Area-scoped |
| Route panel count | route/mobile route summary | Route hazards, alert-surface rows, or user-facing road hazard incidents | Not identical to selected awareness area |
| Marker/cluster input count | `getUnifiedIncidents()` and cluster/marker layers | Includes active rail, active road, recently cleared road incidents; marker display may show cleared separately | Active marker counts must filter status |
| Bottom panel count | `normalizeGridlyMobileAwarenessPanelSummary()` | Max of raw area counts and reconciler sources | Potential over-count risk if stale broader count wins |
| Nearby/area/county filter count | awareness area filter and route/nearest context | Selected area uses filters; nearest/route uses active unified incidents | Scope difference likely explains mismatch |
| Supabase rehydration handling | `loadSharedReports`/restore audits and local accepted report registration | Requires browser helper proof after clear/refresh | Existing helpers cover visibility/persistence |
| Local test reports handling | local accepted crossing/hazard registration helpers | Local rows are merged into active collections | Needs runtime test to prove clear removes from active surfaces |
| Post-submit refresh handling | `gridlyPostSubmitRefreshAudit`, refresh breakdown audit | Existing helper inventory available | No new helper added |
| Post-clear refresh handling | clear paths call render/refresh functions | Browser validation still required for route/mobile caches | V729 can add source-logged assertion if needed |

## Static Review Findings

### “Active issues nearby” source

The exact copy pattern appears in the awareness bottom/mobile summary path: active state copy is built as `"${activeIssueCount} active issue(s) nearby"`. That count is produced by `normalizeGridlyMobileAwarenessPanelSummary()`, where `activeIssueCount` starts with `hazardCount + reportCount + crossingReportCount` and then passes through `getGridlyReconciledAwarenessActiveIssueCount()`. The reconciler returns the maximum of area-scoped counts plus other visible-count sources. This can intentionally prevent undercounting, but it can also mask a stale broader source if one source remains nonzero after local area lists are empty.

### Cleared road hazards

Road hazards have multiple exclusion gates:

- `gridlyIsActiveHazardRecord()` returns false for expired, `hazard_cleared`, cleared/recently-cleared/inactive/historical/stale states, and matching latest cleared state.
- Destination route hazard source excludes expired and `hazard_cleared` rows.
- User-facing road hazard fallback filters through lifecycle filtering or `gridlyIsActiveHazardRecord()`.
- Clear handling removes same-location/same-type rows from `activeHazards` and clears latest alert render cache.
- Recently cleared road hazards are separately projected into unified incidents as `status: "cleared"`.

### Cleared crossing reports

Crossing reports are active only when `getIncidentLifecycleState(report) === "active"`. Unified rail incidents set `status: "active"` only for active lifecycle; otherwise they become cleared rail incidents. The main caveat is that raw `activeReports.length` appears in cache payloads, audits, and some snapshots, so any user-facing count must be checked for lifecycle filtering.

### Recently cleared in active counts

Recently cleared road hazards are intentionally retained for “Recently Cleared” visibility and trend/suppression logic. They should not enter `getActiveUnifiedIncidents()` because that helper filters unified incidents to `status === "active"`. Alert rendering separately renders a recently-cleared block from `getUnifiedIncidents().filter(status === "cleared")`.

### Surface reconciliation

- **Awareness/header:** selected-area active hazards/reports + lifecycle filters.
- **Bottom panel:** selected-area counts but reconciled with max across other visible-count sources.
- **Alerts:** active unified incidents and route/intelligence grouping; recently cleared is a separate visual section.
- **Route/mobile:** route hazards, alert rows, and active unified incidents.
- **Markers:** unified incidents; active-vs-cleared depends on status filtering at the consuming surface.

These are not a single active-incident truth today. They are compatible only if the UI copy distinguishes **local selected area**, **nearby**, and **route-relevant** scopes.

## Runtime Helper Inventory

| Helper | Found? | Audit value |
|---|---:|---|
| `window.gridlyActiveHazardCountReconciliationAudit?.()` | Yes | Best existing helper for active hazard/marker/alert count reconciliation. |
| `window.gridlyActiveIncidentAudit?.()` | Yes | Best existing helper for unified active incident candidate/source diagnosis. |
| `window.gridlyReportVisibilityPipelineAudit?.()` | Yes | Shows submitted report path through `activeHazards`, `activeReports`, alert input rows, marker rows. |
| `window.gridlyClearedHazardPersistenceAudit?.()` | Yes | Checks cleared hazard persistence/suppression behavior. |
| `window.gridlyCrossingAwarenessPromotionAudit?.()` | Yes | Checks crossing report awareness promotion. |
| `window.gridlyUiSmokeTest?.()` | Yes | General UI/render smoke helper. |
| `window.gridlyHealthCheck?.()` | Yes | General health helper. |
| `window.gridlyPostSubmitRefreshAudit?.()` | Yes | Post-submit refresh visibility helper. |
| `window.gridlyRefreshBreakdownAudit?.()` | Yes | Refresh timing/count source helper. |

**Gap documented only:** no single existing helper is clearly named as a Liberty production count source ledger that snapshots every displayed count with county/area/route scope and record IDs after submit-clear cycles. No helper was added in V728.

## Protected Systems Confirmation

Static review preserved the required protected state. No code changes were made to these systems in V728.

| System | Required state | V728 state |
|---|---:|---:|
| `historicalReadsEnabled` | `false` | unchanged |
| `historyUiEnabled` | `false` | unchanged |
| `DriveTexasPaused` | `true` | unchanged |
| `TransportationIntelligenceEnabled` | `false` | unchanged |
| `TransportationIntelligenceDisplay` | `false` | unchanged |
| `TransportationIntelligenceActivation` | `false` | unchanged |

## County Program Boundaries

- Liberty remains launch focus.
- Montgomery remains maintenance/support.
- San Jacinto remains maintenance/support.
- Jefferson remains deferred.
- No county registry operational status was changed.

## Browser Validation Steps for Denise

1. Open the app on the V728 branch with DevTools Console visible.
2. Set/confirm Liberty County context and selected local awareness area used in the original test.
3. Run baseline helpers and save output:
   - `window.gridlyHealthCheck?.()`
   - `window.gridlyUiSmokeTest?.()`
   - `window.gridlyActiveIncidentAudit?.()`
   - `window.gridlyActiveHazardCountReconciliationAudit?.()`
   - `window.gridlyReportVisibilityPipelineAudit?.()`
4. Create one road hazard in Liberty County.
5. Create one blocked crossing report in Liberty County.
6. Confirm all active surfaces agree or explain their scope:
   - map marker/cluster count
   - alert panel count
   - awareness/header copy
   - route panel count
   - bottom panel active issue line
7. Clear the same road hazard.
8. Clear the same blocked crossing.
9. Immediately run:
   - `window.gridlyClearedHazardPersistenceAudit?.()`
   - `window.gridlyCrossingAwarenessPromotionAudit?.()`
   - `window.gridlyActiveIncidentAudit?.()`
   - `window.gridlyActiveHazardCountReconciliationAudit?.()`
   - `window.gridlyReportVisibilityPipelineAudit?.()`
   - `window.gridlyPostSubmitRefreshAudit?.()`
   - `window.gridlyRefreshBreakdownAudit?.()`
10. Hard refresh, wait for Supabase rehydration, and rerun the same helpers.
11. If UI shows “No active local issues reported” plus “2 active issues nearby,” click/open the route/alerts/bottom surfaces and compare record IDs from helper output:
    - If IDs belong to active incidents outside selected local area, record as correct scoped behavior.
    - If IDs are the just-cleared road hazard/crossing, record as V729 blocker.
    - If IDs are absent from active helpers but still counted in UI, record the stale surface as route/bottom/alert cache.

## Merge Recommendation

Merge V728 as an audit-only evidence milestone. Do not treat it as final production sign-off until Denise completes the browser submit-clear-rehydrate validation above. If the mismatch reproduces with cleared record IDs, V729 should be a focused count/lifecycle defect fix before launch-readiness sign-off.
