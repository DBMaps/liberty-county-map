import {cacheRecord,lineageRecords} from './core.mjs';
const types=new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,17,18,19,20,22]);
const reply=status=>new Response(null,{status,headers:{'Cache-Control':'no-store'}});
const token=value=>typeof value==='string'&&value.length>0&&value.length<=16384&&/^[A-Za-z0-9._~+\/-]+={0,2}$/.test(value);
async function readBody(request){
 if(!request.headers.get('Content-Type')?.startsWith('application/json')||!request.body)throw Error('malformed');
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error('malformed');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function parseEnvelope(body,subscription){
 if(!body||typeof body!=='object'||Array.isArray(body)||body.subscription!==subscription||
  Object.keys(body).some(key=>!['message','subscription','deliveryAttempt'].includes(key))||
  (body.deliveryAttempt!==undefined&&(!Number.isInteger(body.deliveryAttempt)||body.deliveryAttempt<1))||
  !body.message||typeof body.message!=='object'||Array.isArray(body.message)||
  Object.keys(body.message).some(key=>!['data','messageId','message_id','publishTime','publish_time','orderingKey','attributes'].includes(key)))throw Error('malformed');
 const m=body.message;
 if(typeof m.messageId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(m.messageId)||
  (m.message_id!==undefined&&m.message_id!==m.messageId)||
  typeof m.data!=='string'||m.data.length>32768||!m.data||!/^[A-Za-z0-9+/]+={0,2}$/.test(m.data)||
  (m.attributes!==undefined&&(!m.attributes||typeof m.attributes!=='object'||Array.isArray(m.attributes)||Object.keys(m.attributes).length>16||Object.values(m.attributes).some(value=>typeof value!=='string'||value.length>256)))||
  (m.publishTime!==undefined&&!Number.isFinite(Date.parse(m.publishTime)))||
  (m.publish_time!==undefined&&m.publish_time!==m.publishTime))throw Error('malformed');
 let bytes;try{bytes=Uint8Array.from(atob(m.data),c=>c.charCodeAt(0));}catch{throw Error('malformed');}
 if(bytes.length>24576||btoa(String.fromCharCode(...bytes))!==m.data)throw Error('malformed');
 let notice;try{notice=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('malformed');}
 if(!notice||typeof notice!=='object'||Array.isArray(notice)||notice.version!=='1.0'||notice.packageName!=='com.gridlygo.gridly'||
  !/^\d{1,16}$/.test(String(notice.eventTimeMillis))||!Number.isSafeInteger(Number(notice.eventTimeMillis))||
  Object.keys(notice).some(key=>!['version','packageName','eventTimeMillis','subscriptionNotification','oneTimeProductNotification','voidedPurchaseNotification','testNotification','pendingRefundReviewNotification'].includes(key)))throw Error('malformed');
 const kinds=['subscriptionNotification','oneTimeProductNotification','voidedPurchaseNotification','testNotification','pendingRefundReviewNotification'].filter(key=>Object.hasOwn(notice,key));
 if(kinds.length!==1)throw Error('malformed');
 const kind=kinds[0],event=notice[kind];if(!event||typeof event!=='object'||Array.isArray(event))throw Error('malformed');
 if(kind==='subscriptionNotification'){
  if(event.version!=='1.0'||!types.has(event.notificationType)||!token(event.purchaseToken)||
   Object.keys(event).some(key=>!['version','notificationType','purchaseToken'].includes(key)))throw Error('malformed');
  return {messageId:m.messageId,kind:'subscription',token:event.purchaseToken,eventType:event.notificationType};
 }
 if(kind==='voidedPurchaseNotification'){
  if(!token(event.purchaseToken)||![1,2].includes(event.productType)||![1,2].includes(event.refundType)||
   typeof event.orderId!=='string'||event.orderId.length>128||
   Object.keys(event).some(key=>!['purchaseToken','orderId','productType','refundType'].includes(key)))throw Error('malformed');
  return {messageId:m.messageId,kind:event.productType===1?'voided_subscription':'ignored',token:event.productType===1?event.purchaseToken:null};
 }
 if(kind==='testNotification'){
  if(event.version!=='1.0'||Object.keys(event).length!==1)throw Error('malformed');
  return {messageId:m.messageId,kind:'test',token:null};
 }
 if(kind==='oneTimeProductNotification'){
  if(event.version!=='1.0'||![1,2].includes(event.notificationType)||!token(event.purchaseToken)||
   typeof event.sku!=='string'||event.sku.length<1||event.sku.length>256||
   Object.keys(event).some(key=>!['version','notificationType','purchaseToken','sku'].includes(key)))throw Error('malformed');
 }
 if(kind==='pendingRefundReviewNotification'){
  if(typeof event.pendingRefundToken!=='string'||event.pendingRefundToken.length<1||event.pendingRefundToken.length>16384||
   typeof event.orderId!=='string'||event.orderId.length>128||
   Object.keys(event).some(key=>!['pendingRefundToken','orderId','refundReason','obfuscatedAccountId','obfuscatedProfileId'].includes(key)))throw Error('malformed');
 }
 // One-time products and pending refund reviews are outside this subscription
 // contract; acknowledge only their validated envelope, never their token.
 return {messageId:m.messageId,kind:'ignored',token:null};
}
export function createGoogleRtdnHandler({authenticate,subscription,receipts,provider,cache,ackQueues,fingerprintKey,crypto=globalThis.crypto}={}){
 const ready=typeof authenticate==='function'&&/^projects\/[a-z][a-z0-9-]{3,62}\/subscriptions\/[A-Za-z][A-Za-z0-9-]{2,254}$/.test(subscription||'')&&
  typeof receipts?.claim==='function'&&typeof receipts?.finish==='function'&&typeof provider?.verify==='function'&&
  typeof cache?.apply==='function'&&fingerprintKey?.algorithm?.name==='HMAC'&&
  typeof ackQueues?.production?.ensure==='function'&&typeof ackQueues?.['sandbox/test']?.ensure==='function';
 return async request=>{
  if(request.method!=='POST'||new URL(request.url).search)return reply(405);
  if(!ready)return reply(503);
  try{if(!await authenticate(request))return reply(401);}catch{return reply(503);}
  let notice;try{notice=parseEnvelope(await readBody(request),subscription);}catch{return reply(400);}
  let claim;try{claim=await receipts.claim(notice.messageId);}catch{return reply(503);}
  if(!claim||!['claimed','done','terminal','busy'].includes(claim.status))return reply(503);
  if(claim.status==='done'||claim.status==='terminal')return reply(204);
  if(claim.status==='busy')return reply(503);
  if(typeof claim.lease!=='string'||!/^[a-f0-9-]{36}$/.test(claim.lease))return reply(503);
  let outcome='done',category='none';
  try{
   if(notice.token){
    const record=await provider.verify(notice.token,{signal:AbortSignal.timeout(40000)});
    if(record.platform!=='google'||!['production','sandbox/test'].includes(record.environment)||record.productId!=='com.gridlygo.gridly.monthly'||record.basePlanId!=='monthly')throw Error('invalid_evidence');
    const cached=await cacheRecord(record,fingerprintKey,crypto);
    if(!await cache.apply(cached,await lineageRecords(record,fingerprintKey,crypto)))throw Error('reconciliation_retry');
    if(record.acknowledgementRequired){
     const queue=ackQueues[record.environment];
     await queue.ensure({token:notice.token,record,cached});
    }
   }
  }catch(error){
   category=['invalid_evidence','invalid_purchase'].includes(error?.message)?error.message:
    ['credential_unavailable','provider_unavailable','reconciliation_retry','ack_unavailable','subscription_unavailable'].includes(error?.message)?error.message:'provider_unavailable';
   outcome=['invalid_evidence','invalid_purchase'].includes(category)?'terminal':'retry';
  }
  try{if(!await receipts.finish(notice.messageId,claim.lease,outcome,category))return reply(503);}catch{return reply(503);}
  return reply(outcome==='retry'?503:204);
 };
}
