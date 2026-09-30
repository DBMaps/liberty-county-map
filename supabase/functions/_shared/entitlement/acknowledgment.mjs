import {cacheRecord} from './core.mjs';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const un64=text=>Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const validToken=token=>typeof token==='string'&&token.length<=16384&&/^[A-Za-z0-9._~+\/-]+={0,2}$/.test(token);
const validVersion=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,32}$/.test(v);
const validKey=k=>k?.algorithm?.name==='AES-GCM'&&k.algorithm.length===256&&!k.extractable&&k.usages.includes('encrypt')&&k.usages.includes('decrypt');
const identity=(environment,fingerprint,version)=>{
 if(!['production','sandbox_test'].includes(environment)||!/^[a-f0-9]{64}$/.test(fingerprint)||!validVersion(version))throw Error('cipher_invalid');
 return enc.encode('gridly-google-ack-v2\0'+environment+'\0'+fingerprint+'\0'+version);
};
// Two explicit versions only. Retirement is absolute and checked on EVERY open.
export function tokenCipher({current,previous,crypto=globalThis.crypto,now=Date.now}) {
 if(!validVersion(current?.version)||!validKey(current?.key))throw Error('configuration_unavailable');
 const retirement=previous?Date.parse(previous.retireAt):null;
 if(previous&&(!validVersion(previous.version)||previous.version===current.version||!validKey(previous.key)||!Number.isFinite(retirement)||retirement<=now()||retirement>now()+3600000))throw Error('configuration_unavailable');
 return Object.freeze({seal:async(token,environment,fingerprint)=>{
  if(!validToken(token))throw Error('invalid_purchase');
  const iv=crypto.getRandomValues(new Uint8Array(12)),key_version=current.version;
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:identity(environment,fingerprint,key_version),tagLength:128},current.key,enc.encode(token));
  return {environment,chain_fingerprint:fingerprint,key_version,iv:b64(iv),ciphertext:b64(new Uint8Array(encrypted))};
 },open:async row=>{
  let key;if(row.key_version===current.version)key=current.key;
  else if(previous&&row.key_version===previous.version&&now()<retirement)key=previous.key;
  else throw Error('key_version_unavailable');
  try{
   if(typeof row.iv!=='string'||!/^[A-Za-z0-9_-]{16}$/.test(row.iv)||typeof row.ciphertext!=='string'||!/^[A-Za-z0-9_-]{23,21867}$/.test(row.ciphertext))throw Error();
   const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(row.iv),additionalData:identity(row.environment,row.chain_fingerprint,row.key_version),tagLength:128},key,un64(row.ciphertext));
   const token=dec.decode(bytes);if(!validToken(token))throw Error();return token;
  }catch{throw Error('cipher_invalid');}
 }});
}
const terminalErrors=new Set(['invalid_purchase','cipher_invalid','key_version_unavailable']);
const retryErrors=new Set(['credential_unavailable','provider_unavailable','reconciliation_retry']);
// No internal token-bearing row appears in drain results. No cached authority.
export function acknowledgmentQueue({environment,store,cipher,provider,cache,fingerprintKey,crypto=globalThis.crypto,now=Date.now}) {
 if(!['production','sandbox/test'].includes(environment)||!['enqueue','claim','resolve'].every(name=>typeof store?.[name]==='function')||!cipher||!provider||!cache||!fingerprintKey)throw Error('ack_unavailable');
 const dbEnv=environment==='production'?'production':'sandbox_test';
 async function process(row,signal) {
  let outcome='retry',category='provider_unavailable';
  try{
   signal?.throwIfAborted();if(row.environment!==dbEnv)throw Error('cipher_invalid');
   // SQL claim excludes expired work; repeat check before external side effects.
   const deadline=Date.parse(row.expires_at),leaseEnd=Date.parse(row.lease_until);
   if(!Number.isFinite(deadline)||!Number.isFinite(leaseEnd))throw Error('cipher_invalid');
   if(now()>=deadline){outcome='terminal';category='retry_deadline';}
   else {
    const token=await cipher.open(row),record=await provider.verify(token,{signal});
    const cached=await cacheRecord(record,fingerprintKey,crypto);
    if(record.platform!=='google'||record.environment!==environment||cached.chain_fingerprint!==row.chain_fingerprint)throw Error('invalid_purchase');
    if(!await cache.apply(cached))throw Error('reconciliation_retry');
    if(record.terminalCategory){outcome='terminal';category=record.terminalCategory;}
    else if(record.entitlementState==='not_entitled'){outcome='terminal';category='provider_denial';}
    else if(record.entitlementState==='entitled'){
     // Do not start ACK after deadline or when lease is close to recovery.
     if(now()>=Math.min(deadline,record.ackDeadlineAt===null?deadline:Date.parse(record.ackDeadlineAt))){outcome='terminal';category='retry_deadline';}
     else if(signal?.aborted||now()+9000>=leaseEnd)throw Error('provider_unavailable');
     else {if(record.acknowledgementRequired)await provider.acknowledge(token,{signal});outcome='success';category='none';}
    }
   }
  }catch(error){
   const name=error?.message;
   if(terminalErrors.has(name)){outcome='terminal';category=name;}
   else {outcome='retry';category=retryErrors.has(name)?name:'provider_unavailable';}
  }
  return {outcome,category,completed:await store.resolve({environment:dbEnv,chain_fingerprint:row.chain_fingerprint,lease:row.lease,outcome,error_category:category})};
 }
 async function drain(fingerprint=null,{signal}={}){
  const rows=await store.claim({environment:dbEnv,limit:fingerprint?1:10,chain_fingerprint:fingerprint});
  if(!Array.isArray(rows)||rows.length>(fingerprint?1:10))throw Error('ack_unavailable');
  return Promise.all(rows.map(row=>process(row,signal)));
 }
 return Object.freeze({drain,ensure:async({token,record,cached})=>{
  if(record.platform!=='google'||record.environment!==environment||record.entitlementState!=='entitled'||!record.acknowledgementRequired)throw Error('ack_unavailable');
  const sealed=await cipher.seal(token,dbEnv,cached.chain_fingerprint);
  if(!await store.enqueue({...sealed,source_started_at:record.purchaseStartedAt,provider_deadline_at:record.ackDeadlineAt}))throw Error('ack_unavailable');
  const outcomes=await drain(cached.chain_fingerprint);
  if(outcomes.length!==1||outcomes[0].outcome!=='success'||outcomes[0].completed!==true)throw Error('ack_unavailable');
  const latest=await provider.verify(token),reconciled=await cacheRecord(latest,fingerprintKey,crypto);
  if(latest.platform!=='google'||latest.environment!==environment||latest.acknowledgementRequired||reconciled.chain_fingerprint!==cached.chain_fingerprint||!await cache.apply(reconciled))throw Error('ack_unavailable');
  return latest;
 }});
}
