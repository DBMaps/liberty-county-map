import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';
import {build16ApplePaidAccess} from './helpers/build16-apple-baseline.mjs';
import {normalizeApple,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
const server=Date.parse('2026-10-23T16:00:00.000Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const product='com.gridlygo.gridly.monthly';
function fixture(create,{offset=-60000,env='production',status=1,end=server+86400000,finish=true}={}){
 let wall=server+offset,tick=100,serverTime=server,finishes=0,requests=0;
 const native={result:'verified',productId:product,environment:env,completionHandle:'synthetic-handle',signedTransaction:'synthetic.signed.transaction'};
 const plugin={getProducts:async()=>({result:'available',productId:product,displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),getCurrentEntitlement:async()=>native,refreshEntitlement:async()=>native,restorePurchases:async o=>{assert.deepEqual(o,{userInitiated:true});return native;},purchase:async()=>native,finishTransaction:async()=>{finishes++;return {finished:finish};},addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{}};
 const authority={reconcile:async request=>{requests++;const record=normalizeApple({bundleId:'com.gridlygo.gridly',productId:product,type:'Auto-Renewable Subscription',environment:env==='production'?'Production':'Sandbox',originalTransactionId:'synthetic-chain',expiresDate:end},{originalTransactionId:'synthetic-chain',productId:product,environment:env==='production'?'Production':'Sandbox',autoRenewStatus:1},status,{env,originalReference:'synthetic-chain',now:serverTime});
  wall+=800;tick+=800;return signResponse(record,request.nonce,keys.privateKey,webcrypto);}};
 const access=create({capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios'},plugin,authority,publicKey:keys.publicKey,crypto:webcrypto,now:()=>wall,monotonic:()=>tick,schedule:()=>1,cancel:()=>{}});
 return {access,authority,plugin,finishes:()=>finishes,requests:()=>requests,advance:ms=>{wall+=ms;tick+=ms;serverTime+=ms;},wall:ms=>wall+=ms};
}
test('exact approved Apple baseline: signed ACTIVE becomes UNKNOWN behind server time; aligned control unlocks',async()=>{
 for(const offset of [-86400000,-60000,-1000]){const f=fixture(build16ApplePaidAccess,{offset});const r=await f.access.start();assert.equal(r.state,'unknown');assert.equal(r.allowed,false);assert.equal(f.finishes(),0);await f.access.stop();}
 const control=fixture(build16ApplePaidAccess,{offset:0});assert.equal((await control.access.start()).allowed,true);assert.equal(control.finishes(),1);await control.access.stop();
});
test('repaired Apple production and sandbox admission tolerates fixed clock offset through reopen and restore',async()=>{
 for(const env of ['production','sandbox/test'])for(const offset of [-86400000,-60000,0,60000,86400000]){
  for(let reopen=0;reopen<2;reopen++){const f=fixture(createPaidAccess,{offset,env});assert.equal((await f.access.start()).allowed,true);f.advance(1000);assert.equal((await f.access.restore()).allowed,true);assert.equal((await f.access.resume()).allowed,true);assert.equal(f.finishes(),3);await f.access.stop();assert.equal(f.access.allowed(),false);}
 }
});
test('Apple authenticated proof remains bounded by signed period and fails closed after local rollback or failed finish',async()=>{
 const f=fixture(createPaidAccess,{end:server+2000});assert.equal((await f.access.start()).allowed,true);f.advance(1200);assert.equal(f.access.allowed(),false);await f.access.stop();
 const rollback=fixture(createPaidAccess);assert.equal((await rollback.access.start()).allowed,true);rollback.wall(-1);assert.equal(rollback.access.allowed(),false);await rollback.access.stop();
 const failed=fixture(createPaidAccess,{finish:false});assert.equal((await failed.access.start()).allowed,false);await failed.access.stop();
 for(const status of [2,5]){const denied=fixture(createPaidAccess,{status});assert.equal((await denied.access.start()).allowed,false);assert.equal(denied.finishes(),0);await denied.access.stop();}
});
import {beginAppleProofRequest,beginGoogleProofRequest,verifyAppleResponseProof,verifyGoogleResponseProof,entitlementNow,accessDecision} from '../js/gridly-entitlement.mjs';
const appleRecord=(overrides={})=>normalizeApple({bundleId:'com.gridlygo.gridly',productId:product,type:'Auto-Renewable Subscription',environment:'Production',originalTransactionId:'synthetic-security-chain',expiresDate:server+86400000},{originalTransactionId:'synthetic-security-chain',productId:product,environment:'Production',autoRenewStatus:1},1,{env:'production',originalReference:'synthetic-security-chain',now:server,...overrides});
function proofClock(){let wall=server-60000,tick=100;return {options:{now:()=>wall,monotonic:()=>tick},advance:ms=>{wall+=ms;tick+=ms;}};}
const appleVerify=(proof,nonce,requestClock,extra={})=>verifyAppleResponseProof({proof,nonce,requestClock,publicKey:keys.publicKey,crypto:webcrypto,...extra});
test('Apple response contexts bind platform and nonce, are opaque, and cannot be reused',async()=>{
 const nonce='a'.repeat(48),proof=await signResponse(appleRecord(),nonce,keys.privateKey,webcrypto),c=proofClock();
 assert.equal((await appleVerify(proof,nonce,{})).errorCategory,'invalid_authority');
 const foreign=beginGoogleProofRequest({...c.options,nonce});assert.equal((await appleVerify(proof,nonce,foreign)).errorCategory,'invalid_authority');
 const request=beginAppleProofRequest({...c.options,nonce});assert.equal((await appleVerify(proof,'b'.repeat(48),request)).errorCategory,'invalid_authority');assert.equal((await appleVerify(proof,nonce,request)).errorCategory,'invalid_authority');
 const good=beginAppleProofRequest({...c.options,nonce});const row=await appleVerify(proof,nonce,good);assert.equal(accessDecision(row,{platform:'apple'}).allowed,true);assert.equal(accessDecision({...row},{platform:'apple'}).allowed,false);assert.equal((await appleVerify(proof,nonce,good)).errorCategory,'invalid_authority');
 const apple=beginAppleProofRequest({...c.options,nonce});assert.equal((await verifyGoogleResponseProof({proof,nonce,requestClock:apple,publicKey:keys.publicKey,crypto:webcrypto})).errorCategory,'invalid_authority');
});
test('Apple clock cannot admit wrong signatures or signed nonce/product/environment/audience/lease violations',async()=>{
 const nonce='c'.repeat(48),proof=await signResponse(appleRecord(),nonce,keys.privateKey,webcrypto),[header,payload]=proof.split('.'),body=JSON.parse(Buffer.from(payload,'base64url'));
 const wrong=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const c=proofClock();assert.equal((await appleVerify(proof,nonce,beginAppleProofRequest({...c.options,nonce}),{publicKey:wrong.publicKey})).errorCategory,'invalid_authority');
 for(const patch of [{nonce:'d'.repeat(48)},{productId:'other'},{platform:'google'},{environment:'sandbox/test'},{audience:'other'},{expiresAt:new Date(server+300001).toISOString()},{expiresAt:new Date(server).toISOString()},{currentPeriodEnd:null},{subscriptionState:'grace_period'},{verificationSource:'client'},{testAuthority:'gridly-google-play-internal-v11'}]){
  const input=header+'.'+Buffer.from(JSON.stringify({...body,...patch})).toString('base64url');const bytes=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input));const candidate=input+'.'+Buffer.from(bytes).toString('base64url');const c=proofClock();
  const row=await appleVerify(candidate,nonce,beginAppleProofRequest({...c.options,nonce}));assert.equal(row.errorCategory,'invalid_authority');assert.equal(entitlementNow(row,42),42);
 }
});
test('Apple response latency consumes the five-minute lease and delayed verification cannot establish time',async()=>{
 const nonce='e'.repeat(48),proof=await signResponse(appleRecord(),nonce,keys.privateKey,webcrypto),c=proofClock(),request=beginAppleProofRequest({...c.options,nonce});c.advance(15000);const row=await appleVerify(proof,nonce,request);assert.equal(accessDecision(row,{platform:'apple'}).allowed,true);c.advance(285000);assert.equal(accessDecision(row,{platform:'apple'}).allowed,false);
 const late=proofClock(),lateRequest=beginAppleProofRequest({...late.options,nonce});late.advance(15001);assert.equal((await appleVerify(proof,nonce,lateRequest)).errorCategory,'invalid_authority');
 const checked=proofClock(),checkedRequest=beginAppleProofRequest({...checked.options,nonce});const delayedCrypto={subtle:{verify:async(...args)=>{const result=await webcrypto.subtle.verify(...args);checked.advance(15001);return result;}}};assert.equal((await appleVerify(proof,nonce,checkedRequest,{crypto:delayedCrypto})).errorCategory,'invalid_authority');
});
test('Apple restore rejects replay of a previously delivered proof instead of finishing or unlocking again',async()=>{
 const f=fixture(createPaidAccess);const original=f.authority.reconcile;let first;f.authority.reconcile=async request=>first??=await original(request);assert.equal((await f.access.start()).allowed,true);assert.equal((await f.access.restore()).allowed,false);assert.equal(f.finishes(),1);await f.access.stop();
});
