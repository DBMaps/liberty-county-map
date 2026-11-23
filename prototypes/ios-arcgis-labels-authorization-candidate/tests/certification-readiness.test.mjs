import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {leaseBinding} from '../gateway/foundation/protocol.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');
test('portable package gate verifies exact inventory and mock-only guarded dispatch template',()=>{
 execFileSync(process.execPath,[root+'certification/verify-package.mjs']);
 const workflow=read('certification/workflow.yml.in');
 assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/\n\s+push:|secrets\.|workflow_call:|xcodebuild archive|altool|notarytool/);
 assert.match(workflow,/github\.run_attempt == 1/);assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/CODE_SIGNING_ALLOWED=NO/);assert.match(workflow,/IPHONEOS_DEPLOYMENT_TARGET=16\.4/);
 assert.match(workflow,/992959f0467c781eb6a1637e69d87481238c3672/);
});
test('public-vector log checker accepts certified signature fixture and rejects mutation; new Swift execution is not implied',()=>{
 const original=JSON.parse(read('reference/prototypes/ios-arcgis-labels-gateway-deploy/native-fixed-path/Tests/GridlyFixedPathTileTests/tile-proof.json'));
 const vector={...original,publicKey:Buffer.from(original.publicKey,'base64').toString('base64url'),signature:Buffer.from(original.signature,'base64').toString('base64url'),
 challengeId:'00000000-0000-4000-8000-000000000003',paidEvidence:'fixture/paid'};
 vector.fingerprint=createHash('sha256').update(Buffer.from(vector.publicKey,'base64url')).digest('base64url');
 vector.binding=leaseBinding({appId:'com.gridlygo.gridly',challengeId:vector.challengeId,paidEvidence:vector.paidEvidence,fingerprint:vector.fingerprint,store:'sandbox',attest:'production'});
 const temp=root+'.scratch/stage4c-vector.log';mkdirSync(root+'.scratch',{recursive:true});
 const put=()=>writeFileSync(temp,'AUTHORIZATION_PUBLIC_VECTOR:'+Buffer.from(JSON.stringify(vector)).toString('base64')+'\n');
 try{put();execFileSync(process.execPath,[root+'certification/verify-vector.mjs',temp]);vector.binding='A'.repeat(43);put();assert.notEqual(spawnSync(process.execPath,[root+'certification/verify-vector.mjs',temp],{windowsHide:true}).status,0);}
 finally{unlinkSync(temp);}
});
test('Stage 4C leaves every existing Stage 4B product and reference source byte-identical',()=>{
 const inventory=JSON.parse(read('evidence/stage4c/stage4b-inventory.json'));
 for(const row of inventory.filter(row=>/^(native|server|gateway|sql|reference)\//.test(row.path))){
  assert.equal(createHash('sha256').update(readFileSync(root+row.path)).digest('hex'),row.sha256,row.path);
 }
});
