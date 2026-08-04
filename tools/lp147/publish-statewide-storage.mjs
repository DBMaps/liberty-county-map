#!/usr/bin/env node

/** LP147 publishes existing certified bytes. It never manufactures packages or certificates. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { certificateFor, validateRuntimeCertificate } from '../lp107/generate-runtime-certificates.mjs';
import { atomicJson, BUCKET, objectPaths, redact, stableDigest } from '../lp108/lp108-core.mjs';
import { credentials, storageRequest, syncRemoteObject, verifyRemoteObject } from '../lp108/sync-certified-address-storage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_PACKAGE_DIRECTORY = join(ROOT, 'data/generated/lp104/txgio-addresses');
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

export async function buildLocalInventory(options = {}, hooks = {}) {
  const packageDirectory = resolve(options.packageDirectory || DEFAULT_PACKAGE_DIRECTORY);
  const reconciliation = hooks.reconciliation || JSON.parse(await readFile(join(ROOT, 'evidence/lp130/final-reconciliation.json'), 'utf8'));
  const manifest = hooks.manifest || JSON.parse(await readFile(join(ROOT, 'data/lp104/texas-counties.json'), 'utf8'));
  const names = new Map(manifest.counties.map(item => [item.fips, item.countyName]));
  let source = reconciliation.packageInventory;
  if (!Array.isArray(source) || source.length !== 254) throw new Error('LP130 statewide package inventory must contain exactly 254 counties');
  if (options.countyFips) source = source.filter(item => item.fips === options.countyFips);
  if (options.countyFips && source.length !== 1) throw new Error('county FIPS is not in the LP130 statewide inventory');
  const inventory = [];
  for (const identity of source) {
    const packagePath = join(packageDirectory, identity.packageName);
    const certificateName = identity.packageName.replace('.addresses.jsonl.gz', '.runtime-certificate.json');
    const certificatePath = join(packageDirectory, certificateName);
    const digest = await stableDigest(packagePath).catch(error => { throw new Error(`required LP130 package unavailable or unstable (${identity.fips}): ${error.message}`); });
    if (digest.sizeBytes !== identity.sizeBytes || digest.sha256 !== identity.sha256) throw new Error(`LP130 package identity mismatch (${identity.fips})`);
    const certificateBytes = await readFile(certificatePath).catch(() => { throw new Error(`required existing runtime certificate unavailable (${identity.fips})`); });
    let certificate;
    try { certificate = JSON.parse(certificateBytes); } catch { throw new Error(`existing runtime certificate is invalid JSON (${identity.fips})`); }
    const county = { slug: identity.countyId, fips: identity.fips, name: names.get(identity.fips) };
    if (!county.name) throw new Error(`Texas county identity missing (${identity.fips})`);
    const failures = validateRuntimeCertificate(certificate, certificateFor(county, identity.packageName, identity.sizeBytes, identity.sha256));
    if (failures.length) throw new Error(`existing runtime certificate is invalid (${identity.fips}): ${failures.join('; ')}`);
    inventory.push({ countyFips: identity.fips, countyId: identity.countyId, packagePath, certificatePath,
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
    runtimeMembershipModified: false, expectedCounties: inventory.length, objects: [], totals: totalsFor(inventory.length, []) };
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
  try { const report = await run(parseArguments(argv)); console.log(`LP147 Storage: ${report.totals.matching}/${report.totals.expectedObjects} matching; ${report.totals.uploaded} uploaded.`); }
  catch (error) { console.error(redact(error.message)); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
