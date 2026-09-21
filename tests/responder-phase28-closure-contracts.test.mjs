import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {commandContract} from '../tools/responder/phase28/command-contract.mjs';
const evidence=new URL('../reports/responder/phase28-evidence/',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,evidence)));
test('Phase 27 contract: sole no-argument boolean Auth bridge and restricted command owner',()=>{
 const {catalog}=read('final-security-catalog.json');
 const bridges=catalog.functions.filter(f=>f.owner==='postgres'&&f.definer);
 assert.equal(bridges.length,1);assert.equal(bridges[0].name,'dispatch_private.has_live_aal2()');
 assert.match(bridges[0].definition,/RETURNS boolean/);assert.doesNotMatch(bridges[0].definition,/\b(?:INSERT INTO|UPDATE auth\.|DELETE FROM|EXECUTE)\b/);
 assert.deepEqual(catalog.commandOwner,{name:'dispatch_function_owner',login:false,superuser:false,bypassRls:true,createDb:false,createRole:false,inherit:false});
 for(const helper of ['current_actor_id','current_session_id'])assert.equal(catalog.functions.find(f=>f.name===`dispatch_private.${helper}()`).definer,false);
 for(const f of catalog.functions.filter(f=>f.definer))assert.deepEqual(f.settings,['search_path=""']);
});
test('Phase 27 contract: forced RLS and fixed neutral authority catalogs',()=>{
 const {catalog}=read('final-security-catalog.json');
 assert.ok(catalog.tables.every(t=>t.rls&&t.forced));
 assert.deepEqual(catalog.roleTemplates,['OWNER','ORGANIZATION_ADMIN','SUPERVISOR','OPERATOR','VIEWER']);
 assert.equal(catalog.permissions.length,29);assert.equal(catalog.capabilities.length,5);
 for(const table of catalog.tables)for(const acl of table.acl??[])assert.doesNotMatch(acl,/^(?:anon|authenticated|service_role)=.*[awdDT]/);
});
test('Phase 28 command certification covers the complete API without unknown or failed commands',()=>{
 const report=read('command-certification.json');assert.equal(report.total,40);assert.equal(report.pass,40);assert.equal(report.failed,0);assert.equal(report.unknown,0);
 assert.deepEqual(report.commands.map(c=>c.name),commandContract.map(c=>c.name));
 const dimensions=['authenticatedActor','liveUser','aal2','liveOrganizationMembership','liveUnitMembership','role','permission','scope','recordOwnership','expectedRevision','staleRevisionDenial','idempotency','atomicMutation','revisionCreation','receiptCreation','auditCreation','crossOrganizationDenial','crossUnitDenial','revokedMembershipDenial','revokedCapabilityDenial','replayBehavior'];
 for(const command of report.commands)for(const dimension of dimensions)assert.match(command.checks[dimension],/^(?:PASS|NOT_APPLICABLE|expected_revision|source_revision)/,command.name+' '+dimension);
 assert.equal(read('closure-vectors.json').status,'PASS');assert.equal(read('runtime-vectors.json').status,'PASS');
});
test('Phase 28 enum coverage and security fingerprint are exhaustive and reproducible',()=>{
 const report=read('enum-coverage.json'),security=read('final-security-catalog.json');
 assert.equal(report.unknown,0);assert.equal(report.staticCoverage,'EXHAUSTIVE');
 const expected=Object.entries(security.catalog.enums).flatMap(([type,values])=>values.map(value=>`${type}:${value}`)).sort();
 assert.deepEqual(report.values.map(v=>`${v.type}:${v.value}`).sort(),expected);
 assert.ok(report.values.every(v=>v.cast==='PASS'&&v.context&&v.runtimeEquivalence));
 assert.equal(createHash('sha256').update(JSON.stringify(security.catalog)).digest('hex'),security.fingerprint);
});
test('Phase 25 historical failure is proven independently of Phase 28 changes',()=>{
 const report=read('phase25-historical-classification.json');
 assert.equal(report.classification,'KNOWN_PREEXISTING_NON_PHASE28_FAILURE');
 assert.equal(report.sourceCommit.failed,0);assert.equal(report.startingHead.failed,1);assert.equal(report.current.exitCode,1);
 assert.ok(!report.startingHead.output.includes('ENOENT'));assert.match(report.startingHead.output,/ERR_ASSERTION/);
 assert.notEqual(report.startingHead.expected,report.startingHead.actual);assert.equal(report.historicalFilesModified,false);
});
