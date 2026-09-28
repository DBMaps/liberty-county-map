const unavailable=(status=503)=>Response.json({error:'verification_unavailable'},{status,headers:{'Cache-Control':'no-store'}});
async function boundedBody(request) {
  const reader=request.body?.getReader();if(!reader)throw Error();
  let size=0;const chunks=[];
  try {for(let i=0;i<8;i++){const {done,value}=await reader.read();if(done){
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(bytes);}
    size+=value.length;if(size>128)throw Error();chunks.push(value);}throw Error();}
  finally{void reader.cancel().catch(()=>{});}
}
export async function handleChallengeGateway(request,env,{fetchImpl=fetch}={}) {
  try {
    if(request.method!=='POST'||new URL(request.url).pathname!=='/subscription-challenge'||new URL(request.url).search)return unavailable(405);
    const ip=request.headers.get('CF-Connecting-IP');
    if(typeof ip!=='string'||ip.length<3||ip.length>45||! /^[0-9a-fA-F:.]+$/.test(ip)||
      typeof env?.CHALLENGE_RATE?.limit!=='function')return unavailable();
    // Cloudflare sets this connection metadata before dispatching the Worker.
    // A standalone direct Supabase call has no gateway token and is denied.
    const limit=await env.CHALLENGE_RATE.limit({key:ip});if(limit?.success!==true)return unavailable(429);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return unavailable(400);
    const body=await boundedBody(request),parsed=JSON.parse(body);
    if(!parsed||Object.keys(parsed).join(',')!=='platform'||!['apple','google'].includes(parsed.platform))return unavailable(400);
    const token=env.CHALLENGE_GATEWAY_TOKEN,url=env.CHALLENGE_EDGE_URL;
    if(!/^[a-f0-9]{64}$/.test(token||''))return unavailable();
    const target=new URL(url);
    if(target.protocol!=='https:'||! /^[a-z0-9]+\.supabase\.co$/.test(target.hostname)||
      target.pathname!=='/functions/v1/gridly-subscription-challenge'||target.search||target.hash)return unavailable();
    const response=await fetchImpl(target.href,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(5000),
      headers:{'Content-Type':'application/json','X-Gridly-Challenge-Gateway-Token':token},
      body:JSON.stringify({platform:parsed.platform})});
    if(!response.ok)return unavailable(response.status===429?429:503);
    const result=await response.json();
    if(Object.keys(result??{}).sort().join(',')!=='challenge,expiresAt,protocolVersion'||
      result.protocolVersion!=='gridly-subscription-verification-v1'||
      !/^[A-Za-z0-9_-]{43}$/.test(result.challenge)||!Number.isFinite(Date.parse(result.expiresAt)))return unavailable();
    return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch{return unavailable();}
}
export default {fetch:handleChallengeGateway};
