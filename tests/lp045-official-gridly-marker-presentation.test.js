const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

assert(app.includes('function gridlyBuildOfficialRoadwayProductionMarkerIcon'), 'official markers use a focused Gridly presentation extension');
assert(app.includes('getGridlyProductionMarkerAsset(productionMarkerCategory)'), 'official markers reuse Gridly production marker assets');
assert(app.includes('gridlyBuildVisualPriorityMetadata({'), 'official markers reuse shared marker hierarchy metadata');
assert(app.includes('data-gridly-marker-source-kind="official"'), 'official marker presentation identifies official source kind without a separate icon family');
assert(app.includes('Official roadway condition · Official Source · DriveTexas'), 'official popup identifies DriveTexas as the official source');
assert(app.includes('gridlyApplySelectedVisualDominanceToMarker(marker, true)') && app.includes('setTimeout(() => gridlyApplySelectedVisualDominanceToMarker(marker, false), 1400)'), 'alert focus applies a naturally expiring marker highlight');
assert(css.includes('gridlyOfficialMarkerFocusPulse'), 'official marker focus pulse styling exists');
assert(!/gridly-official-roadway-marker[\s\S]{0,400}>i<|>i<\/b>/.test(app), 'official marker rendering does not restore blue information-circle markup');
assert(!/className:\s*["'](?:leaflet-)?(?:blue|info)|L\.circleMarker\(/.test(app.match(/function renderGridlyDriveTexasOfficialMarkers[\s\S]*?function findGridlyAlertMarker/)?.[0] || ''), 'official marker renderer does not use blue info icons, generic circle markers, or a separate provider marker family');

console.log('LP045 official Gridly marker presentation checks passed');
