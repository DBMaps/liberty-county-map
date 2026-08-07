import assert from 'node:assert/strict';
import test from 'node:test';
import { build, verify } from '../../tools/lp178/close-launch-execution-readiness.mjs';

test('LP178 closes repository work without inferring external evidence', () => {
  const reports = build();
  const report = reports['launch-readiness-report.json'];
  assert.equal(report.items.length, 12);
  assert.ok(report.items.every(item => item.repositoryWorkComplete));
  assert.ok(report.items.every(item => item.classification !== 'COMPLETE'));
  assert.equal(report.retiredPrerequisite.blanketActivationBlocker, false);
  assert.equal(report.retiredPrerequisite.countySpecificRestrictionsPreserved, 11);
  assert.ok(Object.values(report.authorization).every(value => !value.authorizationGranted));
  assert.deepEqual(report.operationsPerformed, { deployments: 0, activations: 0, distributions: 0, publicLaunches: 0 });
  assert.equal(report.repositoryValidation.buildInputs.androidGradleWrapperJarAvailable, false);
  const android = report.items.find(item => item.id === 'LP167-B010-A');
  assert.equal(android.classification, 'BLOCKED_BY_ENVIRONMENT');
  assert.match(android.evidence, /no Android build PASS is inferred/);
});

test('LP178 has exact evidence fields and deterministic protected output', () => {
  const reports = build();
  assert.ok(reports['launch-readiness-report.json'].items.every(item => item.evidence && item.remainingAction));
  assert.equal(reports['protected-artifact-identities.json'].classification, 'PASS');
  assert.equal(verify(), true);
});
