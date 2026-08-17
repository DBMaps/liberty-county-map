#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireOne, AUTHORITY, inspectSource, loadAuthorities, officialUrl, PRODUCT, requiredMembers, selectRequests, sourceFilename } from '../lp207/acquire-tiger2025-roadway-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_ROOT = join(ROOT, 'reports/lp208');
const ACQUISITION_REPORT = join(REPORT_ROOT, 'statewide-tiger2025-roadway-source-acquisition.json');
const SOURCE_MANIFEST = join(REPORT_ROOT, 'statewide-tiger2025-roadway-source-manifest.json');
const RUNTIME = join(ROOT, 'data/roadway-runtime-manifest.json');
const RUNTIME_SHA256 = '56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd';
export const OWNER_ROOT = 'C:\\GitHub\\Gridly-Source-Data\\Census\\TIGER2025\\ROADS';
const PILOT_EVIDENCE = join(ROOT, 'reports/lp207/pilot-source-preflight.json');
const SPOTS = new Set(['48287', '48331', '48395', '48113', '48029', '48141', '48181', '48309', '48423', '48439', '48453']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = path => access(path).then(() => true, () => false);
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));

export async function inventory(options = {}) {
  const authorities = await loadAuthorities(options);
  const counties = selectRequests(authorities, authorities.cohort.missingCounties.map(x => x.countyFips));
  const protectedSet = new Set(authorities.cohort.existingRuntimeCounties.map(x => x.countyFips));
  const urls = counties.map(x => officialUrl(x.countyFips));
  const duplicateFips = counties.length - new Set(counties.map(x => x.countyFips)).size;
  const duplicateUrls = urls.length - new Set(urls).size;
  const overlap = counties.filter(x => protectedSet.has(x.countyFips)).length;
  if (counties.length !== 226 || duplicateFips || duplicateUrls || overlap || protectedSet.size !== 28) throw new Error('LP208 statewide cohort conservation failed closed');
  return { authorities, counties, duplicateFips, duplicateUrls, overlap };
}

const requireEqual = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`LP208 committed evidence invalid: ${label} must be ${expected}, received ${actual}`);
};

/** Verify the committed owner certificate without requiring the out-of-repository ZIP directory. */
export async function verifyCommittedEvidence() {
  const [acquisition, manifestDocument, runtimeBytes, inv] = await Promise.all([
    readFile(ACQUISITION_REPORT, 'utf8').then(JSON.parse),
    readFile(SOURCE_MANIFEST, 'utf8').then(JSON.parse),
    readFile(RUNTIME),
    inventory()
  ]);
  const expectedAccounting = {
    missingCohortCount: 226, existingValidAtStart: 3, acquisitionRequiredAtStart: 223,
    newlyAcquired: 223, finalValidSources: 226, missingSources: 0, failedAcquisitions: 0,
    invalidExistingSources: 0, duplicateFips: 0, duplicateUrls: 0, existingRuntimeOverlap: 0,
    texasCountyCount: 254, existingRuntimeRoadwayCount: 28, supabaseWrites: 0,
    runtimeActivations: 0, roadwayPackagesManufactured: 0, productionRoadwayPackageModifications: 0
  };
  for (const [field, expected] of Object.entries(expectedAccounting)) requireEqual(acquisition[field], expected, field);
  requireEqual(acquisition.readiness, 'READY_FOR_STATEWIDE_MISSING_COHORT_MANUFACTURING', 'readiness');
  requireEqual(manifestDocument.certificationComplete, true, 'manifest certificationComplete');
  requireEqual(manifestDocument.counties?.length, 226, 'manifest row count');
  requireEqual(sha(runtimeBytes), RUNTIME_SHA256, 'production runtime manifest SHA-256');
  for (const field of ['sha256Before', 'sha256After']) requireEqual(acquisition.productionRuntimeManifest?.[field], RUNTIME_SHA256, `productionRuntimeManifest.${field}`);
  requireEqual(acquisition.productionRuntimeManifest?.countyCountBefore, 28, 'productionRuntimeManifest.countyCountBefore');
  requireEqual(acquisition.productionRuntimeManifest?.countyCountAfter, 28, 'productionRuntimeManifest.countyCountAfter');
  requireEqual(acquisition.productionRuntimeManifest?.unchanged, true, 'productionRuntimeManifest.unchanged');

  const expectedByFips = new Map(inv.counties.map(county => [county.countyFips, county]));
  const fips = new Set(); const urls = new Set();
  for (const [index, row] of manifestDocument.counties.entries()) {
    const prefix = `manifest row ${index + 1}`;
    for (const field of ['countyFips', 'countyId', 'countyName', 'countySlug', 'sourceAuthority', 'sourceProduct', 'sourceVintage', 'filename', 'officialUrl', 'ownerPath', 'bytes', 'sha256']) {
      if (row[field] === null || row[field] === undefined || row[field] === '') throw new Error(`LP208 committed evidence invalid: ${prefix} lacks ${field}`);
    }
    const county = expectedByFips.get(row.countyFips);
    if (!county) throw new Error(`LP208 committed evidence invalid: ${prefix} is outside the frozen missing cohort`);
    for (const field of ['countyId', 'countyName', 'countySlug']) requireEqual(row[field], county[field], `${prefix}.${field}`);
    requireEqual(row.sourceAuthority, AUTHORITY, `${prefix}.sourceAuthority`);
    requireEqual(row.sourceProduct, PRODUCT, `${prefix}.sourceProduct`);
    requireEqual(row.sourceVintage, 2025, `${prefix}.sourceVintage`);
    requireEqual(row.filename, sourceFilename(row.countyFips), `${prefix}.filename`);
    requireEqual(row.officialUrl, officialUrl(row.countyFips), `${prefix}.officialUrl`);
    if (!Number.isInteger(row.bytes) || row.bytes <= 0) throw new Error(`LP208 committed evidence invalid: ${prefix}.bytes must be a positive integer`);
    if (!/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error(`LP208 committed evidence invalid: ${prefix}.sha256 is not SHA-256`);
    requireEqual(row.zipValid, true, `${prefix}.zipValid`);
    requireEqual(row.requiredMembersPresent, true, `${prefix}.requiredMembersPresent`);
    if (!['EXISTING_VALID_SOURCE', 'ACQUIRED_NEW_SOURCE'].includes(row.acquisitionStatus)) throw new Error(`LP208 committed evidence invalid: ${prefix}.acquisitionStatus is not certified`);
    requireEqual(row.certificationStatus, 'PASS', `${prefix}.certificationStatus`);
    fips.add(row.countyFips); urls.add(row.officialUrl);
  }
  requireEqual(fips.size, 226, 'unique manifest FIPS count');
  requireEqual(urls.size, 226, 'unique manifest URL count');
  requireEqual(manifestDocument.counties.filter(row => row.acquisitionStatus === 'EXISTING_VALID_SOURCE').length, 3, 'existing manifest source count');
  requireEqual(manifestDocument.counties.filter(row => row.acquisitionStatus === 'ACQUIRED_NEW_SOURCE').length, 223, 'new manifest source count');
  return { acquisition, manifest: manifestDocument.counties, results: manifestDocument.counties };
}

async function pilotMap() {
  const evidence = JSON.parse(await readFile(PILOT_EVIDENCE, 'utf8'));
  return new Map(evidence.results.filter(x => x.status === 'EXISTING_VALID_SOURCE' && x.zipValid && x.requiredMembersPresent).map(x => [x.countyFips, x]));
}

async function retryAcquire(root, county, options) {
  let result;
  const attempts = options.attempts ?? 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await acquireOne(root, county, options);
    if (result.status !== 'ACQUISITION_FAILED' || attempt === attempts) return { ...result, attempts: attempt };
    await sleep((options.retryDelayMs ?? 1000) * attempt);
  }
  return result;
}

export async function execute({ mode = 'whatif', sourceRoot = OWNER_ROOT, write = false, attempts = 3, retryDelayMs = 1000, interCountyDelayMs = 250, fetchImpl } = {}) {
  if (!['whatif', 'acquire', 'verify'].includes(mode)) throw new Error(`Unsupported LP208 mode: ${mode}`);
  if (mode === 'verify') {
    if (write) throw new Error('LP208 verify mode is read-only');
    return verifyCommittedEvidence();
  }
  const runtimeBefore = await readFile(RUNTIME);
  const { counties, duplicateFips, duplicateUrls, overlap, authorities } = await inventory();
  const pilots = await pilotMap();
  const ownerMounted = await exists(sourceRoot);
  const results = [];
  for (const county of counties) {
    const path = join(sourceRoot, sourceFilename(county.countyFips));
    let result;
    if (mode === 'whatif' && !ownerMounted && pilots.has(county.countyFips)) {
      const p = pilots.get(county.countyFips);
      result = { ...county, destinationPath: path, existingFile: true, bytes: p.bytes, sha256: p.sha256, zipValid: true, requiredMembersPresent: true, status: 'EXISTING_VALID_SOURCE', evidenceAuthority: 'LP207_OWNER_CERTIFICATION' };
    } else if (mode === 'acquire') result = await retryAcquire(sourceRoot, county, { attempts, retryDelayMs, fetchImpl });
    else result = await inspectSource(path, county, mode);
    results.push(result);
    if (mode === 'acquire' && interCountyDelayMs > 0 && results.length < counties.length) await sleep(interCountyDelayMs);
  }
  const valid = results.filter(x => ['EXISTING_VALID_SOURCE', 'ACQUIRED_NEW_SOURCE'].includes(x.status));
  const invalid = results.filter(x => ['EXISTING_INVALID_SOURCE', 'SOURCE_IDENTITY_MISMATCH'].includes(x.status));
  const failures = results.filter(x => x.status === 'ACQUISITION_FAILED');
  const missing = results.filter(x => x.status === 'SOURCE_MISSING');
  const existingAtStart = mode === 'whatif' ? valid.length : results.filter(x => x.status === 'EXISTING_VALID_SOURCE').length;
  const manifest = results.map(x => ({
    schemaVersion: 'gridly.lp208.tiger2025-roadway-source.v1', countyFips: x.countyFips, countyId: x.countyId, countyName: x.countyName, countySlug: x.countySlug,
    sourceAuthority: AUTHORITY, sourceProduct: PRODUCT, sourceVintage: 2025, filename: sourceFilename(x.countyFips), officialUrl: officialUrl(x.countyFips), ownerPath: `${OWNER_ROOT}\\${sourceFilename(x.countyFips)}`,
    bytes: x.bytes || null, sha256: x.sha256 || null, zipValid: Boolean(x.zipValid), requiredMembersPresent: Boolean(x.requiredMembersPresent),
    acquisitionStatus: ['EXISTING_VALID_SOURCE', 'ACQUIRED_NEW_SOURCE'].includes(x.status) ? x.status : null,
    certificationStatus: ['EXISTING_VALID_SOURCE', 'ACQUIRED_NEW_SOURCE'].includes(x.status) ? 'PASS' : 'PENDING_OWNER_ACQUISITION'
  }));
  const newlyAcquired = results.filter(x => x.status === 'ACQUIRED_NEW_SOURCE').length;
  const final = valid.length === 226 && !failures.length && !invalid.length && !overlap;
  const runtimeAfter = await readFile(RUNTIME);
  if (!runtimeBefore.equals(runtimeAfter)) throw new Error('Production roadway runtime manifest changed during LP208');
  const acquisition = {
    schemaVersion: 'gridly.lp208.statewide-tiger2025-roadway-source-acquisition.v1', generatedAt: '2026-08-17T00:00:00.000Z', mode,
    ownerExecutionRequired: !ownerMounted, ownerPath: OWNER_ROOT, missingCohortCount: counties.length, existingValidAtStart: existingAtStart,
    acquisitionRequiredAtStart: counties.length - existingAtStart, newlyAcquired, finalValidSources: valid.length, missingSources: missing.length,
    failedAcquisitions: failures.length, invalidExistingSources: invalid.length, duplicateFips, duplicateUrls, existingRuntimeOverlap: overlap,
    texasCountyCount: authorities.inventory.count, existingRuntimeRoadwayCount: authorities.cohort.existingRuntimeRoadwayCountyCount,
    supabaseWrites: 0, runtimeActivations: 0, roadwayPackagesManufactured: 0, productionRoadwayPackageModifications: 0,
    productionRuntimeManifest: { path: relative(ROOT, RUNTIME).replaceAll('\\', '/'), sha256Before: sha(runtimeBefore), sha256After: sha(runtimeAfter), countyCountBefore: 28, countyCountAfter: 28, unchanged: true },
    representativeControls: manifest.filter(x => SPOTS.has(x.countyFips)), readiness: final ? 'READY_FOR_STATEWIDE_MISSING_COHORT_MANUFACTURING' : 'BLOCKED_FOR_STATEWIDE_ROADWAY'
  };
  if (write) await writeReports(acquisition, manifest);
  return { acquisition, manifest, results };
}

async function writeReports(acquisition, manifest) {
  await mkdir(REPORT_ROOT, { recursive: true });
  await writeFile(join(REPORT_ROOT, 'statewide-tiger2025-roadway-source-acquisition.json'), json(acquisition));
  await writeFile(join(REPORT_ROOT, 'statewide-tiger2025-roadway-source-manifest.json'), json({ schemaVersion: 'gridly.lp208.statewide-tiger2025-roadway-source-manifest.v1', generatedAt: '2026-08-17T00:00:00.000Z', certificationComplete: acquisition.finalValidSources === 226, counties: manifest }));
  await writeFile(join(REPORT_ROOT, 'LP208-STATEWIDE-TIGER2025-ROADWAY-SOURCE-ACQUISITION.md'), `# LP208 — Statewide TIGER2025 Roadway Source Acquisition\n\n## Decision\n\n**${acquisition.readiness}**\n\nThe frozen cohort contains 226 counties. ${acquisition.existingValidAtStart} sources are certified at the recorded start and ${acquisition.acquisitionRequiredAtStart} require owner acquisition. This repository environment does not mount \`${OWNER_ROOT}\`; this is not evidence that owner files are globally missing. Run the owner command below, then commit its generated identity reports.\n\n## Owner command\n\n\`powershell -NoProfile -ExecutionPolicy Bypass -File tools/lp208/Acquire-LP208StatewideTigerRoadways.ps1 -Mode Acquire\`\n\nThe runner is sequential, validates or skips existing sources without overwrite, retries failed downloads at most three times with bounded backoff, and resumes county by county. It performs no manufacturing, upload, activation, or runtime mutation.\n\n## Current accounting\n\n- Existing valid at start: ${acquisition.existingValidAtStart}\n- Acquisition required: ${acquisition.acquisitionRequiredAtStart}\n- Final valid in this evidence: ${acquisition.finalValidSources}\n- Production roadway counties: 28 → 28\n- Runtime manifest SHA-256: \`${acquisition.productionRuntimeManifest.sha256Before}\`\n- Supabase writes / activations / packages manufactured: 0 / 0 / 0\n`);
}

async function main() {
  const args = process.argv.slice(2); const mode = args.includes('--acquire') ? 'acquire' : args.includes('--verify') ? 'verify' : 'whatif';
  const rootIndex = args.indexOf('--destination'); const sourceRoot = rootIndex >= 0 ? args[rootIndex + 1] : OWNER_ROOT;
  const write = args.includes('--write');
  const out = await execute({ mode, sourceRoot, write });
  process.stdout.write(`${out.acquisition.readiness}\n`);
  if (mode !== 'whatif' && out.acquisition.readiness !== 'READY_FOR_STATEWIDE_MISSING_COHORT_MANUFACTURING') process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP208 failed: ${error.message}\n`); process.exitCode = 1; });
