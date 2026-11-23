import {randomUUID} from 'node:crypto';
import {createLabelsChallengeIssuer} from '../../../server/labels-challenge-adapter.mjs';
import {createLabelsAttestAdapter} from '../../../server/labels-attest-adapter.mjs';
import {createLabelsPaidAdapter} from '../../../server/labels-paid-adapter.mjs';
import {leaseBinding} from '../../../gateway/foundation/protocol.mjs';
import {p256Key} from '../../../gateway/web-proof.mjs';
import {contract as c,exact,digest,uuid,mac,authenticated,until,live,fresh,pinned,readJson,settings,base,failure,canonical} from './contract.mjs';

// No listener, environment reads, credentials, default network or registry connection.
// replay.claim must be durable, bounded and atomic across ALL authority instances.
export function createLabelsAuthority(options={}){
 let s;try{s=settings(options);}catch{return async()=>failure();}
 const {registry,createProvider,fingerprintKey,replay,now=Date.now,isEnabled=()=>false,maxInFlight=2}=options;
 if(!registry?.issue||!registry?.read||!registry?.consume||typeof createProvider!=='function'||!fingerprintKey||typeof replay?.claim!=='function'||!Number.isSafeInteger(maxInFlight)||maxInFlight<1||maxInFlight>4)return async()=>failure();
 let active=0;
 return async request=>{
  let enabled;try{enabled=isEnabled()===true;}catch{return failure();}
  if(request.url!==s.endpoint||request.method!=='POST'||!enabled||active>=maxInFlight)return failure();
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(s.budget)]);active++;
  const work=(async()=>{
   live(signal);
   const packet=await readJson(request,c.requestBytes,signal);
   if(!authenticated(packet,s.requestKey,'request'))throw Error();
   const b=packet.body,t=now();
   if(!exact(b,['version','purpose','appId','attestAppId','store','attest','origin','issuer','audience','requestId','issuedAt','expiresAt','operation','payload'])||
     b.version!==1||b.issuer!==c.caller||b.audience!==c.issuer||!uuid(b.requestId)||!fresh(b,t)||!pinned(b,s.labelOrigin)||!['challenge','authorize'].includes(b.operation))throw Error();
   if(await replay.claim({namespace:'labels-request',id:b.requestId,expiresAt:b.expiresAt,signal})!==true)throw Error();
   live(signal);
   let result;
   if(b.operation==='challenge'){
    if(!exact(b.payload,['id','input'])||!uuid(b.payload.id))throw Error();
    result=await createLabelsChallengeIssuer({registry,now})({...b.payload,signal});
    if(!result)throw Error();
   }else{
    const p=b.payload;
    if(!exact(p,['challengeId','paidEvidence','attestEvidence','spki'])||!uuid(p.challengeId)||typeof p.paidEvidence!=='string'||Buffer.byteLength(p.paidEvidence)>16384||typeof p.attestEvidence!=='string'||Buffer.byteLength(p.attestEvidence)>20000)throw Error();
    const tile=await p256Key(p.spki);if(!tile)throw Error();
    const binding=leaseBinding({appId:c.appId,challengeId:p.challengeId,paidEvidence:p.paidEvidence,fingerprint:tile.fingerprint,store:c.store,attest:c.attest});
    const attest=await createLabelsAttestAdapter({registry,now})({evidence:p.attestEvidence,binding,purpose:c.purpose,challengeId:p.challengeId,appId:c.appId,environment:c.attest,signal});
    if(!attest)throw Error();live(signal);
    // Existing Apple provider returns the existing normalizer's PRIVATE brand.
    const provider=await createProvider({signal});
    const paid=await createLabelsPaidAdapter({provider,fingerprintKey,now})({evidence:p.paidEvidence,environment:c.store,signal});
    live(signal);if(!paid||attest.challengeExpiresAt<=now())throw Error();
    result={kind:'labels_decision',challengeId:p.challengeId,binding,fingerprint:tile.fingerprint,paidDigest:digest(p.paidEvidence),attest,paid};
   }
   live(signal);const issuedAt=now();if(!fresh(b,issuedAt)||isEnabled()!==true)throw Error();
   const body={...base(s.labelOrigin),issuer:c.issuer,audience:c.caller,requestId:b.requestId,requestDigest:digest(canonical(b)),responseId:randomUUID(),operation:b.operation,issuedAt,expiresAt:Math.min(b.expiresAt,issuedAt+c.maxAge,...(result.paid?[result.paid.periodEnd,result.attest.challengeExpiresAt]:[])),result};
   if(!fresh(body,now()))throw Error();
   const text=JSON.stringify({body,mac:mac(body,s.responseKey,'response')});if(Buffer.byteLength(text)>c.responseBytes)throw Error();
   return new Response(text,{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
  })();
  // Keep scarce labels capacity occupied until even an uncooperative port settles.
  void work.finally(()=>active--).catch(()=>{});
  try{return await until(work,signal);}catch{return failure();}
 };
}

