# GRIDLY V738 — Liberty Community Pulse Reuse Regression Audit

## Final determination
Regression confirmed. The highest-confidence cause is the V734 Community Pulse shared-model signature treating freshness/update timestamp churn as content churn. That made unchanged authoritative Community Pulse input miss the shared-model cache and rebuild the expensive model.

## Regression confirmed? yes/no
Yes.

## Why V734 showed 0.8 ms and V737 showed 5193.4 ms
V734 measured the intended unchanged-input warm path, where the shared model signature matched and `refreshGridlyCommunityPulseSharedModel` returned the existing model. V737 physical-device evidence measured a path where equivalent incident content carried changed update/freshness timestamps, so the signature no longer matched and the full `buildGridlyCommunityPulseModel` path ran inside `refreshGridlyCommunityPulseSharedModel`.

## Exact cache miss reason
`cache_miss_authoritative_signature_changed` after timestamp-only field churn. First refresh is still expected to report `cache_miss_no_shared_model`; unchanged warm refresh should report `cache_hit_signature_match`.

## Exact volatile signature field if found
The volatile fields are `updated_at`, `updatedAt`, `lastUpdated`, `created_at`, `createdAt`, `submittedAt`, and `timestamp`. These fields are now reported by the V738 audit but excluded from the heavy shared-model signature because they are freshness metadata rather than authoritative Community Pulse content.

## What changed
- Added V738 cache hit/miss reason reporting to the Community Pulse shared-model refresh state.
- Removed volatile freshness/update timestamps from the V734 record signature used by Community Pulse reuse.
- Normalized coordinates to five decimal places so tiny serialization differences do not invalidate unchanged content.
- Exposed the latest V738 Community Pulse reuse audit through `window.gridlyRefreshBreakdownAudit?.()`.
- Added V738 evidence and validation coverage.

## What did not change
- No Community Pulse wording changed.
- No Awareness Brief redesign changed.
- No county framework changed.
- No Dispatch Board, DriveTexas, Transportation Intelligence, historical reads/UI, Route Watch behavior, report lifecycle, or marker rendering behavior changed.
- V729 active/cleared count reconciliation, V732 canonical location ownership, V734 shared-model reuse intent, V735 portrait localized intelligence optimization, V736 daily habit shared-model reuse, and V737 stale first paint instrumentation remain preserved.

## Protected-system confirmation
- `historicalReadsEnabled`: false
- `historyUiEnabled`: false
- `DriveTexasPaused`: true
- `TransportationIntelligenceEnabled`: false
- `TransportationIntelligenceDisplay`: false
- `TransportationIntelligenceActivation`: false

## Denise physical-device validation steps
1. Open Liberty on the same physical device/profile used for V737.
2. Trigger one refresh to populate the shared Community Pulse model.
3. Without changing county, awareness area, filter, route-watch state, lifecycle state, crossings, report count, or incident set, trigger a warm refresh.
4. Run `window.gridlyRefreshBreakdownAudit?.()`.
5. Confirm `v738CommunityPulseReuseAudit.cacheOutcome` is `hit` and `exactCacheMissReason` is `cache_hit_signature_match` on unchanged warm refresh.
6. Confirm `refreshGridlyCommunityPulseSharedModel` is below 1500 ms on unchanged warm refresh and total refresh is below 5000 ms.
7. Run the required helper block: `window.gridlyV737StaleFirstPaintAudit?.()`, `window.gridlyBackgroundLoopAudit?.()`, `window.gridlyAuditPerformanceReview?.()`, `window.gridlyUiSmokeTest?.()`, `window.gridlyActiveHazardCountReconciliationAudit?.()`, `window.gridlyRouteIntelligenceDebug?.()`, and `window.gridlyRouteWatchDebug?.()`.
8. Confirm stale first paint remains false unless new runtime evidence proves otherwise.

## Merge recommendation
Merge after Denise confirms physical-device warm-refresh cache hits and the target timings. The patch is narrow and limited to volatile signature normalization plus explicit cache miss reporting.
