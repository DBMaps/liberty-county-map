import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign,X509Certificate} from 'node:crypto';
import {APPLE_APP_ATTEST_ROOT_PEM,APPLE_APP_ID,createAppleAppAttestVerifier,
  extractAppleAppAttestCertificateNonce} from '../supabase/functions/_shared/entitlement/apple-app-attest.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest();
const item=value=>{const length=n=>n<24?Buffer.from([n]):n<256?Buffer.from([24,n]):Buffer.from([25,n>>8,n&255]);
  if(Buffer.isBuffer(value)){const head=length(value.length);head[0]|=0x40;return Buffer.concat([head,value]);}
  if(typeof value==='string'){const bytes=Buffer.from(value);const head=length(bytes.length);head[0]|=0x60;return Buffer.concat([head,bytes]);}
  if(value instanceof Map){const head=length(value.size);head[0]|=0xa0;return Buffer.concat([head,...[...value].flatMap(([k,v])=>[item(k),item(v)])]);}
  throw Error('fixture_invalid');};
const verifier=createAppleAppAttestVerifier({now:()=>Date.parse('2026-09-28T00:00:00Z')});
const derNode=(tag,content)=>{assert.ok(content.length<128);return Buffer.concat([Buffer.from([tag,content.length]),content]);};
const derItems=(tag,...items)=>derNode(tag,Buffer.concat(items));
const nonceOid=Buffer.from('06092a864886f763640802','hex');
// A deliberately incomplete certificate-shaped DER shell tests nonce extraction only, never Apple trust.
const nonceShell=(extensionValue,valueTag=0x04)=>derItems(0x30,derItems(0x30,derItems(0xa3,
  derItems(0x30,derItems(0x30,nonceOid,derNode(valueTag,extensionValue))))));
const nonce=Buffer.alloc(32,0x5a);
const innerOctet=derNode(0x04,nonce);
const appleNonceValue=derItems(0x30,derItems(0xa1,innerOctet));

test('Apple App Attest nonce extraction requires exactly OCTET STRING → SEQUENCE → A1 → OCTET STRING(32)',()=>{
  const extracted=extractAppleAppAttestCertificateNonce(nonceShell(appleNonceValue));
  assert.deepEqual(extracted,nonce);
  assert.equal(extracted.length,32);
});

test('Apple App Attest nonce extraction rejects alternate and malformed DER wrappers',()=>{
  const invalid=[
    ['missing A1',derItems(0x30,innerOctet)],
    ['A0 wrapper',derItems(0x30,derItems(0xa0,innerOctet))],
    ['A2 wrapper',derItems(0x30,derItems(0xa2,innerOctet))],
    ['31-byte nonce',derItems(0x30,derItems(0xa1,derNode(0x04,nonce.subarray(1))))],
    ['33-byte nonce',derItems(0x30,derItems(0xa1,derNode(0x04,Buffer.concat([nonce,Buffer.from([0])]))))],
    ['empty A1',derItems(0x30,derNode(0xa1,Buffer.alloc(0)))],
    ['multiple A1 children',derItems(0x30,derItems(0xa1,innerOctet,innerOctet))],
    ['multiple SEQUENCE children',derItems(0x30,derItems(0xa1,innerOctet),derItems(0xa1,innerOctet))],
    ['trailing bytes inside extension value',Buffer.concat([appleNonceValue,Buffer.from([0])])],
    ['noncanonical DER length',Buffer.concat([Buffer.from([0x30,0x81,appleNonceValue.length-2]),appleNonceValue.subarray(2)])],
    ['truncated DER',appleNonceValue.subarray(0,-1)],
  ];
  for(const [name,value] of invalid)
    assert.throws(()=>extractAppleAppAttestCertificateNonce(nonceShell(value)),/attestation_invalid/,name);
  assert.throws(()=>extractAppleAppAttestCertificateNonce(nonceShell(appleNonceValue,0x05)),/attestation_invalid/,'extension value tag');
  assert.throws(()=>extractAppleAppAttestCertificateNonce(Buffer.concat([nonceShell(appleNonceValue),Buffer.from([0])])),
    /attestation_invalid/,'trailing certificate DER');
});

test('Apple trust anchor is the published App Attestation root and identity includes Team prefix',()=>{
  assert.equal(hash(new X509Certificate(APPLE_APP_ATTEST_ROOT_PEM).raw).toString('hex'),
    '1cb9823ba28ba6ad2d33a006941de2ae4f513ef1d4e831b9f7e0fa7b6242c932');
  assert.equal(APPLE_APP_ID,'2XSH6R7K37.com.gridlygo.gridly');
});
test('App Attest assertion verifies signature, app identity and counter; rejects mutation and replay',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const id=Buffer.alloc(32,23),keyId=id.toString('base64url'),digest=Buffer.alloc(32,17);
  const auth=Buffer.alloc(37);hash(Buffer.from(APPLE_APP_ID)).copy(auth);auth.writeUInt32BE(1,33);
  assert.equal(auth[32],0); // App Attest assertions need not set WebAuthn UP.
  const signedObject=bytes=>item(new Map([['signature',sign('sha256',Buffer.concat([bytes,digest]),privateKey)],
    ['authenticatorData',bytes]])).toString('base64');
  const signature=sign('sha256',Buffer.concat([auth,digest]),privateKey);
  const authorization={type:'apple_assertion',keyId,object:item(new Map([
    ['signature',signature],['authenticatorData',auth]])).toString('base64')};
  const record={environment:'production',counter:0,publicSpki:publicKey.export({format:'der',type:'spki'}).toString('base64')};
  const readKey=async keyHash=>{assert.equal(keyHash,hash(id).toString('hex'));return record;};
  const verify=(patch={},d=digest)=>verifier.verify({authorization:{...authorization,...patch},digest:d,environment:'production',readKey});
  assert.deepEqual(await verify(),{verified:true,platform:'apple',kind:'apple_assertion',keyHash:hash(id).toString('hex'),counter:1});
  for(const flag of [0x40,0x80]){
    const forbidden=Buffer.from(auth);forbidden[32]=flag;
    assert.equal(await verify({object:signedObject(forbidden)}),null,`assertion flag 0x${flag.toString(16)} must deny`);
  }
  assert.equal(await verify({},Buffer.alloc(32,18)),null);
  assert.equal(await verify({keyId:Buffer.alloc(32,24).toString('base64url')}),null);
  assert.equal(await verify({object:'malformed'}),null);
  record.counter=1;assert.equal(await verify(),null);record.counter=0;
  const wrongRp=Buffer.from(auth);hash(Buffer.from('OTHER.com.gridlygo.gridly')).copy(wrongRp);
  assert.equal(await verify({object:signedObject(wrongRp)}),null);
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
