import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign,X509Certificate} from 'node:crypto';
import {APPLE_APP_ATTEST_ROOT_PEM,APPLE_APP_ID,createAppleAppAttestVerifier} from '../supabase/functions/_shared/entitlement/apple-app-attest.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest();
const item=value=>{const length=n=>n<24?Buffer.from([n]):n<256?Buffer.from([24,n]):Buffer.from([25,n>>8,n&255]);
  if(Buffer.isBuffer(value)){const head=length(value.length);head[0]|=0x40;return Buffer.concat([head,value]);}
  if(typeof value==='string'){const bytes=Buffer.from(value);const head=length(bytes.length);head[0]|=0x60;return Buffer.concat([head,bytes]);}
  if(value instanceof Map){const head=length(value.size);head[0]|=0xa0;return Buffer.concat([head,...[...value].flatMap(([k,v])=>[item(k),item(v)])]);}
  throw Error('fixture_invalid');};
const verifier=createAppleAppAttestVerifier({now:()=>Date.parse('2026-09-28T00:00:00Z')});
test('Apple trust anchor is the published App Attestation root and identity includes Team prefix',()=>{
  assert.equal(hash(new X509Certificate(APPLE_APP_ATTEST_ROOT_PEM).raw).toString('hex'),
    '1cb9823ba28ba6ad2d33a006941de2ae4f513ef1d4e831b9f7e0fa7b6242c932');
  assert.equal(APPLE_APP_ID,'2XSH6R7K37.com.gridlygo.gridly');
});
test('App Attest assertion verifies signature, app identity and counter; rejects mutation and replay',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const id=Buffer.alloc(32,23),keyId=id.toString('base64url'),digest=Buffer.alloc(32,17);
  const auth=Buffer.alloc(37);hash(Buffer.from(APPLE_APP_ID)).copy(auth);auth[32]=1;auth.writeUInt32BE(1,33);
  const signature=sign('sha256',Buffer.concat([auth,digest]),privateKey);
  const authorization={type:'apple_assertion',keyId,object:item(new Map([
    ['signature',signature],['authenticatorData',auth]])).toString('base64')};
  const record={environment:'production',counter:0,publicSpki:publicKey.export({format:'der',type:'spki'}).toString('base64')};
  const readKey=async keyHash=>{assert.equal(keyHash,hash(id).toString('hex'));return record;};
  const verify=(patch={},d=digest)=>verifier.verify({authorization:{...authorization,...patch},digest:d,environment:'production',readKey});
  assert.deepEqual(await verify(),{verified:true,platform:'apple',kind:'apple_assertion',keyHash:hash(id).toString('hex'),counter:1});
  assert.equal(await verify({},Buffer.alloc(32,18)),null);
  assert.equal(await verify({keyId:Buffer.alloc(32,24).toString('base64url')}),null);
  assert.equal(await verify({object:'malformed'}),null);
  record.counter=1;assert.equal(await verify(),null);record.counter=0;
  const wrongRp=Buffer.from(auth);hash(Buffer.from('OTHER.com.gridlygo.gridly')).copy(wrongRp);
  assert.equal(await verify({object:item(new Map([['signature',sign('sha256',Buffer.concat([wrongRp,digest]),privateKey)],
    ['authenticatorData',wrongRp]])).toString('base64')}),null);
  const wrongSig=Buffer.from(signature);wrongSig[20]^=1;
  assert.equal(await verify({object:item(new Map([['signature',wrongSig],['authenticatorData',auth]])).toString('base64')}),null);
  assert.equal(await verifier.verify({authorization,digest,environment:'sandbox/test',readKey}),null);
});
test('App Attest initial object cannot substitute an arbitrary certificate chain',async()=>{
  const object=item(new Map([['fmt','apple-appattest'],['attStmt',new Map([
    ['receipt',Buffer.from([1])],['x5c',Buffer.from([1])]])],['authData',Buffer.alloc(90)]]));
  assert.equal(await verifier.verify({authorization:{type:'apple_initial',keyId:Buffer.alloc(32).toString('base64url'),
    object:object.toString('base64')},digest:Buffer.alloc(32),environment:'production',readKey:async()=>null}),null);
});
