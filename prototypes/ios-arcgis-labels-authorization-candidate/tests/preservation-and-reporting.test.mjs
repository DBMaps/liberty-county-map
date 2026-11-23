import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyPaidReportProof,createPaidReportHandler} from '../reference/build18/supabase/functions/_shared/paid-report.mjs';
import {signResponse} from '../reference/build18/supabase/functions/_shared/entitlement/core.mjs';
import {appleRecord} from './fixtures.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const text=p=>read(p).toString('utf8').replaceAll('\r\n','\n');
test('all 141 reviewed reference copies retain their byte identity',()=>{
 const manifest=JSON.parse(read('evidence/source-copies.json'));for(const row of manifest.files)assert.equal(createHash('sha256').update(read(row.copy)).digest('hex'),row.sha256,row.copy);
});
test('consumer gateway preserves lease, tile proof, quotas, provider and PNG implementation byte-for-byte',()=>{
 for(const file of ['web-gateway.mjs','web-proof.mjs','tile-wire.mjs','foundation/protocol.mjs','foundation/state.mjs','foundation/gateway.mjs','foundation/esri.mjs','foundation/png.mjs'])
 assert.deepEqual(read('gateway/'+file),read('reference/prototypes/ios-arcgis-labels-gateway-deploy/supabase/functions/gridly-labels/'+file),file);
 assert.match(text('gateway/edge.mjs'),/const appId = 'com.gridlygo.gridly'/);
 assert.doesNotMatch(text('gateway/index.ts'),/Deno\.serve\(/);
});
test('candidate native plugins retain bridge method lists, services, registration defaults; labels cannot register or finish purchases',()=>{
 for(const name of ['GridlyStoreKitPlugin.swift','GridlyAppAttestPlugin.swift']){
  const before=text('reference/build18/ios/App/App/'+name),after=text('native/'+name);
  assert.deepEqual([...after.matchAll(/CAPPluginMethod\(name: "([^"]+)"/g)].map(m=>m[1]),[...before.matchAll(/CAPPluginMethod\(name: "([^"]+)"/g)].map(m=>m[1]));
 }
 const attest=text('native/GridlyAppAttestPlugin.swift');assert.match(attest,/com.gridlygo.gridly.appattest.v1/);assert.match(attest,/requireConfirmed: Bool = false/);assert.match(attest,/guard !requireConfirmed else/);
 const adapter=text('native/GridlyLabelsAuthorizationAdapter.swift');assert.doesNotMatch(adapter,/generateKey|attestKey|\.confirm\(|finishTransaction|javascript|Referer|client_secret/);
 assert.match(adapter,/Task.checkCancellation/);assert.match(adapter,/current == generation/);
 const transport=text('native/HTTPSLabelTransport.swift');assert.match(transport,/FixedPathTile.request/);assert.match(transport,/private let signingKey = P256.Signing.PrivateKey\(\)/);
 assert.match(text('native/FixedPathTile.swift'),/httpMethod = "POST"/);
});
test('unchanged Build 18 paid-report authority accepts production entitlement, rejects Sandbox labels and forged capabilities',async()=>{
 const now=Date.now(),keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const proof=await signResponse(appleRecord(now,{env:'Production'}),'n'.repeat(40),keys.privateKey);
 assert.equal(await verifyPaidReportProof(proof,{publicKey:keys.publicKey,now}),true);
 const sandbox=await signResponse(appleRecord(now),'n'.repeat(40),keys.privateKey);
 for(const value of [sandbox,JSON.stringify({leaseId:'synthetic',scope:'imagery-labels:read'}),'paid=true',proof.slice(0,-8)+'xxxxxxxx'])assert.equal(await verifyPaidReportProof(value,{publicKey:keys.publicKey,now}),false);
 let writes=0;const handler=createPaidReportHandler({publicKey:keys.publicKey,now:()=>now,writer:async()=>{writes++;return {data:{status:'synthetic_ok'}};}});
 const request=value=>new Request('https://report.invalid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'cancel_community_operation',args:{operation_id:'synthetic'},proof:value})});
 assert.equal((await handler(request(proof))).status,200);assert.equal((await handler(request(sandbox))).status,403);assert.equal(writes,1);
});
