import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fixture,syntheticConfig} from './helpers.mjs';
import {tileProofBytes} from '../../../../gateway/tile-wire.mjs';

test('client and gateway origins must match even for an otherwise authenticated decision',async()=>{
 const {createFirstPartyGateway}=await import('../gateway.mjs'),f=await fixture(),input=await f.leaseInput();
 const gateway=createFirstPartyGateway({state:f.state,client:f.client,now:f.now,config:{origin:'https://different.gridly.invalid',enabled:true}});
 assert.notEqual((await gateway.issueLease(input)).status,201);assert.equal(f.counter(),1);assert.equal(f.state.metrics().leases,0);
});

test('unavailable operator enable callback is sanitized and fails closed',async()=>{
 const f=await fixture({authority:{isEnabled:()=>{throw Error('private operator detail');}}});
 assert.equal(await f.leaseInput(),null);assert.equal(f.counter(),0);
});
test('first-party lease reaches fixed signed POST and validated synthetic provider PNG',async()=>{
 const {createFirstPartyGateway}=await import('../gateway.mjs'),f=await fixture(),calls=[];
 const png=readFileSync(new URL('../../../../reference/prototypes/ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/valid.png',import.meta.url));
 const gateway=createFirstPartyGateway({state:f.state,client:f.client,now:f.now,config:{enabled:true,origin:syntheticConfig.labelOrigin,provider:{GRIDLY_LABELS_ESRI_ENABLED:'true',GRIDLY_LABELS_ESRI_CLIENT_ID:'synthetic-id',GRIDLY_LABELS_ESRI_CLIENT_SECRET:'synthetic-secret'}},
  transport:async(url,options)=>{calls.push({url,method:options.method,referer:options.headers.referer});return options.method==='POST'?Response.json({access_token:'synthetic-token',expires_in:3600}):new Response(png,{headers:{'content-type':'image/png'}});}});
 const p=await f.leaseInput(),lease=await gateway.issueLease(p);assert.equal(lease.status,201);
 const request={method:'POST',target:'/v1/imagery-labels/tile',body:'{"level":1,"row":0,"column":0}',leaseId:lease.leaseId,timestamp:f.now(),requestId:randomUUID()};
 request.signature=sign('sha256',tileProofBytes(request,syntheticConfig.labelOrigin),{key:f.native.tile.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const result=await gateway.requestTile(request);assert.equal(result.status,200);assert.deepEqual(result.body,png);assert.equal(calls.length,2);assert.ok(calls.every(v=>v.referer===undefined));
 assert.equal((await gateway.requestTile(request)).status,401);assert.equal(calls.length,2);assert.equal(f.state.metrics().attempts,1);
});

