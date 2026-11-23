import {randomUUID} from 'node:crypto';
import {createLabelsGateway} from '../../../gateway/web-gateway.mjs';
import {createEsriProvider} from '../../../gateway/foundation/esri.mjs';
import {contract as c,live,until} from './contract.mjs';
import {isVerifiedDecision} from './client.mjs';

// A wrapper around the UNCHANGED gateway; each lease's paired decision is local
// to that operation. The shared state still owns leases, quotas and replay.
export function createFirstPartyGateway({config={},state,client,transport,now=Date.now}={}){
 const enabled=()=>config.enabled===true&&typeof client?.authorize==='function'&&typeof client?.issueChallenge==='function'&&typeof state?.challenge==='function'&&typeof state?.pending==='function';
 if(!state)return Object.freeze({});
 const provider=createEsriProvider({environment:config.provider,enabled:async()=>enabled()&&await state.isEnabled()===true,now,
  transport:typeof transport==='function'?async(url,init)=>{
   if(init.method==='POST'&&await state.reserveOAuth()!==true)return new Response(null,{status:429});
   if(await state.isEnabled()!==true)throw Error('unavailable');live(init.signal);
   if(typeof state.record==='function')await state.record(init.method==='POST'?'oauth_dispatch_intent':'tile_dispatch_intent',0);
   if(await state.isEnabled()!==true)throw Error('unavailable');live(init.signal);return transport(url,init);
  }:undefined});
 const make=(verifyAttest,verifyPaid)=>createLabelsGateway({state,provider,origin:config.origin,appId:c.appId,enabled,now,timeout:config.timeout??6000,verifyAttest,verifyPaid});
 const tile=make();let pending=0;
 return Object.freeze({
  async issueChallenge(input,signal){
   try{live(signal);if(!enabled()||await state.isEnabled()!==true||typeof state.challenge!=='function')return null;
    const id=randomUUID(),v=await client.issueChallenge({id,input,signal});live(signal);
    if(!v||v.challengeId!==id||v.purpose!==c.purpose||v.expiresAt<=now())return null;
    const local=await state.challenge(id);live(signal);if(await state.isEnabled()!==true||!Number.isSafeInteger(local)||local<=now())return null;
    return {challengeId:id,purpose:c.purpose,expiresAt:Math.min(local,v.expiresAt)};
   }catch{return null;}
  },
  async issueLease(input,signal){
   if(pending>=32)return {status:429,code:'usage_limit'};
   const operation=AbortSignal.any([AbortSignal.timeout(config.timeout??6000),...(signal?[signal]:[])]);
   pending++;let decision;
   const work=(async()=>{
    live(operation);
    // Snapshot request fields; never share a mutable decision between operations.
    const payload=JSON.parse(JSON.stringify(input));
    const gateway=make(async args=>{
     if(await state.pending(payload.challengeId)!==true)return null;
     live(args.signal);decision=await client.authorize(payload,args.signal);
     if(!isVerifiedDecision(decision,config.origin)||decision.decisionExpiresAt<=now()||decision.binding!==args.binding)return null;
     return decision.attest;
    },async args=>{
     live(args.signal);
     return isVerifiedDecision(decision,config.origin)&&decision.decisionExpiresAt>now()?decision.paid:null;
    });
    const result=await gateway.issueLease(payload,operation);
    live(operation);
    if(result.status===201&&(!isVerifiedDecision(decision,config.origin)||decision.decisionExpiresAt<=now()))throw Error('unavailable');
    return result;
   })();
   void work.finally(()=>pending--).catch(()=>{});
   try{return await until(work,operation);}catch{return {status:503,code:'temporarily_unavailable'};}
  },
  requestTile:request=>tile.requestTile(request)
 });
}

