import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildReports, writeReports } from '../tools/lp145/analyze-statewide-operational-constraints.mjs';

const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url)));
const sha = async path => createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex');

test('LP145 outputs are deterministic, checked in, and stably dependency-ordered', async () => {
  await writeReports({ verify: true });
  const first = JSON.stringify(buildReports()); const second = JSON.stringify(buildReports());
  assert.equal(first, second);
  const report = await json('reports/lp145/statewide-operational-constraint-analysis.json');
  assert.deepEqual(report.dependencyChain.map(row => row.order), [1,2,3,4,5,6,7,8]);
  assert.equal(report.firstRemainingBlockingNode, 'Storage');
  assert.deepEqual(report.constraints.map(row => row.dependencyOrder), [3,4,5,6,7]);
});

test('readiness uses only the governed classification vocabulary and stable category order', async () => {
  const report = await json('reports/lp145/statewide-expansion-readiness.json');
  assert.deepEqual(report.categories.map(row => row.category), ['manufacturing readiness','certification readiness','runtime readiness','storage readiness','geometry readiness','membership readiness','deployment readiness','governance readiness']);
  assert.ok(report.categories.every(row => report.classifications.includes(row.classification)));
  assert.equal(report.overallClassification, 'BLOCKED');
});

test('LP145 performs no runtime, geometry, membership, planner, or deployment change', async () => {
  const protectedHashes = {
    'js/app.js': '57a11cbedf834ba9a104e5ee0f96bb9976fbf94e89ebdc1d5e29452e981f019f',
    'supabase/functions/_shared/certified-address-identities.mjs': '66a94a8067c904daf03d1b8a9fedeee8590b67dbb3f04cdedac28e6f200af183',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json': 'ba0e44fbaf1a396909f7aad98ace7d55a20f86a23ca9352c980f39116ed32461',
    'evidence/lp138/county-geometry-membership-contract.baseline.json': '717c25ab4aa80a282d49899cd8d33d0fe6f82305ced68c0d167cf5f3d1168847',
    'evidence/lp138/county-geometry-membership-contract.draft.json': '0fda01a72ff3935e27a675849c5213a81cd3ae5a074d5e81ec15799616aa9047',
    'evidence/lp140/activation-wave-planning.json': '12c1fe4a98850344c9663ce06078ae4e60600ad08bacc4465570fa97f5a86881'
  };
  for (const [path, expected] of Object.entries(protectedHashes)) assert.equal(await sha(path), expected, path);
  assert.doesNotMatch(writeReports.toString(), /fetch\s*\(|deploy|activate|supabase|storageUpload/);
});
