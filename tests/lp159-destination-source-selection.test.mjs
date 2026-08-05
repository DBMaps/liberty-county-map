import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const selection = JSON.parse(readFileSync('data/lp159/destination-source-selection.json', 'utf8'));
const matrix = JSON.parse(readFileSync('reports/lp159/category-coverage-matrix.json', 'utf8'));
const licensing = JSON.parse(readFileSync('reports/lp159/licensing-assessment.json', 'utf8'));
const integration = JSON.parse(readFileSync('reports/lp159/integration-plan.json', 'utf8'));
const recommendation = JSON.parse(readFileSync('reports/lp159/final-destination-source-recommendation.json', 'utf8'));
test('LP159 remains planning-only', () => {
  assert.equal(selection.performsRuntimeChange, false);
  assert.equal(selection.performsDeploymentChange, false);
  assert.equal(selection.performsActivationChange, false);
  assert.equal(selection.protectedInfrastructureModified, false);
  assert.equal(integration.constraints.deployDestinationData, false);
  assert.equal(integration.constraints.activateRuntime, false);
});
test('LP159 classifies source launch readiness', () => {
  assert.deepEqual(recommendation.decisions.Approved.sort(), ['overture-places', 'texas-open-data-tnris-txdot-twdb'].sort());
  assert.ok(recommendation.decisions.ConditionallyApproved?.length === undefined);
  assert.ok(recommendation.decisions['Conditionally Approved'].includes('safegraph-places'));
  assert.ok(recommendation.decisions.Rejected.includes('google-places'));
});
test('LP159 covers required destination categories', () => {
  for (const family of ['retail','fuel','medical','government','education','transportation','recreation','public_safety','critical_infrastructure']) assert.ok(matrix.families[family], family);
  assert.ok(matrix.families.retail.examples.includes('H-E-B'));
  assert.ok(matrix.families.critical_infrastructure.examples.includes('Dams'));
});
test('LP159 documents licensing rights for each source', () => {
  const sourceIds = new Set(selection.sources.map((source) => source.id));
  for (const row of licensing.assessments) assert.ok(sourceIds.has(row.sourceId), row.sourceId);
  assert.equal(licensing.assessments.find((row) => row.sourceId === 'google-places').storage, 'rejected_for_durable_registry');
});
test('LP159 verification command passes', () => {
  const output = execFileSync('node', ['tools/lp159-verify-destination-source-selection.mjs'], { encoding: 'utf8' });
  assert.match(output, /"status": "PASS"/);
});
