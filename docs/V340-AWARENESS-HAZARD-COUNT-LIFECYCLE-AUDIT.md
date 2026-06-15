# V340 — Awareness Hazard Count Lifecycle Audit

## Screenshot observation

Production validation observed the bottom Location Awareness card showing:

- `Dayton Awareness`
- `No active local issues reported`
- `28 crossings watched • 1 active hazard`

This is logically inconsistent for users after the final active road hazard has been cleared unless the count intentionally includes a recently cleared incident or a different state owner is still exposing a hazard.

## Audit-only scope

V340 does not change production behavior. It adds `window.gridlyAwarenessHazardLifecycleAudit?.()` and documentation only. It does not change counts, lifecycle behavior, alerts, markers, awareness UI, route watch, Supabase, DriveTexas, or official-source architecture.

## Source ownership

### Bottom `X active hazard(s)` count

The bottom awareness count is owned by `normalizeGridlyMobileAwarenessPanelSummary()`. That function computes `hazardCount` through `getGridlyAwarenessDistinctActiveHazardCount()` when available.

`getGridlyAwarenessDistinctActiveHazardCount()` delegates to `buildGridlyAwarenessHazardCountConsistencyModel()`, introduced by V322.6. The model first groups lifecycle-active `activeHazards` by stable identity, then can prefer non-zero fallback sources in this order:

1. unified active road-hazard incidents,
2. rendered marker source count,
3. visible alert grouped incident count.

Therefore the bottom count is not simply `activeHazards.length`; it is a distinct active road-hazard incident count with fallback ownership from unified incidents, rendered markers, and alerts.

### `No active local issues reported` headline/status

The quiet status is owned by the mobile awareness summary path. `normalizeGridlyMobileAwarenessPanelSummary()` sets quiet status when `hazardCount + reportCount === 0`, but the upstream summary may come from cached `communityAwarenessSummary` state in `getGridlyMobileAwarenessPanelSummary()`.

Separately, top awareness headline ownership is in `buildGridlyLightweightActiveAwareness()`, which chooses a headline from deduped, user-meaningful, lifecycle-eligible active awareness details. It can return no top awareness detail when active records are absent, expired, lifecycle-suppressed, or not meaningful for the top-awareness headline.

## Lifecycle ownership

Active hazard lifecycle filtering is owned by `getGridlyAwarenessLifecycleActiveHazards()`, which calls `gridlyFilterRoadHazardsByLatestLifecycle()` and then keeps only records whose lightweight lifecycle state is `active`.

Recently cleared road hazards are owned separately by `recentlyClearedRoadHazards` and recent-clear visibility helpers. The intended model is that recently cleared hazards remain available as cleared/history context, not active hazard context.

## Mismatch analysis

The screenshot state can occur because the quiet headline/status and the hazard-count line can be populated by different ownership paths or snapshots:

- the quiet text can reflect an awareness summary with `activeIssueCount === 0`, while
- the hazard count can be recomputed through the distinct active hazard count model and can still see one non-zero fallback from unified incidents, marker render state, or visible alert state.

The most likely explanation is count ownership mismatch or stale derived state after clear. It is not expected as a final settled user-facing state after the final active road hazard clears. Recently-cleared records are not intentionally counted as active by the lifecycle filter; if they appear in the count, it is because a fallback/cache path still exposes them as unified, marker, or alert state.

## Audit contract

Run this in the browser console:

```js
window.gridlyAwarenessHazardLifecycleAudit?.()
```

The helper returns:

```js
{
  available: true,
  policyVersion: "V340",
  productionBehaviorChanged: false,
  headlineSource: "...",
  hazardCountSource: "...",
  headlineActiveCount,
  awarenessHazardCount,
  activeIncidentCount,
  activeHazardCount,
  recentlyClearedCount,
  visibleAlertCount,
  visibleMarkerCount,
  mismatchDetected,
  mismatchReason,
  recentlyClearedIncludedInCount,
  ownershipFindings,
  recommendations,
  notes
}
```

## Required findings

- **Why can the screenshot state occur?** Because quiet headline/status and active hazard count can come from different snapshots or owners.
- **Is it expected behavior?** It is explainable by current ownership but not desirable as a final settled state.
- **Is it stale state?** Possibly; the audit reports marker, alert, and panel-summary evidence to identify stale fallback state.
- **Is it lifecycle filtering?** The active lifecycle filter excludes cleared/recently-cleared records from active hazards.
- **Is it count ownership mismatch?** Yes, the architecture permits a mismatch between summary quiet state and hazard-count fallback sources.
- **Is it recently-cleared behavior?** Not intentionally. Recently-cleared records are separate; inclusion implies stale fallback exposure or cache mismatch.

## Recommended next action

Use V340 output on a reproduction immediately after clearing the final road hazard. If `activeHazardCount` is `0` but `awarenessHazardCount` is `1`, inspect `hazardCountSource`, `visibleAlertCount`, and `visibleMarkerCount` to identify the stale owner before any behavior-changing milestone.
