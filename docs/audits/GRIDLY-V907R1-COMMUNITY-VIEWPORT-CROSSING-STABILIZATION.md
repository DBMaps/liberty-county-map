# GRIDLY V907R1 — Community Viewport & Crossing Runtime Stabilization

## Mission
Stabilize the post-V907 community expansion baseline before any additional community or county coverage expansion.

V907R1 is a repair-only branch. It does not add communities, expand counties, or redesign awareness.

## Observed Failures
- `window.gridlyHierarchicalAwarenessSelectionAudit?.()` reported `mapViewportCommunityScaled: false` for selected communities because the map remained at county-level zoom.
- The inherited V904/V905/V906/V907 community coverage audits could report `safeForBeta: false` even when the configured community data was otherwise valid.
- A Dayton / Liberty crossing smoke check showed a suspicious stale or drifting runtime sample from Fort Bend while the active crossing source diagnostics still reported Liberty.

## Root Cause
The selected community map-focus path could fit crossing bounds after runtime crossing load instead of applying the community's configured startup zoom. For broad crossing clusters this left the map at a county-like zoom even though the selected community and focus coordinates were correct.

The crossing audit state also kept sample fields across active-county transitions, so a county switch could show a current county source alongside a stale first runtime sample from the previous county until the new runtime inventory finished loading.

## Viewport Repair Summary
- Specific community awareness anchors now apply their configured `startupZoom` directly when the home-town awareness context is applied after crossing load.
- Countywide and fallback awareness anchors continue to use county-level bounds or county startup zoom.
- Refresh/restore behavior continues through the same awareness context path, so restored communities also receive town-level startup zoom.

## Crossing Runtime / Audit Repair Summary
- Active-county changes now reset crossing runtime audit sample and count fields before loading the next county inventory.
- Crossing feature normalization is pinned to the requested county for the in-flight load, avoiding source metadata drift if county context changes during async loading.
- Runtime crossing samples now include `countyId` so audit consistency checks can validate county ownership directly.
- The production crossing provider path and crossing visibility policy are preserved.

## Protected Systems Confirmation
This stabilization does not intentionally modify reporting, alert generation, hazard lifecycle, awareness filtering semantics, Route Watch, search behavior, weather provider, community intelligence scoring, Supabase synchronization, directional intelligence, desktop gate, or landscape gate.

## Audit Helper
Run:

```js
window.gridlyCommunityViewportCrossingStabilizationAudit?.()
```

Expected key results:

- `available: true`
- `version: "V907R1"`
- `safeForBeta: true` when V904/V905/V906/V907 compatibility audits are true and crossing smoke is county-consistent
- `mapViewportCommunityScaled: true`
- `crossingSmoke.countyConsistent: true`
- `protectedSystemsUnchanged: true`

## Testing Checklist
1. Hard refresh the app.
2. Select Fort Bend County → Sugar Land.
3. Confirm the map focuses to Sugar Land at town-level zoom.
4. Run `window.gridlyHierarchicalAwarenessSelectionAudit?.()` and confirm `safeForBeta`, `mapViewportCommunityScaled`, `mapFocusMatchesSelectedCommunity`, and `settingsSummaryMatchesCommunity` are true.
5. Run `window.gridlyCommunityCoverageWave3Audit?.()`, `window.gridlyCommunityCoverageWave2Audit?.()`, and `window.gridlyCommunityCoverageExpansionAudit?.()` and confirm all are safe for beta.
6. Run `window.gridlySetAwarenessAreaForTest?.("Dayton")`, then `window.gridlyCrossingRenderAudit?.()` and confirm Liberty county/source consistency with no Fort Bend runtime sample drift.
7. Run `window.gridlyCommunityViewportCrossingStabilizationAudit?.()` and confirm V907R1 safe-for-beta status.

## Merge Recommendation Placeholder
Merge recommendation: _Pending browser validation evidence for the V907R1 checklist._
