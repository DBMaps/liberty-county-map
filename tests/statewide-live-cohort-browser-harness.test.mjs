import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const artifact = JSON.parse(fs.readFileSync('reports/statewide-audit/gridly-live-certification-cohort-v1.json', 'utf8'));
const source = fs.readFileSync('tools/statewide-audit/statewide-live-cohort-browser-harness.js', 'utf8');
const storage = new Map();
const window = {
  console: { log() {}, error() {}, warn() {} },
  fetch: () => new Promise(() => {}),
  sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  navigator: { userAgent: 'test-browser', language: 'en' }, location: { href: 'https://example.test/' },
  performance: { now: () => 100 }, setTimeout, Blob, URL,
  document: { querySelectorAll: () => [], createElement: () => ({ click() {} }) }
};
window.window = window;
vm.runInNewContext(source, window);
const harness = window.__gridlyStatewideCohortHarnessTest;

test('loads the exact 14-row committed cohort', () => assert.equal(harness.validateCohort(artifact).length, 14));
test('requires 14 unique state vectors', () => assert.equal(new Set(artifact.itinerary.map(row => row.stateVectorId)).size, 14));
test('preserves exactly one existing owner-evidence row without a place-name special case', () => {
  const owners = artifact.itinerary.filter(row => row.alreadyCertifiedByOwnerEvidence);
  assert.equal(owners.length, 1);
  assert.doesNotMatch(source, /community\s*===?\s*['"]Fredericksburg/);
});
test('has exactly 13 newly executable rows', () => assert.equal(artifact.itinerary.filter(row => !row.alreadyCertifiedByOwnerEvidence).length, 13));

test('settlement evaluates only row-specific required systems', () => {
  const row = { ...artifact.itinerary[0], liveClassesCovered: ['RAIL_LIVE_BROWSER_REQUIRED'], roadwayState: 'ROADWAY_EXPECTED_EMPTY', railState: 'ACTIVE_EMPTY' };
  const observation = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 0 }, railPolicyIds: [], railLeafletIds: [], railDomIds: [], driveTexasState: null };
  assert.equal(harness.settlement(row, observation).ready, true);
});
test('ACTIVE_EMPTY rail is terminal at exact zero without renderer activity', () => {
  const row = artifact.itinerary.find(row => row.railState === 'ACTIVE_EMPTY');
  const observation = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 0 }, railPolicyIds: [], railLeafletIds: [], railDomIds: [], driveTexasState: 'HEALTHY_EMPTY' };
  assert.equal(harness.settlement(row, observation).railReady, true);
});
test('ACTIVE_POSITIVE rail requires owned positive inventory and exact ID parity', () => {
  const row = artifact.itinerary.find(row => row.railState === 'ACTIVE_POSITIVE');
  const base = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey, runtimeInventoryCounty: row.countyId }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 2 }, railPolicyIds: ['a'], railLeafletIds: ['a'], railDomIds: ['a'], driveTexasState: 'HEALTHY_EMPTY' };
  assert.equal(harness.settlement(row, base).railReady, true);
  assert.equal(harness.settlement(row, { ...base, railDomIds: [] }).railReady, false);
});
test('ROADWAY_EXPECTED_EMPTY accepts a current-owned expected-empty package', () => {
  const row = artifact.itinerary.find(row => row.roadwayState === 'ROADWAY_EXPECTED_EMPTY');
  const observation = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 0 }, railPolicyIds: [], railLeafletIds: [], railDomIds: [], driveTexasState: 'HEALTHY_EMPTY' };
  assert.equal(harness.settlement({ ...row, railState: 'ACTIVE_EMPTY' }, observation).roadwayReady, true);
});
test('ROADWAY_WITH_DATA requires current source, loaded terminal state, and data', () => {
  const row = artifact.itinerary.find(row => row.roadwayState === 'ROADWAY_WITH_DATA');
  const base = { context: {}, roadway: { loadedRoadwayCounty: row.countyId, activeCountyPackageLoaded: true }, roadwayFeatureCount: 1, rail: {}, railPolicyIds: [], railLeafletIds: [], railDomIds: [] };
  assert.equal(harness.settlement(row, base).roadwayReady, true);
  assert.equal(harness.settlement(row, { ...base, roadwayFeatureCount: 0 }).roadwayReady, false);
});
test('DriveTexas keeps all terminal health states distinct and never manufactures healthy empty', () => {
  assert.equal(harness.driveTexasState({ sourceStatus: 'HEALTHY_WITH_DATA' }), 'HEALTHY_WITH_DATA');
  assert.equal(harness.driveTexasState({ sourceStatus: 'HEALTHY_EMPTY' }), null);
  assert.equal(harness.driveTexasState({ sourceStatus: 'HEALTHY_EMPTY', requestCompleted: true }), 'HEALTHY_EMPTY');
  assert.equal(harness.driveTexasState({ sourceStatus: 'FAILED' }), 'FAILED');
  assert.equal(harness.driveTexasState({ sourceStatus: 'STALE_RETAINED' }), 'RETAINED');
  assert.equal(harness.driveTexasState({ sourceStatus: 'UNAVAILABLE' }), 'UNAVAILABLE');
  assert.equal(harness.driveTexasState({}, true), 'TIMEOUT');
});
test('manual actions pause and require the explicit continue command', () => {
  assert.match(source, /\[MANUAL ACTION REQUIRED\]/);
  assert.match(source, /state\.waiting = \{ row, result, before: snapshot\(row\) \}/);
  assert.match(source, /gridlyStatewideCohortContinue = async/);
});
test('checkpoint resume validates the completed artifact prefix', () => {
  harness.state.cohort = artifact; harness.state.rows = artifact.itinerary;
  const checkpoint = { auditVersion: 'gridly.statewide-live-cohort-audit.v1', artifactSchemaVersion: artifact.schemaVersion, completedPrefix: [{ sequence: 1, stateVectorId: 'SV-01', canonicalKey: artifact.itinerary[0].canonicalKey }], results: [{}] };
  assert.equal(harness.validateCheckpoint(checkpoint).length, 1);
  assert.throws(() => harness.validateCheckpoint({ ...checkpoint, completedPrefix: [{ ...checkpoint.completedPrefix[0], stateVectorId: 'wrong' }] }), /PREFIX_MISMATCH/);
});
test('stale predecessor isolation checks every captured owner identity', () => {
  const previous = { community: 'old', county: 'old-county', roadwayCounty: 'old-county', railCounty: 'old-county', driveTexasIds: ['d'], railIds: ['r'], alertIds: ['a'], officialIds: ['o'] };
  const current = { context: { awarenessAreaKey: 'new', activeCountyId: 'new-county', runtimeInventoryCounty: 'new-county' }, roadway: { loadedRoadwayCounty: 'new-county' }, driveTexasRecordIds: [], railLeafletIds: [], alertCardIds: [], officialMarkerIds: [] };
  assert.equal(harness.compareStale(previous, current, ['cleanup']).pass, true);
  assert.equal(harness.compareStale(previous, { ...current, alertCardIds: ['a'] }, ['cleanup']).pass, false);
});
test('cohort contains controlled county changes and multi-county transitions', () => {
  assert.ok(artifact.itinerary.some((row, index) => index && row.countyId !== artifact.itinerary[index - 1].countyId));
  assert.ok(artifact.itinerary.some(row => row.multiCounty));
});
test('selection contains no direct production state mutation', () => {
  const selection = source.slice(source.indexOf('async function select(row)'), source.indexOf('\n  async function run'));
  assert.match(selection, /selectGridlySettingsAwarenessArea/);
  assert.doesNotMatch(selection, /localStorage|GRIDLY_ACTIVE_COUNTY_ID|homeTown\s*=|awarenessArea\s*=|setView|flyTo/);
});
test('harness does not automate the production Settings DOM picker', () => assert.doesNotMatch(source, /mobileDockSettingsBtn|settingsChooseCommunityManuallyBtn|data-gridly-manual-awareness-search|data-gridly-manual-awareness-apply/));
test('export is deterministic for unchanged audit state and supports no-download mode', () => {
  harness.state.cohort = artifact; harness.state.results = []; harness.state.index = 0; harness.state.startedAt = 'fixed'; harness.state.completedAt = null;
  assert.equal(window.gridlyStatewideCohortExport(false), window.gridlyStatewideCohortExport(false));
});

