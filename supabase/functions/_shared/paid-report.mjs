import {verifyAuthorityProof,accessDecision} from '../../../js/gridly-entitlement.mjs';

const OPERATIONS=Object.freeze({
  submit_community_observation:['submission_token','report','reporter_device_id'],
  mutate_community_observation:['operation_id','observation_id','action','changes','reporter_device_id'],
  cancel_community_operation:['operation_id']
});
const HEADERS=Object.freeze({'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage'});
const reply=(status,code)=>Response.json({status:code},{status,headers:HEADERS});
async function readBoundedBody(request){
  if(!request.body)throw Error();
  const reader=request.body.getReader(),chunks=[];let total=0;
  try {
    for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
      if(total>20000)throw Error();chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return new TextDecoder().decode(bytes);
  }finally{reader.releaseLock();}
}
const decode=value=>{
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error();
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))));
};

// The caller's decoded fields are only routing hints. The pinned key verifies
// the entire signed proof before any trusted report writer is reached.
export async function verifyPaidReportProof(proof,{publicKey,now=Date.now(),crypto=globalThis.crypto}={}) {
  if(typeof proof!=='string'||proof.length>8192||!publicKey)return false;
  try {
    const parts=proof.split('.');if(parts.length!==3)return false;
    const hint=decode(parts[1]);
    if(!hint||!['google','apple'].includes(hint.platform)||hint.environment!=='production'||
      typeof hint.nonce!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(hint.nonce))return false;
    const verified=await verifyAuthorityProof({proof,publicKey,platform:hint.platform,environment:'production',nonce:hint.nonce,now,crypto});
    return accessDecision(verified,{platform:hint.platform,environment:'production',now}).allowed;
  }catch{return false;}
}

export function createPaidReportHandler({publicKey,writer,now=Date.now,crypto=globalThis.crypto}={}) {
  return async request=>{
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
    if(request.method!=='POST')return reply(405,'invalid_request');
    if(!publicKey||typeof writer!=='function')return reply(503,'maintenance');
    try {
      const length=Number(request.headers.get('content-length'));
      if(Number.isFinite(length)&&length>20000)return reply(400,'invalid_request');
      const bodyText=await readBoundedBody(request);
      const body=JSON.parse(bodyText);
      if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!=='args,operation,proof')return reply(400,'invalid_request');
      const allowed=Object.hasOwn(OPERATIONS,body.operation)?OPERATIONS[body.operation]:null;
      if(!allowed||!body.args||Array.isArray(body.args)||typeof body.args!=='object'||
        Object.keys(body.args).some(key=>!allowed.includes(key)))return reply(400,'invalid_request');
      if(!await verifyPaidReportProof(body.proof,{publicKey,now:now(),crypto}))return reply(403,'forbidden');
      const result=await writer(body.operation,body.args);
      if(result?.error||!result?.data||typeof result.data.status!=='string')return reply(503,'retryable_failure');
      return Response.json(result.data,{headers:HEADERS});
    }catch{return reply(503,'retryable_failure');}
  };
}
