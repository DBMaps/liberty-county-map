import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import test from 'node:test';
import { crc32, deflateSync } from 'node:zlib';
import { createEsriProvider } from './esri.mjs';
import { createLabelsGateway } from './gateway.mjs';
import { createNodeHandler } from './http.mjs';
import { attachPilotLabels } from './leaflet-overlay.mjs';
import { createPilotApplication } from './pilot.mjs';
import { maxTileBytes, validTilePng } from './png.mjs';
import { audience, environments, leaseBinding, parseTileTarget, proofBytes, verifyProof } from './protocol.mjs';
import { createMemoryState, limits } from './state.mjs';

const fixture = readFileSync(new URL('../ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/valid.png', import.meta.url));
const vector = JSON.parse(readFileSync(new URL('../ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/wire-proof.json', import.meta.url)));
const origin = 'https://labels-pilot.invalid';
const appId = 'com.gridlygo.prototype.labeltiles.pilot';
const target = '/v1/imagery-labels/12/1689/968';
const tile = { level: 12, row: 1689, column: 968 };
const start = 1794484800000;
const fakeToken = 'synthetic-token-marker';
const fakeSecret = 'synthetic-client-secret-marker';
const keyPair = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

function signed(lease, pair, now = start, overrides = {}) {
  const request = { method: 'GET', target, leaseId: lease.leaseId, timestamp: now, requestId: randomUUID(), ...overrides };
  const signature = sign('sha256', proofBytes(request, origin), { key: pair.privateKey, dsaEncoding: 'ieee-p1363' });
  return { ...request, signature: signature.toString('base64url') };
}

function setup(options = {}) {
  let time = start;
  let enabled = true;
  const state = createMemoryState({ policy: { ...limits, ...options.policy } });
  state.setEnabled(true);
  const pairs = new Map();
  let calls = 0, paidCalls = 0;
  const gateway = createLabelsGateway({
    state, appId, origin, now: () => time, enabled: () => enabled, timeout: options.timeout,
    verifyAttest: options.verifyAttest ?? (async ({ evidence, binding, purpose, challengeId, appId, environment }) => ({
      verified: true, binding, purpose, challengeId, appId, environment, installation: evidence,
      verifiedAt: time, challengeExpiresAt: time + 120_000
    })),
    verifyPaid: options.verifyPaid ?? (async ({ evidence, environment }) => {
      paidCalls++;
      return { verified: true, kind: 'paid_admission', revoked: false, environment, lineage: evidence,
        verifiedAt: time, periodEnd: time + 800_000 };
    }),
    provider: async (...args) => {
      calls++;
      return options.provider ? options.provider(...args) : { status: 200, body: fixture };
    }
  });
  function evidence(pair, installation, lineage, challengeId = randomUUID()) {
    return { spki: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
      challengeId, attestEvidence: installation, paidEvidence: lineage };
  }
  async function issue(installation = 'install', lineage = 'lineage') {
    const pair = keyPair();
    const lease = await gateway.issueLease(evidence(pair, installation, lineage));
    pairs.set(lease.leaseId, pair);
    return lease;
  }
  return {
    gateway, state, evidence, issue, advance: ms => { time += ms; }, disable: () => { enabled = false; },
    request: (lease, overrides) => signed(lease, pairs.get(lease.leaseId), time, overrides),
    calls: () => calls, paidCalls: () => paidCalls
  };
}

function providerSetup({ overrides = {}, transport, enabled = true, envEnabled = 'true' } = {}) {
  const calls = [];
  let time = start;
  const provider = createEsriProvider({
    environment: { GRIDLY_LABELS_ESRI_ENABLED: envEnabled,
      GRIDLY_LABELS_ESRI_CLIENT_ID: 'synthetic-client-id', GRIDLY_LABELS_ESRI_CLIENT_SECRET: fakeSecret },
    enabled: () => enabled, now: () => time,
    transport: async (url, options) => {
      calls.push({ url, options });
      if (transport) return transport(url, options);
      return options.method === 'POST' ? Response.json({ access_token: fakeToken, expires_in: 60 })
        : new Response(fixture, { headers: { 'content-type': 'image/png' } });
    },
    ...overrides
  });
  return { provider, calls, advance: ms => { time += ms; } };
}

test('certified P1363 vector preserves its canonical form and signature, with a separate pilot audience', () => {
  const key = createPublicKey({ key: Buffer.from(vector.publicKeySPKI, 'base64'), type: 'spki', format: 'der' });
  const mockOrigin = 'https://labels.mock.invalid';
  const mockAudience = 'gridly-labels-gateway-mock-v1';
  assert.equal(proofBytes(vector.proof, mockOrigin, mockAudience).toString(), vector.canonical);
  assert.equal(verifyProof(vector.proof, mockOrigin, key, mockAudience), true);
  assert.equal(verifyProof(vector.proof, origin, key), false);
  const pilot = proofBytes(vector.proof, origin).toString();
  assert.equal(pilot, vector.canonical.replace(mockOrigin, origin).replace(mockAudience, audience));
});

test('lease binding is separated by app, environments, challenge, paid evidence and key', () => {
  const input = { appId, challengeId: randomUUID(), paidEvidence: 'evidence', fingerprint: 'fingerprint', ...environments };
  const binding = leaseBinding(input);
  for (const key of Object.keys(input)) assert.notEqual(leaseBinding({ ...input, [key]: 'different' }), binding);
});

test('pilot lease binding agrees with the shared Swift vector', () => {
  const fingerprint = createHash('sha256').update(Buffer.from(vector.publicKeySPKI, 'base64')).digest('base64url');
  assert.equal(fingerprint, 'BNh3zlADIaEw0DQ6HhZZWPt99knZQKuSPGCyYDuJICw');
  assert.equal(leaseBinding({ appId, challengeId: '00000000-0000-4000-8000-000000000003',
    paidEvidence: 'fixture/paid', fingerprint, ...environments }), 'RTh-c0aw-gbVGBX0srYt0MYr0OAHs5K021EsrFTjCMY');
});

test('authorization, OAuth, real tile adapter and gateway deliver one validated unchanged PNG', async () => {
  const p = providerSetup();
  const f = setup({ provider: p.provider });
  const lease = await f.issue();
  assert.equal(lease.status, 201);
  const result = await f.gateway.requestTile(f.request(lease));
  assert.deepEqual(result, { status: 200, body: fixture });
  assert.equal(p.calls.length, 2);
  const [token, image] = p.calls;
  assert.equal(token.url, 'https://www.arcgis.com/sharing/rest/oauth2/token');
  assert.equal(token.options.body.get('grant_type'), 'client_credentials');
  assert.equal(token.options.body.get('client_secret'), fakeSecret);
  assert.equal(image.url, 'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/12/1689/968');
  assert.deepEqual(image.options.headers, { authorization: 'Bearer ' + fakeToken, accept: 'image/png' });
  assert.equal(image.options.redirect, 'error');
  assert.equal(token.options.redirect, 'error');
  assert.equal(f.state.metrics().attempts, 1);
});

test('fails closed without the trusted verifiers, and client flags are rejected', async () => {
  const f = setup();
  const gateway = createLabelsGateway({ state: f.state, appId, origin, provider: () => { throw Error('must not call'); },
    now: () => start, enabled: () => true });
  const evidence = f.evidence(keyPair(), 'install', 'lineage');
  assert.equal((await gateway.issueLease(evidence)).status, 401);
  assert.equal((await f.gateway.issueLease({ ...evidence, paid: true, integrity: true })).status, 401);
  assert.equal(f.paidCalls(), 0);
});

test('rejects wrong native environment before store verification and rejects wrong store environment', async () => {
  const f = setup({ verifyAttest: async input => ({ ...input, verified: true, environment: 'development' }) });
  assert.equal((await f.issue()).status, 401);
  assert.equal(f.paidCalls(), 0);
  const g = setup({ verifyPaid: async () => ({ verified: true, kind: 'paid_admission', revoked: false,
    environment: 'production', lineage: 'lineage', verifiedAt: start, periodEnd: start + 5000 }) });
  assert.equal((await g.issue()).status, 401);
});

test('a reused native challenge cannot issue a second lease', async () => {
  const f = setup();
  const evidence = f.evidence(keyPair(), 'install', 'lineage');
  const results = await Promise.all([f.gateway.issueLease(evidence), f.gateway.issueLease(evidence)]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 401]);
});

test('rejects unauthorized, expired, revoked, wrong-key, stale, and replayed tile requests', async () => {
  const f = setup();
  const lease = await f.issue();
  assert.equal((await f.gateway.requestTile({ method: 'GET', target })).status, 401);
  assert.equal((await f.gateway.requestTile(signed(lease, keyPair()))).status, 401);
  assert.equal((await f.gateway.requestTile(f.request(lease, { timestamp: start - 30_001 }))).status, 401);
  const replay = f.request(lease);
  assert.equal((await f.gateway.requestTile(replay)).status, 200);
  assert.equal((await f.gateway.requestTile(replay)).status, 401);
  assert.equal(f.state.revoke(lease.leaseId), true);
  assert.equal((await f.gateway.requestTile(f.request(lease))).status, 401);
  const other = await f.issue();
  f.advance(300_000);
  assert.equal((await f.gateway.requestTile(f.request(other))).status, 401);
  assert.equal(f.calls(), 1);
});

test('canonical tile coordinates, method and raw target are enforced before provider calls', async () => {
  const f = setup();
  const invalid = [target + '\n', target + '?x=1', target + '#x', origin + target,
    '/v1/imagery-labels/12/01689/968', '/v1/imagery-labels/20/1/1', '/v1/imagery-labels/2/4/0',
    '/v1/imagery-labels/12/../968', '/v1/imagery-labels/12/%31/0'];
  for (const target of invalid) {
    assert.equal(parseTileTarget(target), null);
    assert.equal((await f.gateway.requestTile({ method: 'GET', target })).status, 400);
  }
  assert.equal((await f.gateway.requestTile({ method: 'POST', target })).status, 405);
  assert.equal(f.calls(), 0);
});

test('installation, lineage and aggregate limits each apply across multiple leases', async () => {
  for (const [policy, identities] of [
    [{ installationDaily: 1 }, ['install', 'different']],
    [{ lineageDaily: 1 }, ['different', 'lineage']],
    [{ aggregateDaily: 1 }, ['different', 'different']]
  ]) {
    const f = setup({ policy });
    const first = await f.issue(), second = await f.issue(...identities);
    assert.equal((await f.gateway.requestTile(f.request(first))).status, 200);
    assert.equal((await f.gateway.requestTile(f.request(second))).status, 429);
    assert.equal(f.calls(), 1);
  }
});

test('parallel attempts reserve once and a rolling limit includes budget-denied attempts', async () => {
  let finish;
  const deferred = new Promise(resolve => { finish = resolve; });
  const f = setup({ policy: { perInstallationActive: 1, perMinute: 2 }, provider: () => deferred });
  const lease = await f.issue();
  const first = f.gateway.requestTile(f.request(lease));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.gateway.requestTile(f.request(lease))).status, 429);
  finish({ status: 200, body: fixture });
  assert.equal((await first).status, 200);
  assert.equal((await f.gateway.requestTile(f.request(lease))).status, 429);
  f.advance(60_001);
  assert.equal((await f.gateway.requestTile(f.request(lease))).status, 200);
});

test('timeout and cancellation keep reservations until the transport settles', async () => {
  for (const cancel of [false, true]) {
    let resolve;
    const deferred = new Promise(done => { resolve = done; });
    const f = setup({ policy: { perInstallationActive: 1 }, provider: () => deferred, timeout: 20 });
    const lease = await f.issue();
    const controller = new AbortController();
    const first = f.gateway.requestTile({ ...f.request(lease), signal: controller.signal });
    await new Promise(done => setImmediate(done));
    if (cancel) controller.abort();
    assert.equal((await first).status, cancel ? 499 : 504);
    assert.equal(f.state.metrics().active, 1);
    assert.equal((await f.gateway.requestTile(f.request(lease))).status, 429);
    resolve({ status: 200, body: fixture });
    await new Promise(done => setImmediate(done));
    assert.equal(f.state.metrics().active, 0);
    assert.equal(f.state.metrics().attempts, 1);
  }
});

test('revocation or emergency disable prevents delivery of a pending image', async () => {
  for (const disable of [false, true]) {
    let resolve;
    const f = setup({ provider: () => new Promise(done => { resolve = done; }) });
    const lease = await f.issue();
    const pending = f.gateway.requestTile(f.request(lease));
    await new Promise(done => setImmediate(done));
    if (disable) {
      f.state.setEnabled(false);
      f.state.setEnabled(true);
      f.disable();
    } else f.state.revoke(lease.leaseId);
    resolve({ status: 200, body: fixture });
    assert.equal((await pending).status, 401);
    assert.equal((await f.gateway.requestTile(f.request(lease))).status, disable ? 503 : 401);
  }
});

test('the same tile for different verified users makes two upstream attempts', async () => {
  const f = setup();
  const first = await f.issue('install-1', 'lineage-1');
  const second = await f.issue('install-2', 'lineage-2');
  const results = await Promise.all([first, second].map(lease => f.gateway.requestTile(f.request(lease))));
  assert.ok(results.every(r => r.status === 200));
  assert.equal(f.calls(), 2);
});

test('token reuse, early refresh, and concurrent refresh are bounded', async () => {
  const p = providerSetup();
  await Promise.all(Array.from({ length: 8 }, () => p.provider(tile)));
  assert.equal(p.calls.filter(c => c.options.method === 'POST').length, 1);
  p.advance(47_999);
  assert.equal((await p.provider(tile)).status, 200);
  assert.equal(p.calls.filter(c => c.options.method === 'POST').length, 1);
  p.advance(1);
  await Promise.all(Array.from({ length: 8 }, () => p.provider(tile)));
  assert.equal(p.calls.filter(c => c.options.method === 'POST').length, 2);
  assert.equal(p.calls.filter(c => c.options.method === 'GET').length, 17);
});

test('OAuth 401/403, malformed token responses and redirects fail without exposing provider data', async () => {
  const malformed = [Response.json({ access_token: fakeToken }), Response.json({ access_token: 'bad\nvalue', expires_in: 60 }),
    Response.json({ access_token: fakeToken + '\n', expires_in: 60 }),
    Response.json({ access_token: fakeToken, expires_in: 60, token_type: ['Bearer'] }),
    Response.json({ error: { code: 403, message: fakeSecret } }), Response.redirect('https://different.invalid')];
  for (const reply of [...[401, 403].map(status => new Response(fakeSecret, { status })), ...malformed]) {
    const p = providerSetup({ transport: () => reply });
    const result = await p.provider(tile);
    assert.notEqual(result.status, 200);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-(client-secret|token)-marker/);
    assert.equal(p.calls.length, 1);
    assert.notEqual((await p.provider(tile)).status, 200);
    assert.equal(p.calls.length, 1);
  }
});

test('Esri 429, 401, 403 and network recovery do not trigger automatic upstream retries', async () => {
  for (const status of [429, 401, 403]) {
    let fail = true;
    const p = providerSetup({ transport: (_, options) => options.method === 'POST'
      ? Response.json({ access_token: fakeToken, expires_in: 60 })
      : fail ? new Response(fakeToken, { status }) : new Response(fixture, { headers: { 'content-type': 'image/png' } }) });
    assert.equal((await p.provider(tile)).status, status === 429 ? 503 : 502);
    assert.equal(p.calls.length, 2);
    if (status === 429) {
      assert.equal((await p.provider(tile)).status, 503);
      assert.equal(p.calls.length, 2);
    }
    fail = false;
    p.advance(5001);
    assert.equal((await p.provider(tile)).status, 200);
    assert.equal(p.calls.filter(c => c.options.method === 'GET').length, 2);
  }
});

test('provider timeout is bounded and a late response cannot deliver or release an active slot early', async () => {
  let resolve, tileSignal;
  const p = providerSetup({ overrides: { tileTimeout: 8 }, transport: (_, options) => {
    if (options.method === 'POST') return Response.json({ access_token: fakeToken, expires_in: 60 });
    tileSignal = options.signal;
    return new Promise(done => { resolve = done; });
  } });
  const f = setup({ timeout: 24, provider: p.provider });
  const lease = await f.issue();
  assert.equal((await f.gateway.requestTile(f.request(lease))).status, 504);
  assert.equal(tileSignal.aborted, true);
  assert.equal(f.state.metrics().active, 1);
  resolve(new Response(fixture, { headers: { 'content-type': 'image/png' } }));
  await new Promise(done => setImmediate(done));
  assert.equal(f.state.metrics().active, 0);
});

function chunk(name, data = Buffer.alloc(0)) {
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length);
  result.write(name, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, result.length - 4)), result.length - 4);
  return result;
}

function png(type, bits, rows, options = {}) {
  const head = Buffer.from([0, 0, 2, 0, 0, 0, 2, 0, bits, type, 0, 0, options.interlaced ?? 0]);
  return Buffer.concat([fixture.subarray(0, 8), chunk('IHDR', head), ...(options.before ?? []),
    chunk('IDAT', options.compressed ?? deflateSync(rows)), chunk('IEND')]);
}

test('strict PNG accepts fixture, RGB, indexed with transparency, 16-bit gray and Adam7', () => {
  assert.equal(validTilePng(fixture), true);
  assert.equal(validTilePng(png(2, 8, Buffer.alloc((1536 + 1) * 512))), true);
  const palette = chunk('PLTE', Buffer.from([0, 0, 0, 255, 255, 255]));
  assert.equal(validTilePng(png(3, 1, Buffer.alloc(65 * 512), { before: [palette, chunk('tRNS', Buffer.from([0]))] })), true);
  assert.equal(validTilePng(png(0, 16, Buffer.alloc(1025 * 512))), true);
  const rows = [[64, 64], [64, 64], [128, 64], [128, 128], [256, 128], [256, 256], [512, 256]]
    .reduce((size, [w, h]) => size + (w * 4 + 1) * h, 0);
  assert.equal(validTilePng(png(6, 8, Buffer.alloc(rows), { interlaced: 1 })), true);
});

test('strict PNG rejects wrong dimensions, checksum, truncated/zlib-trailing data, bad filters and palette indices', () => {
  const wrongSize = Buffer.from(fixture);
  wrongSize.writeUInt32BE(511, 16);
  wrongSize.writeUInt32BE(crc32(wrongSize.subarray(12, 29)), 29);
  const wrongChecksum = Buffer.from(fixture);
  wrongChecksum[29] ^= 1;
  const badFilter = Buffer.alloc(513 * 512);
  badFilter[0] = 5;
  const wrongIndex = Buffer.alloc(65 * 512);
  wrongIndex[1] = 0x80;
  const cases = [wrongSize, wrongChecksum, fixture.subarray(0, -1),
    png(0, 8, badFilter), png(0, 8, badFilter, { compressed: Buffer.concat([deflateSync(Buffer.alloc(513 * 512)), Buffer.from([1])]) }),
    png(3, 1, wrongIndex, { before: [chunk('PLTE', Buffer.alloc(3))] })];
  for (const bytes of cases) assert.equal(validTilePng(bytes), false);
});

test('PNG permits bounded compressed international text and rejects oversized ancillary expansion', () => {
  const textHeader = Buffer.from([97, 0, 1, 0, 0, 0]);
  const rows = Buffer.alloc(513 * 512);
  const valid = chunk('iTXt', Buffer.concat([textHeader, deflateSync(Buffer.from('Label fixture'))]));
  const bomb = chunk('iTXt', Buffer.concat([textHeader, deflateSync(Buffer.alloc(1_048_577))]));
  assert.equal(validTilePng(png(0, 8, rows, { before: [valid] })), true);
  assert.equal(validTilePng(png(0, 8, rows, { before: [bomb] })), false);
});

test('invalid content type, invalid PNG, oversized stream and upstream redirects return no image', async () => {
  for (const response of [new Response(fixture, { headers: { 'content-type': 'text/html' } }),
    new Response('invalid', { headers: { 'content-type': 'image/png' } }),
    new Response(Buffer.alloc(maxTileBytes + 1), { headers: { 'content-type': 'image/png' } }),
    Response.redirect('https://unexpected.invalid')]) {
    const p = providerSetup({ transport: (_, options) => options.method === 'POST'
      ? Response.json({ access_token: fakeToken, expires_in: 60 }) : response });
    const result = await p.provider(tile);
    assert.equal(result.status, 502);
    assert.equal(result.body, undefined);
    assert.equal(p.calls.length, 2);
  }
});

test('the provider and gateway are disabled by default and reveal no exception detail', async () => {
  const dormant = createEsriProvider({ transport: () => { throw Error(fakeSecret); } });
  assert.equal((await dormant(tile)).status, 503);
  const f = setup({ provider: () => { throw Error(fakeSecret + fakeToken); } });
  const lease = await f.issue();
  const result = await f.gateway.requestTile(f.request(lease));
  assert.equal(result.status, 503);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-/);
  const gateway = createLabelsGateway({ state: f.state, appId, origin, provider: () => { throw Error('not called'); } });
  assert.equal((await gateway.requestTile(f.request(lease))).status, 503);
});

test('HTTP handler uses raw request target, rejects duplicate proof headers and sets no-store', async () => {
  const f = setup();
  const handler = createNodeHandler(f.gateway);
  const lease = await f.issue();
  const request = f.request(lease);
  const headers = { 'x-gridly-labels-lease': [request.leaseId],
    'x-gridly-labels-timestamp': [String(request.timestamp)], 'x-gridly-labels-request': [request.requestId],
    'x-gridly-labels-signature': [request.signature] };
  async function call(url, headersDistinct) {
    const req = Object.assign(Readable.from([]), { url, method: 'GET', headersDistinct });
    let reply;
    const res = { once() {}, writeHead(status, headers) { reply = { status, headers }; },
      end(body) { reply.body = body; } };
    await handler(req, res);
    return reply;
  }
  assert.equal((await call(target + '/..', headers)).status, 400);
  assert.equal((await call(target, { ...headers, 'x-gridly-labels-signature': ['a', 'b'] })).status, 400);
  const result = await call(target, headers);
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['content-type'], 'image/png');
  assert.ok(result.body.equals(fixture));
});

test('pilot composition accepts only bounded native lease JSON and denies the default configuration', async () => {
  const f = setup();
  const pair = keyPair();
  const evidence = f.evidence(pair, 'install', 'lineage');
  async function invoke(handler, data) {
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(data))]), {
      url: '/v1/labels/lease', method: 'POST', headers: { 'content-type': 'application/json' }
    });
    let reply;
    await handler(req, { once() {}, writeHead(status) { reply = { status }; },
      end(bytes) { reply.body = JSON.parse(bytes); } });
    return reply;
  }
  const dormant = createPilotApplication({ state: f.state, origin, appId });
  assert.equal((await invoke(dormant, evidence)).status, 503);
  const handler = createNodeHandler(f.gateway);
  assert.equal((await invoke(handler, { ...evidence, paid: true })).status, 401);
  const accepted = await invoke(handler, evidence);
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.audience, audience);
  assert.deepEqual(Object.keys(accepted.body).sort(),
    ['attest', 'audience', 'expiresAt', 'issuedAt', 'leaseId', 'scope', 'store']);
  assert.equal((await invoke(handler, { ...evidence, paidEvidence: 'x'.repeat(48 * 1024) })).status, 400);
});

test('Leaflet preserves Standard and Imagery, cancels stale tiles and recovers without duplicate overlays', () => {
  const listeners = new Map();
  let url, options, redraws = 0, cancelled = false;
  const layer = { on: (name, fn) => listeners.set(name, fn), off: name => listeners.delete(name), redraw: () => redraws++ };
  const L = { tileLayer: (...args) => { [url, options] = args; return layer; } };
  const imagery = { id: 'world-imagery' }, standard = { id: 'standard' };
  const group = new Set([imagery]);
  const satellite = { addLayer: value => group.add(value), removeLayer: value => group.delete(value) };
  const basemaps = { Standard: standard, Satellite: satellite };
  assert.equal(attachPilotLabels({ L, satellite, attribution: 'Esri' }), null);
  const input = { L, satellite, nativeEnabled: true, attribution: 'Esri and data providers' };
  const adapter = attachPilotLabels(input);
  assert.equal(attachPilotLabels(input), adapter);
  assert.equal(url, 'gridly-label://pilot/tile/{z}/{y}/{x}');
  assert.equal(options.tileSize, 512);
  assert.equal(options.zoomOffset, -1);
  assert.deepEqual([...group], [imagery, layer]);
  listeners.get('tileunload')({ tile: { removeAttribute: name => { cancelled = name === 'src'; } } });
  assert.equal(cancelled, true);
  listeners.get('tileerror')();
  assert.deepEqual([...group], [imagery, layer]);
  adapter.recoverNetwork();
  adapter.recoverNetwork();
  assert.equal(redraws, 1);
  adapter.suspend();
  assert.deepEqual([...group], [imagery]);
  adapter.resume();
  adapter.resume();
  assert.deepEqual([...group], [imagery, layer]);
  adapter.dispose();
  assert.deepEqual([...group], [imagery]);
  assert.equal(basemaps.Standard, standard);
});

test('native and Leaflet source stay confined to the pilot gateway and native key', () => {
  const src = readFileSync(new URL('./ios/Sources/GridlyLabelsPilot/HTTPSLabelTransport.swift', import.meta.url), 'utf8');
  const web = readFileSync(new URL('./leaflet-overlay.mjs', import.meta.url), 'utf8');
  for (const content of [src, web]) assert.doesNotMatch(content, /static-map-tiles-api|arcgis\.com|client_secret/);
  assert.match(src, /P256\.Signing\.PrivateKey/);
  assert.match(src, /willPerformHTTPRedirection/);
  assert.match(web, /nativeEnabled = false/);
  assert.equal(createHash('sha256').update(fixture).digest('hex'),
    '074065f07e35265d9695cced0f42844dbb02e5766c4ed185d0a372b2d033b093');
});
