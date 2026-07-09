# GRIDLY V918 — Crossing Popup Opening Experience Audit

## Executive summary
V918 audits and stabilizes the railroad crossing popup opening path. The observed flash risk was traced to an explicit pre-open `map.closePopup()` call in the crossing marker interaction sequence. That call could remove the currently rendered popup shell before the selected crossing popup opened, creating a visible close/open flicker even when the selected marker and popup content were otherwise stable.

## Popup opening lifecycle
Crossing markers bind popup content during marker creation. A marker click or early touch/pointer tap starts a popup pan session, records the selected crossing, optionally moves the camera to a safe popup anchor, and finalizes with one `marker.openPopup()` call. V918 instruments this lifecycle with `gridlyCrossingPopupOpeningAuditState` and exposes the browser helper `window.gridlyCrossingPopupOpeningAudit?.()`.

## Marker lifecycle
`renderCrossings()` owns crossing marker creation, stores active handles in `crossingMarkers`, and renders those markers into `crossingLayer`. V918 does not change inventory selection, classification, PUBLIC_ROADWAY filtering, marker content, marker assets, popup content, or popup actions. The new audit records whether `renderCrossings()` runs while a popup opening session is still pending, because that would imply marker recreation during the open.

## Leaflet interaction sequence
Before V918, the opening sequence explicitly called `map.closePopup()` before any delayed/manual pan and before `marker.openPopup()`. Leaflet can already replace an existing popup when `marker.openPopup()` runs, so the explicit close was unnecessary. V918 removes that pre-close and keeps the existing manual pan/open sequencing otherwise intact.

## CSS transition review
The crossing popup audit checks the live popup element and content wrapper for computed CSS transition or animation values. The fix does not add popup styling or animation changes.

## Popup timing review
The existing timing model remains: no-pan interactions open on the next animation frame; manual pan cases open after `moveend` or the existing fallback timeout. V918's smallest correction is limited to avoiding the intermediate close state before the final open.

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

Trace event types include `marker_click`, `popup_open_requested`, `popup_opened`, `safe_zone_moveend`, `retry_skipped_already_visible`, `duplicate_open_suppressed`, `popup_closed`, and `second_click_same_crossing`. These diagnostics are intended to distinguish normal second-click behavior from an already-open reopen, a close/open toggle, safe-zone `moveend` retriggering, duplicate open calls, or flash-producing lifecycle churn.
