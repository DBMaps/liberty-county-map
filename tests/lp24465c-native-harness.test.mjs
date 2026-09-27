import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {webcrypto} from 'node:crypto';
import {createIssuer} from '../tools/native-continuity-certification/issuer.mjs';
import {prepare,listen} from '../tools/native-continuity-certification/prepare.mjs';
import {once} from 'node:events';
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
test('certification generator creates isolated native identities, unmodified vaults and debug-only artifacts',async()=>{
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
   if(platform==='android')assert.deepEqual(nativeConfig.server,{androidScheme:'http'});
   else assert.equal(nativeConfig.server,undefined);
   assert.notEqual(nativeConfig.android?.allowMixedContent,true);
   const manifest=JSON.parse(await read(join(result.output,'certification-manifest.json')));assert.equal(manifest.productionBackendConfigured,false);
   assert.equal((await read(join(result.web,'continuity-fixture-config.json'))).includes('"d":'),false);
   await assert.rejects(assertNoContinuityCertification(result.web),/cannot enter a release bundle/);
   const path=platform==='ios'?'ios/App/App/GridlyContinuityPlugin.swift':'android/app/src/main/java/com/gridlygo/gridly/GridlyContinuityPlugin.kt';
   assert.equal(await read(join(result.output,path)),await read(path));
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
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({scenario:'A',platform:'google',binding}),signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),'http://localhost');
  const fixture=await response.json();assert.ok(Number.isFinite(fixture.verifiedAt));
  assert.ok(await verifyContinuity({proof:fixture.proof,publicKey:key,binding,platform:'google',now:Date.now(),crypto:webcrypto}));
  const invalid=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:'A',platform:'google',binding:'test'}),signal:AbortSignal.timeout(5000)});assert.equal(invalid.status,400);
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
  await page.route('http://localhost/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic HTTP transport check</title>'}));
  await page.goto('http://localhost/');
  // Routed desktop origin is used only for crypto availability, not Android fetch proof.
  const result=await page.evaluate(()=>({origin:location.origin,secureContext:isSecureContext,webCrypto:!!crypto.subtle}));
  assert.deepEqual(result,{origin:'http://localhost',secureContext:true,webCrypto:true});
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
