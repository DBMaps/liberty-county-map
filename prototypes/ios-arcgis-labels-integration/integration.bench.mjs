import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setImmediate } from 'node:timers/promises';
import { createMockTileProvider, verifyTileProof } from '../ios-arcgis-labels-gateway/gateway.mjs';
import { syntheticScenario } from '../ios-arcgis-labels-gateway/synthetic.mjs';
import { createLocalSession } from './local-integration.mjs';
import { createMapFixture } from './map-fixture.mjs';

const url = 'gridly-label://mock/tile/12/1689/968';
const fixture = createMockTileProvider();
const sample = syntheticScenario();
const client = sample.client();
const signer = createLocalSession(sample, client);
const lease = await signer.issue();
const proof = signer.sign(url, lease);
for (let i = 0; i < 500; i++) assert.ok(verifyTileProof(client.publicKey, proof));
let time = performance.now();
for (let i = 0; i < 5000; i++) assert.ok(verifyTileProof(client.publicKey, proof));
const verifyMicroseconds = (performance.now() - time) * 1000 / 5000;

let active = 0, peak = 0;
const scenario = syntheticScenario({ provider: async () => {
  peak = Math.max(peak, ++active);
  try { await setImmediate(); return await fixture(); }
  finally { active--; }
} });
let leases = 0;
const measuredScenario = { ...scenario, gateway: { ...scenario.gateway,
  async issueLease(evidence) {
    const issued = await scenario.gateway.issueLease(evidence);
    if (issued.status === 201) leases++;
    return issued;
  } } };
const map = createMapFixture(createLocalSession(measuredScenario));
const latencies = [];
for (let minute = 0; minute < 30; minute++) {
  for (let batch = 0; batch < 2; batch++) {
    await Promise.all(Array.from({ length: 4 }, async (_, index) => {
      const start = performance.now();
      const reply = await map.move(30.04 + index * 0.001, -94.88 + minute * 0.0001, 13 + (minute + index) % 3);
      assert.equal(reply.status, 200);
      latencies.push(performance.now() - start);
    }));
  }
  scenario.advance(60_000);
}
assert.equal(leases, 6);
assert.equal(peak, 4);
assert.equal(map.state().labelCreations, 1);
assert.equal(map.state().imagery, true);
latencies.sort((a, b) => a - b);

const memory = syntheticScenario();
const memorySession = createLocalSession(memory);
async function memoryPass(days) {
  for (let i = 0; i < days; i++) {
    for (let j = 0; j < 10; j++) assert.equal((await memorySession.load(url)).status, 200);
    memory.clearEvidence();
    memory.advance(86_400_000);
  }
}
await memoryPass(10);
global.gc?.();
const before = process.memoryUsage().heapUsed;
await memoryPass(50);
global.gc?.();
const after = process.memoryUsage().heapUsed;

let acknowledged = 0;
const cancellation = syntheticScenario({ provider: async (_, { signal }) => {
  await setImmediate();
  if (signal.aborted) acknowledged++;
  return fixture();
} });
const moving = createLocalSession(cancellation);
time = performance.now();
for (let i = 0; i < 50; i++) {
  if (i % 5 === 0) await moving.issue();
  const stop = new AbortController();
  const pending = Array.from({ length: 4 }, () => moving.load(url, { signal: stop.signal }));
  stop.abort();
  assert.ok((await Promise.all(pending)).every(r => r.status === 499));
  await setImmediate();
  assert.equal(cancellation.gateway.inspect().active, 0);
  cancellation.advance(60_000);
}
assert.equal(acknowledged, 200);
assert.equal(cancellation.gateway.inspect().attemptsToday, 200);
console.log(JSON.stringify({
  node: process.version,
  verifyMicroseconds,
  panZoom: { completed: latencies.length, medianMs: latencies[Math.floor(latencies.length / 2)],
    p95Ms: latencies[Math.ceil(latencies.length * 0.95) - 1], peak, simulatedMinutes: 30, leases },
  memory: { measuredTiles: 500, forcedGc: Boolean(global.gc), heapBeforeBytes: before, heapAfterBytes: after,
    state: memory.gateway.inspect() },
  cancellation: { acknowledged, charged: cancellation.gateway.inspect().attemptsToday,
    activeAfter: cancellation.gateway.inspect().active, elapsedMs: performance.now() - time }
}, null, 2));
