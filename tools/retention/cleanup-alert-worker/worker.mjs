import { runScheduled } from './runner.mjs';
import { projectHealth } from './contract.mjs';
export async function edgeHealth(env,fetchImpl=fetch) {
 const url='https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-cleanup-health';
 if(!/^[a-f0-9]{64}$/.test(env.GRIDLY_MONITOR_TOKEN||'')) throw Error('monitor_configuration_missing');
 const r=await fetchImpl(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'X-Gridly-Monitor-Token':env.GRIDLY_MONITOR_TOKEN}});
 if(!r.ok) throw Error('query_failed');
 const text=await r.text();if(text.length>8192) throw Error('invalid_health_projection');
 try{return projectHealth(JSON.parse(text));}catch{throw Error('invalid_health_projection');}
}
export async function heartbeat(env,fetchImpl=fetch) {
 if(!/^https:\/\/hc-ping\.com\/[a-f0-9-]{36}$/.test(env.DEADMAN_PING_URL||'')) throw Error('deadman_configuration_missing');
 const r=await fetchImpl(env.DEADMAN_PING_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),body:''});
 if(!r.ok) throw Error('deadman_failed');
}
export default {
 async fetch(){return new Response(null,{status:404});},
 async scheduled(_controller,env){
  try{await runScheduled({env,queryHealth:()=>edgeHealth(env)});await heartbeat(env);}
  catch{throw Error('gridly_cleanup_alert_run_failed');}
 }
};
