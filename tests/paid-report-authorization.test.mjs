import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createPaidReportHandler,verifyPaidReportProof} from '../supabase/functions/_shared/paid-report.mjs';

const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const now=Date.parse('2026-10-01T12:00:00.000Z');
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const claims=(platform='google',extra={})=>({platform,productId:'com.gridlygo.gridly.monthly',subscriptionState:'active',entitlementState:'entitled',
  currentPeriodEnd:new Date(now+86400000).toISOString(),lastVerifiedAt:new Date(now).toISOString(),verificationSource:'gridly_server_store_api',
  environment:'production',restoreAvailable:true,errorCategory:'none',nonce:'n'.repeat(48),audience:'com.gridlygo.gridly',
  expiresAt:new Date(now+300000).toISOString(),...extra});
async function sign(body,key=keys.privateKey){
  const input=enc({alg:'ES256',typ:'gridly-entitlement-v1'})+'.'+enc(body);
  const signature=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(input));
  return input+'.'+Buffer.from(signature).toString('base64url');
}
const args={submission_token:'00000000-0000-4000-8000-000000000001',report:{crossing_id:'DOT-123'},reporter_device_id:'test-device'};
const request=(proof,operation='submit_community_observation')=>new Request('https://example.invalid/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({proof,operation,args})});

test('production Google and Apple proof reach the trusted atomic writer; reporting OFF still wins',async()=>{
  for(const platform of ['google','apple']){
    const proof=await sign(claims(platform));let calls=0;
    const handler=createPaidReportHandler({publicKey:keys.publicKey,now:()=>now,crypto:webcrypto,writer:async()=>{calls++;return {data:{status:'accepted'}};}});
    assert.equal((await (await handler(request(proof))).json()).status,'accepted');assert.equal(calls,1);
    const off=createPaidReportHandler({publicKey:keys.publicKey,now:()=>now,crypto:webcrypto,writer:async()=>({data:{status:'maintenance'}})});
    assert.equal((await (await off(request(proof))).json()).status,'maintenance');
  }
});
test('missing, forged, expired, wrong audience/product/environment and non-entitled proof never reach writer',async()=>{
  const other=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  const proofs=[undefined,await sign(claims(),other.privateKey),await sign(claims('google',{expiresAt:new Date(now-1000).toISOString()})),
    await sign(claims('google',{audience:'another.app'})),await sign(claims('google',{productId:'other.product'})),
    await sign(claims('google',{environment:'sandbox/test'})),await sign(claims('google',{entitlementState:'not_entitled',subscriptionState:'inactive'}))];
  let calls=0;const handler=createPaidReportHandler({publicKey:keys.publicKey,now:()=>now,crypto:webcrypto,writer:async()=>{calls++;return {data:{status:'accepted'}};}});
  for(const [index,proof] of proofs.entries())assert.equal((await handler(request(proof))).status,index===0?400:403);
  assert.equal(calls,0);
});
test('proof validation rejects malformed input and never returns signed material',async()=>{
  const proof=await sign(claims());
  assert.equal(await verifyPaidReportProof('bad',{publicKey:keys.publicKey,now,crypto:webcrypto}),false);
  assert.equal(await verifyPaidReportProof(proof,{publicKey:keys.publicKey,now,crypto:webcrypto}),true);
  const handler=createPaidReportHandler({publicKey:keys.publicKey,now:()=>now,crypto:webcrypto,writer:async()=>({data:{status:'already_processed'}})});
  const response=await handler(request(proof));assert.equal((await response.json()).status,'already_processed');
  assert.ok(!JSON.stringify([...response.headers]).includes(proof));
});
test('raw anonymous writer grants are removed and service role alone is granted',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261001132412_paid_reporting_authorization.sql',import.meta.url),'utf8');
  for(const name of ['submit_community_observation','mutate_community_observation','cancel_community_operation']){
    assert.match(sql,new RegExp(`revoke execute on function public\\.${name}\\(`));
    assert.match(sql,new RegExp(`grant execute on function public\\.${name}\\([^;]+ to service_role;`));
  }
  assert.doesNotMatch(sql,/grant execute[^;]+to (?:anon|authenticated)/i);
});
test('packaged report transport sends proof only to Edge and never calls the raw writer',async()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const source=app.slice(app.indexOf('function gridlyAuthorizedReportTransport('),app.indexOf('/* LP244.29A REPORTING AVAILABILITY RUNTIME START */'));
  const calls=[];
  const context={window:{gridlyPaidReporting:{getProof:async()=> 'signed.proof.value'}}};
  vm.runInNewContext(`${source}\nthis.make=gridlyAuthorizedReportTransport;`,context);
  const client={rpc:async name=>{calls.push(['raw',name]);return {data:{reporting_enabled:false}};},
    functions:{invoke:async(name,options)=>{calls.push(['edge',name,options.body]);return {data:{status:'accepted'}};}}};
  const transport=context.make(client);
  assert.equal((await transport.rpc('submit_community_observation',args)).data.status,'accepted');
  assert.equal(calls[0][0],'edge');assert.equal(calls[0][1],'gridly-paid-report');
  assert.equal(calls[0][2].proof,'signed.proof.value');
  assert.deepEqual(calls[0][2].args,args);
  await transport.rpc('get_community_reporting_status');assert.equal(calls[1][0],'raw');
  context.window.gridlyPaidReporting=null;
  assert.equal((await transport.rpc('submit_community_observation',args)).error.code,'REPORT_AUTH_REQUIRED');
  assert.equal(calls.length,2);
});
