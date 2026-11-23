import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,resignResponse} from './helpers.mjs';

test('a duplicate signed decision ID on a second genuine local authorization is rejected',async()=>{
 const id=randomUUID(),f=await fixture({mutateResponse:p=>{if(p.body.operation==='authorize'){p.body.responseId=id;resignResponse(p);}}});
 assert.equal((await f.gateway.issueLease(await f.leaseInput(1))).status,201);
 assert.notEqual((await f.gateway.issueLease(await f.leaseInput(2))).status,201);
 assert.equal(f.counter(),2);assert.equal(f.state.metrics().leases,1);
});
test('missing local pending challenge denies before authoritative counter mutation',async()=>{
 const f=await fixture(),p=await f.leaseInput();f.state.pending=async()=>false;
 assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),0);
});
test('gateway state outage after valid verification never exposes a lease',async()=>{
 const f=await fixture(),p=await f.leaseInput();f.state.issue=async()=>{throw Error('private database DSN');};
 const r=await f.gateway.issueLease(p);assert.notEqual(r.status,201);assert.equal(f.counter(),1);assert.doesNotMatch(JSON.stringify(r),/DSN|aaa.bbb/);
});
test('cancellation during final gateway commit cannot expose a late success',async()=>{
 const control=new AbortController(),f=await fixture(),p=await f.leaseInput(),issue=f.state.issue;
 f.state.issue=async(...args)=>{const result=await issue(...args);control.abort();return result;};
 assert.notEqual((await f.gateway.issueLease(p,control.signal)).status,201);assert.equal(f.counter(),1);
 // An unknown/late local commit may leave an unusable expiring lease, never a success reply.
 assert.equal(f.state.metrics().leases,1);
});
test('decision expiring during final gateway commit cannot expose a late success',async()=>{
 const f=await fixture(),p=await f.leaseInput(),issue=f.state.issue;
 f.state.issue=async(...args)=>{const result=await issue(...args);f.advance(5001);return result;};
 assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),1);
});

