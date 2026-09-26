import {STORE_VERIFIERS,storeVerificationRequest} from '../../../../js/gridly-store-verification.mjs';
export {STORE_VERIFIERS,storeVerificationRequest};
const trusted=new WeakSet();
const epoch=value=>{const n=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(n))throw Error('invalid_evidence');return n;};
const reference=value=>{if(typeof value!=='string'||!value||value.length>16384)throw Error('invalid_evidence');return value;};
const environment=value=>value==='Production'?'production':value==='Sandbox'?'sandbox/test':null;
function result(platform,env,state,end,ref,now,error='none',ack=false) {
 if(!['production','sandbox/test'].includes(env)||!Number.isFinite(now))throw Error('invalid_evidence');
 const record=Object.freeze({platform,environment:env,productId:STORE_VERIFIERS[platform].productId,
 basePlanId:platform==='google'?'monthly':null,subscriptionState:state,
 entitlementState:['active','canceled_pending_expiry'].includes(state)?'entitled':state==='unknown'?'unknown':'not_entitled',
 currentPeriodEnd:end===null?null:new Date(end).toISOString(),lastVerifiedAt:new Date(now).toISOString(),
 verificationSource:'gridly_server_store_api',errorCategory:error,reference:reference(ref),acknowledgementRequired:ack});
 trusted.add(record);return record;
}
export function normalizeApple(transaction,renewal,status,{env,originalReference,now}) {
 if(transaction?.bundleId!=='com.gridlygo.gridly'||transaction.productId!==STORE_VERIFIERS.apple.productId||
 transaction.type!=='Auto-Renewable Subscription'||environment(transaction.environment)!==env||
 reference(transaction.originalTransactionId)!==originalReference||renewal?.originalTransactionId!==originalReference||
 renewal.productId!==STORE_VERIFIERS.apple.productId||environment(renewal.environment)!==env||
 ![0,1].includes(renewal.autoRenewStatus)||![1,2,3,4,5].includes(status))throw Error('invalid_evidence');
 const end=epoch(transaction.expiresDate);
 let state;
 if(status===5 || transaction.revocationDate!=null)state='inactive';
 else if(end<=now)state='expired';
 else if(status===1)state=renewal.autoRenewStatus===0?'canceled_pending_expiry':'active';
 else if(status===2)state='inactive';
 else if(status===3)state='inactive';
 else state='unknown'; // Unexpected grace is never access: launch has no grace.
 return result('apple',env,state,end,originalReference,now,state==='unknown'?'verification_unavailable':'none');
}
export function normalizeGoogle(data,{env,token,now}) {
 if(!data || data.regionCode!=='US' || (Object.hasOwn(data,'testPurchase')?'sandbox/test':'production')!==env ||
 (data.packageName!==undefined&&data.packageName!=='com.gridlygo.gridly')||!Array.isArray(data.lineItems)||data.lineItems.length!==1 ||
 data.lineItems[0].productId!=='gridly_monthly'||data.lineItems[0].offerDetails?.basePlanId!=='monthly'||data.lineItems[0].offerDetails?.offerId!=null||
 data.linkedPurchaseToken!=null)throw Error('invalid_evidence'); // Replacement chains need a later reviewed adapter.
 const line=data.lineItems[0],end=line.expiryTime?epoch(line.expiryTime):null;
 let state,error='none';
 switch(data.subscriptionState) {
 case 'SUBSCRIPTION_STATE_ACTIVE':
 case 'SUBSCRIPTION_STATE_CANCELED':
  if(end===null||typeof line.autoRenewingPlan?.autoRenewEnabled!=='boolean')throw Error('invalid_evidence');
  state=end<=now?'expired':data.subscriptionState==='SUBSCRIPTION_STATE_CANCELED'||!line.autoRenewingPlan.autoRenewEnabled?'canceled_pending_expiry':'active';break;
 case 'SUBSCRIPTION_STATE_EXPIRED': state=end!==null&&end<=now?'expired':'inactive';break;
 case 'SUBSCRIPTION_STATE_ON_HOLD': case 'SUBSCRIPTION_STATE_PAUSED':state='inactive';break;
 case 'SUBSCRIPTION_STATE_PENDING':case 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED':state='unknown';error='purchase_pending';break;
 case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD':state='unknown';error='verification_unavailable';break;
 default:throw Error('invalid_evidence');
 }
 if(!['ACKNOWLEDGEMENT_STATE_PENDING','ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'].includes(data.acknowledgementState))throw Error('invalid_evidence');
 return result('google',env,state,end,token,now,error,data.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING'&&['active','canceled_pending_expiry'].includes(state));
}
export async function fingerprint(record,key,crypto=globalThis.crypto) {
 if(!trusted.has(record)||!key)throw Error('invalid_evidence');
 const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(record.platform+'\0'+record.environment+'\0'+record.reference));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function cacheRecord(record,key,crypto=globalThis.crypto) {
 if(!trusted.has(record))throw Error('invalid_evidence');
 return Object.freeze({platform:record.platform,environment:record.environment==='sandbox/test'?'sandbox_test':'production',
 product_id:record.productId,base_plan_id:record.basePlanId,chain_fingerprint:await fingerprint(record,key,crypto),
 subscription_state:record.subscriptionState,entitlement_state:record.entitlementState,current_period_end:record.currentPeriodEnd,
 last_verified_at:record.lastVerifiedAt,verification_source:record.verificationSource,error_category:record.errorCategory});
}
export async function signResponse(record,nonce,key,crypto=globalThis.crypto) {
 if(!trusted.has(record)||!key)throw Error('invalid_evidence');
 const now=epoch(record.lastVerifiedAt),end=record.currentPeriodEnd===null?null:epoch(record.currentPeriodEnd);
 const body={platform:record.platform,productId:record.productId,subscriptionState:record.subscriptionState,entitlementState:record.entitlementState,
 currentPeriodEnd:record.currentPeriodEnd,lastVerifiedAt:record.lastVerifiedAt,verificationSource:record.verificationSource,environment:record.environment,
 restoreAvailable:true,errorCategory:record.errorCategory,nonce,audience:'com.gridlygo.gridly',expiresAt:new Date(record.entitlementState==='entitled'?Math.min(now+300000,end):now+300000).toISOString()};
 const b64=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const input=b64({alg:'ES256',typ:'gridly-entitlement-v1'})+'.'+b64(body);
 const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(input)));
 return input+'.'+btoa(String.fromCharCode(...sig)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
