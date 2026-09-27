#!/usr/bin/env node
// SYNTHETIC_CONTINUITY_CERTIFICATION — creates a separate debug-only app, never www.
import {cp,mkdir,readFile,writeFile,symlink} from 'node:fs/promises';
import {resolve,join,relative,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createIssuer} from './issuer.mjs';
const root=resolve(import.meta.dirname,'../..'),bundle='com.gridlygo.continuitycert';
export async function prepare({platform,output,publicJwk}) {
 if(!['ios','android'].includes(platform)||!output||!publicJwk||publicJwk.d)throw Error('Invalid certification preparation');
 output=resolve(output);const within=relative(root,output);
 if(!within.startsWith('..'+sep)||output===root)throw Error('Certification output must be a NEW directory outside repository');
 await mkdir(output,{recursive:false});
 await writeFile(join(output,'.gridly-continuity-certification'),'SYNTHETIC_CONTINUITY_CERTIFICATION\n');
 const filter=path=>!['public','build','DerivedData','.gradle','.git','swiftpm'].includes(basename(path))&&!['local.properties','GridlyStoreKitPlugin.swift','GridlyPlayBillingPlugin.kt','GridlyGeolocationPlugin.kt'].includes(basename(path));
 await cp(join(root,platform),join(output,platform),{recursive:true,filter});
 const web=platform==='ios'?join(output,'ios/App/App/public'):join(output,'android/app/src/main/assets/public');
 await mkdir(join(web,'js'),{recursive:true});
 for(const file of ['index.html','continuity-certification.mjs','continuity-protected-canary.mjs'])await cp(join(import.meta.dirname,file),join(web,file));
 for(const file of ['gridly-paid-access.mjs','gridly-continuity.mjs','gridly-entitlement.mjs','gridly-store-verification.mjs','gridly-apple-storekit.mjs','gridly-google-play-billing.mjs'])await cp(join(root,'js',file),join(web,'js',file));
 await cp(join(root,'legal'),join(web,'legal'),{recursive:true});
 await writeFile(join(web,'continuity-fixture-config.json'),JSON.stringify({classification:'SYNTHETIC_CONTINUITY_CERTIFICATION',publicJwk})+'\n');
 const config={appId:bundle,appName:'Gridly Continuity CERT',webDir:'public',bundledWebRuntime:false,loggingBehavior:'none'};
 let nativePath;
 if(platform==='ios') {
  nativePath='ios/App/App/GridlyContinuityPlugin.swift';
  const bridge=join(output,'ios/App/App/GridlyBridgeViewController.swift');
  await writeFile(bridge,'#if !DEBUG\n#error("Continuity certification cannot build Release")\n#endif\nimport Capacitor\n@objc(GridlyBridgeViewController)\nclass GridlyBridgeViewController: CAPBridgeViewController {\n override func capacitorDidLoad(){ bridge?.registerPluginInstance(GridlyContinuityPlugin()) }\n}\n');
  const project=join(output,'ios/App/App.xcodeproj/project.pbxproj');
  let source=await readFile(project,'utf8');source=source.split('\n').filter(line=>!line.includes('GridlyStoreKitPlugin.swift')).join('\n').replaceAll('PRODUCT_BUNDLE_IDENTIFIER = com.gridlygo.gridly;','PRODUCT_BUNDLE_IDENTIFIER = '+bundle+';');
  await writeFile(project,source);
  const info=join(output,'ios/App/App/Info.plist');source=await readFile(info,'utf8');source=source.replace('<string>Gridly</string>','<string>Gridly Continuity CERT</string>').replace('<key>CAPACITOR_DEBUG</key>','<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/><key>NSAllowsArbitraryLoads</key><true/><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict>\n<key>CAPACITOR_DEBUG</key>');await writeFile(info,source);
  await writeFile(join(output,'ios/App/App/capacitor.config.json'),JSON.stringify(config));
 } else {
  // Certification-only HTTP localhost avoids HTTPS-to-HTTP fixture transport.
  config.server={androidScheme:'http'};
  nativePath='android/app/src/main/java/com/gridlygo/gridly/GridlyContinuityPlugin.kt';
  await symlink(join(root,'node_modules'),join(output,'node_modules'),process.platform==='win32'?'junction':'dir');
  const gradle=join(output,'android/app/build.gradle');let source=await readFile(gradle,'utf8');
  source=source.replace("applicationId 'com.gridlygo.gridly'","applicationId '"+bundle+"'").replace('android {','android {\n    buildFeatures { buildConfig true }');
  source+="\n// Certification apps cannot produce release artifacts.\ntasks.configureEach { t -> if (t.name.toLowerCase().contains('release')) t.doFirst { throw new GradleException('Continuity certification cannot build Release') } }\n";await writeFile(gradle,source);
  await writeFile(join(output,'android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt'),'package com.gridlygo.gridly\nimport android.os.Bundle\nimport com.getcapacitor.BridgeActivity\nclass MainActivity: BridgeActivity(){ override fun onCreate(savedInstanceState: Bundle?){ check(BuildConfig.DEBUG); registerPlugin(GridlyContinuityPlugin::class.java); super.onCreate(savedInstanceState) } }\n');
  const manifest=join(output,'android/app/src/main/AndroidManifest.xml');source=await readFile(manifest,'utf8');source=source.replace('<application','<application android:usesCleartextTraffic="true"');await writeFile(manifest,source);
  const strings=join(output,'android/app/src/main/res/values/strings.xml');source=await readFile(strings,'utf8');source=source.replace('>Gridly<','>Gridly Continuity CERT<').replaceAll('com.gridlygo.gridly',bundle);await writeFile(strings,source);
  await writeFile(join(output,'android/app/src/main/assets/capacitor.config.json'),JSON.stringify(config));
 }
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 const [original,copied]=await Promise.all([readFile(join(root,nativePath)),readFile(join(output,nativePath))]);
 if(!original.equals(copied))throw Error('Vault source changed during certification preparation');
 await writeFile(join(output,'certification-manifest.json'),JSON.stringify({classification:'SYNTHETIC_CONTINUITY_CERTIFICATION',bundle,platform,vaultSha256:digest(copied),productionBackendConfigured:false},null,2)+'\n');
 return {output,web,bundle,vaultSha256:digest(copied)};
}
export function listen(issuer,{port=8765,trace}={}) {
 const server=createServer(async(req,res)=>{
  let scenario='-',platform='-';
  // Fixed labels only: never echo arbitrary paths, request bodies or error messages.
  res.once('finish',()=>{trace?.({method:['POST','OPTIONS'].includes(req.method)?req.method:'OTHER',pathname:req.url==='/seed'?'/seed':'other',scenario,platform,httpStatus:res.statusCode});});
  res.setHeader('Cache-Control','no-store');const origin=req.headers.origin;
  if(origin&&!['capacitor://localhost','http://localhost','https://localhost'].includes(origin)){res.statusCode=403;res.end();return;}
  if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
  if(req.method!=='POST'||req.url!=='/seed'){res.statusCode=404;res.end();return;}
  try {let text='';for await(const bytes of req){text+=bytes;if(text.length>2048)throw Error();}
   const value=JSON.parse(text);if(Object.keys(value).sort().join(',')!=='binding,nowMs,platform,scenario')throw Error();
   scenario=['A','B','C','D','E'].includes(value.scenario)?value.scenario:'-';platform=['apple','google'].includes(value.platform)?value.platform:'-';
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await issuer.seed(value,value.nowMs)));
  }catch{res.statusCode=400;res.end('{"errorCategory":"invalid_fixture"}');}
 });server.listen(port,'127.0.0.1');return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const args=process.argv.slice(2);if(args.length!==4||args[0]!=='--platform'||args[2]!=='--output')throw Error('Use --platform ios|android --output NEW-ABSOLUTE-TEMP-DIRECTORY');
 const issuer=await createIssuer();const prepared=await prepare({platform:args[1],output:args[3],publicJwk:issuer.publicJwk});
 listen(issuer,{trace:event=>console.log('CERT_ISSUER',event.method,event.pathname,'scenario='+event.scenario,'platform='+event.platform,'status='+event.httpStatus)});console.log('SYNTHETIC CERTIFICATION ONLY',JSON.stringify(prepared));console.log('Loopback-only fixture issuer 127.0.0.1:8765. Keep this terminal open while seeding; no private keys written/logged.');
}
