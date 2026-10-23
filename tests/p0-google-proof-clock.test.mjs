import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {beginGoogleProofRequest,verifyGoogleResponseProof,entitlementNow,accessDecision,verifyAuthorityProof} from '../js/gridly-entitlement.mjs';
import {normalizeGoogle,signResponse} from './fixtures/p0-google-verifier-v12/supabase/functions/_shared/entitlement/core.mjs';
const server=Date.parse('2026-10-23T15:19:25.000Z'),nonce='a'.repeat(48);
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const makeRecord=(options={})=>normalizeGoogle({regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
 acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',lineItems:[{productId:'com.gridlygo.gridly.monthly',
 offerDetails:{basePlanId:'monthly'},expiryTime:new Date(options.end??server+86400000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]},
 {env:'production',token:'synthetic-clock-token',now:server});
function fixture(offset=-60000) {
 let wall=server+offset,tick=100;
 const options={nonce,now:()=>wall,monotonic:()=>tick};
 return {options,begin:()=>beginGoogleProofRequest(options),advance:ms=>{wall+=ms;tick+=ms;},
 wall:delta=>{wall+=delta;},tick:delta=>{tick+=delta;},
 verify:(proof,requestClock,extra={})=>verifyGoogleResponseProof({proof,requestClock,nonce,publicKey:keys.publicKey,crypto:webcrypto,...extra})};
}
const allowed=row=>accessDecision(row,{platform:'google'}).allowed;
test('fresh signed authority tolerates fixed local UTC offsets without extending the five minute lease',async()=>{
 for(const offset of [-86400000,-60000,-1,0,60000,86400000]){
  const f=fixture(offset),request=f.begin();f.advance(800);
  const row=await f.verify(await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto),request);
  assert.equal(allowed(row),true);assert.equal(entitlementNow(row),server+800);
  f.advance(299199);assert.equal(allowed(row),true);
  f.advance(1);assert.equal(allowed(row),false);
 }
 // This tests proof admission. The unchanged challenge gate bounds end-to-end skew separately.
});
test('opaque pre-request context is required, nonce-bound and usable once',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto),f=fixture();
 assert.equal((await f.verify(proof,{})).errorCategory,'invalid_authority');
 const request=f.begin();assert.equal((await f.verify(proof,request,{nonce:'b'.repeat(48)})).errorCategory,'invalid_authority');
 assert.equal((await f.verify(proof,request)).errorCategory,'invalid_authority');
 const good=f.begin();assert.equal(allowed(await f.verify(proof,good)),true);
 assert.equal((await f.verify(proof,good)).errorCategory,'invalid_authority');
});
test('wrong keys and unsigned/mutated claims never establish an authenticated clock',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto);
 const wrong=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 for(const candidate of [proof,'unsigned','x.y.z',proof.replace(proof.split('.')[1],Buffer.from('{}').toString('base64url'))]){
  const f=fixture(),row=await f.verify(candidate,f.begin(),{publicKey:wrong.publicKey});
  assert.equal(row.errorCategory,'invalid_authority');assert.equal(allowed(row),false);assert.equal(entitlementNow(row,42),42);
 }
});
test('request delay and signature work consume the lease; oversized or invalid clock durations fail closed',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto);
 for(const duration of [15001,300000]){
  const f=fixture(),request=f.begin();f.advance(duration);
  assert.equal(allowed(await f.verify(proof,request)),false);
 }
 const f=fixture(),request=f.begin();
 const delayedCrypto={subtle:{verify:async(...args)=>{const result=await webcrypto.subtle.verify(...args);f.advance(15001);return result;}}};
 assert.equal(allowed(await f.verify(proof,request,{crypto:delayedCrypto})),false);
});
test('short provider period expires by actual period end; response delay never grants past it',async()=>{
 const proof=await signResponse(makeRecord({end:server+1000}),nonce,keys.privateKey,webcrypto);
 const f=fixture(),request=f.begin();f.advance(900);const row=await f.verify(proof,request);
 assert.equal(allowed(row),true);f.advance(100);assert.equal(allowed(row),false);
 const late=fixture(),lateRequest=late.begin();late.advance(1000);
 assert.equal(allowed(await late.verify(proof,lateRequest)),false);
});
test('clock rollback invalidates admitted authority; a fresh nonce-bound request can safely recover',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto);
 for(const source of ['wall','tick']){
  const f=fixture(),row=await f.verify(proof,f.begin());assert.equal(allowed(row),true);
  f[source](-1);assert.equal(allowed(row),false);f[source](1);assert.equal(allowed(row),false);
  const freshNonce='c'.repeat(48);
  const fresh=beginGoogleProofRequest({...f.options,nonce:freshNonce});
  const recovered=await f.verify(await signResponse(makeRecord(),freshNonce,keys.privateKey,webcrypto),fresh,{nonce:freshNonce});
  assert.equal(allowed(recovered),true);
 }
});
test('forward wall adjustment can only shorten authority; wall progression covers suspended monotonic clock',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto);
 for(const source of ['wall','tick']){
  const f=fixture(),row=await f.verify(proof,f.begin());f[source](300000);assert.equal(allowed(row),false);
 }
});
test('reporting margin is explicit and cannot be negative or extend expiry',async()=>{
 const f=fixture(),row=await f.verify(await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto),f.begin());
 f.advance(270000);assert.equal(allowed(row),true);
 assert.equal(accessDecision(row,{platform:'google',minimumRemainingMs:30000}).allowed,false);
 for(const margin of [-1,Infinity,NaN,300001])assert.equal(accessDecision(row,{platform:'google',minimumRemainingMs:margin}).allowed,false);
});
test('server signed denial and unknown results never become entitlement under the new clock',async()=>{
 for(const state of ['SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PENDING']){
  const record=normalizeGoogle({regionCode:'US',subscriptionState:state,acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
  lineItems:[{productId:'com.gridlygo.gridly.monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(server+86400000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]},
  {env:'production',token:'synthetic-denied-token',now:server});
  const f=fixture(),row=await f.verify(await signResponse(record,nonce,keys.privateKey,webcrypto),f.begin());
  assert.equal(allowed(row),false);
 }
});
test('standalone verifier retains strict wall-clock semantics and raw/cloned snapshots cannot inherit a clock',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto),f=fixture();
 assert.equal((await verifyAuthorityProof({proof,nonce,publicKey:keys.publicKey,platform:'google',now:server-1,crypto:webcrypto})).errorCategory,'invalid_authority');
 const row=await f.verify(proof,f.begin());assert.equal(allowed({...row}),false);
 assert.equal(accessDecision(row,{platform:'apple'}).allowed,false);
});

test('unchanged native challenge gate admits relevant moderate skew and still rejects out-of-window clocks',async()=>{
 const {createNativeAttestedInvoke}=await import('../js/gridly-native-attested-invoke.mjs');
 const body={platform:'google',environment:'production',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',nonce,evidence:{purchaseTokens:['synthetic-clock-token']}};
 for(const offset of [-60000,0,60000,-180001,120000]){
  let invoked=false;
  const adapter=createNativeAttestedInvoke({platform:'google',crypto:webcrypto,now:()=>server+offset,
   requestChallenge:async()=>({data:{challenge:'a'.repeat(43),expiresAt:new Date(server+120000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'}}),
   nativeAttestation:{prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic-integrity'})},
   invoke:async()=>{invoked=true;return {data:{proof:'synthetic-result'}};}});
  if(offset>=-180000&&offset<120000){await adapter('gridly-verify-google-subscription',{body});assert.equal(invoked,true);}
  else {await assert.rejects(adapter('gridly-verify-google-subscription',{body}),/verification_unavailable/);assert.equal(invoked,false);}
 }
});

test('fresh Google clock still rejects signed claim/lease violations and DER-encoded signatures',async()=>{
 const proof=await signResponse(makeRecord(),nonce,keys.privateKey,webcrypto);
 const [header,payload,signature]=proof.split('.'),body=JSON.parse(Buffer.from(payload,'base64url'));
 const patches=[{nonce:'b'.repeat(48)},{productId:'other'},{platform:'apple'},{environment:'sandbox/test'},
 {audience:'other'},{expiresAt:new Date(server+300001).toISOString()},{expiresAt:new Date(server).toISOString()},
 {currentPeriodEnd:null},{entitlementState:'unknown'},{verificationSource:'client'},{restoreAvailable:false},{unexpected:'synthetic'}];
 for(const patch of patches){
  const input=header+'.'+Buffer.from(JSON.stringify({...body,...patch})).toString('base64url');
  const bytes=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input));
  const candidate=input+'.'+Buffer.from(bytes).toString('base64url'),f=fixture(),row=await f.verify(candidate,f.begin());
  assert.equal(row.errorCategory,'invalid_authority');assert.equal(allowed(row),false);
 }
 const raw=Buffer.from(signature,'base64url'),integer=part=>{
  let bytes=part;while(bytes.length>1&&bytes[0]===0)bytes=bytes.subarray(1);
  if(bytes[0]&128)bytes=Buffer.concat([Buffer.from([0]),bytes]);
  return Buffer.concat([Buffer.from([2,bytes.length]),bytes]);
 };
 const content=Buffer.concat([integer(raw.subarray(0,32)),integer(raw.subarray(32))]);
 const der=Buffer.concat([Buffer.from([48,content.length]),content]),f=fixture();
 assert.equal((await f.verify(header+'.'+payload+'.'+der.toString('base64url'),f.begin())).errorCategory,'invalid_authority');
});
