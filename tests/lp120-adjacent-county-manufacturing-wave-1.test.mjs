import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const evidence = JSON.parse(await readFile(new URL('../evidence/lp120/adjacent-county-manufacturing-wave-1-readiness.json', import.meta.url)));

test('LP120 records all three independently governed counties', () => {
  assert.deepEqual(evidence.counties.map(({ fips }) => fips), ['48287', '48331', '48395']);
  assert.deepEqual(evidence.counties.map(({ county }) => county), ['Lee County', 'Milam County', 'Robertson County']);
  assert.equal(new Set(evidence.counties.map(({ fips }) => fips)).size, 3);
});

test('LP120 preflights every required authoritative source family', () => {
  const required = ['txgioAddresses', 'fraCrossings', 'tiger2025Roadways', 'countyBoundary', 'zipCoverage'];
  for (const county of evidence.counties) {
    assert.deepEqual(Object.keys(county.sourcePreflight), required);
    for (const source of Object.values(county.sourcePreflight)) {
      assert.ok(['PASS', 'FAIL', 'BLOCKED', 'SOURCE_UNAVAILABLE', 'NOT_RUN'].includes(source.status));
    }
  }
});

test('LP120 preserves candidate and production boundaries', () => {
  assert.equal(evidence.candidateOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.productionAuthorization, false);
  for (const county of evidence.counties) {
    assert.equal(county.assets.candidateRuntimeIdentity.activated, false);
    assert.equal(county.assets.candidateRuntimeIdentity.productionAuthorization, false);
    assert.equal(county.assets.promotion.productionAuthorization, 'BLOCKED');
  }
});

test('LP120 does not convert human review gates into automated approval', () => {
  for (const county of evidence.counties) {
    assert.equal(county.assets.communities.status, 'REVIEW_REQUIRED');
    assert.equal(county.assets.curatedDestinations.status, 'REVIEW_REQUIRED');
    assert.equal(county.assets.searchCoverage.status, 'REVIEW_REQUIRED');
    assert.equal(county.assets.promotion.status, 'REVIEW_REQUIRED');
  }
});

test('LP120 reports authentic crossing and ZIP candidate counts independently', () => {
  const expected = {
    48287: { crossings: 47, zips: 11 },
    48331: { crossings: 110, zips: 3 },
    48395: { crossings: 169, zips: 4 }
  };
  for (const county of evidence.counties) {
    assert.equal(county.assets.crossings.status, 'PASS');
    assert.equal(county.assets.crossings.certification, 'PASS');
    assert.equal(county.assets.crossings.candidateRecordCount, expected[county.fips].crossings);
    assert.equal(county.assets.zipCoverage.recordCount, expected[county.fips].zips);
    assert.equal(county.readiness.status, 'BLOCKED');
  }
});
