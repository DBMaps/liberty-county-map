const assert = require('assert');
const fs = require('fs');

const boundary = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'utf8'));
const evidence = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/validation/san-jacinto-boundary-credibility-resolution-v652.json', 'utf8'));
const source = fs.readFileSync('js/app.js', 'utf8');

const feature = boundary.features[0];
const props = feature.properties;

assert.strictEqual(props.STATEFP, '48', 'San Jacinto STATEFP is explicit');
assert.strictEqual(props.COUNTYFP, '407', 'San Jacinto COUNTYFP is explicit');
assert.strictEqual(props.GEOID, '48407', 'San Jacinto GEOID is explicit');
assert.strictEqual(props.NAMELSAD, 'San Jacinto County', 'San Jacinto county name is explicit');
assert.strictEqual(props.source_asset_recommended_for_production, false, 'unknown-provenance boundary is not production-recommended');
assert.strictEqual(props.boundaryCredibilityDetermination, 'fail_unknown_provenance', 'boundary credibility remains failed pending authoritative provenance');

assert.strictEqual(evidence.finalDetermination, 'BOUNDARY CREDIBILITY NOT RESOLVED', 'V652 preserves unresolved boundary credibility');
assert.strictEqual(evidence.authorizationImpact, 'Not Eligible For Reauthorization Review', 'V652 blocks reauthorization review');
assert.strictEqual(evidence.provenanceValidation.classification, 'FAIL', 'provenance validation fails without authoritative source lineage');
assert.strictEqual(evidence.geometryValidation.classification, 'PASS', 'geometry plausibility passes independently from provenance');
assert.deepStrictEqual(evidence.geometryValidation.boundingBox, [-95.311289, 30.28588, -94.826068, 30.910794], 'boundary bbox remains plausible San Jacinto geography');
assert.strictEqual(evidence.boundaryReplacement.performed, false, 'V652 does not fabricate or replace without an authoritative source');
assert.strictEqual(evidence.auditIntegration.visualCorrectnessPass, false, 'visual correctness remains blocked');
assert.strictEqual(evidence.auditIntegration.sourceAssetRecommendedForProduction, false, 'production recommendation remains blocked');
assert.strictEqual(evidence.auditIntegration.boundaryCredibilityDetermination, 'fail', 'audit integration records failure');

assert.ok(source.includes('validationOnly: true'), 'San Jacinto remains validation-only');
assert.ok(source.includes('productionEnabled: false'), 'San Jacinto remains production-disabled');
assert.ok(source.includes('productionActivationBlocked: true'), 'San Jacinto remains activation-blocked');
assert.ok(source.includes('productionReauthorizationRequired: true'), 'San Jacinto still requires reauthorization');

console.log('sanJacintoBoundaryCredibilityResolutionV652.test.js passed');
