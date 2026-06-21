const assert = require('assert');
const fs = require('fs');

const boundary = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'utf8'));
const evidence = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/validation/san-jacinto-authoritative-boundary-extraction-v653.json', 'utf8'));
const source = fs.readFileSync('js/app.js', 'utf8');

const feature = boundary.features[0];
const props = feature.properties;

assert.strictEqual(props.STATEFP, '48', 'San Jacinto STATEFP is explicit');
assert.strictEqual(props.COUNTYFP, '407', 'San Jacinto COUNTYFP is explicit');
assert.strictEqual(props.GEOID, '48407', 'San Jacinto GEOID is explicit');
assert.strictEqual(props.NAMELSAD, 'San Jacinto County', 'San Jacinto county name is explicit');
assert.strictEqual(evidence.sourceDataset, 'tl_2025_us_county', 'authoritative extraction metadata identifies TIGER/Line 2025 county source');
assert.strictEqual(evidence.GEOID, '48407', 'authoritative extraction targets San Jacinto GEOID 48407');
assert.strictEqual(evidence.checks.sourceAssetRecommendedForProduction, true, 'authoritative extraction is production-recommended for boundary overlay');

assert.ok(source.includes('properties?.STATEFP === "48" && activeCountyGeoJson?.features?.[0]?.properties?.COUNTYFP === "407"'), 'audit accepts active TIGER county properties when sourceDataset is absent from GeoJSON properties');
assert.ok(source.includes('activeBoundaryAuthoritativeSanJacinto ? "tl_2025_us_county"'), 'audit publishes tl_2025_us_county provenance for accepted active San Jacinto boundary');
assert.ok(source.includes('passed_authoritative_tl_2025_us_county_geoid_48407'), 'audit reports authoritative pass determination');
assert.ok(source.includes('validationOnly: true'), 'San Jacinto remains validation-only');
assert.ok(source.includes('productionEnabled: false'), 'San Jacinto remains production-disabled');
assert.ok(source.includes('productionActivationBlocked: true'), 'San Jacinto remains activation-blocked');
assert.ok(source.includes('productionReauthorizationRequired: true'), 'San Jacinto still requires reauthorization');

console.log('sanJacintoBoundaryCredibilityResolutionV652.test.js passed');
