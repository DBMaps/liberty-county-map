import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,symlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {PROFILE,RELEASES,deriveAndroidMaintenanceMetadata,maintenanceAndroidIdentity,deriveIosMaintenanceInputs,maintenanceIosIdentity,validateProviderPair} from '../../tools/arcgis-maintenance/contracts.mjs';
import {stageSyntheticMaintenanceRuntime,composeMaintenanceRuntime,verifyMaintenanceRuntime,readMaintenanceProviderInputs,assertPlainPath,assertMaintenanceOutput} from '../../tools/arcgis-maintenance/staging.mjs';
import {androidProductionBuildIdentity,stage} from '../../tools/native-web.mjs';
import {originalBytes,candidateBytes,fixture} from './fixtures.mjs';
const released=(ref,path)=>execFileSync('git',['show',ref+':'+path],{encoding:'utf8',maxBuffer:32*1024*1024}).replaceAll('\r\n','\n');

test('exact Android16 derivative admits only17 and preserves package SDK Billing signing and defaults',()=>{
  const source=released(RELEASES.android,'android/app/build.gradle'),next=deriveAndroidMaintenanceMetadata(source);
  assert.equal(next,source.replace('versionCode 16','versionCode 17').replace("versionName '1.0.1'","versionName '1.0.2'"));
  assert.equal(maintenanceAndroidIdentity(next,PROFILE).versionCode,'17');
  assert.equal(androidProductionBuildIdentity(next,undefined,{maintenanceProfile:PROFILE}).reviewerAuthorization,'UNVERIFIED_NOT_GRANTED');
  assert.throws(()=>androidProductionBuildIdentity(source),/matching reviewed/);
  assert.throws(()=>androidProductionBuildIdentity(next),/matching reviewed/);
  for(const text of [next.replace('compileSdk 36','compileSdk 35'),next.replace('targetSdk 36','targetSdk 35'),next.replace('billing:9.1.0','billing:8.0.0'),next.replace("applicationId 'com.gridlygo.gridly'","applicationId 'other.app'"),next.replace('versionCode 17','versionCode 18'),next.replace('versionCode 17','versionCode 017'),next+'\nversionCode 17\n'])assert.throws(()=>maintenanceAndroidIdentity(text,PROFILE));
  assert.throws(()=>maintenanceAndroidIdentity(next,'wrong'));
  assert.throws(()=>deriveAndroidMaintenanceMetadata(next));
});
test('iOS18 derivative is exact and cannot alter signing entitlements startup or recovery scripts',()=>{
  const project=released(RELEASES.ios,'ios/App/App.xcodeproj/project.pbxproj'),recovery=released(RELEASES.ios,'ios/App/App/GridlyBridgeViewController.swift');
  const next=deriveIosMaintenanceInputs({project,recovery});
  assert.equal(next.recovery.replace('["14", "16", "17", "18"]','["14", "16", "17"]'),recovery);
  assert.equal(next.project.replaceAll('CURRENT_PROJECT_VERSION = 18;','CURRENT_PROJECT_VERSION = 17;').replaceAll('MARKETING_VERSION = 1.0.2;','MARKETING_VERSION = 1.0.1;'),project);
  assert.equal(maintenanceIosIdentity({...next,profile:PROFILE}).build,'18');
  assert.throws(()=>maintenanceIosIdentity({project,recovery,profile:PROFILE}));
  for(const changed of [{...next,project:next.project+'\n// unrelated signing change'},{...next,recovery:next.recovery+'\n// unrelated change'},{...next,recovery:next.recovery.replace('"18"','"19"')}])assert.throws(()=>maintenanceIosIdentity({...changed,profile:PROFILE}));
});
test('released native files and both platform shipping source remain unchanged',async()=>{
  for(const path of ['android/app/build.gradle','ios/App/App.xcodeproj/project.pbxproj','ios/App/App/GridlyBridgeViewController.swift','ios/App/App/Info.plist','ios/App/App/App-Production.entitlements','android/app/src/main/AndroidManifest.xml','android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt','capacitor.config.json','js/app.js','js/gridly-paid-access.mjs','js/gridly-ugc-compliance.js'])
    assert.equal((await readFile(path,'utf8')).replaceAll('\r\n','\n'),released(RELEASES.android,path),path);
});
test('provider comparison rejects original fallback missing inputs malformed duplicates and unrelated changes',()=>{
  assert.equal(validateProviderPair({originalBytes,candidateBytes}).driveTexasParity,true);
  for(const input of [{originalBytes},{candidateBytes},{originalBytes,candidateBytes:originalBytes},{originalBytes,candidateBytes:Buffer.from('{"arcgisStaticBasemapApiKey":"SYNTHETIC_X","driveTexas":{"apiKey":"SYNTHETIC_OTHER"}}')},{originalBytes,candidateBytes:Buffer.from('SYNTHETIC_BAD_JSON')},{originalBytes,candidateBytes:Buffer.from('{"arcgisStaticBasemapApiKey":"SYNTHETIC_X","arcgisStaticBasemapApiKey":"SYNTHETIC_Y","driveTexas":{"apiKey":"SYNTHETIC_DRIVETEXAS"}}')}])assert.throws(()=>validateProviderPair(input),/^Error: MAINTENANCE_/);
  const summary=JSON.stringify(validateProviderPair({originalBytes,candidateBytes}));
  const escapedDuplicate=String.raw`{"arcgisStaticBasemapApiKey":"SYNTHETIC_X","driveTexas":{"api\u004bey":"SYNTHETIC_OTHER","apiKey":"SYNTHETIC_DRIVETEXAS"}}`;
  assert.throws(()=>validateProviderPair({originalBytes,candidateBytes:Buffer.from(escapedDuplicate)}),/PROVIDER_SCHEMA_INVALID/);
  assert.equal(summary.includes('SYNTHETIC_'),false);assert.equal(/\b[a-f0-9]{64}\b/.test(summary),false);
});
test('synthetic runtime writer requires explicit private input and preserves original candidate and canonical bytes',async()=>{
  const f=await fixture();try{
    const canonicalBytes=await readFile('js/gridlyRuntimeEnvironmentConfig.js');
    const options={...f,outputDirectory:join(f.root,'result'),canonicalBytes,profile:PROFILE,mode:'SYNTHETIC_PREPARATION_ONLY',verifyPrivateFile:async()=>true};
    assert.equal((await stageSyntheticMaintenanceRuntime(options)).driveTexasParity,true);
    const runtimeBytes=await readFile(join(options.outputDirectory,'gridlyRuntimeEnvironmentConfig.js'));
    assert.equal(verifyMaintenanceRuntime({canonicalBytes,originalBytes,candidateBytes,runtimeBytes}).arcgisCandidateMatch,true);
    assert.deepEqual(await readFile(f.originalFile),originalBytes);assert.deepEqual(await readFile(f.candidateFile),candidateBytes);
    await assert.rejects(()=>stageSyntheticMaintenanceRuntime(options),/OUTPUT_EXISTS/);
    await assert.rejects(()=>stageSyntheticMaintenanceRuntime({...options,outputDirectory:join(f.root,'bad'),verifyPrivateFile:async()=>false}),/PRIVATE_INPUT_NOT_VERIFIED/);
    await assert.rejects(()=>readMaintenanceProviderInputs({candidateFile:f.candidateFile,originalFile:f.originalFile}),/EXPLICIT_PRIVATE_INPUTS_REQUIRED/);
    await assert.rejects(()=>stageSyntheticMaintenanceRuntime({...options,outputDirectory:process.cwd()}),/REPOSITORY_FORBIDDEN/);
    const other=Buffer.from(candidateBytes.toString().replace('SYNTHETIC_REPLACEMENT_LABELS','NON_SYNTHETIC_REPLACEMENT'));
    await writeFile(f.candidateFile,other);
    await assert.rejects(()=>stageSyntheticMaintenanceRuntime({...options,outputDirectory:join(f.root,'real-not-allowed')}),/SYNTHETIC_ONLY/);
  }finally{await f.dispose();}
});
test('input traversal symlinks synchronized paths and tampered output fail closed',async()=>{
  const f=await fixture();try{
    await mkdir(join(f.root,'target'));await writeFile(join(f.root,'target','candidate.json'),candidateBytes);
    await symlink(join(f.root,'target'),join(f.root,'junction'),process.platform==='win32'?'junction':'dir');
    await assert.rejects(()=>assertPlainPath(join(f.root,'junction','candidate.json')),/PATH_UNSAFE/);
    await assert.rejects(()=>assertPlainPath(join(f.root,'OneDrive','candidate.json'),{mustExist:false}),/PATH_UNSAFE/);
    const canonicalBytes=await readFile('js/gridlyRuntimeEnvironmentConfig.js'),runtimeBytes=composeMaintenanceRuntime({canonicalBytes,originalBytes,candidateBytes,profile:PROFILE});
    assert.throws(()=>verifyMaintenanceRuntime({canonicalBytes,originalBytes,candidateBytes,runtimeBytes:Buffer.concat([runtimeBytes,Buffer.from('\n// tamper')])}),/VERIFICATION_FAILED/);
  }finally{await f.dispose();}
});
test('diagnostic and preparation tools are excluded from native consumer script ownership',async()=>{
  const manifest=JSON.parse(await readFile('consumer-script-manifest.json','utf8'));
  const all=JSON.stringify(manifest);assert.equal(/arcgis-maintenance/.test(all),false);
  const native=await readFile('tools/native-web.mjs','utf8');assert.match(native,/allowlist/);assert.doesNotMatch(native,/['"]tools\/arcgis-maintenance['"]\s*[,\]]/);
});
test('real native staging rejects implicit inputs, tracked outputs, existing output and original fallback before copying',async()=>{
  const root=process.cwd(),outputDirectory=join(root,'www');
  await assert.rejects(()=>stage(outputDirectory,{maintenanceProfile:PROFILE,androidProduction:true}),/EXPLICIT_PRIVATE_INPUTS_REQUIRED/);
  await assert.rejects(()=>assertMaintenanceOutput({repositoryRoot:root,outputDirectory:join(root,'js')}),/NOT_NATIVE_WEB_DIR/);
  assert.equal(await assertMaintenanceOutput({repositoryRoot:root,outputDirectory}),outputDirectory);
  await mkdir(outputDirectory);
  try {await assert.rejects(()=>assertMaintenanceOutput({repositoryRoot:root,outputDirectory}),/OUTPUT_EXISTS/);}
  finally {const {rmdir}=await import('node:fs/promises');await rmdir(outputDirectory);}
});
