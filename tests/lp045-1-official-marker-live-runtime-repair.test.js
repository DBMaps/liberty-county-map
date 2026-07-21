const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('function gridlyLp045OfficialMarkerIdentity'), 'shared official marker identity resolver exists');
assert(app.includes('return raw.startsWith("drivetexas:") ? raw : `drivetexas:${raw}`;'), 'resolver produces stable DriveTexas marker identities');
assert(app.includes('const id = String(gridlyLp045OfficialMarkerIdentity(record, `drivetexas-${index}`) || "");'), 'marker creation uses the shared official identity');
assert(app.includes('sourceRecord: record') && app.includes('record,') && app.includes('gridlyMarkerType: "drivetexas_official"'), 'created markers retain the source record for focus lookup');
assert(app.includes('function gridlyLp045EnsureOfficialMarkerLayerAttached'), 'official marker layer attachment guard exists');
assert(app.includes('gridlyDriveTexasOfficialLayer.addTo(targetMap)'), 'official layer is reattached to the active Leaflet map when needed');
assert(app.includes('function gridlyLp045EnsureOfficialMarkersCurrent'), 'official marker render ordering helper exists');
assert(app.includes('gridlyLp045EnsureOfficialMarkersCurrent("before_alert_focus")'), 'alert focus refreshes official markers before lookup/zoom');
assert(/function renderGridlyDriveTexasOfficialMarkers[\s\S]*gridlyLp045EnsureOfficialMarkerLayerAttached\(\)/.test(app), 'normal marker refresh also ensures the official layer is attached');
assert(/function renderGridlyDriveTexasOfficialMarkers[\s\S]*gridlyDriveTexasOfficialMarkers\.forEach[\s\S]*desired\.forEach/.test(app), 'normal refresh removes stale official markers before adding desired markers without clearing accepted ones afterward');
assert(app.includes('window.gridlyLp0451OfficialMarkerRuntimeTraceAudit'), 'LP045.1 passive runtime trace audit is exported');
assert(app.includes('investigationOnly: true'), 'runtime trace audit is investigation-only');
assert(!/gridly-official-roadway-marker[\s\S]{0,400}>i<|>i<\/b>/.test(app), 'blue information-circle markup remains absent');
assert(!/className:\s*["'](?:leaflet-)?(?:blue|info)|L\.circleMarker\(/.test(app.match(/function renderGridlyDriveTexasOfficialMarkers[\s\S]*?function findGridlyAlertMarker/)?.[0] || ''), 'official marker renderer still avoids blue info icons and circle markers');
assert(app.includes('if (crossingMarkers instanceof Map)') && app.includes('for (const [key, marker] of crossingMarkers.entries())'), 'community/crossing marker focus path remains present');

console.log('LP045.1 official marker live runtime repair checks passed');
