import {randomUUID} from 'node:crypto';
import {p256Key} from '../../../gateway/web-proof.mjs';
import {leaseBinding} from '../../../gateway/foundation/protocol.mjs';
import {contract as c,exact,digest,uuid,mac,authenticated,until,live,fresh,pinned,readJson,settings,base,canonical,freeze} from './contract.mjs';
const verified=new WeakMap();
export const isVerifiedDecision=(value,expectedOrigin)=>verified.has(value)&&(expectedOrigin===undefined||verified.get(value)===expectedOrigin);
// Transport and replay persistence are explicit server-owned ports, never HTTP fields.
export function createAuthorityClient(options={}){
 let s;try{s=settings(options);}catch{return Object.freeze({});}
 const {transport,replay,now=Date.now,maxInFlight=2}=options;
 if(typeof transport!=='function'||typeof replay?.claim!=='function'||!Number.isInteger(maxInFlight)||maxInFlight<1||maxInFlight>4)return Object.freeze({});
 let active=0;
 async function call(operation,payload,caller){
  if(active>=maxInFlight)throw Error('verification_unavailable');
  const signal=AbortSignal.any([AbortSignal.timeout(s.budget),...(caller?[caller]:[])]);live(signal);active++;
  const work=(async()=>{
   const issuedAt=now(),body={...base(s.labelOrigin),issuer:c.caller,audience:c.issuer,requestId:randomUUID(),issuedAt,expiresAt:issuedAt+s.budget,operation,payload};
   const text=JSON.stringify({body,mac:mac(body,s.requestKey,'request')});if(Buffer.byteLength(text)>c.requestBytes)throw Error();
   const response=await transport(s.endpoint,{method:'POST',redirect:'error',signal,headers:{'content-type':'application/json'},body:text});live(signal);
   if(response.status!==200||response.redirected||(response.url&&response.url!==s.endpoint))throw Error();
   const packet=await readJson(response,c.responseBytes,signal);
   if(!authenticated(packet,s.responseKey,'response'))throw Error();
   const b=packet.body,t=now();
   if(!exact(b,['version','purpose','appId','attestAppId','store','attest','origin','issuer','audience','requestId','requestDigest','responseId','operation','issuedAt','expiresAt','result'])||
    b.version!==1||b.issuer!==c.issuer||b.audience!==c.caller||!pinned(b,s.labelOrigin)||b.requestId!==body.requestId||b.requestDigest!==digest(canonical(body))||b.operation!==operation||!uuid(b.responseId)||!fresh(b,t)||b.expiresAt>body.expiresAt)throw Error();
   if(operation==='challenge'){
    if(!exact(b.result,['challengeId','expiresAt','purpose'])||b.result.challengeId!==payload.id||b.result.purpose!==c.purpose||!Number.isSafeInteger(b.result.expiresAt)||b.result.expiresAt<=t||b.result.expiresAt>t+120000)throw Error();
   }else{
    const r=b.result,tile=await p256Key(payload.spki);
    if(!exact(r,['kind','challengeId','binding','fingerprint','paidDigest','attest','paid'])||!tile||r.kind!=='labels_decision'||r.challengeId!==payload.challengeId||r.fingerprint!==tile.fingerprint||r.paidDigest!==digest(payload.paidEvidence)||
      r.binding!==leaseBinding({appId:c.appId,challengeId:payload.challengeId,paidEvidence:payload.paidEvidence,fingerprint:tile.fingerprint,store:c.store,attest:c.attest}))throw Error();
    const a=r.attest,p=r.paid;
    if(!exact(a,['verified','binding','purpose','challengeId','appId','environment','installation','verifiedAt','challengeExpiresAt'])||a.verified!==true||a.binding!==r.binding||a.purpose!==c.purpose||a.challengeId!==r.challengeId||a.appId!==c.appId||a.environment!==c.attest||! /^[a-f0-9]{64}$/.test(a.installation)||!Number.isSafeInteger(a.verifiedAt)||a.verifiedAt>t||t-a.verifiedAt>=120000||!Number.isSafeInteger(a.challengeExpiresAt)||a.challengeExpiresAt<=t||a.challengeExpiresAt>t+120000)throw Error();
    if(!exact(p,['verified','kind','environment','revoked','lineage','verifiedAt','periodEnd'])||p.verified!==true||p.kind!=='paid_admission'||p.environment!==c.store||p.revoked!==false||! /^[a-f0-9]{64}$/.test(p.lineage)||!Number.isSafeInteger(p.verifiedAt)||p.verifiedAt>t||t-p.verifiedAt>=300000||!Number.isSafeInteger(p.periodEnd)||p.periodEnd<=t||b.expiresAt>p.periodEnd||b.expiresAt>a.challengeExpiresAt)throw Error();
   }
   live(signal);
   if(await replay.claim({namespace:'labels-response',id:b.responseId,expiresAt:b.expiresAt,signal})!==true)throw Error();
   live(signal);if(!fresh(b,now()))throw Error();
   const result=freeze({...b.result,decisionExpiresAt:b.expiresAt});if(operation==='authorize')verified.set(result,s.labelOrigin);
   return result;
  })();
  void work.finally(()=>active--).catch(()=>{});
  try{return await until(work,signal);}catch{throw Error('verification_unavailable');}
 }
 return Object.freeze({issueChallenge:({id,input,signal})=>call('challenge',{id,input},signal),authorize:(payload,signal)=>call('authorize',payload,signal)});
}

