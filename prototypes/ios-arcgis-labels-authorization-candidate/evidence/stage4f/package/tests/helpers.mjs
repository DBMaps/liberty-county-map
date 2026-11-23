import {randomUUID} from 'node:crypto';
import {contract as c,digest,mac,canonical} from '../contract.mjs';
import {createLabelsAuthority} from '../authority.mjs';
import {createAuthorityClient} from '../client.mjs';
import {createFirstPartyGateway} from '../gateway.mjs';
import {nativeFixture,appleRecord,fingerprintKey} from '../../../../tests/fixtures.mjs';
import {createMemoryState} from '../../../../gateway/foundation/state.mjs';
export const syntheticConfig={authorityOrigin:'https://authority.gridly.invalid',approvedAuthorities:['https://authority.gridly.invalid'],labelOrigin:'https://labels.gridly.invalid',requestKey:Buffer.alloc(32,101),responseKey:Buffer.alloc(32,102)};
export const replay=()=>{const entries=new Map();return {async claim({namespace,id,expiresAt,signal}){signal?.throwIfAborted();const t=Date.now();for(const [key,until]of entries)if(until<=t)entries.delete(key);const key=namespace+':'+id;if(entries.has(key)||entries.size>=1000)return false;entries.set(key,expiresAt);return true;}};};
export async function fixture(options={}){
 let t=Date.now(),stored=0,registered=options.registered!==false,enabled=true,providerCalls=0,transportCalls=0;const native=nativeFixture(),rows=new Map(),requests=[],responses=[];
 const registry={async issue({id,keyHash,fingerprint,paidDigest}){
  if(!registered||keyHash!==native.keyHash)return null;
  const binding=digest(JSON.stringify([c.purpose,c.appId,c.store,c.attest,id,paidDigest,fingerprint]));
  rows.set(id,{challengeId:id,keyHash,appId:c.attestAppId,purpose:c.purpose,store:c.store,attest:c.attest,gatewayId:c.caller,environment:c.attest,fingerprint,paidDigest,binding,expiresAt:t+90000,publicSpki:native.publicSpki,used:false});
  return {challengeId:id,purpose:c.purpose,expiresAt:t+90000};
 },async read({id}){const r=rows.get(id);return registered&&r&&!r.used?{...r,counter:stored}:null;},
 async consume({id,keyHash,binding,counter,signal}){const r=rows.get(id);if(!r||r.used||r.keyHash!==keyHash||r.binding!==binding||counter<=stored)return false;stored=counter;r.used=true;if(options.afterCommit)await options.afterCommit({signal});if(options.ambiguous)throw Error('unknown private COMMIT');return true;}};
 const config={...syntheticConfig,budget:options.budget??4500};
 const authority=createLabelsAuthority({...config,registry:options.databaseUnavailable?{...registry,read:async()=>{throw Error('private DB credential');}}:registry,
  fingerprintKey:await fingerprintKey(),replay:options.requestReplay??replay(),now:()=>t,isEnabled:()=>enabled,
  createProvider:async({signal})=>({verify:async()=>{providerCalls++;if(options.provider)return options.provider({signal,now:t});return appleRecord(t,options.paid??{});}}),...options.authority});
 const client=createAuthorityClient({...config,now:()=>t,replay:options.responseReplay??replay(),transport:async(url,init)=>{
  transportCalls++;requests.push(JSON.parse(init.body));if(options.transportFailure)throw Error('private endpoint credential');
  let req=new Request(url,init);if(options.mutateRequest){const p=JSON.parse(init.body);options.mutateRequest(p);req=new Request(url,{...init,body:JSON.stringify(p)});}
  let response=await authority(req);
  if(options.delayResponse)await options.delayResponse({signal:init.signal});
  if(response.status===200){let packet=await response.json();if(options.mutateResponse)options.mutateResponse(packet);
   responses.push(packet);response=new Response(JSON.stringify(packet),{status:200,headers:{'content-type':'application/json'}});
  }
  return response;
 }});
 const memory=createMemoryState();memory.setEnabled(true);const pending=new Map();
 const state={...memory,challenge:async id=>{pending.set(id,t+90000);return t+90000;},pending:async id=>pending.has(id),reserveOAuth:async()=>true};
 const gateway=createFirstPartyGateway({state,client,config:{origin:config.labelOrigin,enabled:true,provider:{GRIDLY_LABELS_ESRI_ENABLED:'false'}},now:()=>t});
 async function leaseInput(counter=1){
  const challenge=await gateway.issueChallenge({keyId:native.keyId,spki:native.spki,paidEvidenceHash:digest('aaa.bbb.ccc')});
  if(!challenge)return null;const r=rows.get(challenge.challengeId);
  return {challengeId:challenge.challengeId,paidEvidence:'aaa.bbb.ccc',attestEvidence:native.assertion(r.binding,counter),spki:native.spki};
 }
 return {native,registry,authority,client,state,gateway,requests,responses,rows,leaseInput,now:()=>t,advance:n=>t+=n,counter:()=>stored,
  subscribe:counter=>{if(counter<=stored)return false;stored=counter;return true;},disable:()=>{enabled=false;state.setEnabled(false);},providerCalls:()=>providerCalls,transportCalls:()=>transportCalls,setRegistered:v=>registered=v};
}
export const resignRequest=p=>p.mac=mac(p.body,syntheticConfig.requestKey,'request');
export const resignResponse=p=>p.mac=mac(p.body,syntheticConfig.responseKey,'response');

