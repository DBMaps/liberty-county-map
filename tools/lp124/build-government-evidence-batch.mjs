import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const inventoryPath = resolve(ROOT, 'data/lp104/texas-counties.json');
const defaultOutput = resolve(ROOT, 'evidence/lp124/texas-statewide-government-evidence-batch.json');
const defaultSource = resolve(ROOT, 'evidence/lp124/sources/census-tiger-2025-county-identity-source.json');
export const CENSUS_URL = 'https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:48';
const outcomes = ['EVIDENCE_ACQUIRED', 'NO_EVIDENCE_FOUND', 'SOURCE_UNAVAILABLE', 'BLOCKED', 'REVIEW_REQUIRED', 'FAIL'];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const id = (kind, fips) => `lp124-${kind}-${fips}`;
const portable = (path) => relative(ROOT, path).replaceAll('\\', '/');
const requiredMetadata = ['sourcePublisher', 'sourceIdentity', 'observationDate', 'evidenceDate', 'sourcePriority'];

function fail(code, detail = '') { const error = new Error(`${code}${detail ? `: ${detail}` : ''}`); error.code = code; throw error; }
function validateMetadata(meta) {
  for (const field of requiredMetadata) if (!(field in meta) || (field !== 'evidenceDate' && !meta[field])) fail('INVALID_SOURCE_METADATA', field);
  if (meta.evidenceDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(meta.evidenceDate)) fail('INVALID_SOURCE_METADATA', 'evidenceDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.observationDate)) fail('INVALID_SOURCE_METADATA', 'observationDate');
}
function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length !== 254) fail('INVALID_ROW_COUNT', String(rows?.length));
  const seen = new Set();
  for (const row of rows) {
    if (!/^48\d{3}$/.test(row.countyFips || '')) fail('INVALID_COUNTY_FIPS', String(row.countyFips));
    if (seen.has(row.countyFips)) fail('DUPLICATE_COUNTY_FIPS', row.countyFips);
    if (typeof row.officialLegalName !== 'string' || !row.officialLegalName.endsWith(' County')) fail('INVALID_LEGAL_NAME', String(row.officialLegalName));
    seen.add(row.countyFips);
  }
  return rows;
}

export async function readLocalSource(sourcePath) {
  const path = sourcePath instanceof URL ? fileURLToPath(sourcePath) : resolve(sourcePath);
  let source;
  try { source = JSON.parse(await readFile(path, 'utf8')); } catch (error) { fail('MALFORMED_SOURCE_JSON', error.message); }
  validateMetadata(source);
  if (Array.isArray(source.counties)) return { metadata: source, rows: validateRows(source.counties), sourcePath: path, sourceHash: sha256(await readFile(path)) };
  if (source.format !== 'CENSUS_TIGER_COUNTY_GEOJSON' || !source.artifact?.path || !source.artifact?.sha256) fail('INVALID_SOURCE_FORMAT');
  const artifactPath = resolve(dirname(path), source.artifact.path);
  const body = await readFile(artifactPath);
  const actualHash = sha256(body);
  if (actualHash !== source.artifact.sha256) fail('SOURCE_HASH_MISMATCH', actualHash);
  let geojson;
  try { geojson = JSON.parse(body); } catch (error) { fail('MALFORMED_SOURCE_JSON', error.message); }
  const rows = geojson.features?.filter((feature) => feature.properties?.STATEFP === '48').map((feature) => ({
    countyFips: feature.properties.GEOID,
    officialLegalName: feature.properties.NAMELSAD,
  }));
  return { metadata: source, rows: validateRows(rows), sourcePath: path, sourceHash: actualHash };
}

export async function fetchCensusSource(fetchImpl = fetch, observationDate = new Date().toISOString().slice(0, 10)) {
  let response;
  try { response = await fetchImpl(CENSUS_URL, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'Gridly-LP124-evidence-acquisition/2.0' } }); }
  catch (error) { fail('NETWORK_ERROR', error.message); }
  if (!response.ok) fail(`HTTP_${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) fail('UNEXPECTED_CONTENT_TYPE', contentType || 'missing');
  let data;
  try { data = await response.json(); } catch (error) { fail('MALFORMED_JSON_RESPONSE', error.message); }
  if (!Array.isArray(data) || !Array.isArray(data[0])) fail('INVALID_CENSUS_SCHEMA');
  const [header, ...body] = data;
  for (const field of ['NAME', 'state', 'county']) if (!header.includes(field)) fail('MISSING_EXPECTED_HEADER', field);
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  const rows = body.map((row) => ({ countyFips: `${row[index.state]}${row[index.county]}`, officialLegalName: String(row[index.NAME]).replace(/, Texas$/, '') }));
  return { metadata: { sourcePublisher: 'United States Census Bureau', sourceIdentity: CENSUS_URL, observationDate, evidenceDate: '2020-04-01', sourcePriority: 'SECONDARY', authority: 'FEDERAL_GOVERNMENT', acquisitionMethod: 'OFFICIAL_API' }, rows: validateRows(rows), sourcePath: null, sourceHash: sha256(JSON.stringify(data)) };
}

export async function buildBatch({ source = defaultSource, live = false, output = defaultOutput, fetchImpl = fetch } = {}) {
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  let acquired = null, diagnostic = null;
  try { acquired = live ? await fetchCensusSource(fetchImpl) : await readLocalSource(source); }
  catch (error) { diagnostic = { code: error.code || 'SOURCE_ERROR', message: error.message }; }
  const sourceRows = new Map((acquired?.rows || []).map((row) => [row.countyFips, row.officialLegalName]));
  const observationDate = acquired?.metadata.observationDate || process.env.LP124_OBSERVATION_DATE || new Date().toISOString().slice(0, 10);
  const workUnits = inventory.counties.map(({ countyName, fips }) => {
    const expected = `${countyName} County`, observed = sourceRows.get(fips);
    const terminalOutcome = !acquired ? 'SOURCE_UNAVAILABLE' : observed === expected ? 'EVIDENCE_ACQUIRED' : 'REVIEW_REQUIRED';
    return { workUnitId: id('county', fips), county: expected, countyFips: fips, evidenceClass: 'GOVERNMENT', terminalOutcome,
      checkpoint: { stage: 'TERMINAL', resumable: true, attemptCount: 1, observedOn: observationDate },
      evidenceRecordIds: terminalOutcome === 'EVIDENCE_ACQUIRED' ? [id('government-county-identity', fips)] : [],
      unresolved: terminalOutcome === 'EVIDENCE_ACQUIRED' ? [] : [{ field: 'officialName', value: observed || null, reason: terminalOutcome === 'REVIEW_REQUIRED' ? 'LEGAL_NAME_MISMATCH' : diagnostic?.code || 'SOURCE_UNAVAILABLE' }],
    };
  });
  const meta = acquired?.metadata;
  const records = workUnits.filter((unit) => unit.terminalOutcome === 'EVIDENCE_ACQUIRED').map((unit) => ({
    recordId: id('government-county-identity', unit.countyFips), evidenceClass: 'GOVERNMENT', assertionType: 'COUNTY_GOVERNMENT_IDENTITY', county: unit.county, countyFips: unit.countyFips,
    officialName: sourceRows.get(unit.countyFips), sourcePublisher: meta.sourcePublisher, sourceUrl: meta.sourceIdentity, sourceArtifactSha256: acquired.sourceHash,
    observationDate, evidenceDate: meta.evidenceDate, sourcePriority: meta.sourcePriority, confidence: 'MEDIUM', reviewStatus: 'PENDING_REVIEW', reviewer: null,
    acquisitionMethod: meta.acquisitionMethod || 'OWNER_SUPPLIED_IMMUTABLE_SNAPSHOT', countyContainment: { status: 'CONFIRMED', method: 'AUTHORITATIVE_STATE_AND_COUNTY_FIPS_RELATIONSHIP', countyFips: unit.countyFips },
    candidateApproval: false, productionAuthorization: false, runtimeEligible: false,
  }));
  const countBy = (items, key, values) => Object.fromEntries(values.map((value) => [value, items.filter((item) => item[key] === value).length]));
  const batch = { schemaVersion: 'gridly-lp124-government-evidence-v2', milestone: 'LP124', baselineCommit: '334b7cc8', evidenceClass: 'GOVERNMENT', observationDate, immutable: true, candidateOnly: true, runtimeModified: false, countiesActivated: false, candidateApproval: false, productionAuthorization: false,
    acquisitionPolicy: { deterministic: true, idempotent: true, resumable: true, checkpointed: true, rateLimit: { maxConcurrentRequests: 1, requestsPerBatch: live ? 1 : 0 }, runtimeIsolated: true },
    sourceRoles: { controlInventory: { role: 'CONTROL_INVENTORY', path: 'data/lp104/texas-counties.json', sha256: sha256(await readFile(inventoryPath)), count: inventory.count }, acquisitionSource: { role: 'ACQUISITION_SOURCE', publisher: meta?.sourcePublisher || null, identity: meta?.sourceIdentity || (live ? CENSUS_URL : portable(resolve(source))), immutableSha256: acquired?.sourceHash || null, accessStatus: acquired ? 'AVAILABLE' : 'SOURCE_UNAVAILABLE', diagnostic, ownerPrerequisite: acquired ? null : 'Provide a governed authoritative JSON source snapshot with --source <path>, or repair the selected source and rerun.' }, corroboratingSource: null },
    workUnits, records, summary: { countyWorkUnitCount: workUnits.length, terminalOutcomes: countBy(workUnits, 'terminalOutcome', outcomes), acceptedEvidenceCount: records.length, assertionTypes: countBy(records, 'assertionType', ['COUNTY_GOVERNMENT_IDENTITY']), confidence: countBy(records, 'confidence', ['HIGH', 'MEDIUM', 'LOW', 'REVIEW_REQUIRED']), reviewStatus: countBy(records, 'reviewStatus', ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUIRED']), sourcePriority: countBy(records, 'sourcePriority', ['PRIMARY', 'SECONDARY', 'FALLBACK', 'UNSUPPORTED']) } };
  batch.seal = { algorithm: 'SHA-256', canonicalPayloadHash: sha256(JSON.stringify(batch)) };
  await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, `${JSON.stringify(batch, null, 2)}\n`); return batch;
}

function cliValue(flag) { const i = process.argv.indexOf(flag); return i < 0 ? undefined : process.argv[i + 1]; }
if (import.meta.url === pathToFileURL(process.argv[1]).href) await buildBatch({ source: cliValue('--source') || process.env.LP124_SOURCE || defaultSource, live: process.argv.includes('--live'), output: cliValue('--output') || defaultOutput });
