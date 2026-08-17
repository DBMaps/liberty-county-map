import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync } from 'fflate';
import { acquireOne, loadAuthorities, officialUrl, requiredMembers, selectRequests, sourceFilename, validateZipBytes } from '../tools/lp207/acquire-tiger2025-roadway-source.mjs';
import { execute, inventory } from '../tools/lp208/statewide-tiger2025-roadway-source.mjs';

const zip = (fips, omit = null) => Buffer.from(zipSync(Object.fromEntries(requiredMembers(fips).filter(x => !x.endsWith(`.${omit}`)).map(x => [x, new Uint8Array([1, 2, 3])]))));
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, statusText: status === 200 ? 'OK' : 'Nope', headers: new Headers({ 'content-type': 'application/zip' }), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) });

test('LP208 conserves frozen cohorts, URLs, pilots, and production safety', async () => {
  const before = await readFile('data/roadway-runtime-manifest.json');
  const inv = await inventory();
  assert.equal(inv.authorities.inventory.count, 254);
  assert.equal(inv.counties.length, 226);
  assert.equal(inv.authorities.cohort.existingRuntimeCounties.length, 28);
  assert.equal(inv.overlap, 0);
  assert.equal(inv.duplicateFips, 0);
  assert.equal(inv.duplicateUrls, 0);
  assert.equal(new Set(inv.counties.map(x => officialUrl(x.countyFips))).size, 226);
  assert.equal(officialUrl('48113'), 'https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48113_roads.zip');
  const result = await execute({ mode: 'whatif', sourceRoot: join(tmpdir(), 'lp208-owner-not-mounted') });
  assert.equal(result.manifest.length, 226);
  assert.equal(result.acquisition.existingValidAtStart, 3);
  assert.equal(result.acquisition.acquisitionRequiredAtStart, 223);
  assert.equal(result.acquisition.supabaseWrites, 0);
  assert.equal(result.acquisition.runtimeActivations, 0);
  assert.equal(result.acquisition.roadwayPackagesManufactured, 0);
  assert.equal(result.acquisition.productionRuntimeManifest.unchanged, true);
  assert.deepEqual(await readFile('data/roadway-runtime-manifest.json'), before);
});

test('existing valid source skips without overwrite and records SHA-256', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp208-'));
  try {
    const authorities = await loadAuthorities(); const county = selectRequests(authorities, ['48287'])[0]; const body = zip('48287');
    const path = join(root, sourceFilename('48287')); await writeFile(path, body);
    const result = await acquireOne(root, county, { fetchImpl: async () => { throw new Error('must not download'); } });
    assert.equal(result.status, 'EXISTING_VALID_SOURCE'); assert.equal(result.sha256.length, 64); assert.deepEqual(await readFile(path), body);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid existing source fails closed without replacement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp208-'));
  try {
    const county = selectRequests(await loadAuthorities(), ['48287'])[0]; const path = join(root, sourceFilename('48287')); await writeFile(path, 'bad');
    const result = await acquireOne(root, county, { fetchImpl: async () => response(zip('48287')) });
    assert.equal(result.status, 'EXISTING_INVALID_SOURCE'); assert.equal((await readFile(path, 'utf8')), 'bad');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed HTTP and corrupt ZIP leave no final or temporary source', async () => {
  for (const fetchImpl of [async () => response(Buffer.alloc(0), 404), async () => response(Buffer.from('not zip'))]) {
    const root = await mkdtemp(join(tmpdir(), 'lp208-'));
    try {
      const county = selectRequests(await loadAuthorities(), ['48287'])[0]; const result = await acquireOne(root, county, { fetchImpl });
      assert.equal(result.status, 'ACQUISITION_FAILED');
      await assert.rejects(readFile(join(root, sourceFilename('48287'))));
      assert.deepEqual(await readdir(root), []);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});

test('ZIP contract rejects corrupt, wrong-FIPS, and missing members', () => {
  assert.throws(() => validateZipBytes(Buffer.from('bad'), '48287'), /Corrupt/);
  assert.throws(() => validateZipBytes(zip('48331'), '48287'), /identity mismatch/i);
  assert.throws(() => validateZipBytes(zip('48287', 'cpg'), '48287'), /Missing required ZIP members/);
  assert.equal(validateZipBytes(zip('48287'), '48287').requiredMembersPresent, true);
});

test('protected existing-28 county is rejected', async () => {
  const authorities = await loadAuthorities();
  assert.throws(() => selectRequests(authorities, ['48015']), /Protected existing runtime/);
});
