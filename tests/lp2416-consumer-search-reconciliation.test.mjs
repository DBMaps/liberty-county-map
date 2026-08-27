import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { buildReconciliation, cohortFips, manuallyProvenFips, reconcileRow } from '../tools/lp2416/consumer-search-reconciliation.mjs';

const report = buildReconciliation();
const evidence = JSON.parse(fs.readFileSync('reports/lp2416/statewide-provider-results.json'));
const qualitySource = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const context = { window: {} }; context.globalThis = context.window; vm.runInNewContext(qualitySource, context);
const quality = context.window.GRIDLY_LP101_SEARCH_QUALITY;

test('exact governed statewide and fixed cohort membership is conserved', () => {
  assert.equal(report.rows.length, 254);
  assert.equal(new Set(report.rows.map(row => row.countyFips)).size, 254);
  assert.deepEqual([...cohortFips].sort(), ['48071','48073','48113','48141','48201','48229','48355','48375','48403','48439','48453','48465']);
  assert.equal(report.rows.filter(row => cohortFips.includes(row.countyFips) && !manuallyProvenFips.includes(row.countyFips)).length, 10);
});

test('queries are unchanged and every provider-certified candidate publishes', () => {
  const sourceQueries = new Map(evidence.rows.map(row => [row.countyFips, row.seedQuery]));
  report.rows.forEach(row => {
    assert.equal(row.query, sourceQueries.get(row.countyFips));
    assert.equal(row.providerCertifiedCandidateCount, 1);
    assert.equal(row.stageCounts.finalPublishedCount, 1);
    assert.equal(row.classification, 'PASS');
    assert.equal(Object.values(row.stageCounts).every(count => count === 1), true);
  });
  assert.equal(report.summary.publicationLossTotal, 0);
});

test('structured Texas satisfies geography while wrong state and missing semantics fail', () => {
  const base = { title: 'Cherokee County Courthouse', label: 'Cherokee County Courthouse', type: 'government', raw: { categories: ['courthouse'], address: { county: 'Cherokee County', state: 'Texas', state_code: 'TX' } } };
  const query = 'Cherokee County Courthouse, Cherokee County, Texas';
  assert.equal(quality.businessResultRelevant(query, base), true);
  assert.equal(quality.businessResultRelevant(query, { ...base, raw: { ...base.raw, address: { ...base.raw.address, state: 'Oklahoma', state_code: 'OK' } } }), false);
  assert.equal(quality.businessResultRelevant('Cherokee County Hospital, Cherokee County, Texas', base), false);
});

test('candidate county identity never falls back to current awareness', () => {
  assert.equal(report.summary.wrongCountyTotal, 0);
  assert.equal(report.summary.currentAwarenessFallbackTotal, 0);
  report.rows.forEach(row => {
    assert.equal(row.selectedCandidate.countyId, `${evidence.rows.find(source => source.countyFips === row.countyFips).expectedCountyId}-tx`);
    if (row.countyName !== 'Liberty') assert.notEqual(row.selectedCandidate.countyId, 'liberty-tx', `${row.countyName} inherited simulated awareness`);
  });
});

test('losses fail closed with an explicit first stage and rejection reason', () => {
  const source = evidence.rows[0];
  const rejected = reconcileRow({ ...source, providerOutcome: 'NO_RESULT', providerEvidenceState: 'NOT_CERTIFIED' });
  assert.equal(rejected.classification, 'OWNER_REVIEW_REQUIRED');
  assert.equal(rejected.firstLosingStage, 'providerCanonicalCount');
  assert.equal(rejected.rejectionCode, 'LOST_AT_PROVIDERCANONICAL');
});

test('dedupe retains at least one valid duplicate and Sabine stays a copy observation', () => {
  assert.equal(report.rows.every(row => !row.stageCounts.intentAcceptedCount || row.stageCounts.dedupedCount === 1), true);
  const sabine = report.rows.find(row => row.countyFips === '48403');
  assert.equal(sabine.observation, 'FIXTURE_COPY_CLEANUP_CONFIRMED_CLEAN');
  assert.equal(sabine.classification, 'PASS');
});

test('audit implementation has no county-specific search behavior', () => {
  const source = fs.readFileSync('tools/lp2416/consumer-search-reconciliation.mjs', 'utf8');
  const contract = source.slice(source.indexOf('export function reconcileRow'), source.indexOf('export function buildReconciliation'));
  assert.doesNotMatch(contract, /Chambers|Cherokee|48071|48073/);
});
