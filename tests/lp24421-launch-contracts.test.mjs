import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {communitySubmissionContract,verifyCommunitySubmissionBundle} from '../tools/native-web.mjs';

test('generated submission manifest binds current client, PWA authority and schema deterministically',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'gridly-launch-contract-'));
 try {
  for(const path of ['index.html','js/app.js','js/gridly-report-protocol.js','js/gridlyPackageRegistry.js','service-worker.js']) {
   await mkdir(dirname(join(dir,path)),{recursive:true});await copyFile(path,join(dir,path));
  }
  const first=await communitySubmissionContract(dir);
  assert.deepEqual(await communitySubmissionContract(dir),first);
  assert.equal(first.legacyCreationCompatible,false);
  assert.equal(first.protocol_version,2);
  assert.equal(Object.keys(first.schema).length,5);
  const sw=await readFile('service-worker.js','utf8');
  assert.ok(sw.includes(`const GRIDLY_SW_VERSION = "${first.version}"`));
  assert.ok(sw.includes(`const GRIDLY_CLOSURE_CACHE_NAME = "${first.cache}"`));
  await writeFile(join(dir,'community-submission-contract.json'),JSON.stringify(first));
  assert.deepEqual(await verifyCommunitySubmissionBundle(dir),first);
  await writeFile(join(dir,'community-submission-contract.json'),JSON.stringify({...first,version:'retired'}));
  await assert.rejects(verifyCommunitySubmissionBundle(dir),/manifest is stale/);
  await writeFile(join(dir,'js/app.js'),'hazard-device-id-timestamp; direct legacy insert');
  await assert.rejects(verifyCommunitySubmissionBundle(dir),/Retired or mismatched submission client/);
 } finally {await rm(dir,{recursive:true,force:true});}
});

test('retired native client is rejected independently of ambient Android output',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'gridly-retired-client-'));
 try {
  await mkdir(join(directory,'js'));
  await writeFile(join(directory,'js/app.js'),'retired native app');
  await assert.rejects(verifyCommunitySubmissionBundle(directory),/Retired or mismatched submission client: js\/app.js/);
 } finally {await rm(directory,{recursive:true,force:true});}
});
