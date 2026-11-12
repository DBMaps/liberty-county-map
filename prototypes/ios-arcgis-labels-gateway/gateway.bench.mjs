import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setImmediate } from 'node:timers/promises';
import { createDailyBudget, createMockTileProvider, verifyTileProof } from './gateway.mjs';
import { syntheticScenario } from './synthetic.mjs';

function measure(count, operation) {
  const start = performance.now();
  for (let i = 0; i < count; i++) operation();
  return Math.round((performance.now() - start) * 1000 / count * 100) / 100;
}

const sample = syntheticScenario();
const subject = sample.client();
const lease = await sample.gateway.issueLease(subject.evidence());
assert.equal(lease.status, 201);
const signed = subject.request(lease);
const budget = createDailyBudget({ installationDaily: 110_000, lineageDaily: 110_000,
  aggregateDaily: 110_000, maxIdentities: 1 });
measure(500, () => assert.ok(verifyTileProof(subject.publicKey, signed)));
measure(5000, () => assert.ok(budget.reserve('installation', 'lineage', sample.now())));
const verificationUs = measure(5000, () => assert.ok(verifyTileProof(subject.publicKey, signed)));
const reservationUs = measure(100_000, () => assert.ok(budget.reserve('installation', 'lineage', sample.now())));

let inflight = 0, peak = 0;
const fixture = createMockTileProvider();
const concurrent = syntheticScenario({ provider: async () => {
  peak = Math.max(peak, ++inflight);
  try { await setImmediate(); return await fixture(); }
  finally { inflight--; }
} });
const requester = concurrent.client();
const batchLease = await concurrent.gateway.issueLease(requester.evidence());
const start = performance.now();
for (let i = 0; i < 50; i++) {
  const results = await Promise.all(Array.from({ length: 4 }, () => concurrent.gateway.requestTile(requester.request(batchLease))));
  assert.ok(results.every(result => result.status === 200));
  if (i % 10 === 9) concurrent.advance(60_000);
}
const elapsed = performance.now() - start;
assert.equal(peak, 4);

const session = syntheticScenario();
const rider = session.client();
let activeLease, issues = 0;
for (let minute = 0; minute < 30; minute++) {
  if (!activeLease || activeLease.expiresAt <= session.now()) {
    activeLease = await session.gateway.issueLease(rider.evidence());
    assert.equal(activeLease.status, 201);
    issues++;
  }
  for (let i = 0; i < 8; i++) assert.equal((await session.gateway.requestTile(rider.request(activeLease))).status, 200);
  session.advance(60_000);
}
assert.equal(issues, 6);

const memory = syntheticScenario();
const traveler = memory.client();
async function memoryPass(days) {
  for (let day = 0; day < days; day++) {
    const grant = await memory.gateway.issueLease(traveler.evidence());
    assert.equal(grant.status, 201);
    memory.clearEvidence();
    for (let i = 0; i < 10; i++) assert.equal((await memory.gateway.requestTile(traveler.request(grant))).status, 200);
    memory.advance(86_400_000);
  }
}
await memoryPass(10);
global.gc?.();
const before = process.memoryUsage().heapUsed;
await memoryPass(100);
global.gc?.();
const after = process.memoryUsage().heapUsed;

let acknowledged = 0;
const cancelling = syntheticScenario({ provider: async (tile, { signal }) => {
  await setImmediate();
  if (signal.aborted) acknowledged++;
  return fixture(tile);
} });
const moving = cancelling.client();
const cancelStart = performance.now();
for (let i = 0; i < 100; i++) {
  const grant = await cancelling.gateway.issueLease(moving.evidence());
  assert.equal(grant.status, 201);
  cancelling.clearEvidence();
  const controller = new AbortController();
  const pending = Array.from({ length: 4 }, () => cancelling.gateway.requestTile(moving.request(grant, { signal: controller.signal })));
  controller.abort();
  assert.ok((await Promise.all(pending)).every(result => result.status === 499));
  await setImmediate();
  assert.equal(cancelling.gateway.inspect().active, 0);
  cancelling.advance(60_000);
}
assert.equal(acknowledged, 400);

console.log(JSON.stringify({
  node: process.version,
  proofVerificationUsPerCall: verificationUs,
  quotaReservationUsPerCall: reservationUs,
  fourAtOnce: { completed: 200, peakProviderConcurrency: peak, elapsedMs: Math.round(elapsed) },
  activeSession: { simulatedMinutes: 30, tiles: 240, leases: issues },
  memory: { measuredRequests: 1000, forcedGc: Boolean(global.gc), heapBeforeBytes: before, heapAfterBytes: after,
    state: memory.gateway.inspect() },
  cancellation: { requests: 400, elapsedMs: Math.round(performance.now() - cancelStart), activeAfter: cancelling.gateway.inspect().active }
}, null, 2));
