import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const appSource = fs.readFileSync('js/app.js', 'utf8');
const authority = await import('../js/gridlyCrossingCoverageAuthority.js').then(() => globalThis.gridlyCrossingCoverageAuthority).catch(() => null)
  || (() => { const sandbox = { window: {} }; vm.createContext(sandbox); vm.runInContext(fs.readFileSync('js/gridlyCrossingCoverageAuthority.js', 'utf8'), sandbox); return sandbox.window.gridlyCrossingCoverageAuthority; })();
const production = JSON.parse(fs.readFileSync('Crossing-Packages/production-crossing-manifest.json', 'utf8'));

function functionSource(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  const end = appSource.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1); assert.notEqual(end, -1);
  return appSource.slice(start, end);
}

const sandbox = {
  window: { gridlyCrossingCoverageAuthority: authority }, Object, Number, Math,
  GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx', GRIDLY_COUNTY_REGISTRY: {},
  gridlyNormalizeCountyId: value => value,
  gridlyGetActiveCountyId: () => 'liberty-tx'
};
vm.createContext(sandbox);
vm.runInContext([
  functionSource('getGridlyAwarenessCoverageState', 'gridlyCrossingCoverageStatusAudit'),
  functionSource('classifyGridlyAwarenessTrustState', 'getGridlyHomeCommunityPulseCopy'),
  functionSource('getGridlyHomeCommunityPulseCopy', 'gridlyCommunityPulseConsumerHeadlineAvailable')
].join('\n'), sandbox);

function classify(countyId, { awarenessCrossingCount, loading = false, failure = null, legacy = 'not-claimed' } = {}) {
  const governed = authority.resolve(countyId);
  sandbox.GRIDLY_COUNTY_REGISTRY[countyId] = { runtimeSourceAvailability: { crossings: legacy } };
  const count = governed?.governedCount ?? 0;
  return sandbox.getGridlyAwarenessCoverageState({
    countyId, governedSource: governed,
    awarenessCrossingCount: awarenessCrossingCount ?? (count ? 1 : 0),
    runtimeState: {
      runtimeInventoryCounty: loading ? null : countyId,
      inventoryOwnerMatchesActiveCounty: !loading,
      inventoryHydrationCompleted: !loading && !failure,
      inventoryHydrationFailureReason: failure,
      inventoryHydrationState: failure ? 'failed' : loading ? 'loading' : count ? 'loaded_positive' : 'loaded_intentional_zero',
      crossingInventoryCount: failure || loading ? 0 : count
    }
  });
}

test('positive controls are governed healthy without legacy authority', () => {
  for (const id of ['grayson-tx', 'dallas-tx', 'el-paso-tx', 'mclennan-tx', 'smith-tx', 'liberty-tx']) {
    const coverage = classify(id, { legacy: id === 'liberty-tx' ? 'missing' : 'not-claimed' });
    assert.equal(coverage.semanticCoverageState, 'AVAILABLE_WITH_CROSSINGS', id);
    assert.equal(coverage.state, 'available');
    assert.equal(coverage.legacyAuthorityUsed, false);
  }
});

test('ACTIVE_EMPTY controls are healthy intentional owned zero', () => {
  for (const id of ['andrews-tx', 'archer-tx', 'bandera-tx']) {
    const coverage = classify(id);
    assert.equal(coverage.governedState, 'ACTIVE_EMPTY');
    assert.equal(coverage.semanticCoverageState, 'AVAILABLE_NO_GOVERNED_CROSSINGS');
    assert.doesNotMatch(coverage.secondary, /isn't available/);
  }
});

test('local zero, startup, failure, and unsupported states remain distinct', () => {
  assert.equal(classify('dallas-tx', { awarenessCrossingCount: 0 }).semanticCoverageState, 'AVAILABLE_NO_LOCAL_CROSSINGS');
  assert.equal(classify('dallas-tx', { loading: true }).semanticCoverageState, 'LOADING');
  const failed = classify('dallas-tx', { failure: 'simulated fetch failure' });
  assert.equal(failed.semanticCoverageState, 'TEMPORARILY_UNAVAILABLE');
  assert.equal(failed.secondary, 'Crossing information is temporarily unavailable');
  const unsupported = sandbox.getGridlyAwarenessCoverageState({ countyId: 'unsupported-tx', governedSource: null, awarenessCrossingCount: 0, runtimeState: {} });
  assert.equal(unsupported.semanticCoverageState, 'UNAVAILABLE');
});

test('all 254 counties classify through governed authority with zero false unavailable', () => {
  const entries = authority.entries();
  assert.equal(entries.length, 254);
  assert.equal(production.records.length, 254);
  const positives = entries.filter(record => record.state === 'ACTIVE_POSITIVE');
  const empties = entries.filter(record => record.state === 'ACTIVE_EMPTY');
  assert.equal(positives.length, 202); assert.equal(empties.length, 52);
  assert.equal(entries.reduce((sum, record) => sum + record.governedCount, 0), 16099);
  const productionByCounty = new Map(production.records.map(record => [String(record.county).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-tx', record.crossingCount]));
  for (const record of entries) assert.equal(record.governedCount, productionByCounty.get(record.countyId), record.countyId);
  assert.equal(positives.filter(record => classify(record.countyId).state !== 'available').length, 0);
  assert.equal(empties.filter(record => classify(record.countyId).state !== 'available').length, 0);
});

test('Liberty to Sherman to Dallas to empty to Tyler refreshes semantic ownership', () => {
  const ids = ['liberty-tx', 'grayson-tx', 'dallas-tx', 'andrews-tx', 'smith-tx'];
  assert.deepEqual(ids.map(id => classify(id).semanticCoverageState), [
    'AVAILABLE_WITH_CROSSINGS', 'AVAILABLE_WITH_CROSSINGS', 'AVAILABLE_WITH_CROSSINGS',
    'AVAILABLE_NO_GOVERNED_CROSSINGS', 'AVAILABLE_WITH_CROSSINGS'
  ]);
});

test('healthy coverage preserves awareness-first quiet banner precedence', () => {
  const coverage = classify('grayson-tx');
  assert.equal(sandbox.classifyGridlyAwarenessTrustState({ coverage }), 'quiet');
  assert.equal(sandbox.getGridlyHomeCommunityPulseCopy({ quiet: true, coverage }).headline, 'Community is quiet.');
});

test('production coverage decision has no county special cases or legacy decision authority', () => {
  const block = functionSource('getGridlyAwarenessCoverageState', 'gridlyCrossingCoverageStatusAudit');
  assert.doesNotMatch(block, /runtimeSourceAvailability|localCrossingsPath|crossingsPath/);
  assert.doesNotMatch(block, /sherman|grayson|dallas|liberty/i);
});
