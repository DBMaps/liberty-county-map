import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PACKAGE_DIRECTORY, atomicWrite, certificateFor, run, selectGovernedCounties, serializeJson, stablePackageDigest,
  validateRuntimeCertificate
} from '../tools/lp107/generate-runtime-certificates.mjs';

const countyManifest = JSON.parse(await readFile(new URL('../data/lp104/texas-counties.json', import.meta.url), 'utf8'));
const governed = selectGovernedCounties(countyManifest);
const sha = value => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lp107-'));
  const packages = join(root, 'packages'); const reportPath = join(root, 'report.json');
  await mkdir(packages);
  const metadata = [];
  for (const county of governed) {
    const filename = `${county.slug}-${county.fips}.addresses.jsonl.gz`;
    const body = Buffer.from(`governed-${county.fips}`);
    const entry = { countyId: county.slug, county: county.name, fips: county.fips, acceptedRecords: Number(county.fips), outputBytes: body.length, packageHash: sha(body) };
    metadata.push(entry);
    await writeFile(join(packages, filename), body);
    await writeFile(join(packages, `${filename}.json`), serializeJson(entry));
  }
  await writeFile(join(packages, 'manifest.json'), serializeJson({ packages: metadata }));
  return { root, packages, reportPath, metadata, options: { packageDirectory: packages, reportPath, countyManifest } };
}
async function rejectsMutation(mutator, pattern) {
  const f = await fixture();
  try { await mutator(f); await assert.rejects(run(f.options), pattern); } finally { await rm(f.root, { recursive: true, force: true }); }
}

test('governed cohort contains the exact 28 unique launched identities', () => {
  assert.equal(governed.length, 28);
  assert.equal(new Set(governed.map(x => `${x.slug}-${x.fips}`)).size, 28);
  assert.deepEqual(governed.map(x => x.fips), ['48015','48039','48041','48057','48071','48089','48149','48157','48167','48185','48199','48201','48239','48241','48245','48285','48291','48321','48339','48351','48361','48373','48407','48457','48471','48473','48477','48481']);
});

test('missing package fails closed', () => rejectsMutation(async f => rm(join(f.packages, 'austin-48015.addresses.jsonl.gz')), /ENOENT/));
test('missing sidecar metadata fails closed', () => rejectsMutation(async f => rm(join(f.packages, 'austin-48015.addresses.jsonl.gz.json')), /sidecar missing/));
test('missing manifest metadata fails closed', () => rejectsMutation(async f => { f.metadata.shift(); await writeFile(join(f.packages, 'manifest.json'), serializeJson({ packages: f.metadata })); }, /manifest metadata missing/));
test('package size mismatch fails closed', () => rejectsMutation(async f => { f.metadata[0].outputBytes += 1; await writeFile(join(f.packages, 'manifest.json'), serializeJson({ packages: f.metadata })); }, /package size mismatch/));
test('package SHA-256 mismatch fails closed', () => rejectsMutation(async f => { f.metadata[0].packageHash = '0'.repeat(64); await writeFile(join(f.packages, 'manifest.json'), serializeJson({ packages: f.metadata })); }, /SHA-256 mismatch/));
test('county/FIPS metadata mismatch fails closed', () => rejectsMutation(async f => { f.metadata[0].countyId = 'wrong'; await writeFile(join(f.packages, 'manifest.json'), serializeJson({ packages: f.metadata })); }, /county\/FIPS metadata mismatch/));

test('certificate filename identity mismatch fails closed', () => rejectsMutation(async f => {
  const county = governed[0]; const filename = `${county.slug}-${county.fips}.addresses.jsonl.gz`; const body = await readFile(join(f.packages, filename));
  const certificate = certificateFor(county, filename.replace('austin', 'wrong'), body.length, sha(body));
  await writeFile(join(f.packages, `${county.slug}-${county.fips}.runtime-certificate.json`), serializeJson(certificate));
}, /certificate filename mismatch/));

test('certificate package filename mismatch fails closed under runtime contract', () => {
  const county = governed[0]; const expected = certificateFor(county, 'austin-48015.addresses.jsonl.gz', 1, 'a'.repeat(64));
  assert.match(validateRuntimeCertificate({ ...expected, artifact: 'other.addresses.jsonl.gz' }, expected).join(), /artifact mismatch/);
});

test('generation is deterministic and preserves existing correct certificates', async () => {
  const f = await fixture();
  try {
    await run(f.options); const path = join(f.packages, 'liberty-48291.runtime-certificate.json');
    const before = await readFile(path); const beforeStat = await stat(path);
    await new Promise(resolve => setTimeout(resolve, 20)); await run(f.options);
    assert.deepEqual(await readFile(path), before); assert.equal((await stat(path)).mtimeMs, beforeStat.mtimeMs);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('atomic writes expose no partial destination and clean temporary files on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp107-atomic-')); const destination = join(root, 'certificate.json');
  try {
    await assert.rejects(atomicWrite(destination, '{}\n', { beforeRename: async temporary => { assert.rejects(readFile(destination)); assert.equal(await readFile(temporary, 'utf8'), '{}\n'); throw new Error('injected'); } }), /injected/);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('package changes during hashing fail closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp107-hash-')); const path = join(root, 'package.gz'); await writeFile(path, 'before');
  try { await assert.rejects(stablePackageDigest(path, { afterHash: () => writeFile(path, 'changed') }), /changed during hashing/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('inventory contains no local paths, URLs, or secrets', async () => {
  const f = await fixture();
  try { const text = JSON.stringify(await run(f.options)); assert.doesNotMatch(text, /\/tmp|workspace|[A-Za-z]:\\\\|https?:|supabaseKey/i); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});

test('production Liberty certificate validates and generation preserves its bytes', async () => {
  const county = governed.find(x => x.fips === '48291'); const packageName = 'liberty-48291.addresses.jsonl.gz';
  const digest = await stablePackageDigest(join(PACKAGE_DIRECTORY, packageName));
  const certificatePath = join(PACKAGE_DIRECTORY, 'liberty-48291.runtime-certificate.json');
  const before = await readFile(certificatePath); const text = before.toString('utf8');
  const expected = certificateFor(county, packageName, digest.sizeBytes, digest.sha256);
  assert.deepEqual(validateRuntimeCertificate(JSON.parse(text), expected), []);
  await run({ noReport: true });
  assert.deepEqual(await readFile(certificatePath), before);
  assert.equal(text.replaceAll('\r\n', '\n'), serializeJson(expected));
});

test('all 28 real packages have valid certificates, are ready, and no gzip is modified', async () => {
  const before = new Map();
  for (const name of (await readdir(PACKAGE_DIRECTORY)).filter(name => name.endsWith('.addresses.jsonl.gz'))) before.set(name, await stablePackageDigest(join(PACKAGE_DIRECTORY, name)));
  const report = await run({ verifyOnly: true, noReport: true });
  assert.deepEqual(report.totals, { counties: 28, packagesPresent: 28, certificatesPresent: 28, certificatesValid: 28, identitiesAgree: 28, readyForUpload: 28 });
  for (const [name, digest] of before) assert.deepEqual(await stablePackageDigest(join(PACKAGE_DIRECTORY, name)), digest);
});

test('verification-only reports not-ready until every certificate exists', async () => {
  const f = await fixture();
  try {
    await assert.rejects(run({ ...f.options, verifyOnly: true }), error => {
      assert.equal(error.report.totals.counties, 28); assert.equal(error.report.totals.certificatesPresent, 0); assert.equal(error.report.totals.readyForUpload, 0); return true;
    });
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('LP107 scope does not import or modify address matching, geocoding, interpolation, or runtime search', async () => {
  const source = await readFile(new URL('../tools/lp107/generate-runtime-certificates.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"].*(?:gridly-geocoding|address-runtime|app\.js)/);
  assert.doesNotMatch(source, /fetch\s*\(|https?:\/\//);
});
