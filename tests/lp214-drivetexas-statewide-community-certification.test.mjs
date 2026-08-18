import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCertification, run } from '../tools/lp214/build-drivetexas-statewide-community-certification.mjs';

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

test('committed statewide evidence is deterministic', () => assert.doesNotThrow(() => run({verify:true})));
