import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {webcrypto,randomBytes} from 'node:crypto';
import {createIssuer} from '../tools/native-continuity-certification/issuer.mjs';
import {instrumentIosReset} from '../tools/native-continuity-certification/ios-reset-diagnostics.mjs';
import {instrumentAndroidCommit} from '../tools/native-continuity-certification/android-commit-diagnostics.mjs';
import {prepare,listen} from '../tools/native-continuity-certification/prepare.mjs';
import {once} from 'node:events';
import {Script} from 'node:vm';
import {chromium} from '@playwright/test';
import {verifyContinuity,continuityDecision} from '../js/gridly-continuity.mjs';
import {runtimePolicy,copyGovernedRuntime,assertNoContinuityCertification} from '../tools/native-web.mjs';
const read=path=>readFile(path,'utf8');
const now=Date.parse('2026-09-27T20:00:00Z'),binding='a'.repeat(64);
const issuer=await createIssuer();const key=await webcrypto.subtle.importKey('jwk',issuer.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
for(const platform of ['apple','google'])for(const scenario of ['A','B','C','D','E'])test(platform+': native-harness fixture '+scenario+' uses real signature/policy validation',async()=>{
 const fixture=await issuer.seed({scenario,platform,binding},now);
 const value=await verifyContinuity({proof:fixture.proof,publicKey:key,binding,platform,now,crypto:webcrypto});
 assert.equal(!!value,scenario==='A');
 if(value){assert.equal(continuityDecision(value,{platform,now:now+24*3600000}),false);assert.equal(await verifyContinuity({proof:fixture.proof,publicKey:key,binding:'b'.repeat(64),platform,now,crypto:webcrypto}),null);}
});
test('certification generator creates isolated native identities, attested vaults and debug-only artifacts',async()=>{
 const productionPaths=['capacitor.config.json','android/capacitor.config.json','android/app/src/main/assets/capacitor.config.json','ios/App/App/capacitor.config.json','android/app/src/main/AndroidManifest.xml','ios/App/App/Info.plist'];
 const original=await Promise.all(productionPaths.map(path=>readFile(path)));
 const base=await mkdtemp(join(tmpdir(),'gridly-continuity-cert-'));
 try {
  for(const platform of ['ios','android']) {
   const result=await prepare({platform,output:join(base,platform),publicJwk:issuer.publicJwk});
   assert.equal(result.bundle,'com.gridlygo.continuitycert');
   const configPath=platform==='android'?'android/app/src/main/assets/capacitor.config.json':'ios/App/App/capacitor.config.json';
   const nativeConfig=JSON.parse(await read(join(result.output,configPath)));
   assert.equal(nativeConfig.appId,result.bundle);
   assert.equal(nativeConfig.loggingBehavior,'none');
   if(platform==='android')assert.deepEqual(nativeConfig.server,{androidScheme:'http'});
   else assert.equal(nativeConfig.server,undefined);
   assert.notEqual(nativeConfig.android?.allowMixedContent,true);
   const manifest=JSON.parse(await read(join(result.output,'certification-manifest.json')));assert.equal(manifest.productionBackendConfigured,false);
   assert.equal((await read(join(result.web,'continuity-fixture-config.json'))).includes('"d":'),false);
   await assert.rejects(assertNoContinuityCertification(result.web),/cannot enter a release bundle/);
   const path=platform==='ios'?'ios/App/App/GridlyContinuityPlugin.swift':'android/app/src/main/java/com/gridlygo/gridly/GridlyContinuityPlugin.kt';
   assert.equal(await read(join(result.output,path)),platform==='android'?instrumentAndroidCommit(await read(path)):instrumentIosReset(await read(path)));
   assert.equal(manifest.certificationCommitDiagnostics,platform==='android');assert.equal(manifest.certificationResetDiagnostics,platform==='ios');
   if(platform==='ios') {
    const project=await read(join(result.output,'ios/App/App.xcodeproj/project.pbxproj'));assert.ok(!project.includes('PRODUCT_BUNDLE_IDENTIFIER = com.gridlygo.gridly;'));assert.ok(!project.includes('GridlyStoreKitPlugin.swift'));
    assert.match(await read(join(result.output,'ios/App/App/GridlyBridgeViewController.swift')),/#if !DEBUG[\s\S]*#error/);
   }else {
    assert.match(await read(join(result.output,'android/app/build.gradle')),/applicationId 'com.gridlygo.continuitycert'/);
    assert.match(await read(join(result.output,'android/app/build.gradle')),/cannot build Release/);
    assert.match(await read(join(result.output,'android/app/build.gradle')),/buildFeatures \{ buildConfig true \}/);
   }
  }
  for(let i=0;i<productionPaths.length;i++)assert.ok(original[i].equals(await readFile(productionPaths[i])),'Production configuration changed: '+productionPaths[i]);
  for(const path of productionPaths.filter(path=>path.endsWith('config.json')))assert.notEqual(JSON.parse(await read(path)).server?.androidScheme,'http');
 }finally{await rm(base,{recursive:true,force:true});}
});
test('harness sources and renamed negative markers cannot cross native copy/verification boundary',async()=>{
 const index=await read('index.html'),manifest=await read('consumer-script-manifest.json');
 assert.doesNotMatch(index+manifest,/continuity-certification|continuity-fixture-config|SYNTHETIC_CONTINUITY_CERTIFICATION/);
 assert.ok(runtimePolicy.files.every(path=>!path.startsWith('tools/')&&!path.includes('continuity-certification')));
 const base=await mkdtemp(join(tmpdir(),'gridly-harness-boundary-'));
 try {
  await assert.rejects(copyGovernedRuntime(process.cwd(),base,'tools/native-continuity-certification'),/prohibited/);
  for(const file of ['continuity-certification.mjs','continuity-fixture-config.json','continuity-protected-canary.mjs','.gridly-continuity-certification']) {
   const source=join(base,file.replaceAll('.','_'));await mkdir(source);await writeFile(join(source,file),'synthetic');await writeFile(join(source,'index.html'),'<html>ordinary</html>');
   await assert.rejects(assertNoContinuityCertification(source),/cannot enter a release bundle/);
  }
  const source=join(base,'renamed');await mkdir(source);await writeFile(join(source,'index.html'),'<meta content="SYNTHETIC_CONTINUITY_CERTIFICATION">');await assert.rejects(assertNoContinuityCertification(source),/cannot enter a release bundle/);
  await assertNoContinuityCertification(process.cwd());
 }finally{await rm(base,{recursive:true,force:true});}
});
test('harness uses only real vault methods, lazy gated canary, public routes and loopback fixtures',async()=>{
 const source=await read('tools/native-continuity-certification/continuity-certification.mjs');
 assert.match(source,/if\(state.allowed\)await coordinator.initializeRuntime/);assert.match(source,/import\('\.\/continuity-protected-canary.mjs'\)/);
 assert.match(source,/vault.beginVerification\(/);assert.match(source,/vault.commit\(/);assert.match(source,/vault.revoke\(/);assert.match(source,/vault.retain\(/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|URLSearchParams|window\.[A-Za-z]+\s*=|entitled\s*[:=]\s*true|reporting_enabled|run_cleanup|\.rpc\(|supabase\.co|report_writer|launch_guard/);
 const page=await read('tools/native-continuity-certification/index.html');for(const route of ['legal/privacy.html','legal/terms.html','legal/community-guidelines.html','https://gridlygo.com/support','https://gridlygo.com/delete-data'])assert.ok(page.includes(route));
 const issuerSource=await read('tools/native-continuity-certification/issuer.mjs');assert.doesNotMatch(issuerSource,/fetch\(|\.rpc\(|readFile|writeFile|process\.env/);
 const generator=await read('tools/native-continuity-certification/prepare.mjs');
 assert.match(generator,/port=8765/);assert.match(generator,/server.listen\(port,'127.0.0.1'\)/);
});

// LP244.65D: use an ephemeral port so the owner's existing 8765 issuer is untouched.
test('real loopback issuer accepts valid binding; HTTP localhost retains WebCrypto',async()=>{
 const server=listen(issuer,{port:0});await once(server,'listening');let browser;
 try {
  assert.equal(server.address().address,'127.0.0.1');
  const endpoint='http://127.0.0.1:'+server.address().port+'/seed';
  const preflight=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'http://localhost','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},signal:AbortSignal.timeout(5000)});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'http://localhost');assert.match(preflight.headers.get('access-control-allow-headers'),/Content-Type/i);
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({scenario:'A',platform:'google',binding,nowMs:Date.now()}),signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost');
  const fixture=await response.json();assert.ok(Number.isFinite(fixture.verifiedAt));
  assert.ok(await verifyContinuity({proof:fixture.proof,publicKey:key,binding,platform:'google',now:Date.now(),crypto:webcrypto}));
  const invalid=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:'A',platform:'google',binding:'test',nowMs:Date.now()}),signal:AbortSignal.timeout(5000)});assert.equal(invalid.status,400);
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
  await page.route('http://localhost/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic HTTP transport check</title>'}));
  await page.goto('http://localhost/');
  // Routed desktop origin is used only for crypto availability, not Android fetch proof.
  const result=await page.evaluate(()=>({origin:location.origin,secureContext:isSecureContext,webCrypto:!!crypto.subtle}));
  assert.deepEqual(result,{origin:'http://localhost',secureContext:true,webCrypto:true});
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});

// Execute the actual harness seed function with isolated ports, never native/backend authority.
const harnessSource=await read('tools/native-continuity-certification/continuity-certification.mjs');
const seedSource=harnessSource.slice(harnessSource.indexOf('async function seed(scenario)'),harnessSource.indexOf('async function check()'));
assert.ok(seedSource.startsWith('async function seed(scenario)'));
const sensitive='PRIVATE_FIXTURE_SENTINEL',attempt='PRIVATE_ATTEMPT_SENTINEL';
async function runSeed(failure,scenario='A') {
 const output=[];let begins=0,commits=0,verifies=0;
 const error=()=>Error(sensitive+' '+binding+' '+attempt);
 const vault={
  beginVerification:async()=>{begins++;if(failure===(begins===1?'reset_begin':'context_throw'))throw error();return begins===1?{attempt}:{binding:failure==='context_shape'?'invalid':binding,attempt,nowMs:now};},
  revoke:async()=>{if(failure==='reset_throw')throw error();return {revoked:failure!=='reset_result'};},
  commit:async()=>{commits++;if(failure==='commit_throw')throw error();return {saved:!['commit_result','commit_category','commit_unsafe'].includes(failure),nativeCommitCategory:failure==='commit_category'?'verified_at_invalid':sensitive};}
 };
 const fn=new Script('('+seedSource+')').runInNewContext({
  coordinator:{stop:async()=>{}},canaryCount:0,platform:'google',vault,key:{},AbortController,setTimeout,clearTimeout,
  show:value=>output.push(value),
  fetch:async(url,options)=>{
   assert.equal(url,'http://127.0.0.1:8765/seed');assert.equal(options.method,'POST');assert.ok(options.signal);assert.equal(JSON.parse(options.body).nowMs,now);
   if(failure==='fetch_throw')throw error();
   return {ok:failure!=='http_error',status:failure==='http_error'?400:200,json:async()=>{
    if(failure==='json_throw')throw error();
    return failure==='json_shape'?{proof:sensitive,verifiedAt:now,extra:sensitive}:{proof:sensitive,verifiedAt:now-1000};
   }};
  },
  verifyContinuity:async()=>{verifies++;if(failure==='verify_throw')throw error();return failure==='verify_false'?null:{valid:true};}
 });
 await fn(scenario);
 const safeKeys=new Set(['scenario','stage','errorCategory','httpStatus','nativeCommitCategory','nativeResetCategory','nativeResetStep','nativeResetOperation','nativeResetStatus','seeded','protectedInitializations']);
 for(const row of output){assert.ok(Object.keys(row).every(key=>safeKeys.has(key)));assert.equal(row.protectedInitializations,0);const text=JSON.stringify(row);assert.ok(![sensitive,binding,attempt].some(value=>text.includes(value)));}
 return {last:JSON.parse(JSON.stringify(output.at(-1))),output,commits,verifies};
}
for(const [failure,stage,errorCategory] of [
 ['reset_begin','native_reset','native_reset_failed'],['reset_throw','native_reset','native_reset_failed'],['reset_result','native_reset','native_reset_failed'],
 ['context_throw','native_context','native_context_failed'],['context_shape','native_context','native_context_failed'],
 ['fetch_throw','issuer_fetch','issuer_fetch_failed'],['http_error','issuer_http','issuer_http_error'],
 ['json_throw','issuer_response','issuer_response_invalid'],['json_shape','issuer_response','issuer_response_invalid'],
 ['verify_throw','fixture_verification','fixture_verification_failed'],['verify_false','fixture_verification','fixture_verification_failed'],
 ['commit_throw','native_commit','native_commit_failed'],['commit_result','native_commit','native_commit_failed']
])test('seed diagnostics: '+failure+' maps to '+errorCategory+' without sensitive material',async()=>{
 const {last,output,commits}=await runSeed(failure);assert.equal(last.stage,stage);assert.equal(last.errorCategory,errorCategory);
 assert.ok(output.some(row=>row.stage===stage)||stage==='issuer_http');assert.equal(last.scenario,'A');
 if(failure==='http_error')assert.equal(last.httpStatus,400);
 if(!failure.startsWith('commit'))assert.equal(commits,0);
});
test('native commit categories are fixed and arbitrary native text is suppressed',async()=>{
 assert.equal((await runSeed('commit_category')).last.nativeCommitCategory,'verified_at_invalid');
 for(const failure of ['commit_unsafe','commit_throw','commit_result'])assert.equal((await runSeed(failure)).last.nativeCommitCategory,'unknown_commit_failure');
});

test('successful and negative-case seeding retain bounded progress and existing synthetic semantics',async()=>{
 const positive=await runSeed();assert.equal(positive.last.seeded,true);assert.equal(positive.last.stage,'complete');assert.equal(positive.verifies,1);assert.equal(positive.commits,1);
 for(const scenario of ['B','C','D','E']){const value=await runSeed('verify_throw',scenario);assert.equal(value.last.seeded,true);assert.equal(value.verifies,0);assert.equal(value.commits,1);}
});
test('issuer tracing emits only fixed safe labels and status, never arbitrary request data',async()=>{
 const events=[],server=listen(issuer,{port:0,trace:event=>events.push(event)});await once(server,'listening');
 try {
  const endpoint='http://127.0.0.1:'+server.address().port;
  const valid=await fetch(endpoint+'/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:'A',platform:'google',binding,nowMs:Date.now()}),signal:AbortSignal.timeout(5000)});assert.equal(valid.status,200);await valid.json();
  const invalid=await fetch(endpoint+'/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:sensitive,platform:sensitive,binding:sensitive,nowMs:Date.now()}),signal:AbortSignal.timeout(5000)});assert.equal(invalid.status,400);await invalid.text();
  const path=await fetch(endpoint+'/'+sensitive,{signal:AbortSignal.timeout(5000)});assert.equal(path.status,404);await path.text();
  assert.equal(events.length,3);assert.deepEqual(events[0],{method:'POST',pathname:'/seed',scenario:'A',platform:'google',httpStatus:200});
  for(const event of events){assert.deepEqual(Object.keys(event).sort(),['httpStatus','method','pathname','platform','scenario']);assert.ok(![sensitive,binding].some(value=>JSON.stringify(event).includes(value)));}
  assert.equal(events[1].scenario,'-');assert.equal(events[2].pathname,'other');
 }finally{await new Promise(resolve=>server.close(resolve));}
 assert.doesNotMatch(harnessSource,/console\.|catch\s*\(\s*(?:err|error)\s*\)/);
});

// LP244.65F: real signer -> real verifier, including the native/host clock separation.
test('direct Google issuer flow uses native milliseconds and satisfies every durable contract field',async()=>{
 const direct=await createIssuer(),nativeNow=Date.now()-3600000,nativeBinding=randomBytes(32).toString('hex');
 const publicKey=await webcrypto.subtle.importKey('jwk',direct.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const fixture=await direct.seed({scenario:'A',platform:'google',binding:nativeBinding,nowMs:nativeNow});
 const value=await verifyContinuity({proof:fixture.proof,publicKey,binding:nativeBinding,platform:'google',now:nativeNow,crypto:webcrypto});
 assert.ok(value);assert.ok(value.binding===nativeBinding);assert.equal(value.platform,'google');assert.equal(value.productId,'com.gridlygo.gridly.monthly');assert.equal(value.audience,'com.gridlygo.gridly');
 assert.equal(value.environment,'production');assert.equal(value.entitlementState,'entitled');assert.equal(value.subscriptionState,'active');assert.equal(value.verificationSource,'gridly_server_store_api');
 assert.equal(Date.parse(value.lastVerifiedAt),nativeNow-1000);assert.equal(fixture.verifiedAt,Date.parse(value.lastVerifiedAt));
 assert.equal(Date.parse(value.currentPeriodEnd),nativeNow+7*86400000);assert.equal(Date.parse(value.continuityExpiresAt),fixture.verifiedAt+86400000);
 assert.equal(Object.keys(value).sort().join(','),'audience,binding,continuityExpiresAt,currentPeriodEnd,entitlementState,environment,lastVerifiedAt,platform,productId,subscriptionState,verificationSource');
 const header=JSON.parse(Buffer.from(fixture.proof.split('.')[0],'base64url'));assert.deepEqual(header,{alg:'ES256',typ:'gridly-continuity-v1'});
 assert.equal(publicKey.algorithm.namedCurve,'P-256');assert.equal(publicKey.type,'public');assert.ok(!Object.hasOwn(direct.publicJwk,'d'));
 for(const scenario of ['B','C','D','E']){
  const negative=await direct.seed({scenario,platform:'google',binding:nativeBinding,nowMs:nativeNow});
  assert.equal(await verifyContinuity({proof:negative.proof,publicKey,binding:nativeBinding,platform:'google',now:nativeNow,crypto:webcrypto}),null);
 }
});
test('old host-clock issuance is rejected at the native sample; delay alone can reproduce verified-in-future',async()=>{
 const sample=now,direct=await createIssuer();const publicKey=await webcrypto.subtle.importKey('jwk',direct.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 for(const hostNow of [sample+1001,sample+3600000]){
  const old=await direct.seed({scenario:'A',platform:'google',binding},hostNow);
  assert.equal(await verifyContinuity({proof:old.proof,publicKey,binding,platform:'google',now:sample,crypto:webcrypto}),null);
  assert.ok(await verifyContinuity({proof:old.proof,publicKey,binding,platform:'google',now:hostNow,crypto:webcrypto}));
 }
 const fixed=await direct.seed({scenario:'A',platform:'google',binding,nowMs:sample});
 assert.ok(await verifyContinuity({proof:fixed.proof,publicKey,binding,platform:'google',now:sample,crypto:webcrypto}));
});
test('HTTP issuer consumes the native sample, rejects missing/seconds timestamps and preserves all negative cases',async()=>{
 const direct=await createIssuer(),sample=now,nativeBinding=randomBytes(32).toString('hex');
 const publicKey=await webcrypto.subtle.importKey('jwk',direct.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const server=listen(direct,{port:0});await once(server,'listening');
 try {
  const endpoint='http://127.0.0.1:'+server.address().port+'/seed';
  for(const scenario of ['A','B','C','D','E']){
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,platform:'google',binding:nativeBinding,nowMs:sample}),signal:AbortSignal.timeout(5000)});assert.equal(response.status,200);
   const fixture=await response.json();assert.equal(!!await verifyContinuity({proof:fixture.proof,publicKey,binding:nativeBinding,platform:'google',now:sample,crypto:webcrypto}),scenario==='A');
  }
  for(const nowMs of [undefined,Math.floor(sample/1000),null,'invalid',sample+0.5]){
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:'A',platform:'google',binding:nativeBinding,nowMs}),signal:AbortSignal.timeout(5000)});assert.equal(response.status,400);await response.text();
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
