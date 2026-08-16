import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} exists`);
  assert.notEqual(end, -1, `${nextName} exists after ${name}`);
  return source.slice(start, end);
}

function harness(countyId = 'mclennan-tx') {
  const context = {
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: {
      'liberty-tx': { runtimeSourceAvailability: { crossings: 'available' } },
      'mclennan-tx': { runtimeSourceAvailability: { crossings: 'not-claimed' } }
    },
    gridlyNormalizeCountyId: (value) => value,
    gridlyGetActiveCountyId: () => countyId,
    Object, Number, Math
  };
  vm.createContext(context);
  vm.runInContext([
    functionSource('getGridlyAwarenessCoverageState', 'classifyGridlyAwarenessTrustState'),
    functionSource('classifyGridlyAwarenessTrustState', 'getGridlyHomeCommunityPulseCopy'),
    functionSource('getGridlyHomeCommunityPulseCopy', 'gridlyCommunityPulseConsumerHeadlineAvailable')
  ].join('\n'), context);
  return context;
}

test('Waco zero evidence is governed as limited coverage, never quiet', () => {
  const api = harness();
  const coverage = api.getGridlyAwarenessCoverageState();
  const copy = api.getGridlyHomeCommunityPulseCopy({ quiet: true, activeCount: 0, coverage });
  assert.equal(api.classifyGridlyAwarenessTrustState({ activeCount: 0, coverage }), 'coverage_limited');
  assert.equal(copy.headline, 'Limited local coverage');
  assert.equal(copy.subline, "Crossing data isn't available for this area yet.");
  assert.doesNotMatch(`${copy.headline} ${copy.subline}`, /community is quiet|no physical crossings|not-claimed/i);
});

test('supported Liberty zero-active control retains quiet state', () => {
  const api = harness('liberty-tx');
  const coverage = api.getGridlyAwarenessCoverageState();
  assert.equal(api.classifyGridlyAwarenessTrustState({ activeCount: 0, coverage }), 'quiet');
  assert.equal(api.getGridlyHomeCommunityPulseCopy({ quiet: true, coverage }).headline, 'Community is quiet.');
});

test('active and recently-cleared evidence outrank limited coverage', () => {
  const api = harness();
  const coverage = api.getGridlyAwarenessCoverageState();
  assert.equal(api.classifyGridlyAwarenessTrustState({ activeCount: 1, coverage }), 'active');
  assert.equal(api.classifyGridlyAwarenessTrustState({ recentlyCleared: true, coverage }), 'recently_cleared');
  assert.equal(api.getGridlyHomeCommunityPulseCopy({ quiet: false, activeCount: 1, activityLevel: 'active', coverage }).state, 'one_issue');
});

test('filter feedback owns only the filter status surface', () => {
  const block = functionSource('updateGeoFilterStatus', 'getVisibleCrossingsForFilter');
  assert.match(block, /els\.geoFilterStatus\.textContent = message/);
  assert.doesNotMatch(block, /gridlyV2TopStatus(?:Primary|Secondary)|portraitStatus/);
  assert.match(block, /Crossing data isn't available for this area yet\./);
});
