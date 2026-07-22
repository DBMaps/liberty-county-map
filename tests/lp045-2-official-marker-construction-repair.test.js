const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const renderer = app.match(/function renderGridlyDriveTexasOfficialMarkers[\s\S]*?function findGridlyAlertMarker/)?.[0] || '';
const iconBuilder = app.match(/function gridlyBuildOfficialRoadwayProductionMarkerIcon[\s\S]*?function renderGridlyDriveTexasOfficialMarkers/)?.[0] || '';
const focus = app.match(/function focusGridlyAlertIncident[\s\S]*?function focusAlertLocation/)?.[0] || '';

assert(app.includes('function gridlyLp045OfficialMarkerCoords'), 'LP045.2 official coordinate adapter exists');
assert(app.includes('record?.sourceCoordinates?.latitude ?? record?.sourceCoordinates?.lat'), 'DriveTexas latitude/lat sourceCoordinates shapes are accepted');
assert(app.includes('record?.sourceCoordinates?.longitude ?? record?.sourceCoordinates?.lng ?? record?.sourceCoordinates?.lon'), 'DriveTexas longitude/lng/lon sourceCoordinates shapes are accepted');
assert(app.includes('if (/construct|maintenance|work zone|lane/.test(category)) return "txdot_construction";'), 'Construction maps to an existing Gridly TxDOT construction marker type');
assert(app.includes('txdot_construction: "construction-zone.png"'), 'TxDOT construction marker type resolves to an existing production marker asset');
assert(iconBuilder.includes('getGridlyProductionMarkerAsset(productionMarkerCategory)'), 'official icon builder uses production marker asset resolver');
assert(iconBuilder.includes('L.divIcon({'), 'official icon builder creates a Leaflet divIcon');
assert(renderer.includes('trace.leafletMarkerConstructorInvoked = true') && renderer.includes('marker = L.marker([coords.lat, coords.lng]'), 'official renderer traces and invokes the Leaflet marker constructor');
assert(renderer.includes('trace.leafletMarkerCreated = Boolean(marker)'), 'official renderer records marker creation');
assert(renderer.includes('gridlyDriveTexasOfficialMarkers.set(String(key), marker)'), 'official marker registry insertion uses a string key');
assert(renderer.includes('trace.markerRegistryInsertSucceeded = gridlyDriveTexasOfficialMarkers.get(String(key)) === marker'), 'official renderer traces registry insertion success');
assert(renderer.includes('marker.addTo(gridlyDriveTexasOfficialLayer)') && renderer.includes('trace.markerLayerInsertSucceeded'), 'official renderer adds marker to attached official layer and traces success');
assert(renderer.indexOf('marker.addTo(gridlyDriveTexasOfficialLayer)') < renderer.indexOf('trace.popupBuilderInvoked = true'), 'popup binding occurs after marker creation, registry insertion, and layer insertion');
assert(renderer.includes('catch (error)') && renderer.includes('marker.bindPopup(gridlyLp0393ConsumerDriveTexasPopupHtml(record)'), 'popup binding failure falls back without blocking marker creation');
assert(focus.includes('const marker = coords ? findGridlyAlertMarker(coords, markerOptions) : null;') && focus.includes('mapRef.flyTo([coords.lat, coords.lng]'), 'alert focus continues to zoom by coordinate even when marker lookup fails');
assert(app.includes('window.gridlyLp0452OfficialMarkerConstructionAudit'), 'LP045.2 passive construction audit is exported');
assert(app.includes('productionAssetFound') && app.includes('caughtErrorStack') && app.includes('leafletMarkerConstructorInvoked'), 'LP045.2 audit exposes construction stages and caught exceptions');
assert(!/gridly-official-roadway-marker[\s\S]{0,400}>i<|>i<\/b>/.test(app), 'blue information-circle markup remains absent');
assert(!/className:\s*["'](?:leaflet-)?(?:blue|info)|L\.circleMarker\(/.test(renderer), 'official marker renderer does not restore blue info icons, generic pins, or circle markers');
assert(app.includes('function renderCrossings('), 'crossing marker renderer remains present');
assert(app.includes('function renderUnifiedIncidentMarkers('), 'community marker renderer remains present');
assert(fs.existsSync('tests/lp039-2-drivetexas-authority-source-integration.test.js'), 'LP039 authority tests remain unchanged in place');

console.log('LP045.2 official marker construction repair checks passed');

assert(app.includes('function gridlySanitizeOfficialConsumerProse'), 'narrow official consumer prose sanitizer exists');
assert(/replace\(\/&lt;\\s\*br/.test(app) && /replace\(\/<\\s\*br/.test(app), 'official prose sanitizer normalizes escaped and literal break tags');
assert(app.includes('const desc = sanitizeText(presentation?.combinedDescription || gridlyNormalizeOfficialConsumerLanguage'), 'official DriveTexas popup description uses sanitized consumer prose');
assert(app.includes('sourceLocationDescription: gridlyNormalizeOfficialConsumerLanguage') && app.includes('normalizedDescription: gridlyNormalizeOfficialConsumerLanguage'), 'official alert presentation description fields are sanitized without mutating source records');
assert(app.includes('Official Source · DriveTexas'), 'official popup still includes DriveTexas source attribution');
assert(!/gridlySanitizeOfficialConsumerProse[\s\S]{0,1200}setInterval|gridlySanitizeOfficialConsumerProse[\s\S]{0,1200}fetch/.test(app), 'sanitizer remains presentation-only and does not fetch or poll');
