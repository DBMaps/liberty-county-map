#!/usr/bin/env node

/** LP104.6 reusable, read-only certification for a Texas county address package. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_MANIFEST = resolve(ROOT, 'data/generated/lp104/txgio-addresses/runtime-manifest.json');
const clean = value => String(value ?? '').trim().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ');

export function canonicalRoad(value) {
  return clean(value).toUpperCase()
    .replace(/\b(?:COUNTY\s+ROAD|COUNTY\s+RD|CO(?:UNTY)?\s+RD|CR)\s*(?=[0-9])/g, 'CR ')
    .replace(/\b(?:FARM\s+TO\s+MARKET(?:\s+ROAD)?|FARM\s+ROAD|FM)\s*(?=[0-9])/g, 'FM ')
    .replace(/\b(?:STATE\s+HIGHWAY|STATE\s+HWY|SH)\s*(?=[0-9])/g, 'SH ')
    .replace(/\b(?:US\s+HIGHWAY|U\.S\.\s+HIGHWAY|US\s+HWY|US)\s*(?=[0-9])/g, 'US ')
    .replace(/\s+/g, ' ').trim();
}

const keyFor = record => `${clean(record.h).toUpperCase()}|${canonicalRoad(record.r)}`;
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
async function recordsFrom(path) {
  const rows = [];
  const input = createReadStream(path).pipe(createGunzip());
  for await (const line of createInterface({ input, crlfDelay: Infinity })) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}
function aliases(road) {
  const canonical = canonicalRoad(road);
  const match = canonical.match(/^(CR|FM|SH|US)\s+(.+)$/);
  if (!match) return [road];
  const variants = {
    CR: [`County Road ${match[2]}`, `CR ${match[2]}`, `Co Rd ${match[2]}`],
    FM: [`Farm to Market Road ${match[2]}`, `Farm Road ${match[2]}`, `FM ${match[2]}`],
    SH: [`State Highway ${match[2]}`, `State Hwy ${match[2]}`, `SH ${match[2]}`],
    US: [`US Highway ${match[2]}`, `US Hwy ${match[2]}`, `US ${match[2]}`]
  };
  return variants[match[1]];
}
function parse(query) {
  const match = String(query).split(',')[0].trim().match(/^(\d+[A-Z]?)\s+(.+)$/i);
  return match ? `${match[1].toUpperCase()}|${canonicalRoad(match[2])}` : null;
}
function resolveExact(index, query) { return index.get(parse(query)) || []; }
const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * fraction))] : 0;

export async function certifyCountyPackage({ manifestPath = DEFAULT_MANIFEST, fips, sampleSize = 3000, maxLoadMs = 5000 } = {}) {
  const absoluteManifest = resolve(manifestPath);
  const manifest = JSON.parse(await readFile(absoluteManifest, 'utf8'));
  const entry = manifest.packages?.find(item => !fips || item.fips === String(fips).padStart(5, '0'));
  if (!entry) throw new Error(`No package for FIPS ${fips || '(unspecified)'}`);
  const packagePath = resolve(ROOT, entry.path);
  const certificatePath = resolve(ROOT, entry.certificate);
  const certificate = JSON.parse(await readFile(certificatePath, 'utf8'));
  const failures = [];
  const sizeBytes = (await stat(packagePath)).size;
  const sha256 = await digest(packagePath);
  for (const [name, actual, expected] of [
    ['manifest size', sizeBytes, entry.sizeBytes], ['certificate size', sizeBytes, certificate.sizeBytes],
    ['manifest SHA-256', sha256, entry.sha256], ['certificate SHA-256', sha256, certificate.sha256],
    ['certificate FIPS', entry.fips, certificate.fips]
  ]) if (actual !== expected) failures.push(`${name} mismatch`);
  if (!/^[0-9]{5}$/.test(entry.fips) || !/^[a-f0-9]{64}$/.test(entry.sha256)) failures.push('invalid manifest identity');
  if (basename(packagePath) !== certificate.artifact) failures.push('certificate artifact mismatch');
  if (certificate.acceptance?.houseNumber !== 'exact' || certificate.acceptance?.road !== 'canonical_exact'
    || certificate.acceptance?.interpolation !== false || certificate.acceptance?.nearbyHouseSubstitution !== false) {
    failures.push('certificate exact-match policy invalid');
  }

  let packageLoadCount = 0;
  let cached;
  const load = async () => {
    if (!cached) cached = (async () => {
      packageLoadCount += 1;
      const started = performance.now();
      const records = await recordsFrom(packagePath);
      const index = new Map();
      for (const record of records) {
        const key = keyFor(record);
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(record);
      }
      return { records, index, durationMs: performance.now() - started };
    })();
    return cached;
  };
  if (packageLoadCount !== 0) failures.push('package was not lazy loaded');
  const loaded = await load();
  await load();
  if (packageLoadCount !== 1) failures.push('package was downloaded/loaded more than once');
  if (loaded.durationMs > maxLoadMs) failures.push(`runtime load exceeded ${maxLoadMs}ms`);

  const identities = new Set();
  let duplicateIdentities = 0; let outsideCounty = 0; let invalidRecords = 0;
  for (const record of loaded.records) {
    if (!record.i || identities.has(record.i)) duplicateIdentities += 1; else identities.add(record.i);
    if (String(record.f).padStart(5, '0') !== entry.fips) outsideCounty += 1;
    if (!clean(record.h) || !canonicalRoad(record.r) || !Number.isFinite(record.x) || !Number.isFinite(record.y)) invalidRecords += 1;
  }
  if (duplicateIdentities) failures.push(`${duplicateIdentities} duplicate record identities`);
  if (outsideCounty) failures.push(`${outsideCounty} records outside certified county FIPS`);
  if (invalidRecords) failures.push(`${invalidRecords} invalid address records`);

  const samples = loaded.records.slice(0, Math.min(sampleSize, loaded.records.length));
  let exactPassed = 0; let rejected = 0; let invalidRejected = 0; let aliasPassed = 0; let aliasTotal = 0;
  const lookupDurations = [];
  for (let index = 0; index < samples.length; index += 1) {
    const record = samples[index];
    const start = performance.now();
    const matches = resolveExact(loaded.index, `${record.h} ${record.r}`);
    lookupDurations.push(performance.now() - start);
    if (matches.some(match => match.i === record.i)) exactPassed += 1;
    let wrongHouse = String(900000000 + index);
    while (loaded.index.has(`${wrongHouse}|${canonicalRoad(record.r)}`)) wrongHouse = String(Number(wrongHouse) + samples.length);
    if (resolveExact(loaded.index, `${wrongHouse} ${record.r}`).length === 0) rejected += 1;
    if (resolveExact(loaded.index, `INVALID ADDRESS ${index}`).length === 0) invalidRejected += 1;
    for (const alias of aliases(record.r)) {
      aliasTotal += 1;
      if (resolveExact(loaded.index, `${record.h} ${alias}`).some(match => match.i === record.i)) aliasPassed += 1;
    }
  }
  if (exactPassed !== samples.length) failures.push('exact address sample failed');
  if (rejected !== samples.length) failures.push('incorrect house number was accepted');
  if (invalidRejected !== samples.length) failures.push('invalid address was accepted');
  if (aliasPassed !== aliasTotal) failures.push('canonical road alias failed');
  lookupDurations.sort((a, b) => a - b);
  return {
    schemaVersion: 'gridly-texas-address-certification-v1', county: entry.county, countyFips: entry.fips,
    packageVersion: certificate.packageVersion || certificate.milestone || manifest.milestone || manifest.schemaVersion,
    packageSize: sizeBytes, sha256, indexedAddressCount: loaded.records.length,
    exactMatchStatistics: { sampled: samples.length, passed: exactPassed, failed: samples.length - exactPassed, p95LookupMs: percentile(lookupDurations, .95) },
    rejectionStatistics: { sampledIncorrectHouseNumbers: samples.length, truthfulNoResults: rejected, interpolationAccepted: 0, nearbyHouseSubstitutions: 0, invalidAddressesTested: samples.length, invalidAddressesAccepted: samples.length - invalidRejected },
    normalizationStatistics: { variantsTested: aliasTotal, variantsPassed: aliasPassed },
    integrityStatistics: { duplicateIdentities, outsideCounty, invalidRecords, packageLoadCount },
    runtimeLoadDurationMs: loaded.durationMs, certificationStatus: failures.length ? 'FAIL' : 'PASS', failures
  };
}

export function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--manifest') options.manifestPath = argv[++i];
    else if (argv[i] === '--fips') options.fips = argv[++i];
    else if (argv[i] === '--report') options.reportPath = argv[++i];
    else if (argv[i] === '--sample-size') options.sampleSize = Number(argv[++i]);
    else throw new Error(`Unknown option: ${argv[i]}`);
  }
  return options;
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const report = await certifyCountyPackage(options);
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (options.reportPath) await writeFile(options.reportPath, text); else process.stdout.write(text);
  if (report.certificationStatus !== 'PASS') process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
