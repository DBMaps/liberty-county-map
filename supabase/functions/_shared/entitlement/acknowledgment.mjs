import {cacheRecord} from './core.mjs';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const un64=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const validToken=token=>typeof token==='string'&&token.length<=16384&&/^[A-Za-z0-9._~+\/-]+={0,2}$/.test(token);
const identity=(environment,fingerprint)=>{
 if(!['production','sandbox_test'].includes(environment)||!/^[a-f0-9]{64}$/.test(fingerprint))throw Error('ack_unavailable');
 return enc.encode('gridly-google-ack-v1\0'+environment+'\0'+fingerprint);
};
// Dedicated AES-256-GCM key, outside PostgreSQL. Ciphertext never enters clients/logs.
export function tokenCipher({key,crypto=globalThis.crypto}) {
 if(key?.algorithm?.name!=='AES-GCM'||key.algorithm.length!==256||key.extractable||!key.usages.includes('encrypt')||!key.usages.includes('decrypt'))throw Error('ack_unavailable');
 return Object.freeze({seal:async(token,environment,fingerprint)=>{
  if(!validToken(token))throw Error('ack_unavailable');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:identity(environment,fingerprint)},key,enc.encode(token));
  return {environment,chain_fingerprint:fingerprint,iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
 },open:async row=>{
  if(typeof row.iv!=='string'||!/^[A-Za-z0-9_-]{16}$/.test(row.iv)||typeof row.ciphertext!=='string'||! /^[A-Za-z0-9_-]{23,21867}$/.test(row.ciphertext))throw Error('ack_unavailable');
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(row.iv),additionalData:identity(row.environment,row.chain_fingerprint)},key,un64(row.ciphertext));
  const token=dec.decode(bytes);if(!validToken(token))throw Error('ack_unavailable');return token;
 }});
}
// Ports are server-only restricted RPCs. Each claimed item is freshly verified,
// reconciled, acknowledged only if entitled, then completed under its lease.
// A crash after Google success is recovered by reading ACKNOWLEDGED next time.
export function acknowledgmentQueue({environment,store,cipher,provider,cache,fingerprintKey,crypto=globalThis.crypto}) {
 if(!['production','sandbox/test'].includes(environment)||!['enqueue','claim','resolve'].every(name=>typeof store?.[name]==='function')||!cipher||!provider||!cache||!fingerprintKey)throw Error('ack_unavailable');
 const dbEnv=environment==='production'?'production':'sandbox_test';
 async function process(row) {
  let outcome='retry',category='provider_unavailable';
  try {
   if(row.environment!==dbEnv)throw Error('ack_unavailable');
   let token;try{token=await cipher.open(row);}catch{category='cipher_unavailable';throw Error('ack_unavailable');}
   const record=await provider.verify(token);
   const cached=await cacheRecord(record,fingerprintKey,crypto);
   if(record.platform!=='google'||record.environment!==environment||cached.chain_fingerprint!==row.chain_fingerprint)throw Error('ack_unavailable');
   category='reconciliation_retry';if(!await cache.apply(cached))throw Error('ack_unavailable');
   category='provider_unavailable';
   if(record.entitlementState==='not_entitled'){outcome='denied';category='none';}
   else if(record.entitlementState==='entitled'){
    category='provider_unavailable';if(record.acknowledgementRequired)await provider.acknowledge(token);
    outcome='success';category='none';
   }
   token=null;
  }catch{/* Never serialize the caught error, token, evidence or provider URL. */}
  return {outcome,completed:await store.resolve({environment:dbEnv,chain_fingerprint:row.chain_fingerprint,lease:row.lease,outcome,error_category:category})};
 }
 async function drain(fingerprint=null) {
  const rows=await store.claim({environment:dbEnv,limit:fingerprint?1:10,chain_fingerprint:fingerprint});
  if(!Array.isArray(rows)||rows.length>(fingerprint?1:10))throw Error('ack_unavailable');
  return Promise.all(rows.map(process));
 }
 return Object.freeze({drain,ensure:async({token,record,cached})=>{
  if(record.platform!=='google'||record.environment!==environment||record.entitlementState!=='entitled'||!record.acknowledgementRequired)throw Error('ack_unavailable');
  const sealed=await cipher.seal(token,dbEnv,cached.chain_fingerprint);
  if(!await store.enqueue(sealed))throw Error('ack_unavailable');
  const outcomes=await drain(cached.chain_fingerprint);
  if(outcomes.length!==1||outcomes[0].outcome!=='success'||outcomes[0].completed!==true)throw Error('ack_unavailable');
  // Never sign the earlier request observation after a newer retry observation.
  const latest=await provider.verify(token),reconciled=await cacheRecord(latest,fingerprintKey,crypto);
  if(latest.platform!=='google'||latest.environment!==environment||latest.acknowledgementRequired||reconciled.chain_fingerprint!==cached.chain_fingerprint||!await cache.apply(reconciled))throw Error('ack_unavailable');
  return latest;
 }});
}
