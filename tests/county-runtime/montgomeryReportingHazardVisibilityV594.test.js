const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

function loadRuntime(windowOverrides = {}) {
  const sandbox = { Object, String, Boolean, window: windowOverrides };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, gridlyValidateCountyContainment, gridlyGetActiveCountyId, gridlyGetCountyScopedReportMetadata, gridlyReportMatchesActiveCounty };`, sandbox);
  return sandbox.api;
}

const montgomeryRuntime = loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' });
const libertyRuntime = loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' });
const montgomeryMetadata = montgomeryRuntime.gridlyGetCountyScopedReportMetadata();
const libertyMetadata = libertyRuntime.gridlyGetCountyScopedReportMetadata();

assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyId(), 'montgomery-tx', 'Montgomery can be the active reporting county');
assert.strictEqual(montgomeryMetadata.county_id, 'montgomery-tx', 'Montgomery hazard payload receives montgomery-tx county metadata');
assert.notStrictEqual(montgomeryMetadata.county_id, 'liberty-tx', 'Montgomery hazard payload does not save as Liberty County');
assert.strictEqual(libertyMetadata.county_id, 'liberty-tx', 'Liberty hazard creation still receives Liberty metadata');
assert.strictEqual(montgomeryRuntime.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery hazards pass Montgomery containment');
assert.strictEqual(montgomeryRuntime.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'montgomery-tx').allowed, false, 'Liberty hazards do not leak into Montgomery active generation');
assert.strictEqual(libertyRuntime.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'liberty-tx').allowed, false, 'Montgomery hazards do not leak into Liberty active generation');
assert.strictEqual(montgomeryRuntime.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'montgomery-tx').allowed, false, 'Unknown county hazards remain fail-closed');
assert.strictEqual(montgomeryRuntime.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'montgomery-tx'), true, 'Montgomery hazards are visible to active Montgomery filters');
assert.strictEqual(montgomeryRuntime.gridlyReportMatchesActiveCounty({ county_id: 'unknown-tx' }, 'montgomery-tx'), false, 'Unknown county reports remain blocked by visibility filters');

assert(source.includes('const countyScopedReportMetadata = coordinateCountyResolution.countyId'), 'road hazard submit flow resolves county metadata from the report coordinate');
assert(source.includes('county_id: countyScopedReportMetadata.county_id'), 'road hazard structured metadata carries county_id for legacy Supabase fallback rows');
assert(source.includes('countyId: countyScopedReportMetadata.county_id'), 'road hazard structured metadata carries countyId alias for local rendering and marker pipelines');
assert(source.includes('const rawCountyId = row?.county_id || row?.countyId || structured.county_id || structured.countyId;'), 'normalization reads county metadata from top-level columns or structured fallback detail');
assert(source.includes('county_id: gridlyGetReportCountyId(row),'), 'normalizeReports preserves county_id for active hazard generation');
assert(source.includes('countyId: gridlyGetReportCountyId(row),'), 'normalizeReports preserves countyId alias for marker/render pipeline');
assert(source.includes('county_id: metadata.county_id,'), 'hazard lifecycle history writes county_id');
assert(source.includes('countyId: metadata.countyId'), 'hazard lifecycle history writes countyId alias');
assert(source.includes('gridlyCaptureHazardHistoryEvent(localHazardEntry'), 'local immediate hazard submit writes lifecycle history after normalization');
assert(source.includes('activeHazards = [localHazardEntry'), 'local immediate hazard submit enters active hazards for rendering');
assert(source.includes('scheduleHazardMarkerAutoRender("createSharedHazardReport:local_immediate")'), 'local immediate hazard submit schedules marker render');
assert(source.includes('historicalReadsEnabled: false'), 'protected historicalReadsEnabled boundary remains false');
assert(source.includes('historyUiEnabled: false'), 'protected historyUiEnabled boundary remains false');
assert(source.includes('DriveTexasPaused: true'), 'DriveTexas remains paused');
assert(source.includes('TransportationIntelligenceEnabled: false'), 'Transportation Intelligence remains disabled');

console.log('montgomeryReportingHazardVisibilityV594.test.js passed');
