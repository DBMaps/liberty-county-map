import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { manufacture, selectCounties } from '../tools/lp117/manufacture-county-assets.mjs';

const inventory = JSON.parse(await readFile(new URL('../data/lp104/texas-counties.json', import.meta.url)));

test('arbitrary maintained FIPS selection rejects invalid and duplicate input', () => {
  assert.deepEqual(selectCounties(inventory, '48051,48455,48469').map(x => x.fips), ['48051', '48455', '48469']);
  assert.throws(() => selectCounties(inventory, '99999'), /five-digit Texas/);
  assert.throws(() => selectCounties(inventory, '48051,48051'), /Duplicate/);
});

test('authentic checked-in boundaries and ZIP evidence create inactive deterministic candidates', async () => {
  const one = await mkdtemp(join(tmpdir(), 'lp117-a-'));
  const two = await mkdtemp(join(tmpdir(), 'lp117-b-'));
  const a = await manufacture({ fips: '48051,48455,48469', reports: one });
  const b = await manufacture({ fips: '48051,48455,48469', reports: two });
  assert.equal(a.counties.length, 3);
  assert.equal(a.productionAuthorized, false);
  assert.equal(a.uploadEnabled, false);
  for (const county of a.counties) {
    assert.equal(county.boundary.status, 'GENERATED');
    assert.equal(county.boundary.containment, true);
    assert.equal(county.roadwaySource.status, 'REQUIRES_OWNER_SOURCE');
    assert.equal(county.communities.status, 'REVIEW_REQUIRED');
    assert.equal(county.communities.inventedRecords, 0);
    assert.ok(['GENERATED', 'REQUIRES_OWNER_SOURCE'].includes(county.zipCoverage.status));
    assert.equal(county.curatedDestinations.status, 'REVIEW_REQUIRED');
    assert.equal(county.searchCoverage.status, 'REVIEW_REQUIRED');
  }
  assert.deepEqual(a.counties.map(x => [x.fips, x.bounds, x.zipCoverage.recordCount]), b.counties.map(x => [x.fips, x.bounds, x.zipCoverage.recordCount]));
  const trinity = JSON.parse(await readFile(join(one, '48455/zip-coverage.candidate.json')));
  assert.equal(trinity.records.every(x => Array.isArray(x.countyRelationships)), true);
});

test('resume changes status without authorizing or activating candidates', async () => {
  const reports = await mkdtemp(join(tmpdir(), 'lp117-resume-'));
  await manufacture({ fips: '48051', reports });
  const resumed = await manufacture({ fips: '48051', reports, resume: true });
  assert.equal(resumed.counties[0].boundary.status, 'RESUMED');
  assert.equal(resumed.activated, false);
  assert.equal(resumed.deploymentEnabled, false);
});
