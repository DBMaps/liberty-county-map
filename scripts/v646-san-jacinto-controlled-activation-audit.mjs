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
assert.match(app, /"san-jacinto-tx": Object\.freeze\([\s\S]*stage: GRIDLY_COUNTY_STAGE_VALIDATION_ONLY,[\s\S]*operational: true,[\s\S]*productionEnabled: false,[\s\S]*selectable: true,[\s\S]*productionActivationBlocked: true/, 'San Jacinto must be validation-only, production-disabled, temporarily selectable, and activation-blocked');
assert.match(app, /defaultAwarenessAreas: \["San Jacinto County", "Coldspring", "Shepherd", "Point Blank", "Oakhurst"\]/, 'San Jacinto must publish only V650R validation awareness areas');
assert.match(app, /runtimeSourceAvailability: Object\.freeze\(\{ boundary: "available", roads: "available", crossings: "available", awarenessAreas: "validation-only" \}\)/, 'San Jacinto roads may be available after V650R.10 while awareness remains validation-only');
assert.match(app, /activationHold: Object\.freeze\(\{ milestone: "V650R", complete: false, activationBlocked: true, validationOnly: true, productionActivationApproved: false, browserValidationIncomplete: true, reauthorizationRequired: true \}\)/, 'San Jacinto V650R validation-only hold must be documented in runtime registry metadata');
assert.match(index, /<option[^>]+value="san-jacinto-tx"[^>]+data-gridly-validation-only="true"/, 'San Jacinto must be present only as validation-only county selector markup');
assert.match(app, /"san-jacinto-tx": \[GRIDLY_SAN_JACINTO_COUNTY_WIDE_HOME_TOWN, "Coldspring", "Shepherd", "Point Blank", "Oakhurst"\]/, 'San Jacinto must have validation-only home-area selector options');
assert.match(app, /function gridlyIsValidationOnlyCountySelectorOption\(option, status = gridlyGetCountyRuntimeStatus\(option\?\.value\)\) \{[\s\S]*status\.productionEnabled === false[\s\S]*status\.productionActivationBlocked === true[\s\S]*status\.reauthorizationRequired === true/, 'Runtime selector rendering must expose validation-only options only when production-disabled, activation-blocked, and reauthorization-gated');
assert.match(app, /if \(status\.known && \(status\.operational !== true \|\| status\.productionEnabled !== true \|\| status\.selectable !== true\) && !gridlyIsValidationOnlyCountySelectorOption\(option, status\)\) option\.remove\(\);/, 'Runtime selector rendering must remove known disabled counties unless explicitly validation-only');
assert.match(app, /gridlyNormalizeCountyId\("not-real"\) === GRIDLY_DEFAULT_COUNTY_ID/, 'Unknown counties must continue to fail closed to the Liberty default normalization path');
assert.match(app, /gridlyValidateCountyContainment\(\{ county_id: "montgomery-tx" \}, GRIDLY_DEFAULT_COUNTY_ID\)\.allowed === false/, 'Liberty containment regression checks must remain in place');
assert.match(v646Doc, /Activation Hold Summary/, 'V646 documentation must record the activation hold');
assert.match(v646Doc, /V646\.4 is not complete as an activation/, 'V646 documentation must state activation is not complete');

console.log(JSON.stringify({
  audit: 'V650R San Jacinto validation-only activation and regression containment',
  sanJacintoSelectable: true,
  sanJacintoOperational: true,
  sanJacintoProductionEnabled: false,
  sanJacintoActivationBlocked: true,
  sanJacintoBoundaryEvidencePreserved: coordinateCount > 0,
  productionSelectorValidationOnly: true,
  libertyRegressionCoverage: true,
  montgomeryRegressionCoverage: true,
  unknownCountyFailClosedCoverage: true
}, null, 2));
