import assert from 'node:assert/strict';
import test from 'node:test';
import { BASELINE, COMPARISON_COMMIT, REPAIR_BASELINE, build, verify } from '../../tools/lp178/close-launch-execution-readiness.mjs';

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

test('LP178 governs the authorized Route Watch protected-identity transition', () => {
  const identities = build()['protected-artifact-identities.json'];
  assert.deepEqual(identities.provenance, {
    originalLp178BaselineCommit: BASELINE,
    authorizedLp1781RepairCommit: REPAIR_BASELINE,
    currentComparisonCommit: COMPARISON_COMMIT,
    transition: 'LP178_BASELINE -> AUTHORIZED_LP178.1_ROUTE_WATCH_REPAIR -> RECONCILED_PROTECTED_IDENTITY'
  });

  const app = identities.artifacts.find(artifact => artifact.path === 'js/app.js');
  assert.equal(app.expectedBaselineCommit, REPAIR_BASELINE);
  assert.equal(app.expectedGitBlob, '33a6e95c69bb0112a2d1fd9292118fd4549f5244');
  assert.equal(app.actualGitBlob, app.expectedGitBlob);
  assert.equal(app.classification, 'PASS');

  const historical = identities.artifacts.filter(artifact => artifact.path !== 'js/app.js');
  assert.ok(historical.every(artifact => artifact.expectedBaselineCommit === BASELINE));
  assert.ok(historical.every(artifact => artifact.expectedGitBlob === artifact.actualGitBlob));
});
