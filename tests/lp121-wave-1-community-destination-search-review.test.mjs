import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const review = JSON.parse(await readFile(new URL('../evidence/lp121/wave-1-community-destination-search-review.json', import.meta.url)));
const lp120 = JSON.parse(await readFile(new URL('../evidence/lp120/adjacent-county-manufacturing-wave-1-readiness.json', import.meta.url)));
const zipSource = JSON.parse(await readFile(new URL('../data/generated/gridly-zip-county-source-v1.json', import.meta.url)));
const zipCandidates = JSON.parse(await readFile(new URL('../data/generated/gridly-zip-awareness-candidates-v1.json', import.meta.url)));
const fips = ['48287', '48331', '48395'];

test('LP121 reviews exactly the LP120 Wave 1 counties', () => {
  assert.deepEqual(review.counties.map(({ fips }) => fips), fips);
  assert.deepEqual(review.counties.map(({ fips }) => fips), lp120.counties.map(({ fips }) => fips));
});

test('LP121 preserves review-only and production boundaries', () => {
  assert.equal(review.reviewOnly, true);
  assert.equal(review.candidateOnly, true);
  assert.equal(review.productionChanged, false);
  assert.equal(review.productionAuthorization, false);
  assert.equal(review.candidateApproval, false);
  assert.equal(review.productionRecommendation, 'DO_NOT_AUTHORIZE');
});

test('LP121 does not turn missing human evidence into approval', () => {
  for (const county of review.counties) {
    assert.equal(county.communityReview.status, 'REVIEW_REQUIRED');
    assert.equal(county.communityReview.candidateRecordCount, 0);
    assert.equal(county.destinationReview.status, 'REVIEW_REQUIRED');
    assert.equal(county.destinationReview.candidateRecordCount, 0);
    assert.equal(county.searchReview.status, 'REVIEW_REQUIRED');
    assert.equal(county.searchReview.candidateRecordCount, 0);
    assert.deepEqual(county.readiness, { status: 'REVIEW_REQUIRED', approved: false, productionReady: false });
  }
});

test('LP121 ZIP findings reconcile with authentic project evidence', () => {
  for (const county of review.counties) {
    const records = zipSource.records.filter((record) => record.countyFips === county.fips);
    assert.equal(records.length, county.zipReview.relationshipCount);
    assert.equal(lp120.counties.find(({ fips }) => fips === county.fips).assets.zipCoverage.recordCount, records.length);
    assert.equal(records.filter(({ zip }) => zipSource.records.some((other) => other.zip === zip && other.countyFips !== county.fips)).length, county.zipReview.ambiguousRelationshipCount);
    assert.equal(records.every((record) => Boolean(record.countyId && record.countyName)), county.zipReview.countyIdentityComplete);
    for (const record of records) {
      const candidate = zipCandidates.records.find(({ zip }) => zip === record.zip);
      assert.ok(candidate, `missing ZIP awareness candidate ${record.zip}`);
      assert.equal(candidate.communityKey, null);
      assert.equal(candidate.communityLabel, null);
      assert.equal(candidate.governanceRequired, true);
    }
  }
});
