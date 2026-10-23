import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {androidProductionBuildIdentity} from '../tools/native-web.mjs';
import {GOOGLE_REVIEW_BUILD_VERSION} from '../js/gridly-google-review-proof.mjs';
const baseline=path=>execFileSync('git',['show','faac47368da3137b50d53813b7f0299a2f4b1830:'+path],{encoding:'utf8'});
const current=async path=>(await readFile(path,'utf8')).replace(/\r\n/g,'\n');

test('Android configuration changes only reviewed versionName/versionCode; package, signing, plugins and permissions stay exact',async()=>{
  assert.equal(await current('android/app/build.gradle'),baseline('android/app/build.gradle').replace('versionCode 14','versionCode 16').replace("versionName '1.0.0'","versionName '1.0.1'"));
  for(const path of ['android/app/src/main/AndroidManifest.xml','android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt','capacitor.config.json'])
    assert.equal(await current(path),baseline(path),path);
});

test('Google reviewer change is limited to next build and retention of approved legacy builds',async()=>{
  const path='js/gridly-google-review-proof.mjs';
  const expected=baseline(path)
    .replace("GOOGLE_REVIEW_BUILD_VERSION='14'","GOOGLE_REVIEW_BUILD_VERSION='15'")
    .replace('// Keep the live Build 12 reviewer working while the replacement is reviewed.','// Keep the approved Build 12/14 reviewers while the replacement is reviewed.')
    .replace("Object.freeze(['12',GOOGLE_REVIEW_BUILD_VERSION])","Object.freeze(['12','14',GOOGLE_REVIEW_BUILD_VERSION])");
  assert.equal(await current(path),expected);
});

test('legacy production staging stays bound to reviewed authority; emergency16 requires certified artifact composition',async()=>{
  const emergency=await current('android/app/build.gradle');
  assert.match(emergency,/versionCode 16\b/);
  assert.throws(()=>androidProductionBuildIdentity(emergency),/matching reviewed/);
  const metadata=emergency.replace('versionCode 16','versionCode 15');
  assert.equal(GOOGLE_REVIEW_BUILD_VERSION,'15');
  assert.deepEqual(androidProductionBuildIdentity(metadata),{applicationId:'com.gridlygo.gridly',versionName:'1.0.1',versionCode:'15',reviewBuildVersion:'15'});
  const previous=metadata.replace('versionCode 15','versionCode 14').replace("versionName '1.0.1'","versionName '1.0.0'");
  assert.equal(androidProductionBuildIdentity(previous,'14').versionCode,'14');
  for(const [source,review] of [[previous,'15'],[metadata,'14'],[metadata,'16'],[metadata.replace('versionCode 15','versionCode 16'),'16'],
    [metadata.replace('versionCode 15','versionCode 015'),'15'],[metadata+'\nversionCode 15\n','15'],
    [metadata.replace("applicationId 'com.gridlygo.gridly'","applicationId 'com.example.other'"),'15'],
    [metadata.replace("versionName '1.0.1'","versionName '9.0.0'"),'15'],
    [metadata.replace("versionName '1.0.1'","versionName '1.0.0'"),'15'],
    [previous.replace("versionName '1.0.0'","versionName '1.0.1'"),'14'],
    [metadata+"\nversionName '1.0.1'\n",'15']])
    assert.throws(()=>androidProductionBuildIdentity(source,review),/matching reviewed/);
});
