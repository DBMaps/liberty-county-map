import {Client} from 'pg';
import {databaseBinding,Refusal} from './config.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const bounded=v=>typeof v==='string'&&/^[-a-zA-Z0-9_]{1,100}$/.test(v);
export function deliveryRepository(env,{createClient}={}){
 const connectionString=databaseBinding(env);
 const factory=createClient??(()=>new Client({connectionString,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:3000,query_timeout:4000,application_name:'dispatch-delivery'}));
 async function call(sql,value,claim=false){
  const c=factory();let connected=false;
  try{
   await c.connect();connected=true;
   await c.query('BEGIN');
   await c.query('SET LOCAL ROLE dispatch_delivery_transport');
   await c.query("SET LOCAL statement_timeout = '3000ms'");
   await c.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
   const r=await c.query(sql,[value]);
   if(claim&&(r.rows.length!==1||typeof r.rows[0].allowed!=='boolean'))throw Error('shape');
   await c.query('COMMIT');
   return claim?r.rows[0].allowed:undefined;
  }catch(e){
   if(connected)try{await c.query('ROLLBACK')}catch{}
   if(e?.code==='P0001'&&e?.message==='DELIVERY_EVENT_CONFLICT')throw new Refusal('EVENT_CONFLICT');
   throw new Refusal('DELIVERY_UNAVAILABLE');
  }finally{try{await c.end()}catch{}}
 }
 return Object.freeze({
  claim(id){if(!uuid(id))throw new Refusal('INPUT_REFUSED');return call('SELECT dispatch_private.invitation_claim_send($1::uuid) AS allowed',id,true)},
  complete(p){if(!p||Object.keys(p).some(k=>!['attemptId','status','messageId','reason'].includes(k))||!uuid(p.attemptId)||!['SENT','FAILED'].includes(p.status)||p.status==='SENT'&&!bounded(p.messageId)||p.reason!==undefined&&!['PROVIDER_REJECTED','TRANSPORT_FAILURE'].includes(p.reason))throw new Refusal('INPUT_REFUSED');return call('SELECT dispatch_private.invitation_transport_result($1::jsonb)',JSON.stringify(p))},
  event(p){if(!p||Object.keys(p).some(k=>!['eventId','messageId','status','occurredAt'].includes(k))||!bounded(p.eventId)||!bounded(p.messageId)||!['SENT','DELIVERED','FAILED','DELAYED','BOUNCED','COMPLAINED'].includes(p.status)||typeof p.occurredAt!=='string'||!Number.isFinite(Date.parse(p.occurredAt)))throw new Refusal('INPUT_REFUSED');return call('SELECT dispatch_private.invitation_transport_result($1::jsonb)',JSON.stringify(p))}
 });
}
