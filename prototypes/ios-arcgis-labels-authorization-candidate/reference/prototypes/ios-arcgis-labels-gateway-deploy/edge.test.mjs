import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEdgeHandler, prefix } from './supabase/functions/gridly-labels/edge.mjs';
import { admissionPorts, createRuntime, databaseState } from './supabase/functions/gridly-labels/runtime.mjs';
import { proofBytes } from './supabase/functions/gridly-labels/foundation/protocol.mjs';
import { tilePath as target, tileProofBytes } from './supabase/functions/gridly-labels/tile-wire.mjs';
import { p256Key, verifyProof } from './supabase/functions/gridly-labels/web-proof.mjs';
import { createMemoryState } from './supabase/functions/gridly-labels/foundation/state.mjs';

const fixture = readFileSync(new URL('../ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/valid.png', import.meta.url));
const vector = JSON.parse(readFileSync(new URL('../ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/wire-proof.json', import.meta.url)));
const fixedVector = JSON.parse(readFileSync(new URL('./native-fixed-path/Tests/GridlyFixedPathTileTests/tile-proof.json', import.meta.url)));
const origin = 'https://labels-pilot.invalid';
const canonicalBody = '{"level":12,"row":1689,"column":968}';
const legacyTarget = '/v1/imagery-labels/12/1689/968';
const ingress = 'a'.repeat(64);
const token = 'fixture-token-never-public';
const secret = 'fixture-secret-never-public';
const pair = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const png = data => new Response(data, { headers: { 'content-type': 'image/png' } });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function setup(options = {}) {
  let now = 1794484800000;
  let tokens = 0, tiles = 0;
  const memory = createMemoryState({ policy: options.policy });
  memory.setEnabled(true);
  const pending = new Map();
  const state = { ...memory, ingress: async () => options.ingress ?? 'ok',
    record: options.record,
    reserveOAuth: async () => options.oauthAllowed ?? true,
    pending: async id => pending.get(id) > now,
    challenge: async id => pending.set(id, now + 119_000).get(id),
    issue: (lease, id, expiration, stamp) => {
      const actual = pending.get(id);
      if (!(actual > stamp)) return 'denied';
      pending.delete(id);
      return memory.issue(lease, id, Math.min(actual, expiration), stamp);
    } };
  const admission = admissionPorts({
    apple: async ({ evidence, environment }) => ({ verified: true, kind: 'paid_admission', revoked: false,
      environment, lineage: evidence, verifiedAt: now, periodEnd: now + 600_000, ...options.paid }),
    attest: async ({ evidence, signal, ...binding }) => ({ ...binding, verified: true,
      installation: evidence, verifiedAt: now, challengeExpiresAt: now + 119_000, ...options.attest })
  });
  const config = { enabled: true, origin, ingressKey: ingress, timeout: 6000, tokenTimeout: 2000, tileTimeout: 3000,
    maxInFlight: 32, maxBytes: 524288,
    provider: { GRIDLY_LABELS_ESRI_ENABLED: 'true', GRIDLY_LABELS_ESRI_CLIENT_ID: 'fixture-id',
      GRIDLY_LABELS_ESRI_CLIENT_SECRET: secret }, ...options.config };
  const handler = createEdgeHandler({ state, config, admission, now: () => now, transport: async (url, init) => {
    assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).has('referer'), false);
    if (init.method === 'POST') {
      tokens++;
      assert.equal(url, 'https://www.arcgis.com/sharing/rest/oauth2/token');
      return options.token?.(init) ?? Response.json({ access_token: token, expires_in: 1200 });
    }
    tiles++;
    assert.match(url, /^https:\/\/static-map-tiles-api\.arcgis\.com\/arcgis\/rest\/services\/static-basemap-tiles-service\/v1\/arcgis\/imagery\/labels\/static\/tile\/12\/1689\/968$/);
    assert.equal(new Headers(init.headers).get('authorization'), 'Bearer ' + token);
    return options.tile?.(init) ?? png(fixture);
  } });
  function request(path, init = {}, base = prefix) {
    const defaults = path === target ? { method: 'POST', body: canonicalBody } : {};
    if (init.method === 'GET') delete defaults.body;
    return handler(new Request(origin + base + path, { ...defaults, ...init, headers: {
      ...(path === target ? { 'content-type': 'application/json' } : {}),
      'x-gridly-pilot-ingress': ingress, ...init.headers } }));

  }
  async function issue(key = pair(), owner = 'install') {
    const response = await request('/v1/labels/challenge', { method: 'POST' }, '/gridly-labels');
    assert.equal(response.status, 201);
    const { challengeId } = await response.json();
    const body = JSON.stringify({ challengeId, paidEvidence: owner, attestEvidence: owner,
      spki: key.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url') });
    const retry = () => request('/v1/labels/lease', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const result = await retry();
    return { status: result.status, ...await result.json(), key, retry };
  }
  async function signed(lease, key = lease.key, requestId = randomUUID(), proof = tileProofBytes) {
    const fields = { leaseId: lease.leaseId, timestamp: now, requestId, target: legacyTarget, method: 'GET', body: canonicalBody };
    const privateKey = await crypto.subtle.importKey('pkcs8', key.privateKey.export({ type: 'pkcs8', format: 'der' }),
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const signature = Buffer.from(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey,
      proof(fields, origin)));
    return { 'x-gridly-labels-lease': lease.leaseId, 'x-gridly-labels-timestamp': String(now),
      'x-gridly-labels-request': requestId, 'x-gridly-labels-signature': signature.toString('base64url') };
  }
  return { memory, request, issue, signed, counts: () => ({ tokens, tiles }), advance: ms => { now += ms; } };
}

test('Web Crypto preserves the certified SPKI and rejects a legacy tile proof', async () => {
  const key = await p256Key(Buffer.from(vector.publicKeySPKI, 'base64').toString('base64url'));
  assert.equal(key.fingerprint, 'BNh3zlADIaEw0DQ6HhZZWPt99knZQKuSPGCyYDuJICw');
  assert.equal(await verifyProof({ ...vector.proof, body: canonicalBody }, origin, key.key), false);
  assert.equal(await p256Key('A'.repeat(122)), null);
});

test('shared Swift vector pins the signed POST body and raw P1363 bytes', async () => {
  const { publicKey, signature, origin, canonical, ...proof } = fixedVector;
  const key = await p256Key(Buffer.from(publicKey, 'base64').toString('base64url'));
  assert.equal(tileProofBytes(proof, origin).toString(), canonical);
  const signed = { ...proof, signature: Buffer.from(signature, 'base64').toString('base64url') };
  assert.equal(await verifyProof(signed, origin, key.key), true);
  assert.equal(await verifyProof({ ...signed, body: proof.body.replace('1689', '1690') }, origin, key.key), false);
});

test('unwired runtime remains closed even with enable switches set', async () => {
  const ref = 'abcdefghijklmnopqrst';
  const values = { GRIDLY_LABELS_PROJECT_REF: ref, SUPABASE_URL: 'https://' + ref + '.supabase.co',
    GRIDLY_LABELS_PILOT_ENABLED: 'true', GRIDLY_LABELS_PUBLIC_ORIGIN: origin, GRIDLY_LABELS_INGRESS_KEY: ingress,
    GRIDLY_LABELS_DATABASE_URL: 'postgres://label_pilot_runtime:fixture@db.' + ref + '.supabase.co/postgres',
    GRIDLY_LABELS_ESRI_ENABLED: 'true' };
  let touched = 0;
  const runtime = createRuntime({ get: name => values[name], connect: () => { touched++; },
    admission: admissionPorts({ apple: () => true }), transport: () => { touched++; } });
  assert.equal((await runtime(new Request(origin + prefix + '/health'))).status, 200);
  assert.equal((await runtime(new Request(origin + prefix + target, { method: 'POST' }))).status, 503);
  assert.equal(touched, 0);
  assert.equal((await setup({ config: { enabled: false } }).request(target)).status, 503);
});

test('closed ingress, bounded body and canonical route validation precede upstream', async () => {
  const s = setup();
  assert.equal((await s.request(target, { headers: { 'x-gridly-pilot-ingress': 'b'.repeat(64) } })).status, 401);
  for (const bad of [target + '?upstream=other.invalid', target + '/', '/v1/imagery-labels/02/1/1',
    '/v1/imagery-labels/12/4096/2', '/v1/imagery-labels/12/1/%31', '/v1/imagery-labels/12/1/1%2f2']) {
    assert.equal((await s.request(bad)).status, 404);
  }
  assert.equal((await s.request(target, { method: 'GET' })).status, 405);
  assert.equal((await s.request('/v1/labels/lease', { method: 'POST', body: 'x'.repeat(48 * 1024 + 1),
    headers: { 'content-type': 'application/json' } })).status, 400);
  assert.equal((await setup({ ingress: 'limited' }).request('/v1/labels/challenge', { method: 'POST' })).status, 429);
  assert.deepEqual(s.counts(), { tokens: 0, tiles: 0 });
});

test('entitlement, App Attest, environment and forged client verdicts are denied', async () => {
  for (const options of [{ paid: { verified: false } }, { paid: { periodEnd: 1 } }, { paid: { environment: 'production' } },
    { attest: { verified: false } }, { attest: { environment: 'development' } }, { attest: { binding: 'wrong' } }]) {
    const s = setup(options);
    assert.equal((await s.issue()).status, 401);
    assert.deepEqual(s.counts(), { tokens: 0, tiles: 0 });
  }
  const s = setup();
  const body = JSON.stringify({ paid: true, verified: true, integrity: true, challengeId: randomUUID() });
  assert.equal((await s.request('/v1/labels/lease', { method: 'POST', body,
    headers: { 'content-type': 'application/json' } })).status, 401);
});

test('proof, lease, expiry, revocation, replay and no cross-user sharing', async () => {
  const s = setup();
  const a = await s.issue(), b = await s.issue(pair(), 'other');
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal((await a.retry()).status, 401);
  assert.equal((await s.request(target, { headers: await s.signed(a, b.key) })).status, 401);
  const proof = await s.signed(a);
  const response = await s.request(target, { headers: proof });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
  assert.equal((await s.request(target, { headers: proof })).status, 401);
  assert.equal((await s.request(target, { headers: await s.signed(b) })).status, 200);
  assert.deepEqual(s.counts(), { tokens: 1, tiles: 2 });
  s.memory.revoke(a.leaseId);
  assert.equal((await s.request(target, { headers: await s.signed(a) })).status, 401);
  s.advance(300_001);
  assert.equal((await s.request(target, { headers: await s.signed(b) })).status, 401);
});

test('body bytes, method, fixed path, origin and digest are bound to the new proof', async () => {
  const events = [];
  const s = setup({ record: async (...args) => { events.push(args); } });
  const lease = await s.issue();
  const proof = await s.signed(lease);
  const badProofs = [
    (fields, host) => tileProofBytes({ ...fields, body: '{}' }, host),
    (fields, host) => tileProofBytes(fields, host).toString().replace('"POST"', '"GET"'),
    (fields, host) => tileProofBytes(fields, host).toString().replace(target, '/v1/imagery-labels/other'),
    fields => tileProofBytes(fields, 'https://other.invalid'),
    proofBytes
  ];
  for (const encode of badProofs) {
    const response = await s.request(target, { headers: await s.signed(lease, lease.key, randomUUID(),
      (fields, host) => Buffer.from(encode(fields, host))) });
    assert.equal(response.status, 401);
  }
  assert.equal((await s.request(target, { headers: proof, body: canonicalBody.replace('1689', '1690') })).status, 401);
  for (const body of [
    ' ' + canonicalBody, canonicalBody + '\n', '\uFEFF' + canonicalBody,
    canonicalBody.replace('"row"', '"r\\u006fw"'), '{"row":1689,"level":12,"column":968}',
    canonicalBody.replace('1689', '1689.0'), canonicalBody.replace('1689', '1e3'),
    canonicalBody.replace('1689', '4096'), canonicalBody.replace('1689', '-0'),
    canonicalBody.replace('1689', '"1689"'), canonicalBody.replace('1689', '01689'),
    canonicalBody.replace('1689', 'true'), canonicalBody.replace('1689', 'null'),
    canonicalBody.replace('"row":1689', '"row":1,"row":1689'),
    canonicalBody.replace('}', ',"url":"https://other.invalid"}'),
    'x'.repeat(65), new Uint8Array([0xff])
  ]) {
    const response = await s.request(target, { headers: proof, body });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /^\{"code":"invalid_(?:tile|request)"\}$/);
  }
  for (const headers of [{ 'content-type': 'application/json; charset=utf-8' }, { 'content-encoding': 'gzip' }]) {
    assert.equal((await s.request(target, { headers: { ...proof, ...headers } })).status, 400);
  }
  assert.equal((await s.request(target, { headers: { ...proof, 'x-gridly-pilot-ingress': '' } })).status, 401);
  assert.equal((await s.request(legacyTarget, { headers: proof })).status, 404);
  assert.equal((await s.request(target + '?row=1689', { headers: proof })).status, 404);
  assert.deepEqual(s.counts(), { tokens: 0, tiles: 0 });
  assert.equal(s.memory.metrics().attempts, 0);
  assert.ok(events.every(event => event.length === 2 && !JSON.stringify(event).includes('1689')));
  assert.equal((await s.request(target, { headers: proof })).status, 200);
  assert.equal((await s.request(target, { headers: proof })).status, 401);
});

test('synthetic outage, OAuth rejection, invalid/oversized PNG, and kill switch are safe', async () => {
  for (const [options, expected] of [
    [{ token: () => Response.json({ error: { code: 401, marker: secret } }) }, 502],
    [{ tile: () => new Response(secret, { status: 500 }) }, 502],
    [{ tile: () => png(secret) }, 502],
    [{ tile: () => png(Buffer.alloc(524289)) }, 502],
    [{ oauthAllowed: false }, 503],
    [{ config: { provider: { GRIDLY_LABELS_ESRI_ENABLED: 'false' } } }, 503]
  ]) {
    const s = setup(options);
    const lease = await s.issue();
    const response = await s.request(target, { headers: await s.signed(lease) });
    assert.equal(response.status, expected);
    assert.match(await response.text(), /^\{"code":"(?:temporarily_unavailable|upstream_failed)"\}$/);
  }
  const s = setup();
  const lease = await s.issue();
  s.memory.setEnabled(false);
  assert.equal((await s.request(target, { headers: await s.signed(lease) })).status, 503);
  assert.deepEqual(s.counts(), { tokens: 0, tiles: 0 });
});

test('concurrent quotas, timeout and cancellation never release unsettled work early', async () => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const s = setup({ config: { timeout: 1400, tileTimeout: 50 },
    tile: ({ signal }) => new Promise((_, reject) => {
      entered();
      signal.addEventListener('abort', () => setTimeout(() => reject(Error(secret)), 80), { once: true });
    }) });
  const lease = await s.issue();
  const abort = new AbortController();
  const cancelled = s.request(target, { headers: await s.signed(lease), signal: abort.signal });
  await Promise.race([started, delay(1000).then(() => assert.fail('synthetic tile transport did not start'))]);
  abort.abort();
  assert.equal((await cancelled).status, 408);
  assert.equal(s.memory.metrics().active, 1);
  await delay(185);
  assert.equal(s.memory.metrics().active, 0);
  const result = await s.request(target, { headers: await s.signed(lease) });
  assert.equal(result.status, 504);
  const burst = setup({ tile: async () => { await delay(30); return png(fixture); } });
  const issued = await burst.issue();
  const responses = await Promise.all(Array.from({ length: 12 }, async () => burst.request(target, { headers: await burst.signed(issued) })));
  assert.equal(responses.filter(r => r.status === 200).length, 4);
  assert.equal(responses.filter(r => r.status === 429).length, 8);
  assert.deepEqual(burst.counts(), { tokens: 1, tiles: 4 });
});

test('database adapter uses parameter binding and normalizes driver bigint challenges', async () => {
  const calls = [];
  const state = databaseState(async (sql, values) => {
    calls.push([sql, values]);
    return { rows: [{ result: sql.includes('new_challenge') ? '1794484900000' : 'ok' }] };
  });
  const challenge = randomUUID();
  assert.equal(await state.challenge(challenge), 1794484900000);
  assert.equal(await state.ingress(), 'ok');
  assert.equal(await state.issue({ marker: secret }, challenge, 1, 2), 'ok');
  assert.equal(calls[0][1][0], challenge);
  assert.equal(calls[2][0].includes(secret), false);
  assert.equal(JSON.parse(calls[2][1][0]).marker, secret);
});

test('operational telemetry exposes only bounded outcome and dispatch categories', async () => {
  const events = [];
  const s = setup({ record: async (...args) => { events.push(args); },
    tile: () => new Response(secret, { status: 500 }) });
  const lease = await s.issue();
  assert.equal((await s.request(target, { headers: await s.signed(lease, pair()) })).status, 401);
  assert.equal((await s.request(target, { headers: await s.signed(lease) })).status, 502);
  assert.deepEqual(events.map(event => event[0]).sort(), [
    'authorization_denied', 'oauth_dispatch_intent', 'ok', 'ok', 'provider_failed', 'tile_dispatch_intent'
  ]);
  assert.ok(events.every(([_, ms, ...rest]) => Number.isInteger(ms) && ms >= 0 && ms <= 10000 && !rest.length));
  assert.ok(!JSON.stringify(events).includes(secret));
});

test('provider exception cannot leak request body, proof or secrets into responses or application logs', async () => {
  const output = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  const original = methods.map(method => console[method]);
  let response, proof;
  try {
    methods.forEach(method => { console[method] = (...args) => output.push(args); });
    const s = setup({ tile: () => { throw Error(canonicalBody + ' ' + secret + ' ' + token); } });
    const lease = await s.issue();
    proof = await s.signed(lease);
    response = await s.request(target, { headers: { ...proof, authorization: 'Bearer synthetic-incoming-secret' } });
  } finally {
    methods.forEach((method, index) => { console[method] = original[index]; });
  }
  assert.equal(response.status, 502);
  assert.equal(await response.text(), '{"code":"upstream_failed"}');
  assert.deepEqual(output, []);
  assert.equal(new URL(origin + prefix + target).pathname, '/functions/v1/gridly-labels/v1/imagery-labels/tile');
  assert.equal(response.headers.has('authorization'), false);
  assert.equal(response.headers.has('x-gridly-labels-signature'), false);
  assert.equal(response.headers.has('x-gridly-pilot-ingress'), false);
});

test('optional synthetic Fetch adapter timing sample', { skip: process.env.GRIDLY_LABELS_LOCAL_BENCH !== '1' }, async () => {
  let fail = false;
  const s = setup({ tile: () => fail ? new Response(secret, { status: 500 }) : png(fixture) });
  const initial = performance.now();
  const lease = await s.issue();
  assert.equal(lease.status, 201);
  const issueMs = performance.now() - initial;
  const values = { rejectedProofMs: [], validTileMs: [], providerFailureMs: [] };
  async function time(list, headers, status) {
    const before = performance.now();
    const result = await s.request(target, { headers });
    assert.equal(result.status, status);
    await result.arrayBuffer();
    list.push(performance.now() - before);
  }
  const other = pair();
  for (let i = 0; i < 12; i++) {
    await time(values.rejectedProofMs, await s.signed(lease, other), 401);
    await time(values.validTileMs, await s.signed(lease), 200);
  }
  fail = true;
  for (let i = 0; i < 12; i++) await time(values.providerFailureMs, await s.signed(lease), 502);
  console.log(JSON.stringify({ issueMs: +issueMs.toFixed(2), ...Object.fromEntries(Object.entries(values)
    .map(([name, samples]) => [name, +samples.toSorted((a, b) => a - b)[6].toFixed(2)])), ...s.counts() }));
});
