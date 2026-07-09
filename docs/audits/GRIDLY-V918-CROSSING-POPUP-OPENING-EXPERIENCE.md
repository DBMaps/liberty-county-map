# GRIDLY V918 — Crossing Popup Opening Experience Audit

## Executive summary
V918 audits and stabilizes the railroad crossing popup opening path. The observed flash risk was traced to an explicit pre-open `map.closePopup()` call in the crossing marker interaction sequence. That call could remove the currently rendered popup shell before the selected crossing popup opened, creating a visible close/open flicker even when the selected marker and popup content were otherwise stable.

## Popup opening lifecycle
Crossing markers bind popup content during marker creation. A marker click or early touch/pointer tap starts a popup pan session, records the selected crossing, finalizes with one direct `marker.openPopup()` call, and then performs any needed safe-zone camera positioning without using `moveend` as the visible open trigger. V918 instruments this lifecycle with `gridlyCrossingPopupOpeningAuditState` and exposes the browser helper `window.gridlyCrossingPopupOpeningAudit?.()`.

## Marker lifecycle
`renderCrossings()` owns crossing marker creation, stores active handles in `crossingMarkers`, and renders those markers into `crossingLayer`. V918 does not change inventory selection, classification, PUBLIC_ROADWAY filtering, marker content, marker assets, popup content, or popup actions. The new audit records whether `renderCrossings()` runs while a popup opening session is still pending, because that would imply marker recreation during the open.

## Leaflet interaction sequence
Before V918, the opening sequence explicitly called `map.closePopup()` before any delayed/manual pan and before `marker.openPopup()`. Leaflet can already replace an existing popup when `marker.openPopup()` runs, so the explicit close was unnecessary. V918 removes that pre-close and keeps the existing manual pan/open sequencing otherwise intact.

## CSS transition review
The crossing popup audit checks the live popup element and content wrapper for computed CSS transition or animation values. The fix does not add popup styling or animation changes.

## Popup timing review
The V918 direct-open timing model is now: marker click calls `marker.openPopup()` once as the primary tap action. Manual safe-zone movement may still pan the map after the popup is opened, but `moveend` is recorded as positioning only and is not the routine visible open trigger. Visibility retry remains only as a fallback when a short post-open verification cannot find popup DOM.

## Z-index review
The audit captures marker z-index before opening and compares it after verified open. A change is reported as `zIndexPromotionDetected`. V918 does not intentionally promote crossing marker z-index during popup opening.

## DOM replacement review
The audit stores the starting marker element and compares it with the marker element after the popup is verified visible. A changed node is reported as `domReplacementDetected` and contributes to `markerRecreatedDuringOpen`.

## Marker recreation review
Marker recreation is considered detected if the marker DOM is replaced or if `renderCrossings()` runs during the pending popup opening session. V918 does not alter normal crossing render ownership; it only records this condition for browser validation.

## Render ownership
Crossing inventory markers remain owned by `renderCrossings()`, `crossingLayer`, and `crossingMarkers`. Unified incident rendering, Story Engine, Evidence Experience, Route Watch, hazard lifecycle, alert generation, and Supabase synchronization are not changed.

## Root cause
The likely flash root cause was the explicit pre-open popup close cycle. In delayed/manual-pan cases, the old sequence could close an existing popup immediately, leave the UI in a transient no-popup state, then open the selected crossing popup later. That transient replacement could be perceived as a flash or flicker.

## Fix implemented
V918 removes the explicit `map.closePopup()` from `openCrossingPopupFromMarkerInteraction()`. The selected marker still opens via `marker.openPopup()`, preserving Leaflet's normal popup replacement behavior without forcing a separate close-before-open phase. V918 also adds lightweight instrumentation and a browser audit helper.

## Final recommendation
Merge V918 as a polish-only correction. Validate in the browser by clicking a crossing marker and running `window.gridlyCrossingPopupOpeningAudit?.()`. Expected stable result: no marker recreation, no popup close-before-open, no repeated open cycle, no DOM replacement, no observed flash, and `protectedSystemsUnchanged: true`.

## Click trace diagnostics

V918 now includes tracing-only diagnostics for comparing the first and second click on the same crossing without changing popup behavior. Use `window.gridlyResetCrossingPopupClickTrace?.()` before a browser validation pass, click a crossing once, inspect `window.gridlyCrossingPopupClickTrace?.()`, click the same crossing again, and inspect the trace again.

The trace is capped to the most recent 25 lifecycle events and preserves event order. Each event includes `timestamp`, `eventType`, `crossingId`, `clickCountForCrossing`, `openPopupCallCount`, `popupOpenEventCount`, `popupCloseEventCount`, `openReason`, `duplicateOpenSuppressed`, `retryOpenSkippedBecauseAlreadyVisible`, `safeZoneRetryObserved`, `markerDomPresent`, `popupDomPresent`, and `flashObserved`.

Trace event types include `marker_click`, `popup_open_requested`, `popup_opened`, optional `safe_zone_positioning`, fallback-only `retry_skipped_already_visible` / `duplicate_open_suppressed`, `popup_closed`, and `second_click_same_crossing`. These diagnostics are intended to distinguish normal second-click behavior from an already-open reopen, a close/open toggle, safe-zone `moveend` retriggering, duplicate open calls, or flash-producing lifecycle churn.


## Direct-open follow-up

Crossing popup opening now reports `opensDirectlyOnClick`, `safeZoneMoveBeforeOpen`, `safeZonePositioningOnly`, and `retryUsedAsFallbackOnly`. A normal click should show `marker_click`, `popup_open_requested`, and `popup_opened` with `openPopupCallCount: 1`; safe-zone work, when needed, is recorded as post-open positioning rather than as the open trigger.

## V918 Root-Cause Diagnostic Pause

The prior V918 behavior change is not considered successful. Crossing popups have historically required two marker clicks before opening for affected users, and the visible popup flicker is still reported. V918 is therefore paused as a behavioral fix and now adds root-cause diagnostics only.

### First-click failure investigation

Use this manual workflow before applying another popup behavior change:

1. Run `window.gridlyResetCrossingPopupClickTrace?.()`.
2. Tap/click one crossing marker once.
3. Run `window.gridlyCrossingPopupRootCauseAudit?.()`, `window.gridlyCrossingPopupClickTrace?.()`, and `window.gridlyCrossingPopupTapPointAudit?.()`.
4. Tap/click the same crossing marker again.
5. Run the same helpers again and compare the first-click and second-click lifecycles.

The new root-cause helper returns the required first-click fields, including marker resolution, popup binding, open attempts, popup DOM creation, map/safe-zone movement, overlay interception, marker DOM readiness, marker handle stability, duplicate handle detection, and render-during-click evidence.

### Flicker investigation

The diagnostic keeps the earlier popup lifecycle counters but now classifies likely flicker causes as evidence rather than a completed fix. It distinguishes popup close-before-open, marker/layer recreation during open, CSS transition/animation evidence, and map movement before popup appearance.

### Hypotheses tested

The trace is designed to test whether the first click is consumed by Leaflet marker dispatch, map drag/touch handling, safe-zone movement, crossing marker render/repopulation, event propagation, an overlay at the tap point, map movement before popup creation, missing marker DOM, missing popup binding, duplicate marker handles, or stale `crossingMarkers` references.

### Evidence found

Runtime evidence must come from the browser helper output. The helper records `pointerdown`, `touchstart`, and `click` capture events plus app/Leaflet marker handler events, crossing ID resolution, stable marker IDs, popup-bound-before-open state, `marker.openPopup()` calls, popup DOM visibility after open attempts, map movement before popup appearance, marker recreation during the click, and the top DOM element at the last tap point.

### Confirmed root cause

Not yet confirmed in code. This update intentionally avoids another behavioral fix until the helper output explains why the first click does not open, why the second click opens, and why the flicker is visible.

### Recommended minimal fix

Use the `rootCause` and `recommendedFix` fields from `window.gridlyCrossingPopupRootCauseAudit?.()` after a first-click/second-click reproduction. If the helper reports overlay interception, the minimal fix should target pointer-events/stacking for that overlay. If it reports `marker.openPopup()` without popup DOM visibility, the minimal fix should preserve the first app click handler while preventing map movement/render/marker replacement until popup DOM is confirmed. Popup content, popup buttons, crossing inventory/classification/filtering, V917 marker visibility/size, and protected systems remain unchanged.
