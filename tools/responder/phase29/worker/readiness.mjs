import {Client} from 'pg';
import {databaseBinding} from './config.mjs';
const identity='SELECT current_database() AS database, session_user AS session_user, current_user AS current_user';
export async function readiness(env,{createClient}={}){
 let c,connected=false;
 const result={service:'gridly-dispatch-delivery',environment:'production',status:'unavailable',database:{connected:false},databaseIdentity:'gridly-dispatch',transportRole:{verified:false},roleReset:{verified:false}};
 try{
  const connectionString=databaseBinding(env);
  c=(createClient??(()=>new Client({connectionString,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:3000,query_timeout:4000,application_name:'dispatch-readiness'})))();
  await c.connect();connected=true;
  const check=async role=>{const r=await c.query(identity);if(r.rows.length!==1||r.rows[0].database!=='postgres'||r.rows[0].session_user!=='dispatch_delivery_connection'||r.rows[0].current_user!==role)throw Error('identity');};
  await check('dispatch_delivery_connection');
  // Exercise the same logical client again after rollback; Hyperdrive owns physical pooling.
  for(let i=0;i<2;i++){
   await c.query('BEGIN READ ONLY');
   await c.query('SET LOCAL ROLE dispatch_delivery_transport');
   await c.query("SET LOCAL statement_timeout = '3000ms'");
   await c.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
   await check('dispatch_delivery_transport');
   await c.query('ROLLBACK');
   await check('dispatch_delivery_connection');
  }
  result.status='ok';result.database.connected=true;result.transportRole.verified=true;result.roleReset.verified=true;
 }catch{if(connected)try{await c.query('ROLLBACK')}catch{}}
 finally{if(c)try{await c.end()}catch{result.status='unavailable';result.database.connected=false;result.transportRole.verified=false;result.roleReset.verified=false;}}
 return new Response(JSON.stringify(result),{status:result.status==='ok'?200:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
