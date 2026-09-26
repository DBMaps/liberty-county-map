import { projectHealth } from './contract.mjs';
const reply=(status,error)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
async function equal(a,b){const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;}
export function createHandler({env,fetchImpl=fetch,now=()=>Date.now()}) {
 let cached=null,expires=0,next=0;
 return async req=>{
  if(req.method!=='POST'||new URL(req.url).search) return reply(405,'invalid_request');
  const token=env('GRIDLY_MONITOR_TOKEN');
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return reply(503,'configuration');
  const auth=req.headers.get('X-Gridly-Monitor-Token')||'';
  if(!/^[a-f0-9]{64}$/.test(auth)||!await equal(auth,token)) return reply(401,'unauthorized');
  if(req.body!==null) {
   const reader=req.body.getReader(); let timer;
   try {
    const empty=async()=>{for(let i=0;i<8;i++){const part=await reader.read();if(part.done)return true;if(part.value?.byteLength>0)return false;}return false;};
    const ok=await Promise.race([empty(),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),2000);})]);
    if(!ok)return reply(400,'invalid_request');
   }catch{return reply(400,'invalid_request');}
   finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
  }
  if(cached&&now()<expires) return Response.json(cached,{headers:{'Cache-Control':'no-store'}});
  if(now()<next) return reply(429,'rate_limited');
  next=now()+30000;
  try {
   const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
   if(url!=='https://nhwhkbkludzkuyxmkkcj.supabase.co'||!key) return reply(503,'configuration');
   const res=await fetchImpl(url+'/rest/v1/rpc/gridly_cleanup_alert_health',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}'});
   if(!res.ok) return reply(502,'health_unavailable');
   const text=await res.text();if(text.length>8192) return reply(502,'invalid_status');
   cached=projectHealth(JSON.parse(text));expires=now()+30000;
   return Response.json(cached,{headers:{'Cache-Control':'no-store'}});
  }catch{return reply(502,'health_unavailable');}
 };
}
