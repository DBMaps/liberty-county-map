const assert = require('assert');
require('../../js/history-capture/historyCaptureEnvelope.js');
require('../../js/history-capture/historyCaptureIdempotency.js');

const envelopeApi = globalThis.gridlyPassiveHistoryCaptureEnvelope;
const idemApi = globalThis.gridlyPassiveHistoryCaptureIdempotency;
const first = envelopeApi.buildPhase1AEnvelope('report_created', { id: 'r1', type: 'road', b: 2, a: 1 }, { observedAt: '2026-01-02T03:04:05.000Z' });
const second = envelopeApi.buildPhase1AEnvelope('report_created', { a: 1, b: 2, type: 'road', id: 'r1' }, { observedAt: '2026-01-02T03:04:05.000Z' });

const firstKey = idemApi.createPhase1AIdempotencyKey(first);
const secondKey = idemApi.createPhase1AIdempotencyKey(second);
assert.strictEqual(firstKey, secondKey, 'same valid envelope content creates deterministic key');
assert.match(firstKey, /^phase1a:[0-9a-f]{8}$/);

const different = envelopeApi.buildPhase1AEnvelope('report_cleared', { id: 'r1', type: 'road' }, { observedAt: '2026-01-02T03:04:05.000Z' });
assert.notStrictEqual(firstKey, idemApi.createPhase1AIdempotencyKey(different));
assert.strictEqual(idemApi.createPhase1AIdempotencyKey(null), null, 'null envelope safe-fails');
assert.strictEqual(idemApi.createPhase1AIdempotencyKey('bad'), null, 'non-object envelope safe-fails');

console.log('historyCaptureIdempotency.test.js passed');
