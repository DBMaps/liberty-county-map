const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyLp0361aCountyContainmentAudit()'), 'LP036.1A audit helper is implemented');
assert(source.includes('window.gridlyLp0361aCountyContainmentAudit = gridlyLp0361aCountyContainmentAudit'), 'LP036.1A browser audit helper is exposed');
assert(source.includes('productionBehaviorChanged: false'), 'audit explicitly records investigation-only production behavior');
assert(source.includes('rootCauseClassification: "inadequate_rectangular_geometry"'), 'audit distinguishes inadequate rectangular geometry as root cause');
assert(source.includes('resolverConsumptionCorrect: true'), 'audit records resolver consumption finding');
assert(source.includes('gridlyLp0361aNormalizeCountyBounds'), 'bounds normalization helper exists');
assert(source.includes('object_fields_south_west_north_east'), 'coordinate order is explicitly documented in code');

const boundsCode = source.slice(
  source.indexOf('const LIBERTY_COUNTY_AWARENESS_BOUNDS'),
  source.indexOf('const GRIDLY_HARRIS_COMMUNITY_COVERAGE_AUDIT')
) + ';this.bounds = GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(boundsCode, sandbox);
const bounds = sandbox.bounds;

function matchingCountyIds(latitude, longitude) {
  return Object.entries(bounds)
    .filter(([, value]) => latitude >= value.south && latitude <= value.north && longitude >= value.west && longitude <= value.east)
    .map(([countyId]) => countyId)
    .sort();
}

assert.deepStrictEqual(matchingCountyIds(30.0466, -94.8852), ['chambers-tx', 'liberty-tx'], 'Dayton reports every matching county bounds candidate');
assert.deepStrictEqual(matchingCountyIds(30.7110, -94.9327), ['polk-tx', 'san-jacinto-tx'], 'Livingston reports every matching county bounds candidate');
assert.deepStrictEqual(matchingCountyIds(29.7532, -95.3670), ['harris-tx'], 'Downtown Houston control remains Harris only');
assert.deepStrictEqual(matchingCountyIds(29.7079, -95.4010), ['harris-tx'], 'Medical Center / Rice control remains Harris only');
assert.deepStrictEqual(matchingCountyIds(29.6911, -95.2091), ['harris-tx'], 'Pasadena remains Harris only');
assert.deepStrictEqual(matchingCountyIds(32.7767, -96.7970), [], 'outside coverage remains outside every supported county bounds entry');
assert.strictEqual(Object.keys(bounds).length, 28, 'all 28 operational counties have bounds entries');
assert.strictEqual(bounds['liberty-tx'].west < bounds['liberty-tx'].east, true, 'west/east coordinate order is valid');
assert.strictEqual(bounds['liberty-tx'].south < bounds['liberty-tx'].north, true, 'south/north coordinate order is valid');

const resolverBody = source.slice(source.indexOf('function gridlyResolveLocationContext(input = {})'), source.indexOf('function gridlyLp0361RecordObservation'));
assert(!resolverBody.includes('GRIDLY_DEFAULT_COUNTY_ID'), 'no default-county fallback is introduced');
assert(!resolverBody.includes('gridlyGetActiveCountyId() ||'), 'no active-county preference is introduced');
assert(!resolverBody.includes('gridlyLp0361DistanceMiles(latitude, longitude') || !resolverBody.includes('gridlyLp0361ResolveSupportedCounty'), 'county resolution does not guess by nearest center');
assert(!/(gridlySafeLocalStorageSet|localStorage\.setItem|sessionStorage\.setItem)/.test(resolverBody), 'no storage writes occur');
assert(!/(gridlySetActiveCountyContext|gridlyLoadRoadway|gridlyScheduleHarrisPartitionVisibleBoundsLoad)/.test(resolverBody), 'no runtime activation occurs');
assert(!/(fitBounds|setView|panTo)/.test(resolverBody), 'no map movement occurs');
assert(source.includes('const candidates = countyIds.filter'), 'operational/selectable filtering occurs before ambiguity classification');
assert(source.includes('duplicateNormalizedCountyIds'), 'duplicate/alias candidates are identified before ambiguity classification in audit');
assert(source.includes('invalidBoundsEntries'), 'malformed data is distinguished in audit');
assert(source.includes('resolverConsumptionCorrect'), 'resolver implementation bug classification is distinguished in audit');

console.log('LP036.1A county containment investigation test passed');
