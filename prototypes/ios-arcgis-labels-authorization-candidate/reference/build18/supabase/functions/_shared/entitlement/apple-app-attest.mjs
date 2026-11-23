import {createHash,verify as verifySignature,createPublicKey} from 'node:crypto';
import {Buffer} from 'node:buffer';

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
export function extractAppleAppAttestCertificateNonce(raw) {
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
    // Apple's nonce SEQUENCE has exactly one constructed [1] (0xA1) around the 32-byte OCTET STRING.
    const context=children(wrapped,seq);if(context.length!==1||context[0].tag!==0xa1)fail();
    const octet=children(wrapped,context[0]);if(octet.length!==1||octet[0].tag!==4)fail();
    found=Buffer.from(wrapped.subarray(octet[0].content,octet[0].end));
  }
  if(found?.length!==32)fail();return found;
}
function parseAuthData(bytes,initial) {
  if(!Buffer.isBuffer(bytes)||bytes.length<(initial?88:37))fail();
  const flags=bytes[32],counter=bytes.readUInt32BE(33);
  // App Attest does not use WebAuthn user presence as an authorization signal; genuine Apple data can omit UP.
  // Genuine App Attest assertions may carry AT; WebAuthn AT semantics do not authorize assertions here.
  if((initial&&!(flags&0x40)) || (!initial&&(flags&0x80)))fail();
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
function certificateTime(bytes,node) {
  const value=bytes.subarray(node.content,node.end).toString('ascii');
  const utc=node.tag===0x17 && /^\d{12}Z$/.test(value);
  const generalized=node.tag===0x18 && /^\d{14}Z$/.test(value);
  if(!utc&&!generalized)fail();
  const year=utc?(Number(value.slice(0,2))<50?2000:1900)+Number(value.slice(0,2)):Number(value.slice(0,4));
  const at=utc?2:4,month=Number(value.slice(at,at+2)),day=Number(value.slice(at+2,at+4));
  const hour=Number(value.slice(at+4,at+6)),minute=Number(value.slice(at+6,at+8)),second=Number(value.slice(at+8,at+10));
  const date=new Date(Date.UTC(year,month-1,day,hour,minute,second));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day||
    date.getUTCHours()!==hour||date.getUTCMinutes()!==minute||date.getUTCSeconds()!==second)fail();
  return date.getTime();
}
function certificateParts(raw) {
  const outer=der(raw);if(outer.tag!==0x30||outer.end!==raw.length)fail();
  const parts=children(raw,outer);if(parts.length!==3||parts[0].tag!==0x30||
    parts[1].tag!==0x30||parts[2].tag!==0x03)fail();
  const fields=children(raw,parts[0]);let at=fields[0]?.tag===0xa0?1:0;
  const serial=fields[at++],innerAlgorithm=fields[at++],issuer=fields[at++],validity=fields[at++],
    subject=fields[at++],spki=fields[at++];
  if(serial?.tag!==0x02||innerAlgorithm?.tag!==0x30||issuer?.tag!==0x30||
    validity?.tag!==0x30||subject?.tag!==0x30||spki?.tag!==0x30)fail();
  const algorithm=children(raw,parts[1]);if(algorithm.length!==1||
    !equal(raw.subarray(innerAlgorithm.start,innerAlgorithm.end),raw.subarray(parts[1].start,parts[1].end)))fail();
  const hash={'1.2.840.10045.4.3.2':'sha256','1.2.840.10045.4.3.3':'sha384',
    '1.2.840.10045.4.3.4':'sha512'}[oid(raw,algorithm[0])];if(!hash)fail();
  const dates=children(raw,validity);if(dates.length!==2)fail();
  const signature=parts[2];if(signature.end-signature.content<2||raw[signature.content]!==0)fail();
  let ca=false,found=false;
  for(const field of fields.slice(at))if(field.tag===0xa3){
    const wrapped=children(raw,field);if(wrapped.length!==1||wrapped[0].tag!==0x30)fail();
    for(const extension of children(raw,wrapped[0])){
      if(extension.tag!==0x30)fail();const items=children(raw,extension);
      if(oid(raw,items[0])!=='2.5.29.19')continue;
      if(found||items.length<2||items.length>3||items.at(-1).tag!==0x04)fail();found=true;
      const value=raw.subarray(items.at(-1).content,items.at(-1).end),basic=der(value);
      if(basic.tag!==0x30||basic.end!==value.length)fail();
      const constraints=children(value,basic);
      if(constraints.length && constraints[0].tag===0x01){
        const boolean=constraints[0];if(boolean.end-boolean.content!==1||
          ![0,0xff].includes(value[boolean.content]))fail();ca=value[boolean.content]===0xff;
      }
    }
  }
  return {raw,issuer:raw.subarray(issuer.start,issuer.end),subject:raw.subarray(subject.start,subject.end),
    from:certificateTime(raw,dates[0]),to:certificateTime(raw,dates[1]),ca,hash,
    tbs:raw.subarray(parts[0].start,parts[0].end),
    signature:raw.subarray(signature.content+1,signature.end),
    publicKey:createPublicKey({key:raw.subarray(spki.start,spki.end),format:'der',type:'spki'})};
}
function signedBy(cert,issuer) {
  return equal(cert.issuer,issuer.subject)&&verifySignature(cert.hash,cert.tbs,issuer.publicKey,cert.signature);
}
function isP256Spki(bytes) {
  const outer=der(bytes);if(outer.tag!==0x30||outer.end!==bytes.length)return false;
  const fields=children(bytes,outer);if(fields.length!==2||fields[0].tag!==0x30||fields[1].tag!==0x03)return false;
  const algorithm=children(bytes,fields[0]);if(algorithm.length!==2||
    oid(bytes,algorithm[0])!=='1.2.840.10045.2.1'||
    oid(bytes,algorithm[1])!=='1.2.840.10045.3.1.7')return false;
  const point=fields[1];return point.end-point.content===66&&bytes[point.content]===0&&bytes[point.content+1]===4;
}
export function verifyPinnedAppleAppAttestRoot(now=Date.now()) {
  const pem=/^-----BEGIN CERTIFICATE-----\n([A-Za-z0-9+/\n]+)\n-----END CERTIFICATE-----$/.exec(APPLE_APP_ATTEST_ROOT_PEM);
  if(!pem)fail();
  const rootRaw=decoded64(pem[1].replace(/\n/g,''),4096);
  if(sha(rootRaw).toString('hex')!==ROOT_SHA256)fail();
  const root=certificateParts(rootRaw);
  if(!root.ca||!signedBy(root,root)||now<root.from||now>root.to)fail();
  return root;
}
function trustedCertificates(chain,rootPem,now) {
  if(!Array.isArray(chain)||chain.length!==2||chain.some(value=>!Buffer.isBuffer(value)||value.length>8192))fail();
  if(rootPem!==APPLE_APP_ATTEST_ROOT_PEM)fail();
  const root=verifyPinnedAppleAppAttestRoot(now),intermediate=certificateParts(chain[1]),leaf=certificateParts(chain[0]);
  if(!intermediate.ca||leaf.ca||!signedBy(intermediate,root)||!signedBy(leaf,intermediate))fail();
  for(const cert of [root,intermediate,leaf])if(now<cert.from||now>cert.to)fail();
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
          !equal(extractAppleAppAttestCertificateNonce(leaf.raw),sha(Buffer.concat([authData,clientHash]))))return null;
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
        const spki=decoded64(record.publicSpki,1024);
        if(!isP256Spki(spki))return null;
        const publicKey=createPublicKey({key:spki,format:'der',type:'spki'});
        // Genuine App Attest assertion signatures verify over the derived nonce, not the raw composite input.
        const assertionNonce=sha(Buffer.concat([authData,clientHash]));
        if(publicKey.asymmetricKeyType!=='ec'||
          !verifySignature('sha256',assertionNonce,publicKey,signature))return null;
        return {verified:true,platform:'apple',kind:'apple_assertion',keyHash:hash,counter:auth.counter};
      }
      return null;
    } catch {return null;}
  }});
}
