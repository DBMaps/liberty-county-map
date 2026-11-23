import assert from 'node:assert/strict';
import { createHash, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { createMockTileProvider, LABELS_AUDIENCE, LABELS_SCOPE, tileProofBytes, verifyTileProof } from '../ios-arcgis-labels-gateway/gateway.mjs';
import { isMockTilePng } from '../ios-arcgis-labels-gateway/png.mjs';
import { START, syntheticScenario } from '../ios-arcgis-labels-gateway/synthetic.mjs';
import { createLocalSession, schemeTarget } from './local-integration.mjs';
import { createMapFixture } from './map-fixture.mjs';

const URL_TILE = 'gridly-label://mock/tile/12/1689/968';
const FIXTURE = new URL('./Tests/TileCoreTests/Fixtures/valid.png', import.meta.url);

function setup(options = {}) {
  const { provider = createMockTileProvider(), ...config } = options;
  const calls = [];
  const scenario = syntheticScenario({ ...config, provider: (tile, context) => {
    calls.push(tile);
    return provider(tile, context);
  } });
  const session = createLocalSession(scenario);
  return { scenario, session, calls };
}

test('Leaflet URL → signed labels lease → real Node gateway → exact 512px PNG', async () => {
  const { scenario, session, calls } = setup();
  const lease = await session.issue();
  assert.equal(lease.audience, LABELS_AUDIENCE);
  assert.equal(lease.scope, LABELS_SCOPE);
  assert.equal(lease.issuedAt, START);
  assert.equal(lease.expiresAt - lease.issuedAt, 300_000);
  const map = createMapFixture(session);
  assert.equal(map.tileURL(30.0466, -94.8852, 13), URL_TILE);
  const result = await map.move();
  assert.equal(result.status, 200);
  assert.equal(result.contentType, 'image/png');
  assert.ok(isMockTilePng(result.body));
  assert.deepEqual(result.body, readFileSync(FIXTURE));
  assert.deepEqual(calls, [{ level: 12, row: 1689, column: 968 }]);
  assert.equal(scenario.gateway.inspect().attemptsToday, 1);
  assert.deepEqual(map.state(), { requests: 1, labelCreations: 1, imagery: true, labels: true,
    imageryURL: 'imagery.svg', labelPane: '450', tileSize: 512, zoomOffset: -1,
    status: 'Mock labels loaded', signingExposed: false });
});

for (const [name, options] of [
  ['wrong requested environment', { requested: 'sandbox' }],
  ['mixed environment evidence', { integrity: { environment: 'sandbox' } }],
  ['invalid paid decision', { paid: { verified: false } }],
  ['continuity-only paid decision', { paid: { kind: 'continuity' } }],
  ['failed integrity decision', { integrity: { verified: false } }]
]) {
  test(`${name} cannot issue or fetch through the integration`, async () => {
    const { scenario, session, calls } = setup();
    assert.equal((await session.issue(options)).status, 401);
    assert.equal((await scenario.gateway.requestTile({ method: 'GET', target: schemeTarget(URL_TILE) })).status, 401);
    assert.equal(calls.length, 0);
  });
}

test('missing, expired and revoked lease reject a signed tile before provider work', async () => {
  const { scenario, session, calls } = setup();
  const lease = await session.issue({ paid: { periodEnd: START + 100 } });
  const request = session.sign(URL_TILE, lease);
  assert.equal((await scenario.gateway.requestTile({ ...request, leaseId: undefined })).status, 401);
  scenario.advance(100);
  assert.equal((await scenario.gateway.requestTile(session.sign(URL_TILE, lease))).status, 401);
  const fresh = await session.issue();
  scenario.gateway.revokeLease(fresh.leaseId);
  assert.equal((await scenario.gateway.requestTile(session.sign(URL_TILE, fresh))).status, 401);
  assert.equal(calls.length, 0);
});

test('wrong signing key, invalid signature, altered target and replay cannot produce a second tile', async () => {
  const { scenario, session, calls } = setup();
  const lease = await session.issue();
  const request = session.sign(URL_TILE, lease);
  const wrongKey = createLocalSession(scenario).sign(URL_TILE, lease);
  for (const invalid of [wrongKey, { ...request, signature: 'invalid' },
    { ...request, target: '/v1/imagery-labels/0/0/0' }]) {
    assert.equal((await scenario.gateway.requestTile(invalid)).status, 401);
  }
  assert.equal(calls.length, 0);
  const responses = await Promise.all([scenario.gateway.requestTile(request), scenario.gateway.requestTile(request)]);
  assert.deepEqual(responses.map(r => r.status), [200, 401]);
  assert.equal(calls.length, 1);
});

test('the scheme rejects malformed URLs and coordinates before lease issuance', async () => {
  const { scenario, session, calls } = setup();
  for (const url of ['https://mock/tile/0/0/0', 'gridly-label://other/tile/0/0/0', 'gridly-label://mock:1/tile/0/0/0',
    URL_TILE + '?token=invalid', URL_TILE + '#fragment', URL_TILE + '\n', 'gridly-label://mock/tile/12/../968',
    'gridly-label://mock/tile/12/%31/0', 'gridly-label://mock/tile/20/0/0', 'gridly-label://mock/tile/1/0/2']) {
    assert.equal((await session.load(url)).status, 400);
  }
  assert.equal((await session.load(URL_TILE, { method: 'POST' })).status, 400);
  assert.equal(scenario.gateway.inspect().leases, 0);
  assert.equal(calls.length, 0);
});

for (const limit of ['perMinute', 'installationDaily', 'aggregateDaily']) {
  test(`${limit} holds under parallel label requests`, async () => {
    const { scenario, session, calls } = setup({ limits: { [limit]: 1 } });
    const replies = await Promise.all([session.load(URL_TILE), session.load(URL_TILE)]);
    assert.deepEqual(replies.map(r => r.status), [200, 429]);
    assert.equal(calls.length, 1);
    assert.equal(scenario.gateway.inspect().leases, 1);
    assert.equal(scenario.gateway.inspect().attemptsToday, 1);
  });
}

test('timeout and cancellation count dispatched work and release on acknowledgement', async () => {
  const pending = [];
  const { scenario, session, calls } = setup({ timeoutMs: 15, provider: (_, { signal }) => new Promise(resolve => pending.push({ resolve, signal })) });
  await session.issue();
  const controller = new AbortController();
  const cancelled = session.load(URL_TILE, { signal: controller.signal });
  controller.abort();
  assert.equal((await cancelled).status, 499);
  assert.equal((await session.load(URL_TILE, { signal: controller.signal })).status, 499);
  assert.equal((await session.load(URL_TILE)).status, 504);
  assert.ok(pending.every(item => item.signal.aborted));
  assert.equal(scenario.gateway.inspect().active, 2);
  for (const item of pending) item.resolve(await createMockTileProvider()());
  await setImmediate();
  assert.equal(scenario.gateway.inspect().active, 0);
  assert.equal(scenario.gateway.inspect().attemptsToday, 2);
  assert.equal(calls.length, 2);
});

test('invalid PNG leaves terrain and the single label layer present', async () => {
  const { session } = setup({ provider: () => ({ status: 200, contentType: 'image/png', body: Buffer.from('invalid') }) });
  const map = createMapFixture(session);
  assert.equal((await map.move()).status, 502);
  assert.equal(map.state().status, 'A label tile failed');
  assert.equal(map.state().imagery, true);
  assert.equal(map.state().labels, true);
});

test('toggle, repeated pan and zoom preserve imagery and exactly one overlay', async () => {
  const { session, calls } = setup();
  const map = createMapFixture(session);
  await map.move();
  map.toggle();
  for (let i = 0; i < 5; i++) assert.equal(await map.move(30.04, -94.88 + i * 0.001, 13 + i % 3), null);
  assert.equal(calls.length, 1);
  assert.equal(map.state().imagery, true);
  assert.equal(map.state().labels, false);
  map.toggle();
  for (let i = 0; i < 12; i++) assert.equal((await map.move(30.04, -94.88 + i * 0.001, 13 + i % 3)).status, 200);
  assert.equal(calls.length, 13);
  assert.equal(map.state().labelCreations, 1);
  assert.equal(map.state().imagery, true);
});

test('independent sessions cannot replay or share a mutable tile result', async () => {
  const { scenario, session, calls } = setup();
  const other = createLocalSession(scenario);
  const a = await session.issue(), b = await other.issue();
  const signed = session.sign(URL_TILE, a);
  assert.equal((await scenario.gateway.requestTile({ ...signed, leaseId: b.leaseId })).status, 401);
  const first = await session.load(URL_TILE);
  first.body.fill(0);
  const second = await other.load(URL_TILE);
  assert.ok(isMockTilePng(second.body));
  assert.equal(calls.length, 2);
});

test('one renewal serves concurrent requests and no fetch or signing bridge reaches the map', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw Error('Unexpected fetch'); });
  const { scenario, session } = setup();
  const map = createMapFixture(session);
  await map.move();
  scenario.advance(300_000);
  const replies = await Promise.all([map.move(), map.move(30.04, -94.88, 15)]);
  assert.deepEqual(replies.map(r => r.status), [200, 200]);
  assert.equal(scenario.gateway.inspect().leases, 1);
  assert.equal(scenario.gateway.inspect().challenges, 1);
  assert.equal(map.state().signingExposed, false);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('public wire vector verifies through the Stage 2C proof verifier', () => {
  const vector = JSON.parse(readFileSync(new URL('./Tests/TileCoreTests/Fixtures/wire-proof.json', import.meta.url)));
  const key = createPublicKey({ key: Buffer.from(vector.publicKeySPKI, 'base64'), format: 'der', type: 'spki' });
  assert.equal(tileProofBytes(vector.proof).toString('utf8'), vector.canonical);
  assert.ok(verifyTileProof(key, vector.proof));
  assert.equal(createHash('sha256').update(readFileSync(FIXTURE)).digest('hex'),
    '074065f07e35265d9695cced0f42844dbb02e5766c4ed185d0a372b2d033b093');
});
