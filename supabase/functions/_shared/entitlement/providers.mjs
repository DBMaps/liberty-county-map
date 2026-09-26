import {normalizeApple,normalizeGoogle} from './core.mjs';
// Adapters are server composition only. No client-supplied verifier/key/URL.
export function appleAdapter({signedVerifier,apiClient,env,now=Date.now}) {
 return Object.freeze({verify:async signed=>{
  const original=await signedVerifier.verifyAndDecodeTransaction(signed);
  if(original.bundleId!=='com.gridlygo.gridly'||original.productId!=='com.gridlygo.gridly.monthly'||original.type!=='Auto-Renewable Subscription'||original.environment!==(env==='production'?'Production':'Sandbox')||!original.originalTransactionId)throw Error('invalid_evidence');
  const status=await apiClient.getAllSubscriptionStatuses(original.originalTransactionId);
  if(!Array.isArray(status?.data)||status.data.length>8)throw Error('invalid_evidence');
  const matches=status.data.flatMap(group=>Array.isArray(group.lastTransactions)?group.lastTransactions:[]).filter(row=>row.originalTransactionId===original.originalTransactionId);
  if(matches.length!==1)throw Error('invalid_evidence');
  const current=await signedVerifier.verifyAndDecodeTransaction(matches[0].signedTransactionInfo);
  const renewal=await signedVerifier.verifyAndDecodeRenewalInfo(matches[0].signedRenewalInfo);
  // Signed verifier must be configured with Apple roots, appAppleId, bundle and env.
  return normalizeApple(current,renewal,matches[0].status,{env,originalReference:original.originalTransactionId,now:now()});
 }});
}
async function readBounded(response) {
 if(!response.ok)throw Error('provider_unavailable');
 const reader=response.body?.getReader();if(!reader)throw Error('provider_unavailable');let size=0;const chunks=[];
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error('invalid_evidence');chunks.push(value);}}
 finally {await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function googleAdapter({accessToken,fetchImpl=fetch,env,now=Date.now}) {
 const base='https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.gridlygo.gridly/purchases/';
 const request=async(path,method='GET')=>{
  const credential=await accessToken();if(typeof credential!=='string'||!credential)throw Error('provider_unavailable');
  return fetchImpl(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+credential,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})});
 };
 return Object.freeze({verify:async token=>{
  if(typeof token!=='string'||token.length>16384||!/^[A-Za-z0-9._~+\/-]+={0,2}$/.test(token))throw Error('invalid_evidence');
  const data=await readBounded(await request('subscriptionsv2/tokens/'+encodeURIComponent(token)));
  return normalizeGoogle(data,{env,token,now:now()});
 },acknowledge:async token=>{
  const response=await request('subscriptions/gridly_monthly/tokens/'+encodeURIComponent(token)+':acknowledge','POST');
  if(!response.ok)throw Error('provider_unavailable');
 }});
}
