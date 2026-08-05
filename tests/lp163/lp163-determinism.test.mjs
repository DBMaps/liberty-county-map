import assert from 'node:assert/strict';
import test from 'node:test';
import { compareBytes, verifyDeterminism } from '../../tools/lp163/verify-lp163-determinism.mjs';
test('two isolated generations exactly match governed bytes',()=>assert.equal(verifyDeterminism().status,'PASS'));
test('mismatch diagnostics identify hashes and first byte',()=>{const x=compareBytes('fixture.json',Buffer.from('abc\n'),Buffer.from('axc\n'));assert.equal(x.path,'fixture.json');assert.equal(x.firstDifferingByte,1);assert.match(x.expectedSha256,/^[a-f0-9]{64}$/);assert.match(x.actualSha256,/^[a-f0-9]{64}$/);});
