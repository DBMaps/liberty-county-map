#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireOne, AUTHORITY, inspectSource, loadAuthorities, officialUrl, PRODUCT, requiredMembers, selectRequests, sourceFilename } from '../lp207/acquire-tiger2025-roadway-source.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_ROOT = join(ROOT, 'reports/lp208');
const RUNTIME = join(ROOT, 'data/roadway-runtime-manifest.json');
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
