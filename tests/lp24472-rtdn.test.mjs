import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {googlePubSubAuthenticator} from '../supabase/functions/_shared/entitlement/rtdn-auth.mjs';
import {createGoogleRtdnHandler} from '../supabase/functions/_shared/entitlement/rtdn.mjs';
import {googleAdapter} from '../supabase/functions/_shared/entitlement/providers.mjs';
import {googleRtdnReceiptPorts} from '../supabase/functions/_shared/entitlement/rtdn-ports.mjs';
import {createGoogleRtdnRuntime} from '../supabase/functions/_shared/entitlement/rtdn-setup.mjs';
const now=Date.parse('2026-09-30T18:00:00.000Z');
const endpoint='https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-google-rtdn';
const subscription='projects/gridly-play-billing/subscriptions/gridly-google-rtdn';
const email='push@gridly-play-billing.iam.gserviceaccount.com';
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const rsa=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await webcrypto.subtle.exportKey('jwk',rsa.publicKey),kid:'synthetic-key',use:'sig',alg:'RS256'};
const hmac=await webcrypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
async function identity(patch={}){
 const header=b64({alg:'RS256',typ:'JWT',kid:'synthetic-key'});
 const body=b64({iss:'https://accounts.google.com',aud:endpoint,email,email_verified:true,sub:'123456789',iat:Math.floor(now/1000)-10,exp:Math.floor(now/1000)+3500,...patch});
 const input=header+'.'+body;
 const signature=await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',rsa.privateKey,new TextEncoder().encode(input));
 return input+'.'+Buffer.from(signature).toString('base64url');
}
const notice=(event,id='1234',patch={})=>({message:{data:Buffer.from(JSON.stringify({version:'1.0',packageName:'com.gridlygo.gridly',eventTimeMillis:String(now),...event,...patch})).toString('base64'),messageId:id},subscription});
const event=(type,token='synthetic-token')=>({subscriptionNotification:{version:'1.0',notificationType:type,purchaseToken:token}});
const google=(state='SUBSCRIPTION_STATE_ACTIVE',patch={})=>({regionCode:'US',packageName:'com.gridlygo.gridly',startTime:new Date(now-1000).toISOString(),
 subscriptionState:state,acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',lineItems:[{productId:'com.gridlygo.gridly.monthly',offerDetails:{basePlanId:'monthly'},
 expiryTime:new Date(state==='SUBSCRIPTION_STATE_EXPIRED'?now-1000:now+3600000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...patch});
async function request(body,token){
 token??=await identity();
 return new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
}
function setup({observations={['synthetic-token']:google()},providerFailure=null}={}){
 const rows=new Map(),states=[],lineages=[],calls=[],acks=[];
 const receipts={claim:async id=>{const row=rows.get(id);if(row?.state==='done'||row?.state==='terminal')return {status:row.state};
  if(row?.state==='processing')return {status:'busy'};const lease='00000000-0000-0000-0000-'+String(rows.size+1).padStart(12,'0');rows.set(id,{state:'processing',lease});return {status:'claimed',lease};},
  finish:async(id,lease,outcome,category)=>{const row=rows.get(id);if(row?.lease!==lease)return false;rows.set(id,{state:outcome,category});return true;}};
 const provider=googleAdapter({env:'auto',now:()=>now,accessToken:async()=> 'synthetic-oauth',fetchImpl:async(url,options)=>{
  calls.push({url,method:options.method});if(providerFailure?.value)throw Error('offline');
  const token=decodeURIComponent(url.split('/').at(-1));return observations[token]?Response.json(observations[token]):new Response(null,{status:410});}});
 const authenticate=googlePubSubAuthenticator({serviceAccountEmail:email,audience:endpoint,now:()=>now,crypto:webcrypto,fetchImpl:async()=>Response.json({keys:[jwk]})});
 const handler=createGoogleRtdnHandler({authenticate,subscription,receipts,provider,cache:{apply:async(row,lineage)=>{states.push(row);lineages.push(lineage);return true;}},
  ackQueues:{production:{ensure:async args=>{acks.push(args.record);return args.record;}},'sandbox/test':{ensure:async args=>{acks.push(args.record);return args.record;}}},
  fingerprintKey:hmac,crypto:webcrypto});
 return {handler,receipts,rows,states,lineages,calls,acks,observations};
}
test('Google OIDC signature, audience, service identity, expiry and issuer gate push',async()=>{
 const s=setup(),body=notice(event(4));
 for(const claims of [{aud:'https://wrong.invalid'},{email:'other@gridly-play-billing.iam.gserviceaccount.com'},
  {email_verified:false},{exp:Math.floor(now/1000)-1},{iss:'https://wrong.invalid'}]){
  assert.equal((await s.handler(await request(body,await identity(claims)))).status,401);
 }
 const bad=(await identity()).slice(0,-3)+'abc';assert.equal((await s.handler(await request(body,bad))).status,401);
 assert.equal((await s.handler(new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}))).status,401);
 assert.equal(s.calls.length,0);assert.equal(s.rows.size,0);
 const unavailable=googlePubSubAuthenticator({serviceAccountEmail:email,audience:endpoint,now:()=>now,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal((await createGoogleRtdnHandler({authenticate:unavailable,subscription,receipts:s.receipts,provider:{verify:async()=>{}},cache:{apply:async()=>true},
  ackQueues:{production:{ensure:async()=>{}},'sandbox/test':{ensure:async()=>{}}},fingerprintKey:hmac})(await request(body))).status,503);
});
test('strict envelope, package and notification shape reject malformed pushes before provider',async()=>{
 const s=setup();
 for(const body of [notice(event(4),'bad id'),notice(event(4),'1234',{packageName:'other'}),
  {...notice(event(4)),subscription:'projects/other/subscriptions/x'},
  {...notice(event(4)),message:{data:'%%%',messageId:'1234'}},
  notice({subscriptionNotification:{version:'1.0',notificationType:999,purchaseToken:'synthetic-token'}}),
  notice({...event(4),testNotification:{version:'1.0'}})])assert.equal((await s.handler(await request(body))).status,400);
 assert.equal(s.calls.length,0);assert.equal(s.rows.size,0);
});
test('subscription lifecycle event types reconcile current Google state, never event assertions',async()=>{
 const cases=[
  [4,'SUBSCRIPTION_STATE_ACTIVE','active'],[2,'SUBSCRIPTION_STATE_ACTIVE','active'],
  [3,'SUBSCRIPTION_STATE_CANCELED','canceled_pending_expiry'],[13,'SUBSCRIPTION_STATE_EXPIRED','expired'],
  [6,'SUBSCRIPTION_STATE_IN_GRACE_PERIOD','grace_period'],[5,'SUBSCRIPTION_STATE_ON_HOLD','inactive'],
  [1,'SUBSCRIPTION_STATE_ACTIVE','active'],[10,'SUBSCRIPTION_STATE_PAUSED','inactive'],
  [11,'SUBSCRIPTION_STATE_PAUSED','inactive'],[7,'SUBSCRIPTION_STATE_ACTIVE','active'],
  [12,'SUBSCRIPTION_STATE_EXPIRED','expired'],[9,'SUBSCRIPTION_STATE_ACTIVE','active'],
  [19,'SUBSCRIPTION_STATE_ACTIVE','active'],[20,'SUBSCRIPTION_STATE_EXPIRED','expired'],
  [22,'SUBSCRIPTION_STATE_ACTIVE','active']];
 for(const [type,state,expected] of cases){
  const s=setup({observations:{['synthetic-token']:google(state)}});
  const response=await s.handler(await request(notice(event(type))));
  assert.equal(response.status,204,`event ${type}`);assert.equal(await response.text(),'');
  assert.equal(s.states.length,1);assert.equal(s.states[0].subscription_state,expected);
  assert.equal(s.states[0].product_id,'com.gridlygo.gridly.monthly');
  assert.ok(s.calls[0].url.includes('/purchases/subscriptionsv2/tokens/synthetic-token'));
 }
});
test('duplicate and out-of-order notifications use fresh provider state and cannot extend access',async()=>{
 const s=setup();const first=notice(event(13),'1001');
 assert.equal((await s.handler(await request(first))).status,204);
 assert.equal(s.states[0].subscription_state,'active'); // expiry event did not deny fresh active state.
 assert.equal((await s.handler(await request(first))).status,204);assert.equal(s.calls.length,1);
 s.observations['synthetic-token']=google('SUBSCRIPTION_STATE_EXPIRED');
 assert.equal((await s.handler(await request(notice(event(4),'1002')))).status,204);
 assert.equal(s.states.at(-1).subscription_state,'expired'); // purchase event did not mint authority.
 assert.equal(s.calls.length,2);
});
test('test and irrelevant one-time notifications acknowledge without querying purchase',async()=>{
 const s=setup();
 assert.equal((await s.handler(await request(notice({testNotification:{version:'1.0'}},'1010')))).status,204);
 assert.equal((await s.handler(await request(notice({oneTimeProductNotification:{version:'1.0',notificationType:1,purchaseToken:'other',sku:'other'}},'1011')))).status,204);
 assert.equal(s.calls.length,0);assert.equal(s.states.length,0);
});
test('voided subscription and sandbox purchase use Google evidence and environment binding',async()=>{
 const s=setup({observations:{['synthetic-token']:google('SUBSCRIPTION_STATE_EXPIRED',{testPurchase:{}})}});
 const voided={voidedPurchaseNotification:{purchaseToken:'synthetic-token',orderId:'GPA.123',productType:1,refundType:1}};
 assert.equal((await s.handler(await request(notice(voided,'1020')))).status,204);
 assert.equal(s.states[0].environment,'sandbox_test');assert.equal(s.states[0].entitlement_state,'not_entitled');
});
test('replacement link is fetched from Google and only fingerprints reach durable reconciliation',async()=>{
 const s=setup({observations:{next:google('SUBSCRIPTION_STATE_ACTIVE',{linkedPurchaseToken:'previous'}),previous:google()}});
 assert.equal((await s.handler(await request(notice(event(4,'next'),'1021')))).status,204);
 assert.equal(s.calls.length,2);assert.ok(s.calls[1].url.endsWith('/tokens/previous'));
 assert.equal(s.lineages[0].length,1);assert.match(s.lineages[0][0],/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(s.states[0]).includes('previous'));
});
test('wrong product/base plan terminal; provider failure retry; pending ACK routes through durable queue',async()=>{
 for(const patch of [{lineItems:[{...google().lineItems[0],productId:'other'}]},
  {lineItems:[{...google().lineItems[0],offerDetails:{basePlanId:'annual'}}]}]){
  const s=setup({observations:{['synthetic-token']:google('SUBSCRIPTION_STATE_ACTIVE',patch)}});
  assert.equal((await s.handler(await request(notice(event(4))))).status,204);
  assert.equal(s.rows.get('1234').state,'terminal');assert.equal(s.states.length,0);
 }
 const flag={value:true},s=setup({providerFailure:flag});
 assert.equal((await s.handler(await request(notice(event(4))))).status,503);
 assert.equal(s.rows.get('1234').state,'retry');flag.value=false;
 assert.equal((await s.handler(await request(notice(event(4))))).status,204);
 assert.equal(s.rows.get('1234').state,'done');
 const pending=setup({observations:{['synthetic-token']:google('SUBSCRIPTION_STATE_ACTIVE',{acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING'})}});
 assert.equal((await pending.handler(await request(notice(event(4))))).status,204);assert.equal(pending.acks.length,1);
});
test('fixed RPC names, scheduler candidate and source redaction boundaries',async()=>{
 const calls=[];const ports=googleRtdnReceiptPorts({rpc:(name,args)=>{calls.push(name);return {abortSignal:async()=>({data:name==='gridly_claim_google_rtdn'?{status:'done'}:true})};}});
 assert.equal((await ports.claim('123')).status,'done');assert.equal(await ports.finish('123','00000000-0000-0000-0000-000000000000','done','none'),true);
 assert.deepEqual(calls,['gridly_claim_google_rtdn','gridly_finish_google_rtdn']);
 const root=new URL('../',import.meta.url);
 for(const file of ['supabase/functions/_shared/entitlement/rtdn.mjs','supabase/functions/_shared/entitlement/rtdn-auth.mjs',
  'supabase/functions/_shared/entitlement/rtdn-setup.mjs'])assert.doesNotMatch(readFileSync(new URL(file,root),'utf8'),/console\.|reporting_enabled\s*[:=]\s*true/);
 const candidate=JSON.parse(readFileSync(new URL('tools/retention/cleanup-alert-worker/wrangler.subscription-rollout.jsonc',root),'utf8'));
 const live=JSON.parse(readFileSync(new URL('tools/retention/cleanup-alert-worker/wrangler.jsonc',root),'utf8'));
 assert.equal(candidate.main,'combined-worker.mjs');assert.deepEqual(candidate.triggers.crons,['* * * * *']);assert.equal(live.main,'worker.mjs');
 const migration=readFileSync(new URL('supabase/migrations/20260927204849_lp24466_google_acknowledgment_queue.sql',root),'utf8');
 assert.match(migration,/FOR UPDATE SKIP LOCKED/);assert.match(migration,/lease_until=t\+interval '60 seconds'/);
 const config=readFileSync(new URL('supabase/config.toml',root),'utf8');
 assert.match(config,/\[functions\.gridly-google-rtdn\]\s*verify_jwt = false/);
 const closed=await createGoogleRtdnRuntime({readSecret:()=>undefined,makeSupabaseClient:()=>{throw Error('should not run');}});
 assert.equal((await closed(await request(notice(event(4))))).status,503);
});
test('RTDN server composition accepts the configured project URL and keeps credentials server-side',async()=>{
 const pkcs8=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',rsa.privateKey)).toString('base64');
 const secrets={SUPABASE_URL:'https://nhwhkbkludzkuyxmkkcj.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-role',
  GRIDLY_STORE_ENVIRONMENT:'production',GRIDLY_STORE_BUNDLE_ID:'com.gridlygo.gridly',
  GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'gridly-play-billing',
   client_email:'billing@gridly-play-billing.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+pkcs8+'\n-----END PRIVATE KEY-----',token_uri:'https://oauth2.googleapis.com/token'}),
  GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64:Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),
  GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64:Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'),
  GRIDLY_GOOGLE_ACK_AES_CURRENT_VERSION:'local1',GRIDLY_GOOGLE_RTDN_PUSH_IDENTITY_EMAIL:email,
  GRIDLY_GOOGLE_RTDN_SUBSCRIPTION:subscription};
 const handler=await createGoogleRtdnRuntime({readSecret:name=>secrets[name],makeSupabaseClient:()=>({rpc:()=>({abortSignal:async()=>({data:true})})}),
  fetchImpl:async()=>Response.json({keys:[jwk]}),crypto:webcrypto});
 assert.equal((await handler(new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}))).status,401);
 const current=Math.floor(Date.now()/1000);
 assert.equal((await handler(await request({bad:'envelope'},await identity({iat:current-10,exp:current+3500})))).status,400);
});
