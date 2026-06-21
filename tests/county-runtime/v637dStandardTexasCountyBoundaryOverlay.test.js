const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const assetPath = 'assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson';
const geojson = JSON.parse(fs.readFileSync(assetPath, 'utf8'));
const features = geojson.features || [];
const geoids = new Set(features.map((feature) => String(feature.properties?.geoid || '')));
const texasFeatures = features.filter((feature) => String(feature.properties?.statefp || '') === '48');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

assert.strictEqual(features.length, 254, 'standard Texas source contains 254 county features');
assert.strictEqual(texasFeatures.length, 254, 'all standard source features are Texas counties');
assert.strictEqual(geoids.size, 254, 'standard Texas source has 254 unique GEOIDs');
assert(geoids.has('48291'), 'standard Texas source includes Liberty County GEOID');
assert(geoids.has('48339'), 'standard Texas source includes Montgomery County GEOID');

includes('GRIDLY_STANDARD_TEXAS_COUNTY_BOUNDARY_SOURCE_PATH = "assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson"', 'runtime uses the standard Texas county boundary asset');
includes('GRIDLY_STANDARD_TEXAS_COUNTY_BOUNDARY_PAYLOAD_SCOPE = "standard_texas_counties_static_geojson"', 'audit payload scope is standard Texas county static GeoJSON');
includes('GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID = Object.freeze({ "liberty-tx": "48291", "montgomery-tx": "48339" })', 'active county GEOID mappings exist for Liberty and Montgomery');
includes('findGridlyCountyBoundaryOverlayFeatureForCounty(features, countyId)', 'runtime joins supported counties from the statewide payload');
includes('normalizeGridlyCountyBoundaryOverlayName', 'runtime keeps normalized county-name fallback matching');
includes('usesStandardTexasBoundarySource: true', 'audit reports standard Texas source usage');
includes('usesStatewidePayload: true', 'audit reports statewide payload usage');
includes('texasCountyFeatureCount: statewideCountyIds.length', 'audit reports detected Texas county feature count');
includes('activeCountyGeoid,', 'audit reports the active county GEOID');
includes('weight: active ? 3.25 : 1.5', 'active/passive boundary weights still differ');
includes('dashArray: active ? "" : "8 10"', 'active/passive dash styling still differs');
includes('interactive: false', 'boundary polygons remain non-interactive');
includes('pointerEventsSafe: pointerEvents === "none" && activeStyle.interactive === false', 'audit verifies marker click safety');
includes('safeForCountyBoundaryOverlay: Boolean(supportedCountyIds.length === 2 && statewideCountyIds.length === 254', 'audit safe state requires supported V637B counties and full Texas payload');

console.log('v637dStandardTexasCountyBoundaryOverlay.test.js passed');
