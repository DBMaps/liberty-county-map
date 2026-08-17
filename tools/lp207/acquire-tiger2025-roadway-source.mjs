#!/usr/bin/env node

/** Governed, no-overwrite TIGER/Line 2025 All Roads source acquisition. */
import { createHash } from 'node:crypto';
import { access, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY_PATH = join(ROOT, 'data/lp104/texas-counties.json');
const COHORT_PATH = join(ROOT, 'reports/lp206/statewide-roadway-missing-build-cohort.json');
export const PILOT_FIPS = Object.freeze(['48287', '48331', '48395']);
export const AUTHORITY = 'U.S. Census Bureau';
export const PRODUCT = 'TIGER/Line 2025 All Roads';
export const SOURCE_HOST = 'www2.census.gov';
const exists = path => access(path).then(() => true, () => false);
const hash = body => createHash('sha256').update(body).digest('hex');

export const sourceFilename = fips => `tl_2025_${fips}_roads.zip`;
export const officialUrl = fips => `https://${SOURCE_HOST}/geo/tiger/TIGER2025/ROADS/${sourceFilename(fips)}`;
export const requiredMembers = fips => ['shp', 'shx', 'dbf', 'prj', 'cpg'].map(ext => `tl_2025_${fips}_roads.${ext}`);

export async function loadAuthorities(paths = {}) {
  const inventory = JSON.parse(await readFile(paths.inventoryPath || INVENTORY_PATH, 'utf8'));
  const cohort = JSON.parse(await readFile(paths.cohortPath || COHORT_PATH, 'utf8'));
  if (inventory.count !== 254 || inventory.counties?.length !== 254) throw new Error('Authoritative Texas county inventory does not conserve to 254');
  if (cohort.missingRoadwayCountyCount !== 226 || cohort.missingCounties?.length !== 226) throw new Error('Frozen LP206 missing cohort does not conserve to 226');
  return { inventory, cohort };
}

export function selectRequests({ inventory, cohort }, inputs) {
  if (!Array.isArray(inputs) || !inputs.length) throw new Error('At least one explicit FIPS or --pilot is required; all-226 execution is disabled in LP207');
  const values = inputs.map(value => String(value).trim());
  if (values.some(value => !/^48\d{3}$/.test(value))) throw new Error('Every FIPS must match /^48\\d{3}$/');
  if (new Set(values).size !== values.length) throw new Error('Duplicate FIPS requests are not allowed');
  const counties = new Map(inventory.counties.map(county => [county.fips, county]));
  const missing = new Set(cohort.missingCounties.map(county => county.countyFips));
  const protectedFips = new Set(cohort.existingRuntimeCounties.map(county => county.countyFips));
  return values.map(fips => {
    const county = counties.get(fips);
    if (!county) throw new Error(`Unknown Texas county identity: ${fips}`);
    if (protectedFips.has(fips)) throw new Error(`Protected existing runtime roadway county rejected: ${fips}`);
    if (!missing.has(fips)) throw new Error(`FIPS is not in the frozen LP206 missing cohort: ${fips}`);
    const frozen = cohort.missingCounties.find(item => item.countyFips === fips);
    if (!frozen || frozen.countyName !== county.countyName) throw new Error(`Authoritative county identity disagreement: ${fips}`);
    return { countyFips: fips, countyId: frozen.countyId, countyName: frozen.countyName, countySlug: frozen.countySlug };
  });
}

export function validateZipBytes(body, fips) {
  if (!Buffer.isBuffer(body) && !(body instanceof Uint8Array)) throw new Error('ZIP body must be binary');
  if (!body.length) throw new Error('Source is zero bytes');
  let entries;
  try { entries = unzipSync(new Uint8Array(body)); } catch (error) { throw new Error(`Corrupt or unreadable ZIP: ${error.message}`); }
  const names = Object.keys(entries).map(name => basename(name).toLowerCase());
  const expected = requiredMembers(fips);
  const absent = expected.filter(name => !names.includes(name));
  if (absent.length) {
    const foreign = names.find(name => /^tl_2025_48\d{3}_roads\.shp$/.test(name) && !name.startsWith(`tl_2025_${fips}_`));
    if (foreign) throw new Error(`Source identity mismatch: expected ${fips}, found ${foreign.slice(8, 13)}`);
    throw new Error(`Missing required ZIP members: ${absent.join(', ')}`);
  }
  const unrelated = names.filter(name => /^tl_\d{4}_48\d{3}_roads\.(?:shp|shx|dbf|prj|cpg)$/.test(name) && !name.startsWith(`tl_2025_${fips}_`));
  if (unrelated.length) throw new Error(`Source identity mismatch: unrelated county/vintage members: ${unrelated.join(', ')}`);
  return { zipValid: true, requiredMembersPresent: true, requiredMembers: expected, optionalMembers: names.filter(name => !expected.includes(name)).sort() };
}

export async function inspectSource(path, county, mode = 'verify') {
  const base = { ...county, requestedUrl: officialUrl(county.countyFips), destinationPath: path, mode, existingFile: await exists(path), downloaded: false, bytes: 0, sha256: null, zipValid: false, requiredMembersPresent: false, failureReason: null };
  if (!base.existingFile) return { ...base, status: 'SOURCE_MISSING' };
  const body = await readFile(path); base.bytes = body.length; base.sha256 = hash(body);
  try { return { ...base, ...validateZipBytes(body, county.countyFips), status: 'EXISTING_VALID_SOURCE', acquisitionStatus: 'existing', authority: AUTHORITY, sourceProduct: PRODUCT, censusVintage: 2025, filename: sourceFilename(county.countyFips) }; }
  catch (error) { return { ...base, status: /identity mismatch/i.test(error.message) ? 'SOURCE_IDENTITY_MISMATCH' : 'EXISTING_INVALID_SOURCE', failureReason: error.message }; }
}

async function download(url, temporary, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== SOURCE_HOST) throw new Error('Acquisition URL must use HTTPS and the governed Census host');
  const response = await fetchImpl(url, { redirect: 'manual', headers: { accept: 'application/zip' } });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location || new URL(location, url).hostname !== SOURCE_HOST) throw new Error('Redirect to unexpected host rejected');
    throw new Error('Redirect response rejected; governed URL must respond directly');
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const type = (response.headers.get('content-type') || '').toLowerCase();
  if (type.includes('text/html')) throw new Error('HTML/error response rejected');
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length) throw new Error('Zero-byte response rejected');
  const handle = await open(temporary, 'wx'); try { await handle.writeFile(body); } finally { await handle.close(); }
  return body;
}

export async function acquireOne(destinationRoot, county, options = {}) {
  const destination = join(resolve(destinationRoot), sourceFilename(county.countyFips));
  const inspected = await inspectSource(destination, county, 'acquire');
  if (inspected.existingFile) return inspected;
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${Date.now()}.partial`;
  try {
    const body = await download(officialUrl(county.countyFips), temporary, options.fetchImpl || fetch);
    const validation = validateZipBytes(body, county.countyFips);
    if (await exists(destination)) throw new Error('Destination appeared during acquisition; no-overwrite gate stopped atomic promotion');
    await rename(temporary, destination);
    return { ...inspected, ...validation, existingFile: false, downloaded: true, bytes: body.length, sha256: hash(body), status: 'ACQUIRED_NEW_SOURCE', acquisitionStatus: 'acquired', authority: AUTHORITY, sourceProduct: PRODUCT, censusVintage: 2025, filename: sourceFilename(county.countyFips) };
  } catch (error) {
    await rm(temporary, { force: true });
    return { ...inspected, status: 'ACQUISITION_FAILED', failureReason: error.message };
  }
}

export function parseArguments(argv) {
  const options = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--whatif', '--verify', '--acquire', '--pilot', '--json'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--fips', '--destination'].includes(arg)) { if (!argv[++i]) throw new Error(`${arg} requires a value`); options[arg.slice(2)] = argv[i]; }
    else if (arg === '--all-missing') throw new Error('--all-missing execution is disabled in LP207');
    else throw new Error(`Unknown option: ${arg}`);
  }
  const modes = ['whatif', 'verify', 'acquire'].filter(mode => options[mode]);
  if (modes.length !== 1) throw new Error('Select exactly one mode: --whatif, --verify, or --acquire');
  if (options.pilot && options.fips) throw new Error('--pilot and --fips are mutually exclusive');
  if (!options.pilot && !options.fips) throw new Error('Use --pilot or explicit --fips; there is no default cohort');
  if ((options.verify || options.acquire) && !options.destination) throw new Error('--destination is required for --verify and --acquire');
  return options;
}

export async function run(options, hooks = {}) {
  const authorities = await loadAuthorities(hooks);
  const inputs = options.pilot ? PILOT_FIPS : options.fips.split(',');
  const counties = selectRequests(authorities, inputs);
  const mode = options.whatif ? 'whatif' : options.verify ? 'verify' : 'acquire';
  const results = [];
  for (const county of counties) {
    const destination = options.destination ? join(resolve(options.destination), sourceFilename(county.countyFips)) : null;
    if (mode === 'whatif') results.push({ ...county, requestedUrl: officialUrl(county.countyFips), destinationPath: destination, mode, status: 'WHATIF', existingFile: null, downloaded: false, bytes: null, sha256: null, zipValid: null, requiredMembersPresent: null, failureReason: null });
    else if (mode === 'verify') results.push(await inspectSource(destination, county, mode));
    else results.push(await acquireOne(options.destination, county, hooks));
  }
  return { schemaVersion: 'gridly.lp207.tiger2025-roadway-acquisition.v1', authority: AUTHORITY, sourceProduct: PRODUCT, mode, requestedCount: results.length, results };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const report = await run(options);
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : `${report.mode}: ${report.results.map(item => `${item.countyFips}=${item.status}`).join(', ')}\n`);
  if (report.results.some(item => ['EXISTING_INVALID_SOURCE', 'SOURCE_IDENTITY_MISMATCH', 'ACQUISITION_FAILED'].includes(item.status))) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP207 acquisition failed: ${error.message}\n`); process.exitCode = 1; });
