import {storeVerificationRequest,cacheRecord,signResponse} from './core.mjs';
const reply=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function boundedBody(request) {
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('invalid_request');
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');const chunks=[];let total=0;
 try {for(let i=0;i<256;i++){const {done,value}=await reader.read();if(done){const bytes=new Uint8Array(total);let at=0;for(const v of chunks){bytes.set(v,at);at+=v.length;}return new TextDecoder().decode(bytes);}total+=value.byteLength;if(total>135168)throw Error('invalid_request');chunks.push(value);}throw Error('invalid_request');}
 finally {void reader.cancel().catch(()=>{});}
}
// Default entrypoints pass only platform: absent security/provider ports => 503.
// No configuration flag, test token or client input can enable a missing port.
export function createHandler({platform,authorizeNative,provider,cache,signingKey,fingerprintKey,crypto=globalThis.crypto}) {
 return async req=>{
  if(req.method!=='POST'||new URL(req.url).search)return reply(405,'invalid_request');
  if(!authorizeNative||!provider||!cache||!signingKey||!fingerprintKey)return reply(503,'verification_unavailable');
  let timer,active=true;
  try {return await Promise.race([(async()=>{
   // Authorizer validates rate limit/attestation, fresh nonce and body digest,
   // and consumes challenge before provider verification. No consumer login.
   const text=await boundedBody(req);
   let raw;try{raw=JSON.parse(text);}catch{return reply(400,'invalid_request');}
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return reply(400,'invalid_request');
   if(Object.keys(raw).sort().join(',') !== (platform==='google'?['platform','environment','nonce','productId','basePlanId','evidence']:['platform','environment','nonce','productId','evidence']).sort().join(','))return reply(400,'invalid_request');
   const input=storeVerificationRequest(raw);
   if(input.platform!==platform||raw.productId!==input.productId||(platform==='google'&&raw.basePlanId!==input.basePlanId))return reply(400,'invalid_request');
   if(!await authorizeNative({request:req,body:text,nonce:input.nonce,environment:input.environment}))return reply(401,'unauthorized');
   const values=input.evidence[platform==='apple'?'signedTransactions':'purchaseTokens'];
   if(values.length!==1)return reply(422,'verification_unavailable'); // No public arbitrary cache read or absence claim.
   const record=await provider.verify(values[0]);
   if(record.platform!==platform||record.environment!==input.environment)return reply(422,'invalid_evidence');
   const cached=await cacheRecord(record,fingerprintKey,crypto);
   if(!active)return reply(504,'verification_unavailable');
   if(!await cache.apply(cached))return reply(409,'reconciliation_retry');
   if(!active)return reply(504,'verification_unavailable');
   if(record.acknowledgementRequired)await provider.acknowledge(values[0]);
   if(!active)return reply(504,'verification_unavailable');
   const proof=await signResponse(record,input.nonce,signingKey,crypto);
   return Response.json({proof},{headers:{'Cache-Control':'no-store'}});
  })(),new Promise(resolve=>{timer=setTimeout(()=>{active=false;resolve(reply(504,'verification_unavailable'));},15000);})]);}
  catch{return reply(502,'verification_unavailable');}
  finally {clearTimeout(timer);}
 };
}
