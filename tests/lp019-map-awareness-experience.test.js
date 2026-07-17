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

console.log('LP019 map awareness experience static checks passed');
