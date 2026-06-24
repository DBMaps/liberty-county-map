# GRIDLY V735 — Liberty Portrait Localized Intelligence Performance Isolation

## Final determination
PATCHED FOR PHYSICAL-DEVICE VALIDATION. V735 adds deeper nested timing inside `refreshPortraitV2LocalizedIntelligence` and applies one small unchanged-input signature reuse guard to the active-condition hazard-count consistency model. Do not claim Liberty launch readiness until Denise confirms physical-device timing meets the target.

## Root cause found
The code-level audit found the only still-expensive nested work in the current portrait localized-intelligence path is active-condition count reconciliation that can scan active hazards, unified incidents, marker counts, and visible alert counts. That same model can be requested once while building the shared localized intelligence snapshot and again while syncing the location awareness card.

## Exact slow nested section
V735 isolates the suspected slow path with these timing keys in `portraitLocalizedIntelligenceBreakdown.sections`:

- `active_condition_intelligence.hazard_count_consistency_model`
- `active_condition_intelligence.location_card_count_model`
- `localized_intelligence_build.category_only_fallback`
- `awareness_narrative_story_assembly.evidence_ownership`
- `road_crossing_location_lookup.route_context`
- `dom_sync.location_awareness_panel`
- `dom_sync.community_pulse_copy`

The prior physical-device sample showed `refreshPortraitV2LocalizedIntelligence` at about 7464.6 ms. After V735, Denise should use these nested keys to confirm whether the time was concentrated in the active-condition intelligence model or in a downstream DOM/location-card sync.

## What changed
- Added V735 nested timing labels inside the portrait shared localized intelligence builder and location awareness card sync path.
- Added signature-based reuse for `buildGridlyAwarenessHazardCountConsistencyModel` when active hazards, active reports, crossings, latest alerts, selected area, rendered marker count, and route/watch context are unchanged.
- Added V735 validation coverage for the timing labels, signature reuse guard, protected systems, report, and evidence JSON.
- Added V735 evidence JSON for Denise's validation trail.

## What did not change
- User-facing wording was not intentionally changed.
- Dispatch Board was not modified.
- County expansion was not resumed.
- DriveTexas activation was not touched.
- Historical reads and historical UI were not touched.
- V734 Community Pulse shared model reuse remains in place.
- V734 `renderUnifiedIncidents` reuse remains in place.
- V732 canonical location ownership is preserved.
- V729 active/cleared count eligibility is preserved.

## Protected-system confirmation
Protected systems remain expected as:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Performance expectation
Expected improvement is reduced repeated active-condition count reconciliation during portrait refresh. Targets remain:

- Total refresh: less than 5000 ms
- `refreshPortraitV2LocalizedIntelligence`: less than 1500 ms
- Community Pulse: remains less than 1500 ms
- `renderUnifiedIncidents`: remains less than 500 ms

If physical-device timing still shows `refreshPortraitV2LocalizedIntelligence` above target, the newly added nested timing keys should identify the next exact helper without requiring broad behavior changes.

## Browser/physical-device validation steps for Denise
On a physical Liberty portrait device/session:

1. Load Liberty in portrait mode and wait for the initial map/refresh cycle to settle.
2. Trigger the same refresh path used for the V734 timing sample.
3. In the browser console, run:
   ```js
   window.gridlyRefreshBreakdownAudit?.()
   window.gridlyBackgroundLoopAudit?.()
   window.gridlyAuditPerformanceReview?.()
   window.gridlyUiSmokeTest?.()
   window.gridlyActiveHazardCountReconciliationAudit?.()
   window.gridlyRouteIntelligenceDebug?.()
   window.gridlyRouteWatchDebug?.()
   ```
4. In `window.gridlyRefreshBreakdownAudit?.()`, inspect `portraitLocalizedIntelligenceBreakdown.sections` for the V735 nested labels listed above.
5. Confirm whether `v735HazardCountModelReuseApplied` is `1` after unchanged refreshes.
6. Confirm protected systems remain paused/disabled.
7. Confirm no user-facing wording regression in top awareness, location awareness, alerts, and route/watch debug surfaces.
8. Do not mark Liberty launch-ready unless physical-device timing confirms all performance targets.

## Merge recommendation
Merge only after local validation passes and Denise's physical-device console timing confirms the V735 performance targets. If timing still exceeds target, keep the branch open and use the V735 nested section labels to patch the single remaining hot helper.
