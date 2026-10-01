import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';
import {verifyContinuity,continuityDecision,CONTINUITY_MS} from '../js/gridly-continuity.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';
import {normalizeApple,normalizeGoogle,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
import {createHandler} from '../supabase/functions/_shared/entitlement/handler.mjs';
import {createAppleVerificationAuthority} from '../js/gridly-apple-storekit.mjs';
import {createGoogleVerificationAuthority} from '../js/gridly-google-play-billing.mjs';
const initial=Date.parse('2026-09-27T20:00:00Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const nonce='n'.repeat(40),binding='a'.repeat(64);
const appleRecord=({at=initial,end=at+7*86400000,state='active',env='production'}={})=>normalizeApple({bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:env==='production'?'Production':'Sandbox',originalTransactionId:'fixture-chain',expiresDate:end,...(state==='revoked'?{revocationDate:at}:{})},
 {originalTransactionId:'fixture-chain',productId:'com.gridlygo.gridly.monthly',environment:env==='production'?'Production':'Sandbox',autoRenewStatus:state==='canceled'?0:1},state==='revoked'?5:state==='expired'?2:1,{env,originalReference:'fixture-chain',now:at});
async function bundle(record=appleRecord(),bind=binding) {
 const proof=await signResponse(record,nonce,keys.privateKey,webcrypto,{continuityBinding:bind});
 const row=await verifyAuthorityProof({proof,nonce,publicKey:keys.publicKey,platform:record.platform,environment:record.environment,now:Date.parse(record.lastVerifiedAt),crypto:webcrypto});
 return {proof,row,token:row.continuityAuthorization};
}
const verify=(proof,patch={})=>verifyContinuity({proof,publicKey:keys.publicKey,binding,platform:'apple',now:initial,crypto:webcrypto,...patch});
function fixture(platform='apple') {
 let at=initial,mode='active',periodEnd=initial+7*86400000,tick=0,clockTrusted=true,failWrite=false,nativeRevoked=false;
 let stored={binding,proof:'',verifiedAt:0,blocked:false},seq=0;const timers=new Map(),events=[];
 const vault={
  beginVerification:async()=>{events.push('begin');const ready=!stored.blocked&&clockTrusted;stored.blocked=true;stored.attempt=String(++seq);stored.recoverable=ready;return {binding:stored.binding,proof:ready?stored.proof:'',attempt:stored.attempt,clockTrusted:ready,nowMs:at};},
  commit:async value=>{events.push('commit');if(failWrite)throw Error();assert.equal(value.attempt,stored.attempt);assert.ok(value.verifiedAt>=stored.verifiedAt);stored={...stored,...value,blocked:false};return {saved:true};},
  retain:async value=>{events.push('retain');if(failWrite)throw Error();assert.equal(value.attempt,stored.attempt);if(stored.recoverable)stored.blocked=false;return {retained:!stored.blocked};},
  revoke:async value=>{events.push('revoke');if(failWrite)throw Error();assert.equal(value.attempt,stored.attempt);stored={binding:(seq%2?'b':'c').repeat(64),proof:'',verifiedAt:0,blocked:false};return {revoked:true};}
 };
 const native=()=>platform==='apple'?{result:'verified',productId:'com.gridlygo.gridly.monthly',environment:'production',completionHandle:'fixture-handle',signedTransaction:'fixture.payload.signature',revoked:nativeRevoked}
  :{result:'purchased',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',purchaseToken:'fixture-private-token'};
 const plugin={addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},getProducts:async()=>({result:'error'}),getCurrentEntitlement:async()=>native(),refreshEntitlement:async()=>native(),queryCurrentPurchases:async()=>native(),purchase:async()=>native(),restorePurchases:async()=>native(),finishTransaction:async()=>({finished:true})};
 const authority={reconcile:async request=>{
  events.push('server');if(mode==='outage')throw Error('private-provider-error');if(mode==='denied')throw Error('authority_denied');if(mode==='tampered')return 'forged.payload.signature';
  const record=platform==='apple'?appleRecord({at,end:mode==='expired'?at-1:periodEnd,state:mode})
   :normalizeGoogle({regionCode:'US',subscriptionState:mode==='expired'?'SUBSCRIPTION_STATE_EXPIRED':mode==='revoked'?'SUBSCRIPTION_STATE_ON_HOLD':'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',lineItems:[{productId:'com.gridlygo.gridly.monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(mode==='expired'?at-1:periodEnd).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]},{env:'production',token:'fixture-private-token',now:at});
  return signResponse(record,request.nonce,keys.privateKey,webcrypto,{continuityBinding:request.continuityBinding});
 }};
 const options={capacitor:{isNativePlatform:()=>true,getPlatform:()=>platform==='apple'?'ios':'android'},plugin,authority,publicKey:keys.publicKey,continuityVault:vault,crypto:webcrypto,now:()=>at,monotonic:()=>tick,schedule:(fn,delay)=>{const id=++seq;timers.set(id,{fn,delay});return id;},cancel:id=>timers.delete(id)};
 return {options,events,timers,plugin,create:()=>createPaidAccess(options),mode:value=>{mode=value;},advance:ms=>{at+=ms;tick+=ms;},period:value=>{periodEnd=initial+value;},record:()=>({...stored}),inject:patch=>{stored={...stored,...patch};},rollback:()=>{at-=3600000;clockTrusted=false;},writeFailure:()=>{failWrite=true;},nativeRevoke:()=>{nativeRevoked=true;},reinstall:()=>{stored={binding:'d'.repeat(64),proof:'',verifiedAt:0,blocked:false};}};
}

test('durable authorization is exactly 24 hours; freshness is not subscription expiration',async()=>{
 const {row,token}=await bundle();const durable=await verify(token);
 assert.equal(Date.parse(durable.continuityExpiresAt)-Date.parse(durable.lastVerifiedAt),CONTINUITY_MS);
 assert.equal(accessDecision(row,{platform:'apple',now:initial+300000}).reason,'verification_required');
 assert.equal(continuityDecision(durable,{platform:'apple',now:initial+300000}),true);
 assert.equal(durable.subscriptionState,'active');
 assert.equal(continuityDecision(durable,{platform:'apple',now:initial+CONTINUITY_MS}),false);
 assert.equal(await verify(token,{now:initial+CONTINUITY_MS+1}),null);
});
test('verified period end is a hard ceiling, including a period shorter than 24 hours',async()=>{
 const end=initial+3600000,{token}=await bundle(appleRecord({end}));const row=await verify(token);
 assert.equal(Date.parse(row.continuityExpiresAt),end);assert.equal(continuityDecision(row,{platform:'apple',now:end}),false);
 assert.equal(await verify(token,{now:end+1}),null);
});
test('only fresh ACTIVE provider evidence mints continuity; cancellation/denial/expiry do not',async()=>{
 for(const state of ['canceled','revoked','expired']) {const record=appleRecord({state,end:state==='expired'?initial-1:initial+86400000});assert.equal((await bundle(record)).token,undefined);}
});
for(const platform of ['apple','google']) {
 test(platform+': restart outage continuity, no extension on repeated failures, 24-hour stop',async()=>{
  const f=fixture(platform),first=f.create();assert.equal((await first.start()).allowed,true);const original=f.record();await first.stop();
  f.mode('outage');f.advance(3600000);const second=f.create();assert.equal((await second.start()).allowed,true);assert.equal(second.read().temporaryAccess,true);
  assert.equal(f.record().proof,original.proof);assert.equal(f.record().verifiedAt,original.verifiedAt);
  let loaded=false;await second.initializeRuntime(()=>{loaded=true;});assert.equal(loaded,true);
  f.advance(CONTINUITY_MS-3600000);assert.equal(second.allowed(),false);assert.equal((await second.refresh()).allowed,false);assert.notEqual(second.read().state,'not_entitled');await second.stop();
 });
 test(platform+': short period stops continuity before the 24-hour maximum',async()=>{
  const f=fixture(platform);f.period(3600000);const c=f.create();await c.start();f.mode('outage');f.advance(300001);assert.equal((await c.refresh()).allowed,true);
  f.advance(3600000-300001);assert.equal(c.allowed(),false);assert.equal((await c.refresh()).allowed,false);await c.stop();
 });
 for(const denied of ['revoked','expired','denied','tampered'])test(platform+': '+denied+' overrides cached continuity and survives restart',async()=>{
  const f=fixture(platform),c=f.create();await c.start();f.advance(600000);f.mode(denied);
  assert.equal((await c.refresh()).allowed,false);assert.equal(f.record().proof,'');await c.stop();f.mode('outage');const restart=f.create();assert.equal((await restart.start()).allowed,false);await restart.stop();
 });
 test(platform+': successful re-verification resets duration from new authoritative time',async()=>{
  const f=fixture(platform),c=f.create();await c.start();const prior=f.record();f.advance(3600000);await c.refresh();const fresh=f.record();
  assert.equal(fresh.verifiedAt-prior.verifiedAt,3600000);assert.notEqual(fresh.proof,prior.proof);await c.stop();f.mode('outage');f.advance(23*3600000+1);const restart=f.create();assert.equal((await restart.start()).allowed,true);await restart.stop();
 });
 test(platform+': reinstall, old-record copy and native active hint cannot recover offline ownership',async()=>{
  const f=fixture(platform),c=f.create();await c.start();const old=f.record();await c.stop();f.reinstall();f.inject({proof:old.proof});f.mode('outage');
  const reinstall=f.create();assert.equal((await reinstall.start()).allowed,false);await reinstall.stop();f.mode('active');const recovered=f.create();assert.equal((await recovered.restore()).allowed,true);assert.notEqual(f.record().proof,old.proof);await recovered.stop();
 });
}
test('Apple native cryptographically verified revoked flag immediately invalidates even if server is unavailable',async()=>{
 const f=fixture(),c=f.create();await c.start();const states=[];c.subscribe(row=>states.push(row));f.nativeRevoke();f.mode('outage');
 assert.equal((await c.refresh()).allowed,false);assert.equal(f.record().proof,'');assert.ok(states.some(row=>row.state==='not_entitled'&&!row.allowed));await c.stop();
});
test('tampered, unsigned, inappropriate binding/platform/environment or unbranded authorization denied',async()=>{
 const {token}=await bundle();
 for(const proof of ['true',JSON.stringify({entitlementState:'entitled'}),token.slice(0,-5)+'AAAAA'])assert.equal(await verify(proof),null);
 for(const patch of [{binding:'f'.repeat(64)},{platform:'google'},{environment:'sandbox/test'},{now:initial-1}])assert.equal(await verify(token,patch),null);
 const sandbox=await bundle(appleRecord({env:'sandbox/test'}));assert.equal(await verify(sandbox.token),null);
 assert.equal(continuityDecision(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))),{platform:'apple',now:initial}),false);
});
test('even a signed overlong continuity claim is rejected',async()=>{
 const {token}=await bundle();const parts=token.split('.'),body=JSON.parse(Buffer.from(parts[1],'base64url'));
 body.continuityExpiresAt=new Date(initial+CONTINUITY_MS+1).toISOString();const input=parts[0]+'.'+Buffer.from(JSON.stringify(body)).toString('base64url');
 const signature=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(input));
 assert.equal(await verify(input+'.'+Buffer.from(signature).toString('base64url')),null);
});
test('native interrupted verification, clock rollback and persistence failure fail closed across restart',async()=>{
 for(const kind of ['interrupted','clock','write']) {
  const f=fixture(),c=f.create();await c.start();await c.stop();f.mode('outage');
  if(kind==='interrupted')f.inject({blocked:true});if(kind==='clock')f.rollback();if(kind==='write')f.writeFailure();
  const restart=f.create();assert.equal((await restart.start()).allowed,false,kind);await restart.stop();
 }
});
test('failed denial write leaves durable pending barrier and cannot revive old grant on restart',async()=>{
 const f=fixture(),c=f.create();await c.start();f.mode('revoked');f.writeFailure();assert.equal((await c.refresh()).allowed,false);assert.equal(f.record().blocked,true);await c.stop();
 const restart=f.create();f.mode('outage');assert.equal((await restart.start()).allowed,false);await restart.stop();
});
test('outages reverify every minute and preserve initialized runtime while valid; new connectivity can retry',async()=>{
 const f=fixture(),c=f.create();await c.start();f.advance(300000);f.mode('outage');assert.equal((await c.refresh()).allowed,true);
 assert.equal([...f.timers.values()][0].delay,60000);const states=[];c.subscribe(row=>states.push(row));await c.refresh();assert.ok(states.every(row=>row.allowed));
 f.mode('active');assert.equal((await c.resume()).allowed,true);await c.stop();assert.match(readFileSync('js/gridly-paid-ui.mjs','utf8'),/addEventListener\('online',connectivity\)/);
});
test('store observation failure can use a valid signed restart record without native hints',async()=>{
 const f=fixture(),c=f.create();await c.start();await c.stop();f.advance(600000);f.plugin.startObserving=async()=>{throw Error();};const restart=f.create();assert.equal((await restart.start()).allowed,true);await restart.stop();
});
test('localStorage and web/PWA cannot supply continuity; public legal routes remain open',async()=>{
 const {token}=await bundle();globalThis.localStorage={getItem:()=>token};
 try {const f=fixture();f.mode('outage');const c=f.create();assert.equal((await c.start()).allowed,false);await c.stop();
  const web=createPaidAccess({...f.options,capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'web'}});assert.equal((await web.start()).allowed,false);await web.stop();
  for(const surface of ['privacy','terms','community_guidelines','support','delete_data'])assert.equal(accessDecision(null,{surface}).allowed,true);
 }finally{delete globalThis.localStorage;}
});
test('fixed Edge handler authenticates binding with body and signs durable authority only after provider/cache',async()=>{
 const hmac=await webcrypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);const events=[];
 const handler=createHandler({platform:'apple',crypto:webcrypto,authorizeNative:async({body})=>{events.push('auth');assert.equal(JSON.parse(body).continuityBinding,binding);return true;},provider:{verify:async()=>{events.push('provider');return appleRecord();}},cache:{apply:async()=>{events.push('cache');return true;}},signingKey:keys.privateKey,fingerprintKey:hmac});
 const req=()=>new Request('https://fixture.test/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'apple',environment:'production',nonce,productId:'com.gridlygo.gridly.monthly',evidence:{signedTransactions:['fixture.payload.signature']},continuityBinding:binding})});
 const response=await handler(req());assert.equal(response.status,200);assert.deepEqual(events,['auth','provider','cache']);const data=await response.json();assert.deepEqual(Object.keys(data),['proof']);
 const row=await verifyAuthorityProof({proof:data.proof,nonce,publicKey:keys.publicKey,platform:'apple',now:initial,crypto:webcrypto});assert.ok(await verify(row.continuityAuthorization));
});
test('explicit authenticated Edge 401/403 denial is bounded and distinguished from outage',async()=>{
 for(const [create,platform] of [[createAppleVerificationAuthority,'apple'],[createGoogleVerificationAuthority,'google']]) {
  const authority=create({invoke:async()=>({error:{context:{status:403}}})});await assert.rejects(()=>authority.reconcile({platform,environment:'production',nonce,evidence:platform==='apple'?{signedTransactions:['fixture.payload.signature']}:{purchaseTokens:['fixture-token']}}),/authority_denied/);
 }
});
test('native persistence source contracts: scoped Keychain, non-backed-up reinstall sentinel and authenticated Keystore encryption',()=>{
 const ios=readFileSync('ios/App/App/GridlyContinuityPlugin.swift','utf8'),android=readFileSync('android/app/src/main/java/com/gridlygo/gridly/GridlyContinuityPlugin.kt','utf8');
 assert.match(ios,/kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);assert.match(ios,/kSecAttrSynchronizable as String: false/);assert.match(ios,/isExcludedFromBackup = true/);assert.match(ios,/SecItemDelete\(query\(\)/);assert.match(ios,/KERN_BOOTTIME/);
 assert.match(android,/context.noBackupFilesDir/);assert.match(android,/AndroidKeyStore/);assert.match(android,/AES\/GCM\/NoPadding/);assert.match(android,/finishWrite/);assert.match(android,/SystemClock.elapsedRealtime/);assert.match(android,/BOOT_COUNT/);
 assert.doesNotMatch(ios+android,/print\(|Log\.|console\.|localStorage|signedTransaction|purchaseToken|reporting_enabled/);
 assert.match(readFileSync('ios/App/App/GridlyBridgeViewController.swift','utf8'),/registerPluginInstance\(GridlyContinuityPlugin\(\)\)/);
 assert.match(readFileSync('android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt','utf8'),/registerPlugin\(GridlyContinuityPlugin::class.java\)/);
 const project=readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');assert.equal((project.match(/A24465010000000000000001/g)||[]).length,2);assert.equal((project.match(/A24465010000000000000002/g)||[]).length,3);
});

// CAPPlugin already has ObjC load(); a private zero-argument helper collides in Swift.
test('iOS continuity helper cannot collide with CAPPlugin load lifecycle selector',()=>{
 const source=readFileSync('ios/App/App/GridlyContinuityPlugin.swift','utf8');
 assert.doesNotMatch(source,/\bfunc\s+load\s*\(\s*\)/);
 assert.doesNotMatch(source,/\btry[!?]?\s+(?:self\.)?load\s*\(\s*\)/);
 assert.match(source,/private func loadRecord\(\) throws -> Record/);
 assert.equal((source.match(/\btry loadRecord\(\)/g)||[]).length,4);
 assert.deepEqual([...source.matchAll(/CAPPluginMethod\(name: "([^"]+)"/g)].map(match=>match[1]),['beginVerification','commit','retain','revoke']);
 for(const method of ['beginVerification','commit','retain','revoke'])assert.match(source,new RegExp('@objc func '+method+'\\('));
});
