import {Refusal} from './config.mjs';
import {boundedBytes} from './resend-transport.mjs';
export const DISPATCH_AUTH_ORIGIN='https://cmrrvwgkgjhmdugzhnrh.supabase.co';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const token=v=>typeof v==='string'&&v.length<=8192&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v);
// These sessions are supplied by a trusted server context, never webhook or send-body fields.
// Recipient proof is the recipient's own authenticated session; no Auth-admin directory access.
export function supabaseInvitationAdapters({origin=DISPATCH_AUTH_ORIGIN,publishableKey,operatorAccessToken,recipientSessions,fetchImpl=globalThis.fetch,timeoutMs=5000}={}){
 if(origin!==DISPATCH_AUTH_ORIGIN||typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{8,200}$/.test(publishableKey)||!token(operatorAccessToken)||!(recipientSessions instanceof Map))throw new Refusal('CONFIGURATION_REFUSED');
 const recipients=new Map(recipientSessions);
 for(const [id,jwt] of recipients)if(!uuid(id)||!token(jwt))throw new Refusal('CONFIGURATION_REFUSED');
 async function request(path,jwt,payload){
  const controller=new AbortController();let timer;
  try{
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Refusal('IDENTITY_UNAVAILABLE'))},timeoutMs)});
   return await Promise.race([timeout,(async()=>{
    const r=await fetchImpl(origin+path,{method:payload===undefined?'GET':'POST',redirect:'error',headers:{apikey:publishableKey,Authorization:'Bearer '+jwt,...(payload===undefined?{}:{'Content-Type':'application/json','Content-Profile':'dispatch_api','Accept-Profile':'dispatch_api'})},...(payload===undefined?{}:{body:JSON.stringify({p_payload:payload})}),signal:controller.signal});
    if(!r.ok||!/^application\/json(?:\s*;|$)/i.test(r.headers.get('content-type')??'')){await r.body?.cancel();throw new Refusal('IDENTITY_UNAVAILABLE')}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedBytes(r.body,65536)));
   })()]);
  }catch{throw new Refusal('IDENTITY_UNAVAILABLE')}finally{clearTimeout(timer)}
 }
 async function user(jwt){const u=await request('/auth/v1/user',jwt);if(!u||!uuid(u.id)||u.is_anonymous===true||u.banned_until&&Date.parse(u.banned_until)>Date.now())throw new Refusal('IDENTITY_REFUSED');return u}
 return Object.freeze({
  async authorizeOperator(_input,action){if(!['ISSUE','MANUAL_DISCLOSURE'].includes(action))throw new Refusal('INPUT_REFUSED');await user(operatorAccessToken)},
  operatorRepository:Object.freeze({async issue(payload){
   const r=await request('/rest/v1/rpc/issue_dispatch_invitation',operatorAccessToken,payload);
   if(!r||!uuid(r.invitationId)||!uuid(r.attemptId)||!Number.isFinite(Date.parse(r.expiresAt))||typeof r.organization!=='string'||r.unit!==null&&typeof r.unit!=='string')throw new Refusal('ISSUANCE_UNAVAILABLE');
   return {invitationId:r.invitationId,attemptId:r.attemptId,expiresAt:r.expiresAt,organization:r.organization,unit:r.unit};
  }}),
  async resolveRecipient(id){
   if(!uuid(id)||!recipients.has(id))throw new Refusal('RECIPIENT_REFUSED');
   const u=await user(recipients.get(id));
   if(u.id!==id||typeof u.email!=='string'||u.email.length>254||!u.email_confirmed_at||!Number.isFinite(Date.parse(u.email_confirmed_at))||Date.parse(u.email_confirmed_at)>Date.now()||typeof u.email_change==='string'&&u.email_change.length>0)throw new Refusal('RECIPIENT_REFUSED');
   return {userId:u.id,email:u.email,verified:true};
  }
 });
}
