import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto as crypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {tokenCipher,acknowledgmentQueue} from '../supabase/functions/_shared/entitlement/acknowledgment.mjs';
import {productionComposition,sandboxAcceptanceComposition} from '../supabase/functions/_shared/entitlement/composition.mjs';
import {googleServiceAccessToken} from '../supabase/functions/_shared/entitlement/google-oauth.mjs';
import {subscriptionRpcPorts} from '../supabase/functions/_shared/entitlement/rpc-ports.mjs';
import {normalizeGoogle,cacheRecord} from '../supabase/functions/_shared/entitlement/core.mjs';
const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const signing=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const cipher=tokenCipher({current:{version:'test-v1',key},crypto}),token='synthetic-google-token',fingerprint='a'.repeat(64),now=Date.now();
const data=(patch={})=>({regionCode:'US',startTime:new Date(now-1000).toISOString(),subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:'com.gridlygo.gridly.monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(now+86400000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...patch});
const row=patch=>normalizeGoogle(data(patch),{env:'production',token,now});
function setup(){let saved=null,acknowledged=false,fail=false,resolutions=[],events=[];
 const store={enqueue:async value=>{events.push('enqueue');saved??={...value,lease:'synthetic-lease',lease_until:new Date(Date.now()+60000).toISOString(),expires_at:new Date(Date.now()+3600000).toISOString()};return true;},claim:async()=>saved?[saved]:[],resolve:async value=>{resolutions.push(value);if(value.outcome!=='retry')saved=null;return true;}};
 const provider={verify:async()=>{events.push('verify');return row(acknowledged?{acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'}:{});},acknowledge:async()=>{events.push('ack');if(fail)throw Error('private token failure');acknowledged=true;}};
 const cache={apply:async()=>{events.push('cache');return true;}},ports={environment:'production',store,cipher,provider,cache,fingerprintKey:hmac,crypto};
 return {ports,events,resolutions,fail:value=>{fail=value;},acknowledged:value=>{acknowledged=value;},saved:()=>saved};
}
test('AES-GCM authenticates environment/fingerprint; tamper and wrong key fail; no plaintext persisted',async()=>{
 const sealed=await cipher.seal(token,'production',fingerprint);assert.equal(await cipher.open(sealed),token);assert.ok(!JSON.stringify(sealed).includes(token));
 assert.notEqual((await cipher.seal(token,'production',fingerprint)).iv,sealed.iv);
 for(const patch of [{environment:'sandbox_test'},{chain_fingerprint:'b'.repeat(64)},{ciphertext:sealed.ciphertext.slice(0,-3)+'AAA'},{iv:'invalid'}])await assert.rejects(()=>cipher.open({...sealed,...patch}));
 const other=tokenCipher({current:{version:'test-v1',key:await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt'])},crypto});await assert.rejects(()=>other.open(sealed));
 assert.throws(()=>tokenCipher({key:{},crypto}));
});
test('durable enqueue precedes fresh verification/cache/ack/completion; failure survives new process object',async()=>{
 const s=setup(),record=row(),cached=await cacheRecord(record,hmac,crypto);s.fail(true);
 await assert.rejects(()=>acknowledgmentQueue(s.ports).ensure({token,record,cached}));
 assert.ok(s.saved());assert.deepEqual(s.events,['enqueue','verify','cache','ack']);assert.equal(s.resolutions[0].outcome,'retry');assert.equal(s.resolutions[0].error_category,'provider_unavailable');
 s.fail(false);const results=await acknowledgmentQueue(s.ports).drain();assert.equal(results[0].completed,true);assert.equal(results[0].outcome,'success');assert.equal(s.saved(),null);
});
test('crash after Google ACK uses current ACKNOWLEDGED and does not acknowledge again',async()=>{
 const s=setup(),record=row(),cached=await cacheRecord(record,hmac,crypto);await s.ports.store.enqueue(await cipher.seal(token,'production',cached.chain_fingerprint));s.acknowledged(true);
 assert.equal((await acknowledgmentQueue(s.ports).drain())[0].outcome,'success');assert.ok(!s.events.includes('ack'));
});
test('confirmed denial removes pending ciphertext and never acknowledges',async()=>{
 const s=setup(),cached=await cacheRecord(row(),hmac,crypto);await s.ports.store.enqueue(await cipher.seal(token,'production',cached.chain_fingerprint));
 s.ports.provider.verify=async()=>row({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{...data().lineItems[0],expiryTime:new Date(now-1).toISOString()}]});
 assert.equal((await acknowledgmentQueue(s.ports).drain())[0].outcome,'terminal');assert.equal(s.saved(),null);assert.ok(!s.events.includes('ack'));
});
test('terminal cipher removes work; provider/cache retry; false completion denies ensure',async()=>{
 for(const kind of ['cipher','provider','cache','completion']){
  const s=setup(),record=row(),cached=await cacheRecord(record,hmac,crypto);
  if(kind==='cipher')s.ports.cipher={seal:cipher.seal,open:async()=>{throw Error('private');}};
  if(kind==='provider')s.ports.provider.verify=async()=>{throw Error('private');};
  if(kind==='cache')s.ports.cache.apply=async()=>false;
  if(kind==='completion')s.ports.store.resolve=async()=>false;
  await assert.rejects(()=>acknowledgmentQueue(s.ports).ensure({token,record,cached}));assert.ok(s.saved());
 }
});
const request=env=>new Request('https://example.invalid/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform:'google',environment:env,nonce:'a'.repeat(48),productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',evidence:{purchaseTokens:[token]}})});
test('production composition cannot be enabled by input; missing/invalid keys/admission remain 503',async()=>{
 for(const ports of [{},{authorizeNative:async()=>true},{signingKey:signing.privateKey}]){
  const composition=productionComposition(ports);assert.equal((await composition.google(request('production'))).status,503);assert.equal(composition.retryGoogle,null);
 }
 const s=setup(),common={authorizeNative:async()=>true,cache:s.ports.cache,signingKey:signing.privateKey,fingerprintKey:hmac,crypto,google:{accessToken:async()=> 'synthetic-oauth',encryptionKeys:{current:{version:'test-v1',key}},store:s.ports.store,fetchImpl:async()=>Response.json(data({acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'}))}};
 const prod=productionComposition(common);assert.equal((await prod.google(request('sandbox/test'))).status,401);assert.equal((await prod.google(request('production'))).status,200);
 const sandbox=sandboxAcceptanceComposition(common);assert.equal((await sandbox.google(request('production'))).status,401);assert.equal((await sandbox.google(request('sandbox/test'))).status,502); // Production provider data cannot grant sandbox authority.
});
test('server RPC adapter uses only fixed names, bounded abort, no error serialization',async()=>{
 const calls=[],client={rpc:(name,args)=>{calls.push([name,args]);return {abortSignal:async signal=>{assert.ok(signal instanceof AbortSignal);return {data:true};}};}};
 const ports=subscriptionRpcPorts(client);assert.equal(await ports.cache.apply({platform:'google'},[]),true);assert.equal(await ports.cache.apply({platform:'apple'}),true);assert.equal(await ports.store.enqueue({}),true);
 assert.deepEqual(calls.map(x=>x[0]),['gridly_reconcile_google_entitlement','gridly_reconcile_store_entitlement','gridly_enqueue_google_ack']);
 const thrown=subscriptionRpcPorts({rpc:()=>{throw Error(token);}});await assert.rejects(()=>thrown.store.enqueue({}),error=>error.message==='subscription_unavailable');
 const bad=subscriptionRpcPorts({rpc:()=>({abortSignal:async()=>({error:{message:token}})})});await assert.rejects(()=>bad.store.enqueue({}),error=>error.message==='subscription_unavailable');
});
test('Google service OAuth uses fixed scope/audience, RS256, bounded cache and no client key',async()=>{
 const rsa=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},false,['sign','verify']);let calls=0,time=now;
 const get=googleServiceAccessToken({clientEmail:'synthetic@synthetic.iam.gserviceaccount.com',privateKey:rsa.privateKey,crypto,now:()=>time,fetchImpl:async(url,options)=>{
  calls++;assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(options.redirect,'manual');assert.equal(options.method,'POST');
  const jwt=options.body.get('assertion'),parts=jwt.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
  assert.equal(claims.scope,'https://www.googleapis.com/auth/androidpublisher');assert.equal(claims.aud,url);assert.equal(claims.exp-claims.iat,3600);assert.equal(Object.hasOwn(claims,'sub'),false);
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',rsa.publicKey,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1])));
  return Response.json({access_token:'synthetic-oauth',token_type:'Bearer',expires_in:3600});}});
 assert.deepEqual(await Promise.all([get(),get()]),['synthetic-oauth','synthetic-oauth']);assert.equal(calls,1);time+=3600000;await get();assert.equal(calls,2);
 assert.throws(()=>googleServiceAccessToken({clientEmail:'consumer@example.invalid',privateKey:rsa.privateKey,crypto}));
 const fail=googleServiceAccessToken({clientEmail:'synthetic@synthetic.iam.gserviceaccount.com',privateKey:rsa.privateKey,crypto,fetchImpl:async()=>new Response(token,{status:401})});await assert.rejects(fail,error=>error.message==='credential_unavailable');
});
test('new modules never log evidence, mutate reporting or enable production config; default routes dormant',()=>{
 for(const file of ['acknowledgment.mjs','composition.mjs','rpc-ports.mjs','google-oauth.mjs','server-setup.mjs','ack-health.mjs']){
  const source=readFileSync(new URL('../supabase/functions/_shared/entitlement/'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/console\.|localStorage|sessionStorage|localhost|reporting_enabled\s*[:=]\s*true/);
 }
 const config=readFileSync(new URL('../js/gridly-paid-config.mjs',import.meta.url),'utf8');assert.match(config,/importProductionEntitlementKey/);assert.match(config,/createNativeAttestedInvoke/);assert.match(config,/platform!=='ios'/);
 for(const platform of ['apple','google'])assert.doesNotMatch(readFileSync(new URL('../supabase/functions/gridly-verify-'+platform+'-subscription/index.ts',import.meta.url),'utf8'),/sandboxAcceptanceComposition/);
});

test('post-ack verification, rather than original observation, sets signed authority period/denial',async()=>{
 for(const denied of [false,true]){
  const s=setup(),record=row(),cached=await cacheRecord(record,hmac,crypto),shortEnd=new Date(now+30000).toISOString();let verified=0;
  s.ports.provider.verify=async()=>{verified++;return verified===1?row():row({acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',subscriptionState:denied?'SUBSCRIPTION_STATE_EXPIRED':'SUBSCRIPTION_STATE_ACTIVE',lineItems:[{...data().lineItems[0],expiryTime:denied?new Date(now-1).toISOString():shortEnd}]});};
  const latest=await acknowledgmentQueue(s.ports).ensure({token,record,cached});assert.equal(verified,2);assert.equal(latest.entitlementState,denied?'not_entitled':'entitled');if(!denied)assert.equal(latest.currentPeriodEnd,shortEnd);
 }
});
test('health classification redacts work identity, reports failure/stale/expiry and missing runner',async()=>{
 const {acknowledgmentHealth}=await import('../supabase/functions/_shared/entitlement/ack-health.mjs');
 const base={environment:'production',subsystem:'google_ack',last_completed_at:new Date(now).toISOString(),last_purge_at:new Date(now).toISOString(),pending_count:0,due_count:0,failed_count:0,stale_count:0,overdue_count:0,expired_count:0,terminal_count:0,oldest_pending_age_seconds:0,error_category:'none'};
 for(const [patch,state] of [[{},'healthy'],[{failed_count:1},'failed'],[{stale_count:1},'stale'],[{overdue_count:1},'overdue'],[{expired_count:1},'overdue'],[{last_completed_at:null},'monitor_error'],[{last_completed_at:new Date(now-90001).toISOString()},'monitor_error'],[{pending_count:1000001},'monitor_error']])assert.equal(acknowledgmentHealth({...base,...patch},{now}).health_state,state);
 const output=acknowledgmentHealth({...base,token,iv:'private',lease:'private',chain_fingerprint:fingerprint},{now});assert.ok(!JSON.stringify(output).includes('private'));assert.ok(!JSON.stringify(output).includes(token));
});
test('secret composition fails closed without owner values/native admission; secrets are never queried on missing admission',async()=>{
 const {createProductionServer,createSandboxAcceptanceServer}=await import('../supabase/functions/_shared/entitlement/server-setup.mjs');let calls=0;
 for(const factory of [createProductionServer,createSandboxAcceptanceServer]){
  const unavailable=await factory({readSecret:()=>{calls++;throw Error('private');}});assert.equal((await unavailable.google(request('production'))).status,503);
 }
 assert.equal(calls,0);const unavailable=await createProductionServer({authorizeNative:async()=>true,readSecret:()=>undefined,makeSupabaseClient:()=>{throw Error('private');}});assert.equal((await unavailable.apple(new Request('https://example.invalid',{method:'POST'}))).status,503);
});
test('production Apple uses only authenticated Node port; missing bridge secret closes platform',async()=>{
 const {createProductionServer,createSandboxAcceptanceServer}=await import('../supabase/functions/_shared/entitlement/server-setup.mjs');
 const generated=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const config={GRIDLY_STORE_ENVIRONMENT:'production',GRIDLY_STORE_BUNDLE_ID:'com.gridlygo.gridly',SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server-key',GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64:Buffer.from(await crypto.subtle.exportKey('pkcs8',generated.privateKey)).toString('base64'),GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64:Buffer.alloc(32,1).toString('base64'),GRIDLY_APPLE_ISSUER_ID:'11111111-1111-1111-1111-111111111111',GRIDLY_APPLE_KEY_ID:'SYNTHETIC1',GRIDLY_APPLE_PRIVATE_KEY_P8:'synthetic-not-a-real-key',GRIDLY_APPLE_APP_ID:'123456789',GRIDLY_APPLE_NODE_URL:'https://abc.lambda-url.us-east-1.on.aws/',GRIDLY_APPLE_NODE_INTERNAL_TOKEN:'A'.repeat(43),GRIDLY_APPLE_NODE_RESPONSE_HMAC_KEY:Buffer.alloc(32,8).toString('base64')};
 const args=[],library={Environment:{PRODUCTION:'Production',SANDBOX:'Sandbox'},AppStoreServerAPIClient:class{constructor(...values){args.push(values);}getAllSubscriptionStatuses(){}},SignedDataVerifier:class{constructor(...values){args.push(values);}verifyAndDecodeTransaction(){}verifyAndDecodeRenewalInfo(){}}};
 const ports={readSecret:name=>config[name],authorizeNative:async()=>false,makeSupabaseClient:()=>({rpc(){}}),appleLibrary:library,appleRoots:[Buffer.alloc(256)],crypto};
 const server=await createProductionServer(ports);assert.equal(args.length,0);assert.equal(server.retryGoogle,null);
 assert.notEqual((await server.apple(new Request('https://example.invalid',{method:'POST'}))).status,503);
 delete config.GRIDLY_APPLE_NODE_INTERNAL_TOKEN;const missing=await createProductionServer(ports);assert.equal((await missing.apple(new Request('https://example.invalid',{method:'POST'}))).status,503);
 config.GRIDLY_STORE_ENVIRONMENT='sandbox/test';const sandbox=await createSandboxAcceptanceServer(ports);assert.equal(args[0][3],'com.gridlygo.gridly');assert.equal(args[0][4],'Sandbox');assert.equal(args[1][1],true);assert.equal(args[1][4],undefined);assert.equal(sandbox.retryGoogle,null);
 config.GRIDLY_STORE_ENVIRONMENT='sandbox/test';const wrong=await createProductionServer(ports);assert.equal((await wrong.google(request('production'))).status,503);
});

test('composed HTTP verifier outage denies proof, independent retry completes, restore admits without rebuy',async()=>{
 const s=setup();let acked=false,fail=true,acks=0;
 const ports={authorizeNative:async()=>true,cache:s.ports.cache,signingKey:signing.privateKey,fingerprintKey:hmac,crypto,
 google:{accessToken:async()=> 'synthetic-oauth',encryptionKeys:{current:{version:'test-v1',key}},store:s.ports.store,fetchImpl:async(url,options)=>{
  if(options.method==='POST'){acks++;if(fail)return new Response(null,{status:503});acked=true;return new Response(null,{status:204});}
  return Response.json(data(acked?{acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'}:{}));}}};
 let server=productionComposition(ports),response=await server.google(request('production'));assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'verification_unavailable'});assert.ok(s.saved());
 fail=false;server=productionComposition(ports);assert.equal((await server.retryGoogle())[0].outcome,'success');assert.equal(s.saved(),null);
 response=await server.google(request('production'));assert.equal(response.status,200);const {proof}=await response.json();
 const {verifyAuthorityProof,accessDecision}=await import('../js/gridly-entitlement.mjs');
 const snapshot=await verifyAuthorityProof({proof,publicKey:signing.publicKey,nonce:'a'.repeat(48),platform:'google',now:Date.now(),crypto});assert.equal(accessDecision(snapshot,{platform:'google'}).allowed,true);assert.equal(acks,2);
});
