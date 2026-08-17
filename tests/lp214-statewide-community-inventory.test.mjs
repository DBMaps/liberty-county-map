import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInventory, run, validateInventory } from '../tools/lp214/build-statewide-community-inventory.mjs';

test('builds the deterministic 254-county governed identity inventory', () => {
  const first = buildInventory();
  const second = buildInventory();
  assert.deepEqual(first, second);
  assert.deepEqual(first.summary, {
    countyCount: 254, uniqueCanonicalCommunityCount: 1859,
    countyCommunityMembershipCount: 2058, singleCountyCommunityCount: 1696,
    multiCountyCommunityCount: 163, placeCommunityCount: 1859,
    otherGovernedCommunityCount: 0, unresolvedCount: 0, ownerReviewRequiredCount: 0
  });
  assert.equal(first.counties.filter(county => county.communityCount === 0).length, 0);
});

test('preserves one canonical Dallas identity across all five member counties', () => {
  const artifact = buildInventory();
  const occurrences = artifact.counties.flatMap(county => county.communities.filter(row => row.placeGeoid === '4819000'));
  assert.equal(occurrences.length, 5);
  assert.equal(new Set(occurrences.map(row => row.canonicalKey)).size, 1);
  assert.deepEqual(occurrences[0].memberCountyFips, ['48085', '48113', '48121', '48257', '48397']);
});

test('fails closed for label identity, conflicting identity, membership, and ordering defects', () => {
  for (const defect of ['label', 'conflict', 'membership', 'ordering']) {
    const artifact = structuredClone(buildInventory());
    if (defect === 'label') artifact.counties[0].communities[0].canonicalKey = artifact.counties[0].communities[0].consumerLabel;
    if (defect === 'conflict') artifact.counties.find(county => county.countyFips === '48113').communities.find(row => row.placeGeoid === '4819000').consumerLabel = 'Conflict';
    if (defect === 'membership') artifact.counties[0].communities[0].memberCountyFips = ['48999'];
    if (defect === 'ordering') artifact.counties.reverse();
    assert.throws(() => validateInventory(artifact), /LP214 statewide community inventory/);
  }
});

test('--verify contract matches the checked-in deterministic artifact', () => {
  assert.doesNotThrow(() => run({ verify: true }));
});
