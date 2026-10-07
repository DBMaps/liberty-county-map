import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto as crypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {sandboxAcceptanceComposition,productionComposition} from '../supabase/functions/_shared/entitlement/composition.mjs';
import {createGoogleIntegrityVerifier} from '../supabase/functions/_shared/entitlement/google-integrity.mjs';
import {createNativeAuthorizer} from '../supabase/functions/_shared/entitlement/native-authorization.mjs';
import {nativeVerificationBinding} from '../js/gridly-native-verification-binding.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';
import {createGooglePlayBilling,createGoogleVerificationAuthority} from '../js/gridly-google-play-billing.mjs';
import {createPaidReportHandler,verifyPaidReportProof} from '../supabase/functions/_shared/paid-report.mjs';
import {GOOGLE_LICENSE_TEST_POLICY as policy} from '../supabase/functions/_shared/entitlement/google-license-test-policy.mjs';

const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const productionKeys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const fingerprintKey=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const aes=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const token='synthetic-fixture-google-token',productId='com.gridlygo.gridly.monthly';

function fixture({environment='sandbox/test',testPurchase=true,versionCode='11',patch={},publisherStatus=200,ackFailures=0}={}) {
  let now=Date.now(),acknowledged=false,digest,queued;
  const counts={integrity:0,publisher:0,cache:0,ack:0,enqueue:0},consumed=new Set();
  const data=()=>({regionCode:'US',packageName:'com.gridlygo.gridly',startTime:new Date(now-1000).toISOString(),
    subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',...(testPurchase?{testPurchase:{}}:{}),
    acknowledgementState:acknowledged?'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED':'ACKNOWLEDGEMENT_STATE_PENDING',
    lineItems:[{productId,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(now+300000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...patch});
  const verifier=createGoogleIntegrityVerifier({acceptedEnvironment:environment,
    ...(environment==='sandbox/test'?{acceptedVersionCodes:policy.versionCodes}:{}),accessToken:async()=> 'synthetic-oauth',now:()=>now,
    fetchImpl:async()=>{counts.integrity++;return Response.json({tokenPayloadExternal:{
      requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:digest,timestampMillis:String(now)},
      appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED',...(versionCode===null?{}:{versionCode})},
      accountDetails:{appLicensingVerdict:'LICENSED'},deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']}}});}});
  const authorizeNative=createNativeAuthorizer({crypto,googleVerifier:verifier,store:{consume:async({hash})=>{
    if(consumed.has(hash))return false;consumed.add(hash);return true;}}});
  const signing=environment==='production'?productionKeys:keys;
  const ports={crypto,authorizeNative,signingKey:signing.privateKey,fingerprintKey,
    ...(environment==='sandbox/test'?{googleLicenseTestAuthority:policy.authority}:{}),
    cache:{apply:async row=>{counts.cache++;assert.doesNotMatch(JSON.stringify(row),/synthetic-fixture-google-token/);return true;}},
    google:{now:()=>now,accessToken:async()=> 'synthetic-oauth',encryptionKeys:{current:{version:'fixture',key:aes}},
      store:{enqueue:async row=>{counts.enqueue++;if(!queued)queued={...row,expires_at:row.provider_deadline_at,state:'queued'};return true;},
        claim:async()=>{if(!queued||queued.state!=='queued')return [];queued.state='leased';return [{...queued,lease:'fixture-lease',lease_until:new Date(Date.now()+120000).toISOString()}];},
        resolve:async({outcome})=>{queued.state=outcome==='retry'?'queued':'done';return true;}},
      fetchImpl:async(url,options)=>{
        assert.ok(url.startsWith('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.gridlygo.gridly/purchases/'));
        if(options.method==='POST'){assert.ok(url.endsWith(':acknowledge'));counts.ack++;
          if(counts.ack<=ackFailures)return new Response(null,{status:503});acknowledged=true;return new Response(null,{status:200});}
        assert.equal(options.method,'GET');counts.publisher++;
        return publisherStatus===200?Response.json(data()):new Response(null,{status:publisherStatus});}}};
  const runtime=(environment==='production'?productionComposition:sandboxAcceptanceComposition)(ports);
  async function request(extra={},body) {
    const input=body??{platform:'google',environment,productId,basePlanId:'monthly',
      nonce:Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('hex'),evidence:{purchaseTokens:[token]}};
    const challenge=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
    const raw={...input,...extra,nativeChallenge:challenge,nativeAuthorization:{type:'google_standard',token:'synthetic-integrity'}};
    digest=(await nativeVerificationBinding({challenge,request:raw,crypto})).requestHash;
    return {nonce:raw.nonce,request:new Request('https://fixture.invalid/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(raw)})};
  }
  return {runtime,request,counts,now:()=>now,advance:ms=>{now+=ms;},setPatch:value=>Object.assign(patch,value),signing,acknowledged:()=>acknowledged};
}
async function verify(f,response,nonce,environment='sandbox/test') {
  const proof=(await response.json()).proof;
  const row=await verifyAuthorityProof({proof,publicKey:f.signing.publicKey,nonce,platform:'google',environment,now:f.now(),crypto});
  return {proof,row};
}

test('active Google test purchase verifies, durably acknowledges, signs explicit test authority and authorizes reporting only by server policy',async()=>{
  const f=fixture(),r=await f.request(),response=await f.runtime.google(r.request);
  assert.equal(response.status,200);assert.equal(f.counts.ack,1);assert.equal(f.acknowledged(),true);
  const {proof,row}=await verify(f,response,r.nonce);assert.equal(row.testAuthority,policy.authority);
  assert.equal(accessDecision(row,{platform:'google',environment:'sandbox/test',now:f.now()}).allowed,true);
  assert.equal(accessDecision(row,{platform:'google',environment:'production',now:f.now()}).allowed,false);
  const options={publicKey:productionKeys.publicKey,now:f.now(),crypto};
  assert.equal(await verifyPaidReportProof(proof,options),false);
  assert.equal(await verifyPaidReportProof(proof,{...options,googleLicenseTestPublicKey:keys.publicKey}),true);
  let writes=0;
  const handler=createPaidReportHandler({...options,now:f.now,googleLicenseTestPublicKey:keys.publicKey,
    writer:async()=>{writes++;return {data:{status:'already_processed'}};}});
  const report=()=>new Request('https://fixture.invalid/report',{method:'POST',body:JSON.stringify({proof,operation:'cancel_community_operation',args:{operation_id:'synthetic-operation'}})});
  assert.equal((await handler(report())).status,200);assert.equal(writes,1);
  f.advance(300001);assert.equal((await handler(report())).status,403);assert.equal(writes,1);
});

test('production rejects test evidence before cache/ack/proof; production real purchase still acknowledges and receives production-only proof',async()=>{
  const wrong=fixture({environment:'production'}),r=await wrong.request();assert.equal((await wrong.runtime.google(r.request)).status,502);
  assert.equal(wrong.counts.publisher,1);assert.equal(wrong.counts.cache,0);assert.equal(wrong.counts.ack,0);
  const f=fixture({environment:'production',testPurchase:false}),valid=await f.request(),response=await f.runtime.google(valid.request);
  assert.equal(response.status,200);assert.equal(f.counts.ack,1);
  const {proof,row}=await verify(f,response,valid.nonce,'production');assert.equal(row.testAuthority,undefined);
  assert.equal(await verifyPaidReportProof(proof,{publicKey:productionKeys.publicKey,googleLicenseTestPublicKey:keys.publicKey,now:f.now(),crypto}),true);
});

test('Google-attested build gate rejects old, future, missing and numeric version identities before Publisher; request cannot self-declare build',async()=>{
  for(const versionCode of ['10','12',null,11]){
    const f=fixture({versionCode}),r=await f.request();assert.equal((await f.runtime.google(r.request)).status,401);
    assert.equal(f.counts.publisher,0);assert.equal(f.counts.ack,0);
  }
  const f=fixture(),r=await f.request({versionCode:'11',testMode:true});assert.equal((await f.runtime.google(r.request)).status,400);
  assert.equal(f.counts.integrity,0);
});

test('wrong package/product/base-plan, missing test marker, invalid provider token and expired evidence cannot receive paid test proof or acknowledgment',async()=>{
  for(const options of [
    {patch:{packageName:'another.app'}},
    {patch:{lineItems:[{productId:'another.product',offerDetails:{basePlanId:'monthly'}}]}},
    {patch:{lineItems:[{productId,offerDetails:{basePlanId:'annual'}}]}},
    {testPurchase:false},{publisherStatus:404},{publisherStatus:410},
    {patch:{subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{productId,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(Date.now()-10000).toISOString()}]}}
  ]) {
    const f=fixture(options),r=await f.request(),response=await f.runtime.google(r.request);
    assert.equal(f.counts.ack,0);
    if(response.status===200){const {row}=await verify(f,response,r.nonce);assert.equal(row.entitlementState,'not_entitled');}
    else assert.equal(response.status,502);
  }
});

test('acknowledgment failure prevents proof, same verified purchase retries without rebuying, and successful duplicate checks do not acknowledge twice',async()=>{
  const f=fixture({ackFailures:1});let r=await f.request();assert.equal((await f.runtime.google(r.request)).status,502);
  assert.equal(f.acknowledged(),false);r=await f.request();assert.equal((await f.runtime.google(r.request)).status,200);
  assert.equal(f.acknowledged(),true);assert.equal(f.counts.ack,2);
  r=await f.request();assert.equal((await f.runtime.google(r.request)).status,200);assert.equal(f.counts.ack,2);
});

test('verified canceled test subscription retains only its remaining period; cancellation/expiry then denies app and reporting access',async()=>{
  const end=Date.now()+120000;
  const f=fixture({patch:{subscriptionState:'SUBSCRIPTION_STATE_CANCELED',lineItems:[{productId,
    offerDetails:{basePlanId:'monthly'},expiryTime:new Date(end).toISOString(),autoRenewingPlan:{autoRenewEnabled:false}}]}});
  let r=await f.request(),result=await verify(f,await f.runtime.google(r.request),r.nonce);
  assert.equal(result.row.subscriptionState,'canceled_pending_expiry');
  assert.equal(accessDecision(result.row,{platform:'google',environment:'sandbox/test',now:f.now()}).allowed,true);
  f.advance(120001);r=await f.request();result=await verify(f,await f.runtime.google(r.request),r.nonce);
  assert.equal(result.row.subscriptionState,'expired');
  assert.equal(accessDecision(result.row,{platform:'google',environment:'sandbox/test',now:f.now()}).allowed,false);
  assert.equal(await verifyPaidReportProof(result.proof,{publicKey:productionKeys.publicKey,
    googleLicenseTestPublicKey:keys.publicKey,now:f.now(),crypto}),false);
});

test('challenge replay is rejected before a second provider/ack side effect',async()=>{
  const f=fixture(),r=await f.request(),copy=r.request.clone();assert.equal((await f.runtime.google(r.request)).status,200);
  const calls={...f.counts};assert.equal((await f.runtime.google(copy)).status,401);
  assert.deepEqual(f.counts,{...calls,integrity:calls.integrity+1});
});

test('client Restore uses existing native token and test authority; expired/refunded provider evidence revokes admission without purchasing',async()=>{
  const f=fixture();let purchases=0,delivered=0;
  const authority=createGoogleVerificationAuthority({environment:'sandbox/test',invoke:async(name,{body})=>{
    assert.equal(name,'gridly-verify-google-sandbox-subscription');const r=await f.request({},body),response=await f.runtime.google(r.request);
    return response.ok?{data:await response.json()}:{error:{context:{status:response.status}}};}});
  const native=async()=>({result:'purchased',productId,basePlanId:'monthly',purchaseToken:token});
  const session=createGooglePlayBilling({capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},
    plugin:{restorePurchases:native,refreshEntitlement:native,queryCurrentPurchases:native,purchase:async()=>{purchases++;return native();}},
    authority,environment:'sandbox/test',publicKey:keys.publicKey,crypto,now:f.now,deliverEntitlement:async()=>{delivered++;return true;}});
  await session.restore();assert.equal(session.allowed().allowed,true);assert.equal(purchases,0);assert.equal(delivered,1);
  f.setPatch({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{productId,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(f.now()-1000).toISOString()}]});
  await session.refresh();assert.equal(session.allowed().allowed,false);assert.equal(session.read().entitlementState,'not_entitled');
  assert.equal(purchases,0);assert.equal(delivered,1);
});

test('forged, wrong-key, old-authority and unpaid test proofs never authorize reporting',async()=>{
  const f=fixture(),r=await f.request(),{proof}=await verify(f,await f.runtime.google(r.request),r.nonce);
  const options={publicKey:productionKeys.publicKey,googleLicenseTestPublicKey:keys.publicKey,now:f.now(),crypto};
  const [head,payload,signature]=proof.split('.'),claims=JSON.parse(Buffer.from(payload,'base64url'));
  for(const patch of [{testAuthority:'old-test-authority'},{environment:'production'},{entitlementState:'not_entitled'},{platform:'apple'}]) {
    const forged=head+'.'+Buffer.from(JSON.stringify({...claims,...patch})).toString('base64url')+'.'+signature;
    assert.equal(await verifyPaidReportProof(forged,options),false);
  }
  for(const patch of [{testAuthority:undefined},{testAuthority:'old-test-authority'},
    {entitlementState:'not_entitled',subscriptionState:'inactive'}]) {
    const input=head+'.'+Buffer.from(JSON.stringify({...claims,...patch})).toString('base64url');
    const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(input));
    assert.equal(await verifyPaidReportProof(input+'.'+Buffer.from(sig).toString('base64url'),options),false);
  }
  const foreign=fixture({environment:'production',testPurchase:false}),q=await foreign.request(),productionProof=(await (await foreign.runtime.google(q.request)).json()).proof;
  assert.equal(await verifyPaidReportProof(productionProof,{...options,publicKey:keys.publicKey}),false);
  assert.equal(await verifyPaidReportProof(proof,{...options,googleLicenseTestPublicKey:productionKeys.publicKey}),false);
});

test('Internal Testing staging is explicit; root production default, branded startup/Search ancestry and Apple entrypoints remain untouched',()=>{
  const ui=readFileSync('js/gridly-paid-ui.mjs','utf8');assert.match(ui,/GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE = false/);
  assert.match(ui,/gridlyPaidEntrySubscribe/);assert.match(ui,/View subscription/);
  const tool=readFileSync('tools/prepare-android-internal-candidate.mjs','utf8');assert.match(tool,/--google-license-test/);
  assert.match(tool,/GOOGLE_LICENSE_TEST_POLICY.versionCodes.includes/);
  const sandbox=readFileSync('supabase/functions/_shared/entitlement/sandbox-google-edge-runtime.ts','utf8');
  assert.match(sandbox,/acceptedVersionCodes:GOOGLE_LICENSE_TEST_POLICY.versionCodes/);
  assert.match(sandbox,/googleLicenseTestAuthority:GOOGLE_LICENSE_TEST_POLICY.authority/);
  const prod=readFileSync('supabase/functions/gridly-verify-google-subscription/index.ts','utf8');assert.doesNotMatch(prod,/sandbox|license/i);
  assert.match(readFileSync('android/app/build.gradle','utf8'),/versionCode 11/);
});
