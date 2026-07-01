# GRIDLY V737 — Liberty Stale First Paint and Refresh Budget Audit

## Final determination

V737 adds targeted runtime instrumentation first. Static review did **not** confirm stale first paint as the root cause of the remaining refresh-budget overage. The new helper `window.gridlyV737StaleFirstPaintAudit?.()` records first rendered text, ownership source, authoritative replacement, replacement trigger, and replacement timing during the portrait localized-intelligence refresh cycle.

## Stale first paint present? (yes/no)

**No static confirmation.** Runtime evidence is required. If stale content is rendered first and later replaced by authoritative content in the same refresh cycle, the audit helper reports `staleFirstPaintDetected: true` and records `lastRefreshBudgetImpactMs`.

## Initial ownership source

- Awareness Brief: `refreshPortraitV2LocalizedIntelligence` using `buildGridlyPortraitSharedLocalizedIntelligenceSnapshot`.
- Community Pulse: `refreshGridlyCommunityPulseSharedModel`, preserving the V734 signature-gated shared model path.
- Location Awareness: `refreshGridlyPortraitLocationAwarenessPanel`, consuming the shared summary/model.
- Localized intelligence: `buildGridlyPortraitSharedLocalizedIntelligenceSnapshot`, preserving the V735 portrait reuse path.

## Authoritative ownership source

Authoritative ownership is the current active county, selected awareness area, and active-state evidence ownership when present. The audit records active county, awareness area, selected source, active counts, and whether authoritative evidence ownership was applied.

## Replacement trigger

A replacement is recorded when a first-paint surface later receives different text in the same V737 audit cycle. If the first paint was non-authoritative and the replacement is authoritative, the cycle is classified as stale first paint.

## Replacement timing

Replacement timing is measured in milliseconds from the V737 cycle start and exposed in `window.gridlyV737StaleFirstPaintAudit?.().replacements[].replacementTimingMs`.

## Refresh-budget impact

Static review did not prove stale first paint contributes materially to the current ~6486 ms refresh. Runtime contribution is reported as `lastRefreshBudgetImpactMs` only when stale first paint is observed.

## Root cause

Unconfirmed. Existing reuse protections remain intact. The audit is designed to distinguish a valid cached first paint from stale cached text replaced after canonical ownership reconciliation.

## What changed

- Added V737 first-paint instrumentation for Awareness Brief, Community Pulse, Location Awareness, and localized intelligence.
- Added ownership transition instrumentation for localized-intelligence refresh start and canonical incident ownership.
- Added V737 audit output to `gridlyRefreshBreakdownAudit`.
- Added evidence and validation artifacts.

## What did not change

- No wording redesign.
- No awareness model redesign.
- No county architecture changes.
- No Dispatch Board work.
- No DriveTexas activation.
- No Transportation Intelligence activation.
- No historical reads/UI.
- No Route Watch behavior changes.
- No report lifecycle changes.

## Protected-system confirmation

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Denise validation steps

1. Open the Liberty mobile/portrait experience on the physical device.
2. Trigger a fresh refresh/reopen path that previously showed `US 90 Westbound` before switching to `Flooding on TX 146`.
3. Run the console block below.
4. Compare `firstPaints.awareness-brief`, `firstPaints.community-pulse`, `firstPaints.location-awareness`, and `firstPaints.localized-intelligence` against any replacement entries.
5. If `staleFirstPaintDetected` is true, use `lastRefreshBudgetImpactMs` and `replacements` to decide whether a behavior patch is justified.

```js
window.gridlyRefreshBreakdownAudit?.()
window.gridlyV737StaleFirstPaintAudit?.()
window.gridlyBackgroundLoopAudit?.()
window.gridlyAuditPerformanceReview?.()
window.gridlyUiSmokeTest?.()
window.gridlyActiveHazardCountReconciliationAudit?.()
window.gridlyRouteIntelligenceDebug?.()
window.gridlyRouteWatchDebug?.()
```

## Merge recommendation

Merge V737 as an instrumentation-only audit. Do not patch rendering behavior until Denise runtime evidence confirms stale first paint and shows material replacement timing.
