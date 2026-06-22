const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

includes('const DISTANT_CROSSING_MIN_ZOOM = 14;', 'inactive distant crossing marker threshold remains zoom 14');
includes('const CROSSING_INFRASTRUCTURE_MIN_ZOOM = 14;', 'crossing infrastructure marker threshold remains zoom 14');
includes('key: "coldspring", label: "Coldspring", storageValue: "Coldspring", countyId: "san-jacinto-tx", lat: 30.5924, lng: -95.1294, radiusMiles: 6, startupZoom: 13', 'Coldspring awareness startup remains zoom 13');
includes('key: "shepherd", label: "Shepherd", storageValue: "Shepherd", countyId: "san-jacinto-tx", lat: 30.4974, lng: -94.9966, radiusMiles: 6, startupZoom: 13', 'Shepherd awareness startup remains zoom 13');
includes('key: "point-blank", label: "Point Blank", storageValue: "Point Blank", countyId: "san-jacinto-tx", lat: 30.7435, lng: -95.2138, radiusMiles: 6, startupZoom: 13', 'Point Blank awareness startup remains zoom 13');
includes('key: "oakhurst", label: "Oakhurst", storageValue: "Oakhurst", countyId: "san-jacinto-tx", lat: 30.7360, lng: -95.3135, radiusMiles: 6, startupZoom: 13', 'Oakhurst awareness startup remains zoom 13');
includes('if (!showInfrastructureMarkers) return false;', 'render path hides inactive crossing infrastructure below infrastructure zoom threshold');
includes('if (zoom < DISTANT_CROSSING_MIN_ZOOM) return false;', 'distant inactive crossing helper hides inactive crossings below zoom 14');
includes('expectedInactiveCrossingMarkersAtZoom13: 0', 'zoom audit documents zero inactive crossing markers at zoom 13 as expected');
includes('expectedInactiveCrossingMarkersAtZoom14: "visible when crossing inventory is loaded and markers are inside the map viewport"', 'zoom audit documents zoom 14 proof expectation');
includes('Treat 0 inactive San Jacinto crossing infrastructure markers at zoom 13 as expected policy behavior; prove infrastructure appears at zoom 14 instead of raising town startup zooms.', 'validation expectation is aligned to policy rather than changing startup zoom behavior');

console.log('sanJacintoCrossingVisibilityEvidenceV669.test.js passed');
