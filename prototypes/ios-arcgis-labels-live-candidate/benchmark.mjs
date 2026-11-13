import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createEsriProvider } from './esri.mjs';
import { createLabelsGateway } from './gateway.mjs';
import { proofBytes, scope } from './protocol.mjs';
import { createMemoryState } from './state.mjs';

const fixture = readFileSync(new URL('../ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/valid.png', import.meta.url));
const origin = 'https://labels-pilot.invalid';
const appId = 'com.gridlygo.prototype.labeltiles.pilot';
let now = 1794484800000, tokens = 0, requests = 0, concurrent = 0, peak = 0, leases = 0, mode = 'ok';
const state = createMemoryState();
state.setEnabled(true);
const provider = createEsriProvider({
  environment: { GRIDLY_LABELS_ESRI_ENABLED: 'true', GRIDLY_LABELS_ESRI_CLIENT_ID: 'fixture-client',
    GRIDLY_LABELS_ESRI_CLIENT_SECRET: 'fixture-secret' }, enabled: () => true, now: () => now,
  transport: async (_, { method, signal }) => {
    if (method === 'POST') {
      tokens++;
      return Response.json({ access_token: 'fixture-token', expires_in: 1200 });
    }
    requests++;
    peak = Math.max(peak, ++concurrent);
    try {
      if (mode === 'stall') {
        await new Promise((_, reject) => {
          if (signal.aborted) reject(Error('cancelled'));
          else signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true });
        });
      }
      await new Promise(resolve => setImmediate(resolve));
      return mode === 'throttle' ? new Response(null, { status: 429 })
        : new Response(fixture, { headers: { 'content-type': 'image/png' } });
    } finally {
      concurrent--;
    }
  }
});
const gateway = createLabelsGateway({
  state, provider, origin, appId, now: () => now, enabled: () => true,
  verifyAttest: async input => ({ ...input, verified: true, installation: 'fixture-installation',
    verifiedAt: now, challengeExpiresAt: now + 120_000 }),
  verifyPaid: async ({ environment }) => ({ verified: true, kind: 'paid_admission', environment, revoked: false,
    lineage: 'fixture-lineage', verifiedAt: now, periodEnd: now + 900_000 })
});
const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const spki = pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
async function issue() {
  const lease = await gateway.issueLease({ challengeId: randomUUID(), spki, paidEvidence: 'fixture-paid', attestEvidence: 'fixture-attest' });
  if (lease.status !== 201 || lease.scope !== scope) throw Error('local_issue_failed');
  leases++;
  return lease;
}
function signed(lease, column, signal) {
  const request = { method: 'GET', target: `/v1/imagery-labels/12/1689/${column}`,
    leaseId: lease.leaseId, timestamp: now, requestId: randomUUID(), signal };
  const signature = sign('sha256', proofBytes(request, origin), { key: pair.privateKey, dsaEncoding: 'ieee-p1363' });
  return { ...request, signature: signature.toString('base64url') };
}

globalThis.gc?.();
const before = process.memoryUsage();
const timings = [];
let lease = await issue();
for (let wave = 0; wave < 100; wave++) {
  if (wave === 50) {
    now += 100_001;
    lease = await issue();
  }
  const waveRequests = Array.from({ length: 4 }, (_, i) => signed(lease, 800 + wave * 4 + i));
  await Promise.all(waveRequests.map(async request => {
    const start = performance.now();
    const result = await gateway.requestTile(request);
    timings.push(performance.now() - start);
    if (result.status !== 200) throw Error('local_tile_failed');
  }));
  now += 4000;
}
mode = 'throttle';
const throttle = (await gateway.requestTile(signed(lease, 900))).status;
mode = 'ok';
now += 5001;
const recovery = (await gateway.requestTile(signed(lease, 900))).status;
mode = 'stall';
const abort = new AbortController();
const cancelled = gateway.requestTile(signed(lease, 901, abort.signal));
for (let attempt = 0; !concurrent && attempt < 20; attempt++) await new Promise(resolve => setImmediate(resolve));
if (!concurrent) throw Error('local_cancellation_fixture_did_not_start');
const cancelStart = performance.now();
abort.abort();
const cancelStatus = (await cancelled).status;
const cancelMs = performance.now() - cancelStart;
await new Promise(resolve => setImmediate(resolve));
globalThis.gc?.();
const after = process.memoryUsage();
timings.sort((a, b) => a - b);
console.log(JSON.stringify({
  successfulTiles: timings.length, leases, tokenRequests: tokens, tileRequests: requests, peakConcurrent: peak,
  p50Milliseconds: +timings[Math.floor(timings.length * 0.50)].toFixed(2),
  p95Milliseconds: +timings[Math.floor(timings.length * 0.95)].toFixed(2),
  heapDeltaBytes: after.heapUsed - before.heapUsed, rssDeltaBytes: after.rss - before.rss,
  quota: state.metrics(), throttle, recovery, cancelStatus, cancelMilliseconds: +cancelMs.toFixed(2)
}, null, 2));
