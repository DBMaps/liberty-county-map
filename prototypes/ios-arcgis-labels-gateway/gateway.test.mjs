import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { registerHooks } from 'node:module';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { createMockTileProvider, LABELS_AUDIENCE, LABELS_SCOPE, parseTileTarget } from './gateway.mjs';
import { isMockTilePng, MAX_TILE_BYTES } from './png.mjs';
import { START, syntheticScenario, TARGET } from './synthetic.mjs';

async function lease(scenario, client = scenario.client(), options) {
  const issued = await scenario.gateway.issueLease(client.evidence(options));
  assert.equal(issued.status, 201);
  return { client, issued, send: overrides => scenario.gateway.requestTile(client.request(issued, overrides)) };
}

function countedProvider(implementation = createMockTileProvider()) {
  const calls = [];
  return { calls, provider: (tile, context) => { calls.push(tile); return implementation(tile, context); } };
}

function heldProvider() {
  const waiting = [];
  return { waiting, provider: (tile, { signal }) => new Promise(resolve => waiting.push({ resolve, signal })) };
}

test('fresh synthetic paid and integrity decisions issue a labels-only lease', async () => {
  const s = syntheticScenario();
  const { issued } = await lease(s);
  assert.deepEqual(Object.keys(issued).sort(), ['audience', 'environment', 'expiresAt', 'issuedAt', 'leaseId', 'scope', 'status']);
  assert.equal(issued.audience, LABELS_AUDIENCE);
  assert.equal(issued.scope, LABELS_SCOPE);
  assert.equal(issued.issuedAt, START);
  assert.equal(issued.expiresAt, START + 300_000);
  assert.equal((await s.gateway.requestTile({ method: 'GET', target: TARGET, leaseId: 'ordinary-admission-proof' })).status, 401);
});

test('expiry is capped by paid period and freshness of the paid decision', async () => {
  const s = syntheticScenario();
  assert.equal((await lease(s, s.client(), { paid: { periodEnd: START + 10_000 } })).issued.expiresAt, START + 10_000);
  assert.equal((await lease(s, s.client(), { paid: { verifiedAt: START - 240_000 } })).issued.expiresAt, START + 60_000);
});

for (const [name, options] of [
  ['invalid paid decision', { paid: { verified: false } }],
  ['expired paid period', { paid: { periodEnd: START } }],
  ['revoked subscription', { paid: { revoked: true } }],
  ['stale paid verification', { paid: { verifiedAt: START - 300_000 } }],
  ['continuity-only proof', { paid: { kind: 'continuity' } }],
  ['sandbox paid evidence for production', { paid: { environment: 'sandbox' }, integrity: { environment: 'sandbox' } }],
  ['mixed paid and integrity environments', { integrity: { environment: 'sandbox' } }],
  ['wrong requested environment', { requested: 'sandbox' }],
  ['failed integrity decision', { integrity: { verified: false } }],
  ['stale integrity evidence', { integrity: { verifiedAt: START - 120_000 } }],
  ['integrity bound to a different purchase decision', { integrity: { paidEvidenceId: 'unrelated' } }],
  ['integrity bound to a different key', { integrity: { keyFingerprint: 'unrelated' } }]
]) {
  test(`issuance rejects ${name}`, async () => {
    const s = syntheticScenario();
    assert.equal((await s.gateway.issueLease(s.client().evidence(options))).status, 401);
    assert.equal(s.gateway.inspect().leases, 0);
  });
}

test('missing key, private key and non-P-256 public key are rejected', async () => {
  const s = syntheticScenario(), input = s.client().evidence();
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  for (const key of [undefined, privateKey, publicKey]) {
    assert.equal((await s.gateway.issueLease({ ...input, publicKey: key })).status, 401);
  }
});

test('caller-supplied decisions and unknown evidence cannot confer eligibility', async () => {
  const s = syntheticScenario(), input = s.client().evidence();
  assert.equal((await s.gateway.issueLease({ ...input, paidEvidence: { verified: true } })).status, 401);
  assert.equal((await s.gateway.issueLease({ ...input, paidEvidence: 'unregistered', paid: { verified: true } })).status, 401);
  assert.equal((await s.gateway.issueLease({ ...input, integrityEvidence: 'unregistered' })).status, 401);
});

test('sandbox issuance is isolated from the production gateway', async () => {
  const s = syntheticScenario({ environment: 'sandbox' }), production = syntheticScenario();
  const { client, issued } = await lease(s);
  assert.equal(issued.environment, 'sandbox');
  assert.equal((await production.gateway.requestTile(client.request(issued))).status, 401);
});

test('a challenge can issue only one lease even under concurrent exchanges', async () => {
  const s = syntheticScenario(), evidence = s.client().evidence();
  const results = await Promise.all(Array.from({ length: 8 }, () => s.gateway.issueLease(evidence)));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 401, 401, 401, 401, 401, 401, 401]);
});

test('real request signature returns a bounded 512 × 512 PNG', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ provider });
  const { send } = await lease(s);
  const result = await send();
  assert.equal(result.status, 200);
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.cacheControl, 'no-store');
  assert.ok(isMockTilePng(result.body));
  assert.deepEqual(calls, [{ level: 12, row: 1689, column: 968 }]);
});

test('missing, invalid, wrong-key, modified method/path/lease and skew never reach provider', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ provider });
  const { client, issued } = await lease(s);
  const other = await lease(s);
  const signed = client.request(issued);
  const attempts = [
    [{ ...signed, signature: undefined }, 401], [{ ...signed, signature: '!'.repeat(86) }, 401],
    [{ ...signed, signature: Buffer.alloc(64).toString('base64url') }, 401],
    [other.client.request(issued), 401], [{ ...signed, method: 'POST' }, 405],
    [{ ...client.request(issued, { method: 'POST' }), method: 'GET' }, 401],
    [{ ...signed, target: '/v1/imagery-labels/0/0/0' }, 401], [{ ...signed, leaseId: other.issued.leaseId }, 401],
    [{ ...signed, timestamp: signed.timestamp + 1 }, 401], [{ ...signed, requestId: other.client.request(other.issued).requestId }, 401],
    [client.request(issued, { timestamp: START - 30_001 }), 401],
    [client.request(issued, { timestamp: START + 30_001 }), 401]
  ];
  for (const [request, status] of attempts) assert.equal((await s.gateway.requestTile(request)).status, status);
  assert.equal(calls.length, 0);
  assert.equal(s.gateway.inspect().attemptsToday, 0);
});

test('expired and revoked leases fail, including revocation during a provider attempt', async () => {
  const { waiting, provider } = heldProvider();
  const s = syntheticScenario({ provider });
  const expired = await lease(s, s.client(), { paid: { periodEnd: START + 1000 } });
  s.advance(1000);
  assert.equal((await expired.send()).status, 401);
  const live = await lease(s);
  const pending = live.send();
  assert.equal(s.gateway.revokeLease(live.issued.leaseId), true);
  assert.equal((await live.send()).status, 401);
  waiting[0].resolve(await createMockTileProvider()());
  assert.equal((await pending).status, 401);
  assert.equal(waiting.length, 1);
});

test('concurrent replay and reuse of an identifier for another target are rejected', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ provider });
  const { client, issued } = await lease(s);
  const request = client.request(issued);
  const results = await Promise.all([s.gateway.requestTile(request), s.gateway.requestTile(request)]);
  assert.deepEqual(results.map(r => r.status), [200, 401]);
  assert.equal((await s.gateway.requestTile(client.request(issued, { requestId: request.requestId, target: '/v1/imagery-labels/0/0/0' }))).status, 401);
  assert.equal(calls.length, 1);
});

test('canonical boundary tiles accepted and malformed targets rejected without budget usage', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ provider });
  const { send } = await lease(s);
  const invalid = ['20/0/0', '19/524288/0', '1/0/2', '0/1/0', '01/0/0', '1/00/0', '1/-1/0',
    '1/+1/0', '1/0.0/0', '1/0/1e0', '1/0/0/', '1/0/0?url=https://host.invalid', '1/0/0?', '1/0/0#',
    '../1/0/0', '1/../0', '%2e%2e/1/0/0', '1/%ZZ/0', '1/%30/0', '1/0/0\n', '1//0/0', '1/0\\/0'];
  for (const target of [...invalid.map(suffix => '/v1/imagery-labels/' + suffix),
    'https://labels.mock.invalid' + TARGET, 'https://other.invalid' + TARGET, 'http://labels.mock.invalid' + TARGET, '//' + TARGET]) {
    assert.equal((await send({ target })).status, 400, JSON.stringify(target));
  }
  assert.equal((await send({ upstream: 'https://other.invalid' })).status, 400);
  assert.equal((await send({ host: 'other.invalid' })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal(s.gateway.inspect().attemptsToday, 0);
  assert.deepEqual(parseTileTarget('/v1/imagery-labels/19/524287/524287'), { level: 19, row: 524287, column: 524287 });
  assert.equal((await send({ target: '/v1/imagery-labels/0/0/0' })).status, 200);
});

for (const [limit, clientA, clientB] of [
  ['installationDaily', { installation: 'same-install' }, { installation: 'same-install' }],
  ['lineageDaily', { lineage: 'same-lineage' }, { lineage: 'same-lineage' }],
  ['aggregateDaily', {}, {}]
]) {
  test(`${limit} is enforced across leases without contacting provider again`, async () => {
    const { calls, provider } = countedProvider();
    const s = syntheticScenario({ provider, limits: { [limit]: 1 } });
    const a = await lease(s, s.client(clientA)), b = await lease(s, s.client(clientB));
    assert.equal((await a.send()).status, 200);
    assert.equal((await b.send()).status, 429);
    assert.equal(calls.length, 1);
  });
}

test('verified ingress has its own sliding minute and a copied lease ID cannot exhaust it', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ provider, limits: { perMinute: 1 } });
  const { client, issued, send } = await lease(s);
  assert.equal((await s.gateway.requestTile({ ...client.request(issued), signature: undefined })).status, 401);
  assert.equal(s.gateway.inspect().attemptsToday, 0);
  assert.equal((await send()).status, 200);
  s.advance(59_999);
  assert.equal((await send()).status, 429);
  s.advance(1);
  assert.equal((await send()).status, 200);
  assert.equal(calls.length, 2);
});

test('default concurrent limit is four per installation across leases', async () => {
  const { waiting, provider } = heldProvider();
  const s = syntheticScenario({ provider });
  const a = await lease(s, s.client({ installation: 'same-install' }));
  const b = await lease(s, s.client({ installation: 'same-install' }));
  const pending = [a.send(), a.send(), b.send(), b.send()];
  assert.equal((await b.send()).status, 429);
  assert.equal(waiting.length, 4);
  for (const w of waiting) w.resolve(await createMockTileProvider()());
  assert.deepEqual((await Promise.all(pending)).map(r => r.status), [200, 200, 200, 200]);
});

test('concurrent requests cannot overspend a shared daily budget', async () => {
  const { waiting, provider } = heldProvider();
  const s = syntheticScenario({ provider, limits: { aggregateDaily: 2 } });
  const [a, b, c, d] = await Promise.all(Array.from({ length: 4 }, () => lease(s)));
  const pending = [a.send(), b.send()];
  assert.deepEqual((await Promise.all([c.send(), d.send()])).map(r => r.status), [429, 429]);
  assert.equal(waiting.length, 2);
  for (const w of waiting) w.resolve(await createMockTileProvider()());
  assert.deepEqual((await Promise.all(pending)).map(r => r.status), [200, 200]);
  assert.equal(s.gateway.inspect().attemptsToday, 2);
});

test('UTC rollover clears daily limits but keeps the sliding ingress minute', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ start: Date.UTC(2026, 10, 12, 23, 59, 59), provider,
    limits: { aggregateDaily: 1, installationDaily: 1, lineageDaily: 1, perMinute: 2 } });
  const a = await lease(s);
  assert.equal((await a.send()).status, 200);
  assert.equal((await a.send()).status, 429);
  s.advance(1000);
  assert.equal((await a.send()).status, 429);
  s.advance(59_000);
  assert.equal((await a.send()).status, 200);
  assert.equal(s.gateway.inspect().attemptsToday, 1);
  assert.equal(calls.length, 2);
});

test('invalid or oversized PNGs, wrong content type, redirects and upstream failures are sanitized and counted', async () => {
  const good = await createMockTileProvider()();
  const corrupt = Buffer.from(good.body); corrupt[48] ^= 1;
  const wrongSize = Buffer.from(good.body);
  wrongSize.writeUInt32BE(511, 16);
  wrongSize.writeUInt32BE(crc32(wrongSize.subarray(12, 29)), 29);
  const invalids = [Buffer.from('invalid'), good.body.subarray(0, -1), Buffer.alloc(MAX_TILE_BYTES + 1), corrupt, wrongSize];
  const responses = [...invalids.map(body => ({ ...good, body })), { ...good, contentType: 'text/plain' },
    { ...good, status: 302 }, { ...good, redirected: true }, { ...good, status: 500 }, Error('private upstream detail')];
  const { calls, provider } = countedProvider(() => { const value = responses.shift(); if (value instanceof Error) throw value; return value; });
  const s = syntheticScenario({ provider, limits: { aggregateDaily: responses.length } });
  const a = await lease(s);
  for (let i = responses.length; i > 0; i--) assert.deepEqual(await a.send(), { status: 502, code: 'upstream_failed' });
  assert.equal((await a.send()).status, 429);
  assert.equal(calls.length, 10);
});

test('PNG validator rejects valid CRC around invalid filtered data and oversized inflation', async () => {
  const { body } = await createMockTileProvider()();
  for (const scanlines of [Buffer.alloc((512 * 4 + 1) * 512, 5), Buffer.alloc((512 * 4 + 1) * 512 + 1)]) {
    const data = deflateSync(scanlines), chunk = Buffer.alloc(data.length + 12);
    chunk.writeUInt32BE(data.length);
    chunk.write('IDAT', 4);
    data.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
    assert.equal(isMockTilePng(Buffer.concat([body.subarray(0, 33), chunk, body.subarray(-12)])), false);
  }
});

test('timeout counts the attempt and keeps the slot until provider settles', async () => {
  const { waiting, provider } = heldProvider();
  const s = syntheticScenario({ provider, timeoutMs: 10, limits: { perInstallationActive: 1, installationDaily: 1 } });
  const a = await lease(s);
  assert.deepEqual(await a.send(), { status: 504, code: 'upstream_timeout' });
  assert.equal(waiting[0].signal.aborted, true);
  assert.equal(s.gateway.inspect().active, 1);
  assert.equal((await a.send()).status, 429);
  waiting[0].resolve(await createMockTileProvider()());
  await setImmediate();
  assert.equal(s.gateway.inspect().active, 0);
  assert.equal((await a.send()).status, 429);
  assert.equal(waiting.length, 1);
});

test('rapid cancellation keeps pre-cancelled requests out and releases acknowledged work', async () => {
  const { waiting, provider } = heldProvider();
  const s = syntheticScenario({ provider, limits: { perInstallationActive: 2 } });
  const a = await lease(s);
  const stop = new AbortController();
  const requests = [a.send({ signal: stop.signal }), a.send({ signal: stop.signal })];
  stop.abort();
  assert.deepEqual((await Promise.all(requests)).map(r => r.status), [499, 499]);
  assert.equal((await a.send({ signal: stop.signal })).status, 499);
  assert.ok(waiting.every(w => w.signal.aborted));
  assert.equal(s.gateway.inspect().active, 2);
  for (const w of waiting) w.resolve(await createMockTileProvider()());
  await setImmediate();
  assert.equal(s.gateway.inspect().active, 0);
  assert.equal(s.gateway.inspect().attemptsToday, 2);
});

test('no cross-user replay, response sharing, or mutable cached bytes', async () => {
  const { calls, provider } = countedProvider();
  const s = syntheticScenario({ provider });
  const a = await lease(s), b = await lease(s);
  const request = a.client.request(a.issued);
  const first = await s.gateway.requestTile(request);
  assert.equal((await s.gateway.requestTile({ ...request, leaseId: b.issued.leaseId })).status, 401);
  first.body.fill(0);
  const second = await b.send({ requestId: request.requestId });
  assert.equal(second.status, 200);
  assert.ok(isMockTilePng(second.body));
  assert.equal(calls.length, 2);
});

test('state capacity fails closed and recovers when expired records are swept', async () => {
  const s = syntheticScenario({ limits: { maxLeases: 1, maxReplayPerLease: 1, maxChallenges: 1 } });
  const a = await lease(s);
  assert.equal((await s.gateway.issueLease(s.client().evidence())).status, 503);
  assert.equal((await a.send()).status, 200);
  assert.equal((await a.send()).status, 429);
  s.advance(301_000);
  await lease(s);
  assert.deepEqual([s.gateway.inspect().leases, s.gateway.inspect().challenges, s.gateway.inspect().replayIds], [1, 1, 0]);
});

test('mock dependency graph has no external or network modules and runs with fetch disabled', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected fetch'); });
  const allowed = new Set(['node:crypto', 'node:fs', 'node:zlib', './png.mjs', './gateway.mjs', './gateway.mjs?offline']);
  const resolved = new Set();
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL?.includes('/ios-arcgis-labels-gateway/')) {
      assert.ok(allowed.has(specifier), specifier);
      resolved.add(specifier);
    }
    return next(specifier, context);
  } });
  try {
    const { createMockTileProvider: offlineProvider } = await import('./gateway.mjs?offline');
    assert.ok(resolved.has('node:fs') && resolved.has('node:crypto') && resolved.has('./png.mjs'));
    const a = await lease(syntheticScenario({ provider: offlineProvider() }));
    assert.equal((await a.send()).status, 200);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  } finally { hook.deregister(); }
});
