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
assert(geoids.has('48407'), 'standard Texas source includes San Jacinto County GEOID');

includes('GRIDLY_STANDARD_TEXAS_COUNTY_BOUNDARY_SOURCE_PATH = "assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson"', 'runtime uses the standard Texas county boundary asset');
includes('GRIDLY_STANDARD_TEXAS_COUNTY_BOUNDARY_PAYLOAD_SCOPE = "standard_texas_counties_static_geojson"', 'audit payload scope is standard Texas county static GeoJSON');
includes('GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID = Object.freeze({ "liberty-tx": "48291", "montgomery-tx": "48339", "san-jacinto-tx": "48407" })', 'active county GEOID mappings exist for Liberty, Montgomery, and San Jacinto foundation');
includes('findGridlyCountyBoundaryOverlayFeatureForCounty(features, countyId)', 'runtime joins supported counties from the statewide payload');
includes('normalizeGridlyCountyBoundaryOverlayName', 'runtime keeps normalized county-name fallback matching');
includes('usesStandardTexasBoundarySource: true', 'audit reports standard Texas source usage');
includes('usesStatewidePayload: true', 'audit reports statewide payload usage');
includes('GRIDLY_ACTIVE_COUNTY_BOUNDARY_PAYLOAD_SCOPE = "county_specific_runtime_geojson"', 'runtime defines county-specific active boundary payload scope');
includes('GRIDLY_COUNTY_BOUNDARY_OVERLAY_MIN_ACTIVE_COORDINATE_COUNT = 250', 'runtime defines an active county geometry quality floor');
includes('gridlyCountyBoundaryOverlaySourceMetadataById[countyId] = { sourceType: "county_specific_active"', 'active county outlines use county-specific geometry when available');
includes('boundaryGeometryQuality:', 'audit exposes boundaryGeometryQuality');
includes('activeCountyCoordinateCount: activeCountyQuality.coordinateCount', 'audit exposes activeCountyCoordinateCount');
includes('activeCountyGeometryTooCoarse: activeCountyQuality.tooCoarse', 'audit exposes activeCountyGeometryTooCoarse');
includes('activeCountyGeometryQualityPass: activeCountyQuality.pass', 'audit exposes activeCountyGeometryQualityPass');
includes('sourceAssetRecommendedForProduction,', 'audit exposes sourceAssetRecommendedForProduction');
includes('texasCountyFeatureCount: statewideCountyIds.length', 'audit reports detected Texas county feature count');
includes('activeCountyGeoid,', 'audit reports the active county GEOID');
includes('weight: active ? 1.5 : passiveCountyWeight', 'active/passive boundary weights still differ');
includes('dashArray: active ? "" : "3 12"', 'active/passive dash styling still differs');
includes('interactive: false', 'boundary polygons remain non-interactive');
includes('pointerEventsSafe: pointerEvents === "none" && activeStyle.interactive === false', 'audit verifies marker click safety');
includes('passiveCountyOpacity: passiveStyle.opacity', 'audit reports visually suppressed passive opacity');
includes('safeForCountyBoundaryVisualRefinement:', 'audit reports visual refinement safe state');
includes('safeForCountyBoundaryOverlay: Boolean(supportedCountyIds.length === 3 && statewideCountyIds.length === 254', 'audit safe state requires supported V637B counties and full Texas payload');

console.log('v637dStandardTexasCountyBoundaryOverlay.test.js passed');
