const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const BASE='faac47368da3137b50d53813b7f0299a2f4b1830',APPLE='e0b51235e96ce1cc7fcae81781bbd21e95fb418a',PERF='9711cd8d288446dc5526705d70d5c3cf033acd8d';
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:24*1024*1024});
const source=(ref,file)=>git('show',ref+':'+file);
const current=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
// Exact reviewed P0 runtime bytes; all other protected files retain their prior source pins.
const P0_CLOCK_HASHES={"js/gridly-entitlement.mjs":"25e214bf02bf0701d9cf16b9f77167e0b4d3143d701a0d5cfe664022e9e30449","js/gridly-google-play-billing.mjs":"a3937b596990b776f6946caea6d45f5e1bda2e4235d4ed5f22b589574db2153c","js/gridly-paid-access.mjs":"847485b4cd00ad5ec7bffbce97bb114c75d42128eb101fe4c4d81da380c8d9ba","js/gridly-apple-storekit.mjs":"0287c4a8d7732b8571c88e002e1780f3c333345e416373ad3c011d0f1f68e9ae"};
function assertRetained(ref,file){if(Object.hasOwn(P0_CLOCK_HASHES,file))assert.equal(require('node:crypto').createHash('sha256').update(current(file)).digest('hex'),P0_CLOCK_HASHES[file],file);else assert.equal(current(file),source(ref,file),file);}
test('integration starts at the verified common Build 14 source and retains the Apple ancestry',()=>{
  assert.equal(git('merge-base',BASE,'HEAD').trim(),BASE);
  assert.equal(git('merge-base',BASE,APPLE).trim(),APPLE);
});
test('app contains exactly the certified 17 performance hunks plus the two reviewed NWS presentation functions',()=>{
  let expected=source(BASE,'js/app.js');
  const patch=git('diff',PERF+'^',PERF,'--','js/app.js');
  const hunks=patch.split(/^@@[^\n]*\n/m).slice(1);assert.equal(hunks.length,17);
  for(const hunk of hunks){
    const lines=hunk.split('\n').filter(line=>/^[ +\-]/.test(line));
    const before=lines.filter(line=>line[0]!=='+' ).map(line=>line.slice(1)).join('\n')+'\n';
    const after=lines.filter(line=>line[0]!=='-' ).map(line=>line.slice(1)).join('\n')+'\n';
    const start=expected.indexOf(before);assert.ok(start>=0);assert.equal(expected.indexOf(before,start+1),-1);
    expected=expected.slice(0,start)+after+expected.slice(start+before.length);
  }
  let actual=current('js/app.js');
  for(const name of ['gridlyLP236RetainCommunityRowsDuringReadUncertainty','gridlyLP236RenderAlertsPresentation']){
    const pattern=new RegExp('function '+name+'\\([^]*?^  }','m');
    const old=expected.match(pattern),next=actual.match(pattern);assert.ok(old&&next,name);
    actual=actual.replace(next[0],old[0]);
  }
  assert.equal(actual,expected,'all reporting, identity, classification and other production app code remains exact');
});
test('Apple native and continuity remain exact; four P0 authority modules have exact reviewed source pins',()=>{
  for(const file of ['ios/App/App/GridlyStoreKitPlugin.swift','js/gridly-apple-storekit.mjs','js/gridly-paid-access.mjs','js/gridly-continuity.mjs','js/gridly-store-verification.mjs'])assertRetained(APPLE,file);
});
test('production Google and reporting authority retain baseline contracts plus certified P0 clock verification',()=>{
  for(const file of ['js/gridly-paid-ui.mjs','js/gridly-paid-bootstrap.js','js/gridly-paid-onboarding.mjs','js/gridly-entitlement.mjs','js/gridly-google-play-billing.mjs','js/gridly-native-attested-invoke.mjs','js/gridly-native-edge-transport.mjs','tools/android-production-sources.mjs','js/gridly-ugc-compliance.js'])assertRetained(BASE,file);
  // Explicit approved exception: version guard + source/build attestation only.
  // Pin the complete reviewed tool, rather than allowing arbitrary packaging edits.
  assert.equal(require('node:crypto').createHash('sha256').update(current('tools/native-web.mjs')).digest('hex'),'0d0d3dd3b627c5974388ae32f86a3d45b6ec44d49043d1910dbe675fdf47d65c');
});
test('portrait, consumer entrypoint, service worker, dependencies and native configurations retain only the reviewed maintenance version metadata',()=>{
  for(const file of ['css/styles.css','css/gridly-paid-access.css','index.html','service-worker.js','package.json','package-lock.json'])assert.equal(current(file),source(BASE,file),file);
  assert.equal(current('android/app/build.gradle'),source(BASE,'android/app/build.gradle').replace('versionCode 14','versionCode 16').replace("versionName '1.0.0'","versionName '1.0.1'"));
  const project='ios/App/App.xcodeproj/project.pbxproj';
  assert.equal(current(project),source(BASE,project).replaceAll('CURRENT_PROJECT_VERSION = 1;','CURRENT_PROJECT_VERSION = 17;').replaceAll('MARKETING_VERSION = 1.0.0;','MARKETING_VERSION = 1.0.1;'));
});
test('later owner-only Apple diagnostic code is excluded',()=>{
  assert.doesNotMatch(current('js/gridly-paid-ui.mjs'),/STOREKIT DIAGNOSTIC BUILD|initializeDiagnostics|diagnosticPort/);
  assert.doesNotMatch(current('js/gridly-apple-storekit.mjs'),/createStoreKitDiagnostics/);
});
