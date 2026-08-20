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
  performance: { now: (() => { let now = 0; return () => ++now; })() }, setTimeout, Blob, URL,
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
  const observation = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey, canonicalPlaceGeoid: row.placeGeoid }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 0 }, railPolicyIds: [], railLeafletIds: [], railDomIds: [], driveTexasState: null };
  assert.equal(harness.settlement(row, observation).ready, true);
});
test('ACTIVE_EMPTY rail is terminal at exact zero without renderer activity', () => {
  const row = artifact.itinerary.find(row => row.railState === 'ACTIVE_EMPTY');
  const observation = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey, canonicalPlaceGeoid: row.placeGeoid }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 0 }, railPolicyIds: [], railLeafletIds: [], railDomIds: [], driveTexasState: 'HEALTHY_EMPTY' };
  assert.equal(harness.settlement(row, observation).railReady, true);
});
test('ACTIVE_POSITIVE rail requires owned positive inventory and exact ID parity', () => {
  const row = artifact.itinerary.find(row => row.railState === 'ACTIVE_POSITIVE');
  const base = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey, canonicalPlaceGeoid: row.placeGeoid, runtimeInventoryCounty: row.countyId }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 2 }, railPolicyIds: ['a'], railLeafletIds: ['a'], railDomIds: ['a'], driveTexasState: 'HEALTHY_EMPTY' };
  assert.equal(harness.settlement(row, base).railReady, true);
  assert.equal(harness.settlement(row, { ...base, railDomIds: [] }).railReady, false);
});
test('ROADWAY_EXPECTED_EMPTY accepts a current-owned expected-empty package', () => {
  const row = artifact.itinerary.find(row => row.roadwayState === 'ROADWAY_EXPECTED_EMPTY');
  const observation = { context: { activeCountyId: row.countyId, awarenessAreaKey: row.canonicalKey, canonicalPlaceGeoid: row.placeGeoid }, roadway: { loadedRoadwayCounty: row.countyId }, roadwayFeatureCount: 0, rail: { runtimeCrossingInventoryCount: 0 }, railPolicyIds: [], railLeafletIds: [], railDomIds: [], driveTexasState: 'HEALTHY_EMPTY' };
  assert.equal(harness.settlement({ ...row, railState: 'ACTIVE_EMPTY' }, observation).roadwayReady, true);
});
test('ROADWAY_WITH_DATA requires current source, loaded terminal state, and data', () => {
  const row = artifact.itinerary.find(row => row.roadwayState === 'ROADWAY_WITH_DATA');
  const base = { context: {}, roadway: { loadedRoadwayCounty: row.countyId, activeCountyPackageLoaded: true }, roadwayFeatureCount: 1, rail: {}, railPolicyIds: [], railLeafletIds: [], railDomIds: [] };
  assert.equal(harness.settlement(row, base).roadwayReady, true);
  assert.equal(harness.settlement(row, { ...base, roadwayFeatureCount: 0 }).roadwayReady, false);
});
test('DriveTexas keeps all terminal health states distinct and never manufactures healthy empty', () => {
  const base = { currentRequestOwnership: 'PROVEN', requestAttempted: true, requestSuccess: true, requestCompletedAt: 2 };
  assert.equal(harness.driveTexasState({ ...base, consumerEnvelopeRecordCount: 1 }), 'HEALTHY_WITH_DATA');
  assert.equal(harness.driveTexasState({ ...base, consumerEnvelopeRecordCount: 0 }), 'HEALTHY_EMPTY');
  assert.equal(harness.driveTexasState({ ...base, currentRequestOwnership: 'NOT_PROVEN', consumerEnvelopeRecordCount: 8 }), null);
  assert.equal(harness.driveTexasState({ requestAttempted: true, requestSuccess: false }), 'SOURCE_FAILURE');
  assert.equal(harness.driveTexasState({ retainedDataPresent: true }), 'RETAINED_DATA');
  assert.equal(harness.driveTexasState({ requestAttempted: true, requestSuccess: null, requestCompletedAt: null }), 'IN_FLIGHT');
  assert.equal(harness.driveTexasState({ requestAttempted: true, requestSuccess: null, requestCompletedAt: null }, true), 'TIMEOUT');
});
test('manual actions pause and require the explicit continue command', () => {
  assert.match(source, /\[MANUAL ACTION REQUIRED\]/);
  assert.match(source, /state\.waiting = \{ row, result, before: manualActionSnapshot\(row, beforeObservation\) \}/);
  assert.match(source, /gridlyStatewideCohortContinue = async/);
});
test('checkpoint resume validates the completed artifact prefix', () => {
  harness.state.cohort = artifact; harness.state.rows = artifact.itinerary;
  const checkpoint = { auditVersion: 'gridly.statewide-live-cohort-audit.v7', artifactSchemaVersion: artifact.schemaVersion, completedPrefix: [{ sequence: 1, stateVectorId: 'SV-01', canonicalKey: artifact.itinerary[0].canonicalKey }], results: [{}] };
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
  const selection = source.slice(source.indexOf('async function select(row, timeoutMs = 15000)'), source.indexOf('\n  async function run'));
  assert.match(selection, /selectGridlySettingsAwarenessArea/);
  assert.doesNotMatch(selection, /localStorage|GRIDLY_ACTIVE_COUNTY_ID|homeTown\s*=|awarenessArea\s*=|setView|flyTo/);
});
test('harness does not automate the production Settings DOM picker', () => assert.doesNotMatch(source, /mobileDockSettingsBtn|settingsChooseCommunityManuallyBtn|data-gridly-manual-awareness-search|data-gridly-manual-awareness-apply/));
test('export is deterministic for unchanged audit state and supports no-download mode', () => {
  harness.state.cohort = artifact; harness.state.results = []; harness.state.index = 0; harness.state.startedAt = 'fixed'; harness.state.completedAt = null;
  assert.equal(window.gridlyStatewideCohortExport(false), window.gridlyStatewideCohortExport(false));
});


test('V7 checkpoint namespace rejects V6 and earlier certification', () => {
  storage.set('GRIDLY_STATEWIDE_COHORT_AUDIT_V6', JSON.stringify({ auditVersion: 'gridly.statewide-live-cohort-audit.v6' }));
  storage.set('GRIDLY_STATEWIDE_COHORT_AUDIT_V5', JSON.stringify({ auditVersion: 'gridly.statewide-live-cohort-audit.v5' }));
  assert.equal(harness.AUDIT_VERSION, 'gridly.statewide-live-cohort-audit.v7');
  assert.equal(harness.CHECKPOINT_KEY, 'GRIDLY_STATEWIDE_COHORT_AUDIT_V7');
  assert.equal(storage.has(harness.CHECKPOINT_KEY), false);
  assert.equal(harness.state.index, 0);
  assert.equal(harness.state.rows.length, 14);
  assert.throws(() => harness.validateCheckpoint({ auditVersion: 'gridly.statewide-live-cohort-audit.v6', artifactSchemaVersion: artifact.schemaVersion, completedPrefix: [], results: [] }), /CHECKPOINT_CONTRACT_INVALID/);
  for (let version = 1; version <= 5; version += 1) {
    assert.throws(() => harness.validateCheckpoint({ auditVersion: `gridly.statewide-live-cohort-audit.v${version}`, artifactSchemaVersion: artifact.schemaVersion, completedPrefix: [], results: [] }), /CHECKPOINT_CONTRACT_INVALID/);
  }
  assert.match(source, /gridly-statewide-live-cohort-audit-v7\.json/);
});

async function exerciseSelection(row, configure = () => {}) {
  let context = {};
  let selected = null;
  window.GRIDLY_COUNTY_REGISTRY = { [row.countyId]: { consumerAwarenessAreas: [{ placeGeoid: row.placeGeoid, displayName: row.community, canonicalIdentity: 'PLACE_GEOID', countyMemberships: row.multiCounty ? row.governedMemberships : [row.countyFips] }] } };
  window.GRIDLY_AWARENESS_AREA_DEFINITIONS = [{ key: `${row.countyId}-${row.community.toLowerCase()}`, label: row.community, storageValue: row.community, countyId: row.countyId, communityId: row.placeGeoid, placeGeoid: row.placeGeoid, canonicalCommunityIdentity: 'PLACE_GEOID' }];
  window.resolveGridlyAwarenessAreaQuery = () => row.multiCounty
    ? { status: 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', operational: true, placeGeoid: row.placeGeoid, awarenessArea: window.GRIDLY_AWARENESS_AREA_DEFINITIONS[0] }
    : { status: 'RESOLVED_OPERATIONAL', operational: true, countyId: row.countyId, awarenessAreaKey: `${row.countyId}-${row.community.toLowerCase()}`, awarenessArea: window.GRIDLY_AWARENESS_AREA_DEFINITIONS[0] };
  window.selectGridlySettingsAwarenessArea = () => { selected = window.GRIDLY_AWARENESS_AREA_DEFINITIONS[0]; context = { canonicalPlaceGeoid: row.placeGeoid, activeCountyId: row.countyId }; };
  window.gridlySaveCanonicalMultiCountyPlaceHome = () => { selected = window.GRIDLY_AWARENESS_AREA_DEFINITIONS[0]; context = { canonicalPlaceGeoid: row.placeGeoid, awarenessAreaKey: row.canonicalKey, activeCountyId: row.countyId }; };
  window.gridlyActiveCountyRuntimeAudit = () => context;
  window.getGridlySelectedAwarenessArea = () => selected;
  configure({ setContext: value => { context = value; }, setSelected: value => { selected = value; } });
  return harness.select(row, 1);
}

test('Chester healthy empty is owned by the current PLACE and does not require closed-sheet rows', () => {
  const row = artifact.itinerary.find(row => row.community === 'Chester');
  const checks = harness.alertsConditions(row, {
    context: { activeCountyId: row.countyId, canonicalPlaceGeoid: row.placeGeoid },
    alertsPresentationOwner: { countyId: row.countyId, placeGeoid: row.placeGeoid },
    alertsSurface: { publishedAlertCount: 0, activeIncidentCount: 0, count: 0, nearbySummary: 'No active local issues reported.', routeImpactSummary: 'Route into Liberty moving normally', topStatus: 'US 90 moving normally' },
    alertsSheetOpen: false, alertCardIds: [], driveTexasRecordIds: [], awareness: {}, official: {}, officialMarkerIds: []
  });
  assert.deepEqual({ ownerCurrent: checks.ownerCurrent, emptyContractMet: checks.emptyContractMet, domExpectationMet: checks.domExpectationMet }, { ownerCurrent: true, emptyContractMet: true, domExpectationMet: true });
  assert.equal(harness.alertsConditions(row, { context: { canonicalPlaceGeoid: row.placeGeoid }, alertsPresentationOwner: { countyId: 'liberty-tx', placeGeoid: '4803072' }, alertsSurface: { count: 0, nearbySummary: 'No active local issues reported.' }, alertsSheetOpen: false, alertCardIds: [], driveTexasRecordIds: [], awareness: {}, official: {}, officialMarkerIds: [] }).ownerCurrent, false);
});

test('statewide PLACE bridge resolves Anahuac without a label special case', () => {
  const row = artifact.itinerary.find(row => row.community === 'Anahuac');
  window.GRIDLY_COUNTY_REGISTRY = { 'chambers-tx': { consumerAwarenessAreas: [{ placeGeoid: '4803144', displayName: 'Anahuac', canonicalIdentity: 'PLACE_GEOID', countyMemberships: ['48071'] }] } };
  window.GRIDLY_AWARENESS_AREA_DEFINITIONS = [{ key: 'anahuac', label: 'Anahuac', storageValue: 'Anahuac', countyId: 'chambers-tx' }];
  const result = harness.resolveAuditSelection(row, { status: 'RESOLVED_OPERATIONAL', operational: true, awarenessArea: window.GRIDLY_AWARENESS_AREA_DEFINITIONS[0], candidates: [] });
  assert.equal(result.resolution.awarenessArea.placeGeoid, '4803144');
  assert.equal(result.resolution.awarenessArea.storageValue, 'Anahuac');
  assert.equal(result.bridge.identityShape, 'LEGACY_PARTIAL');
});

function convergence(row, bridge, selected, activeCountyId = row.countyId) {
  window.getGridlySelectedAwarenessArea = () => selected;
  window.gridlyActiveCountyRuntimeAudit = () => ({ activeCountyId, awarenessAreaKey: selected?.key, resolvedGridlyCountyId: selected?.countyId });
  return harness.selectionContext(row, bridge);
}

test('Anahuac legacy convergence uses the exact governed bridge target without requiring runtime PLACE', () => {
  const row = artifact.itinerary.find(row => row.community === 'Anahuac');
  const bridge = { placeGeoid: row.placeGeoid, countyId: row.countyId, productionKey: 'anahuac', productionStorageValue: 'Anahuac', identityShape: 'LEGACY_PARTIAL', governedIdentityCount: 1, productionTargetCount: 1, membershipMatched: true };
  const selected = { key: 'anahuac', storageValue: 'Anahuac', countyId: 'chambers-tx' };
  const result = convergence(row, bridge, selected);
  assert.equal(result.canonicalReady, true);
  assert.equal(result.operands.selectedRuntimePlaceGeoid, null);
  assert.equal(result.firstFalseOperand, null);
});

test('legacy convergence fails closed for wrong county, target, GEOID, target multiplicity, and active county', () => {
  const row = artifact.itinerary.find(row => row.community === 'Anahuac');
  const bridge = { placeGeoid: row.placeGeoid, countyId: row.countyId, productionKey: 'anahuac', productionStorageValue: 'Anahuac', identityShape: 'LEGACY_PARTIAL', governedIdentityCount: 1, productionTargetCount: 1, membershipMatched: true };
  const selected = { key: 'anahuac', label: 'Anahuac', storageValue: 'Anahuac', countyId: row.countyId };
  assert.equal(convergence(row, bridge, { ...selected, countyId: 'wrong-tx' }).firstFalseOperand, 'SELECTED_RUNTIME_COUNTY_MATCHES_EXPECTED');
  assert.equal(convergence(row, bridge, { ...selected, key: 'wrong' }).firstFalseOperand, 'SELECTED_RUNTIME_TARGET_MATCHES_BRIDGE');
  assert.equal(convergence(row, { ...bridge, placeGeoid: '4899999' }, selected).firstFalseOperand, 'BRIDGE_PLACE_MATCHES_EXPECTED');
  assert.equal(convergence(row, { ...bridge, productionTargetCount: 2 }, selected).firstFalseOperand, 'BRIDGE_PRODUCTION_TARGET_COUNT_EXACTLY_ONE');
  assert.equal(convergence(row, bridge, selected, 'wrong-tx').firstFalseOperand, 'ACTIVE_COUNTY_MATCHES_EXPECTED');
});

test('Chester modern convergence keeps authoritative runtime PLACE mandatory', () => {
  const row = artifact.itinerary.find(row => row.community === 'Chester');
  const bridge = { placeGeoid: row.placeGeoid, countyId: row.countyId, productionKey: 'chester', productionStorageValue: 'Chester', identityShape: 'MODERN_FULL', governedIdentityCount: 1, productionTargetCount: 1, membershipMatched: true };
  const selected = { key: 'chester', storageValue: 'Chester', countyId: row.countyId, placeGeoid: row.placeGeoid };
  assert.equal(convergence(row, bridge, selected).canonicalReady, true);
  assert.equal(convergence(row, bridge, { ...selected, placeGeoid: undefined }).firstFalseOperand, 'MODERN_RUNTIME_PLACE_MATCHES_EXPECTED');
  assert.equal(convergence(row, bridge, { ...selected, placeGeoid: '4899999' }).canonicalReady, false);
});

test('statewide PLACE bridge rejects wrong GEOID, governed county, and missing or duplicate registry identity', () => {
  const row = artifact.itinerary.find(row => row.community === 'Anahuac');
  const area = { key: 'anahuac', label: 'Anahuac', storageValue: 'Anahuac', countyId: 'chambers-tx' };
  window.GRIDLY_AWARENESS_AREA_DEFINITIONS = [area];
  const resolve = changed => harness.resolveAuditSelection({ ...row, ...changed }, { status: 'RESOLVED_OPERATIONAL', operational: true, awarenessArea: area });
  window.GRIDLY_COUNTY_REGISTRY = { 'chambers-tx': { consumerAwarenessAreas: [{ placeGeoid: '4803144', displayName: 'Anahuac', canonicalIdentity: 'PLACE_GEOID', countyMemberships: ['48071'] }] } };
  assert.equal(resolve({ placeGeoid: 'wrong' }), null);
  assert.equal(resolve({ countyFips: 'wrong' }), null);
  assert.equal(resolve({ countyId: 'missing-tx' }), null);
  window.GRIDLY_AWARENESS_AREA_DEFINITIONS = [{ ...area, placeGeoid: row.placeGeoid }, { ...area, key: 'duplicate', placeGeoid: row.placeGeoid }];
  assert.equal(resolve({}), null);
});

test('duplicate production label in another county is resolved by governed county identity, not label alone', () => {
  const row = artifact.itinerary.find(row => row.community === 'Chester');
  const expected = { key: 'tyler-tx-chester', label: 'Chester', storageValue: 'Chester', countyId: 'tyler-tx', placeGeoid: row.placeGeoid };
  const other = { key: 'other-chester', label: 'Chester', storageValue: 'Other Chester', countyId: 'other-tx', placeGeoid: '4999999' };
  window.GRIDLY_COUNTY_REGISTRY = { 'tyler-tx': { consumerAwarenessAreas: [{ placeGeoid: row.placeGeoid, displayName: row.community, canonicalIdentity: 'PLACE_GEOID', countyMemberships: row.governedMemberships }] } };
  window.GRIDLY_AWARENESS_AREA_DEFINITIONS = [expected, other];
  const result = harness.resolveAuditSelection(row, { status: 'AMBIGUOUS', operational: true, candidates: [{ countyId: 'tyler-tx', awarenessArea: expected }, { countyId: 'other-tx', awarenessArea: other }] });
  assert.equal(result.resolution.awarenessArea.storageValue, 'Chester');
});

test('Chester command return is ignored and observed canonical PLACE/county convergence succeeds', async () => {
  const row = artifact.itinerary.find(row => row.community === 'Chester');
  window.selectGridlySettingsAwarenessArea = undefined;
  await exerciseSelection(row);
});

test('existing current-community selection still uses the production command and retains exact identity', async () => {
  const row = artifact.itinerary.find(row => row.community === 'Chester');
  let calls = 0;
  const selected = await exerciseSelection(row, ({ setContext, setSelected }) => {
    setContext({ canonicalPlaceGeoid: row.placeGeoid, activeCountyId: row.countyId });
    setSelected(window.GRIDLY_AWARENESS_AREA_DEFINITIONS[0]);
    window.selectGridlySettingsAwarenessArea = () => { calls++; };
  });
  assert.equal(calls, 1);
  assert.equal(selected.value.canonicalPlaceGeoid, row.placeGeoid);
});

test('multi-county Baytown retains canonical PLACE while Chambers operational county converges', async () => {
  const row = artifact.itinerary.find(row => row.community === 'Baytown');
  const selected = await exerciseSelection(row);
  assert.equal(selected.value.canonicalPlaceGeoid, row.placeGeoid);
  assert.equal(selected.value.activeCountyId, 'chambers-tx');
});

test('selection invocation throw is classified and does not become a generic rejection', async () => {
  const row = artifact.itinerary[0];
  await assert.rejects(exerciseSelection(row, () => { window.selectGridlySettingsAwarenessArea = () => { throw new Error('boom'); }; }), /SELECTION_ACTION_THROW/);
});

test('missing production selection action is classified', async () => {
  const row = artifact.itinerary[0];
  await assert.rejects(exerciseSelection(row, () => { window.selectGridlySettingsAwarenessArea = undefined; }), /SELECTION_ACTION_NOT_AVAILABLE/);
});

test('selection context that never converges times out', async () => {
  const row = artifact.itinerary[0];
  await assert.rejects(exerciseSelection(row, ({ setContext }) => { window.selectGridlySettingsAwarenessArea = () => setContext({}); }), /SELECTION_CONTEXT_TIMEOUT/);
});

test('first selection blocker stops the run without attempting later rows', async () => {
  const rows = artifact.itinerary.filter(row => !row.alreadyCertifiedByOwnerEvidence).slice(0, 2);
  harness.state.cohort = artifact; harness.state.rows = rows; harness.state.results = []; harness.state.index = 0; harness.state.running = false; harness.state.stopped = false; harness.state.waiting = null;
  let calls = 0;
  const area = { key: 'tyler-tx-chester', label: rows[0].community, storageValue: rows[0].community, countyId: rows[0].countyId, placeGeoid: rows[0].placeGeoid };
  window.GRIDLY_COUNTY_REGISTRY = { [rows[0].countyId]: { consumerAwarenessAreas: [{ placeGeoid: rows[0].placeGeoid, displayName: rows[0].community, canonicalIdentity: 'PLACE_GEOID', countyMemberships: rows[0].governedMemberships }] } };
  window.GRIDLY_AWARENESS_AREA_DEFINITIONS = [area];
  window.resolveGridlyAwarenessAreaQuery = () => ({ status: 'RESOLVED_OPERATIONAL', operational: true, countyId: rows[0].countyId, awarenessArea: area });
  window.selectGridlySettingsAwarenessArea = () => { calls++; throw new Error('blocked'); };
  await harness.run();
  assert.equal(calls, 1);
  assert.equal(harness.state.results.length, 1);
  assert.equal(harness.state.stopped, true);
  assert.equal(harness.state.index, 1);
});

test('Addison and Cape Royale positive counts require current request ownership', () => {
  for (const count of [8, 1]) {
    const owned = { currentRequestOwnership: 'PROVEN', requestAttempted: true, requestSuccess: true, requestCompletedAt: 2, consumerEnvelopeRecordCount: count };
    assert.equal(harness.driveTexasState(owned), 'HEALTHY_WITH_DATA');
    assert.equal(harness.driveTexasState({ ...owned, currentRequestOwnership: 'NOT_PROVEN' }), null);
    const observed = harness.counts({ driveTexasRecordIds: Array.from({ length: count }, (_, i) => String(i)), awareness: { activeOfficialRoadwayCount: count }, driveTexasState: 'HEALTHY_WITH_DATA', official: { sourceRecordCount: count, eligibleRecordCount: count }, officialMarkerIds: Array.from({ length: count }, (_, i) => String(i)), alertsSurface: {}, alertCardIds: [] });
    assert.deepEqual([observed.driveTexasCurrentAreaCount, observed.consumerEnvelopeCount, observed.officialRoadwaySourceCount, observed.eligibleMarkerCount, observed.renderedMarkerCount], [count, count, count, count, count]);
  }
});

test('DriveTexas evidence proves matching area and generation, not count alone', () => {
  const row = { placeGeoid: '4801900', canonicalKey: 'place-4801900', countyId: 'dallas-tx' };
  const evidence = harness.driveTexasEvidence(row, { areaIdentity: 'place-4801900', requestGeneration: 7, records: Array(8).fill({}) }, { requestGeneration: 7, requestAttempted: true, requestSuccess: true, requestCompletedAt: 2 }, {}, { sourceRecordCount: 8 }, { publishedAlertCount: 8 });
  assert.equal(evidence.currentRequestOwnership, 'PROVEN');
  assert.equal(evidence.consumerEnvelopeRecordCount, 8);
  assert.equal(harness.driveTexasState(evidence), 'HEALTHY_WITH_DATA');
  assert.equal(harness.driveTexasEvidence(row, { ...evidence, areaIdentity: 'wrong', records: [{}] }, evidence, {}, {}, {}).currentRequestOwnership, 'NOT_PROVEN');
});

function manual(overrides = {}) { return { expectedExistingMarkerIdentity: 'incident-1', markerObjectIdentity: 'marker-object-1', viewportContainsMarker: false, mapCenter: [0, 0], popupOpen: false, activeCounty: 'chambers-tx', selectedAwarenessKey: 'place-4806128', canonicalPlace: '4806128', markerRegistryCount: 1, matchingMarkerCount: 1, requestGeneration: 4, ...overrides }; }
test('manual offscreen and already-visible handshakes require positive focus evidence', () => {
  assert.equal(harness.evaluateManualAction(manual(), manual({ viewportContainsMarker: true, mapCenter: [1, 1], popupOpen: true })).status, 'MANUAL_ACTION_PROVEN');
  assert.equal(harness.evaluateManualAction(manual({ viewportContainsMarker: true }), manual({ viewportContainsMarker: true, popupOpen: true })).status, 'MANUAL_ACTION_PROVEN');
});
test('continue without action, duplicates, popup loss, and county mutation are not proven', () => {
  assert.equal(harness.evaluateManualAction(manual(), manual()).evidenceClassification, 'OWNER_ACTION_NOT_PROVEN');
  assert.equal(harness.evaluateManualAction(manual(), manual({ viewportContainsMarker: true, popupOpen: true, matchingMarkerCount: 2 })).firstFalseOperand, 'noDuplicateMarker');
  assert.equal(harness.evaluateManualAction(manual(), manual({ viewportContainsMarker: true })).firstFalseOperand, 'popupOpen');
  assert.equal(harness.evaluateManualAction(manual(), manual({ viewportContainsMarker: true, popupOpen: true, activeCounty: 'harris-tx' })).firstFalseOperand, 'activeCountyUnchanged');
});
test('stale failure exports exact predecessor/current operands and first false name', () => {
  const previous = { community: 'old', canonicalPlace: '1', county: 'old-county', roadwayCounty: 'old-county', railCounty: 'old-county', driveTexasIds: [], railIds: [], alertIds: ['stale'], officialIds: [] };
  const current = { context: { awarenessAreaKey: 'new', canonicalPlaceGeoid: '2', activeCountyId: 'new-county', runtimeInventoryCounty: 'new-county' }, roadway: { loadedRoadwayCounty: 'new-county' }, driveTexasRecordIds: [], railLeafletIds: [], alertCardIds: ['stale'], officialMarkerIds: [] };
  const result = harness.compareStale(previous, current, ['cleanup']);
  assert.equal(result.firstFalseOperand, 'alertsPublication');
  assert.deepEqual(result.operands.previousAlertsIds, ['stale']);
  assert.deepEqual(result.operands.currentAlertsIds, ['stale']);
});

test('Baytown V7 control converges canonical PLACE and both operational source counties', () => {
  const row = artifact.itinerary.find(row => row.placeGeoid === '4806128');
  assert.equal(row.countyId, 'chambers-tx');
  const observation = { context: { activeCountyId: 'chambers-tx', canonicalPlaceGeoid: '4806128', runtimeInventoryCounty: 'chambers-tx' }, roadway: { loadedRoadwayCounty: 'chambers-tx', activeCountyPackageLoaded: true }, roadwayFeatureCount: 1, rail: { runtimeCrossingInventoryCount: 1 }, railPolicyIds: ['r'], railLeafletIds: ['r'], railDomIds: ['r'], driveTexasState: 'HEALTHY_EMPTY' };
  const converged = harness.settlement({ ...row, liveClassesCovered: [], roadwayState: 'ROADWAY_WITH_DATA', railState: 'ACTIVE_POSITIVE' }, observation);
  assert.deepEqual({ contextReady: converged.contextReady, roadwayReady: converged.roadwayReady, railReady: converged.railReady }, { contextReady: true, roadwayReady: true, railReady: true });
});
