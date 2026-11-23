const jwksUrl='https://www.googleapis.com/oauth2/v3/certs';
const decode=part=>{
 if(typeof part!=='string'||!/^[A-Za-z0-9_-]+$/.test(part)||part.length>8192)throw Error('invalid_push_identity');
 return Uint8Array.from(atob(part.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
};
const json=part=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(part)));
async function boundedJson(response){
 if(!response.ok||!response.body)throw Error('identity_unavailable');
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768)throw Error('identity_unavailable');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
// Google signed OIDC identity, not a shared secret or caller-supplied public key.
export function googlePubSubAuthenticator({serviceAccountEmail,audience,fetchImpl=fetch,crypto=globalThis.crypto,now=Date.now}={}){
 if(!/^[a-z0-9.-]+@[a-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(serviceAccountEmail||'')||
  !/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/gridly-google-rtdn$/.test(audience||''))throw Error('identity_configuration_unavailable');
 let cached=null,until=0;
 async function keys(){
  if(cached&&now()<until)return cached;
  let response;try{response=await fetchImpl(jwksUrl,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(5000)});}catch{throw Error('identity_unavailable');}
  const value=await boundedJson(response);
  if(!Array.isArray(value?.keys)||value.keys.length<1||value.keys.length>16)throw Error('identity_unavailable');
  cached=value.keys;until=now()+300000;return cached;
 }
 return async request=>{
  const auth=request.headers.get('Authorization');
  if(!auth||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(auth)||auth.length>8192)return false;
  try{
   const token=auth.slice(7),parts=token.split('.'),head=json(parts[0]),claims=json(parts[1]);
   if(head?.alg!=='RS256'||(head.typ!==undefined&&head.typ!=='JWT')||typeof head.kid!=='string'||!head.kid||head.crit!==undefined||
    !['accounts.google.com','https://accounts.google.com'].includes(claims?.iss)||claims.aud!==audience||
    claims.email!==serviceAccountEmail||claims.email_verified!==true||!/^\d{1,32}$/.test(claims.sub||'')||
    !Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.exp<=Math.floor(now()/1000)||
    claims.iat>Math.floor(now()/1000)+60||claims.iat<Math.floor(now()/1000)-3900||claims.exp-claims.iat>3660)return false;
   const jwk=(await keys()).find(row=>row.kid===head.kid&&row.kty==='RSA'&&row.alg==='RS256'&&row.use==='sig');
   if(!jwk)return false;
   const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  }catch(error){if(error?.message==='identity_unavailable')throw error;return false;}
 };
}
