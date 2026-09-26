import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHealth, monitorError, safePayload } from '../tools/retention/cleanup-alert-worker/logic.mjs';
import { formatAlert, sendAlert } from '../tools/retention/cleanup-alert-worker/resend.mjs';
import { runScheduled } from '../tools/retention/cleanup-alert-worker/runner.mjs';

const NOW = new Date('2026-09-26T01:00:00.000Z');
const SUCCESS = '2026-09-26T00:59:00.000Z';
const EMAIL_ID = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794';
const CONFIG = { apiKey: 'test-secret', from: 'owner-sender@example.invalid',
  to: 'owner-inbox@example.invalid', idempotencyKey: 'gridly-cleanup-49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' };

function rows() {
  return [
    { subsystem: 'report_retention', job_state: 'active', latest_run_state: 'succeeded',
      latest_run_at: SUCCESS, last_success_at: SUCCESS, retention_state: 'succeeded', compliance_health_state:'none', compliance_late_processed_count:0, compliance_late_processed_at:null,
      report_overdue_count: 0, report_breached_count: 0 },
    { subsystem: 'compliance_cleanup', job_state: 'active', latest_run_state: 'succeeded',
      latest_run_at: SUCCESS, last_success_at: SUCCESS, retention_state: 'none', compliance_health_state:'succeeded', compliance_late_processed_count:0, compliance_late_processed_at:null,
      report_overdue_count: 0, report_breached_count: 0 },
  ];
}

function kv() {
  const entries = new Map();
  return {
    entries,
    async get(key) { return entries.has(key) ? JSON.parse(entries.get(key)) : null; },
    async put(key, value) { entries.set(key, value); },
    async delete(key) { entries.delete(key); },
  };
}

test('healthy report and compliance rows remain healthy', () => {
  assert.deepEqual(classifyHealth(rows(), NOW).map(value => value.health_state), ['healthy', 'healthy']);
});

test('retention failure, Cron failure, missing job, and stale compliance are detected', () => {
  const failedRetention = rows();
  failedRetention[0].retention_state = 'failed';
  assert.equal(classifyHealth(failedRetention, NOW)[0].error_category, 'retention_failed');
  const failedCompliance = rows();
  failedCompliance[1].latest_run_state = 'failed';
  assert.equal(classifyHealth(failedCompliance, NOW)[1].error_category, 'job_failed');
  const missingJob = rows();
  missingJob[1].job_state = 'missing';
  assert.equal(classifyHealth(missingJob, NOW)[1].error_category, 'job_missing');
  const staleCompliance = rows();
  staleCompliance[1].last_success_at = '2026-09-26T00:55:00Z';
  assert.equal(classifyHealth(staleCompliance, NOW)[1].health_state, 'stale');
});

test('retention staleness and bounded overdue/breached counts are classified', () => {
  const stale = rows();
  stale[0].last_success_at = '2026-09-26T00:54:59Z';
  assert.equal(classifyHealth(stale, NOW)[0].health_state, 'stale');
  const overdue = rows();
  overdue[0].report_overdue_count = 1;
  assert.equal(classifyHealth(overdue, NOW)[0].health_state, 'overdue');
  const breached = rows();
  breached[0].report_breached_count = 1;
  assert.equal(classifyHealth(breached, NOW)[0].health_state, 'overdue');
});

test('unknown, duplicate, or malformed health rows fail closed', () => {
  assert.throws(() => classifyHealth([rows()[0], rows()[0]], NOW), /invalid_health_projection/);
  const malformed = rows();
  malformed[0].report_overdue_count = 'unbounded';
  assert.throws(() => classifyHealth(malformed, NOW), /invalid_health_projection/);
  const nullCount = rows();
  nullCount[0].report_breached_count = null;
  assert.throws(() => classifyHealth(nullCount, NOW), /invalid_health_projection/);
  const unexpected = rows();
  unexpected[1].subsystem = 'private_report';
  assert.throws(() => classifyHealth(unexpected, NOW), /invalid_health_projection/);
});

test('monitor query failure becomes a bounded monitor_error with no raw error', async () => {
  const store = kv();
  const sent = [];
  const result = await runScheduled({
    env: { ALERT_STATE: store, RESEND_API_KEY: 'test-secret', ALERT_FROM: CONFIG.from, ALERT_TO: CONFIG.to },
    now: NOW,
    queryHealth: async () => { throw new Error('password=private report contents'); },
    send: async payload => { sent.push(payload); return { accepted: true }; },
  });
  assert.deepEqual(result.health_states, ['monitor_error']);
  assert.deepEqual(sent[0], monitorError(NOW));
  assert.equal(JSON.stringify(sent).includes('password='), false);
});

test('malformed production projection emits only invalid_status', async () => {
  const sent = [];
  const result = await runScheduled({
    env: { ALERT_STATE: kv(), RESEND_API_KEY: 'test-secret', ALERT_FROM: CONFIG.from, ALERT_TO: CONFIG.to },
    now: NOW,
    queryHealth: async () => [{ ...rows()[0], report_overdue_count: 'report private text' }, rows()[1]],
    send: async payload => { sent.push(payload); return { accepted: true }; },
  });
  assert.deepEqual(result.health_states, ['monitor_error']);
  assert.equal(sent[0].error_category, 'invalid_status');
  assert.equal(JSON.stringify(sent).includes('private text'), false);
});

test('payload and Resend request reconstruct only allowed fields', async () => {
  const input = { ...safePayload({ subsystem: 'report_retention', state: 'stale', observedAt: NOW }),
    report_id: 'private-report-id', coordinates: '30,-95', token: 'private-token',
    detail: 'customer narrative', stack: 'password=private' };
  const formatted = formatAlert(input, { synthetic: true });
  assert.match(formatted.subject, /TEST/);
  for (const forbidden of ['private-report-id', '30,-95', 'private-token', 'customer narrative', 'password=private']) {
    assert.equal(JSON.stringify(formatted).includes(forbidden), false);
  }
  let request;
  await sendAlert(input, { ...CONFIG, fetchImpl: async (_url, options) => {
    request = options;
    return { ok: true, json: async () => ({ id: EMAIL_ID }) };
  } });
  const body = JSON.parse(request.body);
  assert.equal(body.to[0], CONFIG.to);
  assert.equal(body.text.includes('private-report-id'), false);
  assert.equal(body.text.includes('password=private'), false);
  assert.equal(request.headers['Idempotency-Key'], CONFIG.idempotencyKey);
  assert.equal(request.redirect,'manual');
});

test('Resend error responses are suppressed without leaking content', async () => {
  const payload = safePayload({ subsystem: 'compliance_cleanup', state: 'failed', observedAt: NOW });
  await assert.rejects(sendAlert(payload, { ...CONFIG, fetchImpl: async () => ({ ok: false,
    text: async () => 'secret provider response' }) }), { message: 'delivery_failed' });
});

test('alert state deduplicates repeat ticks and allows a new alert after recovery', async () => {
  const store = kv();
  const sent = [];
  const env = { ALERT_STATE: store, RESEND_API_KEY: 'test-secret', ALERT_FROM: CONFIG.from, ALERT_TO: CONFIG.to };
  const failed = rows();
  failed[1].latest_run_state = 'failed';
  const send = async payload => { sent.push(payload); return { accepted: true }; };
  await runScheduled({ env, now: NOW, queryHealth: async () => failed, send });
  await runScheduled({ env, now: new Date(NOW.getTime() + 60_000), queryHealth: async () => failed, send });
  assert.equal(sent.length, 1);
  const recovered = rows();
  for (const row of recovered) {
    row.last_success_at = '2026-09-26T01:02:00Z';
    row.latest_run_at = '2026-09-26T01:02:00Z';
  }
  await runScheduled({ env, now: new Date(NOW.getTime() + 120_000), queryHealth: async () => recovered, send });
  const failedAgain = structuredClone(recovered);
  failedAgain[1].latest_run_state = 'failed';
  await runScheduled({ env, now: new Date(NOW.getTime() + 180_000), queryHealth: async () => failedAgain, send });
  assert.equal(sent.length, 3);
});

test('failed delivery retries the same bounded payload and idempotency key', async () => {
  const store = kv();
  const env = { ALERT_STATE: store, RESEND_API_KEY: 'test-secret', ALERT_FROM: CONFIG.from, ALERT_TO: CONFIG.to };
  const failed = rows();
  failed[1].latest_run_state = 'failed';
  const attempts = [];
  const send = async (payload, options) => {
    attempts.push({ payload, key: options.idempotencyKey });
    if (attempts.length === 1) throw new Error('delivery_failed');
    return { accepted: true };
  };
  await assert.rejects(runScheduled({ env, now: NOW, queryHealth: async () => failed, send }),
    { message: 'delivery_failed' });
  await runScheduled({ env, now: new Date(NOW.getTime() + 60_000), queryHealth: async () => failed, send });
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], attempts[1]);
});

import { createHandler } from '../supabase/functions/gridly-cleanup-health/handler.mjs';
import { edgeHealth, heartbeat } from '../tools/retention/cleanup-alert-worker/worker.mjs';
import { syntheticEmail } from '../tools/retention/cleanup-alert-worker/synthetic.mjs';
const TOKEN='a'.repeat(64);
const edgeEnv=k=>({GRIDLY_MONITOR_TOKEN:TOKEN,SUPABASE_URL:'https://nhwhkbkludzkuyxmkkcj.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-backend-secret'})[k];
test('Edge rejects invalid auth before fixed RPC, validates and caches projection',async()=>{
 let calls=0; const h=createHandler({env:edgeEnv,fetchImpl:async(url,opts)=>{calls++;assert.equal(url,'https://nhwhkbkludzkuyxmkkcj.supabase.co/rest/v1/rpc/gridly_cleanup_alert_health');assert.equal(opts.body,'{}');return Response.json(rows());}});
 for(const auth of ['', 'wrong',TOKEN+'x','b'.repeat(64)]){const r=await h(new Request('https://test.invalid',{method:'POST',headers:{'X-Gridly-Monitor-Token':auth}}));assert.equal(r.status,401);}
 assert.equal(calls,0);
 const req=()=>new Request('https://test.invalid',{method:'POST',headers:{'X-Gridly-Monitor-Token':TOKEN}});
 assert.deepEqual(await (await h(req())).json(),rows()); await h(req()); assert.equal(calls,1);
});
test('Edge suppresses raw database errors and rejects extra private fields',async()=>{
 for(const response of [Response.json({message:'private password'}, {status:500}),Response.json([{...rows()[0],report_id:'private'},rows()[1]])]){
 const h=createHandler({env:edgeEnv,fetchImpl:async()=>response}); const r=await h(new Request('https://test.invalid',{method:'POST',headers:{'X-Gridly-Monitor-Token':TOKEN}}));assert.equal(r.status,502);assert.equal((await r.text()).includes('private'),false);
 }
});
test('Edge rate limit blocks repeated failed backend queries',async()=>{
 let calls=0;const h=createHandler({env:edgeEnv,fetchImpl:async()=>{calls++;throw Error('secret');}});const req=()=>new Request('https://test.invalid',{method:'POST',headers:{'X-Gridly-Monitor-Token':TOKEN}});
 assert.equal((await h(req())).status,502);assert.equal((await h(req())).status,429);assert.equal(calls,1);
});
test('Worker sends dedicated token only to fixed Edge URL, no database credential',async()=>{
 const out=await edgeHealth({GRIDLY_MONITOR_TOKEN:TOKEN,EDGE_URL:'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-cleanup-health'},async(url,opts)=>{assert.match(url,/functions\/v1\/gridly-cleanup-health$/);assert.deepEqual(opts.headers,{'X-Gridly-Monitor-Token':TOKEN});assert.equal(opts.body,undefined);assert.equal(opts.redirect,'manual');return Response.json(rows());});assert.deepEqual(out,rows());
});
test('compliance missing heartbeat, pending and recent processed-late evidence classify',()=>{
 for(const [state,expected] of [['missing','failed'],['pending','stale']]){const r=rows();r[1].compliance_health_state=state;assert.equal(classifyHealth(r,NOW)[1].health_state,expected);}
 const r=rows();r[1].compliance_late_processed_count=1;r[1].compliance_late_processed_at=SUCCESS;assert.equal(classifyHealth(r,NOW)[1].error_category,'compliance_late_processed');
});
test('synthetic email uses dated safe payload without a production reader',async()=>{
 let body;await syntheticEmail({RESEND_API_KEY:'fake',ALERT_FROM:CONFIG.from,ALERT_TO:CONFIG.to},{now:NOW,send:async(p,o)=>{body=formatAlert(p,o);assert.equal(o.synthetic,true);}});assert.match(body.subject,/TEST/);assert.match(body.text,/2026-09-26T01:00:00.000Z/);
});
test('deadman ping transmits empty body and rejects alternate hosts',async()=>{
 let calls=0;await heartbeat({DEADMAN_PING_URL:'https://hc-ping.com/'+EMAIL_ID},async(_,o)=>{calls++;assert.equal(o.body,'');return new Response('OK');});assert.equal(calls,1);await assert.rejects(heartbeat({DEADMAN_PING_URL:'https://evil.invalid/'+EMAIL_ID}));
});

test('dedicated auth accepts both empty representations and rejects body parameters',async()=>{
 for(const body of [undefined,'',new ReadableStream({start(c){c.enqueue(new Uint8Array(0));c.close();}})]) {
  let calls=0;const h=createHandler({env:edgeEnv,fetchImpl:async()=>{calls++;return Response.json(rows());}});
  const r=new Request('https://test.invalid',{method:'POST',headers:{'X-Gridly-Monitor-Token':TOKEN,'Content-Length':'0'},...(body===undefined?{}:{body,duplex:'half'})});
  assert.equal((await h(r)).status,200);assert.equal(calls,1);
 }
 for(const body of ['{}',' ',new Uint8Array([1])]) {
  let calls=0;const h=createHandler({env:edgeEnv,fetchImpl:async()=>{calls++;}});
  assert.equal((await h(new Request('https://test.invalid',{method:'POST',headers:{'X-Gridly-Monitor-Token':TOKEN},body}))).status,400);assert.equal(calls,0);
 }
});
test('Authorization alone is never accepted and invalid dedicated token never reads body',async()=>{
 let calls=0;const h=createHandler({env:edgeEnv,fetchImpl:async()=>{calls++;}});
 assert.equal((await h(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer '+TOKEN}}))).status,401);
 const req={method:'POST',url:'https://test.invalid',headers:new Headers({'X-Gridly-Monitor-Token':'b'.repeat(64)}),get body(){throw Error('body accessed before authentication');}};
 assert.equal((await h(req)).status,401);assert.equal(calls,0);
});

test('EDGE_URL missing/unexpected fails before network',async()=>{
 for(const url of [undefined,'','https://evil.invalid','https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/other']){
 let calls=0;await assert.rejects(edgeHealth({GRIDLY_MONITOR_TOKEN:TOKEN,EDGE_URL:url},async()=>{calls++;}),{message:'monitor_configuration_missing'});assert.equal(calls,0);
 }
});
import workerEntry from '../tools/retention/cleanup-alert-worker/worker.mjs';
import { readFileSync } from 'node:fs';
test('scheduled healthy phase: no deadman succeeds, configured ping works/fails visibly, zero emails/writes',async()=>{
 const original=globalThis.fetch;
 try{for(const mode of ['absent','present','failed']){
 let edgeCalls=0,pings=0,emails=0,writes=0;
 const live=rows();for(const r of live){r.latest_run_at=new Date().toISOString();r.last_success_at=r.latest_run_at;}
 globalThis.fetch=async url=>{if(url.includes('/functions/')){edgeCalls++;return Response.json(live);}if(url.startsWith('https://hc-ping.com/')){pings++;return new Response('',{status:mode==='failed'?500:200});}emails++;throw Error('unexpected_email');};
 const env={EDGE_URL:'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-cleanup-health',GRIDLY_MONITOR_TOKEN:TOKEN,RESEND_API_KEY:'test-only',ALERT_FROM:CONFIG.from,ALERT_TO:CONFIG.to,ALERT_STATE:{get:async()=>null,put:async()=>{writes++;},delete:async()=>{writes++;}},...(mode==='absent'?{}:{DEADMAN_PING_URL:'https://hc-ping.com/'+EMAIL_ID})};
 if(mode==='failed')await assert.rejects(workerEntry.scheduled({},env),{message:'gridly_cleanup_alert_run_failed'});else await workerEntry.scheduled({},env);
 assert.equal(edgeCalls,1);assert.equal(pings,mode==='absent'?0:1);assert.equal(emails,0);assert.equal(writes,0);
 }}finally{globalThis.fetch=original;}
});
test('deployment config preserves exact name/cadence/KV and contains no Hyperdrive',()=>{
 const config=JSON.parse(readFileSync(new URL('../tools/retention/cleanup-alert-worker/wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'gridly-cleanup-alert-production');assert.deepEqual(config.triggers.crons,['* * * * *']);assert.deepEqual(config.kv_namespaces,[{binding:'ALERT_STATE',id:'b09eb7275e614d1bb44783f11f51125a'}]);assert.equal(config.hyperdrive,undefined);
 const source=readFileSync(new URL('../tools/retention/cleanup-alert-worker/worker.mjs',import.meta.url),'utf8');assert.equal(/HYPERDRIVE|connectionString|DATABASE_URL|import pg/.test(source),false);
});

test('redirect responses never follow credential-bearing calls',async()=>{
 let calls=0;await assert.rejects(edgeHealth({GRIDLY_MONITOR_TOKEN:TOKEN,EDGE_URL:'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-cleanup-health'},async(_,opts)=>{calls++;assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://evil.invalid'}});}),{message:'query_failed'});assert.equal(calls,1);
 await assert.rejects(sendAlert(monitorError(NOW),{...CONFIG,fetchImpl:async(_,opts)=>{assert.equal(opts.redirect,'manual');return new Response(null,{status:302});}}),{message:'delivery_failed'});
 await assert.rejects(heartbeat({DEADMAN_PING_URL:'https://hc-ping.com/'+EMAIL_ID},async(_,opts)=>{assert.equal(opts.redirect,'manual');return new Response(null,{status:302});}),{message:'deadman_failed'});
});
