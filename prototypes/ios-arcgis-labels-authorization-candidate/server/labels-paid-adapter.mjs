import {fingerprint} from '../reference/build18/supabase/functions/_shared/entitlement/core.mjs';
import {policy,live} from './policy.mjs';
// provider is the existing server Apple adapter (or an injected local test dependency), never request data.
export function createLabelsPaidAdapter({provider,fingerprintKey,now=Date.now}={}){
 return async({evidence,environment,signal})=>{
  try{
   live(signal);
   if(environment!==policy.store||typeof provider?.verify!=='function'||!fingerprintKey||
    typeof evidence!=='string'||evidence.length>16384||! /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(evidence))return null;
   const record=await provider.verify(evidence,{environment:'sandbox/test'});live(signal);
   const t=now(),verifiedAt=Date.parse(record.lastVerifiedAt),periodEnd=Date.parse(record.currentPeriodEnd);
   if(record.platform!=='apple'||record.environment!=='sandbox/test'||record.productId!=='com.gridlygo.gridly.monthly'||
    record.verificationSource!=='gridly_server_store_api'||record.errorCategory!=='none'||record.entitlementState!=='entitled'||
    !['active','canceled_pending_expiry'].includes(record.subscriptionState)||!Number.isSafeInteger(verifiedAt)||
    verifiedAt>t||t-verifiedAt>=300000||!Number.isSafeInteger(periodEnd)||periodEnd<=t)return null;
   // fingerprint() also requires the existing normalizer's private WeakSet brand.
   const lineage=await fingerprint(record,fingerprintKey);live(signal);if(periodEnd<=now())return null;
   return Object.freeze({verified:true,kind:'paid_admission',environment,revoked:false,lineage,verifiedAt,periodEnd});
  }catch{return null;}
 };
}
