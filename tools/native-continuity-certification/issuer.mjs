// SYNTHETIC_CONTINUITY_CERTIFICATION. Loopback issuer; private fixture key stays in memory.
import {webcrypto} from 'node:crypto';
import {normalizeApple,normalizeGoogle,signResponse} from '../../supabase/functions/_shared/entitlement/core.mjs';
export async function createIssuer() {
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return {publicJwk:await webcrypto.subtle.exportKey('jwk',keys.publicKey),seed:async({scenario,platform,binding,nowMs},now=nowMs)=>{
  // Synthetic fixtures follow the native sample, never the issuer host clock.
  if(!Number.isSafeInteger(now)||now<1e12||now>=1e13)throw Error('invalid_fixture');
  if(!['A','B','C','D','E'].includes(scenario)||!['apple','google'].includes(platform)||!/^[a-f0-9]{64}$/.test(binding))throw Error('invalid_fixture');
  const at=now-(scenario==='B'?25*3600000:scenario==='C'?2*3600000:1000),end=scenario==='C'?now-3600000:now+7*86400000,env=scenario==='E'?'sandbox/test':'production';
  const record=platform==='apple'?normalizeApple({bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:env==='production'?'Production':'Sandbox',originalTransactionId:'synthetic-certification',expiresDate:end},{originalTransactionId:'synthetic-certification',productId:'com.gridlygo.gridly.monthly',environment:env==='production'?'Production':'Sandbox',autoRenewStatus:1},1,{env,originalReference:'synthetic-certification',now:at})
   :normalizeGoogle({regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',...(env==='production'?{}:{testPurchase:{}}),lineItems:[{productId:'gridly_monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(end).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]},{env,token:'synthetic-certification',now:at});
  const response=await signResponse(record,'n'.repeat(40),keys.privateKey,webcrypto,{continuityBinding:binding});
  let proof=JSON.parse(Buffer.from(response.split('.')[1],'base64url')).continuityAuthorization;
  if(scenario==='D'){const parts=proof.split('.'),bytes=Buffer.from(parts[2],'base64url');bytes[0]^=1;proof=parts[0]+'.'+parts[1]+'.'+bytes.toString('base64url');}
  return {proof,verifiedAt:at};
 }};
}
