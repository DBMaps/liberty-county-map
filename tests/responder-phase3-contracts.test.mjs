import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { certifyCountySource } from '../tools/responder-local/load-county-authority.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const previous = read('reports/responder/responder-phase2-vector-map.json');
const current = read('reports/responder/responder-phase3-vector-map.json');
const negatives = read('tests/contracts/responder/responder-v1-negative-vectors.json').vectors;
const positives = read('tests/contracts/responder/responder-v1-positive-vectors.json').vectors;
let passed=0; let failed=0;
function check(label, fn) {
  try { fn(); passed++; console.log(`PASS ${label}`); }
  catch (error) { failed++; console.log(`FAIL ${label}: ${error.message}`); }
}
check('frozen source hash and 254 polygons', () => {
  const source=certifyCountySource();
  assert.equal(source.counties.length,254);
  assert.equal(source.hash,source.manifest.sourceSha256);
});
check('all 54 frozen vectors represented once', () => {
  const expected=[...negatives,...positives].map(v=>v.id).sort();
  assert.equal(expected.length,54);
  assert.deepEqual(current.vectors.map(v=>v.id).sort(),expected);
});
check('Phase 2 full executable vector IDs preserved', () => {
  assert.deepEqual(current.executableVectorIds,previous.executableVectorIds);
});
check('nine full vectors and 45 deferred', () => {
  assert.deepEqual(current.counts,{
    'EXECUTABLE FULL VECTOR':9,'DEFERRED PHASE 4':2,'DEFERRED PHASE 5':37,
    'DEFERRED DASHBOARD':2,'DEFERRED CONSUMER':4,
  });
});
check('classification counts match entries', () => {
  for (const [classification,count] of Object.entries(current.counts))
    assert.equal(current.vectors.filter(v=>v.classification===classification).length,count);
});
check('no Phase 3 authority subcheck claimed full', () => {
  assert.equal(current.phase3AuthoritySubcheckIds.length,8);
  for (const id of current.phase3AuthoritySubcheckIds)
    assert.equal(current.vectors.find(v=>v.id===id)?.classification,'DEFERRED PHASE 5');
});
check('Phase 3 subchecks match previous Phase 3 set', () => {
  assert.deepEqual([...current.phase3AuthoritySubcheckIds].sort(),
    previous.vectors.filter(v=>v.classification==='DEFERRED PHASE 3').map(v=>v.id).sort());
});
check('previous other classifications retained', () => {
  for (const old of previous.vectors.filter(v=>v.classification!=='DEFERRED PHASE 3')) {
    const expected=old.classification==='EXECUTABLE IN PHASE 2'
      ? 'EXECUTABLE FULL VECTOR' : old.classification;
    assert.equal(current.vectors.find(v=>v.id===old.id)?.classification,expected);
  }
});
check('municipal authority remains excluded in manifest', () => {
  const manifest=read('reports/responder/responder-v1-county-authority-manifest.json');
  assert.equal(manifest.municipalAuthorityIncluded,false);
  assert.equal(manifest.districtAuthorityIncluded,false);
});
check('frozen source deployment flags remain false', () => {
  const manifest=read('reports/responder/responder-v1-county-authority-manifest.json');
  assert.equal(manifest.upstreamActivateRuntimeAuthorized,false);
  assert.equal(manifest.upstreamDeployAuthorized,false);
  assert.equal(manifest.agencyPublishingAuthorized,false);
});
console.log(`RESULT ${passed} passed, ${failed} failed`);
if (failed) process.exitCode=1;
