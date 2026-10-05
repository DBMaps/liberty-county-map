import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonicalContractHash} from '../tools/responder/phase29/contract-hash.mjs';
const root=new URL('../tools/responder/phase29/',import.meta.url);
const read=f=>readFileSync(new URL(f,root),'utf8');
const manifest=JSON.parse(read('contract-version.json'));
const registry=JSON.parse(read('taxonomy-v1.json'));
test('exact owner-approved versioned contract is preserved before implementation',()=>{
 assert.equal(manifest.title,'OWNER APPROVED PHASE 29 DURABLE REPORTING CONTRACT');
 assert.equal(manifest.version,'PHASE29-v1');
 assert.equal(canonicalContractHash(read(manifest.artifact)),'0ac80f48d3f6aa663cf3ae5f5ec04543a8b3196daa78188af0bbda295a7e7182');
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

const committedContract=()=>execFileSync('git',['show','HEAD:tools/responder/phase29/'+manifest.artifact],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
const canonicalHash='0ac80f48d3f6aa663cf3ae5f5ec04543a8b3196daa78188af0bbda295a7e7182';
test('LF checkout produces canonical contract hash',()=>{assert.equal(canonicalContractHash(committedContract().replaceAll('\r\n','\n')),canonicalHash)});
test('CRLF checkout produces same canonical contract hash',()=>{assert.equal(canonicalContractHash(committedContract().replaceAll('\r\n','\n').replaceAll('\n','\r\n')),canonicalHash)});
test('line-ending conversion alone preserves canonical hash',()=>{const lf=read(manifest.artifact).replaceAll('\r\n','\n');assert.equal(canonicalContractHash(lf),canonicalContractHash(lf.replaceAll('\n','\r\n')))});
test('actual contract text and spacing changes alter canonical hash',()=>{const text=committedContract();assert.notEqual(canonicalContractHash(text.replace('PURPOSE','PURPOSE CHANGED')),canonicalHash);assert.notEqual(canonicalContractHash(text+' '),canonicalHash);assert.notEqual(canonicalContractHash(text+'\n'),canonicalHash)});
test('recorded canonical hash matches authoritative committed artifact',()=>{const blob=committedContract();assert.equal(canonicalContractHash(blob),manifest.sha256);assert.equal(read(manifest.artifact).replaceAll('\r\n','\n'),blob.replaceAll('\r\n','\n'));assert.equal(registry.contractHash,manifest.sha256)});
