import * as core from './core.mjs';
import {recordVerifierStageDiagnostic} from './verifier-stage-diagnostic.mjs';
const {storeVerificationRequest,cacheRecord,signResponse}=core;
const reply=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function boundedBody(request) {
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('invalid_request');
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');const chunks=[];let total=0;
 try {for(let i=0;i<256;i++){const {done,value}=await reader.read();if(done){const bytes=new Uint8Array(total);let at=0;for(const v of chunks){bytes.set(v,at);at+=v.length;}return new TextDecoder().decode(bytes);}total+=value.byteLength;if(total>135168)throw Error('invalid_request');chunks.push(value);}throw Error('invalid_request');}
 finally {void reader.cancel().catch(()=>{});}
}
// Default entrypoints pass only platform: absent security/provider ports => 503.
// No configuration flag, test token or client input can enable a missing port.
/** @param {{platform: string, authorizeNative?: unknown, provider?: unknown, cache?: unknown,
 *  ackQueue?: unknown, signingKey?: unknown, fingerprintKey?: unknown, crypto?: Crypto}} options */
export function createHandler({platform,authorizeNative,provider,cache,ackQueue,signingKey,fingerprintKey,crypto=globalThis.crypto,diagnostic}) {
 return async req=>{
  if(req.method!=='POST'||new URL(req.url).search)return reply(405,'invalid_request');
  if(!authorizeNative||!provider||!cache||!signingKey||!fingerprintKey||(platform==='google'&&!ackQueue))return reply(503,'verification_unavailable');
  let timer,active=true,stage='request_validation';
  const report=(name,status)=>recordVerifierStageDiagnostic({platform,stage:name,http_status:status},diagnostic);
  try {return await Promise.race([(async()=>{
   // Authorizer validates rate limit/attestation, fresh nonce and body digest,
   // and consumes challenge before provider verification. No consumer login.
   const text=await boundedBody(req);
   let raw;try{raw=JSON.parse(text);}catch{report('request_validation',400);return reply(400,'invalid_request');}
   if(!raw||typeof raw!=='object'||Array.isArray(raw)){report('request_validation',400);return reply(400,'invalid_request');}
   const fields=Object.keys(raw).filter(key=>!['continuityBinding','nativeChallenge','nativeAuthorization'].includes(key));
   const expected=platform==='google'?['platform','environment','nonce','productId','basePlanId','evidence']:['platform','environment','nonce','productId','evidence'];
   if(platform==='apple'&&raw.nativeAuthorizationEnvironment!==undefined)expected.push('nativeAuthorizationEnvironment');
   if(fields.sort().join(',')!==expected.sort().join(',')){report('request_validation',400);return reply(400,'invalid_request');}
   const input=storeVerificationRequest(raw);
   if(input.platform!==platform||raw.productId!==input.productId||(platform==='google'&&raw.basePlanId!==input.basePlanId)){report('request_validation',400);return reply(400,'invalid_request');}
   stage='native_authorization';
   if(!await authorizeNative({request:req,body:text,nonce:input.nonce,environment:input.nativeAuthorizationEnvironment??input.environment})){report(stage,401);return reply(401,'unauthorized');}
   const values=input.evidence[platform==='apple'?'signedTransactions':'purchaseTokens'];
   if(values.length!==1){report('provider_verification',422);return reply(422,'verification_unavailable');} // No public arbitrary cache read or absence claim.
   stage='provider_verification';
   let record=await provider.verify(values[0],{environment:input.environment});
   if(record.platform!==platform||record.environment!==input.environment){report('provider_verification',422);return reply(422,'invalid_evidence');}
   stage='cache_reconciliation';
   const cached=await cacheRecord(record,fingerprintKey,crypto);
   if(!active)return reply(504,'verification_unavailable');
   const applied=platform==='google'?
    await cache.apply(cached,await core.lineageRecords(record,fingerprintKey,crypto)):
    await cache.apply(cached);
   if(!applied){report(stage,409);return reply(409,'reconciliation_retry');}
   if(!active)return reply(504,'verification_unavailable');
   if(record.acknowledgementRequired){stage='acknowledgment';record=await ackQueue.ensure({token:values[0],record,cached});}
   if(!active)return reply(504,'verification_unavailable');
   stage='proof_signing';
   const proof=await signResponse(record,input.nonce,signingKey,crypto,{continuityBinding:input.continuityBinding});
   return Response.json({proof},{headers:{'Cache-Control':'no-store'}});
  })(),new Promise(resolve=>{timer=setTimeout(()=>{active=false;report(stage,504);resolve(reply(504,'verification_unavailable'));},15000);})]);}
  catch(error){
   const safeStage=stage==='provider_verification'&&error?.message==='credential_unavailable'?'provider_credentials':
    stage==='provider_verification'&&error?.message==='provider_unavailable'?'provider_http':stage;
   report(safeStage,502);return reply(502,'verification_unavailable');
  }
  finally {clearTimeout(timer);}
 };
}

