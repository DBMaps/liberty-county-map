// Disposable server session adapter. Browser receives an opaque HttpOnly cookie, never JWTs.
import {randomBytes} from 'node:crypto';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const claims=token=>JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
export function localSession({apiUrl,anonKey,project,allowedUsers,now=Date.now}) {
 if(apiUrl!=='http://127.0.0.1:54321'||!/^gridly-dispatch-auth-[a-f0-9]{12}$/.test(project)||claims(anonKey).role!=='anon'||!allowedUsers?.length||!allowedUsers.every(id=>uuid.test(id)))throw Error('Isolated synthetic configuration required');
 const allowed=new Set(allowedUsers),sessions=new Map();
 const cookie=id=>'gridlyLocalDispatch='+(id||'')+'; HttpOnly; SameSite=Strict; Path=/api/; Max-Age='+(id?1800:0);
 async function upstream(path,{token=anonKey,body,method=body===undefined?'GET':'POST',profile=false}={}) {
  const response=await fetch(apiUrl+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:anonKey,Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'}),...(profile?{'Accept-Profile':'dispatch_api','Content-Profile':'dispatch_api'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok)throw Error('Upstream denied');return response.status===204?null:response.json();
 }
 const auth=(session,path,body,method)=>upstream('/auth/v1/'+path,{token:session.token.access_token,body,method});
 async function identity(session){const user=await auth(session,'user');if(user.id!==session.userId||!allowed.has(user.id))throw Error('Synthetic account required');return user;}
 async function context(session){await identity(session);const units=await upstream('/rest/v1/rpc/read_authorized_context',{token:session.token.access_token,body:{},profile:true});if(!Array.isArray(units)||!units.length||units.some(unit=>Object.keys(unit).sort().join(',')!=='organization_display_name,organization_id,unit_display_name,unit_id'||!uuid.test(unit.unit_id)||!uuid.test(unit.organization_id)))throw Error('Invalid authorized context');return {ok:true,state:'authorized',units};}
 async function serial(session,fn){const before=session.pending||Promise.resolve();let release;session.pending=new Promise(resolve=>release=resolve);await before;try{if(session.invalid)throw Error('Session unavailable');return await fn()}finally{release()}}
 async function revoke(session){session.invalid=true;sessions.delete(session.id);try{await auth(session,'logout?scope=local',{});return true}catch{return false}}
 async function json(request,keys){if(request.headers['content-type']!=='application/json')throw Error('Invalid request');let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>4096)throw Error('Request too large');chunks.push(chunk)}const value=JSON.parse(Buffer.concat(chunks));if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!keys.includes(key)))throw Error('Invalid request');return value}
 return async function handle(request,response,headers){
  const url=new URL(request.url,'http://127.0.0.1');const route=url.pathname.slice(5);
  const send=(status,value,id)=>{response.writeHead(status,{...headers,'Content-Type':'application/json',...(id===undefined?{}:{'Set-Cookie':cookie(id)})});response.end(JSON.stringify(value))};
  if(request.headers['x-gridly-dispatch']!=='local-auth'||request.headers['sec-fetch-site']==='cross-site'||(request.method!=='GET'&&request.headers.origin!=='http://'+request.headers.host))return send(403,{ok:false,message:'Request denied.'});
  if(url.search||!['login','enroll','verify','context','refresh','logout'].includes(route)||request.method!==(route==='context'?'GET':'POST'))return send(404,{ok:false,message:'Operation unavailable.'});
  let input;try{input=request.method==='GET'?{}:await json(request,route==='login'?['email','password']:route==='verify'?['code']:[])}catch{return send(400,{ok:false,message:'Invalid request.'})}
  const id=request.headers.cookie?.match(/(?:^|;\s*)gridlyLocalDispatch=([a-f0-9]{64})(?:;|$)/)?.[1];let session=sessions.get(id);
  if(route==='login'){
   if(typeof input.email!=='string'||!/^[-a-z0-9]+@dispatch\.invalid$/.test(input.email)||typeof input.password!=='string'||input.password.length>256)return send(401,{ok:false,message:'Sign-in denied.'},'');
   if(session)await serial(session,()=>revoke(session));if(sessions.size>=50)return send(503,{ok:false,message:'Local session limit reached.'},'');
   try{const token=await upstream('/auth/v1/token?grant_type=password',{body:input});session={id:randomBytes(32).toString('hex'),token,userId:token.user.id,created:now(),touched:now(),failures:0};const user=await identity(session);sessions.set(session.id,session);return send(200,{ok:true,state:'mfa-required',enrollmentAvailable:!user.factors?.some(f=>f.factor_type==='totp'&&f.status==='verified')},session.id)}catch{if(session)await revoke(session);return send(401,{ok:false,message:'Sign-in denied.'},'')}
  }
  if(!session)return send(401,{ok:false,message:'Session expired. Sign in again.'},'');
  try{await serial(session,async()=>{
   if(now()-session.touched>=1800000||now()-session.created>=43200000){await revoke(session);return send(401,{ok:false,message:'Session expired. Sign in again.'},'')}
   if(route==='logout'){const confirmed=await revoke(session);return send(200,{ok:true,state:'signed-out',upstreamRevocationConfirmed:confirmed},'')}
   if(route==='refresh'){session.token=await upstream('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:session.token.refresh_token}});const value=await context(session);session.touched=now();return send(200,value,session.id)}
   if(claims(session.token.access_token).exp*1000<=now())return send(401,{ok:false,state:'refresh-required',message:'Session needs renewal.'});
   const user=await identity(session);
   if(route==='enroll'){
    if(claims(session.token.access_token).aal!=='aal1'||user.factors?.some(f=>f.status==='verified'))return send(409,{ok:false,message:'Use your enrolled authenticator.'});
    if(!session.enrollment)session.enrollment=await auth(session,'factors',{factor_type:'totp',friendly_name:'Local synthetic '+randomBytes(6).toString('hex')});
    return send(200,{ok:true,secret:session.enrollment.totp.secret});
   }
   if(route==='verify'){
    if(!/^\d{6}$/.test(input.code||''))return send(400,{ok:false,message:'Enter a six-digit code.'});
    const factor=user.factors?.find(f=>f.factor_type==='totp'&&f.status==='verified')?.id||session.enrollment?.id;if(!factor)return send(409,{ok:false,message:'Enroll an authenticator first.'});
    try{const challenge=await auth(session,'factors/'+factor+'/challenge',{});session.token=await auth(session,'factors/'+factor+'/verify',{challenge_id:challenge.id,code:input.code})}catch{if(++session.failures>=5){await revoke(session);return send(401,{ok:false,message:'Verification denied. Sign in again.'},'')}return send(403,{ok:false,message:'Verification denied. Check your code.'})}
    delete session.enrollment;const value=await context(session);session.touched=now();return send(200,value,session.id);
   }
   const value=await context(session);session.touched=now();return send(200,value,session.id);
  })}catch{await revoke(session);return send(403,{ok:false,message:'Access denied. Sign in again or contact the test administrator.'},'')}
 };
}
