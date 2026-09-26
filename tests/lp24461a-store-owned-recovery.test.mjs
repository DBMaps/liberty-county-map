import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {STORE_VERIFIERS,storeVerificationRequest} from '../js/gridly-store-verification.mjs';
import {createEntitlementSession,accessDecision,LAUNCH} from '../js/gridly-entitlement.mjs';
const time=Date.parse('2026-09-26T21:00:00.000Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const evidence=platform=>platform==='apple'?{signedTransactions:['synthetic.payload.signature']}:{purchaseTokens:['synthetic-google-token']};
async function proof(request,state='active') {
 const body={platform:request.platform,productId:request.productId,subscriptionState:state,entitlementState:state==='unknown'?'unknown':state==='active'?'entitled':'not_entitled',
 currentPeriodEnd:state==='active'?new Date(time+86400000).toISOString():null,lastVerifiedAt:new Date(time).toISOString(),verificationSource:'gridly_server_store_api',environment:request.environment,
 restoreAvailable:true,errorCategory:state==='unknown'?'network_unavailable':'none',nonce:request.nonce,audience:'com.gridlygo.gridly',expiresAt:new Date(time+300000).toISOString()};
 const header=Buffer.from(JSON.stringify({alg:'ES256',typ:'gridly-entitlement-v1'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify(body)).toString('base64url');const input=header+'.'+payload;
 return input+'.'+Buffer.from(await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input))).toString('base64url');
}
test('fixed Apple signed transaction and Google subscriptionsv2 contracts; acknowledgment API stays distinct',()=>{
 assert.equal(STORE_VERIFIERS.apple.evidenceField,'signedTransactions');
 assert.equal(STORE_VERIFIERS.google.verification,'purchases.subscriptionsv2.get');
 assert.equal(STORE_VERIFIERS.google.acknowledgement,'purchases.subscriptions.acknowledge');
 assert.equal(STORE_VERIFIERS.google.basePlanId,'monthly');
 for(const spec of Object.values(STORE_VERIFIERS)){assert.equal(spec.accountRequired,false);assert.equal(spec.launchRestorePrompt,false);}
});
test('new install restores from current store proof without old install/login/profile',async()=>{
 for(const platform of ['apple','google']) {
  const requests=[],calls=[];
  const bridge={queryPurchases:async()=>{calls.push('query');return evidence(platform);},restore:async()=>{calls.push('restore');return evidence(platform);},completeVerifiedPurchase:async()=>{calls.push('complete');}};
  const options={platform,publicKey:keys.publicKey,crypto:webcrypto,now:()=>time,bridge,authority:{reconcile:async request=>{requests.push(request);return proof(request);}}};
  const original=createEntitlementSession(options);await original.launch();assert.equal(original.allowed('product').allowed,true);
  // No copied snapshot, credential, install identifier or account from original.
  const reinstalled=createEntitlementSession(options);assert.equal(reinstalled.allowed('product').allowed,false);
  await reinstalled.restore();assert.equal(reinstalled.allowed('product').allowed,true);
  assert.deepEqual(calls,['query','complete','restore','complete']);
  for(const request of requests)assert.deepEqual(Object.keys(request).sort(),(platform==='apple'?['platform','environment','nonce','productId','evidence']:['platform','environment','nonce','productId','basePlanId','evidence']).sort());
  assert.notEqual(requests[0].nonce,requests[1].nonce);
 }
});
test('rejects identity or raw-state authority instead of store proof, bounds evidence and never echoes errors',()=>{
 for(const platform of ['apple','google']){
  const base={platform,environment:'production',nonce:'a'.repeat(48),evidence:evidence(platform)};
  for(const bad of [{installId:'old'},{email:'person@example.invalid'},{active:true},{...evidence(platform),installId:'old'}])assert.throws(()=>storeVerificationRequest({...base,evidence:bad}),/^Error: invalid_store_evidence$/);
  assert.throws(()=>storeVerificationRequest({...base,environment:'other'}),/invalid_store_evidence/);
  const field=STORE_VERIFIERS[platform].evidenceField;
  assert.throws(()=>storeVerificationRequest({...base,evidence:{[field]:Array(9).fill('same')}}),/invalid_store_evidence/);
 }
 assert.throws(()=>storeVerificationRequest({platform:'__proto__',nonce:'a'.repeat(48),environment:'production',evidence:{undefined:[]}}),/invalid_store_evidence/);
});
test('empty current query is evidence absence, not an entitlement or unlock; unknown restore remains retryable',async()=>{
 let unavailable=true;
 const s=createEntitlementSession({platform:'apple',publicKey:keys.publicKey,crypto:webcrypto,now:()=>time,
 bridge:{restore:async()=>({signedTransactions:[]}),completeVerifiedPurchase:async()=>assert.fail('Unknown must not finish')},
 authority:{reconcile:async request=>{assert.equal(request.evidence.signedTransactions.length,0);if(unavailable)throw Error('private raw token');return proof(request,'unknown');}}});
 await s.restore();assert.equal(s.read().entitlementState,'unknown');assert.equal(s.allowed('product').allowed,false);
 assert.equal(s.read().restoreAvailable,true);assert.ok(!JSON.stringify(s.read()).includes('private raw token'));
 unavailable=false;await s.restore();assert.equal(s.read().errorCategory,'network_unavailable');
 for(const surface of ['privacy','terms','community_guidelines','support','delete_data'])assert.equal(s.allowed(surface).allowed,true);
 assert.equal(accessDecision(s.read(),{platform:'web',now:time}).allowed,false);
});
test('contract has no account/storage hooks, preserves onboarding and does not activate runtime or reporting',()=>{
 const contract=readFileSync(new URL('../js/gridly-store-verification.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(contract,/localStorage|sessionStorage|console\.|signIn|signUp|purchases\.subscriptions\.get/);
 assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/gridly-(?:entitlement|store-verification)/);
 assert.match(readFileSync(new URL('../js/app.js',import.meta.url),'utf8'),/GRIDLY_WELCOME_TOTAL_STEPS = 7/);
 assert.equal(LAUNCH.webCheckout,false);
});
