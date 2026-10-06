import {Client} from 'pg';
import {databaseBinding} from './config.mjs';
import {bindingFacts} from './binding-facts.mjs';
const identity='SELECT current_database() AS database, session_user AS session_user, current_user AS current_user';
const failureCodes=Object.freeze({binding:'BINDING_MISSING',client_construct:'CLIENT_CONSTRUCT_FAILED',connect:'CONNECT_FAILED',identity:'SESSION_USER_MISMATCH',begin:'BEGIN_FAILED',set_local_role:'SET_LOCAL_ROLE_FAILED',transport_identity:'TRANSPORT_USER_MISMATCH',rollback:'ROLLBACK_FAILED',post_reset_identity:'ROLE_RESET_FAILED',second_transaction:'SECOND_TRANSACTION_FAILED',cleanup:'UNKNOWN_DATABASE_FAILURE'});
export async function readiness(env,{createClient,logDiagnostic=diagnostic=>console.warn(JSON.stringify(diagnostic))}={}){
 let c,connected=false,stage='binding',failure;
 const result={service:'gridly-dispatch-delivery',environment:'production',status:'unavailable',database:{connected:false},databaseIdentity:'gridly-dispatch',transportRole:{verified:false},roleReset:{verified:false}};
 const diagnose=()=>({failureStage:stage,failureCode:failureCodes[stage]});
 try{
  const connectionString=databaseBinding(env);
  stage='client_construct';
  c=(createClient??(()=>new Client({connectionString,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:3000,query_timeout:4000,application_name:'dispatch-readiness'})))();
  stage='connect';await c.connect();connected=true;
  const check=async role=>{const r=await c.query(identity);if(r.rows.length!==1||r.rows[0].database!=='postgres'||r.rows[0].session_user!=='dispatch_delivery_connection'||r.rows[0].current_user!==role)throw Error('identity');};
  stage='identity';await check('dispatch_delivery_connection');
  // Exercise the same logical client again after rollback; Hyperdrive owns physical pooling.
  for(let i=0;i<2;i++){
   stage=i===0?'begin':'second_transaction';await c.query('BEGIN READ ONLY');
   stage='set_local_role';await c.query('SET LOCAL ROLE dispatch_delivery_transport');
   stage='transport_identity';await c.query("SET LOCAL statement_timeout = '3000ms'");
   await c.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
   await check('dispatch_delivery_transport');
   stage='rollback';await c.query('ROLLBACK');
   stage='post_reset_identity';await check('dispatch_delivery_connection');
  }
  result.status='ok';result.database.connected=true;result.transportRole.verified=true;result.roleReset.verified=true;
 }catch{failure=diagnose();if(connected)try{await c.query('ROLLBACK')}catch{}}
 finally{if(c)try{await c.end()}catch{if(!failure){stage='cleanup';failure=diagnose()}result.status='unavailable';result.database.connected=false;result.transportRole.verified=false;result.roleReset.verified=false;}}
 if(failure){if(failure.failureStage==='binding')Object.assign(failure,bindingFacts(env));Object.assign(result,failure);try{logDiagnostic(failure)}catch{}}
 return new Response(JSON.stringify(result),{status:result.status==='ok'?200:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
