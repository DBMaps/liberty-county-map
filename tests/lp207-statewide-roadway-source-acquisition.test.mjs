import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { acquireOne, loadAuthorities, officialUrl, parseArguments, PILOT_FIPS, requiredMembers, run, selectRequests, sourceFilename, validateZipBytes } from '../tools/lp207/acquire-tiger2025-roadway-source.mjs';

const authorities = await loadAuthorities();
const zip = (fips, omit) => Buffer.from(zipSync(Object.fromEntries(requiredMembers(fips).filter(name => name !== omit).map(name => [name, strToU8(`fixture:${name}`)]))));

test('frozen LP206 cohort and pilot identities are authoritative', () => {
  assert.equal(authorities.cohort.missingRoadwayCountyCount, 226);
  assert.deepEqual(selectRequests(authorities, PILOT_FIPS).map(item => item.countyName), ['Lee', 'Milam', 'Robertson']);
  assert.throws(() => selectRequests(authorities, ['48201']), /Protected existing/);
  assert.throws(() => selectRequests(authorities, ['49001']), /match/);
  assert.throws(() => selectRequests(authorities, ['48abc']), /match/);
  assert.throws(() => selectRequests(authorities, ['48287', '48287']), /Duplicate/);
});

test('official Census identity construction and what-if are deterministic', async () => {
  assert.equal(sourceFilename('48287'), 'tl_2025_48287_roads.zip');
  assert.equal(officialUrl('48287'), 'https://www2.census.gov/geo/tiger/TIGER2025/ROADS/tl_2025_48287_roads.zip');
  const result = await run({ whatif: true, fips: '48287' });
  assert.equal(result.results[0].status, 'WHATIF');
  assert.equal(result.results[0].requestedUrl, officialUrl('48287'));
  assert.throws(() => parseArguments(['--all-missing', '--acquire']), /disabled/);
});

test('ZIP central directory, members, vintage, FIPS, and hashing fail closed', async t => {
  assert.equal(validateZipBytes(zip('48287'), '48287').requiredMembersPresent, true);
  assert.throws(() => validateZipBytes(Buffer.from('not zip'), '48287'), /Corrupt/);
  assert.throws(() => validateZipBytes(zip('48287', 'tl_2025_48287_roads.cpg'), '48287'), /Missing required/);
  assert.throws(() => validateZipBytes(zip('48331'), '48287'), /identity mismatch/i);
  const root = await mkdtemp(join(tmpdir(), 'lp207-')); t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, sourceFilename('48287')); const original = zip('48287'); await writeFile(path, original);
  const result = await run({ verify: true, fips: '48287', destination: root });
  assert.equal(result.results[0].status, 'EXISTING_VALID_SOURCE');
  assert.equal(result.results[0].sha256.length, 64);
  assert.deepEqual(await readFile(path), original);
});

test('existing invalid and wrong-FIPS files are never overwritten', async t => {
  const root = await mkdtemp(join(tmpdir(), 'lp207-')); t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, sourceFilename('48287')); await writeFile(path, 'invalid');
  let calls = 0; const invalid = await acquireOne(root, selectRequests(authorities, ['48287'])[0], { fetchImpl: async () => { calls += 1; } });
  assert.equal(invalid.status, 'EXISTING_INVALID_SOURCE'); assert.equal(calls, 0); assert.equal(await readFile(path, 'utf8'), 'invalid');
  await writeFile(path, zip('48331')); const wrong = await acquireOne(root, selectRequests(authorities, ['48287'])[0]);
  assert.equal(wrong.status, 'SOURCE_IDENTITY_MISMATCH'); assert.deepEqual(await readFile(path), zip('48331'));
});

test('unexpected redirects, failed HTTP, corrupt payloads, and missing members leave no final artifact', async t => {
  const county = selectRequests(authorities, ['48287'])[0];
  for (const [name, response, reason] of [
    ['redirect', new Response(null, { status: 302, headers: { location: 'https://example.com/evil.zip' } }), /unexpected host/],
    ['http', new Response('no', { status: 503 }), /HTTP 503/],
    ['corrupt', new Response('not zip', { status: 200, headers: { 'content-type': 'application/zip' } }), /Corrupt/],
    ['member', new Response(zip('48287', 'tl_2025_48287_roads.shx'), { status: 200, headers: { 'content-type': 'application/zip' } }), /Missing required/]
  ]) {
    const root = await mkdtemp(join(tmpdir(), `lp207-${name}-`)); t.after(() => rm(root, { recursive: true, force: true }));
    const result = await acquireOne(root, county, { fetchImpl: async () => response });
    assert.equal(result.status, 'ACQUISITION_FAILED'); assert.match(result.failureReason, reason);
    await assert.rejects(stat(join(root, sourceFilename('48287'))), /ENOENT/);
  }
});

test('valid acquisition uses temporary validation and atomic final promotion', async t => {
  const root = await mkdtemp(join(tmpdir(), 'lp207-valid-')); t.after(() => rm(root, { recursive: true, force: true }));
  const body = zip('48287'); const result = await acquireOne(root, selectRequests(authorities, ['48287'])[0], { fetchImpl: async () => new Response(body, { status: 200, headers: { 'content-type': 'application/zip' } }) });
  assert.equal(result.status, 'ACQUIRED_NEW_SOURCE'); assert.equal(result.downloaded, true); assert.deepEqual(await readFile(join(root, sourceFilename('48287'))), body);
});

test('production runtime remains exactly the LP206 governed 28 and pilot remains inactive', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/roadway-runtime-manifest.json', import.meta.url)));
  const cohort = authorities.cohort;
  assert.equal(cohort.existingRuntimeRoadwayCountyCount, 28);
  assert.equal(cohort.existingRuntimeCounties.length, 28);
  assert.ok(PILOT_FIPS.every(fips => !cohort.existingRuntimeCounties.some(item => item.countyFips === fips)));
  assert.ok(manifest);
});
