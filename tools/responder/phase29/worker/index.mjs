import {readiness} from './readiness.mjs';
import {verifyWebhook} from '../invitation-delivery.mjs';
import {settings,signingKey,WEBHOOK_URL} from './config.mjs';
import {boundedBytes} from './resend-transport.mjs';
import {deliveryRepository} from './delivery-repository.mjs';
function response(status){return new Response(null,{status,headers:{'Cache-Control':'no-store',...(status===405?{Allow:'POST'}:{})}})}
export async function handle(request,env,{repositoryFactory=deliveryRepository,readinessOptions}={}){
 const u=new URL(request.url);if(request.url==='https://dispatch.gridlygo.com/health'){if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});return readiness(env,readinessOptions)}if(u.origin!=='https://dispatch.gridlygo.com'||u.pathname!=='/api/resend/webhook'||u.search||request.url!==WEBHOOK_URL)return response(404);
 if(request.method!=='POST')return response(405);
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')||request.headers.has('content-encoding'))return response(415);
 let secret;try{settings(env);secret=signingKey(env)}catch{return response(503)}
 let bytes;try{bytes=await boundedBytes(request.body,65536)}catch(e){return response(e?.code==='BODY_TOO_LARGE'?413:400)}
 let body;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{return response(400)}
 const headers=Object.fromEntries(['svix-id','svix-timestamp','svix-signature'].map(n=>[n,request.headers.get(n)]));
 let event;try{event=verifyWebhook({body,headers,secret})}catch{return response(401)}
 try{await repositoryFactory(env).event(event);return response(204)}catch(e){return response(e?.code==='EVENT_CONFLICT'?409:503)}
}
export default {fetch:handle};
