import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {LAUNCH, verifyAuthorityProof, accessDecision, createEntitlementSession} from '../js/gridly-entitlement.mjs';

const now=Date.parse('2026-09-26T20:00:00.000Z');
const nonce='a'.repeat(48);
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const iso=ms=>new Date(ms).toISOString();
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function row(overrides={}) {return {platform:'apple',productId:LAUNCH.appleProductId,subscriptionState:'active',entitlementState:'entitled',
 currentPeriodEnd:iso(now+86400000),lastVerifiedAt:iso(now),verificationSource:'gridly_server_store_api',environment:'production',restoreAvailable:true,
 errorCategory:'none',nonce,audience:'com.gridlygo.gridly',expiresAt:iso(now+300000),...overrides};}
async function sign(body,header={alg:'ES256',typ:'gridly-entitlement-v1'}) {const input=encode(header)+'.'+encode(body);const sig=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,Buffer.from(input));return input+'.'+Buffer.from(sig).toString('base64url');}
const verify=(proof,options={})=>verifyAuthorityProof({proof,publicKey:keys.publicKey,nonce,platform:'apple',now,crypto:webcrypto,...options});
test('one monthly contract; no free tier/trial/annual/grace/web offer',()=>{
 assert.equal(LAUNCH.appleProductId,'com.gridlygo.gridly.monthly');assert.equal(LAUNCH.googleProductId,'gridly_monthly');assert.equal(LAUNCH.googleBasePlanId,'monthly');
 for(const key of ['freeTier','trial','annualPlan','billingGrace','webCheckout'])assert.equal(LAUNCH[key],false);
 assert.equal(LAUNCH.monthlyPrice,'2.99');assert.equal(LAUNCH.country,'US');
});
test('active and canceled pending expiry require genuine signed, unexpired authority',async()=>{
 for(const state of ['active','canceled_pending_expiry']){const snapshot=await verify(await sign(row({subscriptionState:state})));
 assert.equal(accessDecision(snapshot,{platform:'apple',now}).allowed,true);
 assert.equal(accessDecision({...snapshot},{platform:'apple',now}).allowed,false);
 assert.equal(accessDecision(snapshot,{platform:'apple',now:now+300000}).allowed,false);
 assert.equal(accessDecision(snapshot,{platform:'apple',now:now-1}).allowed,false);}
});
test('inactive/expired/unknown never unlock and transient state differs from non-entitlement',async()=>{
 for(const state of ['inactive','expired','unknown']){const snapshot=await verify(await sign(row({subscriptionState:state,
 entitlementState:state==='unknown'?'unknown':'not_entitled',currentPeriodEnd:state==='expired'?iso(now-1):null,errorCategory:state==='unknown'?'network_unavailable':'none'})));
 assert.equal(snapshot.subscriptionState,state);assert.equal(accessDecision(snapshot,{platform:'apple',now}).allowed,false);}
});
test('tamper, wrong key, unsigned input, raw local state and extra receipt fields are rejected',async()=>{
 const good=await sign(row());const badKey=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 for(const [proof,options] of [[good.replace(good.split('.')[1],encode(row({entitlementState:'not_entitled'}))),{}],[good,{publicKey:badKey.publicKey}],
 [JSON.stringify(row()),{}],[await sign(row({receipt:'sensitive-fixture'})),{}],[await sign(row(),{alg:'none',typ:'gridly-entitlement-v1'}),{}]]) {
 const result=await verify(proof,options);assert.equal(result.errorCategory,'invalid_authority');assert.equal(accessDecision(result,{platform:'apple',now}).allowed,false);}
 assert.equal(accessDecision(row(),{platform:'apple',now}).allowed,false);
});
test('nonce/product/platform/environment/audience/lease/state inconsistencies fail closed',async()=>{
 const negatives=[{nonce:'b'.repeat(48)},{productId:'annual'},{platform:'google'},{environment:'sandbox/test'},{audience:'other'},
 {lastVerifiedAt:iso(now+1)},{expiresAt:iso(now)},{expiresAt:iso(now+300001)},{currentPeriodEnd:null},{currentPeriodEnd:iso(now)},
 {subscriptionState:'inactive'},{restoreAvailable:false},{verificationSource:'client'},{errorCategory:'raw sensitive error'},
 {currentPeriodEnd:iso(now+1000),expiresAt:iso(now+300000)}];
 for(const override of negatives)assert.equal((await verify(await sign(row(override)))).errorCategory,'invalid_authority');
});
test('Google shares identical entitlement rules and sandbox cannot unlock production',async()=>{
 const proof=await sign(row({platform:'google',productId:LAUNCH.googleProductId,environment:'sandbox/test'}));
 const snapshot=await verify(proof,{platform:'google',environment:'sandbox/test'});
 assert.equal(accessDecision(snapshot,{platform:'google',environment:'sandbox/test',now}).allowed,true);
 assert.equal(accessDecision(snapshot,{platform:'google',now}).allowed,false);
 assert.equal(accessDecision(snapshot,{platform:'web',now}).allowed,false);
});
test('all enumerated legal/privacy/support/deletion/emergency surfaces remain open; arbitrary feature names do not',()=>{
 for(const surface of ['legal','privacy','terms','community_guidelines','support','delete_data','emergency'])assert.equal(accessDecision(null,{platform:'web',surface}).allowed,true);
 for(const surface of ['map','reports','settings','onboarding_complete','debug'])assert.equal(accessDecision(null,{platform:'web',surface}).allowed,false);
});
function ports(overrides={}) {
 const calls=[];
 const bridge={lookupProduct:async options=>({ ...options,displayPrice:'$2.99',currency:'USD',priceMicros:2990000,billingPeriod:'P1M',storefront:'US',hasOffer:false }),
 queryPurchases:async options=>{calls.push(['query',options]);return options.productId===LAUNCH.appleProductId ? {signedTransactions:['synthetic.payload.signature']} : {purchaseTokens:['synthetic-google-token']};},
 restore:async options=>{calls.push(['restore',options]);return options.productId===LAUNCH.appleProductId ? {signedTransactions:['synthetic.payload.signature']} : {purchaseTokens:['synthetic-google-token']};},
 purchase:async options=>{calls.push(['purchase',options]);return options.productId===LAUNCH.appleProductId ? {signedTransactions:['synthetic.payload.signature']} : {purchaseTokens:['synthetic-google-token']};},
 completeVerifiedPurchase:async()=>{calls.push(['complete']);},...overrides};
 const authority={reconcile:async request=>{calls.push(['reconcile']);return sign(row({nonce:request.nonce,platform:request.platform,productId:request.platform==='apple'?LAUNCH.appleProductId:LAUNCH.googleProductId,environment:request.environment}));}};
 return {bridge,authority,calls};
}
const session=p=>createEntitlementSession({platform:'apple',publicKey:keys.publicKey,now:()=>now,crypto:webcrypto,...p});
test('launch/resume/restore/purchase always reconcile; completion only after authority',async()=>{
 const p=ports(),s=session(p);assert.equal(s.allowed('product').allowed,false);
 for(const method of ['launch','resume','restore','purchase']){await s[method]();assert.equal(s.allowed('product').allowed,true);}
 assert.deepEqual(p.calls.map(c=>c[0]),['query','reconcile','complete','query','reconcile','complete','restore','reconcile','complete','purchase','reconcile','complete']);
 const google=ports();await createEntitlementSession({platform:'google',publicKey:keys.publicKey,now:()=>now,crypto:webcrypto,...google}).restore();
 assert.deepEqual(google.calls[0][1],{productId:'gridly_monthly',basePlanId:'monthly'});
});
test('temporary error does not become confirmed inactive, exposes no raw receipt/error and retry recovers',async()=>{
 let fail=true;const p=ports({queryPurchases:async()=>{if(fail)throw Error('sensitive-fixture');return {signedTransactions:['synthetic.payload.signature']};}}),s=session(p);
 await s.launch();assert.equal(s.read().entitlementState,'unknown');assert.equal(s.read().errorCategory,'store_unavailable');
 assert.ok(!JSON.stringify(s.read()).includes('sensitive-fixture'));assert.equal(s.allowed('support').allowed,true);
 fail=false;await s.refresh();assert.equal(s.allowed('product').allowed,true);
});
test('pending/canceled purchases do not complete or reconcile and cannot unlock',async()=>{
 for(const outcome of [{pending:true},{canceled:true}]){const p=ports({purchase:async()=>outcome}),s=session(p);await s.purchase();assert.equal(s.allowed('product').allowed,false);assert.deepEqual(p.calls,[]);}
 const p=ports();p.authority.reconcile=async()=>JSON.stringify(row());await session(p).purchase();assert.ok(!p.calls.some(c=>c[0]==='complete'));
});
test('slow old refresh cannot override current denial; timeout cannot unlock later',async()=>{
 let release;const p=ports({queryPurchases:()=>new Promise(resolve=>{release=resolve;})}),s=session({...p,timeoutMs:5});
 await s.launch();assert.equal(s.allowed('product').allowed,false);release({signedTransactions:['synthetic.payload.signature']});await new Promise(r=>setTimeout(r,15));
 assert.equal(s.allowed('product').allowed,false);assert.ok(!p.calls.some(c=>c[0]==='complete'));
 let unblock;const q=ports();let first=true;q.authority.reconcile=async request=>{if(first){first=false;await new Promise(r=>{unblock=r;});return sign(row({nonce:request.nonce}));}return sign(row({nonce:request.nonce,subscriptionState:'inactive',entitlementState:'not_entitled',currentPeriodEnd:null}));};
 const x=session(q);const old=x.launch();while(!unblock)await new Promise(r=>setTimeout(r,0));await x.resume();unblock();await old;assert.equal(x.read().entitlementState,'not_entitled');
});
test('product lookup redacts extra fields and rejects unexpected plan/price/offer',async()=>{
 const p=ports(),s=session(p);const display=await s.lookupProduct();assert.deepEqual(Object.keys(display),['available','productId','displayPrice']);
 for(const overrides of [{hasOffer:true},{billingPeriod:'P1Y'},{displayPrice:'token'},{priceMicros:0},{storefront:'CA'}]) {
 const q=ports({lookupProduct:async()=>({productId:LAUNCH.appleProductId,displayPrice:'$2.99',currency:'USD',priceMicros:2990000,billingPeriod:'P1M',storefront:'US',hasOffer:false,...overrides})});assert.equal((await session(q).lookupProduct()).available,false);}
});
test('no production wiring, dependency changes, authority via storage or reporting activation',()=>{
 const source=readFileSync(new URL('../js/gridly-entitlement.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|console\.|service_role|reporting_enabled\s*[:=]\s*true/);
 assert.doesNotMatch(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/gridly-entitlement/);
 assert.match(readFileSync(new URL('../js/app.js',import.meta.url),'utf8'),/GRIDLY_WELCOME_TOTAL_STEPS = 7/);
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));assert.equal(pkg.dependencies['@capacitor/core'],'8.3.4');
});
