import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidence, verifyEvidence } from '../tools/wave3a/build-crossing-readiness.mjs';

test('Wave 3A reconstructs and guards the complete crossing partition', () => {
  const e=buildEvidence(), p=e['current-partition.json'];
  assert.deepEqual(p.counts,{ACTIVE_POSITIVE:27,ACTIVE_EMPTY:1,SOURCE_OR_GEOGRAPHIC_POSITIVE_INACTIVE:175,ZERO_GEOGRAPHIC_SOURCE_INACTIVE:51});
  assert.equal(p.union,254); assert.equal(p.duplicates,0); assert.equal(p.missing,0);
  assert.ok(p.countyFipsByClass.ACTIVE_EMPTY.includes('48457'));
});

test('Wave 3A fails closed until all geographic-owner packages are manufactured', () => {
  const e=buildEvidence(), inventory=e['package-inventory.json'], whatif=e['whatif.json'], preflight=e['preflight.json'];
  assert.equal(inventory.counts.PACKAGE_READY,0); assert.equal(inventory.counts.PACKAGE_BUILD_REQUIRED,175);
  assert.equal(whatif.eligible,false); assert.equal(whatif.applied,false); assert.deepEqual(whatif.plannedWrites,[]);
  assert.equal(whatif.zeroGeographicCandidatesIncluded,0); assert.equal(whatif.tylerActiveEmptyPreserved,true);
  assert.deepEqual(preflight.protectedSystemsModified,[]);
});

test('Wave 3A consumes certified geographic authority and blocks El Paso border rows', () => {
  const e=buildEvidence(), reconciliation=e['containment-reconciliation.json'];
  assert.equal(reconciliation.recomputedByWave3a,false);
  assert.equal(reconciliation.excludedFromGeographicOwnership,true);
  assert.deepEqual(reconciliation.blockedBorderRows.map(x=>x.crossingId),['019788P','019791X']);
  assert.equal(reconciliation.geographicallyAssigned,16099);
});

test('Wave 3A evidence is deterministic and checked in', () => assert.equal(verifyEvidence().pass,true));
