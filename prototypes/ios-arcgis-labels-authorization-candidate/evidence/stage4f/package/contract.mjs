import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const contract=Object.freeze({path:'/internal/v1/labels/verify',issuer:'gridly-labels-authority-v1',caller:'gridly-labels-consumer-pilot-v1',purpose:'gridly-labels-lease-v1',appId:'com.gridlygo.gridly',attestAppId:'2XSH6R7K37.com.gridlygo.gridly',store:'sandbox',attest:'production',requestBytes:52*1024,responseBytes:4096,maxAge:5000});
export const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export const digest=v=>createHash('sha256').update(v).digest('base64url');
export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function origin(v){const u=new URL(v);if(u.protocol!=='https:'||u.origin!==v||u.username||u.password||!u.hostname.includes('.')||u.hostname==='localhost')throw Error('configuration_unavailable');return v;}
export function key(v){if(!(v instanceof Uint8Array)||v.length!==32)throw Error('configuration_unavailable');return Buffer.from(v);}
export const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
export const mac=(body,secret,direction)=>createHmac('sha256',secret).update('gridly-labels-interface-v1/'+direction+'\n'+canonical(body)).digest('hex');
export function authenticated(packet,secret,direction){if(!exact(packet,['body','mac'])||typeof packet.mac!=='string'||!/^[a-f0-9]{64}$/.test(packet.mac))return false;return timingSafeEqual(Buffer.from(packet.mac,'hex'),Buffer.from(mac(packet.body,secret,direction),'hex'));}
export function live(signal){signal?.throwIfAborted();}
export async function until(promise,signal){live(signal);let stop;const aborted=new Promise((_,reject)=>{stop=()=>reject(Error('verification_unavailable'));signal.addEventListener('abort',stop,{once:true});});try{return await Promise.race([promise,aborted]);}finally{signal.removeEventListener('abort',stop);}}
export function fresh(b,t){return Number.isSafeInteger(t)&&Number.isSafeInteger(b.issuedAt)&&Number.isSafeInteger(b.expiresAt)&&b.issuedAt<=t&&b.issuedAt>=t-contract.maxAge&&b.expiresAt>t&&b.expiresAt>b.issuedAt&&b.expiresAt<=b.issuedAt+contract.maxAge;}
export function pinned(b,labelOrigin){return b.purpose===contract.purpose&&b.appId===contract.appId&&b.attestAppId===contract.attestAppId&&b.store===contract.store&&b.attest===contract.attest&&b.origin===labelOrigin;}
export async function readJson(response,maximum,signal){
 if(response.headers.get('content-type')!=='application/json'||response.headers.has('content-encoding')||!response.body)throw Error('invalid_request');
 const reader=response.body.getReader();let size=0;const parts=[];const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{for(;;){const {done,value}=await until(reader.read(),signal);live(signal);if(done)break;size+=value.length;if(size>maximum)throw Error('body_limit');parts.push(Buffer.from(value));}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}
 finally{cancel();signal.removeEventListener('abort',cancel);reader.releaseLock();}
}
export function settings({authorityOrigin,approvedAuthorities,labelOrigin,requestKey,responseKey,budget=4500}={}){
 origin(authorityOrigin);origin(labelOrigin);if(!Array.isArray(approvedAuthorities)||approvedAuthorities.length!==1||approvedAuthorities[0]!==authorityOrigin||authorityOrigin===labelOrigin||!Number.isSafeInteger(budget)||budget<10||budget>4500)throw Error('configuration_unavailable');
 const a=key(requestKey),b=key(responseKey);if(timingSafeEqual(a,b))throw Error('configuration_unavailable');return {endpoint:authorityOrigin+contract.path,labelOrigin,requestKey:a,responseKey:b,budget};
}
export function base(labelOrigin){return {version:1,purpose:contract.purpose,appId:contract.appId,attestAppId:contract.attestAppId,store:contract.store,attest:contract.attest,origin:labelOrigin};}
export const failure=()=>Response.json({code:'verification_unavailable',freshEvidenceRequired:true},{status:503,headers:{'cache-control':'no-store'}});
export function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}

