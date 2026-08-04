#!/usr/bin/env node

/** LP147 publishes existing certified bytes. It never manufactures packages or certificates. */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { certificateFor, selectGovernedCounties, validateRuntimeCertificate } from '../lp107/generate-runtime-certificates.mjs';
import { atomicJson, BUCKET, objectPaths, redact, stableDigest } from '../lp108/lp108-core.mjs';
import { credentials, storageRequest, syncRemoteObject, verifyRemoteObject } from '../lp108/sync-certified-address-storage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_PACKAGE_DIRECTORY = join(ROOT, 'data/generated/lp104/txgio-addresses');
export const DEFAULT_CERTIFICATE_ROOT = join(ROOT, 'reports/lp130-statewide-addresses');
export const DEFAULT_REPORT = join(ROOT, 'reports/lp147/statewide-storage-publication.json');

export function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--plan') options.plan = true;
    else if (argument === '--upload') options.upload = true;
    else if (argument === '--verify-remote') options.verifyRemote = true;
    else if (argument === '--replace-mismatched') options.replaceMismatched = true;
    else if (argument === '--county-fips' || argument === '--package-directory' || argument === '--report') {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${argument} requires a value`);
      const key = argument === '--county-fips' ? 'countyFips' : argument === '--package-directory' ? 'packageDirectory' : 'reportPath';
      options[key] = argv[++index];
    } else throw new Error(`unknown option: ${argument}`);
  }
  if ([options.plan, options.upload, options.verifyRemote].filter(Boolean).length !== 1) throw new Error('select exactly one of --plan, --upload, or --verify-remote');
  if (options.replaceMismatched && !options.upload) throw new Error('--replace-mismatched requires --upload');
  return options;
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const expectedPath = item => objectPaths({ slug: item.countyId, fips: item.fips });

async function readGovernedCertificate(path, filename, expectedByFips, source) {
  const match = /^([a-z]+(?:-[a-z]+)*)-(48\d{3})\.runtime-certificate\.json$/.exec(filename);
  if (!match) throw new Error(`${source} certificate filename identity invalid (${filename})`);
  const [, filenameCounty, filenameFips] = match;
  const bytes = await readFile(path);
  let certificate;
  try { certificate = JSON.parse(bytes); } catch { throw new Error(`${source} runtime certificate is invalid JSON (${filenameFips})`); }
  if (certificate?.fips !== filenameFips || certificate?.countyId !== `${filenameCounty}-tx` || certificate?.artifact !== `${filenameCounty}-${filenameFips}.addresses.jsonl.gz`) {
    throw new Error(`${source} certificate filename/content identity conflict (${filenameFips})`);
  }
  const identity = expectedByFips.get(filenameFips);
  if (!identity || identity.countyId !== filenameCounty) throw new Error(`${source} certificate county/FIPS mismatch (${filenameFips})`);
  return [filenameFips, { path, bytes, certificate, source }];
}

/** Merge the two non-overlapping governed authorities; LP105.1 copies are intentionally invisible. */
export async function discoverAuthoritativeCertificates(expected, operationalFips, options = {}) {
  const packageDirectory = options.packageDirectory || DEFAULT_PACKAGE_DIRECTORY;
  const certificateRoot = options.certificateRoot || DEFAULT_CERTIFICATE_ROOT;
  const expectedByFips = new Map(expected.map(item => [item.fips, item]));
  const operational = new Map();
  const expansion = new Map();
  const operationalFiles = (await readdir(packageDirectory, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith('.runtime-certificate.json')).map(entry => entry.name).sort();
  for (const filename of operationalFiles) {
    const [fips, item] = await readGovernedCertificate(join(packageDirectory, filename), filename, expectedByFips, 'operational');
    if (!operationalFips.has(fips)) throw new Error(`certificate appears under wrong governed source (operational ${fips})`);
    if (operational.has(fips)) throw new Error(`duplicate operational certificate (${fips})`);
    operational.set(fips, item);
  }
  for (const fips of operationalFips) if (!operational.has(fips)) throw new Error(`required operational certificate unavailable (${fips})`);
  if (operational.size !== 28) throw new Error(`operational certificate source must contain exactly 28 governed FIPS (found ${operational.size})`);
  let batches;
  try { batches = (await readdir(certificateRoot, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^batch-\d+$/.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name)); }
  catch (error) { throw new Error(`LP130 certificate source unavailable: ${error.message}`); }
  if (!batches.length) throw new Error('no LP130 batch certificate directories found');
  for (const batch of batches) {
    const directory = join(certificateRoot, batch.name, 'certificates');
    let files;
    try { files = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith('.runtime-certificate.json')).map(entry => entry.name).sort(); }
    catch (error) { throw new Error(`LP130 batch certificate directory unavailable (${batch.name}): ${error.message}`); }
    for (const filename of files) {
      const [fips, item] = await readGovernedCertificate(join(directory, filename), filename, expectedByFips, 'expansion');
      if (operationalFips.has(fips)) throw new Error(`same FIPS appears in both authoritative source sets (${fips})`);
      if (expansion.has(fips)) throw new Error(`duplicate expansion certificate (${fips})`);
      expansion.set(fips, item);
    }
  }
  const expansionFips = expected.filter(item => !operationalFips.has(item.fips)).map(item => item.fips);
  for (const fips of expansionFips) if (!expansion.has(fips)) throw new Error(`required expansion certificate unavailable (${fips})`);
  if (expansion.size !== 226) throw new Error(`expansion certificate source must contain exactly 226 governed FIPS (found ${expansion.size})`);
  const combined = new Map([...operational, ...expansion].sort(([left], [right]) => left.localeCompare(right)));
  if (combined.size !== 254) throw new Error(`combined authoritative certificate inventory must contain 254 unique FIPS (found ${combined.size})`);
  return combined;
}

export async function buildLocalInventory(options = {}, hooks = {}) {
  const packageDirectory = resolve(options.packageDirectory || DEFAULT_PACKAGE_DIRECTORY);
  const reconciliation = hooks.reconciliation || JSON.parse(await readFile(join(ROOT, 'evidence/lp130/final-reconciliation.json'), 'utf8'));
  const manifest = hooks.manifest || JSON.parse(await readFile(join(ROOT, 'data/lp104/texas-counties.json'), 'utf8'));
  const names = new Map(manifest.counties.map(item => [item.fips, item.countyName]));
  const operationalFips = new Set(selectGovernedCounties(manifest).map(item => item.fips));
  const allCounties = reconciliation.packageInventory;
  let source = allCounties;
  if (!Array.isArray(source) || source.length !== 254) throw new Error('LP130 statewide package inventory must contain exactly 254 counties');
  source = [...source].sort((left, right) => left.fips.localeCompare(right.fips));
  if (new Set(source.map(item => item.fips)).size !== source.length) throw new Error('LP130 statewide package inventory contains duplicate FIPS');
  const certificates = await discoverAuthoritativeCertificates(allCounties, operationalFips, { packageDirectory, certificateRoot: hooks.certificateRoot || options.certificateRoot });
  if (options.countyFips) source = source.filter(item => item.fips === options.countyFips);
  if (options.countyFips && source.length !== 1) throw new Error('county FIPS is not in the LP130 statewide inventory');
  const inventory = [];
  for (const identity of source) {
    const packagePath = join(packageDirectory, identity.packageName);
    const authoritative = certificates.get(identity.fips);
    const certificatePath = authoritative.path;
    const digest = await stableDigest(packagePath).catch(error => { throw new Error(`required LP130 package unavailable or unstable (${identity.fips}): ${error.message}`); });
    if (digest.sizeBytes !== identity.sizeBytes || digest.sha256 !== identity.sha256) throw new Error(`LP130 package identity mismatch (${identity.fips})`);
    const certificateBytes = authoritative.bytes;
    const certificate = authoritative.certificate;
    const county = { slug: identity.countyId, fips: identity.fips, name: names.get(identity.fips) };
    if (!county.name) throw new Error(`Texas county identity missing (${identity.fips})`);
    const expectedCertificate = { ...certificateFor(county, identity.packageName, digest.sizeBytes, digest.sha256),
      milestone: authoritative.source === 'operational' ? 'LP104.5' : 'LP105.1-candidate' };
    const failures = validateRuntimeCertificate(certificate, expectedCertificate);
    if (failures.length) throw new Error(`existing runtime certificate is invalid (${identity.fips}): ${failures.join('; ')}`);
    inventory.push({ county: county.name, fips: identity.fips, countyFips: identity.fips, countyId: identity.countyId,
      packagePath, packageRemotePath: expectedPath(identity).package, packageBytes: digest.sizeBytes, packageSha256: digest.sha256,
      certificatePath, certificateSource: authoritative.source, certificateRemotePath: expectedPath(identity).certificate, certificateBytes: certificateBytes.byteLength, certificateSha256: sha256(certificateBytes),
      objects: [{ kind: 'package', path: expectedPath(identity).package, localPath: packagePath, sizeBytes: digest.sizeBytes, sha256: digest.sha256, contentType: 'application/gzip' },
        { kind: 'certificate', path: expectedPath(identity).certificate, localPath: certificatePath, sizeBytes: certificateBytes.byteLength, sha256: sha256(certificateBytes), contentType: 'application/json' }] });
  }
  return inventory;
}

const totalsFor = (counties, objects) => ({ counties, expectedObjects: counties * 2,
  matching: objects.filter(item => item.status === 'matching').length,
  missing: objects.filter(item => item.status === 'missing').length,
  mismatched: objects.filter(item => item.status === 'mismatched').length,
  inaccessible: objects.filter(item => item.status === 'inaccessible').length,
  unverifiable: objects.filter(item => item.status === 'unverifiable').length,
  uploadFailed: objects.filter(item => item.status === 'upload_failed').length,
  uploaded: objects.filter(item => item.uploaded === true).length });

export async function run(options, hooks = {}) {
  const reportPath = resolve(options.reportPath || DEFAULT_REPORT);
  const inventory = await buildLocalInventory(options, hooks);
  const report = { schemaVersion: 'gridly-lp147-statewide-storage-publication-v1', milestone: 'LP147', bucket: BUCKET,
    mode: options.plan ? 'plan' : options.upload ? 'upload' : 'verify-remote', localArtifactsModified: false,
    runtimeMembershipModified: false, expectedCounties: inventory.length,
    localPreflight: { packagesValidated: inventory.length, runtimeCertificatesValidated: inventory.length,
      operationalCertificateSources: inventory.filter(item => item.certificateSource === 'operational').length,
      expansionCertificateSources: inventory.filter(item => item.certificateSource === 'expansion').length,
      missingArtifacts: 0, identityFailures: 0, writesPerformed: 0 },
    objects: [], totals: totalsFor(inventory.length, []) };
  if (options.plan) {
    report.objects = inventory.flatMap(county => county.objects.map(item => ({ countyFips: county.countyFips, kind: item.kind, path: item.path, sizeBytes: item.sizeBytes, sha256: item.sha256, status: 'planned' })));
    report.totals = { ...report.totals, planned: report.objects.length };
    await atomicJson(reportPath, report); return report;
  }
  const auth = credentials(hooks.env || process.env);
  const requestHooks = { fetchImpl: hooks.fetchImpl, attempts: hooks.attempts ?? 3, timeoutMs: hooks.timeoutMs ?? 300000, uploadTimeoutMs: hooks.uploadTimeoutMs ?? 300000 };
  const bucket = await storageRequest(auth, `bucket/${BUCKET}`, {}, requestHooks);
  if (!bucket.ok) throw new Error(`Storage target ambiguous or inaccessible (${bucket.status})`);
  for (const county of inventory) for (const item of county.objects) {
    const expected = { sizeBytes: item.sizeBytes, sha256: item.sha256 };
    const result = options.upload
      ? await syncRemoteObject(auth, item.path, expected, await readFile(item.localPath), item.contentType, { replaceMismatched: options.replaceMismatched }, requestHooks)
      : await verifyRemoteObject(auth, item.path, expected, requestHooks);
    report.objects.push({ countyFips: county.countyFips, kind: item.kind, path: item.path, expectedSizeBytes: item.sizeBytes, expectedSha256: item.sha256, ...result });
    report.totals = totalsFor(inventory.length, report.objects);
    await atomicJson(reportPath, report); // durable checkpoint makes interruption safely resumable
  }
  report.completedAt = new Date().toISOString();
  report.outcome = report.totals.matching === report.totals.expectedObjects ? 'STATEWIDE_STORAGE_VERIFIED' : 'STATEWIDE_STORAGE_INCOMPLETE';
  await atomicJson(reportPath, report);
  if (report.outcome !== 'STATEWIDE_STORAGE_VERIFIED') throw Object.assign(new Error('remote objects are missing, mismatched, inaccessible, or unverifiable'), { report });
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const report = await run(parseArguments(argv));
    if (report.mode === 'plan') console.log(`LP147 local plan: ${report.localPreflight.packagesValidated} packages validated; ${report.localPreflight.runtimeCertificatesValidated} runtime certificates validated; ${report.localPreflight.operationalCertificateSources} operational certificate sources; ${report.localPreflight.expansionCertificateSources} expansion certificate sources; ${report.totals.expectedObjects} expected Storage objects; 0 local missing artifacts; 0 identity failures; 0 writes performed.`);
    else console.log(`LP147 Storage: ${report.totals.matching}/${report.totals.expectedObjects} matching; ${report.totals.uploaded} uploaded.`);
  }
  catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
