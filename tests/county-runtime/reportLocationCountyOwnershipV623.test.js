const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const GRIDLY_AWARENESS_AREA_DEFINITIONS = [');
assert.ok(cutoff > 0, 'runtime county bounds block is present before awareness definitions');

function loadRuntime(activeCounty = 'montgomery-tx') {
  const sandbox = { Object, String, Number, Boolean, Array, console, window: { GRIDLY_ACTIVE_COUNTY_ID: activeCounty, addEventListener() {}, removeEventListener() {}, setInterval() { return 0; }, clearInterval() {}, setTimeout() { return 0; }, clearTimeout() {} }, setInterval() { return 0; }, clearInterval() {}, setTimeout() { return 0; }, clearTimeout() {} };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { gridlyGetActiveCountyId, gridlyResolveCountyIdForCoordinate, gridlyGetCoordinateScopedReportMetadata, gridlyCoordinateInsideCountyBounds, gridlyGetCountyScopedReportMetadata, gridlyReportMatchesActiveCounty };`, sandbox);
  return sandbox.api;
}

const montgomeryRuntime = loadRuntime('montgomery-tx');
const libertyRuntime = loadRuntime('liberty-tx');
const montgomeryCoord = { lat: 30.3119, lng: -95.4558 };
const libertyCoord = { lat: 30.0579, lng: -94.7955 };
const unsupportedCoord = { lat: 32.7767, lng: -96.7970 };

assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyId(), 'montgomery-tx', 'fixture starts in Montgomery active context');
assert.strictEqual(montgomeryRuntime.gridlyResolveCountyIdForCoordinate(montgomeryCoord.lat, montgomeryCoord.lng).countyId, 'montgomery-tx', 'Montgomery coordinate resolves to Montgomery');
assert.strictEqual(montgomeryRuntime.gridlyGetCoordinateScopedReportMetadata(montgomeryCoord.lat, montgomeryCoord.lng).county_id, 'montgomery-tx', 'Montgomery selected + Montgomery coordinate submits as Montgomery');
assert.strictEqual(montgomeryRuntime.gridlyResolveCountyIdForCoordinate(libertyCoord.lat, libertyCoord.lng).countyId, 'liberty-tx', 'Liberty coordinate resolves to Liberty while Montgomery is active');
assert.strictEqual(montgomeryRuntime.gridlyGetCoordinateScopedReportMetadata(libertyCoord.lat, libertyCoord.lng).county_id, 'liberty-tx', 'Montgomery selected + Liberty coordinate submits as Liberty, not Montgomery');
assert.strictEqual(libertyRuntime.gridlyGetCoordinateScopedReportMetadata(montgomeryCoord.lat, montgomeryCoord.lng).county_id, 'montgomery-tx', 'Liberty selected + Montgomery coordinate submits as Montgomery, not Liberty');
assert.strictEqual(montgomeryRuntime.gridlyResolveCountyIdForCoordinate(unsupportedCoord.lat, unsupportedCoord.lng).countyId, null, 'Unsupported coordinate does not resolve to active county');
assert.strictEqual(montgomeryRuntime.gridlyGetCoordinateScopedReportMetadata(unsupportedCoord.lat, unsupportedCoord.lng), null, 'Unsupported coordinate fails closed without activeCounty metadata');
assert.strictEqual(montgomeryRuntime.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'montgomery-tx'), false, 'Out-of-active-county accepted reports are not visible in current county filter');

assert(source.includes('function gridlyReportLocationCountyOwnershipAudit()'), 'Location county ownership audit helper exists');
assert(source.includes('window.gridlyReportLocationCountyOwnershipAudit = gridlyReportLocationCountyOwnershipAudit;'), 'Location county ownership audit helper is exposed');
assert(source.includes('activeCountyForced'), 'Audit detects activeCounty-forced report ownership');
assert(source.includes('acceptedOutsideActiveCounty'), 'Audit reports accepted outside active county ownership');
assert(source.includes('Hazard report location is outside Gridly\'s supported county coverage.'), 'Unsupported hazard coordinates fail closed');
assert(source.includes('historicalReadsEnabled: false'), 'protected historicalReadsEnabled boundary remains false');
assert(source.includes('historyUiEnabled: false'), 'protected historyUiEnabled boundary remains false');
assert(source.includes('DriveTexasPaused: true'), 'DriveTexas remains paused');
assert(source.includes('TransportationIntelligenceEnabled: false'), 'Transportation Intelligence remains disabled');

console.log('reportLocationCountyOwnershipV623.test.js passed');
