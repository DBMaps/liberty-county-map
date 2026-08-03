#!/usr/bin/env node

/** LP107 local-only certificate completion. This tool never contacts Storage or changes packages. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PACKAGE_DIRECTORY = join(ROOT, 'data/generated/lp104/txgio-addresses');
export const REPORT_PATH = join(ROOT, 'reports/lp107/storage-readiness.json');
const COUNTY_MANIFEST = join(ROOT, 'data/lp104/texas-counties.json');
export const STORAGE_BUCKET = 'certified-addresses';

export function selectGovernedCounties(manifest) {
  const counties = (manifest.counties || []).filter(county => county.certificationCohort === 'initial28')
    .map(county => ({ slug: county.countyId, name: county.countyName, fips: county.fips }))
    .sort((a, b) => a.fips.localeCompare(b.fips));
  if (counties.length !== 28) throw new Error(`governed cohort must contain exactly 28 counties (found ${counties.length})`);
  const slugs = new Set(); const fips = new Set();
  for (const county of counties) {
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(county.slug) || !/^48\d{3}$/.test(county.fips)) throw new Error('invalid governed county/FIPS identity');
    if (slugs.has(county.slug) || fips.has(county.fips)) throw new Error('duplicate governed county/FIPS identity');
    slugs.add(county.slug); fips.add(county.fips);
  }
  return counties;
}

export function certificateFor(county, packageFilename, sizeBytes, sha256) {
  return {
    schemaVersion: 1,
    milestone: 'LP104.5',
    countyId: `${county.slug}-tx`,
    county: `${county.name} County`,
    fips: county.fips,
    artifact: packageFilename,
    sizeBytes,
    sha256,
    sourcePackageModified: false,
    acceptance: { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false }
  };
}

export const serializeJson = value => `${JSON.stringify(value, null, 2)}\n`;

export function validateRuntimeCertificate(certificate, expected) {
  const failures = [];
  for (const field of ['schemaVersion', 'milestone', 'countyId', 'county', 'fips', 'artifact', 'sizeBytes', 'sha256', 'sourcePackageModified']) {
    if (certificate?.[field] !== expected[field]) failures.push(`certificate ${field} mismatch`);
  }
  if (certificate?.acceptance?.houseNumber !== 'exact' || certificate?.acceptance?.road !== 'canonical_exact'
    || certificate?.acceptance?.interpolation !== false || certificate?.acceptance?.nearbyHouseSubstitution !== false) {
    failures.push('certificate exact-address acceptance mismatch');
  }
  if (!/^[a-f0-9]{64}$/.test(certificate?.sha256 || '')) failures.push('certificate SHA-256 invalid');
  return failures;
}

export async function stablePackageDigest(path, hooks = {}) {
  const before = await stat(path);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (hooks.afterHash) await hooks.afterHash(path);
  const after = await stat(path);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error('package changed during hashing');
  return { sizeBytes: after.size, sha256: hash.digest('hex') };
}

export async function atomicWrite(path, contents, hooks = {}) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${createHash('sha256').update(contents).digest('hex').slice(0, 12)}.tmp`;
  try {
    const handle = await open(temporary, 'wx');
    try { await handle.writeFile(contents); await handle.sync(); } finally { await handle.close(); }
    if (hooks.beforeRename) await hooks.beforeRename(temporary, path);
    await rename(temporary, path);
  } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
}

function assertPortableOutput(value) {
  const text = JSON.stringify(value);
  if (/[A-Za-z]:\\\\|\/(?:home|Users|workspace|root)\//.test(text)) throw new Error('local absolute path leaked into output');
  if (/supabase[_-]?(?:key|url)|signed[_-]?url|https?:\/\//i.test(text)) throw new Error('secret or URL leaked into output');
}

export async function run(options = {}, hooks = {}) {
  const packageDirectory = resolve(options.packageDirectory || PACKAGE_DIRECTORY);
  const reportPath = resolve(options.reportPath || REPORT_PATH);
  const countyManifest = options.countyManifest || JSON.parse(await readFile(options.countyManifestPath || COUNTY_MANIFEST, 'utf8'));
  let counties = selectGovernedCounties(countyManifest);
  if (options.countyFips) {
    counties = counties.filter(county => county.fips === String(options.countyFips).padStart(5, '0'));
    if (counties.length !== 1) throw new Error(`county FIPS is not in governed cohort: ${options.countyFips}`);
  }
  const packageManifestPath = options.packageManifestPath || join(packageDirectory, 'manifest.json');
  const packageManifest = JSON.parse(await readFile(packageManifestPath, 'utf8').catch(() => { throw new Error('required package manifest missing'); }));
  const metadataByFips = new Map();
  for (const metadata of packageManifest.packages || []) {
    if (metadataByFips.has(metadata.fips)) throw new Error(`duplicate package metadata FIPS: ${metadata.fips}`);
    metadataByFips.set(metadata.fips, metadata);
  }
  const inventory = [];
  for (const county of counties) {
    const stem = `${county.slug}-${county.fips}`;
    const packageFilename = `${stem}.addresses.jsonl.gz`;
    const certificateFilename = `${stem}.runtime-certificate.json`;
    if (!new RegExp(`^${county.slug}-${county.fips}\\.addresses\\.jsonl\\.gz$`).test(packageFilename)) throw new Error(`package filename identity mismatch: ${packageFilename}`);
    const packagePath = join(packageDirectory, packageFilename);
    const sidecarPath = `${packagePath}.json`;
    const certificatePath = join(packageDirectory, certificateFilename);
    const metadata = metadataByFips.get(county.fips);
    if (!metadata) throw new Error(`required manifest metadata missing: ${county.fips}`);
    if (metadata.countyId !== county.slug || metadata.county !== county.name || metadata.fips !== county.fips) throw new Error(`county/FIPS metadata mismatch: ${county.fips}`);
    const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8').catch(() => { throw new Error(`required package sidecar missing: ${packageFilename}`); }));
    if (sidecar.countyId !== county.slug || sidecar.county !== county.name || sidecar.fips !== county.fips) throw new Error(`county/FIPS sidecar mismatch: ${county.fips}`);
    const digest = await stablePackageDigest(packagePath, hooks);
    for (const [label, actual, expected] of [['size', digest.sizeBytes, metadata.outputBytes], ['SHA-256', digest.sha256, metadata.packageHash], ['sidecar size', digest.sizeBytes, sidecar.outputBytes], ['sidecar SHA-256', digest.sha256, sidecar.packageHash]]) {
      if (actual !== expected) throw new Error(`package ${label} mismatch: ${county.fips}`);
    }
    if (!Number.isInteger(metadata.acceptedRecords) || metadata.acceptedRecords < 0 || metadata.acceptedRecords !== sidecar.acceptedRecords) throw new Error(`governed record count metadata mismatch: ${county.fips}`);
    const expected = certificateFor(county, packageFilename, digest.sizeBytes, digest.sha256);
    let existingText = await readFile(certificatePath, 'utf8').catch(() => null);
    if (existingText !== null) {
      const existing = JSON.parse(existingText);
      const namedArtifact = certificateFilename.replace('.runtime-certificate.json', '.addresses.jsonl.gz');
      if (namedArtifact !== existing.artifact) throw new Error(`certificate filename mismatch: ${certificateFilename}`);
      const failures = validateRuntimeCertificate(existing, expected);
      if (failures.length) throw new Error(failures.join('; '));
    } else if (!options.verifyOnly) {
      const output = serializeJson(expected);
      if (validateRuntimeCertificate(JSON.parse(output), expected).length) throw new Error('generated certificate failed runtime validation');
      await atomicWrite(certificatePath, output, hooks);
      existingText = output;
    }
    const certificatePresent = existingText !== null;
    const certificateValid = certificatePresent && validateRuntimeCertificate(JSON.parse(existingText), expected).length === 0;
    const identityAgreement = certificateValid && JSON.parse(existingText).artifact === packageFilename;
    const blockingReasons = [];
    if (!certificatePresent) blockingReasons.push('certificate missing');
    if (certificatePresent && !certificateValid) blockingReasons.push('certificate invalid');
    if (!identityAgreement) blockingReasons.push('package/certificate identity mismatch');
    inventory.push({ countySlug: county.slug, countyName: county.name, countyFips: county.fips, packageFilename,
      packagePresent: true, packageByteSize: digest.sizeBytes, packageSha256: digest.sha256, governedRecordCount: metadata.acceptedRecords,
      certificateFilename, certificatePresent, certificateValid, packageCertificateIdentityAgreement: identityAgreement,
      expectedSupabaseBucket: STORAGE_BUCKET, expectedPackageObjectPath: `lp104/txgio-addresses/${packageFilename}`,
      expectedCertificateObjectPath: `lp104/txgio-addresses/${certificateFilename}`, readyForUpload: blockingReasons.length === 0, blockingReasons });
  }
  const report = { schemaVersion: 'gridly-lp107-storage-readiness-v1', scope: options.countyFips ? 'selected-county' : 'launched-28',
    localReadinessOnly: true, remoteUploadVerified: false, totals: { counties: inventory.length, packagesPresent: inventory.filter(x => x.packagePresent).length,
      certificatesPresent: inventory.filter(x => x.certificatePresent).length, certificatesValid: inventory.filter(x => x.certificateValid).length,
      identitiesAgree: inventory.filter(x => x.packageCertificateIdentityAgreement).length, readyForUpload: inventory.filter(x => x.readyForUpload).length }, counties: inventory };
  assertPortableOutput(report);
  if (!options.noReport) await atomicWrite(reportPath, serializeJson(report), hooks);
  if (inventory.some(item => !item.readyForUpload)) throw Object.assign(new Error('one or more counties are not locally ready for upload'), { report });
  return report;
}

export function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--verify-only') options.verifyOnly = true;
    else if (argv[index] === '--county-fips') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('--county-fips requires a FIPS value');
      options.countyFips = argv[++index];
    } else throw new Error(`unknown option: ${argv[index]}`);
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const report = await run(parseArguments(argv));
  process.stdout.write(`LP107 local readiness: ${report.totals.readyForUpload}/${report.totals.counties} counties ready for upload.\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
