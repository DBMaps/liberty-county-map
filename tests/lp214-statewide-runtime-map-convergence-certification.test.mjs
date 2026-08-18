import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCertification, run } from '../tools/lp214/build-statewide-drivetexas-runtime-parity-certification.mjs';

test('LP214 statewide runtime and map convergence closes every denominator', () => {
  const artifact = buildCertification();
  assert.deepEqual([artifact.totals.counties,artifact.totals.communities,artifact.totals.memberships,artifact.totals.multiCountyCommunities],[254,1859,2058,163]);
  for (const [key,value] of Object.entries(artifact.totals)) if (!['counties','communities','memberships','multiCountyCommunities','runtimeResolved'].includes(key)) assert.equal(value,0,key);
  assert.equal(artifact.totals.runtimeResolved,1859);
  assert.equal(artifact.communities.length,1859);
  assert.equal(artifact.contracts.markerPublication.forbidden,'SILENTLY_DROPPED');
  assert.equal(artifact.contracts.freshStartProviderContract.dimension,'FRESH_START_PROVIDER_CONVERGENCE');
  assert.equal(artifact.contracts.configurationReadinessContract.explicitSignal,'gridlyConfigurationReady');
  assert.equal(artifact.contracts.startupRecoveryContract.arbitraryTimeout,false);
  assert.deepEqual(Object.keys(artifact.controls).sort(),['austin','dallas','houston','multiCounty','rural']);
  assert(Object.values(artifact.controls).every(control => control?.focus === 'PASS'));
});

test('committed statewide runtime parity artifact is deterministic', () => assert.doesNotThrow(() => run({verify:true})));
