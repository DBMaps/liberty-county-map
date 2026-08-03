import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const batch = JSON.parse(await readFile(new URL('../evidence/lp124/texas-statewide-government-evidence-batch.json', import.meta.url)));
const inventory = JSON.parse(await readFile(new URL('../data/lp104/texas-counties.json', import.meta.url)));
const terminalValues = ['EVIDENCE_ACQUIRED', 'NO_EVIDENCE_FOUND', 'SOURCE_UNAVAILABLE', 'BLOCKED', 'REVIEW_REQUIRED', 'FAIL'];

test('LP124 has exactly the authoritative 254 unique FIPS-keyed county work units', () => {
  assert.equal(batch.workUnits.length, 254);
  assert.equal(new Set(batch.workUnits.map(({ countyFips }) => countyFips)).size, 254);
  assert.deepEqual(batch.workUnits.map(({ countyFips }) => countyFips).sort(), inventory.counties.map(({ fips }) => fips).sort());
  for (const unit of batch.workUnits) {
    assert.match(unit.countyFips, /^48\d{3}$/);
    assert.equal(unit.workUnitId, `lp124-county-${unit.countyFips}`);
    assert.equal(unit.evidenceClass, 'GOVERNMENT');
    assert.ok(terminalValues.includes(unit.terminalOutcome));
    assert.deepEqual(unit.checkpoint.stage, 'TERMINAL');
    assert.equal(unit.checkpoint.resumable, true);
  }
});

test('accepted GOVERNMENT records are deterministic, provenance-complete, contained, and isolated', () => {
  const required = ['recordId', 'evidenceClass', 'county', 'countyFips', 'assertionType', 'officialName', 'sourcePublisher', 'sourceUrl', 'observationDate', 'evidenceDate', 'sourcePriority', 'confidence', 'reviewStatus', 'reviewer', 'acquisitionMethod', 'countyContainment', 'candidateApproval', 'productionAuthorization', 'runtimeEligible'];
  for (const record of batch.records) {
    for (const field of required) assert.ok(Object.hasOwn(record, field), `${record.recordId} lacks ${field}`);
    assert.equal(record.recordId, `lp124-government-county-identity-${record.countyFips}`);
    assert.equal(record.evidenceClass, 'GOVERNMENT');
    assert.equal(record.countyContainment.countyFips, record.countyFips);
    assert.equal(record.countyContainment.status, 'CONFIRMED');
    assert.equal(record.candidateApproval, false);
    assert.equal(record.productionAuthorization, false);
    assert.equal(record.runtimeEligible, false);
  }
  for (const unit of batch.workUnits) for (const gap of unit.unresolved) assert.equal(gap.value, null);
});

test('truthfully records the restricted acquisition environment without inventing no-evidence results', () => {
  assert.equal(batch.sources[0].accessStatus, 'SOURCE_UNAVAILABLE');
  assert.match(batch.sources[0].exactUrl, /^https:\/\/api\.census\.gov\//);
  assert.ok(batch.sources[0].ownerPrerequisite);
  assert.equal(batch.records.length, 0);
  assert.ok(batch.workUnits.every(({ terminalOutcome }) => terminalOutcome === 'SOURCE_UNAVAILABLE'));
});

test('statewide summaries reconcile exactly with work units and records', () => {
  for (const outcome of terminalValues) assert.equal(batch.summary.terminalOutcomes[outcome], batch.workUnits.filter((unit) => unit.terminalOutcome === outcome).length);
  assert.equal(Object.values(batch.summary.terminalOutcomes).reduce((a, b) => a + b, 0), 254);
  assert.equal(batch.summary.acceptedEvidenceCount, batch.records.length);
  assert.equal(Object.values(batch.summary.assertionTypes).reduce((a, b) => a + b, 0), batch.records.length);
  assert.equal(Object.values(batch.summary.confidence).reduce((a, b) => a + b, 0), batch.records.length);
  assert.equal(Object.values(batch.summary.reviewStatus).reduce((a, b) => a + b, 0), batch.records.length);
  assert.equal(Object.values(batch.summary.sourcePriority).reduce((a, b) => a + b, 0), batch.records.length);
});

test('batch is sealed, deterministic in policy, candidate-only, and runtime-isolated', () => {
  const { seal, ...payload } = batch;
  assert.equal(seal.canonicalPayloadHash, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  assert.deepEqual(batch.acquisitionPolicy, { deterministic: true, idempotent: true, resumable: true, checkpointed: true, rateLimit: { maxConcurrentRequests: 1, requestsPerBatch: 1 }, runtimeIsolated: true });
  assert.equal(batch.candidateOnly, true);
  assert.equal(batch.runtimeModified, false);
  assert.equal(batch.countiesActivated, false);
  assert.equal(batch.candidateApproval, false);
  assert.equal(batch.productionAuthorization, false);
});
