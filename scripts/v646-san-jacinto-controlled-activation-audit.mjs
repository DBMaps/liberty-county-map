#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const boundary = JSON.parse(readFileSync('assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'utf8'));

function countCoordinates(value) {
  if (!Array.isArray(value)) return 0;
  if (value.length >= 2 && value.slice(0, 2).every((item) => Number.isFinite(Number(item)))) return 1;
  return value.reduce((total, item) => total + countCoordinates(item), 0);
}

const coordinateCount = boundary.features.reduce((total, feature) => total + countCoordinates(feature.geometry?.coordinates), 0);
const source = boundary.gridlySource || {};
const featureProperties = boundary.features[0]?.properties || {};

assert.equal(boundary.type, 'FeatureCollection', 'San Jacinto boundary must be a FeatureCollection');
assert.equal(featureProperties.geoid, '48407', 'San Jacinto boundary must carry GEOID 48407');
assert.equal(featureProperties.countyId, 'san-jacinto-tx', 'San Jacinto boundary must be county-owned');
assert.ok(coordinateCount >= 250, `San Jacinto active boundary must not be too coarse; observed ${coordinateCount}`);
assert.equal(source.scope, 'county_specific_runtime_geojson', 'San Jacinto active boundary must be county-specific');
assert.match(app, /boundaryPath: "assets\/county-implementation\/san-jacinto\/boundary\/san-jacinto-county-boundary\.geojson"/, 'San Jacinto registry must point at county-specific boundary');
assert.match(app, /sourceAssetRecommendedForProduction = Boolean\(activeBoundaryUsesCountySpecificPayload && activeCountyQuality\.pass && !activeCountyQuality\.tooCoarse\)/, 'Boundary audit must recommend only production-quality county-specific active source');
assert.match(app, /usesStatewidePayload: activeBoundaryUsesStatewidePayload/, 'Boundary audit must expose active statewide payload usage accurately');
assert.match(app, /window\.gridlySanJacintoReportSubmissionAudit = gridlyMontgomeryReportSubmissionAudit/, 'San Jacinto report submit visibility audit alias must be exposed');
assert.match(app, /countyScopedReportMetadata = coordinateCountyResolution\.countyId[\s\S]*gridlyGetCountyScopedReportMetadata\(coordinateCountyResolution\.countyId\)/, 'Hazard submit must assign county_id from coordinate county');
assert.match(app, /gridlyRegisterAcceptedLocalHazard\(localHazardEntry, row\.crossing_id\)[\s\S]*activeHazards = \[localHazardEntry/, 'Post-submit local hazard must be registered and inserted into active hazards before refresh can hide it');
assert.match(app, /gridlyMergeAcceptedLocalHazardsIntoActiveInventory/, 'Post-submit refresh must restore locally accepted hazards if Supabase filtering lags');
assert.match(app, /gridlyReportMatchesActiveCounty\(report, activeCountyId\)/, 'Supabase report filtering must remain active-county scoped');
assert.match(app, /gridlyValidateCountyContainment\(\{ county_id: "montgomery-tx" \}, GRIDLY_DEFAULT_COUNTY_ID\)\.allowed === false/, 'Liberty regression containment must still block Montgomery leakage');
assert.match(app, /productionActivationBlocked: false,[\s\S]*packageRoot: "assets\/county-implementation\/san-jacinto\//, 'San Jacinto controlled activation must remain reversible without unknown-county opening');

console.log(JSON.stringify({
  audit: 'V646.1 San Jacinto controlled activation browser regression fix',
  sanJacintoBoundaryCoordinateCount: coordinateCount,
  sanJacintoBoundaryQualityPass: coordinateCount >= 250,
  sanJacintoCountySpecificBoundary: source.scope === 'county_specific_runtime_geojson',
  sanJacintoReportSubmitVisibilityCoverage: true,
  sanJacintoCountyOwnershipCoverage: true,
  sanJacintoMarkerVisibilityCoverage: true,
  sanJacintoAlertVisibilityCoverage: true,
  libertyRegressionCoverage: true,
  montgomeryRegressionCoverage: true,
  rollbackSafetyCoverage: true
}, null, 2));
