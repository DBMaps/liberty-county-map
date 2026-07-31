import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { manufacture, parseArguments, selectCounties, sha256File } from '../tools/lp1051/manufacture-gridly-28-address-counties.mjs';

const canonical = JSON.parse(await readFile('data/lp104/texas-counties.json', 'utf8'));
const productionManifest = 'data/generated/lp104/txgio-addresses/runtime-manifest.json';
const licensingManifest = 'data/lp104/source-license-manifest.json';

test('manufactures the deterministic current cohort while preserving governance and continuing failures', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lp1051-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packageDirectory = join(directory, 'packages');
  const reports = join(directory, 'reports');
  const counties = selectCounties(canonical, parseArguments([]));
  assert.equal(counties.length, 28);
  assert.deepEqual(counties.map(item => item.fips), counties.map(item => item.fips).sort());
  assert.ok(counties.some(item => item.fips === '48291'), 'Liberty belongs to initial28');

  const productionBefore = await sha256File(productionManifest);
  const licensingBefore = await sha256File(licensingManifest);
  const buildCalls = [];
  const certificationCalls = [];
  const liberty = counties.find(item => item.fips === '48291');
  const libertyBody = gzipSync(`${JSON.stringify({ i: 'liberty', h: '1', r: 'Main', f: liberty.fips, x: -95, y: 30 })}\n`);
  const libertyPath = join(packageDirectory, `${liberty.countyId}-${liberty.fips}.addresses.jsonl.gz`);
  await import('node:fs/promises').then(({ mkdir }) => mkdir(packageDirectory, { recursive: true }));
  await writeFile(libertyPath, libertyBody);
  await writeFile(`${libertyPath}.json`, JSON.stringify({ packageHash: createHash('sha256').update(libertyBody).digest('hex') }));

  const failedFips = counties.find(item => item.fips !== liberty.fips).fips;
  const runBuilder = async options => {
    buildCalls.push(options);
    if (options.fips === failedFips) throw new Error('fixture county extraction failed');
    const county = counties.find(item => item.fips === options.fips);
    const path = join(packageDirectory, `${county.countyId}-${county.fips}.addresses.jsonl.gz`);
    let body;
    if (county.fips === liberty.fips) body = await readFile(path);
    else {
      body = gzipSync(`${JSON.stringify({ i: county.fips, h: '1', r: 'Main', f: county.fips, x: -95, y: 30 })}\n`);
      await writeFile(path, body);
      await writeFile(`${path}.json`, JSON.stringify({ packageHash: createHash('sha256').update(body).digest('hex') }));
    }
    return { packages: [{ fips: county.fips, outputBytes: body.length, packageHash: createHash('sha256').update(body).digest('hex') }] };
  };
  const certifyCountyPackage = async ({ fips }) => {
    certificationCalls.push(fips);
    return { certificationStatus: 'PASS', indexedAddressCount: 1, runtimeLoadDurationMs: 2, failures: [] };
  };

  const { report, candidateManifestPath, reportPath } = await manufacture(
    { 'gridly-counties': true, reports, packageDirectory }, { runBuilder, certifyCountyPackage }
  );
  const candidate = JSON.parse(await readFile(candidateManifestPath, 'utf8'));
  const persistedReport = JSON.parse(await readFile(reportPath, 'utf8'));
  assert.equal(report.completedCount, 28);
  assert.equal(report.failureCount, 1);
  assert.equal(report.counties.find(item => item.fips === liberty.fips).resumedStatus, true);
  assert.deepEqual(await readFile(libertyPath), libertyBody, 'valid Liberty package bytes are preserved');
  assert.equal(buildCalls.length, 28, 'one LP104.4 call is isolated per county');
  assert.equal(certificationCalls.length, 27, 'LP104.6 runs once for every candidate after a county failure');
  assert.ok(certificationCalls.includes(counties.at(-1).fips), 'processing continued beyond the failure');
  assert.deepEqual(candidate.packages.map(item => item.fips), counties.map(item => item.fips).filter(fips => fips !== failedFips));
  assert.equal(candidate.activated, false);
  assert.equal(report.activated, false);
  assert.equal(persistedReport.counties.length, 28);
  for (const entry of candidate.packages) {
    const packagePath = join(packageDirectory, entry.path.split('/').pop());
    const certificate = JSON.parse(await readFile(join(reports, 'certificates', `${entry.countyId.replace(/-tx$/, '')}-${entry.fips}.runtime-certificate.json`)));
    assert.equal(entry.sizeBytes, (await stat(packagePath)).size);
    assert.equal(entry.sha256, await sha256File(packagePath));
    assert.equal(certificate.sizeBytes, entry.sizeBytes);
    assert.equal(certificate.sha256, entry.sha256);
    assert.equal(certificate.acceptance.interpolation, false);
  }
  assert.equal(await sha256File(productionManifest), productionBefore, 'production runtime manifest is unchanged');
  assert.equal(await sha256File(licensingManifest), licensingBefore, 'licensing governance is unchanged');
});

test('independent verification excludes builder metadata that does not match package bytes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lp1051-integrity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const county = selectCounties(canonical, { fips: '48291' })[0];
  const packageDirectory = join(directory, 'packages');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(packageDirectory, { recursive: true }));
  const runBuilder = async () => {
    const path = join(packageDirectory, `${county.countyId}-${county.fips}.addresses.jsonl.gz`);
    await writeFile(path, gzipSync('{}\n'));
    return { packages: [{ fips: county.fips, outputBytes: 1, packageHash: '0'.repeat(64) }] };
  };
  let certified = false;
  const result = await manufacture({ fips: county.fips, reports: join(directory, 'reports'), packageDirectory }, {
    runBuilder, certifyCountyPackage: async () => { certified = true; }
  });
  assert.equal(result.report.failureCount, 1);
  assert.match(result.report.counties[0].failures[0], /independent package size\/SHA-256 verification failed/);
  assert.equal(certified, false);
  assert.equal(JSON.parse(await readFile(result.candidateManifestPath)).packages.length, 0);
});
