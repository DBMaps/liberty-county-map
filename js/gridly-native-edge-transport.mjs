const SUPABASE_ORIGIN='https://nhwhkbkludzkuyxmkkcj.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO';
const CHALLENGE_URL='https://gridlygo.com/subscription-challenge';
const verifier=Object.freeze({ios:'gridly-verify-apple-subscription',android:'gridly-verify-google-subscription'});
async function boundedJson(response,max) {
  const reader=response.body?.getReader();if(!reader)throw Error();
  const chunks=[];let size=0;
  try{for(let i=0;i<32;i++){const {done,value}=await reader.read();if(done){const bytes=new Uint8Array(size);let at=0;
    for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
    size+=value.length;if(size>max)throw Error();chunks.push(value);}throw Error();}
  finally{void reader.cancel().catch(()=>{});}
}
// Routing credentials are public and carry no paid authority. The Edge handler
// must independently verify App Attest/Play Integrity and consume the challenge.
export function createNativeEdgeTransport({capacitor,fetchImpl=fetch}={}) {
  const platform=capacitor?.isNativePlatform?.()===true?capacitor.getPlatform?.():null;
  if(!Object.hasOwn(verifier,platform))return null;
  const request=async (url,body,headers,max=8192)=>{
    const response=await fetchImpl(url,{method:'POST',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12000),
      headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    if(!response.ok)return {data:null,error:{context:{status:response.status}}};
    return {data:await boundedJson(response,max),error:null};
  };
  return Object.freeze({
    requestChallenge:({platform:requested})=>{
      if(requested!==(platform==='ios'?'apple':'google'))throw Error('verification_unavailable');
      return request(CHALLENGE_URL,{platform:requested},{},512);
    },
    invoke:(name,{body}={})=>{
      if(name!==verifier[platform]||body?.platform!==(platform==='ios'?'apple':'google'))throw Error('verification_unavailable');
      return request(`${SUPABASE_ORIGIN}/functions/v1/${name}`,body,{'apikey':PUBLISHABLE_KEY});
    }
  });
}
