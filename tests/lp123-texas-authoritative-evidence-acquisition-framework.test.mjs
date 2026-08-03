import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const definition = JSON.parse(await readFile(new URL('../frameworks/lp123/texas-authoritative-evidence-acquisition-framework.json', import.meta.url)));
const documentation = await readFile(new URL('../docs/LP123-TEXAS-AUTHORITATIVE-EVIDENCE-ACQUISITION-FRAMEWORK.md', import.meta.url), 'utf8');

test('LP123 defines the complete statewide source and evidence taxonomy', () => {
  assert.equal(definition.jurisdiction.countyCount, 254);
  assert.deepEqual(definition.sourcePriorities, ['PRIMARY', 'SECONDARY', 'FALLBACK', 'UNSUPPORTED']);
  assert.deepEqual(definition.evidenceClasses, ['COMMUNITY', 'DESTINATION', 'PUBLIC_SAFETY', 'HEALTHCARE', 'EDUCATION', 'TRANSPORTATION', 'PARK', 'GOVERNMENT']);
  assert.deepEqual(definition.confidenceValues, ['HIGH', 'MEDIUM', 'LOW', 'REVIEW_REQUIRED']);
  assert.deepEqual(definition.sourceClasses.map(({ id }) => id), ['GOVERNMENT', 'HEALTHCARE', 'EDUCATION', 'TRANSPORTATION', 'PARKS', 'PUBLIC_SERVICES']);
});

test('LP123 requires complete nullable-aware provenance and containment', () => {
  assert.deepEqual(definition.requiredProvenanceFields, ['county', 'countyFips', 'source', 'sourceUrl', 'observationDate', 'evidenceDate', 'confidence', 'reviewStatus', 'reviewer', 'countyContainment', 'acquisitionMethod']);
  assert.deepEqual(definition.nullableProvenanceFields, ['evidenceDate', 'reviewer']);
  assert.deepEqual(definition.countyContainmentStatuses, ['CONFIRMED', 'CONFLICT', 'UNRESOLVED']);
  assert.match(documentation, /postal city, ZIP, mailing address, or publisher name alone is insufficient/i);
});

test('workflow keeps review, candidate approval, and production authorization distinct', () => {
  assert.deepEqual(definition.workflow, ['SOURCE_DISCOVERY', 'EVIDENCE_ACQUISITION', 'NORMALIZATION', 'COUNTY_CONTAINMENT', 'PROVENANCE_ATTACHMENT', 'HUMAN_REVIEW', 'CANDIDATE_APPROVAL', 'PRODUCTION_AUTHORIZATION']);
  assert.equal(definition.batchStrategy.humanReviewRequired, true);
  assert.equal(definition.batchStrategy.candidateApprovalSeparate, true);
  assert.equal(definition.batchStrategy.productionAuthorizationSeparate, true);
});

test('statewide batches are class-scoped, county-complete, resumable, and runtime-isolated', () => {
  assert.equal(definition.batchStrategy.unit, 'ONE_EVIDENCE_CLASS_ACROSS_ALL_TEXAS_COUNTIES');
  assert.equal(definition.batchStrategy.expectedCountyWorkUnits, 254);
  assert.deepEqual(definition.batchStrategy.workUnitTerminalStatuses, ['EVIDENCE_ACQUIRED', 'NO_EVIDENCE_FOUND', 'SOURCE_UNAVAILABLE', 'BLOCKED', 'REVIEW_REQUIRED', 'FAIL']);
  assert.equal(definition.batchStrategy.runtimeIsolationRequired, true);
  assert.equal(definition.batchStrategy.resumable, true);
  assert.equal(definition.batchStrategy.idempotent, true);
});

test('LP123 preserves every protected production boundary', () => {
  assert.equal(definition.frameworkOnly, true);
  assert.equal(definition.statewideAcquisitionPerformed, false);
  assert.equal(definition.runtimeModified, false);
  assert.equal(definition.countiesActivated, false);
  assert.equal(definition.productionAuthorization, false);
  assert.deepEqual(definition.protectedSystems, ['SHARED_REPORTS', 'ROUTE_WATCH', 'AWARENESS_FILTERING', 'HAZARD_LIFECYCLE', 'ALERT_GENERATION', 'SUPABASE_SYNC']);
  assert.match(documentation, /Production remains unchanged\./);
});
