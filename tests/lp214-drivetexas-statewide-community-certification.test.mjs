import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCertification, canonicalRepositoryPath, run } from '../tools/lp214/build-drivetexas-statewide-community-certification.mjs';

const certificationPath = 'data/generated/lp214-drivetexas-statewide-community-certification.json';

test('all canonical communities satisfy the shared DriveTexas radius and geometry contract', () => {
  const artifact = buildCertification();
  assert.equal(artifact.summary.countyCount, 254);
  assert.equal(artifact.summary.communityCount, 1859);
  assert.equal(artifact.summary.membershipCount, 2058);
  assert.equal(artifact.summary.multiCountyCommunityCount, 163);
  assert.equal(artifact.summary.explicitRadiusCount, 0);
  assert.equal(artifact.summary.defaultRadiusCount, 1859);
  assert.equal(artifact.summary.invalidFocusCount, 0);
  assert.equal(artifact.summary.invalidRadiusCount, 0);
  assert.equal(artifact.summary.authorityFailureCount, 0);
  assert.equal(artifact.summary.radiusPropagationFailureCount, 0);
  for (const total of Object.values(artifact.summary.syntheticCheckTotals)) assert.equal(total, 1859);
  assert.deepEqual(artifact.controls.dallas.memberCountyFips, ['48085','48113','48121','48257','48397']);
  assert.deepEqual(artifact.controls.houston.memberCountyFips, ['48157','48201','48339','48473']);
  assert.equal(artifact.communities.some(row => row.communitySpecificOverride), false);
});

test('artifact metadata paths are canonical and platform-independent', () => {
  const artifact = buildCertification();
  assert.deepEqual(artifact.generatedFrom, [
    'data/generated/lp214-county-community-inventory.json',
    'data/generated/gridly-statewide-place-presentation-v1.json'
  ]);
  assert.equal(artifact.generatedFrom.some(file => file.includes('\\')), false);
  assert.equal(
    canonicalRepositoryPath('data\\generated\\lp214-county-community-inventory.json'),
    'data/generated/lp214-county-community-inventory.json'
  );
});

test('committed statewide evidence is byte-for-byte deterministic', () => {
  const expected = Buffer.from(`${JSON.stringify(buildCertification(), null, 2)}\n`);
  assert.equal(fs.readFileSync(certificationPath).equals(expected), true);
  assert.doesNotThrow(() => run({verify:true}));
});
