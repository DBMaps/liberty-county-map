import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidence, verifyEvidence } from '../tools/wave3a/build-crossing-readiness.mjs';

test('Wave 3A reconstructs and guards the complete crossing partition', () => {
  const e=buildEvidence(), p=e['current-partition.json'];
  assert.deepEqual(p.counts,{ACTIVE_POSITIVE:27,ACTIVE_EMPTY:1,SOURCE_ONLY_POSITIVE:173,SOURCE_ZERO_NOT_ACTIVATED:53});
  assert.equal(p.union,254); assert.equal(p.duplicates,0); assert.equal(p.missing,0);
  assert.ok(p.countyFipsByClass.ACTIVE_EMPTY.includes('48457'));
});

test('Wave 3A fails closed without candidate production packages', () => {
  const e=buildEvidence(), inventory=e['package-inventory.json'], whatif=e['whatif.json'];
  assert.equal(inventory.counts.PACKAGE_READY,0); assert.equal(inventory.counts.PACKAGE_BUILD_REQUIRED,173);
  assert.equal(whatif.eligible,false); assert.equal(whatif.applied,false); assert.deepEqual(whatif.plannedWrites,[]);
  assert.equal(whatif.zeroSourceCandidatesIncluded,0); assert.equal(whatif.tylerActiveEmptyPreserved,true);
});

test('Wave 3A evidence is deterministic and checked in', () => assert.equal(verifyEvidence().pass,true));
