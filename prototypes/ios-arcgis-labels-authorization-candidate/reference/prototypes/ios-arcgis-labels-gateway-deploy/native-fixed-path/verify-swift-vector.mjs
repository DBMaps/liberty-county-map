import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEdgeHandler, prefix } from '../supabase/functions/gridly-labels/edge.mjs';
import { p256Key, verifyProof } from '../supabase/functions/gridly-labels/web-proof.mjs';
import { tilePath, tileProofBytes } from '../supabase/functions/gridly-labels/tile-wire.mjs';
import { createMemoryState } from '../supabase/functions/gridly-labels/foundation/state.mjs';

const vector = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const reference = JSON.parse(readFileSync(new URL('./Tests/GridlyFixedPathTileTests/tile-proof.json', import.meta.url)));
const fixture = readFileSync(new URL('../../ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/valid.png', import.meta.url));
for (const key of ['origin','leaseId','timestamp','requestId','body','canonical']) assert.equal(vector[key], reference[key]);
assert.notEqual(vector.publicKey, reference.publicKey);
const spki = Buffer.from(vector.publicKey, 'base64').toString('base64url');
const key = await p256Key(spki);
assert.ok(key);
const proof = { ...vector, signature: Buffer.from(vector.signature, 'base64').toString('base64url') };
assert.equal(tileProofBytes(proof, vector.origin).toString(), reference.canonical);
assert.equal(await verifyProof(proof, vector.origin, key.key), true);
const changed = vector.body.replace('1689', '1690');
assert.notEqual(changed, vector.body);
assert.equal(await verifyProof({ ...proof, body: changed }, vector.origin, key.key), false);

// Exercise the real Edge route with a pre-seeded synthetic lease. Full lease
// admission, evidence, and environment negatives are covered by edge.test.mjs.
const state = createMemoryState();
state.setEnabled(true);
assert.equal(state.issue({ id: vector.leaseId, spki, installation: 'synthetic', lineage: 'synthetic',
  expiresAt: vector.timestamp + 30_000 }, vector.requestId, vector.timestamp + 30_000, vector.timestamp), 'ok');
const ingressKey = 'a'.repeat(64);
let oauth = 0, tiles = 0;
const handler = createEdgeHandler({
  config: { enabled: true, origin: vector.origin, ingressKey, timeout: 6000, tokenTimeout: 2000, tileTimeout: 3000,
    maxInFlight: 4, maxBytes: 524288, provider: { GRIDLY_LABELS_ESRI_ENABLED: 'true',
      GRIDLY_LABELS_ESRI_CLIENT_ID: 'fixture', GRIDLY_LABELS_ESRI_CLIENT_SECRET: 'fixture' } },
  state: { ...state, ingress: () => 'ok', reserveOAuth: () => true },
  admission: { verifyPaid: () => null, verifyAttest: () => null },
  now: () => vector.timestamp,
  transport: async (url, init) => {
    if (url === 'https://www.arcgis.com/sharing/rest/oauth2/token' && init.method === 'POST') {
      oauth++;
      return Response.json({ access_token: 'synthetic-token', expires_in: 60 });
    }
    assert.equal(url, 'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/12/1689/968');
    tiles++;
    return new Response(fixture, { headers: { 'content-type': 'image/png' } });
  }
});
const send = body => handler(new Request(vector.origin + prefix + tilePath, { method: 'POST', body,
  headers: { 'content-type': 'application/json', 'x-gridly-pilot-ingress': ingressKey,
    'x-gridly-labels-lease': vector.leaseId, 'x-gridly-labels-timestamp': String(vector.timestamp),
    'x-gridly-labels-request': vector.requestId, 'x-gridly-labels-signature': proof.signature } }));
assert.equal((await send(changed)).status, 401);
assert.equal(tiles + oauth, 0);
const response = await send(vector.body);
assert.equal(response.status, 200);
assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixture);
assert.equal((await send(vector.body)).status, 401);
assert.deepEqual([oauth, tiles], [1, 1]);
console.log('SWIFT_SIGNED_FIXED_POST_ACCEPTED; MUTATION_AND_REPLAY_DENIED; SYNTHETIC_PNG_VERIFIED');
