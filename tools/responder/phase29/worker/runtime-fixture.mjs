// Local certification entry only; never the production Wrangler main.
import {handle} from './index.mjs';
import {Refusal} from './config.mjs';
import {Buffer} from 'node:buffer';
import {createHmac,createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
const events=new Map();let terminal='SENT',suppressed=false;
const ranks={SENT:1,DELAYED:2,DELIVERED:3,FAILED:4,BOUNCED:5,COMPLAINED:6};
export default {async fetch(request,env){
 const bytes=new TextEncoder().encode('synthetic-runtime-crypto-vector'),key=randomBytes(32);
 const imported=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const webHmac=Buffer.from(await crypto.subtle.sign('HMAC',imported,bytes));
 const webHash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes));
 if(!timingSafeEqual(webHmac,createHmac('sha256',key).update(bytes).digest())||!timingSafeEqual(webHash,createHash('sha256').update(bytes).digest())||!/^[a-f0-9-]{36}$/.test(randomUUID()))return new Response(null,{status:500});
 return handle(request,env,{repositoryFactory:()=>({event:async e=>{
  if(e.messageId!=='synthetic-message')throw new Refusal('DELIVERY_UNAVAILABLE');
  const prior=events.get(e.eventId);
  if(prior&&JSON.stringify(prior)!==JSON.stringify(e))throw new Refusal('EVENT_CONFLICT');
  events.set(e.eventId,e);
  if(ranks[e.status]>=ranks[terminal])terminal=e.status;
  if(['BOUNCED','COMPLAINED'].includes(e.status))suppressed=true;
  if(suppressed&&!['BOUNCED','COMPLAINED'].includes(terminal))throw Error('precedence');
 }})});
}};
