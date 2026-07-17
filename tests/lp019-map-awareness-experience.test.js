const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const published = fs.readFileSync('js/gridlyAlertsPublishedAwareness.js', 'utf8');

assert(app.includes('function gridlyLp019BindAlertFocusHandlers'), 'LP019 delegated alert focus binder exists');
assert(app.includes('button, a, input, select, textarea'), 'interactive controls inside alert cards are ignored');
assert(app.includes('gridlyDriveTexasOfficialMarkers = new Map()'), 'DriveTexas official marker registry is localized and stable');
assert(app.includes('renderGridlyDriveTexasOfficialMarkers'), 'DriveTexas official marker renderer exists');
assert(app.includes('gridlyDriveTexasOfficialLayer = L.layerGroup().addTo(map)'), 'DriveTexas markers use a Leaflet layer group');
assert(app.includes('gridlyLp019ReadDriveTexasRecords'), 'DriveTexas renderer reads existing normalized provider records');
assert(app.includes('gridlyLp019OfficialPopupHtml'), 'official roadway popup builder exists');
assert(!/future_source|gridly_structured|rawPayload|providerCode/.test(app.match(/function gridlyLp019OfficialPopupHtml[\s\S]*?function renderGridlyDriveTexasOfficialMarkers/)?.[0] || ''), 'official popup function does not expose technical metadata');
assert(app.includes('window.gridlyLp019MapAwarenessExperienceAudit'), 'LP019 browser audit is exposed');
assert(app.includes('window.gridlyLp019AlertFocusDebug'), 'LP019 alert focus debug helper is exposed');
assert(app.includes('perRecordAwarenessLookupCount: 0'), 'LP019 renderer does not introduce per-record awareness lookup counter increments');
assert(published.includes('data-gridly-alert-lat'), 'published-awareness cards carry alert latitude when available');
assert(published.includes('window.__gridlyLatestAlertsForRender = Array.isArray(publishedRecords) ? publishedRecords : []'), 'published-awareness open path preserves source records for tap resolution');
assert(published.includes('gridlyLp019BindAlertFocusHandlers'), 'published-awareness open path binds alert focus handler');

assert(app.includes('function gridlyLp019IdentityCandidates'), 'LP019 resolves alert and marker IDs through shared real-record aliases');
['incidentId', 'reportId', 'alertId', 'sourceId', 'crossingId', 'providerRecordId', 'canonicalIncidentId'].forEach((alias) => {
  assert(app.includes(alias), `LP019 identity lookup includes ${alias}`);
});
assert(app.includes('markerMatchMethod = "bounded_coordinate"') || app.includes('markerMatchMethod: "bounded_coordinate"'), 'LP019 has a bounded coordinate fallback for same-condition marker matching');
assert(app.includes('coordinate_focus_completed_without_matching_marker'), 'LP019 coordinate-only fallback records a clear completion reason without fabricating a marker');
assert(app.includes('gridlyLp019WaitForLayoutSettle'), 'LP019 focus sequence waits for sheet/layout close before positioning');
assert(app.includes('mapRef.invalidateSize'), 'LP019 invalidates Leaflet size after closing alert surfaces');
assert(app.includes('gridlyLp019UsableViewportOffset'), 'LP019 derives usable portrait viewport offset from visible DOM surfaces');
assert(app.includes('function gridlyLp019UsableViewportVisibility'), 'LP019 evaluates usable viewport visibility separately from theoretical centering');
['mapContainerRect', 'usableViewportRect', 'targetContainerPoint', 'targetInsideUsableViewport', 'targetClearOfTopObstruction', 'targetClearOfBottomObstruction', 'horizontalVisibilityPass', 'verticalVisibilityPass', 'usableViewportVisibilityCompleted', 'visibilityFailureReason', 'popupStateVerified', 'markerVisibleAfterPopupAutoPan'].forEach((field) => {
  assert(app.includes(field), `LP019 focus debug reports ${field}`);
});
assert(app.includes('gridlyLp019ConditionFocusZoom'), 'LP019 uses a deterministic condition-view zoom helper');
assert(app.includes('Math.max(current'), 'LP019 condition zoom avoids zooming out when already closer');
assert(app.includes('finishAfterMove') && app.includes('finishAfterPanSettle'), 'LP019 waits for flyTo/setView and post-panBy settlement before completion');
assert(app.includes('latLngToContainerPoint') && app.includes('intendedViewportTargetPoint') && app.includes('finalViewportPixelDelta'), 'LP019 measures viewport-offset focus completion in container pixels');
assert(app.includes('viewportCenteringCompleted') && app.includes('viewportCompletionThresholdPx'), 'LP019 retains exact-center pixel threshold as diagnostic only');
assert(!/mapMovementCompleted = Boolean\([^)]*viewportCenteringCompleted/.test(app), 'LP019 movement completion is not gated by exact center-distance');
assert(/mapMovementCompleted = Boolean\([\s\S]*usableViewportVisibilityCompleted/.test(app), 'LP019 movement completion is gated by usable viewport visibility');
assert(/safeForMerge:[\s\S]*usableViewportVisibilityCompleted === true/.test(app), 'LP019 merge gate requires usable viewport visibility');
assert(!/safeForMerge:[\s\S]{0,900}finalViewportPixelDelta[\s\S]{0,120}<=/.test(app), 'LP019 merge gate does not require exact pixel delta');
assert(!/finalCenterDeltaMeters[\s\S]{0,120}<= 160/.test(app.match(/safeForMerge:[\s\S]*?reasons:/)?.[0] || ''), 'LP019 merge gate no longer fails offset focus on raw map-center meters');
assert(app.includes('popupRequested: Boolean(marker') && app.includes('if (marker && debug.mapMovementCompleted)'), 'LP019 requests popup only after matching marker resolution');
assert(app.includes('marker.openPopup()') && app.includes('marker.isPopupOpen'), 'LP019 verifies existing marker popup state after opening');
const focusBody = app.match(/function focusGridlyAlertIncident[\s\S]*?function focusAlertLocation/)?.[0] || '';
assert(focusBody.includes('coordinate_focus_completed_without_matching_marker') && !focusBody.includes('L.marker('), 'LP019 coordinate-only fallback completes without fabricating a marker');
assert(app.includes('duplicateAlertFocusBindings'), 'LP019 repeated Alerts opens remain audited for one delegated binding');
assert(app.includes('driveTexasPerRecordAwarenessLookupCount') && app.includes('=== 0'), 'LP016 zero per-record awareness lookup invariant remains in merge gate');
assert(app.includes('gridlyLp019ReadCrossingVisibilitySnapshot'), 'LP019 audits active crossing records against rendered markers');
assert(app.includes('crossingVisibilityBeforeOfficialRefresh') && app.includes('crossingVisibilityAfterOfficialRefresh'), 'LP019 captures crossing visibility around DriveTexas refresh');
assert(app.includes('crossingVisibilityBeforeFocus') && app.includes('crossingVisibilityAfterFocus'), 'LP019 captures crossing visibility around alert focus');
assert(app.includes('driveTexasLayerIsolated') && app.includes('crossingMarkerRegressionDetected'), 'LP019 merge gate audits DriveTexas isolation and crossing marker regressions');
assert(app.match(/gridlyDriveTexasOfficialLayer\.removeLayer\(marker\)/), 'DriveTexas refresh removes only official DriveTexas markers from its own layer');
assert(!/gridlyDriveTexasOfficialLayer[\s\S]{0,400}(crossingLayer\.clearLayers|crossingMarkers\.clear|unifiedIncidentLayer\.clearLayers)/.test(app), 'DriveTexas official layer lifecycle does not clear crossing, crossing registry, or unified incident layers');
assert(!/future_source|gridly_structured|rawPayload|providerCode/.test(app.match(/function gridlyLp019OfficialPopupHtml[\s\S]*?function renderGridlyDriveTexasOfficialMarkers/)?.[0] || ''), 'LP018 consumer-language official popup remains protected');
const popupBody = app.match(/function gridlyLp019OfficialPopupHtml[\s\S]*?function gridlyLp019PointAudit/)?.[0] || '';
assert(popupBody.includes('Official roadway condition') && popupBody.includes('Updated'), 'official popup contains consumer-safe title, roadway, source description, and freshness copy');
assert(!/community|verification|future_source|gridly_structured|classification|providerCode|rawPayload|JSON/i.test(popupBody.replace(/Official roadway condition/i, '')), 'official popup omits community controls and technical metadata');
['target_too_close_to_horizontal_edge', 'target_obscured_by_top_surface', 'target_obscured_by_bottom_surface', 'no_active_blocked_crossings', 'driveTexasLayerIsolated', 'driveTexasPerRecordAwarenessLookupCount'].forEach((needle) => {
  assert(app.includes(needle), `LP019 regression coverage includes ${needle}`);
});

console.log('LP019 map awareness experience static checks passed');
