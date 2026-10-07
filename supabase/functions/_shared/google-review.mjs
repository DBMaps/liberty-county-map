import {GOOGLE_REVIEW_AUTHORITY,reviewBase64,verifyGoogleReviewProof} from '../../../js/gridly-google-review-proof.mjs';
import {validateGoogleReviewReport} from './google-review-report-validation.mjs';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage'};
const reply=(status,code)=>Response.json({status:code},{status,headers});
const encoder=new TextEncoder();
async function bodyText(request){
  const reader=request.body?.getReader();if(!reader)throw Error();let size=0;const chunks=[];
  try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768)throw Error();chunks.push(value);}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(bytes);
  }finally{reader.releaseLock();}
}
// The sole database port accepts credential metadata only. Report bodies never
// leave this isolate. No Publisher, subscription ledger or report writer port.
/** @param {{publicKey?: unknown, privateKey?: unknown, authorizeNative?: unknown, credentialAuthority?: unknown, reportingStatus?: unknown, crypto?: Crypto, now?: () => number}} options */
export function createGoogleReviewHandler({publicKey,privateKey,authorizeNative,credentialAuthority,reportingStatus,crypto=globalThis.crypto,now=Date.now}={}) {
  return async request=>{
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST'||new URL(request.url).search)return reply(405,'invalid_request');
    if(!publicKey||!privateKey||![authorizeNative,credentialAuthority,reportingStatus].every(fn=>typeof fn==='function'))return reply(503,'maintenance');
    try {
      const text=await bodyText(request),body=JSON.parse(text);
      if(!body||Array.isArray(body)||typeof body!=='object')return reply(400,'invalid_request');
      if(Object.keys(body).sort().join(',')==='args,operation,proof,protocol_version') {
        if(body.protocol_version!==2)return reply(400,'invalid_request');
        const proof=await verifyGoogleReviewProof({proof:body.proof,publicKey,now:now(),crypto});
        if(!proof)return reply(403,'forbidden');
        if(!await credentialAuthority({action:'report',credentialId:proof.credentialId,revision:proof.credentialRevision}))return reply(403,'forbidden');
        const status=await reportingStatus();
        if(status?.reporting_enabled!==true||status.protocol_version!==2)return reply(503,'maintenance');
        if(!validateGoogleReviewReport(body.operation,body.args,{now:now()}))return reply(400,'invalid_request');
        // Typed validation acknowledgement contains no incident, UUID, device,
        // report payload, or claim that a community incident was published.
        return Response.json({status:'review_validated',authority:GOOGLE_REVIEW_AUTHORITY,protocol_version:2,publication:'none'},{headers});
      }
      if(Object.keys(body).sort().join(',')!=='basePlanId,environment,evidence,nativeAuthorization,nativeChallenge,nonce,platform,productId'||
        body.platform!=='google'||body.environment!=='production'||body.productId!=='com.gridlygo.gridly.monthly'||body.basePlanId!=='monthly'||
        !/^[A-Za-z0-9_-]{32,128}$/.test(body.nonce)||!body.evidence||Object.keys(body.evidence).join(',')!=='purchaseTokens'||
        !Array.isArray(body.evidence.purchaseTokens)||body.evidence.purchaseTokens.length!==1||
        typeof body.evidence.purchaseTokens[0]!=='string'||!/^grr_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/.test(body.evidence.purchaseTokens[0]))return reply(400,'invalid_request');
      // Credential is bound to the existing attested envelope; NEVER sent to
      // Google Publisher or interpreted as subscription purchase evidence.
      const code=body.evidence.purchaseTokens[0],credentialId=code.slice(0,36);
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(code))),b=>b.toString(16).padStart(2,'0')).join('');
      const admitted=await credentialAuthority({action:'login',credentialId,digest});
      if(!admitted||admitted.credentialId!==credentialId||!/^[a-f0-9]{32}$/.test(admitted.credentialRevision))return reply(403,'forbidden');
      const revision=admitted.credentialRevision;
      if(!await authorizeNative({body:text,environment:'production'})){await credentialAuthority({action:'denied',credentialId,revision});return reply(403,'forbidden');}
      if(!await credentialAuthority({action:'verified',credentialId,revision}))return reply(403,'forbidden');
      const issuedAt=now(),row={authority:GOOGLE_REVIEW_AUTHORITY,scope:'google_play_review',platform:'google',buildVersionCode:'12',
        audience:'com.gridlygo.gridly:google-review',credentialId,credentialRevision:revision,nonce:body.nonce,issuedAt,expiresAt:issuedAt+180000};
      const head=reviewBase64(encoder.encode(JSON.stringify({alg:'ES256',typ:'gridly-review-entitlement-v1'}))),payload=reviewBase64(encoder.encode(JSON.stringify(row)));
      const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},privateKey,encoder.encode(head+'.'+payload));
      const proof=head+'.'+payload+'.'+reviewBase64(new Uint8Array(signature));
      if(!await verifyGoogleReviewProof({proof,publicKey,nonce:body.nonce,now:now(),crypto}))return reply(503,'maintenance');
      return Response.json({proof},{headers});
    }catch{return reply(503,'retryable_failure');}
  };
}
