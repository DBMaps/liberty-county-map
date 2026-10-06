const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const protocol=require('../js/gridly-report-protocol.js');

// Execute the exact fixed function body shipped by the native controller, not a
// test reimplementation. Fixtures cannot reach any network or native vault.
const native=fs.readFileSync('ios/App/App/GridlyBridgeViewController.swift','utf8');
const script=native.match(/private static let legacyRecoveryScript = #"""\r?\n([\s\S]*?)\r?\n\s*"""#/)[1];
const app=fs.readFileSync('js/app.js','utf8');
const cta=app.slice(app.indexOf('function gridlyRefreshPendingOperationButton()'),app.indexOf('async function gridlySubmitCommunityMutation('));
const cutoff=Date.parse('2026-10-06T21:14:27Z');
const id='12345678-1234-4234-8234-123456789abc';
const otherKeys=['gridlyHomePersonalizationV1','gridlyHomeTown','gridlyHome','gridlyWork','gridlySavedPlacesV1',
 'gridlySelectedPlaceIdV1','gridlySettingsV1','gridlyUserProfileV1','gridlyMovementIntelligenceV1',
 'gridlyEventHistoryV1','gridlySmartAlertsV1','gridlyUgcTermsAcceptanceV1','gridlyHiddenCommunityReportsV1',
 'gridlyDeviceId','unrelated-owner-state','sb-fixture-auth-token'];
const operation=(patch={})=>({id,startedAt:cutoff-60000,kind:'create',
 payload:{crossing_id:'fixture-road',lat:30,lng:-95,report_type:'flooding',detail:'private fixture'},...patch});

function fixture(saved=operation()) {
 const data=new Map(otherKeys.map((key,i)=>[key,`preserve-${i}`])),writes=[],nodes=new Map();
 if(saved!==undefined&&saved!==null)data.set(protocol.KEY,typeof saved==='string'?saved:JSON.stringify(saved));
 const storage={getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>{writes.push(['set',key]);data.set(key,value);},
  removeItem:key=>{writes.push(['remove',key]);data.delete(key);}};
 const client=protocol.create({storage});
 const context={window:{gridlyReportProtocol:protocol},localStorage:storage,
  location:{protocol:'capacitor:',hostname:'localhost'},
  reportingState:{submissionInProgress:false,locationLookupInProgress:false,reportModeActive:false,placementModeActive:false},
  governedRoadHazardSubmissionPromise:null,governedRoadHazardReportDraft:null,
  gridlyReportSubmissionRecoveryState:{activeSubmission:null},
  gridlyLp0534bClearDiagnostics:{crossingClearInFlightKeys:new Set(),roadHazardClearInFlightKeys:new Set()},
  gridlyGetCommunityProtocolClient:()=>client,gridlyReportingAvailabilityRuntime:{snapshot:()=>({state:'ENABLED'})},
  GRIDLY_REPORTING_AVAILABILITY_STATES:{DISABLED:'DISABLED'},
  document:{visibilityState:'visible',getElementById:key=>nodes.get(key),
   createElement:()=>({style:{},removeAttribute(){},remove(){nodes.delete(this.id);}}),
   body:{appendChild:node=>nodes.set(node.id,node)}},
  fetch:()=>assert.fail('recovery must not fetch'),supabaseClient:{rpc:()=>assert.fail('recovery must not RPC')},
  nativeVault:()=>assert.fail('recovery must not touch a native vault')};
 vm.createContext(context);vm.runInContext(cta,context);
 const run=(action,expected='')=>{
  context.action=action;context.expected=expected;
  return vm.runInContext(`(function(action,expected){${script}\n})(action,expected)`,context);
 };
 return {data,writes,nodes,storage,context,client,run};
}

test('preview reads an expired legacy record without normalization, writes, or exposing its contents in UI metadata',()=>{
 const f=fixture(operation({startedAt:1})),before=new Map(f.data);
 const preview=f.run('preview');assert.equal(preview.status,'preview');assert.equal(preview.raw,before.get(protocol.KEY));
 assert.equal(preview.kind,'Create report');assert.equal(preview.payload,'Complete saved details');
 const {raw,...display}=preview;assert.doesNotMatch(JSON.stringify(display),/12345678|private fixture|fixture-road|\"lat\"|\"lng\"/);
 assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
});

test('explicit clear removes exactly one key and the real Retry CTA; all other persistence is byte-identical',()=>{
 const f=fixture();f.context.gridlyRefreshPendingOperationButton();assert.ok(f.nodes.has('gridlyRetryPendingReport'));
 const preview=f.run('preview'),before=new Map(f.data);
 const result=f.run('clear',preview.raw);assert.equal(result.status,'removed');assert.equal(result.ctaRefreshed,true);
 assert.equal(f.client.pending(),null);assert.equal(f.nodes.has('gridlyRetryPendingReport'),false);
 assert.deepEqual(f.writes,[['remove',protocol.KEY]]);assert.equal(f.data.size,before.size-1);
 for(const key of otherKeys)assert.equal(f.data.get(key),before.get(key));
 assert.equal(f.run('clear',preview.raw).status,'empty');assert.equal(f.writes.length,1);
});

test('keeping or closing the preview never removes the saved operation',()=>{
 const f=fixture(),before=new Map(f.data);f.run('preview');assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
});

test('a changed record is preserved, including another legacy operation or an altered payload',()=>{
 for(const replacement of [operation({id:'87654321-4321-4321-8321-cba987654321'}),operation({payload:{different:true}}),'{broken']){
  const f=fixture(),preview=f.run('preview');const newer=JSON.stringify(replacement);f.data.set(protocol.KEY,newer);
  assert.equal(f.run('clear',preview.raw).status,'changed');assert.equal(f.data.get(protocol.KEY),newer);assert.deepEqual(f.writes,[]);
 }
});

test('new Build 12/13 operations, invalid identities/timestamps, and oversized storage are never eligible',()=>{
 for(const saved of [operation({startedAt:cutoff}),operation({startedAt:cutoff+1}),operation({startedAt:-1}),
  operation({startedAt:'old'}),operation({id:'invalid'}),operation({kind:'unknown'}),'{broken','null',
  JSON.stringify(operation({padding:'x'.repeat(14000)}))]){
  const f=fixture(saved),before=new Map(f.data),raw=f.data.get(protocol.KEY);
  assert.equal(f.run('preview').status,'not_legacy');assert.equal(f.run('clear',raw).status,'not_legacy');
  assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
 }
});

test('all current reporting/review/clear/retry busy owners refuse removal after preview',()=>{
 const busy=[f=>f.context.reportingState.submissionInProgress=true,
  f=>f.context.reportingState.locationLookupInProgress=true,f=>f.context.reportingState.reportModeActive=true,
  f=>f.context.reportingState.placementModeActive=true,f=>f.context.governedRoadHazardSubmissionPromise={},
  f=>f.context.governedRoadHazardReportDraft={reviewState:'ready'},f=>f.context.gridlyReportSubmissionRecoveryState.activeSubmission={},
  f=>f.context.gridlyLp0534bClearDiagnostics.crossingClearInFlightKeys.add('fixture'),
  f=>f.context.gridlyLp0534bClearDiagnostics.roadHazardClearInFlightKeys.add('fixture'),
  f=>f.nodes.set('gridlyRetryPendingReport',{disabled:true})];
 for(const beginBusy of busy){const f=fixture(),preview=f.run('preview'),before=new Map(f.data);beginBusy(f);
  assert.equal(f.run('preview').status,'busy');assert.equal(f.run('clear',preview.raw).status,'busy');
  assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
 }
});

test('unready runtime, hidden page, wrong origin and wrong protocol cannot clear',()=>{
 const deny=[f=>delete f.context.reportingState,f=>delete f.context.governedRoadHazardSubmissionPromise,
  f=>delete f.context.gridlyReportSubmissionRecoveryState,f=>delete f.context.gridlyLp0534bClearDiagnostics,
  f=>f.context.gridlyRefreshPendingOperationButton=undefined,f=>f.context.document.visibilityState='hidden',
  f=>f.context.location.protocol='https:',f=>f.context.location.hostname='different-host',
  f=>f.context.window.gridlyReportProtocol={...protocol,protocol_version:1},
  f=>f.context.window.gridlyReportProtocol={...protocol,KEY:'other-key'}];
 for(const block of deny){const f=fixture(),preview=f.run('preview'),before=new Map(f.data);block(f);
  assert.equal(f.run('clear',preview.raw).status,'not_ready');assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
 }
});

test('all legacy operation kinds can be explicitly forgotten without invoking cancellation or submission',()=>{
 for(const kind of ['create','confirm','edit','clear','cancel']){
  const f=fixture(operation({kind,payload:kind==='create'?operation().payload:{observation_id:id}}));
  const preview=f.run('preview');assert.equal(preview.status,'preview');
  assert.equal(f.run('clear',preview.raw).status,'removed');assert.deepEqual(f.writes,[['remove',protocol.KEY]]);
 }
});

test('incomplete details are previewed honestly and never normalized or submitted',()=>{
 const f=fixture(operation({payload:{report_type:'flooding'}})),before=new Map(f.data);
 assert.equal(f.run('preview').payload,'Incomplete saved details');assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
});

test('saved strings containing executable-looking text are data, never JavaScript source',()=>{
 const f=fixture(operation({payload:{...operation().payload,detail:"'); localStorage.clear(); throw Error('injected'); //\n"}}));
 const preview=f.run('preview');assert.equal(f.run('clear',preview.raw).status,'removed');
 for(const key of otherKeys)assert.ok(f.data.has(key));assert.deepEqual(f.writes,[['remove',protocol.KEY]]);
});

test('storage failures do not manufacture a success; a failed CTA refresh still reports confirmed removal accurately',()=>{
 for(const failure of ['read','remove','sticky']){
  const f=fixture(),preview=f.run('preview'),before=new Map(f.data);
  if(failure==='read')f.storage.getItem=()=>{throw Error('private storage error');};
  else if(failure==='remove')f.storage.removeItem=()=>{throw Error('private storage error');};
  else f.storage.removeItem=()=>{};
  const result=f.run('clear',preview.raw);assert.notEqual(result.status,'removed');
  assert.doesNotMatch(JSON.stringify(result),/private/);assert.deepEqual(f.data,before);
 }
 const f=fixture(),preview=f.run('preview');f.context.gridlyRefreshPendingOperationButton=()=>{throw Error('render');};
 const result=f.run('clear',preview.raw);assert.equal(result.status,'removed');assert.equal(result.ctaRefreshed,false);
});

test('empty storage, unknown actions and unbound confirmation cannot erase anything',()=>{
 const empty=fixture(null);assert.equal(empty.run('preview').status,'empty');assert.deepEqual(empty.writes,[]);
 const f=fixture(),before=new Map(f.data);assert.equal(f.run('anything').status,'invalid_action');
 assert.equal(f.run('clear').status,'changed');assert.deepEqual(f.data,before);assert.deepEqual(f.writes,[]);
});

test('native entry is limited to Build 13 and explicit destructive confirmation; no general evaluator or vault action is exposed',()=>{
 assert.match(native,/CFBundleVersion"\) as\? String == "13"/);
 assert.match(native,/Bundle\.main\.bundleIdentifier == "com\.gridlygo\.gridly"/);
 assert.match(native,/title: "Keep saved retry", style: \.cancel/);
 assert.match(native,/title: "Forget saved retry", style: \.destructive/);
 assert.match(native,/target\.url == url, !target\.isLoading/);
 assert.match(native,/arguments: \["action": "clear", "expected": raw\]/);
 assert.equal((script.match(/localStorage\.removeItem\(KEY\)/g)||[]).length,1);
 assert.doesNotMatch(script,/\bawait\b|\.setItem\(|\.clear\(|\.rpc\(|\bfetch\(|\.retry\(|\.submit\(|\.cancel\(/);
 assert.doesNotMatch(native,/isInspectable|webContentsDebuggingEnabled|SecItem|StoreKit\.sync|print\(|console\./);
 assert.match(native,/attempt < 60/);assert.match(native,/private static let legacyRecoveryScript/);
});
