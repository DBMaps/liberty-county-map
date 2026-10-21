// Google review access is a separate authority, never subscription ownership.
export const GOOGLE_REVIEW_AUTHORITY='gridly-google-play-review-v12';
export const GOOGLE_REVIEW_ENDPOINT='gridly-google-review-access';
export const GOOGLE_REVIEW_BUILD_VERSION='14';
// Keep the live Build 12 reviewer working while the replacement is reviewed.
export const GOOGLE_REVIEW_COMPATIBLE_BUILDS=Object.freeze(['12',GOOGLE_REVIEW_BUILD_VERSION]);
const proven=new WeakSet(),encoder=new TextEncoder();
const fields='audience,authority,buildVersionCode,credentialId,credentialRevision,expiresAt,issuedAt,nonce,platform,scope';
export const reviewBase64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>{if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error();return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));};
export async function verifyGoogleReviewProof({proof,publicKey,nonce,now=Date.now(),crypto=globalThis.crypto,acceptedBuilds=[GOOGLE_REVIEW_BUILD_VERSION]}={}) {
  try {
    if(typeof proof!=='string'||proof.length>4096||!publicKey||publicKey.type!=='public'||
      publicKey.algorithm.name!=='ECDSA'||publicKey.algorithm.namedCurve!=='P-256'||!Number.isFinite(now))return null;
    const parts=proof.split('.');if(parts.length!==3)return null;
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if(Object.keys(header).sort().join(',')!=='alg,typ'||header.alg!=='ES256'||header.typ!=='gridly-review-entitlement-v1')return null;
    if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,decode(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))return null;
    const row=JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if(!row||Object.keys(row).sort().join(',')!==fields||row.authority!==GOOGLE_REVIEW_AUTHORITY||
      row.audience!=='com.gridlygo.gridly:google-review'||row.platform!=='google'||row.scope!=='google_play_review'||
      !Array.isArray(acceptedBuilds)||!acceptedBuilds.includes(row.buildVersionCode)||!GOOGLE_REVIEW_COMPATIBLE_BUILDS.includes(row.buildVersionCode)||!/^grr_[a-f0-9]{32}$/.test(row.credentialId)||
      !/^[a-f0-9]{32}$/.test(row.credentialRevision)||
      !/^[A-Za-z0-9_-]{32,128}$/.test(row.nonce)|| (nonce!==undefined&&row.nonce!==nonce)||
      !Number.isSafeInteger(row.issuedAt)||!Number.isSafeInteger(row.expiresAt)||row.issuedAt>now||
      row.expiresAt<=now||row.expiresAt<=row.issuedAt||row.expiresAt-row.issuedAt>180000)return null;
    const value=Object.freeze({...row});proven.add(value);return value;
  }catch{return null;}
}
export function googleReviewAllowed(value,now=Date.now()) {
  return proven.has(value)&&Number.isFinite(now)&&now>=value.issuedAt&&now<value.expiresAt;
}
