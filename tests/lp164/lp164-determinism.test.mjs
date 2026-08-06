import assert from 'node:assert/strict';import test from 'node:test';
import { compareBytes,verifyDeterminism } from '../../tools/lp164/verify-lp164-determinism.mjs';
test('two isolated runs match governed bytes without mutable state leakage',()=>{const r=verifyDeterminism();assert.equal(r.status,'PASS');assert.equal(r.runsCompared,2);assert.equal(r.repositoryArtifactsRewritten,false);assert.equal(r.mutableStateLeakage,false);});
test('controlled drift reports hashes and the first differing byte',()=>{const x=compareBytes('x.json',Buffer.from('abc\n'),Buffer.from('axc\n'));assert.equal(x.firstDifferingByte,1);assert.match(x.expectedSha256,/^[a-f0-9]{64}$/);assert.match(x.actualSha256,/^[a-f0-9]{64}$/);});
