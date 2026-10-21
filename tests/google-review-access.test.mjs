import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto as crypto,createHash} from 'node:crypto';
import {createNativeAttestedInvoke} from '../js/gridly-native-attested-invoke.mjs';
import {createNativeEdgeTransport} from '../js/gridly-native-edge-transport.mjs';
import {nativeVerificationBinding} from '../js/gridly-native-verification-binding.mjs';
import {storeVerificationRequest} from '../js/gridly-store-verification.mjs';
import {verifyGoogleReviewProof,googleReviewAllowed,GOOGLE_REVIEW_ENDPOINT,GOOGLE_REVIEW_BUILD_VERSION,GOOGLE_REVIEW_COMPATIBLE_BUILDS} from '../js/gridly-google-review-proof.mjs';
import {withGoogleReviewAccess} from '../js/gridly-google-review-access.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';
import {verifyPaidReportProof} from '../supabase/functions/_shared/paid-report.mjs';
import {productionAndroidSource,PRODUCTION_SPECIALIZED_MODULES} from '../tools/android-production-sources.mjs';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {validateGoogleReviewReport} from '../supabase/functions/_shared/google-review-report-validation.mjs';
const backendRoot=resolve(process.env.GRIDLY_REVIEW_BACKEND_ROOT||'.');
const {createGoogleReviewHandler,createGoogleReviewNativeAuthorizer}=await import(pathToFileURL(resolve(backendRoot,'supabase/functions/_shared/google-review.mjs')));
const {createGoogleIntegrityVerifier,createGoogleReviewIntegrityVerifier}=await import(pathToFileURL(resolve(backendRoot,'supabase/functions/_shared/entitlement/google-integrity.mjs')));
const now=Date.now(),id='grr_'+'a'.repeat(32),code=id+'_'+'a'.repeat(43),revision='c'.repeat(32),nonce='n'.repeat(43),challenge='c'.repeat(43);
const certificate=Buffer.from('3763446a68e18349e0a3474e21d28a142746f30e4c22957baa930da23650913b','hex').toString('base64url');
const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const requestBody=()=>storeVerificationRequest({platform:'google',environment:'production',nonce,evidence:{purchaseTokens:[code]}});
const request=body=>new Request('https://example.test/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function payload(hash,patch={}) {return {requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:hash,timestampMillis:String(now)},
  appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED',versionCode:'14',certificateSha256Digest:[certificate]},
  deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']},accountDetails:{appLicensingVerdict:'UNLICENSED'},...patch};}
async function fixture({verdictPatch={},credentialEnabled=true,buildVersionCode='14'}={}) {
  let consumed=false,enabled=credentialEnabled,hash=null,verified=0,reportCalls=0;
  const googleVerifier=createGoogleReviewIntegrityVerifier({now:()=>now,accessToken:async()=>'fixture-oauth',
    fetchImpl:async(url,options)=>{assert.match(url,/playintegrity.googleapis.com/);assert.equal(JSON.parse(options.body).integrity_token,'fixture-integrity');return Response.json({tokenPayloadExternal:payload(hash,{appIntegrity:{...payload(hash).appIntegrity,versionCode:buildVersionCode},...verdictPatch})});}});
  const authorizeNative=createGoogleReviewNativeAuthorizer({crypto,store:{consume:async()=>{if(consumed)return false;consumed=true;return true;}},googleVerifier});
  const handler=createGoogleReviewHandler({...keys,crypto,now:()=>now,authorizeNative,
    credentialAuthority:async args=>{
      assert.ok(Object.keys(args).every(key=>['action','credentialId','digest','revision'].includes(key)));
      if(!enabled||args.credentialId!==id)return null;
      if(args.action==='login'&&args.digest!==createHash('sha256').update(code).digest('hex'))return null;
      if(args.action!=='login'&&args.revision!==revision)return null;
      if(args.action==='denied')return null;
      if(args.action==='verified')verified++;
      if(args.action==='report')reportCalls++;
      return {credentialId:id,credentialRevision:revision};
    },reportingStatus:async()=>({reporting_enabled:true,protocol_version:2})});
  const invoke=createNativeAttestedInvoke({platform:'google',googleReviewAccess:true,crypto,now:()=>now,
    requestChallenge:async()=>({data:{challenge,expiresAt:new Date(now+120000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'}}),
    nativeAttestation:{prepare:async()=>({prepared:true}),authorize:async input=>{hash=input.digest;return {type:'google_standard',token:'fixture-integrity'};}},
    invoke:async(name,{body})=>{assert.equal(name,GOOGLE_REVIEW_ENDPOINT);const response=await handler(request(body));return {data:await response.json(),error:response.ok?null:{status:response.status}};}});
  return {handler,invoke,revoke:()=>{enabled=false;},stats:()=>({verified,reportCalls,consumed})};
}
test('review credential → attestation → signed proof → protected runtime → isolated reporting; no purchase or Google account',async()=>{
  const f=await fixture();let started=0,normalPurchase=0;
  const normal={read:()=>({allowed:false,state:'not_entitled',platform:'google'}),allowed:()=>false,subscribe:fn=>{fn();return()=>{};},
    initializeRuntime:async()=>{throw Error('locked');},getReportingProof:async()=>null,purchase:async()=>{normalPurchase++;},stop:async()=>{}};
  const coordinator=withGoogleReviewAccess(normal,{invoke:f.invoke,publicKey:keys.publicKey,now:()=>now,crypto});
  assert.equal(coordinator.allowed(),false);assert.equal(await coordinator.enterReview(code),true);assert.equal(coordinator.allowed(),true);
  await coordinator.initializeRuntime(async allowed=>{assert.equal(allowed(),true);started++;});assert.equal(started,1);assert.equal(normalPurchase,0);
  assert.equal(coordinator.isReviewActive(),true);
  const proof=await coordinator.getReportingProof();const args={operation_id:crypto.randomUUID()};
  const client={functions:{invoke:async(_,{body})=>{const response=await f.handler(request(body));return {data:await response.json(),error:response.ok?null:true};}}};
  assert.deepEqual(await coordinator.validateReviewOperation('cancel_community_operation',args,client),{status:'review_validated',publication:'none'});
  assert.deepEqual(f.stats(),{verified:1,reportCalls:1,consumed:true});
  f.revoke();assert.equal((await(await f.handler(request({proof,protocol_version:2,operation:'cancel_community_operation',args}))).json()).status,'forbidden');
  await coordinator.stop();assert.equal(coordinator.allowed(),false);
});
test('review proof cannot become normal paid entitlement or production reporting authority',async()=>{
  const f=await fixture(),result=await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()}),proof=result.data.proof;
  const verified=await verifyGoogleReviewProof({proof,publicKey:keys.publicKey,nonce,now,crypto});assert.equal(googleReviewAllowed(verified,now),true);
  const normal=await verifyAuthorityProof({proof,publicKey:keys.publicKey,nonce,platform:'google',now,crypto});assert.equal(accessDecision(normal,{platform:'google',now}).allowed,false);
  assert.equal(await verifyPaidReportProof(proof,{publicKey:keys.publicKey,now,crypto}),false);
  assert.equal(googleReviewAllowed({...verified},now),false);
  for(const options of [{nonce:'wrong'},{now:now+180000},{now:now-1},{proof:proof.slice(0,-8)+'tampered'}])
    assert.equal(await verifyGoogleReviewProof({proof,publicKey:keys.publicKey,nonce,now,crypto,...options}),null);
});
test('wrong credential, repeated challenge, client flags and foreign operations fail closed',async()=>{
  const f=await fixture();assert.equal((await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:{...requestBody(),evidence:{purchaseTokens:[id+'_'+'b'.repeat(43)]}}})).error.status,403);
  assert.equal((await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()})).error,null);
  assert.equal((await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()})).error.status,403);
  for(const body of [{paid:true},{proof:'fake',operation:'delete_account',args:{}},{proof:'fake',operation:'cancel_community_operation',args:{}},
    {...requestBody(),nativeAuthorization:{},nativeChallenge:challenge,environment:'sandbox/test'}])assert.notEqual((await f.handler(request(body))).status,200);
});
test('complete reviewer report validates without persistence ports, published rows or replay payloads',async()=>{
  const f=await fixture(),login=await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()}),proof=login.data.proof;
  const args={submission_token:crypto.randomUUID(),reporter_device_id:'fixture-device',report:{crossing_id:'hazard-fixture',crossing_name:'Fixture road',lat:30,lng:-95,report_type:'flooded',severity:'high',detail:'Flooded road'}};
  const body={proof,protocol_version:2,operation:'submit_community_observation',args};
  for(let i=0;i<2;i++)assert.deepEqual(await(await f.handler(request(body))).json(),{status:'review_validated',authority:'gridly-google-play-review-v12',protocol_version:2,publication:'none'});
  for(const patch of [{protocol_version:1},{proof:'fake'},{args:{...args,report:{...args.report,device_id:'hidden'}}},{args:{...args,submission_token:'not-uuid'}},{args:{...args,report:{...args.report,lat:100}}}])assert.notEqual((await f.handler(request({...body,...patch}))).status,200);
  assert.equal(f.stats().reportCalls,5); // No report body is passed to credentialAuthority.
});
test('disabled credential never yields a reviewer lease',async()=>{
  const f=await fixture({credentialEnabled:false});assert.equal((await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()})).error.status,403);
  assert.equal(f.stats().consumed,false);
});

test('Build 14 proof reflects attestation; live Build 12 remains compatible without cross-build client admission',async()=>{
  for(const buildVersionCode of ['12','14']) {
    const f=await fixture({buildVersionCode}),result=await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()});
    assert.equal(result.error,null);
    const row=JSON.parse(Buffer.from(result.data.proof.split('.')[1],'base64url'));
    assert.equal(row.buildVersionCode,buildVersionCode);
    assert.ok(await verifyGoogleReviewProof({proof:result.data.proof,publicKey:keys.publicKey,nonce,now,crypto,acceptedBuilds:[buildVersionCode]}));
    assert.equal(!!await verifyGoogleReviewProof({proof:result.data.proof,publicKey:keys.publicKey,nonce,now,crypto}),buildVersionCode==='14');
  }
});

test('ordinary users, guessed codes, client build flags and unapproved builds never acquire review access',async()=>{
  for(const buildVersionCode of ['11','13','15']) {
    const f=await fixture({buildVersionCode});
    assert.equal((await f.invoke(GOOGLE_REVIEW_ENDPOINT,{body:requestBody()})).error.status,403);
    assert.equal(f.stats().verified,0);
  }
  for(const patch of [{evidence:{purchaseTokens:[]}},{evidence:{purchaseTokens:['ordinary-user']}},{buildVersionCode:'14'},{reviewAccess:true},{paid:true}]) {
    const f=await fixture();assert.notEqual((await f.handler(request({...requestBody(),nativeChallenge:challenge,nativeAuthorization:{type:'google_standard',token:'fixture'},...patch}))).status,200);
    assert.equal(f.stats().verified,0);
  }
  const f=await fixture(),body={...requestBody(),nativeChallenge:challenge,nativeAuthorization:{type:'google_standard',token:'unsigned-client-verdict'}};
  // A client claiming a build or a boolean native success is not server context.
  const handler=createGoogleReviewHandler({...keys,crypto,now:()=>now,authorizeNative:async()=>true,
    credentialAuthority:async()=>({credentialId:id,credentialRevision:revision}),reportingStatus:async()=>({reporting_enabled:true,protocol_version:2})});
  assert.equal((await handler(request(body))).status,403);
});

test('revoking a reusable credential closes the active review session on refresh',async()=>{
  const f=await fixture();
  const normal={read:()=>({allowed:false,state:'not_entitled',platform:'google'}),allowed:()=>false,subscribe:()=>()=>{},getReportingProof:async()=>null,stop:async()=>{}};
  const coordinator=withGoogleReviewAccess(normal,{invoke:f.invoke,publicKey:keys.publicKey,now:()=>now,crypto});
  try {
    assert.equal(await coordinator.enterReview(code),true);assert.equal(coordinator.allowed(),true);
    f.revoke();assert.equal(await coordinator.refresh(),false);assert.equal(coordinator.allowed(),false);
    assert.equal(coordinator.isReviewActive(),false);assert.equal(await coordinator.getReportingProof(),null);
  } finally {await coordinator.stop();}
});

test('concurrent reviewer authorization cannot exchange attested build contexts',async()=>{
  const authorize=createGoogleReviewNativeAuthorizer({crypto,store:{consume:async()=>true},googleVerifier:{verify:async({authorization})=>{
    const version=authorization.token;await new Promise(resolve=>setTimeout(resolve,version==='12'?8:1));
    return {verified:true,platform:'google',kind:'google_standard',buildVersionCode:version};}}});
  const body=version=>JSON.stringify({...requestBody(),nativeChallenge:challenge,nativeAuthorization:{type:'google_standard',token:version}});
  assert.deepEqual(await Promise.all(['12','14'].map(version=>authorize({body:body(version),environment:'production'}))),[{buildVersionCode:'12'},{buildVersionCode:'14'}]);
});

test('review build guard matches the replacement Android release; certified startup repair is retained',async()=>{
  assert.equal(GOOGLE_REVIEW_BUILD_VERSION,'14');assert.deepEqual(GOOGLE_REVIEW_COMPATIBLE_BUILDS,['12','14']);
  assert.match(await readFile('android/app/build.gradle','utf8'),new RegExp('versionCode '+GOOGLE_REVIEW_BUILD_VERSION+'\\b'));
  assert.match(await readFile('js/gridly-paid-ui.mjs','utf8'),/googleEntry&&tourComplete&&!subscriptionOpen/);
});
test('review validator rejects hidden identifiers, unknown fields, invalid mutations and malformed protocol',()=>{
  const token=crypto.randomUUID(),target=crypto.randomUUID(),report={crossing_id:'hazard-fixture',crossing_name:'Fixture road',lat:30,lng:-95,report_type:'flooded',severity:'high'};
  const args={submission_token:token,reporter_device_id:'fixture-device',report};
  assert.equal(validateGoogleReviewReport('submit_community_observation',args,{now}),true);
  assert.equal(validateGoogleReviewReport('submit_community_observation',{...args,report:{...report,expires_at:new Date(now+10800000).toISOString()}},{now}),true);
  for(const value of [{...args,extra:true},{...args,report:{...report,operation_id:token}},{...args,report:{...report,detail:token}},{...args,report:{...report,expires_at:'not-a-date'}},{...args,report:{...report,report_type:'hazard_cleared'}}])assert.equal(validateGoogleReviewReport('submit_community_observation',value,{now}),false);
  for(const action of ['confirm','clear','edit'])assert.equal(validateGoogleReviewReport('mutate_community_observation',{operation_id:token,observation_id:target,action,changes:action==='edit'?{detail:'review update'}:{},reporter_device_id:'fixture-device'}),true);
  assert.equal(validateGoogleReviewReport('mutate_community_observation',{operation_id:token,observation_id:target,action:'clear',changes:{detail:'unexpected'},reporter_device_id:'fixture-device'}),false);
  for(const operation of ['submit_community_moderation_report','request_community_report_deletion'])assert.equal(validateGoogleReviewReport(operation,{operation_id:token,target_report_id:target,reporter_device_id:'fixture-device',...(operation.startsWith('submit')?{reason:'false_report'}:{})}),true);
});
test('review attestation pins package, build, Play signing certificate, fresh hash and device integrity',async()=>{
  const hash='h'.repeat(43),base=payload(hash);
  const patches=[{appIntegrity:{...base.appIntegrity,versionCode:'11'}},{appIntegrity:{...base.appIntegrity,packageName:'foreign'}},
    {appIntegrity:{...base.appIntegrity,appRecognitionVerdict:'UNRECOGNIZED_VERSION'}},{appIntegrity:{...base.appIntegrity,certificateSha256Digest:['foreign']}},
    {requestDetails:{...base.requestDetails,requestHash:'z'.repeat(43)}},{requestDetails:{...base.requestDetails,timestampMillis:String(now-120001)}},
    {deviceIntegrity:{deviceRecognitionVerdict:[]}}];
  for(const patch of patches) {
    const verifier=createGoogleReviewIntegrityVerifier({now:()=>now,accessToken:async()=>'fixture',fetchImpl:async()=>Response.json({tokenPayloadExternal:{...base,...patch}})});
    assert.equal(await verifier.verify({authorization:{type:'google_standard',token:'fixture'},requestHash:hash,environment:'production'}),null);
  }
  const normal=createGoogleIntegrityVerifier({now:()=>now,acceptedVersionCodes:['12'],accessToken:async()=>'fixture',fetchImpl:async()=>Response.json({tokenPayloadExternal:base})});
  assert.equal(await normal.verify({authorization:{type:'google_standard',token:'fixture'},requestHash:hash,environment:'production'}),null);
  const old=createGoogleIntegrityVerifier({now:()=>now,acceptedVersionCodes:['12'],accessToken:async()=>'fixture',fetchImpl:async()=>Response.json({tokenPayloadExternal:{...base,accountDetails:{appLicensingVerdict:'LICENSED'},appIntegrity:{...base.appIntegrity,versionCode:'11'}}})});
  assert.equal(await old.verify({authorization:{type:'google_standard',token:'fixture'},requestHash:hash,environment:'production'}),null);
});
test('review routing cannot activate on Apple or test authority',()=>{
  assert.equal(createNativeAttestedInvoke({platform:'apple',googleReviewAccess:true,invoke:async()=>{},requestChallenge:async()=>{},nativeAttestation:{authorize:async()=>{}}}),null);
  const cap={isNativePlatform:()=>true,getPlatform:()=>'android'};
  assert.equal(createNativeEdgeTransport({capacitor:cap,googleReviewAccess:true,googleEnvironment:'sandbox/test',http:{request:async()=>{}}}),null);
});
test('production specialization removes Internal v11 issuer, sandbox signer and routing',async()=>{
  for(const path of PRODUCTION_SPECIALIZED_MODULES){const source=await readFile(path,'utf8'),packaged=productionAndroidSource(path,source);
    assert.doesNotMatch(packaged,/gridly-google-play-internal-v11|gridly-verify-google-sandbox-subscription|importSandboxEntitlementKey.*from/);
    assert.notEqual(source,packaged);
  }
});
test('production-specialized cryptographic verifier accepts genuine Google/Apple proofs and rejects Internal v11 even with sandbox arguments',async()=>{
  let source=productionAndroidSource('js/gridly-entitlement.mjs',await readFile('js/gridly-entitlement.mjs','utf8'));
  source=source.replace("'./gridly-store-verification.mjs'",JSON.stringify(pathToFileURL(process.cwd()+'/js/gridly-store-verification.mjs').href));
  const packaged=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const sign=async row=>{const input=Buffer.from(JSON.stringify({alg:'ES256',typ:'gridly-entitlement-v1'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(row)).toString('base64url');return input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input))).toString('base64url');};
  for(const platform of ['google','apple']) {
    const row={platform,productId:'com.gridlygo.gridly.monthly',subscriptionState:'active',entitlementState:'entitled',currentPeriodEnd:new Date(now+86400000).toISOString(),lastVerifiedAt:new Date(now).toISOString(),verificationSource:'gridly_server_store_api',environment:'production',restoreAvailable:true,errorCategory:'none',nonce,audience:'com.gridlygo.gridly',expiresAt:new Date(now+300000).toISOString()};
    const good=await packaged.verifyAuthorityProof({proof:await sign(row),publicKey:keys.publicKey,nonce,platform,now,crypto});assert.equal(packaged.accessDecision(good,{platform,now}).allowed,true);
    if(platform==='google')for(const environment of ['production','sandbox/test']) {
      const denied=await packaged.verifyAuthorityProof({proof:await sign({...row,environment,testAuthority:'gridly-google-play-internal-v11'}),publicKey:keys.publicKey,nonce,platform,environment,now,crypto});assert.equal(packaged.accessDecision(denied,{platform,environment,now}).allowed,false);
    }
  }
});
