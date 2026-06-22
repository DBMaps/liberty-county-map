const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const registryArtifact = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/registry/san-jacinto-county-runtime-registry-v639.json', 'utf8'));
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

const sandbox = { Object, String, Boolean };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_COUNTY_REGISTRY, GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyNormalizeCountyId, gridlyIsKnownCountyId, gridlyIsCountyOperational, gridlyGetCountyRuntimeStatus, gridlyGetCountyRuntimeSources, gridlyValidateCountyContainment, gridlyReportMatchesActiveCounty, gridlyGetCountyScopedReportMetadata };`, sandbox);

const api = sandbox.api;
const registry = api.GRIDLY_COUNTY_REGISTRY;
const sanJacinto = registry['san-jacinto-tx'];
const sanSources = api.GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY['san-jacinto-tx'];

assert.ok(sanJacinto, 'San Jacinto registration exists');
assert.strictEqual(sanJacinto.stage, 'operational', 'San Jacinto stage is operational');
assert.strictEqual(sanJacinto.operational, true, 'San Jacinto remains operational');
assert.strictEqual(sanJacinto.productionEnabled, true, 'San Jacinto production is enabled');
assert.strictEqual(sanJacinto.selectable, true, 'San Jacinto remains selectable');
assert.strictEqual(sanJacinto.validationOnly, false, 'San Jacinto is no longer validation-only');
assert.strictEqual(sanJacinto.productionActivationBlocked, false, 'San Jacinto production activation is unblocked');
assert.strictEqual(sanJacinto.productionReauthorizationRequired, false, 'San Jacinto production reauthorization is cleared');
assert.strictEqual(sanJacinto.reauthorizationRequired, false, 'San Jacinto reauthorization is not required');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('san-jacinto-tx'))), {
  known: true,
  countyId: 'san-jacinto-tx',
  operational: true,
  stage: 'operational',
  productionEnabled: true,
  selectable: true,
  validationOnly: false,
  productionActivationBlocked: false,
  reauthorizationRequired: false
}, 'San Jacinto production status is audit-observable');

assert.strictEqual(api.gridlyIsKnownCountyId('san-jacinto-tx'), true, 'San Jacinto is known');
assert.strictEqual(api.gridlyIsCountyOperational('san-jacinto-tx'), true, 'San Jacinto is operational through helper');
assert.strictEqual(api.gridlyNormalizeCountyId('san-jacinto-tx'), 'san-jacinto-tx', 'San Jacinto normalizes as an active county');
assert.strictEqual(index.includes('value="san-jacinto-tx"'), true, 'San Jacinto remains selectable in county switcher');

assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.defaultAwarenessAreas)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'San Jacinto awareness areas are retained');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanSources.defaultAwarenessAreas)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'runtime source registry retains San Jacinto awareness areas');
assert.strictEqual(sanSources.owner, 'san-jacinto-owned', 'San Jacinto source ownership remains explicit');
assert.strictEqual(sanSources.availability.boundary, 'available', 'San Jacinto boundary remains available');
assert.strictEqual(sanSources.availability.roads, 'available', 'San Jacinto roads remain available');
assert.strictEqual(sanSources.availability.crossings, 'available', 'San Jacinto crossings remain available');
assert.strictEqual(sanSources.availability.awarenessAreas, 'available', 'San Jacinto awareness areas are production available');
assert.strictEqual(sanSources.crossingSource, 'assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson', 'San Jacinto crossing source is retained');
assert.strictEqual(sanSources.roadSource, 'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson', 'San Jacinto road source is retained');

['san-jacinto-county', 'coldspring', 'shepherd', 'point-blank', 'oakhurst'].forEach((key) => {
  assert.strictEqual(source.includes(`{ key: "${key}"`), true, `${key} awareness anchor remains registered`);
});
assert.ok(source.includes('Shepherd'), 'Shepherd reporting anchor remains available');
assert.ok(source.includes('Coldspring'), 'Coldspring reporting anchor remains available');
assert.ok(source.includes('Point Blank'), 'Point Blank reporting anchor remains available');
assert.ok(source.includes('Oakhurst'), 'Oakhurst reporting anchor remains available');
assert.ok(source.includes('function buildGridlyAlertCardConsumerModel'), 'alert generation path remains present');
assert.ok(source.includes('function buildGridlyLightweightActiveAwareness'), 'awareness generation path remains present');

assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'san-jacinto-tx').allowed, true, 'San Jacinto containment allows matching San Jacinto reports');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'san-jacinto-tx').allowed, false, 'Liberty does not leak into San Jacinto');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'san-jacinto-tx').allowed, false, 'Montgomery does not leak into San Jacinto');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'liberty-tx'), false, 'San Jacinto does not leak to Liberty');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'montgomery-tx'), false, 'San Jacinto does not leak to Montgomery');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('san-jacinto-tx').county_id, 'san-jacinto-tx', 'San Jacinto report metadata is county-scoped');

assert.strictEqual(registryArtifact.stage, 'operational', 'registry artifact stage is operational');
assert.strictEqual(registryArtifact.productionEnabled, true, 'registry artifact production is enabled');
assert.strictEqual(registryArtifact.validationOnly, false, 'registry artifact validation-only is false');
assert.strictEqual(registryArtifact.productionActivationBlocked, false, 'registry artifact activation block is false');
assert.strictEqual(registryArtifact.reauthorizationRequired, false, 'registry artifact reauthorization is false');

['historicalReadsEnabled: false', 'historyUiEnabled: false', 'DriveTexasPaused: true', 'TransportationIntelligenceEnabled: false', 'TransportationIntelligenceDisplay: false', 'TransportationIntelligenceActivation: false'].forEach((needle) => {
  assert.ok(source.includes(needle), `${needle} remains protected`);
});

console.log('sanJacintoProductionActivationV674.test.js passed');
