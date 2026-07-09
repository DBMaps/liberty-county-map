# GRIDLY V917 — Crossing Visibility Audit

## Executive summary

V917 is an audit-first review of production crossing visibility. The configured regional policy does **not** define a high-zoom maximum visibility cutoff for certified public roadway crossings. The only explicit configured threshold that hides individual crossing infrastructure markers is the low-zoom county-view suppression below zoom 12.

However, screenshot-observed behavior shows a different problem: crossing markers can be visible at a lower zoom and then disappear after zooming in to the point where street names become readable. That screenshot-observed disappearance is not explained by configured policy alone, so V917 now distinguishes configured visibility from live rendered-marker presence.

The updated browser helper compares policy intent with actual Leaflet/DOM marker counts at the current zoom. It records short audit history so the helper can be run once at a visible lower zoom and again at the higher disappearing zoom.

## Current visibility behavior

### Configured visibility policy

Crossing infrastructure markers are owned by the production crossing runtime. `renderCrossings()` reads the active county crossing inventory, applies the regional crossing visibility policy, filters to viewport/representative candidates, clears `crossingLayer`, then creates Leaflet `L.marker` instances with production `divIcon` crossing marker HTML.

The regional policy is versioned as `V829 regional-crossing-visibility` and defines these thresholds:

| Zoom range | Stage | Configured marker behavior |
| --- | --- | --- |
| Inventory empty | `empty-inventory` | No markers. |
| `< 12` | `county-view` | Hide individual crossing markers; preserve inventory in awareness surfaces. |
| `12–13.99` | `medium-zoom` | Show up to 80 representative/cluster-lead crossings near the awareness anchor. |
| `14–14.99` | `neighborhood-zoom` | Show visible crossings in the viewport, capped at 160 nearest crossings if needed. |
| `15+` | `street-zoom` / `very-close-zoom` | Render every crossing in the visible map extent. |

### Actual rendered visibility

The V917 helper now checks live rendered state in addition to policy:

- `renderPolicyAllowsCurrentZoom` reports whether policy says markers should be allowed.
- `expectedNearbyCrossingCount` estimates the current in-area / in-viewport public roadway crossings that should be eligible to render.
- `crossingLayerMarkerCount` reports Leaflet crossing-layer marker presence.
- `crossingMarkerDomCount` reports production crossing marker DOM presence.
- `renderedCrossingMarkerCount` reports the highest observed marker count across layer, DOM, and marker-map handles.
- `visibleAtCurrentZoom` reports whether current live marker evidence indicates crossings are visible.
- `liveRenderMatchesPolicy` reports whether policy intent and live marker evidence agree.

### Screenshot-observed behavior

Screenshots show markers visible at a lower zoom and absent after zooming in where street names become readable. Under the configured policy, that should not be an intentional high-zoom threshold. V917 therefore treats the screenshot-observed disappearance as a live render mismatch until proven otherwise.

## Zoom-level analysis

- Configured first appearance: zoom **12** (`medium-zoom`).
- Configured broader viewport-limited rendering: zoom **14** (`neighborhood-zoom`).
- Configured street/high-zoom rendering: zoom **15+** (`street-zoom` / `very-close-zoom`).
- Configured high-zoom maximum: **none** (`maximumVisibleZoom: null`).
- Screenshot-observed disappearance after street labels appear is **not** explained by configured policy.
- The helper must be run at both the visible zoom and disappeared zoom to determine whether live rendering drops to zero while policy still allows markers.

## Marker lifecycle

1. Map initialization creates `crossingLayer` as a Leaflet layer group.
2. `zoomend` and `moveend` schedule `renderCrossings()` unless a crossing popup interaction is active.
3. `renderCrossings()` obtains active county inventory and current map bounds.
4. The visibility policy decides whether markers are allowed, capped, representative, or viewport-only.
5. Existing crossing markers are cleared.
6. Smart crossing cluster state can hide subordinate markers and badge the lead marker.
7. New production crossing markers are added to `crossingLayer` and tracked in `crossingMarkers`.
8. The V917 audit samples `crossingLayer`, marker DOM, marker handles, current bounds, and policy to detect live mismatches.

## Clustering behavior

Crossing clustering is not a Leaflet MarkerClusterGroup in this runtime path. It is a smart incident clustering pass inside `renderCrossings()` via `buildSmartIncidentClusters()`. That pass can hide duplicate/subordinate crossing IDs and place a count badge on the lead crossing marker.

V917 does not change clustering. If a high-zoom disappearance is seen, clustering should be checked only to verify that all visible crossings are not being treated as hidden subordinate IDs.

## Decluttering behavior

Decluttering is policy-driven:

- Low zoom: full suppression below zoom 12.
- Medium zoom: representative cap of 80 markers.
- Neighborhood zoom: viewport cap of 160 markers.
- Street/high zoom: no count cap, but viewport filtering remains active.

This means a marker may disappear after zoom/pan if it falls outside the current bounds. It does **not** explain all in-viewport crossings disappearing at high zoom while policy still allows markers.

## Layer ownership

`crossingLayer` owns crossing infrastructure and active/recently cleared rail crossing visuals. `unifiedIncidentLayer` can still own general incident/hazard markers, but duplicate blocked-crossing marker rendering is suppressed when crossing ownership already exists.

The helper flags `possibleLayerOwnershipIssue` when policy expects markers but `crossingLayer` is unavailable.

## Render ownership

`renderCrossings()` owns crossing marker creation, popup binding, marker click handling, production PNG assignment, route-impact styling, and marker lifecycle cleanup. V917 adds only audit diagnostics and documentation; it does not redesign render ownership.

The helper flags `possibleLifecycleRefreshIssue` when policy expects markers in the current area but no layer/DOM/marker-map evidence remains.

## High-zoom behavior

At zoom 15 and above, the configured policy says to render every crossing in the visible map extent. At zoom 17 and above, the stage is `very-close-zoom` but behavior remains viewport-all. Therefore high-zoom disappearance is not intentional according to current policy.

If `renderPolicyAllowsCurrentZoom` is true, `expectedNearbyCrossingCount` is greater than zero, and `renderedCrossingMarkerCount` is zero, then the live audit should report `liveRenderMatchesPolicy: false` and identify a likely cause.

## Low-zoom behavior

Below zoom 12, individual crossing markers are intentionally hidden to keep county-scale views readable and avoid implying no crossings exist. This is the single isolated configured visibility threshold documented by the audit.

## Live render mismatch diagnosis

The V917 helper distinguishes likely causes:

- `policy_threshold`: policy itself hides markers at the sampled zoom.
- `viewport_filtering`: policy allows markers, but the current viewport/bounds produce zero expected nearby public roadway crossings.
- `render_lifecycle_refresh`: policy expects nearby markers, `crossingLayer` exists, but no rendered marker evidence remains.
- `layer_ownership`: policy expects markers, but `crossingLayer` is missing.
- `visual_stacking_or_dom_visibility`: Leaflet layer markers exist, but production crossing marker DOM is missing or hidden.
- `not_reproduced_by_current_audit_sample`: current audit call does not reproduce the screenshot-observed disappearance.

## Manual two-zoom audit instructions

Run the helper twice in the same browser session:

```js
// 1. At a lower zoom where crossing markers are visible:
window.gridlyCrossingVisibilityAudit?.()

// 2. Zoom in until street names are readable and markers disappear, then run again:
window.gridlyCrossingVisibilityAudit?.()
```

Compare:

- `currentZoom`
- `renderPolicyAllowsCurrentZoom`
- `expectedNearbyCrossingCount`
- `renderedCrossingMarkerCount`
- `crossingMarkerDomCount`
- `crossingLayerMarkerCount`
- `liveRenderMatchesPolicy`
- `markersDisappearObserved`
- `likelyDisappearanceCause`

## Certified public roadway scope

The crossing inventory is filtered through reportability/eligibility checks before rendering and selection. Public roadway crossings are the intended certified runtime scope; non-public, non-highway, closed, or grade-separated crossings are excluded by eligibility logic. The helper reports observed classifications for the active inventory and whether the observed set is only `PUBLIC_ROADWAY`.

## County coverage

The visibility policy is global across active county runtime inventories. However, actual disappearance must be confirmed per county because each active county can have different inventory volume, bounds, selected awareness anchor, and viewport state.

## Risks

- A high-zoom disappearance could be caused by render-signature short-circuiting rather than policy.
- CSS stacking or base-label panes could visually cover or de-emphasize markers without removing Leaflet layers.
- Viewport bounds can legitimately remove out-of-view markers after pan/zoom.
- Smart clustering may hide subordinate crossing IDs when active reports cluster.
- A single audit call may not reproduce a disappearance that requires comparing lower and higher zoom states.
- Changing thresholds without browser confirmation could regress regional readability and protected crossing runtime behavior.

## Recommended fix

No behavior fix is recommended in V917. The only obvious isolated configured threshold is the intentional low-zoom `mediumZoomMin: 12` boundary. If browser testing proves markers are present in `crossingLayer` but visually hidden after road labels appear, the next milestone should inspect marker pane/z-index/CSS stacking against road-label panes. If `crossingLayer` is empty at high zoom while inventory is present and bounds contain crossings, inspect render-signature and viewport-filter diagnostics before changing thresholds.

## Browser helper

Run:

```js
window.gridlyCrossingVisibilityAudit?.()
```

Expected configured-policy headline result:

```js
{
  available: true,
  version: "V917",
  minimumVisibleZoom: 12,
  maximumVisibleZoom: null,
  renderPolicyAllowsCurrentZoom: true,
  renderedCrossingMarkerCount: 0, // example mismatch value when screenshot disappearance is reproduced
  liveRenderMatchesPolicy: false,
  markersDisappearObserved: true,
  likelyDisappearanceCause: "render_lifecycle_refresh" // or viewport/layer/visual-stacking depending on live evidence
}
```


## Street-zoom repopulation safeguard

A follow-up V917 behavior fix now preserves certified public roadway crossings at the street-name and very-close zoom stages when the configured render policy allows markers. If the initial render cycle leaves both `crossingMarkers` and `crossingLayer` empty even though policy-scoped visible `PUBLIC_ROADWAY` and reportable crossings are present in the viewport, `renderCrossings()` immediately repopulates from that same policy-scoped visible crossing list.

This safeguard is intentionally limited to street-name/very-close `viewport-all` policy stages, so lower-zoom decluttering remains unchanged. The repopulation list still requires `isGridlyReportableCrossing(crossing)`, `isGridlyPublicRoadwayCrossing(crossing)`, and active-county matching, so private, industrial, rail-yard, temporary-access, grade-separated, closed, or otherwise non-reportable crossings stay excluded.

The live helper now exposes additional render diagnostics:

- `candidateCrossingCount`
- `skippedCandidateCount`
- `skippedCandidateReasons`
- `streetZoomRepopulationAttempted`
- `streetZoomRepopulationSucceeded`

Expected street-name zoom result after the safeguard is that policy-allowed nearby public roadway crossings have `renderedCrossingMarkerCount: 1`, `crossingLayerMarkerCount: 1`, `liveRenderMatchesPolicy: true`, `possibleLifecycleRefreshIssue: false`, and `streetZoomRepopulationSucceeded: true` when the fallback path was needed.

## Final recommendation

Do **not** mark a behavior fix merge-ready from V917 alone. Merge the audit extension only if the live helper output can explain the screenshot-observed disappearance as policy threshold, viewport filtering, render lifecycle, layer ownership, or visual stacking. Keep production crossing runtime, community awareness, Story Engine, Evidence Experience, Route Watch, hazard lifecycle, alert generation, and Supabase synchronization unchanged until the live diagnosis is reviewed.
