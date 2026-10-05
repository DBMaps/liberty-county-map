import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../tools/responder/phase29/',import.meta.url);
const read=f=>readFileSync(new URL(f,root),'utf8');
const manifest=JSON.parse(read('contract-version.json'));
const registry=JSON.parse(read('taxonomy-v1.json'));
test('exact owner-approved versioned contract is preserved before implementation',()=>{
 assert.equal(manifest.title,'OWNER APPROVED PHASE 29 DURABLE REPORTING CONTRACT');
 assert.equal(manifest.version,'PHASE29-v1');
 assert.equal(createHash('sha256').update(readFileSync(new URL(manifest.artifact,root))).digest('hex'),'3bb7740695a799632ee03b71f9daa9626b5e16f0bd455187bf3b53fe380029db');
 assert.equal(registry.contractHash,manifest.sha256);
 assert.match(read(manifest.artifact),/Do not implement until this exact contract has been preserved/);
});
test('owner public matrices preserve independent Police, Fire, EMS and Public Works eligibility',()=>{
 assert.equal(Object.values(registry.publicSubtypes).flat().length,18);
 assert.equal(registry.internalSubtypes.length,7);
 assert.deepEqual(Object.keys(registry.departmentPublic),['POLICE','FIRE','EMS','PUBLIC_WORKS']);
 assert.deepEqual(registry.departmentPublic.EMS,registry.departmentPublic.FIRE);
 assert.equal(registry.departmentPublic.POLICE.length,11);
 assert.equal(registry.departmentPublic.FIRE.length,13);
 assert.equal(registry.departmentPublic.PUBLIC_WORKS.length,11);
 assert.ok(!Object.values(registry.publicSubtypes).flat().includes('POLICE_ACTIVITY'));
 assert.ok(!registry.departmentPublic.POLICE.includes('FIRE_SMOKE_TRAVEL_IMPACT'));
 assert.ok(!registry.departmentPublic.PUBLIC_WORKS.includes('TRAFFIC_COLLISION'));
 assert.deepEqual(registry.onboarding,['POLICE','FIRE','EMS','PUBLIC_WORKS']);
});
test('local package defaults publishing off and refuses an unmarked or populated target',()=>{
 const sql=read('package.local.sql');assert.match(sql,/PHASE29_REFUSED non-disposable/);assert.match(sql,/PHASE29_REFUSED populated/);
 assert.match(sql,/PHASE29-v1'.*PHASE29-INDEPENDENT-v1',now\(\),false/);
 assert.doesNotMatch(sql,/UPDATE (?:public\.|report_retention\.)/);
 assert.match(sql,/REVOKE dispatch_function_owner FROM postgres/);
 assert.doesNotMatch(sql,/GRANT .* ON ALL TABLES/);
});
test('screening warning states clinical/Police exclusions and its practical limit',()=>{
 assert.match(registry.warning,/patient, clinical, CJIS, investigative, tactical/);
 assert.match(registry.warning,/Screening does not guarantee compliance/);
 const sql=read('package.local.sql');assert.match(sql,/PHASE29_UNEXPECTED_FIELDS/);assert.match(sql,/PHASE29_LEGACY_INTAKE_REFUSED/);assert.match(sql,/PHASE29_CONTENT_APPROVAL_DENIED/);assert.match(sql,/content_digest/);
});

test('eligibility function dollar quotes survive source and generated package',()=>{
 for(const file of ['schema.local.sql','package.local.sql']) for(const name of ['report_review_prerequisites','report_public_eligible']) {
  const statement=read(file).split('CREATE FUNCTION dispatch_private.'+name+'(')[1]?.split('CREATE FUNCTION ')[0];
  assert.ok(statement, file+': '+name+' exists');
  assert.match(statement,/AS \$\$\r?\n/,file+': '+name+' opens a valid dollar quote');
  assert.match(statement,/\$\$;\r?\n$/,file+': '+name+' closes the same dollar quote');
 }
});
