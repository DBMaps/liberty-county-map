import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const manifest = readFileSync(new URL('./foundation.sha256', import.meta.url), 'utf8').trim().split(/\r?\n/);
assert.equal(manifest.length, 6);
for (const line of manifest) {
  const [hash, original, copy] = line.split('  ');
  assert.match(hash, /^[a-f0-9]{64}$/);
  for (const path of [original, copy]) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex'), hash, path);
  }
}
console.log('6 pinned foundation copies are byte-identical');

// The Deno Node shim does not expose Node's canonical curve name or P1363
// behavior. Keep the certified lease and reservation logic identical; only
// replace the tile transport and proof seam.
const directory = new URL('./supabase/functions/gridly-labels/', import.meta.url);
let gateway = readFileSync(new URL('foundation/gateway.mjs', directory), 'utf8');
for (const [before, after] of [
  ['milliseconds, p256Key,', 'milliseconds,'],
  ['  parseTileTarget, purpose', '  purpose'],
  [", uuid, verifyProof } from './protocol.mjs';", ", uuid } from './foundation/protocol.mjs';"],
  ["from './png.mjs';", "from './foundation/png.mjs';\nimport { p256Key, verifyProof } from './web-proof.mjs';\nimport { parseTileBody, tilePath } from './tile-wire.mjs';"],
  ["'method', 'target', 'leaseId'", "'method', 'target', 'body', 'leaseId'"],
  ["request.method !== 'GET'", "request.method !== 'POST'"],
  ['const tile = parseTileTarget(request.target);', 'const tile = request.target === tilePath && parseTileBody(request.body);'],
  ['const publicKey = p256Key(spki);', 'const publicKey = await p256Key(spki);'],
  ['&& p256Key(lease.spki);', '&& await p256Key(lease.spki);'],
  ['|| !verifyProof(request, origin, key.key)', '|| !await verifyProof(request, origin, key.key)']
]) {
  assert.equal(gateway.split(before).length, 2, before);
  gateway = gateway.replace(before, after);
}
const port = new URL('web-gateway.mjs', directory);
if (process.argv.includes('--generate-port')) writeFileSync(port, gateway);
assert.equal(readFileSync(port, 'utf8'), gateway, 'Deno port must differ only at its tile transport and proof seam');
