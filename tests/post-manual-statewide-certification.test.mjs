import assert from 'node:assert/strict';
import test from 'node:test';
import { build, run } from '../tools/statewide-audit/build-post-manual-statewide-certification.mjs';

test('post-manual certification conserves statewide governed inventory without synthetic browser passes', () => {
  const result = build();
  assert.deepEqual(result.statewideCounts, { counties: 254, canonicalCommunities: 1859, memberships: 2058, multiCountyIdentities: 163 });
  assert.equal(result.memberships.length, 2058);
  assert.equal(result.contracts.length, 15);
  assert.equal(result.contracts.find(c => c.id === 'B').failed, 0);
  assert.equal(result.contracts.find(c => c.id === 'F').failed, 0);
  for (const item of result.contracts.filter(c => c.status === 'REQUIRES OWNER BROWSER ACCEPTANCE')) assert.equal(item.passed, 0);
});

test('multi-county and Val Verde findings retain manual evidence without extrapolation', () => {
  const result = build();
  assert.equal(result.downstreamCountyConvergence.staticModel.identitiesPassed, 163);
  assert.equal(result.downstreamCountyConvergence.observedFailures.length, 2);
  assert.equal(result.valVerdeCountywide.governedCommunityCount, 7);
  assert.equal(result.valVerdeCountywide.communities.filter(c => c.manualEvidence.length).length, 6);
  assert.equal(result.crossingCountFindings.observedFailures.length, 2);
  assert.equal(result.officialRoadwaySubtypes.observedFailures[0].subtype, 'Travel Advisory');
});

test('checked-in JSON, CSV, and summary are deterministic', () => {
  assert.doesNotThrow(() => run({ verify: true }));
});
