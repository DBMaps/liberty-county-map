import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { handler, runPreflight } from './preflight.mjs';

test('direct invocation only; no HTTP event accepted', async () => {
  assert.deepEqual(await handler({}), {accepted: false});
  assert.deepEqual(await handler({probe: 'lp24466s_public_chain', body: '{}'}), {accepted: false});
});

test('public certificate preflight reports online OCSP without assuming success', async () => {
  const result = await runPreflight({fetchImpl: async () => ({status: 401, body: null})});
  assert.equal(result.libraryBoot, true);
  assert.equal(result.x509Raw, true);
  assert.equal(result.chainSignatures, true);
  assert.equal(result.onlineChecks, true);
  assert.equal(result.malformedDenied, true);
  assert.equal(result.badChainDenied, true);
  assert.equal(result.appleProductionApiReachable, true);
  assert.equal(result.appleSandboxApiReachable, true);
  assert.equal(result.badSignatureDenied, result.publicChainOcsp);
  assert.equal(result.pass, result.publicChainOcsp);
});
