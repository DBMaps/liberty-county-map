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
      latest_run_at: SUCCESS, last_success_at: SUCCESS, retention_state: 'succeeded',
      overdue_count: 0, breached_count: 0 },
    { subsystem: 'compliance_cleanup', job_state: 'active', latest_run_state: 'succeeded',
      latest_run_at: SUCCESS, last_success_at: SUCCESS, retention_state: 'none',
      overdue_count: 0, breached_count: 0 },
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
  overdue[0].overdue_count = 1;
  assert.equal(classifyHealth(overdue, NOW)[0].health_state, 'overdue');
  const breached = rows();
  breached[0].breached_count = 1;
  assert.equal(classifyHealth(breached, NOW)[0].health_state, 'overdue');
});

test('unknown, duplicate, or malformed health rows fail closed', () => {
  assert.throws(() => classifyHealth([rows()[0], rows()[0]], NOW), /invalid_health_projection/);
  const malformed = rows();
  malformed[0].overdue_count = 'unbounded';
  assert.throws(() => classifyHealth(malformed, NOW), /invalid_health_projection/);
  const nullCount = rows();
  nullCount[0].breached_count = null;
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
    queryHealth: async () => [{ ...rows()[0], overdue_count: 'report private text' }, rows()[1]],
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
  assert.equal(sent.length, 2);
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
