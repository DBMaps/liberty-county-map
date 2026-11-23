import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {p256Key,verifyProof} from '../gateway/web-proof.mjs';
import {tileProofBytes} from '../gateway/tile-wire.mjs';
import {leaseBinding} from '../gateway/foundation/protocol.mjs';
const input=readFileSync(process.argv[2],'utf8');
const matches=[...new Set([...input.matchAll(/AUTHORIZATION_PUBLIC_VECTOR:([A-Za-z0-9+/=]+)/g)].map(m=>m[1]))];
assert.equal(matches.length,1,'require exactly one distinct native public vector');
const vector=JSON.parse(Buffer.from(matches[0],'base64').toString('utf8'));
const key=await p256Key(vector.publicKey);
assert.ok(key);assert.equal(key.fingerprint,vector.fingerprint);
assert.equal(tileProofBytes(vector,vector.origin).toString(),vector.canonical);
assert.equal(await verifyProof(vector,vector.origin,key.key),true);
assert.equal(await verifyProof({...vector,body:vector.body.replace('1689','1690')},vector.origin,key.key),false);
assert.equal(await verifyProof(vector,'https://other.invalid',key.key),false);
assert.equal(leaseBinding({appId:'com.gridlygo.gridly',challengeId:vector.challengeId,paidEvidence:vector.paidEvidence,
 fingerprint:vector.fingerprint,store:'sandbox',attest:'production'}),vector.binding);
console.log('AUTHORIZATION_NODE_CRYPTOKIT_PARITY_VERIFIED');
