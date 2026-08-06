import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { BASELINE, PROTECTED_PATHS, REPORT_NAMES, ROOT, certify, encode, validateEvidence, writeReports } from '../../tools/lp169/certify-production-configuration.mjs';

test('reports disclose no secret values and accept statuses only', () => {
  const text=REPORT_NAMES.map(n=>fs.readFileSync(path.join(ROOT,'reports/lp169',n),'utf8')).join('\n');
  assert.doesNotMatch(text, /sb_(?:secret|service)_|postgres(?:ql)?:\/\/|PRIVATE KEY/);
  assert.equal(certify()['certification-summary.json'].secretValuesRead,0);
  assert.throws(()=>validateEvidence({schemaVersion:1,records:[{identifier:'X',status:'PRESENT',value:'secret'}]}),/forbidden/);
  assert.throws(()=>validateEvidence({schemaVersion:1,records:[{identifier:'X',status:'PRESENT',attestation:'sb_secret_abcdefghijklmnopqrstuv'}]}),/secret/);
});

test('certification is read-only and cannot authorize operations',()=>{
  const reports=certify(), summary=reports['certification-summary.json'];
  assert.deepEqual([summary.productionWrites,summary.deployments,summary.activations],[0,0,0]);
  assert.equal(summary.deploymentAuthorized,false); assert.equal(summary.activationAuthorized,false);
  assert.equal(reports['database-object-certification.json'].remoteWrites,0);
  assert.equal(reports['storage-inventory-certification.json'].objectsWritten,0);
  assert.equal(reports['storage-policy-certification.json'].policiesChanged,0);
});

test('missing credentials and owner evidence fail closed',()=>{
  const reports=certify();
  assert.equal(reports['supabase-project-certification.json'].status,'SOURCE_UNAVAILABLE');
  assert.equal(reports['storage-inventory-certification.json'].status,'SOURCE_UNAVAILABLE');
  assert.notEqual(reports['certification-summary.json'].overallClassification,'PRODUCTION_CONFIGURATION_CERTIFIED');
});

test('evidence validation detects duplicate identities and partial evidence stays partial',()=>{
  assert.throws(()=>validateEvidence({schemaVersion:1,records:[{identifier:'A',status:'PASS'},{identifier:'A',status:'PASS'}]}),/duplicate/);
  assert.doesNotThrow(()=>validateEvidence({schemaVersion:1,records:[{identifier:'SUPABASE_PROJECT',status:'PASS',method:'SAFE',attestation:'OWNER_ATTESTED'}]}));
});

test('storage baseline and runtime risks are governed',()=>{
  const reports=certify();
  assert.equal(reports['storage-inventory-certification.json'].expectedBaseline.addressPackages,254);
  assert.equal(reports['storage-inventory-certification.json'].expectedBaseline.addressRuntimeCertificates,254);
  assert.ok(reports['runtime-configuration-alignment.json'].repositoryFindings.some(x=>x.identifier.includes('LOCALHOST')&&x.status==='FAIL'));
});

test('public client and server secret classifications remain distinct',()=>{
  const items=certify()['production-configuration-contract.json'].items;
  assert.equal(items.find(x=>x.identifier==='SUPABASE_ANON_KEY').secretClassification,'PUBLIC_CLIENT_CREDENTIAL');
  assert.equal(items.find(x=>x.identifier==='SUPABASE_SERVICE_ROLE_KEY').secretClassification,'HIGH_SECRET');
});

test('protected identity uses Git blobs and ignores CRLF working-tree materialization',()=>{
  const before=certify()['protected-artifact-identities.json'];
  assert.ok(before.protectedArtifacts.every(x=>x.authoritativeIdentitySource==='GIT_BLOB'));
  const p=PROTECTED_PATHS[0], original=fs.readFileSync(path.join(ROOT,p));
  try { fs.writeFileSync(path.join(ROOT,p),original.toString('utf8').replace(/\n/g,'\r\n')); const after=certify()['protected-artifact-identities.json']; assert.deepEqual(after,before); }
  finally { fs.writeFileSync(path.join(ROOT,p),original); }
  const committed=execFileSync('git',['show',`${BASELINE}:${p}`],{cwd:ROOT,maxBuffer:64*1024*1024}); assert.ok(committed.length>0);
});

test('two isolated runs are byte-identical canonical LF',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'lp169-test-'));
  try {const a=path.join(temp,'a'),b=path.join(temp,'b');writeReports(a);writeReports(b);for(const n of REPORT_NAMES){const x=fs.readFileSync(path.join(a,n)),y=fs.readFileSync(path.join(b,n));assert.deepEqual(x,y);assert.equal(x.includes(13),false);assert.equal(x.toString(),encode(JSON.parse(x)));}}
  finally{fs.rmSync(temp,{recursive:true,force:true});}
});
