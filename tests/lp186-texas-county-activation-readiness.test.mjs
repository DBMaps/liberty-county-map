import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('LP186 reports are deterministic, exhaustive, reconciled, and non-authorizing', () => {
  execFileSync(process.execPath, ['tools/lp186/build-texas-county-activation-readiness.mjs', 'verify']);
  const inventory = JSON.parse(fs.readFileSync('reports/lp186/texas-county-activation-inventory.json'));
  const summary = JSON.parse(fs.readFileSync('reports/lp186/texas-county-activation-summary.json'));
  const restrictions = JSON.parse(fs.readFileSync('reports/lp186/county-restriction-reconciliation.json'));
  assert.equal(inventory.length, 254); assert.equal(new Set(inventory.map(x => x.fips)).size, 254);
  assert.deepEqual(summary.counts, { totalTexasCounties: 254, operational: 28, nonOperational: 226, activationReadyNow: 0, repositoryWorkRequired: 215, ownerOrExternalActionRequired: 0, restricted: 11, unknown: 0 });
  assert.equal(restrictions.length, 11); assert.equal(summary.crossings.certifiedCrossings, 3784);
  assert.ok(inventory.every(x => x.authorization.activation === 'NOT_AUTHORIZED' && x.authorization.deployment === 'NOT_AUTHORIZED'));
  assert.deepEqual(summary.safety, { countyActivationPerformed: false, restrictionRemoved: false, productionDeploymentPerformed: false, statewideLaunchAuthorizationCreated: false });
});
