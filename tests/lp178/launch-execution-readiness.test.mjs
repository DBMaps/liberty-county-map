import assert from 'node:assert/strict';
import test from 'node:test';
import { BASELINE, COMPARISON_COMMIT, LP1782_APP_BLOB, LP1783_APP_BLOB, LP1783_REPAIR_COMMIT, LP1784_APP_BLOB, LP1785_APP_BLOB, LP1786_APP_BLOB, LP1786_REPAIR_COMMIT, LP1787_APP_BLOB, LP1787_REPAIR_COMMIT, REPAIR_BASELINE, build, verify } from '../../tools/lp178/close-launch-execution-readiness.mjs';

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
    authorizedLp1782RepairGitBlob: LP1782_APP_BLOB,
    authorizedLp1783RepairCommit: LP1783_REPAIR_COMMIT,
    authorizedLp1783RepairGitBlob: LP1783_APP_BLOB,
    authorizedLp1784RepairGitBlob: LP1784_APP_BLOB,
    authorizedLp1785RepairCommit: '1ff12dee19d59658b938ea7bd06611f735b067d5',
    authorizedLp1785RepairGitBlob: LP1785_APP_BLOB,
    authorizedLp1786RepairCommit: LP1786_REPAIR_COMMIT,
    authorizedLp1786RepairGitBlob: LP1786_APP_BLOB,
    authorizedLp1787RepairCommit: LP1787_REPAIR_COMMIT,
    authorizedLp1787RepairGitBlob: LP1787_APP_BLOB,
    currentComparisonCommit: COMPARISON_COMMIT,
    transition: 'LP178_BASELINE -> AUTHORIZED_LP178.1_ROUTE_WATCH_REPAIR -> AUTHORIZED_LP178.2_GEOMETRY_BRIDGE -> AUTHORIZED_LP178.3_ROUTE_AWARE_HYDRATION -> AUTHORIZED_LP178.3A_PROVENANCE_RECONCILIATION -> AUTHORIZED_LP178.4_LIVE_PROXIMITY_PROPAGATION -> AUTHORIZED_LP178.5_LIVE_ROUTE_PROGRESS_PROPAGATION -> AUTHORIZED_LP178.6_CLEARED_ROUTE_CONVERGENCE_AND_OFFICIAL_SOURCE_TRUTHFULNESS -> AUTHORIZED_LP178.7_WEATHER_EVIDENCE_PROVENANCE_TRUTHFULNESS'
  });

  const app = identities.artifacts.find(artifact => artifact.path === 'js/app.js');
  assert.equal(app.expectedBaselineCommit, LP1787_REPAIR_COMMIT);
  assert.equal(app.authorizedLp1782GitBlob, LP1782_APP_BLOB);
  assert.equal(app.authorizedLp1783GitBlob, LP1783_APP_BLOB);
  assert.equal(app.authorizedLp1784GitBlob, LP1784_APP_BLOB);
  assert.equal(app.authorizedLp1785GitBlob, LP1785_APP_BLOB);
  assert.equal(app.authorizedLp1786GitBlob, LP1786_APP_BLOB);
  assert.equal(app.authorizedLp1787GitBlob, LP1787_APP_BLOB);
  assert.equal(app.expectedGitBlob, LP1787_APP_BLOB);
  assert.equal(app.actualComparisonCommit, 'LP178.7_AUTHORIZED_GIT_BLOB');
  assert.equal(app.actualGitBlob, app.expectedGitBlob);
  assert.equal(app.classification, 'PASS');

  const historical = identities.artifacts.filter(artifact => artifact.path !== 'js/app.js');
  assert.ok(historical.every(artifact => artifact.expectedBaselineCommit === BASELINE));
  assert.ok(historical.every(artifact => artifact.expectedGitBlob === artifact.actualGitBlob));
});
