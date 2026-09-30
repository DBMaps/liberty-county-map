import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {nativeVerificationBinding} from '../js/gridly-native-verification-binding.mjs';
import {createNativeAttestedInvoke} from '../js/gridly-native-attested-invoke.mjs';
import {createNativeChallengeHandler,createNativeAuthorizer} from '../supabase/functions/_shared/entitlement/native-authorization.mjs';
import {createGoogleIntegrityVerifier} from '../supabase/functions/_shared/entitlement/google-integrity.mjs';

const now=Date.parse('2026-09-28T02:00:00.000Z');
const request=(platform='apple')=>({platform,environment:'production',nonce:'n'.repeat(48),
  productId:platform==='apple'?'com.gridlygo.gridly.monthly':'gridly_monthly',
  ...(platform==='google'?{basePlanId:'monthly'}:{}),
  evidence:platform==='apple'?{signedTransactions:['local.payload.signature']}:{purchaseTokens:['local-token']}});

test('canonical digest ignores JSON field order and binds every verifier field',async()=>{
  const challenge='a'.repeat(43),input=request('google');
  const first=await nativeVerificationBinding({challenge,request:input,crypto:webcrypto});
  const reversed=Object.fromEntries(Object.entries(input).reverse());
  assert.equal((await nativeVerificationBinding({challenge,request:reversed,crypto:webcrypto})).requestHash,first.requestHash);
  for(const change of [{challenge:'b'.repeat(43)},{request:{...input,nonce:'m'.repeat(48)}},
    {request:{...input,environment:'sandbox/test'}},{request:{...input,productId:'other'}},
    {request:{...input,basePlanId:'other'}},{request:{...input,evidence:{purchaseTokens:['changed-token']}}}]){
    try{assert.notEqual((await nativeVerificationBinding({challenge,request:input,crypto:webcrypto,...change})).requestHash,first.requestHash);}
    catch(error){assert.match(error.message,/invalid_store_evidence|native_binding_unavailable/);}
  }
  assert.equal(first.digest.length,32);assert.match(first.evidenceHash,/^[A-Za-z0-9_-]{43}$/);
});

test('challenge issuance is bounded, hashed, platform scoped and never mints proof',async()=>{
  const issued=[];const handler=createNativeChallengeHandler({crypto:webcrypto,now:()=>now,
    rateLimit:{allow:async()=>true},store:{issue:async row=>{issued.push(row);return true;}}});
  const response=await handler(new Request('https://fixture.invalid/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'apple'})}));
  assert.equal(response.status,200);const result=await response.json();
  assert.deepEqual(Object.keys(result).sort(),['challenge','expiresAt','protocolVersion']);
  assert.match(result.challenge,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.expiresAt,new Date(now+120000).toISOString());
  assert.notEqual(issued[0].hash,result.challenge);assert.equal(issued[0].platform,'apple');
  assert.equal((await createNativeChallengeHandler() (new Request('https://fixture.invalid',{method:'POST'}))).status,503);
  assert.equal((await handler(new Request('https://fixture.invalid/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"platform":"web"}'}))).status,400);
});

test('trusted verifier port precedes atomic consume; replay, expiry, mutation, wrong platform deny',async()=>{
  const challenges=new Map();let clock=now,providerCalls=0;
  const store={issue:async row=>{challenges.set(row.hash,{...row,consumed:false});return true;},
    consume:async row=>{const saved=challenges.get(row.hash);if(!saved||saved.consumed||saved.platform!==row.platform||Date.parse(saved.expiresAt)<=clock)return false;
      saved.consumed=true;providerCalls++;return true;}};
  const challengeHandler=createNativeChallengeHandler({store,rateLimit:{allow:async()=>true},crypto:webcrypto,now:()=>clock});
  const issue=async (platform='apple')=>(await (await challengeHandler(new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform})}))).json()).challenge;
  const authorizer=createNativeAuthorizer({store,crypto:webcrypto,appleVerifier:{verify:async({authorization,digest})=>
    authorization?.object===Buffer.from(digest).toString('base64url')?{verified:true,platform:'apple'}:null}});
  const make=async(challenge,patch={})=>{const body={...request(),nativeChallenge:challenge,...patch};
    const binding=await nativeVerificationBinding({challenge,request:body,crypto:webcrypto});body.nativeAuthorization={type:'apple_assertion',object:binding.requestHash};return body;};
  const challenge=await issue(),body=await make(challenge);
  assert.equal(await authorizer({body:JSON.stringify(body),environment:'production'}),true);
  assert.equal(providerCalls,1);
  assert.equal(await authorizer({body:JSON.stringify(body),environment:'production'}),false);
  assert.equal(providerCalls,1);
  const changed=await make(await issue());changed.productId='wrong';
  assert.equal(await authorizer({body:JSON.stringify(changed),environment:'production'}),false);
  const stale=await make(await issue());clock+=120001;
  assert.equal(await authorizer({body:JSON.stringify(stale),environment:'production'}),false);
  assert.equal(await authorizer({body:JSON.stringify({...body,platform:'google'}),environment:'production'}),false);
});

test('Google decoded standard verdict requires exact package/hash, freshness, recognized licensed device',async()=>{
  const hash='h'.repeat(43),base={requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:hash,timestampMillis:String(now)},
    appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED'},
    accountDetails:{appLicensingVerdict:'LICENSED'},deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']}};
  const auth={type:'google_standard',token:'opaque-local-token'};
  const run=async(patch={})=>createGoogleIntegrityVerifier({now:()=>now,accessToken:async()=> 'local-oauth',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://playintegrity.googleapis.com/v1/com.gridlygo.gridly:decodeIntegrityToken');
    assert.equal(options.method,'POST');return Response.json({tokenPayloadExternal:{...base,...patch}});}}).verify({authorization:auth,requestHash:hash,environment:'production'});
  assert.equal((await run()).verified,true);
  for(const patch of [{requestDetails:{...base.requestDetails,requestHash:'wrong'}},
    {requestDetails:{...base.requestDetails,requestPackageName:'other'}},
    {requestDetails:{...base.requestDetails,timestampMillis:String(now-120001)}},
    {appIntegrity:{...base.appIntegrity,appRecognitionVerdict:'UNRECOGNIZED_VERSION'}},
    {accountDetails:{appLicensingVerdict:'UNLICENSED'}},
    {deviceIntegrity:{deviceRecognitionVerdict:[]}}])assert.equal(await run(patch),null);
  assert.equal(await createGoogleIntegrityVerifier({accessToken:async()=> 'x',fetchImpl:async()=>Response.json({})}).verify({authorization:{type:'google_standard',token:''},requestHash:hash,environment:'production'}),null);
});

test('Google native authorization consumes only a decoded token bound to its live challenge',async()=>{
  const rows=new Map();let clock=now,decodeCalls=0;
  const store={issue:async row=>{rows.set(row.hash,{...row,consumed:false});return true;},
    consume:async row=>{const saved=rows.get(row.hash);
      if(!saved || saved.consumed || saved.platform!==row.platform || saved.purpose!==row.purpose ||
        Date.parse(saved.expiresAt)<=clock || row.verdict.kind!=='google_standard')return false;
      saved.consumed=true;return true;}};
  const issue=createNativeChallengeHandler({store,rateLimit:{allow:async()=>true},crypto:webcrypto,now:()=>clock});
  const challenge=async platform=>(await (await issue(new Request('https://fixture.invalid/challenge',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform})}))).json()).challenge;
  const verifier=createGoogleIntegrityVerifier({now:()=>clock,accessToken:async()=> 'local-oauth',
    fetchImpl:async(_url,options)=>{decodeCalls++;
      const token=JSON.parse(options.body).integrity_token;
      return Response.json({tokenPayloadExternal:{
        requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:token,timestampMillis:String(clock)},
        appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED'},
        accountDetails:{appLicensingVerdict:'LICENSED'},
        deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']}}});}});
  const authorize=createNativeAuthorizer({store,googleVerifier:verifier,crypto:webcrypto});
  const make=async c=>{const body={...request('google'),nativeChallenge:c};
    body.nativeAuthorization={type:'google_standard',token:(await nativeVerificationBinding({challenge:c,request:body,crypto:webcrypto})).requestHash};
    return body;};
  const body=await make(await challenge('google'));
  assert.equal(await authorize({body:JSON.stringify(body),environment:'production'}),true);
  assert.equal(await authorize({body:JSON.stringify(body),environment:'production'}),false);
  assert.equal(await authorize({body:JSON.stringify({...body,nonce:'z'.repeat(48)}),environment:'production'}),false);
  assert.equal(await authorize({body:JSON.stringify({...body,environment:'sandbox/test'}),environment:'production'}),false);
  const wrongPlatform=await make(await challenge('apple'));
  assert.equal(await authorize({body:JSON.stringify(wrongPlatform),environment:'production'}),false);
  const expired=await make(await challenge('google'));clock+=120001;
  assert.equal(await authorize({body:JSON.stringify(expired),environment:'production'}),false);
  assert.ok(decodeCalls>=1);
});

test('attested client invoke binds one server challenge and native object to fixed verifier',async()=>{
  const calls=[],body=request('apple');let digest;
  const requestChallenge=async()=>{calls.push('gateway-challenge');return {data:{challenge:'a'.repeat(43),
    expiresAt:new Date(now+120000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'}};};
  const invoke=async(name)=>{calls.push(name);return {data:{proof:'local-proof'}};};
  const attestation={authorize:async input=>{digest=input.digest;return {type:'apple_initial',keyId:'local-key',object:'local-object'};},
    confirm:async()=>({confirmed:true})};
  const adapter=createNativeAttestedInvoke({platform:'apple',invoke,requestChallenge,nativeAttestation:attestation,crypto:webcrypto,now:()=>now});
  const result=await adapter('gridly-verify-apple-subscription',{body});assert.equal(result.data.proof,'local-proof');
  assert.deepEqual(calls,['gateway-challenge','gridly-verify-apple-subscription']);
  assert.equal(digest,(await nativeVerificationBinding({challenge:'a'.repeat(43),request:body,crypto:webcrypto})).requestHash);
  assert.equal(createNativeAttestedInvoke({platform:'web',invoke,nativeAttestation:attestation}),null);
  await assert.rejects(()=>adapter('gridly-verify-google-subscription',{body}),/verification_unavailable/);
});
