// The Cloudflare Worker is the only caller permitted to reach challenge issue.
// Its own rate-limit binding uses Cloudflare's connection IP, not a caller header.
export function challengeGatewayLimiter(secret,crypto=globalThis.crypto) {
  return Object.freeze({allow:async ({request})=>{
    try {
      const value=request.headers.get('X-Gridly-Challenge-Gateway-Token');
      if(!/^[a-f0-9]{64}$/.test(secret||'')||! /^[a-f0-9]{64}$/.test(value||''))return false;
      const enc=new TextEncoder(),[a,b]=await Promise.all([secret,value].map(v=>crypto.subtle.digest('SHA-256',enc.encode(v))));
      const left=new Uint8Array(a),right=new Uint8Array(b);let different=0;
      for(let i=0;i<left.length;i++)different|=left[i]^right[i];
      return different===0;
    } catch{return false;}
  }});
}
