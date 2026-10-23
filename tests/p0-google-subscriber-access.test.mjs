import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';
import {build14CreatePaidAccess} from './helpers/build14-google-baseline.mjs';
import {createGoogleVerificationAuthority} from '../js/gridly-google-play-billing.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';
import {importProductionEntitlementKey,PRODUCTION_ENTITLEMENT_SPKI_B64,PRODUCTION_ENTITLEMENT_SPKI_SHA256} from '../js/gridly-entitlement-public-key.mjs';
import {createHandler} from './fixtures/p0-google-verifier-v12/supabase/functions/_shared/entitlement/handler.mjs';
import {normalizeGoogle,normalizeApple,signResponse} from './fixtures/p0-google-verifier-v12/supabase/functions/_shared/entitlement/core.mjs';

// Offline only: generated keys and synthetic store evidence; no production requests.
const serverNow=Date.parse('2026-10-23T15:19:25.000Z'),periodEnd=Date.parse('2026-11-22T15:19:25.000Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const hmac=await webcrypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const nonce='c'.repeat(48),product='com.gridlygo.gridly.monthly';
const googleRecord=()=>normalizeGoogle({regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
 acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',
 lineItems:[{productId:product,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(periodEnd).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]},
 {env:'production',token:'synthetic-existing-token',now:serverNow});
async function fixture({clientOffset=1000,publicKey=keys.publicKey,denyNative=false,coordinator=createPaidAccess}={}) {
 const events=[],cache=[],statuses=[],diagnostics=[];
 const handler=createHandler({platform:'google',authorizeNative:async()=>{events.push('native-admission');return !denyNative;},
 provider:{verify:async()=>{events.push('publisher-active');return googleRecord();}},
 cache:{apply:async row=>{cache.push({state:row.subscription_state,entitlement:row.entitlement_state,error:row.error_category});return true;}},
 ackQueue:{ensure:async()=>{throw Error('unexpected_ack');}},signingKey:keys.privateKey,fingerprintKey:hmac,crypto:webcrypto,
 diagnostic:value=>diagnostics.push(value)});
 const authority=createGoogleVerificationAuthority({invoke:async(_,{body})=>{
  const response=await handler(new Request('https://offline.invalid/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  statuses.push(response.status);
  return response.ok?{data:await response.json()}:{error:{context:{status:response.status}}};
 }});
 const native={result:'purchased',productId:product,basePlanId:'monthly',purchaseToken:'synthetic-existing-token'};
 const plugin={getProducts:async()=>({result:'available',productId:product,basePlanId:'monthly',displayName:'Gridly Monthly',
 displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
 addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
 queryCurrentPurchases:async()=>{events.push('query-existing');return native;},
 refreshEntitlement:async()=>{events.push('refresh-existing');return native;},
 restorePurchases:async()=>{events.push('restore-existing');return native;},
 purchase:async()=>{events.push('already-owned');return {result:'error',errorCategory:'already_owned'};}};
 const create=()=>coordinator({capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},plugin,authority,publicKey,
 crypto:webcrypto,now:()=>serverNow+clientOffset,monotonic:()=>0,schedule:()=>1,cancel:()=>{}});
 return {create,events,cache,statuses,diagnostics};
}
test('Build 14 public pin has the recorded public SPKI identity; this does not identify the active server key',async()=>{
 assert.equal(createHash('sha256').update(Buffer.from(PRODUCTION_ENTITLEMENT_SPKI_B64,'base64')).digest('hex'),PRODUCTION_ENTITLEMENT_SPKI_SHA256);
 assert.equal((await importProductionEntitlementKey(webcrypto)).type,'public');
});
test('deployed v12 production schema and ES256 P1363 signature admit an active existing subscriber in Build 14',async()=>{
 const proof=await signResponse(googleRecord(),nonce,keys.privateKey,webcrypto);
 assert.equal(Buffer.from(proof.split('.')[2],'base64url').length,64);
 const row=await verifyAuthorityProof({proof,nonce,publicKey:keys.publicKey,platform:'google',now:serverNow+1000,crypto:webcrypto});
 assert.equal(row.subscriptionState,'active');assert.equal(row.entitlementState,'entitled');
 assert.equal(accessDecision(row,{platform:'google',now:serverNow+1000}).allowed,true);
 assert.equal(Date.parse(row.expiresAt)-Date.parse(row.lastVerifiedAt),300000);
});
test('actual v12 handler -> authority -> Build 14 admission succeeds on launch, repeat restore/reopen and already-owned purchase',async()=>{
 const f=await fixture();
 for(let reopen=0;reopen<3;reopen++){
  const c=f.create();
  assert.equal((await c.start()).allowed,true);
  assert.equal((await c.restore()).allowed,true);
  assert.equal((await c.resume()).allowed,true);
  assert.equal((await c.purchase()).allowed,true);
  assert.equal(c.read().state,'entitled');
  await c.stop();
 }
 assert.equal(f.statuses.length,12);assert.ok(f.statuses.every(s=>s===200));
 assert.ok(f.cache.every(r=>r.state==='active'&&r.entitlement==='entitled'&&r.error==='none'));
 assert.equal(f.diagnostics.length,0);
 assert.doesNotMatch(JSON.stringify(f.cache),/token|proof|nonce/i);
});
test('counterexample: HTTP 200 and active cache still become UNKNOWN when the client key differs',async()=>{
 const f=await fixture({publicKey:await importProductionEntitlementKey(webcrypto)}),c=f.create();
 const result=await c.start();
 assert.deepEqual(f.statuses,[200]);assert.deepEqual(f.cache,[{state:'active',entitlement:'entitled',error:'none'}]);
 assert.equal(result.state,'unknown');assert.equal(result.errorCategory,'invalid_authority');assert.equal(result.allowed,false);
 await c.stop();
 // The signer here is SYNTHETIC. This is not evidence of a production key mismatch.
});
test('counterexample: a correctly signed proof becomes UNKNOWN when device time is one millisecond behind verification time',async()=>{
 const proof=await signResponse(googleRecord(),nonce,keys.privateKey,webcrypto);
 const parts=proof.split('.');
 assert.equal(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},keys.publicKey,
 Buffer.from(parts[2],'base64url'),Buffer.from(parts[0]+'.'+parts[1])),true);
 const f=await fixture({clientOffset:-1,coordinator:build14CreatePaidAccess}),c=f.create(),result=await c.start();
 assert.deepEqual(f.statuses,[200]);assert.equal(result.state,'unknown');assert.equal(result.errorCategory,'invalid_authority');
 assert.equal(result.allowed,false);await c.stop();
 // No customer clock measurement exists. This is not a diagnosed customer root cause.
});
test('native admission denial never reaches provider/cache or signed proof',async()=>{
 const f=await fixture({denyNative:true}),c=f.create(),result=await c.start();
 assert.deepEqual(f.statuses,[401]);assert.deepEqual(f.events,['query-existing','native-admission']);
 assert.equal(f.cache.length,0);assert.equal(result.allowed,false);await c.stop();
});
test('nonce, product, environment, audience, expiry, fields and signature mutations retain security denial',async()=>{
 const proof=await signResponse(googleRecord(),nonce,keys.privateKey,webcrypto);
 const body=JSON.parse(Buffer.from(proof.split('.')[1],'base64url'));
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const patches=[{nonce:'d'.repeat(48)},{productId:'other'},{environment:'sandbox/test'},{audience:'other'},
 {lastVerifiedAt:new Date(serverNow+2000).toISOString()},{expiresAt:new Date(serverNow+1000).toISOString()},
 {expiresAt:new Date(serverNow+300001).toISOString()},{currentPeriodEnd:null},{privateEvidence:'synthetic'}];
 for(const patch of patches){
  const input=proof.split('.')[0]+'.'+encode({...body,...patch});
  const sig=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input));
  const candidate=input+'.'+Buffer.from(sig).toString('base64url');
  const result=await verifyAuthorityProof({proof:candidate,nonce,publicKey:keys.publicKey,platform:'google',now:serverNow+1000,crypto:webcrypto});
  assert.equal(result.errorCategory,'invalid_authority');assert.equal(accessDecision(result,{platform:'google',now:serverNow+1000}).allowed,false);
 }
 const sig=Buffer.from(proof.split('.')[2],'base64url');sig[0]^=1;
 assert.equal((await verifyAuthorityProof({proof:proof.slice(0,proof.lastIndexOf('.')+1)+sig.toString('base64url'),nonce,
 publicKey:keys.publicKey,platform:'google',now:serverNow+1000,crypto:webcrypto})).errorCategory,'invalid_authority');
});
test('deployed shared signer remains compatible with Apple and cannot cross platform boundaries',async()=>{
 const record=normalizeApple({bundleId:'com.gridlygo.gridly',productId:product,type:'Auto-Renewable Subscription',
 environment:'Production',originalTransactionId:'synthetic-apple-chain',expiresDate:periodEnd},
 {originalTransactionId:'synthetic-apple-chain',productId:product,environment:'Production',autoRenewStatus:1},1,
 {env:'production',originalReference:'synthetic-apple-chain',now:serverNow});
 const proof=await signResponse(record,nonce,keys.privateKey,webcrypto);
 const verify=platform=>verifyAuthorityProof({proof,nonce,publicKey:keys.publicKey,platform,now:serverNow+1000,crypto:webcrypto});
 assert.equal(accessDecision(await verify('apple'),{platform:'apple',now:serverNow+1000}).allowed,true);
 assert.equal((await verify('google')).errorCategory,'invalid_authority');
});
test('the UNKNOWN message is distinct from temporary transport failures in the authoritative source',()=>{
 const ui=readFileSync(new URL('../js/gridly-paid-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/unknown:'Your subscription could not be verified/);
 assert.match(ui,/temporarily_unavailable:'Verification is temporarily unavailable/);
});

test('same production-format ACTIVE proof: certified Build 14 fails behind UTC, repaired Google admission succeeds',async()=>{
 const traces=[];
 for(const offset of [-60000,-1000,-1]){
  const before=await fixture({clientOffset:offset,coordinator:build14CreatePaidAccess}),old=before.create();
  const beforeStates=[];old.subscribe(row=>beforeStates.push({state:row.state,errorCategory:row.errorCategory,allowed:row.allowed}));
  const oldState=await old.start();assert.equal(oldState.state,'unknown');assert.equal(oldState.allowed,false);
  assert.deepEqual(before.statuses,[200]);await old.stop();
  const after=await fixture({clientOffset:offset}),fixed=after.create();
  const afterStates=[];fixed.subscribe(row=>afterStates.push({state:row.state,errorCategory:row.errorCategory,allowed:row.allowed}));
  assert.equal((await fixed.start()).allowed,true);assert.equal((await fixed.restore()).allowed,true);
  assert.equal((await fixed.resume()).allowed,true);assert.equal((await fixed.purchase()).allowed,true);
  assert.deepEqual(after.statuses,[200,200,200,200]);traces.push({clockOffsetMs:offset,baselineStates:beforeStates,repairedStates:afterStates,baselineHttpStatuses:before.statuses,repairedHttpStatuses:after.statuses});await fixed.stop();
 } mkdirSync('.artifacts/p0-google-access',{recursive:true});
 writeFileSync('.artifacts/p0-google-access/clock-transition-evidence.json',JSON.stringify({classification:'SYNTHETIC_ONLY',baselineCommit:'0e9eebd185dac45aa3382471870092852645941b',traces},null,2)+'\n');
});
