import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const evidence = JSON.parse(await readFile(new URL('../evidence/lp122/wave-1-authoritative-community-destination-evidence.json', import.meta.url)));
const expected = [
  ['Lee County', '48287', 'Giddings'],
  ['Milam County', '48331', 'Cameron'],
  ['Robertson County', '48395', 'Franklin'],
];

test('LP122 is limited to the governed Wave 1 counties', () => {
  assert.deepEqual(evidence.counties.map(({ county, fips }) => [county, fips]), expected.map(([county, fips]) => [county, fips]));
});

test('every accepted record has authoritative provenance and county containment', () => {
  const sources = new Map(evidence.sources.map((source) => [source.sourceId, source]));
  for (const [index, county] of evidence.counties.entries()) {
    for (const record of [...county.communityEvidence, ...county.destinationEvidence]) {
      const source = sources.get(record.sourceId);
      assert.ok(source, `missing source ${record.sourceId}`);
      assert.equal(source.authority, 'COUNTY_GOVERNMENT');
      assert.match(source.url, /^https:\/\/www\.co\.[a-z-]+\.tx\.us\/$/);
      assert.equal(record.containment, `${county.county}, Texas`);
      assert.equal(record.confidence, 'HIGH');
      assert.equal(record.reviewStatus, 'EVIDENCE_ACCEPTED');
      assert.ok(record.evidenceDate || record.observedOn);
    }
    assert.equal(county.communityEvidence[0].name, expected[index][2]);
    assert.match(county.destinationEvidence[0].address, new RegExp(`, ${expected[index][2]}, TX \\d{5}$`));
  }
});

test('unsupported scope remains explicitly unresolved', () => {
  for (const county of evidence.counties) {
    assert.ok(county.unresolved.length > 0);
    assert.deepEqual(county.readiness, { status: 'REVIEW_REQUIRED', approved: false, productionReady: false });
    assert.deepEqual(county.communityEvidence[0].aliases, []);
  }
  assert.equal(evidence.searchReviewPreparation.aliasesAccepted, 0);
  assert.equal(evidence.searchReviewPreparation.zipAssignmentsCertified, 0);
});

test('LP122 preserves candidate and production boundaries', () => {
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.candidateOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.productionAuthorization, false);
  assert.equal(evidence.candidateApproval, false);
  assert.equal(evidence.searchReviewPreparation.runtimeModified, false);
  assert.equal(evidence.productionRecommendation, 'DO_NOT_AUTHORIZE');
});
