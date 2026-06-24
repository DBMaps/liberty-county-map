# GRIDLY V739 — Liberty Community Pulse Signature Diff Audit

## Final determination
V739 determines that the remaining unchanged-warm-refresh Community Pulse miss is caused by `routeWatchIdle` entering the V734 authoritative reuse signature even when Route Watch is not activated. In that inactive state, idle/standby bookkeeping does not change Community Pulse content and is volatile/equivalent rather than content-authoritative.

## Signature diff finding
The V739 browser helper now captures and compares the previous and current Community Pulse authoritative signatures field-by-field through `window.gridlyV739CommunityPulseSignatureDiffAudit?.()`.

Expected unchanged warm-refresh diff after the patch:

```json
{
  "changedTopLevelFields": [],
  "changedRecordIds": [],
  "changedRecordFields": {},
  "changedRecordValuesBeforeAfter": {},
  "changedRouteWatchFields": [],
  "changedCountyOwnershipFields": [],
  "changedAwarenessAreaFields": [],
  "changedLifecycleFields": {},
  "changedCoordinateFields": {},
  "changedReportCountFields": {},
  "changedFreshnessFields": []
}
```

The pre-patch physical-device miss is represented in the evidence artifact as:

```json
{
  "changedTopLevelFields": ["routeWatchIdle"],
  "changedRouteWatchFields": ["routeWatchIdle"]
}
```

No active hazard/report/crossing/latest-alert record IDs, lifecycle fields, coordinates, report counts, county ownership fields, awareness-area fields, or freshness fields were identified as the remaining equivalent warm-refresh difference.

## Exact changed field causing miss
`routeWatchIdle` was the single confirmed remaining field causing `cache_miss_authoritative_signature_changed` after the V738 timestamp exclusion.

## Whether changed field is authoritative or volatile/equivalent
`routeWatchIdle` is volatile/equivalent when `routeWatchActivated` is false. It is route-watch idle/standby state, not Community Pulse content. When Route Watch is inactive, changing this idle flag does not change the Community Pulse headline, subline, selected records, lifecycle counts, coordinates, report counts, county ownership, or awareness-area ownership.

When `routeWatchActivated` is true, V739 preserves the idle value in the signature because active Route Watch mode may affect awareness mode and surface suppression.

## Patch applied
V739 normalizes `routeWatchIdle` inside the V734 Community Pulse reuse signature so it can only be true when `routeWatchActivated` is true. This preserves active Route Watch behavior while stabilizing inactive warm-refresh standby noise.

V739 also adds field-level signature diff instrumentation and exposes:

```js
window.gridlyV739CommunityPulseSignatureDiffAudit?.()
```

The helper reports:

- `changedTopLevelFields`
- `changedRecordIds`
- `changedRecordFields`
- `changedRecordValuesBeforeAfter`
- `changedRouteWatchFields`
- `changedCountyOwnershipFields`
- `changedAwarenessAreaFields`
- `changedLifecycleFields`
- `changedCoordinateFields`
- `changedReportCountFields`
- `changedFreshnessFields`

## What did not change
V739 did not force cache hits, remove authoritative lifecycle/status/type/category/report-count inputs, hide real content changes, change wording, redesign Community Pulse, change Awareness Brief behavior, touch Dispatch Board, resume county expansion, activate DriveTexas, activate Transportation Intelligence, change Route Watch behavior, change report lifecycle, or change marker rendering.

V739 preserves the V729 active/cleared count reconciliation, V732 canonical location ownership, V734 Community Pulse reuse architecture, V735 portrait localized intelligence performance improvement, V736 shared-model reuse for daily habit status, V737 stale-first-paint audit, and V738 timestamp/coordinate reuse normalization.

## Protected-system confirmation
Protected systems remain unchanged:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`

## Denise physical-device validation steps
On a physical device, run two equivalent warm refreshes without changing reports, county, awareness area, or active Route Watch state. Then run this exact console block:

```js
await window.gridlyRefreshBreakdownAudit?.();
window.gridlyV739CommunityPulseSignatureDiffAudit?.();
window.gridlyV737StaleFirstPaintAudit?.();
window.gridlyBackgroundLoopAudit?.();
window.gridlyAuditPerformanceReview?.();
window.gridlyUiSmokeTest?.();
window.gridlyActiveHazardCountReconciliationAudit?.();
window.gridlyRouteIntelligenceDebug?.();
window.gridlyRouteWatchDebug?.();
```

Confirm:

- `cacheOutcome === "hit"`
- `exactCacheMissReason === "cache_hit_signature_match"`
- `refreshGridlyCommunityPulseSharedModel < 1500 ms`
- `refreshPortraitV2LocalizedIntelligence < 1500 ms`
- `renderUnifiedIncidents < 500 ms`
- `totalRefresh < 5000 ms`
- `changedTopLevelFields` is empty on unchanged warm refresh
- `changedRouteWatchFields` is empty on unchanged warm refresh

If a future miss occurs, use `window.gridlyV739CommunityPulseSignatureDiffAudit?.()` to identify the exact authoritative field before patching anything else.

## Merge recommendation
Merge recommended after Denise confirms one physical-device unchanged warm refresh returns a Community Pulse cache hit and an empty V739 signature diff. The patch is narrowly scoped to a single inactive Route Watch standby field and preserves all protected systems and content-authoritative signature inputs.
