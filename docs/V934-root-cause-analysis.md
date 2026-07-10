# V934 Root Cause Analysis — Mobile Command Card Delay

## Scope

This is an analysis-only milestone. It does not add instrumentation and does not change runtime behavior.

## Executive diagnosis

The most probable root cause is an uncached awareness-summary rebuild that is reached through the route-context visibility probe during the portrait post-submit refresh.

The slow path is not the report write, and it is not normal DOM work in `getGridlyMobileCommandCardVisibilityState()`. During crossing-report submission, `refreshReportHazardViews()` synchronously calls `refreshPortraitV2LocalizedIntelligence()`. That refresh builds or reuses a portrait awareness model, then calls `refreshGridlyPortraitLocationAwarenessPanel()`. The panel refresh already has a scoped `summary` / `sharedSummary`, but when it asks for route context, `getGridlyPortraitLocationAwarenessRouteContext()` calls `getGridlyMobileCommandCardVisibilityState()` without passing that summary. If the route/destination branch is inactive, the visibility helper calls `shouldShowGridlyMobileAwarenessPanel()` with no summary. That forces `getGridlyMobileAwarenessPanelSummary()` to decide whether the cached summary is current; if it is absent or invalid for the selected awareness area, it synchronously rebuilds the community awareness intelligence summary.

That explains the V930–V933 pattern: each audit wrapped the next narrower synchronous caller, so the unpassed-summary rebuild was charged first to portrait localized intelligence, then route context, then mobile command card visibility, even though the ordinary visibility checks and DOM reads are small.

## Relevant synchronous path

Crossing-report submission reaches the refresh pipeline through `loadSharedReports("post_submit_refresh")`, which normalizes live rows, updates active report state, renders incidents, and then calls `refreshReportHazardViews()` inside the report awareness refresh stage.

`refreshReportHazardViews()` performs a synchronous refresh chain:

1. `refreshGridlyCommunityPulseSharedModel()` in portrait/mobile mode.
2. `refreshPortraitV2LocalizedIntelligence()`.
3. `renderUnifiedIncidents()`.
4. `scheduleRenderCrossings("state-change")`.

Inside the portrait refresh:

1. `refreshPortraitV2LocalizedIntelligence()` collects DOM refs and active report/hazard counts.
2. It obtains `sourcePulseModel`, sometimes by calling `refreshGridlyCommunityPulseSharedModel()` if the shared signature is not current.
3. It builds or reuses the portrait presentation model.
4. It calls `refreshGridlyPortraitLocationAwarenessPanel({ ...textModel, communityAwarenessSummary, pulseModel })`.
5. The panel refresh computes `sharedSummary` and `summary`, then calls `getGridlyPortraitLocationAwarenessRouteContext()`.
6. Route context calls `getGridlyMobileCommandCardVisibilityState()` without a summary.
7. Visibility state calls `shouldShowGridlyMobileAwarenessPanel(summary)` only when there is no active destination/route ownership.
8. With `summary === null`, `shouldShowGridlyMobileAwarenessPanel()` calls `getGridlyMobileAwarenessPanelSummary()`.
9. `getGridlyMobileAwarenessPanelSummary()` may call `buildGridlyCommunityAwarenessIntelligenceSummary()` synchronously when no valid/current cached summary is available.

## Why V930–V933 pointed at the wrong leaf

The audits measure inclusive wall-clock time around nested calls. The current code has a narrow function (`getGridlyMobileCommandCardVisibilityState()`) acting as the entry point to an occasionally broad model rebuild (`getGridlyMobileAwarenessPanelSummary()` → `buildGridlyCommunityAwarenessIntelligenceSummary()`). Because the call is synchronous, the parent wrappers naturally attribute the elapsed time to the currently executing leaf call.

V933 showed the normal command-card visibility logic is about 1 ms because, in the common/warm path, it receives or finds a reusable summary and does only a small number of state reads, class reads, and DOM queries. The crossing-report post-submit path is different: the report refresh has just invalidated active report state, and the route-context call does not pass the summary that the panel refresh already computed. That creates a cold or mismatched-summary path from the visibility check.

## Event-loop and refresh-chain findings

No evidence in the inspected path indicates that `getGridlyMobileCommandCardVisibilityState()` intentionally awaits a promise, schedules a `requestAnimationFrame`, or waits for a timer. Its body is synchronous.

There are `requestAnimationFrame` and `setTimeout` chains elsewhere in the post-submit and rendering pipeline, including deferred local surface refreshes, post-submit paint completion, popup positioning, and repeated desktop renders. Those can add user-visible churn, but they do not explain why a synchronous wrapper around `getGridlyMobileCommandCardVisibilityState()` measures a single long inclusive duration. The better explanation is that the no-summary visibility path sometimes performs a synchronous awareness-summary rebuild.

## Smallest safest recommended fix

Do not add more timing audits. Reuse the already computed awareness summary.

Recommended change:

1. Add an optional `summary` / `communityAwarenessSummary` parameter to `getGridlyPortraitLocationAwarenessRouteContext()`.
2. In `refreshGridlyPortraitLocationAwarenessPanel()`, pass the local `summary` or `sharedSummary` into the route-context call.
3. In `getGridlyPortraitLocationAwarenessRouteContext()`, pass that summary into `getGridlyMobileCommandCardVisibilityState(summary)`.

This keeps behavior the same while preventing the route-context visibility probe from rebuilding the awareness summary that the caller already owns. It also matches the existing safer pattern in `syncMobileDestinationCommandCard()`, which explicitly computes `awarenessSummary` first and passes it into `getGridlyMobileCommandCardVisibilityState(awarenessSummary)`.

## Expected result

The post-submit portrait refresh should stop charging multi-second wall time to the command-card visibility state. The visibility probe should remain a lightweight ownership decision, and any expensive awareness-summary construction should occur once in the caller that already owns the portrait/community-pulse model for the refresh cycle.
