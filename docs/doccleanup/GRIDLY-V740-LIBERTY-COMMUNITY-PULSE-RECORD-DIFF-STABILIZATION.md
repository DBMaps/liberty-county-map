# GRIDLY V740 — Liberty Community Pulse Record Diff Stabilization

## Final determination
The remaining V739 cache miss is safe to patch only when the record-level diff is a `raw`-only signature serialization change. V740 stabilizes that volatile/equivalent serialization layer while keeping lifecycle/status, type/category, report count, canonical location, coordinates, and active/cleared eligibility authoritative.

## Exact record-level diff finding
- `changedRecordIds`: Denise should read the exact physical-device id from `window.gridlyV739CommunityPulseSignatureDiffAudit?.().changedRecordIds`.
- `changedRecordFields`: the safe V740 classification applies only when the changed field is `raw` and no protected field (`lifecycle`, `type`, `reportCount`, `lat`, `lng`) changed.
- `changedRecordValuesBeforeAfter`: V739/V740 audit still exposes before/after values for the changed record.

## Changed record id
Use the Denise console validation block below to capture the exact `changedRecordIds[0]` from the physical device. V740 does not hide this id.

## Changed record field
`raw`, when the parsed authoritative record parts are otherwise identical.

## Before/after values
Before/after values remain visible under `changedRecordValuesBeforeAfter` in the V739 browser helper. V740 also keeps legacy colon-signature parsing so older evidence can still be compared.

## Field classification: authoritative or volatile/equivalent
- `raw` only: volatile/equivalent signature serialization.
- `lifecycle`, `type`, `reportCount`, `lat`, or `lng`: authoritative; do not normalize into a cache hit.

## Patch applied or patch withheld
Patch applied. Record signatures now serialize canonical record parts as JSON after normalizing null/undefined/string formatting. The diff parser supports both new JSON signatures and legacy colon-delimited signatures, preserving audit visibility.

## What did not change
- Community Pulse wording did not change.
- Report lifecycle did not change.
- Marker rendering did not change.
- Route Watch behavior did not change.
- Dispatch Board was not touched.
- County expansion was not resumed.
- DriveTexas and Transportation Intelligence remain inactive.
- Historical reads and history UI remain disabled.

## Protected-system confirmation
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Denise physical-device validation steps
1. Open the app on the physical device and perform one refresh to populate the shared model cache.
2. Without changing filters, reports, route watch, or location, perform a second warm refresh.
3. Run the console block in this report.
4. Confirm `cacheOutcome` is `hit` and `exactCacheMissReason` is `cache_hit_signature_match`.
5. Confirm `changedRecordIds` is empty on the unchanged warm refresh.
6. If a record diff remains, confirm whether fields are authoritative (`lifecycle`, `type`, `reportCount`, `lat`, `lng`) before withholding further normalization.

## Merge recommendation
Merge after Denise physical-device validation confirms unchanged warm refreshes produce Community Pulse cache hits and no authoritative record-level diff.

## Exact Denise console validation block
```js
(() => {
  const breakdown = window.gridlyRefreshBreakdownAudit?.();
  const diff = window.gridlyV739CommunityPulseSignatureDiffAudit?.();
  const stale = window.gridlyV737StaleFirstPaintAudit?.();
  const background = window.gridlyBackgroundLoopAudit?.();
  const perf = window.gridlyAuditPerformanceReview?.();
  const smoke = window.gridlyUiSmokeTest?.();
  const counts = window.gridlyActiveHazardCountReconciliationAudit?.();
  const routeIntel = window.gridlyRouteIntelligenceDebug?.();
  const routeWatch = window.gridlyRouteWatchDebug?.();
  return { breakdown, diff, stale, background, perf, smoke, counts, routeIntel, routeWatch };
})();
```
