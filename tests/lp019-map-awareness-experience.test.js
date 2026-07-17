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
assert(app.includes('gridlyLp019ConditionFocusZoom'), 'LP019 uses a deterministic condition-view zoom helper');
assert(app.includes('Math.max(current'), 'LP019 condition zoom avoids zooming out when already closer');
assert(app.includes('finishAfterMove') && app.includes('finalCenterDeltaMeters'), 'LP019 records map completion via move events or already-near target fallback');
assert(app.includes('popupRequested: Boolean(marker') && app.includes('if (marker && debug.mapMovementCompleted)'), 'LP019 requests popup only after matching marker resolution');
assert(app.includes('duplicateAlertFocusBindings'), 'LP019 repeated Alerts opens remain audited for one delegated binding');
assert(app.includes('driveTexasPerRecordAwarenessLookupCount') && app.includes('=== 0'), 'LP016 zero per-record awareness lookup invariant remains in merge gate');
assert(!/future_source|gridly_structured|rawPayload|providerCode/.test(app.match(/function gridlyLp019OfficialPopupHtml[\s\S]*?function renderGridlyDriveTexasOfficialMarkers/)?.[0] || ''), 'LP018 consumer-language official popup remains protected');

console.log('LP019 map awareness experience static checks passed');
