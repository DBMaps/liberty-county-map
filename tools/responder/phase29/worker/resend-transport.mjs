import {FROM} from '../invitation-delivery.mjs';
import {settings,Refusal,apiKey} from './config.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const id=v=>typeof v==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(v);
export async function boundedBytes(stream,max){
 const chunks=[];let size=0;const r=stream?.getReader();if(!r)return new Uint8Array();
 try{for(;;){const x=await r.read();if(x.done)break;size+=x.value.byteLength;if(size>max){await r.cancel();throw new Refusal('BODY_TOO_LARGE')}chunks.push(x.value)}}finally{r.releaseLock()}
 const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength}return result;
}
export function resendTransport(env,{fetchImpl=globalThis.fetch,timeoutMs=5000}={}){
 return async request=>{
  const c=settings(env);
  if(!c.sending)throw new Refusal('SENDING_DISABLED');
  const key=apiKey(env);
  if(c.environment!=='PRODUCTION')throw new Refusal('CONFIGURATION_REFUSED');
  if(!request||request.method!=='POST'||request.path!=='/emails'||request.credential!==key||!uuid(request.idempotencyKey))throw new Refusal('INPUT_REFUSED');
  const b=request.body;
  if(!b||Object.keys(b).some(k=>!['from','to','subject','text','html','tags'].includes(k))||b.from!==FROM||!Array.isArray(b.to)||b.to.length!==1||typeof b.to[0]!=='string'||b.to[0].length>254||!/^[-a-zA-Z0-9.!#$%&'*+/=?^_{}|~]+@[-a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/.test(b.to[0])||b.subject!=='Gridly Dispatch invitation'||typeof b.text!=='string'||b.text.length>8192||b.html!==undefined&&(typeof b.html!=='string'||b.html.length>8192)||!Array.isArray(b.tags)||b.tags.length!==2||b.tags.some((t,i)=>Object.keys(t).sort().join(',')!=='name,value'||t.name!==['invitation_id','attempt_id'][i]||!uuid(t.value))||b.tags[1].value!==request.idempotencyKey)throw new Refusal('INPUT_REFUSED');
  const body=JSON.stringify(b);if(new TextEncoder().encode(body).length>16384)throw new Refusal('INPUT_REFUSED');
  const controller=new AbortController();let timer;
  try{
   const timed=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Refusal('PROVIDER_TIMEOUT'))},timeoutMs)});
   return await Promise.race([timed,(async()=>{
    const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':request.idempotencyKey},body,signal:controller.signal});
    if(!response.ok){await response.body?.cancel();return {ok:false,reason:'PROVIDER_REJECTED'}}
    const raw=await boundedBytes(response.body,16384);let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{return {ok:false,reason:'PROVIDER_RESPONSE_REFUSED'}}
    return id(data?.id)?{ok:true,id:data.id}:{ok:false,reason:'PROVIDER_RESPONSE_REFUSED'};
   })()]);
  }catch(e){return {ok:false,reason:e?.code==='PROVIDER_TIMEOUT'?'PROVIDER_TIMEOUT':'TRANSPORT_FAILURE'}}finally{clearTimeout(timer)}
 };
}
