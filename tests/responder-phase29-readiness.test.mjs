import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../tools/responder/phase29/worker/index.mjs';
const env={DISPATCH_DELIVERY_DB:{connectionString:'postgresql://dispatch_delivery_connection:synthetic@localhost/postgres'},GRIDLY_DISPATCH_DB_CACHING_DISABLED:'true',GRIDLY_DISPATCH_DB_TLS_REQUIRED:'true'};
const req=(path='/health',method='GET')=>new Request('https://dispatch.gridlygo.com'+path,{method});
function client(failAt){let role='dispatch_delivery_connection',queries=[],ended=false;return {queries,get ended(){return ended},async connect(){if(failAt==='connect')throw Error('secret connection URI')},async query(sql){queries.push(sql);if(sql===failAt)throw Error('secret SQL password');if(sql.startsWith('BEGIN'))assert.equal(role,'dispatch_delivery_connection');if(sql.startsWith('SET LOCAL ROLE'))role='dispatch_delivery_transport';if(sql==='ROLLBACK')role='dispatch_delivery_connection';if(sql.startsWith('SELECT'))return {rows:[{database:'postgres',session_user:'dispatch_delivery_connection',current_user:role}]};return {rows:[]}},async end(){ended=true}}}
test('missing binding is sanitized 503 without Resend',async()=>{const r=await handle(req(),{});assert.equal(r.status,503);assert.equal((await r.json()).database.connected,false)});
test('governed transition rollback reset and logical pool reuse verified',async()=>{const c=client();const r=await handle(req(),env,{readinessOptions:{createClient:()=>c}});assert.equal(r.status,200);const b=await r.json();assert.equal(b.transportRole.verified,true);assert.equal(b.roleReset.verified,true);assert.equal(c.queries.filter(x=>x==='BEGIN READ ONLY').length,2);assert.equal(c.queries.filter(x=>x==='ROLLBACK').length,2);assert.ok(c.ended);assert.ok(c.queries.every(x=>/^(SELECT|BEGIN READ ONLY|SET LOCAL|ROLLBACK)/.test(x)));assert.doesNotMatch(JSON.stringify(b),/synthetic|postgresql|localhost|password|SELECT/)});
for(const fail of ['connect','SET LOCAL ROLE dispatch_delivery_transport',"SET LOCAL statement_timeout = '3000ms'"]){test('failure sanitized and cleanup '+fail,async()=>{const c=client(fail);const r=await handle(req(),env,{readinessOptions:{createClient:()=>c}});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret|password|SQL|URI/);assert.ok(c.ended);if(fail!=='connect')assert.equal(c.queries.at(-1),'ROLLBACK')})}
test('wrong identity fails closed',async()=>{const c=client();c.query=async()=>({rows:[{database:'postgres',session_user:'postgres',current_user:'postgres'}]});assert.equal((await handle(req(),env,{readinessOptions:{createClient:()=>c}})).status,503)});
test('exact GET route only',async()=>{assert.equal((await handle(req('/health','POST'),{})).status,405);for(const path of ['/health?x=1','/health/','/api/health'])assert.equal((await handle(req(path),{})).status,404)});
test('webhook remains unavailable without secrets and is POST-only',async()=>{assert.equal((await handle(req('/api/resend/webhook'),{})).status,405);assert.equal((await handle(new Request('https://dispatch.gridlygo.com/api/resend/webhook',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),{})).status,503)});

test('cleanup failure sanitized',async()=>{const c=client();c.end=async()=>{throw Error('password URI')};const r=await handle(req(),env,{readinessOptions:{createClient:()=>c}});assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/password|URI/)});
test('rollback failure closes logical client and refuses',async()=>{const c=client('ROLLBACK');const r=await handle(req(),env,{readinessOptions:{createClient:()=>c}});assert.equal(r.status,503);assert.ok(c.ended);assert.equal(c.queries.filter(x=>x==='ROLLBACK').length,2)});
test('health refuses alternate host and protocol',async()=>{for(const u of ['http://dispatch.gridlygo.com/health','https://gridlygo.com/health'])assert.equal((await handle(new Request(u),{})).status,404)});

const stages={binding:'BINDING_MISSING',client_construct:'CLIENT_CONSTRUCT_FAILED',connect:'CONNECT_FAILED',identity:'SESSION_USER_MISMATCH',begin:'BEGIN_FAILED',set_local_role:'SET_LOCAL_ROLE_FAILED',transport_identity:'TRANSPORT_USER_MISMATCH',rollback:'ROLLBACK_FAILED',post_reset_identity:'ROLE_RESET_FAILED',second_transaction:'SECOND_TRANSACTION_FAILED',cleanup:'UNKNOWN_DATABASE_FAILURE'};
const identitySql='SELECT current_database() AS database, session_user AS session_user, current_user AS current_user';
for(const [stage,code] of Object.entries(stages))test('fixed diagnostic only: '+stage,async()=>{
 const logs=[],c=client();let selects=0,begins=0;
 const raw='postgresql://secret:password@private-host/internal_schema SELECT raw stack certificate';
 const originalQuery=c.query.bind(c);
 c.query=async sql=>{
  if(sql===identitySql)selects++;
  if(sql==='BEGIN READ ONLY')begins++;
  if(stage==='identity'&&selects===1&&sql===identitySql||stage==='begin'&&sql==='BEGIN READ ONLY'&&begins===1||stage==='second_transaction'&&sql==='BEGIN READ ONLY'&&begins===2||stage==='set_local_role'&&sql==='SET LOCAL ROLE dispatch_delivery_transport'||stage==='transport_identity'&&sql===identitySql&&selects===2||stage==='rollback'&&sql==='ROLLBACK'||stage==='post_reset_identity'&&sql===identitySql&&selects===3)throw Error(raw);
  return originalQuery(sql);
 };
 if(stage==='connect')c.connect=async()=>{throw Error(raw)};
 if(stage==='cleanup')c.end=async()=>{throw Error(raw)};
 const r=await handle(req(),stage==='binding'?{}:env,{readinessOptions:{createClient:()=>{if(stage==='client_construct')throw Error(raw);return c},logDiagnostic:d=>logs.push(d)}});
 assert.equal(r.status,503);const b=await r.json();assert.equal(b.failureStage,stage);assert.equal(b.failureCode,code);assert.deepEqual(logs.map(({failureStage,failureCode})=>({failureStage,failureCode})),[{failureStage:stage,failureCode:code}]);assert.equal(b.database.connected,false);assert.doesNotMatch(JSON.stringify([b,logs]),/postgresql|secret|password|private-host|internal_schema|SELECT|stack|certificate/);
});
test('successful diagnostic patch preserves exact payload and fresh request clients',async()=>{
 const clients=[],logs=[];
 for(let i=0;i<2;i++){
  const r=await handle(req(),env,{readinessOptions:{createClient:()=>{const c=client();clients.push(c);return c},logDiagnostic:d=>logs.push(d)}});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{service:'gridly-dispatch-delivery',environment:'production',status:'ok',database:{connected:true},databaseIdentity:'gridly-dispatch',transportRole:{verified:true},roleReset:{verified:true}});
 }
 assert.notEqual(clients[0],clients[1]);assert.ok(clients.every(c=>c.ended));assert.deepEqual(logs,[]);
});
test('cleanup exception cannot obscure original failure and logger cannot leak',async()=>{
 const c=client('connect');c.end=async()=>{throw Error('secret cleanup')};
 const r=await handle(req(),env,{readinessOptions:{createClient:()=>c,logDiagnostic:()=>{throw Error('secret logging')}}});
 const b=await r.json();assert.equal(r.status,503);assert.equal(b.failureStage,'connect');assert.equal(b.failureCode,'CONNECT_FAILED');assert.doesNotMatch(JSON.stringify(b),/secret/);
});

import {bindingFacts} from '../tools/responder/phase29/worker/binding-facts.mjs';
const factsEnv=uri=>({...env,DISPATCH_DELIVERY_DB:{connectionString:uri,toJSON(){throw Error('raw object serialized')}}});
for(const [label,override,flag] of [
 ['missing',{},'bindingPresent'],
 ['wrong type',factsEnv(42),'connectionStringNonEmpty'],
 ['empty',factsEnv(''),'connectionStringNonEmpty'],
 ['unparseable',factsEnv('secret invalid URI'),'hasPropertyUrlParseable'],
 ['scheme',factsEnv('https://secret:secret@private-host/path'),'hasPropertyPostgresProtocol'],
 ['username',factsEnv('postgresql://proxy_user:secret@private-host/postgres'),'hasPropertyExpectedLogin'],
 ['username encoding',factsEnv('postgresql://%ZZ:secret@private-host/postgres'),'hasPropertyUsernameDecodable'],
 ['password',factsEnv('postgresql://dispatch_delivery_connection@private-host/postgres'),'hasPropertyPassword'],
 ['TLS parameter',factsEnv('postgresql://dispatch_delivery_connection:secret@private-host/postgres?sslmode=disable'),'hasPropertySslModeAllowed'],
 ['cache declaration',{...env,GRIDLY_DISPATCH_DB_CACHING_DISABLED:'false'},'hasPropertyCacheDeclarationValid'],
 ['TLS declaration',{...env,GRIDLY_DISPATCH_DB_TLS_REQUIRED:'false'},'hasPropertyTlsDeclarationValid']
])test('binding facts expose no values: '+label,()=>{
 const facts=bindingFacts(override);assert.equal(facts[flag],false);
 for(const [k,v] of Object.entries(facts))if(k.endsWith('Type'))assert.ok(['object','string','undefined','number','boolean','bigint','symbol','function'].includes(v));else assert.equal(typeof v,'boolean');
 assert.doesNotMatch(JSON.stringify(facts),/secret|private-host|proxy_user|postgresql|dispatch_delivery_connection|%ZZ|sslmode|raw object/);
});
test('binding diagnostics tolerate throwing getter without raw error or object serialization',()=>{
 const facts=bindingFacts({...env,DISPATCH_DELIVERY_DB:{get connectionString(){throw Error('secret URI')},toJSON(){throw Error('secret serialized')}}});
 assert.equal(facts.bindingPresent,true);assert.equal(facts.connectionStringPresent,false);assert.doesNotMatch(JSON.stringify(facts),/secret|URI|serialized/);
});
test('binding shape facts and original failure enum are safe in response and log',async()=>{
 const diagnosticEnv={...factsEnv('postgresql://proxy_user:secret@private-host/postgres?sslmode=disable'),GRIDLY_DISPATCH_DB_TLS_REQUIRED:'false'},logs=[];
 const r=await handle(req(),diagnosticEnv,{readinessOptions:{logDiagnostic:d=>logs.push(d),createClient:()=>{throw Error('must not reach client')}}});
 const b=await r.json();assert.equal(r.status,503);assert.equal(b.failureStage,'binding');assert.equal(b.failureCode,'BINDING_MISSING');assert.equal(b.bindingPresent,true);assert.equal(b.bindingType,'object');assert.equal(b.connectionStringPresent,true);assert.equal(b.connectionStringType,'string');assert.equal(b.connectionStringNonEmpty,true);assert.equal(b.hasPropertyExpectedLogin,false);assert.equal(b.hasPropertySslModeAllowed,false);assert.deepEqual(logs,[{failureStage:b.failureStage,failureCode:b.failureCode,...bindingFacts(diagnosticEnv)}]);assert.doesNotMatch(JSON.stringify([b,logs]),/secret|private-host|proxy_user|postgresql|must not reach/);
});

import {databaseBinding} from '../tools/responder/phase29/worker/config.mjs';
for(const uri of ['postgresql://dispatch_delivery_connection:synthetic@localhost/postgres','postgresql://proxy_user:synthetic@localhost/postgres','postgresql://dispatch_delivery_connection:synthetic@localhost/postgres?sslmode=disable','postgresql://proxy_user:synthetic@localhost/postgres?sslmode=disable'])test('proxy URI representation passes; origin proofs remain separate '+uri.replace(/:\/\/.*@/,'://[fixture]@'),()=>{assert.equal(databaseBinding(factsEnv(uri)),uri)});
for(const [label,fixture] of [['missing binding',{}],['missing connectionString',{...env,DISPATCH_DELIVERY_DB:{}}],['non-string',factsEnv(42)],['empty',factsEnv('')],['unparseable',factsEnv('invalid')],['wrong scheme',factsEnv('https://user:pw@localhost/postgres')],['missing password',factsEnv('postgres://user@localhost/postgres')],['cache missing',{...env,GRIDLY_DISPATCH_DB_CACHING_DISABLED:undefined}],['TLS missing',{...env,GRIDLY_DISPATCH_DB_TLS_REQUIRED:undefined}]])test('repaired validator still refuses '+label,()=>assert.throws(()=>databaseBinding(fixture)));
test('proxy URI acceptance cannot authorize wrong database session user',async()=>{
 const c=client();c.query=async()=>({rows:[{database:'postgres',session_user:'postgres',current_user:'postgres'}]});
 const r=await handle(req(),factsEnv('postgresql://proxy_user:synthetic@localhost/postgres?sslmode=disable'),{readinessOptions:{createClient:()=>c,logDiagnostic:()=>{}}});const b=await r.json();assert.equal(r.status,503);assert.equal(b.failureStage,'identity');assert.equal(b.failureCode,'SESSION_USER_MISMATCH');assert.equal(b.database.connected,false);
});
test('wrong transport current_user remains refused after validator repair',async()=>{
 const c=client(),q=c.query.bind(c);let selects=0;c.query=async sql=>{const r=await q(sql);if(sql===identitySql&&++selects===2)r.rows[0].current_user='dispatch_delivery_connection';return r};
 const r=await handle(req(),env,{readinessOptions:{createClient:()=>c,logDiagnostic:()=>{}}});const b=await r.json();assert.equal(r.status,503);assert.equal(b.failureCode,'TRANSPORT_USER_MISMATCH');
});
test('role reset mismatch remains refused after validator repair',async()=>{
 const c=client(),q=c.query.bind(c);let selects=0;c.query=async sql=>{const r=await q(sql);if(sql===identitySql&&++selects===3)r.rows[0].current_user='dispatch_delivery_transport';return r};
 const r=await handle(req(),env,{readinessOptions:{createClient:()=>c,logDiagnostic:()=>{}}});const b=await r.json();assert.equal(r.status,503);assert.equal(b.failureCode,'ROLE_RESET_FAILED');
});
test('second transaction cannot retain a leaked transport role',async()=>{
 const c=client(),q=c.query.bind(c);let begins=0;c.query=async sql=>{if(sql==='BEGIN READ ONLY'&&++begins===2)throw Error('synthetic pool retained role');return q(sql)};
 const r=await handle(req(),env,{readinessOptions:{createClient:()=>c,logDiagnostic:()=>{}}});const b=await r.json();assert.equal(r.status,503);assert.equal(b.failureStage,'second_transaction');assert.equal(b.failureCode,'SECOND_TRANSACTION_FAILED');assert.equal(b.database.connected,false);assert.ok(c.ended);
});
