import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {sandboxAcceptanceComposition,productionComposition} from '../supabase/functions/_shared/entitlement/composition.mjs';
import {createGoogleIntegrityVerifier} from '../supabase/functions/_shared/entitlement/google-integrity.mjs';
import {createNativeAuthorizer} from '../supabase/functions/_shared/entitlement/native-authorization.mjs';
import {createNativeEdgeTransport} from '../js/gridly-native-edge-transport.mjs';
import {createNativeAttestedInvoke} from '../js/gridly-native-attested-invoke.mjs';
import {createGoogleVerificationAuthority} from '../js/gridly-google-play-billing.mjs';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';
import {productionPaidComposition} from '../js/gridly-paid-config.mjs';
import {importProductionEntitlementKey} from '../js/gridly-entitlement-public-key.mjs';
import {verifyAuthorityProof} from '../js/gridly-entitlement.mjs';

const crypto=webcrypto,now=Date.now();
const productId='com.gridlygo.gridly.monthly',token='synthetic-google-purchase';
const challenge='c'.repeat(43),nonce='n'.repeat(48);
const signing=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const fingerprintKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const evidence=testPurchase=>({packageName:'com.gridlygo.gridly',regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',...(testPurchase?{testPurchase:{}}:{}),
  lineItems:[{productId,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(now+3600000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]});
const request=environment=>new Request('https://fixture.invalid/verify',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({platform:'google',environment,nonce,productId,basePlanId:'monthly',evidence:{purchaseTokens:[token]}})});
async function authorizedRequest(calls,environment,purchaseTokens=[token]){
  const body=JSON.parse(await request(environment).text());
  body.evidence.purchaseTokens=purchaseTokens;
  body.nativeChallenge=challenge;body.nativeAuthorization={type:'google_standard',token:'synthetic-integrity-token'};
  const {nativeVerificationBinding}=await import('../js/gridly-native-verification-binding.mjs');
  calls.digest=(await nativeVerificationBinding({challenge,request:body,crypto})).requestHash;
  return new Request('https://fixture.invalid/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}

function server(environment,{testPurchase=true,integrity=true,publisherStatus=200}={}){
  const calls={publisher:0,cache:0,integrity:0,consume:0};
  const verifier=createGoogleIntegrityVerifier({acceptedEnvironment:environment,accessToken:async()=> 'synthetic-integrity-oauth',now:()=>now,
    fetchImpl:async()=>{calls.integrity++;return Response.json({tokenPayloadExternal:{
      requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:calls.digest,timestampMillis:String(now)},
      appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED'},
      accountDetails:{appLicensingVerdict:'LICENSED'},deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']}}});}});
  const authorizeNative=createNativeAuthorizer({store:{consume:async()=>{calls.consume++;return true;}},
    googleVerifier:integrity?verifier:null,crypto});
  const ports={authorizeNative,cache:{apply:async()=>{calls.cache++;return true;}},signingKey:signing.privateKey,fingerprintKey,crypto,
    google:{accessToken:async()=> 'synthetic-publisher-oauth',encryptionKeys:{current:{version:'synthetic',key:aes}},
      store:{enqueue:async()=>{throw Error('unexpected_ack');},claim:async()=>[],resolve:async()=>false},
      fetchImpl:async(url,options)=>{assert.equal(options.method,'GET');assert.match(url,/subscriptionsv2\/tokens\//);calls.publisher++;
        return publisherStatus===200?Response.json(evidence(testPurchase)):new Response(null,{status:publisherStatus});},now:()=>now}};
  const runtime=(environment==='sandbox/test'?sandboxAcceptanceComposition:productionComposition)(ports);
  return {runtime,calls};
}

test('sandbox authority requires Play Integrity, Publisher evidence and testPurchase before cache or proof',async()=>{
  const sandbox=server('sandbox/test');
  const response=await sandbox.runtime.google(await authorizedRequest(sandbox.calls,'sandbox/test'));
  assert.equal(response.status,200);assert.equal(sandbox.calls.integrity,1);assert.equal(sandbox.calls.consume,1);
  assert.equal(sandbox.calls.publisher,1);assert.equal(sandbox.calls.cache,1);
  const proof=(await response.json()).proof;
  const row=await verifyAuthorityProof({proof,publicKey:signing.publicKey,nonce,platform:'google',environment:'sandbox/test',now,crypto});
  assert.equal(row.entitlementState,'entitled');
  assert.equal((await verifyAuthorityProof({proof,publicKey:signing.publicKey,nonce,platform:'google',environment:'production',now,crypto})).entitlementState,'unknown');
  assert.equal((await verifyAuthorityProof({proof,publicKey:await importProductionEntitlementKey(crypto),nonce,platform:'google',environment:'sandbox/test',now,crypto})).entitlementState,'unknown');
  const missing=server('sandbox/test',{integrity:false});
  assert.equal((await missing.runtime.google(await authorizedRequest(missing.calls,'sandbox/test'))).status,401);
  assert.equal(missing.calls.publisher,0);assert.equal(missing.calls.cache,0);
});

test('both authorities reject wrong Google environment; no verified purchase means no entitlement',async()=>{
  for(const [authorityEnvironment,testPurchase,requestEnvironment] of [
    ['production',true,'production'],['sandbox/test',false,'sandbox/test'],
    ['production',true,'sandbox/test'],['sandbox/test',true,'production']]){
    const s=server(authorityEnvironment,{testPurchase});
    assert.equal((await s.runtime.google(await authorizedRequest(s.calls,requestEnvironment))).status,
      authorityEnvironment===requestEnvironment?502:401);
    assert.equal(s.calls.publisher,authorityEnvironment===requestEnvironment?1:0);
    assert.equal(s.calls.cache,0);
  }
  const s=server('sandbox/test',{publisherStatus:404});
  assert.equal((await s.runtime.google(await authorizedRequest(s.calls,'sandbox/test'))).status,502);
  assert.equal(s.calls.publisher,1);assert.equal(s.calls.cache,0);
});

test('internal-test routing and restore use sandbox only; default source stays production',async()=>{
  const nativeCapacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',isPluginAvailable:()=>true,
    registerPlugin:name=>name==='GridlyPlayBilling'?{queryCurrentPurchases:async()=>({result:'no_evidence'})}:
      {prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic'})},nativePromise:async()=>{throw Error('network_not_expected');}};
  const candidate=await productionPaidComposition(nativeCapacitor,{googleLicenseTest:true});
  const defaultBuild=await productionPaidComposition(nativeCapacitor);
  assert.equal(candidate.googleEnvironment,'sandbox/test');assert.ok(candidate.publicKey);
  assert.equal(defaultBuild.googleEnvironment,'production');assert.ok(defaultBuild.publicKey);
  const calls=[];let proof;
  const capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',isPluginAvailable:()=>true};
  const transport=createNativeEdgeTransport({capacitor,http:{request:async options=>{
    calls.push(new URL(options.url).pathname);
    if(options.url.endsWith('/subscription-challenge'))return {status:200,data:{challenge,expiresAt:new Date(Date.now()+120000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'}};
    assert.ok(options.url.endsWith('/gridly-verify-google-sandbox-subscription'));
    return {status:200,data:{proof}};
  }},googleEnvironment:'sandbox/test'});
  const attestation={prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic-integrity-token'})};
  const invoke=createNativeAttestedInvoke({platform:'google',invoke:transport.invoke,requestChallenge:transport.requestChallenge,
    nativeAttestation:attestation,googleEnvironment:'sandbox/test',crypto});
  const authority=createGoogleVerificationAuthority({invoke,environment:'sandbox/test'});
  const {signResponse,normalizeGoogle}=await import('../supabase/functions/_shared/entitlement/core.mjs');
  const record=normalizeGoogle(evidence(true),{env:'sandbox/test',token,now});
  const plugin={addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
    getProducts:async()=>({result:'available',productId,basePlanId:'monthly',displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
    queryCurrentPurchases:async()=>({result:'no_evidence'}),restorePurchases:async()=>({result:'purchased',productId,basePlanId:'monthly',purchaseToken:token}),
    purchase:async()=>{throw Error('unexpected_purchase');}};
  const wrapped={reconcile:async request=>{
    proof=await signResponse(record,request.nonce,signing.privateKey,crypto);
    return authority.reconcile(request);
  }};
  const paid=createPaidAccess({capacitor,plugin,authority:wrapped,publicKey:signing.publicKey,googleEnvironment:'sandbox/test',
    now:()=>now,crypto,schedule:()=>1,cancel:()=>{}});
  assert.equal((await paid.start()).allowed,false);
  assert.equal((await paid.restore()).allowed,true);
  assert.ok(calls.includes('/functions/v1/gridly-verify-google-sandbox-subscription'));
  assert.equal(paid.allowed(),true);await paid.stop();
  const source=readFileSync('js/gridly-paid-ui.mjs','utf8');
  assert.match(source,/GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE = false/);
  const productionEndpoint=createGoogleVerificationAuthority({invoke:async name=>{assert.equal(name,'gridly-verify-google-subscription');return {error:{}};}});
  await assert.rejects(()=>productionEndpoint.reconcile({platform:'google',environment:'sandbox/test',nonce,evidence:{purchaseTokens:[token]}}));
});

test('production Integrity default is still production only; candidate binding is sandbox only',async()=>{
  for(const [accepted,expected] of [[undefined,'production'],['sandbox/test','sandbox/test']]){
    let fetches=0;
    const verifier=createGoogleIntegrityVerifier({acceptedEnvironment:accepted,accessToken:async()=> 'synthetic',now:()=>now,
      fetchImpl:async()=>{fetches++;return Response.json({tokenPayloadExternal:{
        requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:'a'.repeat(43),timestampMillis:String(now)},
        appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED'},
        accountDetails:{appLicensingVerdict:'LICENSED'},deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']}}});}});
    for(const environment of ['production','sandbox/test']){
      const result=await verifier.verify({environment,authorization:{type:'google_standard',token:'synthetic'},requestHash:'a'.repeat(43)});
      assert.equal(result?.verified===true,environment===expected);
    }
    assert.equal(fetches,1);
  }
  const prod=readFileSync('supabase/functions/gridly-verify-google-subscription/index.ts','utf8');
  assert.match(prod,/productionEdgeRuntime/);assert.doesNotMatch(prod,/sandboxGoogleEdgeRuntime/);
  const sandbox=readFileSync('supabase/functions/gridly-verify-google-sandbox-subscription/index.ts','utf8');
  assert.match(sandbox,/sandboxGoogleEdgeRuntime/);
  assert.doesNotMatch(readFileSync('js/gridly-paid-ui.mjs','utf8'),/reporting_enabled\s*[:=]\s*true/);
});
