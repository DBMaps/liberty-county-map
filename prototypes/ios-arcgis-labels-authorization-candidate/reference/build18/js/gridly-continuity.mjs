import {STORE_VERIFIERS} from './gridly-store-verification.mjs';
// Durable authorization is separate from the nonce-bound, five-minute response.
export const CONTINUITY_MS=24*60*60*1000;
const branded=new WeakSet();
const fields=['platform','productId','entitlementState','subscriptionState','lastVerifiedAt','currentPeriodEnd','continuityExpiresAt','environment','audience','binding','verificationSource'];
const epoch=value=>typeof value==='string'?Date.parse(value):NaN;
const decode=part=>{if(!/^[A-Za-z0-9_-]+$/.test(part))throw Error();return Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));};
export async function verifyContinuity({proof,publicKey,binding,platform,environment='production',now,crypto=globalThis.crypto}) {
 try {
  if(!['apple','google'].includes(platform)||environment!=='production'||!Number.isFinite(now)||!/^[a-f0-9]{64}$/.test(binding)||typeof proof!=='string'||proof.length>4096||publicKey?.type!=='public'||publicKey.algorithm.name!=='ECDSA'||publicKey.algorithm.namedCurve!=='P-256')return null;
  const parts=proof.split('.');if(parts.length!==3)return null;
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if(Object.keys(header).sort().join(',')!=='alg,typ'||header.alg!=='ES256'||header.typ!=='gridly-continuity-v1')return null;
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
  const row=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const verified=epoch(row.lastVerifiedAt),end=epoch(row.currentPeriodEnd),expiry=epoch(row.continuityExpiresAt);
  if(Object.keys(row).sort().join(',')!==[...fields].sort().join(',')||row.platform!==platform||row.productId!==STORE_VERIFIERS[platform].productId||row.environment!==environment||row.binding!==binding||row.audience!=='com.gridlygo.gridly'||row.verificationSource!=='gridly_server_store_api'||row.subscriptionState!=='active'||row.entitlementState!=='entitled'||!Number.isFinite(verified)||!Number.isFinite(end)||!Number.isFinite(expiry)||verified>now||end<=verified||expiry!==Math.min(end,verified+CONTINUITY_MS)||now>=expiry)return null;
  const result=Object.freeze(row);branded.add(result);return result;
 } catch {return null;}
}
export function continuityDecision(row,{platform,now}={}) {
 return !!row&&branded.has(row)&&row.platform===platform&&row.environment==='production'&&Number.isFinite(now)&&now>=epoch(row.lastVerifiedAt)&&now<epoch(row.continuityExpiresAt)&&now<epoch(row.currentPeriodEnd);
}
