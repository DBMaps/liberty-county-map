import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));

test('LP187 foundation is deterministic, exhaustive, fail-closed, and non-authorizing', () => {
  execFileSync(process.execPath, ['tools/lp187/build-texas-statewide-activation-foundation.mjs', 'verify']);
  const summary = read('reports/lp187/texas-statewide-activation-foundation-summary.json');
  const communities = read('reports/lp187/texas-county-community-readiness.json');
  const matrix = read('reports/lp187/texas-county-activation-prerequisite-matrix.json');
  const waves = read('reports/lp187/texas-activation-wave-plan.json');
  const restrictions = read('reports/lp187/restricted-county-restoration-plan.json');
  assert.equal(matrix.length, 254);
  assert.equal(communities.length, 254);
  assert.equal(new Set(matrix.map(x => x.countyFips)).size, 254);
  assert.deepEqual(matrix.map(x=>x.countyFips), [...matrix.map(x=>x.countyFips)].sort());
  assert.equal(summary.finalClassification, 'NO_COMPLETE_STRUCTURAL_FOUNDATION');
  assert.equal(summary.counts.currentOperational, 28);
  assert.equal(summary.counts.communityStructureRequired, 215);
  assert.equal(summary.counts.restricted, 11);
  assert.equal(summary.counts.currentOperational + summary.counts.communityStructureRequired + summary.counts.restricted, 254);
  assert.equal(summary.unrestricted215.directGovernancePreparationCount, 0);
  assert.equal(restrictions.length, 11);
  assert.ok(restrictions.every(x => x.restrictionStatus === 'PRESERVED' && x.restorationSteps.length === 6));
  assert.equal(waves.allCountyCoverageCount, 254);
  assert.ok(waves.waves.every(x => x.executionAuthorized === false));
  assert.deepEqual(summary.safety, {candidateArtifactsPreparedOnly:true,authorizationGranted:false,activationPerformed:false,deploymentPerformed:false,membershipChanged:false,restrictionRemoved:false,productionSupabaseTouched:false});
  assert.ok(matrix.every(x => x.deploymentAuthorizationStatus === 'NOT_AUTHORIZED' && x.activationAuthorizationStatus === 'NOT_AUTHORIZED'));
});

test('LP187 retains exact required county fields and restricted restoration scope', () => {
  const matrix = read('reports/lp187/texas-county-activation-prerequisite-matrix.json');
  const required = ['countyName','countyFips','currentOperationalStatus','addressIdentityPresent','addressPayloadAvailable','addressCertified','communityInventoryPresent','communityCount','communityCountywideFallbackPresent','communityRuntimeReady','communityCompletenessStatus','crossingPackagePresent','crossingCertified','crossingCount','runtimeIdentityPresent','runtimeGeometryPresent','candidateStatus','membershipStatus','deploymentAuthorizationStatus','deploymentStatus','activationAuthorizationStatus','activationStatus','restrictionStatus','restrictionReason','primaryBlocker','secondaryBlockers','statewidePathStatus','recommendedNextAction'];
  assert.ok(matrix.every(row => required.every(key => Object.hasOwn(row,key))));
  assert.deepEqual(matrix.filter(x=>x.restrictionStatus==='ACTIVE_PRESERVED').map(x=>x.countyName), ['Cameron County','Cherokee County','Dallas County','Denton County','Ector County','Hudspeth County','Midland County','Presidio County','Rusk County','Somervell County','Taylor County']);
});
