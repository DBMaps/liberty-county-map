import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const requireForDiagnostics=createRequire(import.meta.url);
import {createAppleStoreKit,createAppleVerificationAuthority,createStoreKitDiagnostics,APPLE_PRODUCT_ID} from '../js/gridly-apple-storekit.mjs';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';
import {normalizeApple,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';

const instant=Date.parse('2026-10-18T22:55:00.000Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function fixture({nativeResult='verified',nativeEvents=[],authorityFailure=false,proofRejected=false,deliveryFailure=false,nativeDelay=0}={}) {
 const diagnostics=createStoreKitDiagnostics({enabled:true}),calls=[],handlers=new Map();
 const native={result:nativeResult,productId:APPLE_PRODUCT_ID,environment:'sandbox/test',completionHandle:'synthetic-handle',signedTransaction:'synthetic.payload.signature'};
 const record=normalizeApple({bundleId:'com.gridlygo.gridly',productId:APPLE_PRODUCT_ID,type:'Auto-Renewable Subscription',environment:'Sandbox',originalTransactionId:'synthetic-chain',expiresDate:instant+86400000},
  {originalTransactionId:'synthetic-chain',productId:APPLE_PRODUCT_ID,environment:'Sandbox',autoRenewStatus:1},1,{env:'sandbox/test',originalReference:'synthetic-chain',now:instant});
 const nativeCall=action=>async(options={})=>{
  calls.push(action);for(const [stage,outcome] of nativeEvents)diagnostics.native({attempt:options.diagnosticAttempt,action,stage,outcome,errorCode:-1009,privateValue:'NEVER_EMIT'});
  if(nativeDelay)await delay(nativeDelay);
  return {...native};
 };
 const plugin={purchase:nativeCall('purchase'),restorePurchases:nativeCall('restore'),getCurrentEntitlement:nativeCall('launch'),refreshEntitlement:nativeCall('refresh'),
  getProducts:async()=>({result:'available',productId:APPLE_PRODUCT_ID,displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
  addListener:async(name,fn)=>{handlers.set(name,fn);return {remove:async()=>handlers.delete(name)};},startObserving:async()=>{},stopObserving:async()=>{},
  finishTransaction:async()=>{calls.push('finish');return {finished:true};}};
 const authority={reconcile:async request=>{calls.push('authority');if(authorityFailure)throw Object.assign(Error('NEVER_EMIT'),{httpStatus:502});return proofRejected?'invalid.proof.signature':signResponse(record,request.nonce,keys.privateKey,webcrypto);}};
 const options={capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios'},plugin,authority,publicKey:keys.publicKey,environment:'auto',crypto:webcrypto,now:()=>instant,diagnostics,
  deliverEntitlement:async()=>{calls.push('delivery');return !deliveryFailure;}};
 return {diagnostics,calls,handlers,native,plugin,options,session:()=>createAppleStoreKit(options),coordinator:()=>createPaidAccess({...options,schedule:()=>0,cancel:()=>{}})};
}
const has=(events,stage,outcome)=>events.some(event=>event.stage===stage&&event.outcome===outcome);
for(const scenario of [
 ['product-fetch failure',[['native_entry','started'],['product_fetch','started'],['product_fetch','failed']]],
 ['product-validation rejection',[['product_fetch','returned'],['product_validation','storefront_rejected']]],
 ['purchase invocation failure',[['product_validation','passed'],['purchase_call','started'],['purchase_call','failed']]],
 ['restore sync failure',[['native_entry','started'],['restore_sync','started'],['restore_sync','failed']]]
])test('synthetic native event transport: '+scenario[0],async()=>{
 const action=scenario[0].startsWith('restore')?'restore':'purchase';
 const f=fixture({nativeResult:'error',nativeEvents:scenario[1]});const id=f.diagnostics.begin(action);
 const value=await f.session()[action](id);assert.equal(value.errorCategory,'store_unavailable');
 const [stage,outcome]=scenario[1].at(-1);assert.ok(has(f.diagnostics.read(),stage,outcome));assert.ok(!f.calls.includes('authority'));
 assert.doesNotMatch(JSON.stringify(f.diagnostics.read()),/NEVER_EMIT|signedTransaction|synthetic|completionHandle/);
});
for(const [name,result,outcome] of [['cancellation','user_cancelled','cancelled'],['pending purchase','purchase_pending','pending'],['restore without eligible transaction','no_evidence','no_evidence']])test(name+' is distinct and never verifies or finishes',async()=>{
 const f=fixture({nativeResult:result});const action=result==='no_evidence'?'restore':'purchase',id=f.diagnostics.begin(action);
 await f.session()[action](id);assert.ok(has(f.diagnostics.read(),'native_result',outcome));assert.deepEqual(f.calls,[action]);
});
test('successful sandbox evidence preserves authority, delivery and finish order',async()=>{
 const f=fixture({nativeEvents:[['purchase_result','success'],['native_evidence','accepted']]});const id=f.diagnostics.begin('purchase');
 const value=await f.session().purchase(id);assert.equal(value.entitlementState,'entitled');
 assert.deepEqual(f.calls,['purchase','authority','delivery','finish']);
 for(const [stage,outcome] of [['native_result','verified'],['authority','returned'],['proof','entitled'],['delivery','accepted'],['finish','success']])assert.ok(has(f.diagnostics.read(),stage,outcome));
});
for(const [name,setting,stage,outcome] of [['backend failure','authorityFailure','authority','failed'],['proof rejection','proofRejected','proof','rejected'],['delivery failure','deliveryFailure','delivery','failed']])test(name+' is isolated after native success',async()=>{
 const f=fixture({[setting]:true}),id=f.diagnostics.begin('purchase');const value=await f.session().purchase(id);
 assert.notEqual(value.entitlementState,'entitled');assert.ok(has(f.diagnostics.read(),stage,outcome));assert.ok(!f.calls.includes('finish'));
});
test('Edge status is sanitized before coordinator rewrap, without changing denial semantics',async()=>{
 const f=fixture();f.options.authority=createAppleVerificationAuthority({invoke:async()=>({data:null,error:{context:{status:401},private:'NEVER_EMIT'}})});
 const c=f.coordinator();await c.start();await c.purchase();
 assert.ok(f.diagnostics.read().some(event=>event.stage==='authority'&&event.httpStatus===401));
 assert.equal(c.allowed(),false);assert.doesNotMatch(JSON.stringify(f.diagnostics.read()),/NEVER_EMIT|context|synthetic/);await c.stop();
});
test('automatic foreground refresh cannot replace the last user attempt',async()=>{
 const f=fixture({nativeResult:'no_evidence'}),c=f.coordinator();await c.start();await c.restore();
 const retained=JSON.stringify(f.diagnostics.read());f.handlers.get('appForeground')();await c.refresh();
 assert.equal(JSON.stringify(f.diagnostics.read()),retained);assert.ok(f.diagnostics.read().every(event=>event.action==='restore'));await c.stop();
});
test('outer timeout is terminal; late native callback cannot overwrite it or call authority',async()=>{
 const f=fixture({nativeDelay:35});f.options.purchaseTimeoutMs=5;const id=f.diagnostics.begin('purchase');
 await f.session().purchase(id);const retained=JSON.stringify(f.diagnostics.read());
 assert.ok(has(f.diagnostics.read(),'native_invocation','timeout'));
 f.diagnostics.native({attempt:id,action:'purchase',stage:'native_evidence',outcome:'accepted'});
 await delay(45);assert.equal(JSON.stringify(f.diagnostics.read()),retained);assert.ok(!f.calls.includes('authority'));
});
test('inner authority timeout retains its own stage after a late response',async()=>{
 const f=fixture();f.options.timeoutMs=5;f.options.authority={reconcile:async()=>{await delay(30);return 'late.private.proof';}};
 const id=f.diagnostics.begin('purchase');await f.session().purchase(id);const retained=JSON.stringify(f.diagnostics.read());
 await delay(40);assert.ok(has(f.diagnostics.read(),'authority','timeout'));assert.equal(JSON.stringify(f.diagnostics.read()),retained);assert.ok(!f.calls.includes('finish'));
});
test('sanitizer constructs exact schema, rejects arbitrary labels and bounds session memory',()=>{
 let tick=0;const d=createStoreKitDiagnostics({enabled:true,now:()=>++tick}),id=d.begin('purchase');
 d.native({attempt:id,action:'purchase',stage:'product_fetch',outcome:'failed',errorCode:-1009,signedTransaction:'NEVER_EMIT',userInfo:{account:'NEVER_EMIT'}});
 assert.deepEqual(Object.keys(d.read()[0]).sort(),['action','attempt','elapsedMs','errorCode','outcome','stage']);
 d.emit(id,'authority','failed',{httpStatus:503,Authorization:'NEVER_EMIT',errorCode:Infinity});
 d.emit(id,'NEVER_EMIT','failed');d.emit(id,'proof','NEVER_EMIT');d.native({attempt:id,action:'restore',stage:'proof',outcome:'accepted'});
 assert.equal(d.read().length,2);
 for(let i=0;i<200;i++)d.emit(id,'queue','queued');assert.equal(d.read().length,64);assert.ok(has(d.read(),'product_fetch','failed'));
 d.finish(id,'unknown');const retained=JSON.stringify(d.read());
 for(let i=0;i<100;i++){const background=d.begin('refresh');d.emit(background,'native_result','none');d.finish(background,'not_entitled');}
 assert.equal(JSON.stringify(d.read()),retained);assert.doesNotMatch(retained,/NEVER_EMIT|Authorization|userInfo|signedTransaction/);
 d.dispose();assert.deepEqual(d.read(),[]);assert.equal(createStoreKitDiagnostics().begin('purchase'),null);
});
test('diagnostics are observational; disabled run keeps exact native call shape',async()=>{
 const f=fixture();f.options.diagnostics=null;f.plugin.restorePurchases=async options=>{assert.deepEqual(options,{userInitiated:true});return {result:'no_evidence'};};
 await f.session().restore();assert.deepEqual(f.diagnostics.read(),[]);
});
test('native callsites cover the real fetch, validation and sync boundaries; ordinary builds stay disabled',()=>{
 const swift=readFileSync('ios/App/App/GridlyStoreKitPlugin.swift','utf8');
 assert.match(swift,/#if GRIDLY_STOREKIT_DIAGNOSTICS[\s\S]*?> 14[\s\S]*?#else\s+return false/);
 assert.match(swift,/step\(attempt, action, "product_fetch"\) \{ try await Product.products\(for: \[Self.productID\]\) \}/);
 assert.match(swift,/step\(attempt, "purchase", "purchase_call", work: \{ try await item.purchase\(\) \}\)/);
 assert.match(swift,/step\(attempt, "restore", "restore_sync"\) \{ try await AppStore.sync\(\) \}/);
 for(const label of ['count_rejected','id_rejected','type_rejected','period_rejected','offers_rejected','storefront_rejected'])assert.ok(swift.includes('"'+label+'"'));
 assert.doesNotMatch(swift,/localizedDescription|\.userInfo|NSLog|print\(/);
});

test('owner diagnostic surface is enabled only by native configuration and retains a readable failure',async()=>{
 const {createServer}=await import('node:http');const {readFile}=await import('node:fs/promises');const {resolve}=await import('node:path');
 const {chromium}=await import('@playwright/test');
 const fixtureHtml=`<!doctype html><html><head><link rel="stylesheet" href="/css/gridly-paid-access.css"></head><body><div id="gridlyPaidPending"></div>
 <section id="gridlyPaidAccess"><nav>Help</nav><p id="gridlyPaidStatus"></p><div id="gridlyPaidOffer"></div><span id="gridlyPaidPrice"></span><span id="gridlyPaidBilling"></span><button id="gridlyPaidPurchase">Subscribe</button><button id="gridlyPaidRestore">Restore</button><button id="gridlyPaidRetry">Retry</button></section>
 <script>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios'};</script>
 <script type="module">import {bootPaidAccess} from '/js/gridly-paid-ui.mjs';await bootPaidAccess();</script></body></html>`;
 const server=createServer(async(req,res)=>{try{
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(fixtureHtml);return;}
  if(req.url==='/css/gridly-paid-access.css'){res.setHeader('Content-Type','text/css');res.end(await readFile(resolve('.'+req.url)));return;}
  if(/^\/js\/[a-z0-9-]+\.mjs$/.test(req.url)){res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve('.'+req.url)));return;}
  res.statusCode=404;res.end();
 }catch{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  for(const enabled of [false,true]){
   const page=await browser.newPage();const failures=[];page.on('pageerror',error=>failures.push(error.message));
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
   await page.route('**/js/gridly-paid-config.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export const productionPaidComposition=async capacitor=>({capacitor,plugin:{diagnosticConfiguration:async()=>({enabled:${enabled}}),addListener:async()=>({remove:async()=>{}})}});`}));
   await page.route('**/js/gridly-paid-onboarding.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export const onboardingComplete=()=>true;export const createPaidOnboarding=async()=>({dispose(){}});'}));
   await page.route('**/js/gridly-paid-startup.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export const loadPaidRuntime=async()=>{};'}));
   await page.route('**/js/gridly-paid-access.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
    export const nativeStore=()=> 'apple';
    export const createPaidAccess=({diagnostics:d})=>{
     let listener;const value={state:'not_entitled',action:null,platform:'apple',product:{available:true,displayPrice:'$2.99'},errorCategory:'none',verificationReady:true,allowed:false};
     return {read:()=>value,allowed:()=>false,subscribe:fn=>{listener=fn;fn(value);return()=>{};},start:async()=>{},stop:async()=>{},
      purchase:async()=>{const id=d?.begin('purchase');d?.emit(id,'tap','started');d?.emit(id,'product_fetch','failed',{errorCode:-1009});d?.finish(id,'temporarily_unavailable');listener({...value,diagnosticAttempt:id});},
      restore:async()=>{},refresh:async()=>{const id=d?.begin('refresh');d?.finish(id,'not_entitled');listener({...value,diagnosticAttempt:id});}
     };
    };`}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.locator('#gridlyPaidPurchase:not([disabled])').waitFor();
   if(enabled)await page.locator('#gridlyStoreDiagnostics').waitFor({state:'visible'});
   await page.locator('#gridlyPaidPurchase').click();
   if(enabled){
    await page.waitForFunction(()=>document.getElementById('gridlyStoreDiagnostics')?.textContent.includes('presentation / paywall'));
    const before=await page.locator('#gridlyStoreDiagnostics').textContent();
    assert.match(before,/First diagnostic outcome: product_fetch \/ failed/);assert.match(before,/code=-1009/);
    assert.equal(await page.locator('#gridlyStoreDiagnostics').evaluate(element=>element.inert),false);
    assert.equal(await page.locator('#gridlyStoreDiagnostics').isVisible(),true);
    assert.equal(await page.locator('#gridlyStoreDiagnostics summary').isVisible(),true);
    await page.locator('#gridlyPaidRetry').click();assert.equal(await page.locator('#gridlyStoreDiagnostics').textContent(),before);
    assert.doesNotMatch(before,/signedTransaction|receipt|Authorization|NEVER_EMIT/);
   }else assert.equal(await page.locator('#gridlyStoreDiagnostics').count(),0);
   assert.deepEqual(failures,[]);await page.close();
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});

test('native-stage timeout identifies fetch stall rather than generic bridge invocation',async()=>{
 const f=fixture({nativeDelay:30,nativeEvents:[['product_fetch','started']]});f.options.purchaseTimeoutMs=5;const id=f.diagnostics.begin('purchase');
 await f.session().purchase(id);assert.ok(has(f.diagnostics.read(),'product_fetch','timeout'));
});

test('late authority failure stays attached to its closed attempt when a new user action runs',async()=>{
 const f=fixture({nativeResult:'no_evidence'});let rejectOld,releaseNext;
 f.options.timeoutMs=5;f.options.purchaseTimeoutMs=100;
 const c=f.coordinator();await c.start();
 f.plugin.purchase=async()=>({...f.native,result:'verified'});
 f.options.authority.reconcile=()=>new Promise((_,reject)=>{rejectOld=reject;});
 await c.purchase();
 f.plugin.restorePurchases=async()=>new Promise(resolve=>{releaseNext=()=>resolve({result:'no_evidence'});});
 const restore=c.restore();while(!releaseNext)await delay(1);
 const before=JSON.stringify(f.diagnostics.read());rejectOld(Object.assign(Error('NEVER_EMIT'),{httpStatus:503}));
 await delay(2);assert.equal(JSON.stringify(f.diagnostics.read()),before);releaseNext();await restore;await c.stop();
});

// Execute the production boot function in memory with deterministic local ports.
const {Script,constants:vmConstants}=await import('node:vm');
const {fileURLToPath}=await import('node:url');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
function startupFixture({configuration,listener,missing=false}={}) {
 const elements=new Map(),windowEvents=new Map(),calls={created:0,started:0,purchase:0,restore:0,removed:0};
 class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.events=new Map();this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.inert=false;}
  append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
  setAttribute(){} cloneNode(){return new Element();}
  querySelector(){return new Element('nav');} querySelectorAll(){return [];}
  addEventListener(name,fn){this.events.set(name,fn);} removeEventListener(name){this.events.delete(name);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 }
 const body=new Element('body');
 for(const id of ['gridlyPaidAccess','gridlyPaidPending','gridlyPaidStatus','gridlyPaidPurchase','gridlyPaidRestore','gridlyPaidRetry','gridlySettingsRestore','gridlyPaidOffer','gridlyPaidPrice','gridlyPaidBilling']){const element=new Element();element.id=id;elements.set(id,element);body.append(element);}
 const document={body,documentElement:new Element('html'),getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 const capacitor={getPlatform:()=> 'ios'},plugin={addListener:listener??(async()=>({remove:async()=>{calls.removed++;}}))};
 if(!missing)plugin.diagnosticConfiguration=configuration??(async()=>({enabled:false}));
 const window={Capacitor:capacitor,addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name),location:{reload(){}}};
 let port;
 const state={state:'not_entitled',action:null,platform:'apple',product:{available:true,displayPrice:'$2.99'},errorCategory:'none',verificationReady:true,allowed:false};
 const context={document,window,GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE:false,nativeStore:()=>null,onboardingComplete:()=>true,
  productionPaidComposition:async()=>({capacitor,plugin}),
  createPaidAccess:options=>{port=options.diagnostics;calls.created++;return {read:()=>state,allowed:()=>false,subscribe:fn=>{fn(state);return()=>{};},start:async()=>{calls.started++;},stop:async()=>{},purchase:async()=>{calls.purchase++;},restore:async()=>{calls.restore++;},refresh:async()=>{}};}};
 const source=readFileSync('js/gridly-paid-ui.mjs','utf8');
 const bodySource=source.replace(/^import .*;\r?\n/gm,'').replace('export async function bootPaidAccess()','async function bootPaidAccess()');
 const script=new Script(bodySource+'; bootPaidAccess();',{filename:fileURLToPath(new URL('../js/gridly-paid-ui.mjs',import.meta.url)),importModuleDynamically:vmConstants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
 const boot=script.runInNewContext(context);
 return {boot,calls,elements,port:()=>port,surface:()=>body.children.find(element=>element.id==='gridlyStoreDiagnostics'),close:()=>windowEvents.get('pagehide')?.()};
}
async function assertNormalStartup(fixture){
 await fixture.boot;assert.equal(fixture.calls.created,1);assert.equal(fixture.calls.started,1);
 fixture.elements.get('gridlyPaidPurchase').events.get('click')();fixture.elements.get('gridlyPaidRestore').events.get('click')();
 assert.equal(fixture.calls.purchase,1);assert.equal(fixture.calls.restore,1);
}
for(const scenario of ['missing','never','rejected','disabled','malformed'])test('optional configuration '+scenario+' never blocks coordinator or handlers',async()=>{
 const config=scenario==='never'?()=>new Promise(()=>{}):scenario==='rejected'?()=>Promise.reject(Error('NEVER_EMIT')):async()=>scenario==='malformed'?{enabled:true,unexpected:'NEVER_EMIT'}:{enabled:false};
 const f=startupFixture({configuration:config,missing:scenario==='missing'});await assertNormalStartup(f);await flush();assert.equal(f.surface(),undefined);assert.equal(f.port().enabled,false);f.close();
});
for(const scenario of ['never','rejected','malformed'])test('optional listener '+scenario+' never blocks coordinator or exposes UI',async()=>{
 const listener=scenario==='never'?()=>new Promise(()=>{}):scenario==='rejected'?()=>Promise.reject(Error('NEVER_EMIT')):async()=>({});
 const f=startupFixture({configuration:async()=>({enabled:true}),listener});await assertNormalStartup(f);await flush();assert.equal(f.surface(),undefined);assert.equal(f.port().enabled,false);f.close();
});
test('delayed authorized setup enables the stable observer after normal startup',async()=>{
 const config=deferred(),f=startupFixture({configuration:()=>config.promise});await assertNormalStartup(f);assert.equal(f.port().enabled,false);
 config.resolve({enabled:true});await flush();assert.ok(f.surface());assert.equal(f.port().enabled,true);
 const attempt=f.port().begin('purchase');f.port().emit(attempt,'product_fetch','failed');assert.equal(typeof attempt,'number');f.close();assert.equal(f.port().enabled,false);
});
test('late configuration after page close cannot enable diagnostics',async()=>{
 const config=deferred(),f=startupFixture({configuration:()=>config.promise});await assertNormalStartup(f);f.close();config.resolve({enabled:true});await flush();assert.equal(f.surface(),undefined);assert.equal(f.port().enabled,false);
});
test('late listener is removed after page close and cannot install UI',async()=>{
 const pending=deferred();let registered=false,removed=0;
 const f=startupFixture({configuration:async()=>({enabled:true}),listener:()=>{registered=true;return pending.promise;}});
 await assertNormalStartup(f);await flush();assert.equal(registered,true);f.close();pending.resolve({remove:async()=>{removed++;}});await flush();assert.equal(removed,1);assert.equal(f.surface(),undefined);
});
test('detached setup and listener cleanup do not create unhandled rejections',async()=>{
 const unhandled=[];const observe=reason=>unhandled.push(reason);process.on('unhandledRejection',observe);
 try{
  const rejected=startupFixture({configuration:()=>Promise.reject(Error('NEVER_EMIT'))});await assertNormalStartup(rejected);await flush();rejected.close();
  const active=startupFixture({configuration:async()=>({enabled:true}),listener:async()=>({remove:()=>Promise.reject(Error('NEVER_EMIT'))})});
  await assertNormalStartup(active);await flush();assert.ok(active.surface());active.close();await flush();assert.deepEqual(unhandled,[]);
 }finally{process.removeListener('unhandledRejection',observe);}
});

test('original Build 14 recovery assertion has identical baseline/candidate inputs and result',()=>{
 const {execFileSync}=requireForDiagnostics('node:child_process'),Module=requireForDiagnostics('node:module'),vm=requireForDiagnostics('node:vm');
 const paths=['tests/build13-native-pending-recovery.test.cjs','ios/App/App/GridlyBridgeViewController.swift','js/app.js','js/gridly-report-protocol.js'];
 const baseline=new Map(paths.map(path=>[path,execFileSync('git',['show','e0b51235:'+path],{maxBuffer:64*1024*1024}).toString()]));
 const candidate=new Map(paths.map(path=>[path,readFileSync(path,'utf8')]));
 for(const path of paths)assert.equal(candidate.get(path).replace(/\r\n/g,'\n'),baseline.get(path).replace(/\r\n/g,'\n'));
 const evaluate=contents=>{
  const protocol=new Module(process.cwd()+'/js/gridly-report-protocol.js');protocol._compile(contents.get(paths[3]),process.cwd()+'/js/gridly-report-protocol.js');let result;
  const localRequire=id=>id==='node:test'?{test:(title,body)=>{if(title.startsWith('explicit clear removes exactly one key')){try{body();result={status:'passed'};}catch(error){result={status:'baseline_exception',code:error.code,actual:error.actual,expected:error.expected};}}}}:
   id==='node:fs'?{readFileSync:path=>contents.get(String(path).replace(/\\/g,'/'))}:id==='../js/gridly-report-protocol.js'?protocol.exports:requireForDiagnostics(id);
  vm.runInNewContext(contents.get(paths[0]),{require:localRequire});return JSON.parse(JSON.stringify(result));
 };
 const original=evaluate(baseline),current=evaluate(candidate);assert.deepEqual(current,original);
 if(original.status==='baseline_exception'){
  assert.equal(original.code,'ERR_ASSERTION');assert.deepEqual(original.actual,[['set','gridlyPendingCommunityOperationV1'],['remove','gridlyPendingCommunityOperationV1']]);
  assert.deepEqual(original.expected,[['remove','gridlyPendingCommunityOperationV1']]);
 }
});
test('isolated workflow requires a deliberate certification tag and contains no store distribution commands',()=>{
 const workflow=readFileSync('.github/workflows/gridly-storekit-diagnostic-certification.yml','utf8');
 assert.match(workflow,/on:\n  push:\n    tags:\n      - 'gridly-storekit-diagnostic-certify-\*'\n\npermissions:/);
 assert.doesNotMatch(workflow,/^  (workflow_dispatch|pull_request|schedule|workflow_run|repository_dispatch):|^    branches:|\$\{\{ inputs\./m);
 for(const gate of ["github.repository == 'DBMaps/liberty-county-map'",'github.event.repository.private',"github.event_name == 'push'",'github.event.created == true','github.event.deleted == false','github.event.forced == false',"startsWith(github.ref, 'refs/tags/gridly-storekit-diagnostic-certify-')",'unused_build_number_confirmed','baseline_exception_acknowledged','certification_authorized'])assert.ok(workflow.includes(gate));
 assert.match(workflow,/ref: \$\{\{ github.sha \}\}/);assert.match(workflow,/fetch-depth: 0/);assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/authorize-tag --ref "\$GITHUB_REF" --commit "\$GITHUB_SHA" --github-env "\$GITHUB_ENV"/);
 assert.ok(workflow.indexOf('authorize-tag')<workflow.indexOf('certification.py preflight'));
 assert.ok(workflow.indexOf('certification.py preflight')<workflow.indexOf('secrets.'));
 assert.match(workflow,/name: gridly-storekit-diagnostic-certification-\$\{\{ env.DIAGNOSTIC_BUILD_NUMBER \}\}/);
 assert.match(workflow,/runs-on: macos-26/);assert.match(workflow,/node-version: '22'/);assert.match(workflow,/\^Xcode 26/);
 assert.match(workflow,/SWIFT_ACTIVE_COMPILATION_CONDITIONS='\$\(inherited\) GRIDLY_STOREKIT_DIAGNOSTICS'/);
 assert.doesNotMatch(workflow,/CURRENT_PROJECT_VERSION=\d|--upload-app|--validate-app|altool|notarytool|ASC_PRIVATE_KEY|APPLE_ID_USERNAME|fastlane|pilot upload|gh api/);
 assert.match(workflow,/<key>destination<\/key><string>export<\/string>/);
 assert.match(workflow,/gridly-storekit-diagnostic-certification-/);assert.match(workflow,/regression_exit=\$\?/);assert.match(workflow,/--baseline-acknowledged/);
 const {execFileSync}=requireForDiagnostics('node:child_process');
 for(const path of ['.github/workflows/gridly-apple-build-9.yml','tools/apple_native_parity.py'])assert.equal(readFileSync(path,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','e0b51235:'+path]).toString().replace(/\r\n/g,'\n'));
 const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
 const blocks=[...workflow.matchAll(/^        run: \|\n((?:          .*\n|\n)+)/gm)];assert.ok(blocks.length>=7);
 for(const block of blocks)execFileSync(bash,['-n'],{input:block[1].replace(/^          /gm,''),stdio:['pipe','pipe','pipe']});
});
test('diagnostic certification support rejects bad identities, new regressions and weakened activation evidence',()=>{
 const {execFileSync}=requireForDiagnostics('node:child_process');const python=process.env.GRIDLY_TEST_PYTHON??'python3';
 const checks=String.raw`
import ast, json, sys, tempfile
from pathlib import Path
sys.path.insert(0, 'tools')
import apple_storekit_diagnostic_certification as cert
ast.parse(Path('tools/apple_storekit_diagnostic_certification.py').read_text(encoding='utf-8-sig'))
for bad in ('14','0','-1','1.2','',None,'15;echo bad'):
    try: cert.build_number(bad)
    except ValueError: pass
    else: raise AssertionError('unsafe build input accepted')
cert.original_contracts()
number='999999999' # synthetic policy fixture only; never a selected build number
assert cert.build_number(number)==number
activation=cert.activation_report_expected({},number)
assert activation['build_number']==number and len(activation['cases'])==8
assert [case for case in activation['cases'] if case['result']=='enabled']==[{'flag':True,'fixture':'candidate','result':'enabled'}]
with tempfile.TemporaryDirectory(prefix='gridly-regression-parser-') as temporary:
    tap=Path(temporary)/'result.tap'
    tap.write_text('TAP version 13\nok 1 - good\nnot ok 2 - '+cert.FAILURE+'\n1..2\n# tests 2\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n')
    result=cert.check_regressions(tap,1,True)
    assert result['status']=='baseline_exception' and result['suite_green'] is False
    for acknowledged,code in ((False,1),(True,2),(True,0)):
        try: cert.check_regressions(tap,code,acknowledged)
        except AssertionError: pass
        else: raise AssertionError('regression guard weakened')
    tap.write_text('not ok 1 - NEW REGRESSION\n# tests 1\n# fail 1\n')
    try: cert.check_regressions(tap,1,True)
    except AssertionError: pass
    else: raise AssertionError('new regression accepted')
print('diagnostic identity/regression/activation support PASS')
`;
 assert.match(execFileSync(python,['-B','-c',checks],{encoding:'utf8'}),/support PASS/);
});


test('certification authorization rejects unconfirmed, malformed or mismatched tags without touching Git refs',()=>{
 const {execFileSync}=requireForDiagnostics('node:child_process');const python=process.env.GRIDLY_TEST_PYTHON??'python3';
 const checks=String.raw`
import json, sys
from unittest.mock import patch
sys.path.insert(0, 'tools')
import apple_storekit_diagnostic_certification as cert
commit='a'*40
number='999999999' # synthetic authorization fixture only; never a selected build number
ref=cert.TAG_PREFIX+number+'-'+commit
payload={'candidate_commit':commit,'diagnostic_build_number':number,'unused_build_number_confirmed':True,'baseline_exception_acknowledged':True,'certification_authorized':True}
def run(*, reference=ref, event=commit, head=commit, branch=commit, kind='tag', annotation=None, header=None):
    if annotation is None: annotation=json.dumps(payload)
    if header is None: header='object '+commit+'\ntype commit\ntag '+ref.removeprefix('refs/tags/')
    def fake_git(*args):
        values={('rev-parse','HEAD'):head,('rev-parse','--verify',cert.DIAGNOSTIC_BRANCH):branch,
                ('cat-file','-t',ref):kind,('cat-file','-p',ref):header+'\n\n'+annotation+'\n',
                ('rev-parse','--verify',ref):'b'*40}
        return (values[args]+'\n').encode()
    with patch.object(cert,'git',side_effect=fake_git): return cert.authorize_tag(reference,event)
def rejected(**options):
    try: run(**options)
    except (AssertionError, ValueError, KeyError): return
    raise AssertionError('unsafe certification tag accepted')
result=run()
assert result['source_commit']==commit and result['build']==number and result['tag_object']=='b'*40
assert result['diagnostic_branch']==cert.DIAGNOSTIC_BRANCH
for key in ('unused_build_number_confirmed','baseline_exception_acknowledged','certification_authorized'):
    for value in (False,0,1,'true',None): rejected(annotation=json.dumps({**payload,key:value}))
    rejected(annotation=json.dumps({name:value for name,value in payload.items() if name!=key}))
for reference in ('refs/heads/codex/storekit-diagnostics','refs/tags/v15',cert.TAG_PREFIX+'14-'+commit,cert.TAG_PREFIX+number+'-'+commit+';echo bad'):
    rejected(reference=reference)
for options in ({'event':'c'*40},{'head':'c'*40},{'branch':'c'*40},{'kind':'commit'},
                {'header':'object '+'b'*40+'\ntype tag\ntag nested'}, {'annotation':'not JSON'},
                {'annotation':json.dumps({**payload,'upload':True})},
                {'annotation':json.dumps({**payload,'candidate_commit':'c'*40})},
                {'annotation':json.dumps({**payload,'diagnostic_build_number':999999999})},
                {'annotation':json.dumps(payload)[:-1]+',"certification_authorized":true}'},
                {'annotation':'[]'}): rejected(**options)
print('strict certification-tag authorization PASS')
`;
 assert.match(execFileSync(python,['-B','-c',checks],{encoding:'utf8'}),/authorization PASS/);
});
