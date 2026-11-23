import {normalizeApple} from './core.mjs';

const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':
 value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const fromHex=value=>Uint8Array.from(value.match(/../g),part=>parseInt(part,16));
async function bounded(response){
 const reader=response.body?.getReader();if(!reader)throw Error('provider_unavailable');
 let size=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('invalid_evidence');parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function factsValid(body,environment,digest,now){
 if(!exact(body,['version','environment','requestDigest','issuedAt','originalReference','transaction','renewal','status'])||
  body.version!==1||body.environment!==environment||body.requestDigest!==digest||
  !Number.isSafeInteger(body.issuedAt)||body.issuedAt<now-90000||body.issuedAt>now+30000||
  typeof body.originalReference!=='string'||!body.originalReference||body.originalReference.length>128||
  !exact(body.transaction,['bundleId','productId','type','environment','originalTransactionId','expiresDate','revocationDate'])||
  !exact(body.renewal,['originalTransactionId','productId','environment','autoRenewStatus'])||
  !Number.isSafeInteger(body.transaction.expiresDate)||body.transaction.expiresDate<=0||
  (body.transaction.revocationDate!==null&&(!Number.isSafeInteger(body.transaction.revocationDate)||body.transaction.revocationDate<=0))||
  ![0,1].includes(body.renewal.autoRenewStatus)||![1,2,3,4,5].includes(body.status))throw Error('invalid_evidence');
}
export function appleNodeAdapter({url,token,hmacKey,fetchImpl=fetch,crypto=globalThis.crypto,now=Date.now}){
 const target=new URL(url);
 if(target.protocol!=='https:'||!/^[a-z0-9]+\.lambda-url\.us-east-1\.on\.aws$/.test(target.hostname)||
  target.pathname!=='/'||target.search||target.hash||target.username||target.password||
 !/^[A-Za-z0-9_-]{43,128}$/.test(token)||hmacKey?.algorithm?.name!=='HMAC'||
  hmacKey.algorithm.hash?.name!=='SHA-256'||hmacKey.extractable)throw Error('configuration_unavailable');
 return Object.freeze({verify:async(signed,{environment}={})=>{
  if(!['production','sandbox/test'].includes(environment)||typeof signed!=='string'||signed.length>16384||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(signed))throw Error('invalid_evidence');
  const response=await fetchImpl(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(11000),
   headers:{'content-type':'application/json','x-gridly-apple-node-token':token},
   body:JSON.stringify({environment,signedTransaction:signed})});
  if(response.status!==200){response.body?.cancel().catch(()=>{});throw Error('provider_unavailable');}
  const message=await bounded(response);
  if(!exact(message,['body','mac'])||typeof message.mac!=='string'||!/^[a-f0-9]{64}$/.test(message.mac))throw Error('invalid_evidence');
  const encoded=new TextEncoder().encode('gridly-apple-node-v1\n'+canonical(message.body));
  if(!await crypto.subtle.verify('HMAC',hmacKey,fromHex(message.mac),encoded))throw Error('invalid_evidence');
  const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(environment+'\n'+signed)));
  factsValid(message.body,environment,digest,now());
  return normalizeApple(message.body.transaction,message.body.renewal,message.body.status,
   {env:environment,originalReference:message.body.originalReference,now:now()});
 }});
}
