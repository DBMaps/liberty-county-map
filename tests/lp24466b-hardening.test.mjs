import {test} from 'node:test';import assert from 'node:assert/strict';import {webcrypto as crypto} from 'node:crypto';
import {tokenCipher,acknowledgmentQueue} from '../supabase/functions/_shared/entitlement/acknowledgment.mjs';
import {normalizeGoogle,cacheRecord} from '../supabase/functions/_shared/entitlement/core.mjs';
import {googleAdapter} from '../supabase/functions/_shared/entitlement/providers.mjs';
import {createSubscriptionOperations} from '../supabase/functions/_shared/entitlement/operations.mjs';
import {acknowledgmentHealth} from '../supabase/functions/_shared/entitlement/ack-health.mjs';
import {runSubscriptionMonitor,projectSubscriptionHealth} from '../tools/retention/cleanup-alert-worker/subscription-monitor.mjs';
const now=Date.now(),version='v2',old='v1',token='synthetic-rotation-token',fp='a'.repeat(64);
const key=()=>crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);const k=await key(),previousKey=await key(),hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const cipher=tokenCipher({current:{version,key:k},previous:{version:old,key:previousKey,retireAt:new Date(now+3600000).toISOString()},crypto,now:()=>now});
test('current, previous and new writes; randomized ciphertext/auth tag; bounded rotation',async()=>{
 const oldCipher=tokenCipher({current:{version:old,key:previousKey},crypto}),oldRow=await oldCipher.seal(token,'production',fp),row=await cipher.seal(token,'production',fp);
 assert.equal(row.key_version,version);assert.equal(await cipher.open(row),token);assert.equal(await cipher.open(oldRow),token);
 assert.notEqual((await cipher.seal(token,'production',fp)).ciphertext,row.ciphertext);
 for(const change of [{key_version:'unknown'},{key_version:old},{iv:'bad'},{ciphertext:'A'.repeat(40)},{environment:'sandbox_test'}])await assert.rejects(()=>cipher.open({...row,...change}));
 const noPrevious=tokenCipher({current:{version,key:k},crypto});await assert.rejects(()=>noPrevious.open(oldRow),/key_version_unavailable/);
 assert.throws(()=>tokenCipher({current:{version},crypto}),/configuration_unavailable/);
 for(const retireAt of [new Date(now-1).toISOString(),new Date(now+3600001).toISOString()])assert.throws(()=>tokenCipher({current:{version,key:k},previous:{version:old,key:previousKey,retireAt},crypto,now:()=>now}));
 let clock=now;const rotating=tokenCipher({current:{version,key:k},previous:{version:old,key:previousKey,retireAt:new Date(now+1000).toISOString()},crypto,now:()=>clock});clock+=1001;await assert.rejects(()=>rotating.open(oldRow));
});
const data=patch=>({regionCode:'US',startTime:new Date(now-1000).toISOString(),subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:'gridly_monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(now+86400000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...patch});
const record=patch=>normalizeGoogle(data(patch),{env:patch?.testPurchase?'sandbox/test':'production',token,now});
test('stable provider grant deadline caps hour and sandbox; cancellation pending is not expiry',()=>{
 assert.equal(Date.parse(record().ackDeadlineAt),now-1000+3600000);assert.equal(Date.parse(record({testPurchase:{}}).ackDeadlineAt),now-1000+180000);
 const canceled=record({subscriptionState:'SUBSCRIPTION_STATE_CANCELED'});assert.equal(canceled.entitlementState,'entitled');assert.equal(canceled.terminalCategory,null);
 assert.throws(()=>record({startTime:undefined}));assert.throws(()=>record({startTime:new Date(now+1).toISOString()}));
 const expired=record({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{...data().lineItems[0],expiryTime:new Date(now-1).toISOString()}]});assert.equal(expired.terminalCategory,'subscription_expired');
});
test('HTTP credential and permanent invalid purchase categories never expose bodies; ambiguous failures retry',async()=>{
 for(const [status,category] of [[401,'credential_unavailable'],[403,'credential_unavailable'],[410,'invalid_purchase'],[400,'provider_unavailable'],[404,'provider_unavailable'],[503,'provider_unavailable']]){
  const adapter=googleAdapter({accessToken:async()=> 'synthetic',env:'production',fetchImpl:async()=>new Response(token,{status})});await assert.rejects(()=>adapter.verify(token),e=>e.message===category&&!e.message.includes(token));
 }
});
test('OAuth 401 is credential failure; OAuth 503 is transient provider outage',async()=>{
 const {googleServiceAccessToken}=await import('../supabase/functions/_shared/entitlement/google-oauth.mjs');
 const rsa=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['sign','verify']);
 for(const [status,category] of [[401,'credential_unavailable'],[503,'provider_unavailable']]){
  const get=googleServiceAccessToken({clientEmail:'synthetic@synthetic.iam.gserviceaccount.com',privateKey:rsa.privateKey,crypto,fetchImpl:async()=>new Response(token,{status})});
  await assert.rejects(get,e=>e.message===category&&!e.message.includes(token));
 }
});
test('success/terminal erase work; outage/credential retain original deadline; stale leases do not ACK',async()=>{
 for(const kind of ['success','denial','cipher','key','deadline','provider','credential','lease']){
  const cached=await cacheRecord(record(),hmac,crypto);let saved={...await cipher.seal(token,'production',cached.chain_fingerprint),lease:'synthetic',lease_until:new Date(now+(kind==='lease'?8000:60000)).toISOString(),expires_at:new Date(now+(kind==='deadline'?-1:3600000)).toISOString()},resolution,acks=0;
  if(kind==='cipher')saved.ciphertext='malformed';if(kind==='key')saved.key_version='unknown';
  const expiry=saved.expires_at,store={enqueue:async()=>true,claim:async()=>saved?[saved]:[],resolve:async x=>{resolution=x;if(x.outcome!=='retry')saved=null;return true;}},provider={verify:async()=>{if(['provider','credential'].includes(kind))throw Error(kind==='credential'?'credential_unavailable':'provider_unavailable');return kind==='denial'?record({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{...data().lineItems[0],expiryTime:new Date(now-1).toISOString()}]}):record();},acknowledge:async()=>{acks++;}};
  const q=acknowledgmentQueue({environment:'production',store,cipher,provider,cache:{apply:async()=>true},fingerprintKey:hmac,crypto,now:()=>now});const [result]=await q.drain();
  if(['provider','credential','lease'].includes(kind)){assert.equal(result.outcome,'retry');assert.equal(saved.expires_at,expiry);assert.equal(acks,0);}else {assert.equal(saved,null);assert.equal(result.outcome,kind==='success'?'success':'terminal');if(kind!=='success')assert.equal(acks,0);}
  assert.ok(!JSON.stringify(result).includes(token));assert.ok(!JSON.stringify(result).includes(cached.chain_fingerprint));assert.equal(resolution.chain_fingerprint,cached.chain_fingerprint);
 }
});
const healthRow=patch=>({environment:'production',subsystem:'google_ack',last_completed_at:new Date(now).toISOString(),last_purge_at:new Date(now).toISOString(),pending_count:0,due_count:0,failed_count:0,stale_count:0,overdue_count:0,expired_count:0,terminal_count:0,oldest_pending_age_seconds:0,error_category:'none',...patch});
test('completed worker and independent purge signals; scheduler silence never healthy',()=>{
 for(const [patch,state] of [[{},'healthy'],[{last_completed_at:null},'monitor_error'],[{last_completed_at:new Date(now-90001).toISOString()},'monitor_error'],[{last_purge_at:new Date(now-120001).toISOString()},'monitor_error'],[{terminal_count:1},'failed'],[{overdue_count:1},'overdue'],[{stale_count:1},'stale'],[{error_category:'credential_unavailable'},'failed']])assert.equal(acknowledgmentHealth(healthRow(patch),{now}).health_state,state);
});
test('operations authenticates fixed empty POST; safe bounded response; failure does not mark completion',async()=>{
 let calls=0,completions=0,fail=false;const auth='1'.repeat(64),store={completeRun:async()=>{completions++;return true;},health:async()=>[healthRow(),healthRow({environment:'sandbox_test'})]},handler=createSubscriptionOperations({token:auth,crypto,now:()=>now,store,retryGoogle:async()=>{calls++;if(fail)throw Error(token);return [{outcome:'success',category:'none',completed:true,token,ciphertext:'private'}];}});
 const request=(header=auth,body)=>new Request('https://example.invalid/functions/v1/gridly-subscription-ops',{method:'POST',headers:{'X-Gridly-Subscription-Ops-Token':header},...(body?{body}:{})});
 assert.equal((await handler(request('2'.repeat(64)))).status,401);assert.equal((await handler(request(auth,'{}'))).status,400);assert.equal(calls,0);
 const result=await handler(request());assert.equal(result.status,200);const text=await result.text();assert.ok(!text.includes(token)&&!text.includes('private'));assert.equal(completions,1);
 fail=true;assert.equal((await handler(request())).status,503);assert.equal(completions,1);
 const closed=createSubscriptionOperations({token:auth,store,retryGoogle:null});assert.deepEqual(await (await closed(request())).json(),{error:'configuration_unavailable'});
});
function monitorFixture(){const values=new Map(),emails=[],pings=[];let clock=now,patch={},deliveryFail=false,edgeFail=false,configError=false;const env={SUBSCRIPTION_OPS_URL:'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-subscription-ops',GRIDLY_SUBSCRIPTION_OPS_TOKEN:'1'.repeat(64),RESEND_API_KEY:'synthetic',ALERT_FROM:'Gridly Alerts <monitor@alerts.gridlygo.com>',ALERT_TO:'developer@gridlygo.com',SUBSCRIPTION_DEADMAN_PING_URL:'https://hc-ping.com/11111111-1111-1111-1111-111111111111',ALERT_STATE:{get:async k=>values.get(k)||null,put:async(k,v,options)=>{assert.equal(options.expirationTtl,604800);values.set(k,v);},delete:async k=>values.delete(k)}};
 const fetchImpl=async(url,options)=>{if(url===env.SUBSCRIPTION_OPS_URL){assert.equal(options.method,'POST');assert.equal(options.body,undefined);assert.equal(options.headers.Authorization,undefined);if(edgeFail)throw Error(token);if(configError)return Response.json({error:'configuration_unavailable'},{status:503});return Response.json({checked:0,acknowledged:0,retried:0,terminal:0,health:{...acknowledgmentHealth(healthRow({...patch,last_completed_at:new Date(clock).toISOString(),last_purge_at:new Date(clock).toISOString()}),{now:clock}),token,ciphertext:'private'}});}if(url==='https://api.resend.com/emails'){emails.push(options);if(deliveryFail)throw Error(token);return Response.json({id:'11111111-1111-1111-1111-111111111111'});}pings.push(url);return new Response(null,{status:200});};
 return {env,values,emails,pings,run:()=>runSubscriptionMonitor({env,fetchImpl,crypto,now:()=>clock}),patch:x=>patch=x,clock:x=>clock=x,delivery:x=>deliveryFail=x,edge:x=>edgeFail=x,config:x=>configError=x};}
test('monitor healthy no email, failure dedup/reminder, recovery and redaction',async()=>{
 const s=monitorFixture();await s.run();assert.equal(s.emails.length,0);assert.equal(s.values.size,0);assert.equal(s.pings.length,1);
 s.patch({failed_count:1});await s.run();await s.run();assert.equal(s.emails.length,1);assert.ok(!s.emails[0].body.includes(token)&&!s.emails[0].body.includes('private'));s.clock(now+3600001);await s.run();assert.equal(s.emails.length,2);
 s.patch({});await s.run();assert.equal(s.emails.length,3);assert.equal(s.values.size,0);
});
test('lost email response uses identical redacted body/idempotency; failed run does not heartbeat',async()=>{
 const s=monitorFixture();s.patch({failed_count:1});s.delivery(true);await assert.rejects(s.run);assert.equal(s.pings.length,0);const first=s.emails[0];s.clock(now+60000);s.delivery(false);await s.run();assert.equal(s.emails[1].body,first.body);assert.equal(s.emails[1].headers['Idempotency-Key'],first.headers['Idempotency-Key']);
 s.edge(true);const before=s.pings.length;await assert.rejects(s.run);assert.equal(s.pings.length,before);assert.ok(!s.emails.at(-1).body.includes(token));
});

test('review-only rollback and Cron copies fail unconditionally before operations; migrations exclude old production state',async()=>{
 const {readFileSync}=await import('node:fs');
 for(const f of ['LP24466B-ACKNOWLEDGMENT-ROLLBACK-REVIEW.sql','LP24466B-CACHE-ROLLBACK-REVIEW.sql','LP24466B-SCHEDULER-REVIEW.sql']){
  const s=readFileSync(new URL('../docs/launch/review/'+f,import.meta.url),'utf8');const guard=s.indexOf("RAISE EXCEPTION 'LP24466B_REVIEW_ONLY_NOT_AUTHORIZED'");assert.ok(s.indexOf('BEGIN;')<guard&&guard<s.indexOf('COMMIT;'));assert.doesNotMatch(s,/^\s*DROP[^;]*\bCASCADE\b/im);assert.doesNotMatch(s,/migration repair|reporting_enabled\s*=/i);
 }
 for(const f of ['20260926205345_lp24462_store_entitlement_cache.sql','20260927204849_lp24466_google_acknowledgment_queue.sql']){
  const s=readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8');assert.doesNotMatch(s,/\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA)|\bALTER DEFAULT PRIVILEGES|\bcron\.schedule|\breporting_enabled\s*=/i);
 }
});
test('combined Worker settles cleanup and subscription independently; active cleanup entrypoint unchanged',async()=>{
 const {readFileSync}=await import('node:fs');const s=readFileSync(new URL('../tools/retention/cleanup-alert-worker/combined-worker.mjs',import.meta.url),'utf8');assert.match(s,/Promise\.allSettled/);assert.match(s,/cleanupWorker\.scheduled/);assert.match(s,/runSubscriptionMonitor/);
});

test('missing required key/config surfaces safe owner category and withholds dead-man ping',async()=>{
 const s=monitorFixture();s.config(true);await assert.rejects(s.run,/subscription_monitor_failed/);assert.equal(s.pings.length,0);assert.equal(s.emails.length,1);const body=JSON.parse(s.emails[0].body);assert.match(body.text,/configuration_unavailable/);assert.ok(!s.emails[0].body.includes(token));
});
