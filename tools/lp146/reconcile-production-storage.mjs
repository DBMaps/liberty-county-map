#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT = resolve(ROOT, 'reports/lp146');
const INVENTORY = resolve(ROOT, 'evidence/lp135/statewide-certification.json');
const LIBERTY_CERTIFICATE = resolve(ROOT, 'data/generated/lp104/txgio-addresses/liberty-48291.runtime-certificate.json');
const PREFIX = 'lp104/txgio-addresses';
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// This is the only production Storage publication for which the merged baseline
// contains owner-observed object evidence. Never turn an inaccessible request or
// a runtime/manufacturing identity into publication evidence.
const OBSERVED_PUBLICATIONS = Object.freeze({
  '48291': { packageBytes: 2555016, evidence: 'docs/LP105.5-CERTIFIED-ADDRESS-RUNTIME-DIAGNOSTICS.md' }
});

async function certificateIndex(directory = ROOT) {
  const found = new Map();
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'android'].includes(entry.name)) continue;
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(child);
      else { const match = entry.name.match(/-(48\d{3})\.runtime-certificate\.json$/); if (match && !found.has(match[1])) found.set(match[1], child); }
    }
  }
  await walk(directory); return found;
}

export async function buildReports() {
  const certificates = await certificateIndex();
  const baseline = JSON.parse(await readFile(INVENTORY, 'utf8'));
  const libertyCertificateBytes = await readFile(LIBERTY_CERTIFICATE);
  const counties = await Promise.all([...baseline.counties].sort((a, b) => a.fips.localeCompare(b.fips)).map(async row => {
    const publication = OBSERVED_PUBLICATIONS[row.fips];
    const slug = row.packageIdentity.name.replace(/-\d{5}\.addresses\.jsonl\.gz$/, '');
    const packagePath = `${PREFIX}/${row.packageIdentity.name}`;
    const certificatePath = `${PREFIX}/${slug}-${row.fips}.runtime-certificate.json`;
    const packagePresent = Boolean(publication);
    const certificatePresent = Boolean(publication);
    const verified = packagePresent && certificatePresent && row.packageIdentity.sizeBytes === publication.packageBytes;
    return {
      county: row.county,
      fips: row.fips,
      packageExpected: true,
      packagePresent,
      certificateExpected: true,
      certificatePresent,
      packageByteCount: row.packageIdentity.sizeBytes,
      packageSha256: row.packageIdentity.sha256,
      certificateSha256: certificates.has(row.fips) ? sha256(await readFile(certificates.get(row.fips))) : null,
      verificationResult: verified ? 'MATCHING_OBSERVED_IDENTITY' : 'NO_PRODUCTION_PUBLICATION_EVIDENCE',
      classification: verified ? 'PUBLISHED_AND_VERIFIED' : 'NOT_PUBLISHED',
      packageObjectPath: packagePath,
      certificateObjectPath: certificatePath,
      observationEvidence: publication?.evidence ?? 'reports/lp145/statewide-operational-constraint-analysis.json'
    };
  }));
  const count = classification => counties.filter(row => row.classification === classification).length;
  const presentPackages = counties.filter(row => row.packagePresent).length;
  const presentCertificates = counties.filter(row => row.certificatePresent).length;
  const inventory = {
    schemaVersion: 'gridly-lp146-storage-inventory-v1', milestone: 'LP146', scope: 'PRODUCTION_STORAGE_RECONCILIATION',
    observationDate: '2026-08-04', bucket: 'certified-addresses', authoritativeManufacturingBaseline: 'LP130',
    ordering: 'ascending FIPS', classifications: ['PUBLISHED_AND_VERIFIED', 'PUBLISHED_NOT_VERIFIED', 'NOT_PUBLISHED'], counties
  };
  const summary = {
    schemaVersion: 'gridly-lp146-storage-reconciliation-summary-v1', milestone: 'LP146', observationDate: '2026-08-04',
    countiesEvaluated: counties.length,
    publishedAndVerified: count('PUBLISHED_AND_VERIFIED'), publishedNotVerified: count('PUBLISHED_NOT_VERIFIED'), notPublished: count('NOT_PUBLISHED'),
    packageTotals: { expected: counties.length, present: presentPackages, missing: counties.length - presentPackages, expectedBytes: counties.reduce((n, row) => n + row.packageByteCount, 0) },
    certificateTotals: { expected: counties.length, present: presentCertificates, missing: counties.length - presentCertificates },
    missingObjects: (counties.length - presentPackages) + (counties.length - presentCertificates), verificationFailures: 0,
    deterministicFipsOrdering: true,
    lp145StorageConclusion: 'CONFIRMED', storageStatus: 'BLOCKED',
    blockingReason: `${counties.length - presentPackages} manufactured county packages and ${counties.length - presentCertificates} certificates have no observed production Storage publication evidence.`,
    firstRemainingStatewideOperationalBlocker: 'Storage', activationPerformed: false
  };
  return { inventory, summary };
}

export async function writeReports({ verify = false } = {}) {
  const reports = await buildReports();
  for (const [name, value] of [['storage-inventory.json', reports.inventory], ['storage-reconciliation-summary.json', reports.summary]]) {
    const path = resolve(OUTPUT, name); const expected = stableJson(value);
    if (verify) { if (await readFile(path, 'utf8') !== expected) throw new Error(`LP146 output drift: ${name}`); }
    else { await mkdir(OUTPUT, { recursive: true }); await writeFile(path, expected); }
  }
  return reports;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verify = process.argv.includes('--verify'); const { summary } = await writeReports({ verify });
  console.log(`${verify ? 'Verified' : 'Wrote'} LP146: ${summary.publishedAndVerified} verified, ${summary.publishedNotVerified} unverified, ${summary.notPublished} not published.`);
}
