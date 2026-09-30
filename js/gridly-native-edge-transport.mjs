const SUPABASE_ORIGIN='https://nhwhkbkludzkuyxmkkcj.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO';
const CHALLENGE_URL='https://gridlygo.com/subscription-challenge';
const verifier=Object.freeze({ios:'gridly-verify-apple-subscription',android:'gridly-verify-google-subscription'});
function boundedJson(data,max) {
  const text=typeof data==='string'?data:JSON.stringify(data);
  if(typeof text!=='string'||new TextEncoder().encode(text).length>max)throw Error('verification_unavailable');
  const parsed=JSON.parse(text);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('verification_unavailable');
  return parsed;
}
// Routing credentials are public and carry no paid authority. The Edge handler
// must independently verify App Attest/Play Integrity and consume the challenge.
export function createNativeEdgeTransport({capacitor,http}={}) {
  const platform=capacitor?.isNativePlatform?.()===true?capacitor.getPlatform?.():null;
  if(!Object.hasOwn(verifier,platform))return null;
  // Native staging copies this module without a JS package resolver. Capacitor's
  // injected bridge exposes its registered, built-in CapacitorHttp plugin.
  const nativeRequest=http===undefined
    ? capacitor?.isPluginAvailable?.('CapacitorHttp')===true&&typeof capacitor.nativePromise==='function'
      ? options=>capacitor.nativePromise('CapacitorHttp','request',options):null
    : typeof http?.request==='function'?options=>http.request(options):null;
  if(!nativeRequest)return null;
  const request=async (url,body,headers,max=8192)=>{
    // Native HTTP avoids WebView CORS while preserving the Edge authorization boundary.
    const response=await nativeRequest({url,method:'POST',disableRedirects:true,
      connectTimeout:12000,readTimeout:12000,responseType:'text',
      headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers},data:JSON.stringify(body)});
    if(!Number.isInteger(response?.status)||response.status<200||response.status>=300)
      return {data:null,error:{context:{status:response?.status}}};
    return {data:boundedJson(response.data,max),error:null};
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
