import {acknowledgmentHealth} from './ack-health.mjs';
const outcomes=new Set(['success','retry','terminal','denied']);
const failures=new Set(['provider_unavailable','credential_unavailable','configuration_unavailable','reconciliation_retry']);
// Trusted server composition only. No Deno entrypoint/deployment is enabled here.
export function createSubscriptionOperations({token,retryGoogle,store,environment='production',crypto=globalThis.crypto,now=Date.now}={}) {
 const ready=/^[a-f0-9]{64}$/.test(token||'')&&['production','sandbox_test'].includes(environment)&&typeof retryGoogle==='function'&&typeof store?.completeRun==='function'&&typeof store?.health==='function';
 const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
 return async request=>{
  if(!ready)return json({error:'configuration_unavailable'},503);
  // Token is not a bearer credential and is never included in response/errors.
  const received=request.headers.get('X-Gridly-Subscription-Ops-Token');
  if(!/^[a-f0-9]{64}$/.test(received||''))return json({error:'unauthorized'},401);
  const digest=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([digest(received),digest(token)]);let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];
  if(different)return json({error:'unauthorized'},401);
  if(request.method!=='POST'||new URL(request.url).search)return json({error:'invalid_request'},400);
  const reader=request.body?.getReader();if(reader){try{const first=await reader.read();if(!first.done)return json({error:'invalid_request'},400);}finally{await reader.cancel().catch(()=>{});}}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
  try{
   const rows=await retryGoogle({signal:controller.signal});
   if(controller.signal.aborted||!Array.isArray(rows)||rows.length>10||rows.some(row=>!outcomes.has(row.outcome)||row.completed!==true))throw Error();
   const category=rows.find(row=>row.outcome==='retry'&&failures.has(row.category))?.category||'none';
   if(!await store.completeRun({environment,error_category:category}))throw Error();
   const healthRows=await store.health();if(!Array.isArray(healthRows)||healthRows.length!==2)throw Error();
   const row=healthRows.find(row=>row.environment===environment);const health=acknowledgmentHealth(row,{now:now()});
   if(health.error_category==='health_unavailable')throw Error();
   return json({health,checked:rows.length,acknowledged:rows.filter(r=>r.outcome==='success').length,retried:rows.filter(r=>r.outcome==='retry').length,terminal:rows.filter(r=>['terminal','denied'].includes(r.outcome)).length});
  }catch{
   // Failed cycle never advances completed-run timestamp.
   return json({error:'operations_unavailable'},503);
  }finally{clearTimeout(timer);}
 };
}
