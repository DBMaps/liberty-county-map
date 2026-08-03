import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildBatch, fetchCensusSource, readLocalSource } from '../tools/lp124/build-government-evidence-batch.mjs';

const batch = JSON.parse(await readFile(new URL('../evidence/lp124/texas-statewide-government-evidence-batch.json', import.meta.url)));
const inventory = JSON.parse(await readFile(new URL('../data/lp104/texas-counties.json', import.meta.url)));
const sourcePath = new URL('../evidence/lp124/sources/census-tiger-2025-county-identity-source.json', import.meta.url);
const terminalValues = ['EVIDENCE_ACQUIRED', 'NO_EVIDENCE_FOUND', 'SOURCE_UNAVAILABLE', 'BLOCKED', 'REVIEW_REQUIRED', 'FAIL'];
const fixture = (counties = inventory.counties.map(({ countyName, fips }) => ({ countyFips: fips, officialLegalName: `${countyName} County` }))) => ({ schemaVersion: 'gridly-lp124-local-authoritative-source-v1', sourcePublisher: 'Texas authoritative test publisher', sourceIdentity: 'urn:test:immutable:texas-counties', observationDate: '2026-08-03', evidenceDate: null, sourcePriority: 'SECONDARY', acquisitionMethod: 'OWNER_SUPPLIED_IMMUTABLE_SNAPSHOT', counties });
async function tempSource(value) { const root = await mkdtemp(join(tmpdir(), 'lp124-')); const path = join(root, 'source.json'); await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value)); return { path, output: join(root, 'batch.json') }; }
const jsonResponse = (body, contentType = 'application/json') => ({ ok: true, status: 200, headers: new Headers({ 'content-type': contentType }), json: async () => body });

test('governed local authoritative snapshot completes exact 254-row reconciliation', async () => {
  const source = await readLocalSource(sourcePath);
  assert.equal(source.rows.length, 254);
  const f = await tempSource(fixture()); const result = await buildBatch({ source: f.path, output: f.output });
  assert.equal(result.records.length, 254); assert.equal(result.summary.terminalOutcomes.EVIDENCE_ACQUIRED, 254);
});

test('checked-in batch has exactly 254 unique FIPS-keyed work units and authentic accepted records', () => {
  assert.equal(batch.workUnits.length, 254); assert.equal(new Set(batch.workUnits.map(x => x.countyFips)).size, 254);
  assert.deepEqual(batch.workUnits.map(x => x.countyFips).sort(), inventory.counties.map(x => x.fips).sort());
  assert.equal(batch.records.length, 254);
  for (const unit of batch.workUnits) { assert.match(unit.countyFips, /^48\d{3}$/); assert.equal(unit.workUnitId, `lp124-county-${unit.countyFips}`); assert.equal(unit.terminalOutcome, 'EVIDENCE_ACQUIRED'); assert.equal(unit.checkpoint.resumable, true); }
  for (const record of batch.records) { assert.equal(record.recordId, `lp124-government-county-identity-${record.countyFips}`); assert.equal(record.evidenceClass, 'GOVERNMENT'); assert.equal(record.assertionType, 'COUNTY_GOVERNMENT_IDENTITY'); assert.equal(record.confidence, 'MEDIUM'); assert.equal(record.reviewStatus, 'PENDING_REVIEW'); assert.equal(record.reviewer, null); assert.equal(record.countyContainment.status, 'CONFIRMED'); assert.equal(record.candidateApproval, false); assert.equal(record.productionAuthorization, false); assert.equal(record.runtimeEligible, false); }
});

test('duplicate and missing FIPS are rejected', async () => {
  const duplicate = fixture(); duplicate.counties[1].countyFips = duplicate.counties[0].countyFips;
  await assert.rejects(() => tempSource(duplicate).then(x => readLocalSource(x.path)), { code: 'DUPLICATE_COUNTY_FIPS' });
  const missing = fixture(); missing.counties.pop();
  await assert.rejects(() => tempSource(missing).then(x => readLocalSource(x.path)), { code: 'INVALID_ROW_COUNT' });
});

test('legal-name mismatch routes only that county to REVIEW_REQUIRED', async () => {
  const value = fixture(); value.counties[0].officialLegalName = 'Wrong County'; const f = await tempSource(value);
  const result = await buildBatch({ source: f.path, output: f.output });
  assert.equal(result.summary.terminalOutcomes.REVIEW_REQUIRED, 1); assert.equal(result.records.length, 253);
  assert.equal(result.workUnits[0].unresolved[0].reason, 'LEGAL_NAME_MISMATCH');
});

test('live adapter validates content type and rejects HTTP-200 HTML specifically', async () => {
  await assert.rejects(() => fetchCensusSource(async () => jsonResponse('<html>Missing Key</html>', 'text/html')), { code: 'UNEXPECTED_CONTENT_TYPE' });
});

test('live adapter rejects malformed JSON, missing headers, duplicate rows, and non-254 responses', async () => {
  const malformed = { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => { throw new SyntaxError('bad'); } };
  await assert.rejects(() => fetchCensusSource(async () => malformed), { code: 'MALFORMED_JSON_RESPONSE' });
  await assert.rejects(() => fetchCensusSource(async () => jsonResponse([['NAME', 'state']])), { code: 'MISSING_EXPECTED_HEADER' });
  const rows = inventory.counties.map(({ countyName, fips }) => [`${countyName} County, Texas`, '48', fips.slice(2)]);
  rows[1][2] = rows[0][2];
  await assert.rejects(() => fetchCensusSource(async () => jsonResponse([['NAME', 'state', 'county'], ...rows])), { code: 'DUPLICATE_COUNTY_FIPS' });
  await assert.rejects(() => fetchCensusSource(async () => jsonResponse([['NAME', 'state', 'county'], ...rows.slice(1)])), { code: 'INVALID_ROW_COUNT' });
});

test('malformed local JSON is source-unavailable with preserved diagnostic', async () => {
  const f = await tempSource('{bad'); const result = await buildBatch({ source: f.path, output: f.output });
  assert.equal(result.sourceRoles.acquisitionSource.diagnostic.code, 'MALFORMED_SOURCE_JSON'); assert.equal(result.summary.terminalOutcomes.SOURCE_UNAVAILABLE, 254); assert.equal(result.records.length, 0);
});

test('sealing is deterministic and production boundary remains closed', async () => {
  const f = await tempSource(fixture()); const one = await buildBatch({ source: f.path, output: f.output }); const two = await buildBatch({ source: f.path, output: f.output });
  assert.equal(one.seal.canonicalPayloadHash, two.seal.canonicalPayloadHash);
  const { seal, ...payload } = batch; assert.equal(seal.canonicalPayloadHash, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  assert.equal(batch.candidateOnly, true); assert.equal(batch.runtimeModified, false); assert.equal(batch.countiesActivated, false); assert.equal(batch.candidateApproval, false); assert.equal(batch.productionAuthorization, false);
});

test('statewide summaries reconcile exactly', () => {
  for (const outcome of terminalValues) assert.equal(batch.summary.terminalOutcomes[outcome], batch.workUnits.filter(x => x.terminalOutcome === outcome).length);
  assert.equal(Object.values(batch.summary.terminalOutcomes).reduce((a, b) => a + b, 0), 254); assert.equal(batch.summary.acceptedEvidenceCount, batch.records.length);
});
