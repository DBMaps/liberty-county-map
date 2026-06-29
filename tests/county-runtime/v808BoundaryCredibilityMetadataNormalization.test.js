const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const jeffersonBoundary = JSON.parse(fs.readFileSync('assets/county-implementation/jefferson/boundary/jefferson-county-boundary.geojson', 'utf8'));
const jeffersonProps = jeffersonBoundary.features[0].properties;

assert.ok(appSource.includes('const sourceLibraryCredibilityPass = Boolean('), 'audit computes the V807 source-library credibility gate');
assert.ok(appSource.includes('GRIDLY_BOUNDARY_ARCHITECTURE === "county-implementation-boundary-folder"'), 'source-library gate checks the V807 boundary folder architecture');
assert.ok(appSource.includes('activeRuntimeBoundarySource === expectedSourceLibraryBoundaryPath'), 'source-library gate requires the active county boundary folder runtime asset');
assert.ok(appSource.includes('GRIDLY_AUTHORITATIVE_BOUNDARY_SOURCE_LIBRARY === "Gridly-Source-Data/Census/*-county-2025-wgs84.geojson"'), 'source-library gate requires the Census source library');
assert.ok(appSource.includes('activeBoundaryLayerCount === 1'), 'source-library gate requires exactly one active boundary layer');
assert.ok(appSource.includes('getGridlyCountyBoundaryOverlayFeatureGeoid(activeCountyGeoJson?.features?.[0] || {}) === activeCountyGeoid'), 'source-library gate requires the active feature GEOID to match the expected county GEOID');
assert.ok(appSource.includes('activeCountyQuality.coordinateCount > GRIDLY_COUNTY_BOUNDARY_OVERLAY_MIN_ACTIVE_COORDINATE_COUNT'), 'source-library gate rejects low-coordinate placeholders');
assert.ok(appSource.includes('activeCountyQuality.pass'), 'source-library gate requires geometry quality pass');
assert.ok(appSource.includes('bboxFallbackUsed === false'), 'source-library gate rejects bbox fallback geometry');
assert.ok(appSource.includes('staleBoundaryRuntimeAssetPaths.length === 0'), 'source-library gate rejects duplicate stale runtime boundary assets');
assert.ok(appSource.includes('mapCameraCountyPass === true'), 'source-library gate requires camera county pass');

assert.ok(appSource.includes('legacyManufacturingMetadataPresent'), 'audit exposes legacy manufacturing metadata presence');
assert.ok(appSource.includes('legacyManufacturingMetadataRequired: false'), 'audit marks legacy manufacturing metadata as not required');
assert.ok(appSource.includes('credibilityMode: sourceLibraryCredibilityPass ? "source-library" : (activeBoundaryAuthoritativeJeffersonV802 ? "manufactured-v802" : "source-library")'), 'Jefferson audit reports source-library mode while preserving V802 recognition');
assert.ok(appSource.includes('sourceLibraryCredibilityPass,'), 'audit returns sourceLibraryCredibilityPass');
assert.ok(appSource.includes('activeBoundaryAuthoritativeJeffersonNormalized = sourceLibraryCredibilityPass || activeBoundaryAuthoritativeJeffersonV802'), 'Jefferson credibility passes with either V807 source-library evidence or legacy V802 evidence');
assert.ok(appSource.includes('credibilityDetermination: activeBoundaryAuthoritativeJeffersonNormalized ? "passed" : "failed"'), 'Jefferson credibility determination uses normalized evidence');
assert.ok(appSource.includes('visualCorrectnessPass: activeBoundaryAuthoritativeJeffersonNormalized'), 'Jefferson visual correctness uses normalized evidence');

assert.strictEqual(jeffersonProps.GEOID, '48245', 'Jefferson boundary remains the expected GEOID 48245 asset');
assert.strictEqual(jeffersonProps.boundaryManufacturingSystem, undefined, 'Jefferson source-library boundary does not require legacy boundaryManufacturingSystem metadata');
assert.strictEqual(jeffersonProps.manufacturedBoundarySourcePath, undefined, 'Jefferson source-library boundary does not require legacy manufacturedBoundarySourcePath metadata');
assert.strictEqual(jeffersonProps.manufacturedBoundaryOutputPath, undefined, 'Jefferson source-library boundary does not require legacy manufacturedBoundaryOutputPath metadata');

console.log('v808BoundaryCredibilityMetadataNormalization.test.js passed');
