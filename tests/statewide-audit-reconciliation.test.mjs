import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { build, reconcile } from '../tools/statewide-audit/reconcile-certified-export.mjs';

test('reconciliation preserves certified statewide identities and proves no contradiction', () => {
  const result = build();
  assert.deepEqual(result.denominators, {
    counties: 254, canonicalCommunities: 1859, memberships: 2058, multiCountyCommunities: 163, status: 'PASS',
  });
  assert.equal(result.classificationSummary.repositoryCertifiedCommunities, 1859);
  assert.equal(result.classificationSummary.roadwayExpectedEmpty, 481);
  assert.equal(result.classificationSummary.railExpectedEmpty, 155);
  assert.equal(result.classificationSummary.evidenceGapConditions, 0);
  assert.equal(result.classificationSummary.productionContradictions, 0);
  assert.equal(result.classificationSummary.systemicUnresolvedClasses, 6);
  assert.equal(result.conclusion, 'NO_PRODUCTION_CONTRADICTION_PROVEN');
  assert.ok(result.findings.expectedEmpty.some((item) => item.governedMemberships.length > 1));
});

test('missing evidence is not inferred as pass or fail', () => {
  const source = JSON.parse(fs.readFileSync('reports/statewide-audit/gridly-statewide-audit-export.json', 'utf8'));
  delete source.rows[0].railRepositoryContract;
  const result = reconcile(source);
  assert.equal(result.classificationSummary.evidenceGapConditions, 1);
  assert.equal(result.classificationSummary.productionContradictions, 0);
});

test('a repository contract mismatch is isolated as a contradiction', () => {
  const source = JSON.parse(fs.readFileSync('reports/statewide-audit/gridly-statewide-audit-export.json', 'utf8'));
  source.rows[0].contextStatus = 'FAIL';
  const result = reconcile(source);
  assert.equal(result.classificationSummary.productionContradictions, 1);
  assert.equal(result.findings.productionContradictions[0].canonicalKey, source.rows[0].canonicalKey);
});
