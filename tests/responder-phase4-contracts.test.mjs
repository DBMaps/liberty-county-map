import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));
const old=read('reports/responder/responder-phase3-vector-map.json');
const map=read('reports/responder/responder-phase4-vector-map.json');
const frozen=[
  ...read('tests/contracts/responder/responder-v1-negative-vectors.json').vectors,
  ...read('tests/contracts/responder/responder-v1-positive-vectors.json').vectors,
];
let passed=0,failed=0;
function check(label,fn) {
  try { fn();passed++;console.log(`PASS ${label}`); }
  catch(error) { failed++;console.log(`FAIL ${label}: ${error.message}`); }
}
check('all 54 frozen vector IDs mapped exactly once',()=>{
  assert.equal(map.vectors.length,54);
  assert.deepEqual(map.vectors.map(v=>v.id).sort(),frozen.map(v=>v.id).sort());
});
check('nine Phase 2 complete vectors preserved',()=>{
  assert.deepEqual(map.previouslyPassedVectorIds,old.executableVectorIds);
  assert.equal(map.vectors.filter(v=>v.classification==='PREVIOUSLY PASSED FULL VECTOR').length,9);
});
check('zero new full vectors claimed',()=>{
  assert.deepEqual(map.newlyPassedVectorIds,[]);
  assert.equal(map.counts['NEWLY PASSED PHASE 4 FULL VECTOR'],0);
});
check('N03/N04 RLS evidence remains partial',()=>{
  assert.deepEqual(map.phase4RlsSubcheckIds,['N03-responder-wrong-org','N04-supervisor-wrong-org']);
  for(const id of map.phase4RlsSubcheckIds)
    assert.equal(map.vectors.find(v=>v.id===id)?.classification,'DEFERRED PHASE 5');
});
check('all Phase 3 partial geography vectors remain deferred',()=>{
  assert.deepEqual(map.phase3AuthoritySubcheckIds,old.phase3AuthoritySubcheckIds);
  for(const id of map.phase3AuthoritySubcheckIds)
    assert.equal(map.vectors.find(v=>v.id===id)?.classification,'DEFERRED PHASE 5');
});
check('exact Phase 4 count partition',()=>{
  assert.deepEqual(map.counts,{
    'PREVIOUSLY PASSED FULL VECTOR':9,
    'NEWLY PASSED PHASE 4 FULL VECTOR':0,
    'DEFERRED PHASE 5':39,
    'DEFERRED DASHBOARD':2,
    'DEFERRED CONSUMER':4,
  });
  assert.equal(Object.values(map.counts).reduce((a,b)=>a+b,0),54);
});
check('every classification count matches map entries',()=>{
  for(const [kind,count] of Object.entries(map.counts))
    assert.equal(map.vectors.filter(v=>v.classification===kind).length,count);
});
check('non-Phase-4 classifications stay unchanged',()=>{
  for(const prior of old.vectors.filter(v=>v.classification!=='DEFERRED PHASE 4')) {
    const expected=prior.classification==='EXECUTABLE FULL VECTOR'
      ? 'PREVIOUSLY PASSED FULL VECTOR' : prior.classification;
    assert.equal(map.vectors.find(v=>v.id===prior.id)?.classification,expected);
  }
});
check('local Phase 4 SQL and documentation exist outside production migrations',()=>{
  assert.ok(fs.existsSync(path.join(root,'db/responder-local/004_phase4_rls_authorization_apply.sql')));
  assert.ok(fs.existsSync(path.join(root,'docs/RESPONDER/RESPONDER-PHASE4-LOCAL-RLS-AUTHORIZATION.md')));
  assert.ok(!fs.existsSync(path.join(root,'supabase/migrations/004_phase4_rls_authorization_apply.sql')));
});
check('local SQL forces all 13 private tables',()=>{
  const sql=fs.readFileSync(path.join(root,'db/responder-local/004_phase4_rls_authorization_apply.sql'),'utf8');
  for(const name of ['organizations','organization_memberships','organization_authorities','agency_updates',
    'agency_update_events','organization_verification_events','organization_governance_events',
    'organization_invites','agency_operation_receipts','agency_program_controls',
    'local_auth_identities','county_geometry_catalog','phase4_session_bindings'])
    assert.ok(sql.includes(`'${name}'`),name);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
});
check('safe agency views use invoker security',()=>{
  const sql=fs.readFileSync(path.join(root,'db/responder-local/004_phase4_rls_authorization_apply.sql'),'utf8');
  assert.equal((sql.match(/WITH \(security_invoker=true\)/g)||[]).length,5);
});
check('frozen publishing and source flags remain false',()=>{
  const manifest=read('reports/responder/responder-v1-county-authority-manifest.json');
  assert.equal(manifest.agencyPublishingAuthorized,false);
  assert.equal(manifest.municipalAuthorityIncluded,false);
  assert.equal(manifest.upstreamDeployAuthorized,false);
});
console.log(`RESULT ${passed} passed, ${failed} failed`);
if(failed) process.exitCode=1;
