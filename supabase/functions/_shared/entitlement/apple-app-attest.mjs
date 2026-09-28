import {X509Certificate,createHash,verify as verifySignature,createPublicKey} from 'node:crypto';

// Published by Apple at https://www.apple.com/certificateauthority/private/
// This is a public trust anchor, never an app/server signing credential.
export const APPLE_APP_ATTEST_ROOT_PEM = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

export const APPLE_APP_ID = '2XSH6R7K37.com.gridlygo.gridly';
const ROOT_SHA256 = '1cb9823ba28ba6ad2d33a006941de2ae4f513ef1d4e831b9f7e0fa7b6242c932';
const nonceOid = '1.2.840.113635.100.8.2';
const sha = value => createHash('sha256').update(value).digest();
const equal = (a,b) => Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.length===b.length && a.equals(b);
function fail() { throw Error('attestation_invalid'); }
function decoded64(value,max,allowUrl=false) {
  if(typeof value!=='string' || !value.length || value.length>max ||
    !(allowUrl?/^[A-Za-z0-9+/_-]+={0,2}$/:/^[A-Za-z0-9+/]+={0,2}$/).test(value))fail();
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  const result=Buffer.from(normalized,'base64');
  if(!result.length || result.toString('base64').replace(/=+$/,'')!==normalized.replace(/=+$/,''))fail();
  return result;
}
function readCbor(bytes,{maxDepth=8,allowTrailing=false}={}) {
  let at=0;
  function item(depth) {
    if(depth>maxDepth || at>=bytes.length)fail();
    const first=bytes[at++],major=first>>5,small=first&31;
    function length() {
      if(small<24)return small;
      const n=small===24?1:small===25?2:small===26?4:0;
      if(!n || at+n>bytes.length)fail();
      let value=0;for(let i=0;i<n;i++)value=value*256+bytes[at++];
      if(value<24 || (n===2&&value<=255) || (n===4&&value<=65535))fail();
      return value;
    }
    const n=length();if(n>bytes.length)fail();
    if(major===0)return n;
    if(major===1)return -1-n;
    if(major===2 || major===3){if(at+n>bytes.length)fail();const slice=bytes.subarray(at,at+n);at+=n;
      return major===2?Buffer.from(slice):new TextDecoder('utf-8',{fatal:true}).decode(slice);}
    if(major===4){if(n>16)fail();const out=[];for(let i=0;i<n;i++)out.push(item(depth+1));return out;}
    if(major===5){if(n>16)fail();const out=new Map();for(let i=0;i<n;i++){const key=item(depth+1);
      if(typeof key!=='string' && !Number.isInteger(key))fail();if(out.has(key))fail();out.set(key,item(depth+1));}return out;}
    fail();
  }
  const value=item(0);if(!allowTrailing&&at!==bytes.length)fail();return allowTrailing?{value,bytesRead:at}:value;
}
function der(bytes,at=0) {
  if(at+2>bytes.length)fail();const start=at,tag=bytes[at++],first=bytes[at++];let len;
  if(first<128)len=first;
  else {const count=first&127;if(count<1||count>3||at+count>bytes.length||bytes[at]===0)fail();
    len=0;for(let i=0;i<count;i++)len=len*256+bytes[at++];if(len<128)fail();}
  if(at+len>bytes.length)fail();return {tag,start,content:at,end:at+len};
}
function children(bytes,node) {
  let at=node.content;const out=[];while(at<node.end){const child=der(bytes,at);out.push(child);at=child.end;if(out.length>64)fail();}
  if(at!==node.end)fail();return out;
}
function oid(bytes,node) {
  if(node.tag!==6)fail();const arr=bytes.subarray(node.content,node.end);if(!arr.length)fail();
  const parts=[Math.floor(arr[0]/40),arr[0]%40];let value=0,pending=false;
  for(let i=1;i<arr.length;i++){value=value*128+(arr[i]&127);if(value>0xffffffff)fail();pending=!!(arr[i]&128);
    if(!pending){parts.push(value);value=0;}}
  if(pending)fail();return parts.join('.');
}
function certificateNonce(raw) {
  const outer=der(raw);if(outer.tag!==0x30||outer.end!==raw.length)fail();
  const tbs=children(raw,outer)[0];if(tbs?.tag!==0x30)fail();
  const extensions=children(raw,tbs).find(node=>node.tag===0xa3);if(!extensions)fail();
  const sequence=children(raw,extensions)[0];if(sequence?.tag!==0x30)fail();
  let found;
  for(const entry of children(raw,sequence)){
    if(entry.tag!==0x30)fail();const fields=children(raw,entry);
    if(oid(raw,fields[0])!==nonceOid)continue;
    if(found || fields.length<2 || fields.length>3)fail();
    const value=fields.at(-1);if(value.tag!==4)fail();
    const wrapped=raw.subarray(value.content,value.end),seq=der(wrapped);
    if(seq.tag!==0x30||seq.end!==wrapped.length)fail();
    const octet=children(wrapped,seq);if(octet.length!==1||octet[0].tag!==4)fail();
    found=Buffer.from(wrapped.subarray(octet[0].content,octet[0].end));
  }
  if(found?.length!==32)fail();return found;
}
function parseAuthData(bytes,initial) {
  if(!Buffer.isBuffer(bytes)||bytes.length<(initial?88:37))fail();
  const flags=bytes[32],counter=bytes.readUInt32BE(33);
  if(!(flags&1) || !!(flags&0x40)!==initial || (!initial&&(flags&0x80)))fail();
  if(!equal(bytes.subarray(0,32),sha(Buffer.from(APPLE_APP_ID))))fail();
  if(!initial){if(bytes.length!==37 || counter===0)fail();return {counter};}
  const aaguid=bytes.subarray(37,53),size=bytes.readUInt16BE(53);
  if(size!==32 || bytes.length<=55+size)fail();
  const credentialId=bytes.subarray(55,55+size),tail=bytes.subarray(55+size);
  const parsed=readCbor(tail,{allowTrailing:true}),cose=parsed.value;
  if(!(cose instanceof Map) || cose.size!==5 || cose.get(1)!==2 || cose.get(3)!==-7 || cose.get(-1)!==1 ||
    !Buffer.isBuffer(cose.get(-2)) || cose.get(-2).length!==32 || !Buffer.isBuffer(cose.get(-3)) || cose.get(-3).length!==32)fail();
  if(flags&0x80){
    const extensions=readCbor(tail.subarray(parsed.bytesRead));
    const category=extensions?.get?.('apple_validation_category_01'),version=extensions?.get?.('apple_bundle_version_01');
    if(!(extensions instanceof Map)||!Buffer.isBuffer(category)||category.length!==4||
      ![2,4].includes(category.readUInt32LE())||version!=='1')fail();
  } else if(parsed.bytesRead!==tail.length)fail();
  return {counter,aaguid,credentialId,point:Buffer.concat([Buffer.from([4]),cose.get(-2),cose.get(-3)])};
}
function trustedCertificates(chain,rootPem,now) {
  if(!Array.isArray(chain)||chain.length!==2||chain.some(value=>!Buffer.isBuffer(value)||value.length>8192))fail();
  const root=new X509Certificate(rootPem),leaf=new X509Certificate(chain[0]),intermediate=new X509Certificate(chain[1]);
  if(sha(root.raw).toString('hex')!==ROOT_SHA256)fail();
  if(!root.ca || !intermediate.ca || leaf.ca || !leaf.checkIssued(intermediate) || !intermediate.checkIssued(root) ||
    !leaf.verify(intermediate.publicKey) || !intermediate.verify(root.publicKey))fail();
  for(const cert of [root,intermediate,leaf])if(now<cert.validFromDate.getTime()||now>cert.validToDate.getTime())fail();
  return leaf;
}
function keyHash(id) {return sha(id).toString('hex');}

// No caller-provided root or identity is accepted. The only trust anchor is the
// Apple private PKI root pinned above; the request supplies just evidence.
export function createAppleAppAttestVerifier({now=Date.now}={}) {
  return Object.freeze({verify:async ({authorization,digest,environment,readKey})=>{
    try {
      if(environment!=='production'||!(digest instanceof Uint8Array)||digest.length!==32||
        typeof authorization?.keyId!=='string'||typeof readKey!=='function')return null;
      const id=decoded64(authorization.keyId,128,true);if(id.length!==32)return null;
      const object=readCbor(decoded64(authorization.object,32768));
      if(!(object instanceof Map))return null;
      const hash=keyHash(id),clientHash=Buffer.from(digest);
      if(authorization.type==='apple_initial'){
        if(object.size!==3||object.get('fmt')!=='apple-appattest')return null;
        const statement=object.get('attStmt'),authData=object.get('authData');
        if(!(statement instanceof Map)||statement.size!==2||!Buffer.isBuffer(statement.get('receipt'))||
          statement.get('receipt').length<1||statement.get('receipt').length>8192)return null;
        const leaf=trustedCertificates(statement.get('x5c'),APPLE_APP_ATTEST_ROOT_PEM,now());
        const auth=parseAuthData(authData,true);
        if(auth.counter!==0 || !equal(auth.aaguid,Buffer.from([97,112,112,97,116,116,101,115,116,0,0,0,0,0,0,0])) ||
          !equal(auth.credentialId,id) || !equal(sha(auth.point),id) ||
          !equal(certificateNonce(leaf.raw),sha(Buffer.concat([authData,clientHash]))))return null;
        const jwk=leaf.publicKey.export({format:'jwk'});
        if(jwk.kty!=='EC'||jwk.crv!=='P-256'||!equal(Buffer.from(jwk.x,'base64url'),auth.point.subarray(1,33))||
          !equal(Buffer.from(jwk.y,'base64url'),auth.point.subarray(33)))return null;
        const publicSpki=leaf.publicKey.export({format:'der',type:'spki'}).toString('base64');
        return {verified:true,platform:'apple',kind:'apple_initial',keyHash:hash,publicSpki,counter:0};
      }
      if(authorization.type==='apple_assertion'){
        if(object.size!==2)return null;
        const signature=object.get('signature'),authData=object.get('authenticatorData');
        if(!Buffer.isBuffer(signature)||signature.length<64||signature.length>128)return null;
        const auth=parseAuthData(authData,false),record=await readKey(hash);
        if(record?.environment!=='production'||!Number.isSafeInteger(record.counter)||auth.counter<=record.counter||
          typeof record.publicSpki!=='string')return null;
        const publicKey=createPublicKey({key:decoded64(record.publicSpki,1024),format:'der',type:'spki'});
        if(publicKey.asymmetricKeyType!=='ec'||publicKey.asymmetricKeyDetails?.namedCurve!=='prime256v1'||
          !verifySignature('sha256',Buffer.concat([authData,clientHash]),publicKey,signature))return null;
        return {verified:true,platform:'apple',kind:'apple_assertion',keyHash:hash,counter:auth.counter};
      }
      return null;
    } catch {return null;}
  }});
}
