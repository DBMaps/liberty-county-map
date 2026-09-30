// LOCAL REVIEW CONTRACT ONLY. Existing deployed cleanup entrypoint unchanged.
const edge='https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-subscription-ops';
const states=new Set(['healthy','stale','failed','overdue','monitor_error']);
const categories=new Set(['none','worker_stale','housekeeping_stale','retry_deadline','terminal_failure','retry_pending','credential_unavailable','configuration_unavailable','provider_unavailable','reconciliation_retry','ack_pending','health_unavailable','operations_unavailable']);
const count=value=>Number.isInteger(value)&&value>=0&&value<=1000000;
export function projectSubscriptionHealth(input){
 const h=input?.health;
 if(h?.environment!=='production'||h.subsystem!=='google_ack'||!states.has(h.health_state)||!categories.has(h.error_category))throw Error('invalid_subscription_health');
 const out={environment:'production',subsystem:'google_ack',health_state:h.health_state,error_category:h.error_category};
 for(const k of ['checked_at','last_completed_at','last_purge_at']){if(h[k]===null&&k!=='checked_at'){out[k]=null;continue;}if(typeof h[k]!=='string'||!Number.isFinite(Date.parse(h[k])))throw Error('invalid_subscription_health');out[k]=new Date(h[k]).toISOString();}
 for(const k of ['pending_count','due_count','failed_count','stale_count','overdue_count','terminal_count','expired_count']){if(!count(h[k]))throw Error('invalid_subscription_health');out[k]=h[k];}
 if(!Number.isInteger(h.oldest_pending_age_seconds)||h.oldest_pending_age_seconds<0||h.oldest_pending_age_seconds>3600)throw Error('invalid_subscription_health');out.oldest_pending_age_seconds=h.oldest_pending_age_seconds;
 for(const k of ['checked','acknowledged','retried','terminal'])if(!Number.isInteger(input[k])||input[k]<0||input[k]>10)throw Error('invalid_subscription_health');
 return Object.freeze(out);
}
const emptyCounters={checked:0,acknowledged:0,retried:0,terminal:0};
const project=h=>projectSubscriptionHealth({...emptyCounters,health:h});
async function heartbeat(env,fetchImpl){
 if(!/^https:\/\/hc-ping\.com\/[a-f0-9-]{36}$/.test(env.SUBSCRIPTION_DEADMAN_PING_URL||''))throw Error('deadman_configuration_missing');
 const r=await fetchImpl(env.SUBSCRIPTION_DEADMAN_PING_URL,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),body:''});if(!r.ok)throw Error('deadman_failed');
}
async function readText(r,limit){
 const reader=r.body?.getReader();if(!reader)throw Error('response_invalid');let size=0,text='',decoder=new TextDecoder();
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('response_invalid');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
 finally{await reader.cancel().catch(()=>{});}
}
export async function runSubscriptionMonitor({env,fetchImpl=fetch,now=Date.now,crypto=globalThis.crypto}={}){
 if(env.SUBSCRIPTION_OPS_URL!==edge||!/^[a-f0-9]{64}$/.test(env.GRIDLY_SUBSCRIPTION_OPS_TOKEN||'')||!env.ALERT_STATE?.get||!env.ALERT_STATE?.put||!env.ALERT_STATE?.delete)throw Error('subscription_configuration_missing');
 let health;
 try{
  const r=await fetchImpl(edge,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(40000),headers:{'X-Gridly-Subscription-Ops-Token':env.GRIDLY_SUBSCRIPTION_OPS_TOKEN}});
  if(!r.ok){
   let category='operations_unavailable';try{const body=JSON.parse(await readText(r,256));if(Object.keys(body).length===1&&body.error==='configuration_unavailable')category='configuration_unavailable';}catch{}
   throw Error(category);
  }
  health=projectSubscriptionHealth(JSON.parse(await readText(r,8192)));
  if(Math.abs(Date.parse(health.checked_at)-now())>90000)throw Error();
 }catch(error){const category=error?.message==='configuration_unavailable'?'configuration_unavailable':'operations_unavailable';health=project({environment:'production',subsystem:'google_ack',health_state:'monitor_error',checked_at:new Date(now()).toISOString(),last_completed_at:null,last_purge_at:null,pending_count:0,due_count:0,failed_count:0,stale_count:0,overdue_count:0,terminal_count:0,expired_count:0,oldest_pending_age_seconds:0,error_category:category});}
 const key='gridly-subscription-alert:google_ack';let prior;
 try{const text=await env.ALERT_STATE.get(key);if(text){if(text.length>4096)throw Error();prior=JSON.parse(text);if(!states.has(prior.state)||!categories.has(prior.category)||(prior.sentAt!==null&&!Number.isFinite(prior.sentAt))||!/^gridly-subscription-[a-f0-9-]{36}$/.test(prior.id)||!['alert','recovery'].includes(prior.action))throw Error();prior.payload=project(prior.payload);}}
 catch{throw Error('subscription_state_unavailable');}
 const recovery=health.health_state==='healthy'&&prior&&(prior.sentAt!==null||prior.action==='recovery');
 const alert=health.health_state!=='healthy'&&(!prior||prior.state!==health.health_state||prior.category!==health.error_category||prior.sentAt===null||now()-prior.sentAt>=3600000);
 if(alert||recovery){
  if(!env.RESEND_API_KEY||env.ALERT_FROM!=='Gridly Alerts <monitor@alerts.gridlygo.com>'||env.ALERT_TO!=='developer@gridlygo.com')throw Error('alert_configuration_missing');
  const action=recovery?'recovery':'alert';
  const pending=prior?.sentAt===null&&prior.action===action&&prior.state===health.health_state&&prior.category===health.error_category?prior:{state:health.health_state,category:health.error_category,sentAt:null,id:'gridly-subscription-'+crypto.randomUUID(),action,payload:health};
  // Persist EXACT redacted request identity before delivery; response-loss retry
  // uses same body/key. Re-project even KV state before email serialization.
  if(pending!==prior)await env.ALERT_STATE.put(key,JSON.stringify(pending),{expirationTtl:604800});
  const payload=project(pending.payload);
  const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':pending.id},body:JSON.stringify({from:env.ALERT_FROM,to:[env.ALERT_TO],subject:'Gridly production subscription '+(action==='recovery'?'recovery':payload.health_state),text:JSON.stringify(payload)})});
  if(!response.ok)throw Error('alert_delivery_failed');
  let result;try{result=JSON.parse(await readText(response,1024));}catch{throw Error('alert_delivery_failed');}if(typeof result.id!=='string'||!/^[a-f0-9-]{36}$/i.test(result.id))throw Error('alert_delivery_failed');
  if(action==='recovery')await env.ALERT_STATE.delete(key);else await env.ALERT_STATE.put(key,JSON.stringify({...pending,sentAt:now()}),{expirationTtl:604800});
 }else if(health.health_state==='healthy'&&prior)await env.ALERT_STATE.delete(key);
 if(health.health_state==='monitor_error')throw Error('subscription_monitor_failed');
 await heartbeat(env,fetchImpl);return health;
}
