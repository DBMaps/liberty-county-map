#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const index = readFileSync('index.html', 'utf8');
const v646Doc = readFileSync('GRIDLY-SAN-JACINTO-CONTROLLED-ACTIVATION-IMPLEMENTATION-V646.md', 'utf8');
const boundary = JSON.parse(readFileSync('assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'utf8'));

function countCoordinates(value) {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && value.slice(0, 2).every((item) => Number.isFinite(Number(item)))) return 1;
  return value.reduce((total, item) => total + countCoordinates(item), 0);
}

const coordinateCount = boundary.features.reduce((total, feature) => total + countCoordinates(feature.geometry?.coordinates), 0);
const featureProperties = boundary.features[0]?.properties || {};

assert.equal(boundary.type, 'FeatureCollection', 'San Jacinto boundary evidence must remain preserved as a FeatureCollection');
assert.equal(featureProperties.geoid, '48407', 'San Jacinto boundary evidence must carry GEOID 48407');
assert.equal(featureProperties.countyId, 'san-jacinto-tx', 'San Jacinto boundary evidence must remain county-owned');
assert.match(app, /"san-jacinto-tx": Object\.freeze\([\s\S]*stage: GRIDLY_COUNTY_STAGE_RUNTIME_ONBOARDED,[\s\S]*operational: false,[\s\S]*productionEnabled: false,[\s\S]*selectable: false,[\s\S]*productionActivationBlocked: true/, 'San Jacinto must be runtime-onboarded, non-operational, production-disabled, non-selectable, and activation-blocked');
assert.match(app, /defaultAwarenessAreas: \[\]/, 'San Jacinto must not publish active default awareness areas');
assert.match(app, /runtimeSourceAvailability: Object\.freeze\(\{ boundary: "identified", roads: "inventory-only", crossings: "inventory-only", awarenessAreas: "candidates-only" \}\)/, 'San Jacinto assets must remain inventory/staged only');
assert.match(app, /activationHold: Object\.freeze\(\{ milestone: "V646\.4", complete: false, activationBlocked: true, browserValidationIncomplete: true \}\)/, 'San Jacinto V646.4 activation hold must be documented in runtime registry metadata');
assert.doesNotMatch(index, /<option[^>]+value="san-jacinto-tx"/, 'San Jacinto must not be present in production-facing onboarding county selector markup');
assert.doesNotMatch(app, /"san-jacinto-tx": \[GRIDLY_SAN_JACINTO_COUNTY_WIDE_HOME_TOWN/, 'San Jacinto must not have production-facing home-area selector options');
assert.match(app, /if \(status\.known && \(status\.operational !== true \|\| status\.productionEnabled !== true \|\| status\.selectable !== true\)\) option\.remove\(\);/, 'Runtime selector rendering must remove known disabled counties');
assert.match(app, /gridlyNormalizeCountyId\("not-real"\) === GRIDLY_DEFAULT_COUNTY_ID/, 'Unknown counties must continue to fail closed to the Liberty default normalization path');
assert.match(app, /gridlyValidateCountyContainment\(\{ county_id: "montgomery-tx" \}, GRIDLY_DEFAULT_COUNTY_ID\)\.allowed === false/, 'Liberty containment regression checks must remain in place');
assert.match(v646Doc, /Activation Hold Summary/, 'V646 documentation must record the activation hold');
assert.match(v646Doc, /V646\.4 is not complete as an activation/, 'V646 documentation must state activation is not complete');

console.log(JSON.stringify({
  audit: 'V646.4 San Jacinto activation hold and regression containment',
  sanJacintoSelectable: false,
  sanJacintoOperational: false,
  sanJacintoProductionEnabled: false,
  sanJacintoActivationBlocked: true,
  sanJacintoBoundaryEvidencePreserved: coordinateCount > 0,
  productionSelectorExcludesSanJacinto: true,
  libertyRegressionCoverage: true,
  montgomeryRegressionCoverage: true,
  unknownCountyFailClosedCoverage: true
}, null, 2));
