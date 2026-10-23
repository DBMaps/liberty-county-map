import {cp,mkdir,readFile,writeFile,symlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),id='com.gridlygo.proofclockcert';
export const modules=['gridly-paid-access.mjs','gridly-entitlement.mjs','gridly-google-play-billing.mjs','gridly-store-verification.mjs','gridly-continuity.mjs','gridly-apple-storekit.mjs'];
export async function writeProofClockWeb(web){
 await mkdir(web,{recursive:true});await mkdir(join(web,'js'),{recursive:true});await mkdir(join(web,'baseline-js'),{recursive:true});await mkdir(join(web,'cert'),{recursive:true});
 const hashes={};
 for(const file of modules){
  const source=await readFile(join(root,'js',file));await writeFile(join(web,'js',file),source);
  const baseline=execFileSync('git',['show','0e9eebd185dac45aa3382471870092852645941b:js/'+file],{cwd:root});
  await writeFile(join(web,'baseline-js',file),baseline);
  hashes[file]=createHash('sha256').update(source).digest('hex');
 }
 await cp(join(root,'tools/entitlement/proof-clock-cert'),join(web,'cert'),{recursive:true});
 await writeFile(join(web,'index.html'),'<meta http-equiv="refresh" content="0;url=cert/index.html">');
 return hashes;
}
export async function prepareProofClockAndroid(output){
 output=resolve(output);const within=relative(root,output);
 if(!within||within.startsWith('..')||within.replaceAll('\\','/').split('/')[0]!=='.artifacts')throw Error('Use a NEW isolated .artifacts output directory');
 await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});
 const android=join(output,'android');await mkdir(android);
 for(const file of ['build.gradle','settings.gradle','capacitor.settings.gradle','gradle.properties','gradlew','gradlew.bat'])
  await cp(join(root,'android',file),join(android,file));
 await cp(join(root,'android/gradle'),join(android,'gradle'),{recursive:true});
 const app=join(android,'app');await mkdir(join(app,'src/main/java/com/gridlygo/proofclockcert'),{recursive:true});
 await mkdir(join(app,'src/main/res/values'),{recursive:true});
 await writeFile(join(app,'src/main/res/values/styles.xml'),'<resources><style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar"/></resources>');
 const web=join(app,'src/main/assets/public'),hashes=await writeProofClockWeb(web);
 const config={appId:id,appName:'Gridly Proof Clock CERT',webDir:'public',loggingBehavior:'none'};
 await writeFile(join(app,'src/main/assets/capacitor.config.json'),JSON.stringify(config));
 await writeFile(join(app,'src/main/java/com/gridlygo/proofclockcert/MainActivity.kt'),
 'package com.gridlygo.proofclockcert\nimport android.os.Bundle\nimport com.getcapacitor.BridgeActivity\nclass MainActivity: BridgeActivity(){override fun onCreate(savedInstanceState:Bundle?){check(BuildConfig.DEBUG);super.onCreate(savedInstanceState)}}\n');
 await writeFile(join(app,'src/main/AndroidManifest.xml'),
 '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:allowBackup="false" android:label="Gridly Proof Clock CERT" android:theme="@style/AppTheme"><activity android:name=".MainActivity" android:exported="true" android:theme="@style/AppTheme"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>');
 await writeFile(join(app,'build.gradle'),`import org.jetbrains.kotlin.gradle.dsl.JvmTarget
plugins { id 'com.android.application'; id 'org.jetbrains.kotlin.android' }
android {
 namespace '${id}'
 compileSdk 36
 defaultConfig { applicationId '${id}'; minSdk 24; targetSdk 36; versionCode 1; versionName '0.0.1-CERT' }
 buildFeatures { buildConfig true }
 compileOptions { sourceCompatibility JavaVersion.VERSION_1_8; targetCompatibility JavaVersion.VERSION_1_8 }
}
kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_1_8 } }
dependencies {
 implementation project(':capacitor-android')
 implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
 implementation "androidx.core:core:$androidxCoreVersion"
 implementation "androidx.core:core-splashscreen:$androidxCoreSplashScreenVersion"
}
tasks.configureEach { t -> if(t.name.toLowerCase().contains('release')) t.doFirst { throw new GradleException('Proof clock CERT cannot build Release') } }
`);
 await symlink(join(root,'node_modules'),join(output,'node_modules'),process.platform==='win32'?'junction':'dir');
 const sdk=process.env.ANDROID_HOME??process.env.ANDROID_SDK_ROOT;
 if(sdk)await writeFile(join(android,'local.properties'),'sdk.dir='+sdk.replaceAll('\\','/')+'\n');
 const result={classification:'SYNTHETIC_PROOF_CLOCK_CERTIFICATION',applicationId:id,debugOnly:true,productionBackendConfigured:false,productionSignerIdentityVerified:false,hashes};
 await writeFile(join(output,'certification-manifest.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('Provide one NEW .artifacts output directory');
 const result=await prepareProofClockAndroid(process.argv[2]);console.log(JSON.stringify(result));
}
