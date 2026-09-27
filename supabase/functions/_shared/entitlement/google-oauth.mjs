const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const json=value=>b64(enc.encode(JSON.stringify(value)));
// No user impersonation, client token input, selectable scope or token endpoint.
export function googleServiceAccessToken({clientEmail,privateKey,crypto=globalThis.crypto,fetchImpl=fetch,now=Date.now}) {
 if(typeof clientEmail!=='string'||! /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(clientEmail)||privateKey?.type!=='private'||privateKey.extractable||privateKey.algorithm?.name!=='RSASSA-PKCS1-v1_5'||privateKey.algorithm.hash?.name!=='SHA-256'||privateKey.algorithm.modulusLength<2048||!privateKey.usages.includes('sign'))throw Error('provider_unavailable');
 let cached=null,inflight=null;
 return async()=>{
  if(cached&&cached.until>now()+60000)return cached.token;
  if(inflight)return inflight;
  inflight=(async()=>{
   const issued=Math.floor(now()/1000),head=json({alg:'RS256',typ:'JWT'}),body=json({iss:clientEmail,scope:'https://www.googleapis.com/auth/androidpublisher',aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600});
   const data=head+'.'+body,signed=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,enc.encode(data));
   const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:data+'.'+b64(new Uint8Array(signed))})});
   if(!response.ok)throw Error('provider_unavailable');
   const reader=response.body?.getReader();if(!reader)throw Error('provider_unavailable');let size=0;const chunks=[];
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192)throw Error('provider_unavailable');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const result=JSON.parse(new TextDecoder().decode(bytes));
   if(result.token_type!=='Bearer'||typeof result.access_token!=='string'||result.access_token.length<1||result.access_token.length>4096||!Number.isInteger(result.expires_in)||result.expires_in<1||result.expires_in>3600)throw Error('provider_unavailable');
   cached={token:result.access_token,until:now()+result.expires_in*1000};return cached.token;
  })();
  try{return await inflight;}catch{throw Error('provider_unavailable');}finally{inflight=null;}
 };
}
