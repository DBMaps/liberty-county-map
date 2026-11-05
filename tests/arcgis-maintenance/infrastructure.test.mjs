// Platform permission POLICY simulation + source contracts. NOT native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,chmod,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {macAclSafe,macEntrySafe,macPrivatePathVerified,macMountRows,macVolumeSafe} from '../../tools/arcgis-maintenance/mac-private-path.mjs';
import {privatePathVerified} from '../../tools/arcgis-maintenance/windows-private-path.mjs';
import {createLabelDiagnostic} from '../../tools/arcgis-maintenance/diagnostic.mjs';
import {createFileBudgetLedger} from '../../tools/arcgis-maintenance/budget-ledger.mjs';
import {fixture,png} from './fixtures.mjs';
const javaPath='tools/arcgis-maintenance/native/android/GridlyLabelDiagnostic.java';
const swiftPath='tools/arcgis-maintenance/native/ios/GridlyLabelDiagnostic.swift';
const key='SYNTHETIC_REPLACEMENT_LABELS';
const endpoint='https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/1/0/0';
const regular={uid:501,mode:0o100600,nlink:1,regular:true,directory:false,acl:'-rw------- 1 owner staff - 80 Nov 5 12:00 candidate.json\n'};
const directory={uid:501,mode:0o40700,nlink:2,regular:false,directory:true,acl:'drwx------ 2 owner staff - 64 Nov 5 12:00 private\n'};

test('macOS policy simulation accepts exact owner600 file and owner700 root, not extra ACL grants',()=>{
  assert.equal(macEntrySafe(regular,501,'File'),true);assert.equal(macEntrySafe(directory,501,'Directory'),true);
  for(const mode of [0o100644,0o100640,0o104600,0o100666,0o100400])assert.equal(macEntrySafe({...regular,mode},501,'File'),false);
  for(const change of [{uid:502},{nlink:2},{regular:false},{acl:regular.acl+' 0: group:everyone allow read\n'},{acl:'unparseable'}])assert.equal(macEntrySafe({...regular,...change},501,'File'),false);
  for(const change of [{uid:0},{mode:0o40750},{mode:0o40777},{directory:false}])assert.equal(macEntrySafe({...directory,...change},501,'Directory'),false);
});
test('macOS ancestor policy rejects writable or foreign directories and unparseable/cloud ACL output',()=>{
  const parent={...directory,uid:0,mode:0o40755};assert.equal(macEntrySafe(parent,501),true);
  assert.equal(macEntrySafe({...parent,acl:parent.acl+' 0: group:everyone deny delete\n'},501),true);
  for(const change of [{uid:502},{mode:0o41777},{mode:0o40775},{directory:false},{acl:parent.acl+' 0: user:owner allow write\n'},{acl:parent.acl+' 0: incomplete entry\n'}])assert.equal(macEntrySafe({...parent,...change},501),false);
  for(const text of ['',regular.acl.replace(' - ',' dataless '),regular.acl.replace(' - ',' offline '),regular.acl+'extra unknown output\n'])assert.equal(macAclSafe(text),false);
});
test('macOS adapter never treats simulated permission snapshots as actual non-Mac verification',async()=>{
  if(process.platform!=='darwin'){
    assert.equal(await macPrivatePathVerified('/Users/synthetic/private/native-provider-config.json','File',{authorizedRoot:'/Users/synthetic/private'}),false);
    if(process.platform!=='win32')assert.equal(await privatePathVerified('/synthetic/file'),false);
  }
  assert.equal(await macPrivatePathVerified('/Users/synthetic/private/native-provider-config.json'),false);
  assert.equal(await macPrivatePathVerified('/Users/synthetic/private/../native-provider-config.json','File',{authorizedRoot:'/Users/synthetic/private'}),false);
});
test('macOS volume simulation refuses noowners, remote, unsupported, readonly and unproven filesystems',()=>{
  const safe=macMountRows('/dev/disk3s1 on /System/Volumes/Data (apfs, local, journaled)\n');
  assert.equal(macVolumeSafe(safe),true);
  for(const text of ['/dev/disk4 on /Volumes/External (apfs, local, noowners)\n','server on /Volumes/Network (smbfs)\n','/dev/disk4 on /Volumes/External (msdos, local)\n','/dev/disk3s1 on / (apfs, local, read-only)\n'])assert.equal(macVolumeSafe(macMountRows(text)),false);
  assert.equal(macVolumeSafe([]),false);assert.throws(()=>macMountRows('unparseable volume inventory'));
  assert.equal(macAclSafe(regular.acl+' 0: group:everyone allow read deny delete\n'),false);
});
test('actual macOS synthetic filesystem/ACL integration', {skip:process.platform!=='darwin'},async()=>{
  const root=await mkdtemp(join(homedir(),'.gridly-mac-acl-synthetic-'));
  const file=join(root,'native-provider-config.json');
  try{
    await chmod(root,0o700);await writeFile(file,'{"synthetic":true}',{mode:0o600});
    assert.equal(await macPrivatePathVerified(file,'File',{authorizedRoot:root}),true);
    await chmod(file,0o644);assert.equal(await macPrivatePathVerified(file,'File',{authorizedRoot:root}),false);
    await chmod(file,0o600);await mkdir(join(root,'.git'));assert.equal(await macPrivatePathVerified(file,'File',{authorizedRoot:root}),false);
  }finally{
    // Only a known synthetic child of the owner's home may be removed.
    const {dirname,basename,resolve}=await import('node:path');const {rm}=await import('node:fs/promises');
    assert.equal(dirname(resolve(root)),resolve(homedir()));assert.ok(basename(root).startsWith('.gridly-mac-acl-synthetic-'));
    await rm(root,{recursive:true,force:true});
  }
});
test('explicit Mac root is forwarded by staging and verification without changing Windows ACL source',async()=>{
  const source=await readFile('tools/native-web.mjs','utf8');
  assert.equal((source.match(/authorizedRoot:maintenancePrivateRoot/g)||[]).length,2);
  assert.match(source,/option\('--maintenance-private-root'\)/);
  for(const path of ['tools/arcgis-maintenance/Assert-GridlyPrivatePath.ps1','tools/arcgis-maintenance/PrivatePathContract.psm1']){
    const before=execFileSync('git',['show','eba97e140e14eda696a44f6e096a3bebfc52ea64:'+path],{encoding:'utf8'});
    assert.equal((await readFile(path,'utf8')).replaceAll('\r\n','\n'),before.replaceAll('\r\n','\n'));
  }
});

test('Android source owns a fresh fixture and denies every WebView fallback and service worker request',async()=>{
  const source=await readFile(javaPath,'utf8');
  for(const token of ['view.getUrl()!=null','view.copyBackForwardList().getSize()!=0','view.setWebViewClient(this)','setBlockNetworkLoads(true)','ServiceWorkerClient','onRenderProcessGone','onReceivedSslError','handler.cancel()','if (armed) stop()'])assert.ok(source.includes(token));
  assert.doesNotMatch(source,/return null;|super\.shouldInterceptRequest|\.proceed\(|launchIntent|loadUrl\(/);
  assert.match(source,/private volatile boolean armed = false, stopped = false/);
  assert.ok(source.indexOf('view.setWebViewClient(this)')<source.indexOf('view.loadDataWithBaseURL'));
});
test('Android source reserves durably before one authenticated TLS HTTP write with no retry client',async()=>{
  const source=await readFile(javaPath,'utf8');
  assert.ok(source.indexOf('ordinal=transact(true,false)')<source.indexOf('byte[] body=synthetic'));
  assert.equal((source.match(/getOutputStream\(\)\.write\(/g)||[]).length,1);
  for(const token of ['MAX_REQUESTS = 2','getFD().sync()','tryLock()','setEndpointIdentificationAlgorithm("HTTPS")','tls.startHandshake()','flight.createNewFile()','stopMarker.exists()'])assert.ok(source.includes(token));
  assert.doesNotMatch(source,/HttpURLConnection|OkHttpClient|X509TrustManager|setDefaultHostnameVerifier|\.printStackTrace\(|System\.out|android\.util\.Log/);
});
test('iOS source uses supported custom local scheme, network-blocked fresh WKWebView and separate native transport',async()=>{
  const source=await readFile(swiftPath,'utf8');
  assert.ok(source.startsWith('// Diagnostic source only.'));assert.match(source,/#if DEBUG && GRIDLY_ARCGIS_DIAGNOSTIC/);
  assert.match(source,/forURLScheme: "capacitor"/);assert.doesNotMatch(source,/forURLScheme: "https?"|URLProtocol\.registerClass|allowsAnyHTTPSCertificate|sec_protocol_options_set_verify_block|URLSession/);
  for(const token of ['websiteDataStore = .nonPersistent()','allowsContentJavaScript = false','userContentController.add(rule)','guard let self = self, let rule = rule, error == nil','EXPLICIT_NATIVE_TLS_NOT_WEBVIEW_HTTPS','ABSENT_NATIVE_BOUND_PATH'])assert.ok(source.includes(token));
  assert.ok(source.indexOf('userContentController.add(rule)')<source.indexOf('let view = WKWebView'));
});
test('iOS source reserves before single TLS send, rejects redirects and persists lifecycle stops',async()=>{
  const source=await readFile(swiftPath,'utf8');
  assert.ok(source.indexOf('let ordinal = try self.budget.change(reserve: true')<source.indexOf('let connection = NWConnection'));
  assert.equal((source.match(/connection\.send\(content:/g)||[]).length,1);
  for(const token of ['guard !sent, !finished','used < 2','O_EXCL | O_NOFOLLOW','fsync(fd)','beginFlight()','markStopped()','webViewWebContentProcessDidTerminate','guard status == 200','sec_protocol_options_set_tls_server_name','isExcludedFromBackup = true'])assert.ok(source.includes(token));
  assert.doesNotMatch(source,/completion: \.idempotent|connection\.restart\(|print\(|NSLog\(|Logger\(|dump\(/);
});
test('native fixtures remain outside all production runtime and native project membership',async()=>{
  for(const path of ['consumer-script-manifest.json','android/app/build.gradle','android/app/src/main/AndroidManifest.xml','android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt','ios/App/App.xcodeproj/project.pbxproj','ios/App/App/GridlyBridgeViewController.swift']){
    const text=await readFile(path,'utf8');assert.doesNotMatch(text,/GridlyLabelDiagnostic|GRIDLY_ARCGIS_DIAGNOSTIC/);
  }
});
test('both native sources default provider transport OFF and separate synthetic from explicit live selection',async()=>{
  for(const path of [javaPath,swiftPath]){
    const source=await readFile(path,'utf8');
    for(const marker of ['selectSyntheticTransport','authorizeProviderTransport','OWNER_TWO_REQUEST_NATIVE_PROVIDER_TEST','SYNTHETIC_','SYNTHETIC_DECODE_512_PASS'])assert.ok(source.includes(marker));
    assert.match(source,/providerEnabled\s*=\s*false/);
    assert.equal((source.match(/authorizeProviderTransport\(/g)||[]).length,1); // Declaration only, no automatic activation.
  }
});

// A simulated platform bridge drives the EXISTING gate/ledger, not compiled native code.
async function simulated(platform,suffix) {
  const f=await fixture(),runId='synthetic-'+suffix,scope=platform+':'+runId;
  const ledger=await createFileBudgetLedger({directory:f.root,verifyPrivateDirectory:async()=>true});await ledger.initialize(scope);
  let hooks,writes=0;
  const bridge={capability:'gridly.native-label-interceptor.v1',beforeFirstNetwork:true,wholeContext:true,retriesDisabled:true,redirectsDisabled:true,reconnectPreservesLedger:true,async install(h){hooks=h;}};
  const gate=createLabelDiagnostic({mode:'OWNER_ISOLATED_NATIVE_LABEL_DIAGNOSTIC',platform,runId,candidateToken:key,interceptor:bridge,ledger,observeContext:async()=>({origin:platform==='ios'?'capacitor://localhost':'https://localhost'})});
  await gate.install();
  return {...f,gate,ledger,scope,writes:()=>writes,async dispatch(status=200,browser=false){
    if(platform==='ios'&&browser)return {action:'ABORT'};
    const headers=new Map(platform==='ios'?[]:[['referer','https://localhost/fixture']]);
    const verdict=await hooks.beforeDispatch({method:'GET',url:endpoint+'?token='+key,headers});
    if(verdict.action==='CONTINUE_UNMODIFIED'){writes++;await hooks.afterResponse({ordinal:verdict.ordinal,status,contentType:'image/png',bytes:png(),rendered:false});}
    return verdict;
  }};
}
for(const platform of ['android','ios'])test(platform+': synthetic bridge denies pre-arm/automatic traffic, caps two writes and rejects third',async()=>{
  const f=await simulated(platform,platform+'-native');try{
    assert.equal((await f.dispatch()).action,'ABORT');assert.equal(f.writes(),0);
    await f.gate.arm();if(platform==='ios'){await f.dispatch(200,true);assert.equal(f.writes(),0);}
    await f.dispatch();assert.equal(f.writes(),1);await f.dispatch();assert.equal(f.writes(),2);await f.dispatch();assert.equal(f.writes(),2);
    assert.equal(JSON.stringify(f.gate.evidence()).includes(key),false);assert.ok(f.gate.evidence().every(row=>row.rendering==='UNVERIFIED'));
    assert.equal(f.gate.evidence()[0].referer,platform==='ios'?'UNOBSERVABLE':'https://localhost');
  }finally{await f.dispose();}
});
for(const platform of ['android','ios'])test(platform+': synthetic concurrency, HTTP error and restart cannot create retries/reset budget',async()=>{
  const f=await simulated(platform,platform+'-parallel');try{
    await f.gate.arm();await Promise.all(Array.from({length:50},()=>f.dispatch()));assert.equal(f.writes(),1);
    await f.dispatch(302);assert.equal(f.writes(),2);await f.dispatch();assert.equal(f.writes(),2);
    const reopened=await createFileBudgetLedger({directory:f.root,verifyPrivateDirectory:async()=>true});assert.equal((await reopened.reserve(f.scope,2)).allowed,false);
    await assert.rejects(()=>reopened.initialize(f.scope),/BUDGET_UNAVAILABLE/);
  }finally{await f.dispose();}
});
