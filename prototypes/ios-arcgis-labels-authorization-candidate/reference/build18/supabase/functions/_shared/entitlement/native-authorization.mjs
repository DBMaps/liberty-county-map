import {nativeVerificationBinding, NATIVE_VERIFICATION_PURPOSE} from '../../../../js/gridly-native-verification-binding.mjs';

const TTL_MS = 120000;
const encoder = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const validChallenge = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const json = (value,status) => Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function boundedText(request,max) {
  const reader=request.body?.getReader();if(!reader)throw Error();
  const chunks=[];let size=0;
  try {for(let i=0;i<8;i++){const {done,value}=await reader.read();if(done){const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(bytes);}
    size+=value.length;if(size>max)throw Error();chunks.push(value);}throw Error();}
  finally {void reader.cancel().catch(()=>{});}
}

/** @param {{store?: unknown, rateLimit?: unknown, crypto?: Crypto, now?: () => number}} options */
export function createNativeChallengeHandler({store, rateLimit, crypto=globalThis.crypto, now=Date.now}={}) {
  return async request => {
    if(request.method !== 'POST' || new URL(request.url).search) return json({error:'invalid_request'},405);
    if(typeof store?.issue !== 'function' || typeof rateLimit?.allow !== 'function') return json({error:'verification_unavailable'},503);
    let input;
    try {
      if(!request.headers.get('Content-Type')?.startsWith('application/json')) throw Error();
      const body = await boundedText(request,128);
      input = JSON.parse(body);
      if(!input || Object.keys(input).join(',') !== 'platform' || !['apple','google'].includes(input.platform)) throw Error();
    } catch { return json({error:'invalid_request'},400); }
    try {
      if(!await rateLimit.allow({request,platform:input.platform})) return json({error:'verification_unavailable'},429);
      const random = crypto.getRandomValues(new Uint8Array(32));
      const challenge = base64url(random);
      const hash = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(challenge))));
      const expiresAt = new Date(now()+TTL_MS).toISOString();
      if(!await store.issue({hash,platform:input.platform,purpose:NATIVE_VERIFICATION_PURPOSE,expiresAt})) return json({error:'verification_unavailable'},503);
      return json({challenge,expiresAt,protocolVersion:NATIVE_VERIFICATION_PURPOSE},200);
    } catch { return json({error:'verification_unavailable'},503); }
  };
}

// Provider verifiers and challenge storage are trusted server-only ports. No
// client-supplied verdict is interpreted as verification in this module.
/** @param {{store?: unknown, appleVerifier?: unknown, googleVerifier?: unknown, crypto?: Crypto}} options */
export function createNativeAuthorizer({store, appleVerifier, googleVerifier, crypto=globalThis.crypto}={}) {
  return async ({body, environment}) => {
    try {
      if(typeof store?.consume !== 'function' || typeof body !== 'string' || body.length > 135168) return false;
      const input = JSON.parse(body);
      const challenge = input.nativeChallenge, authorization = input.nativeAuthorization;
      if(!validChallenge(challenge) || !authorization || typeof authorization !== 'object' || Array.isArray(authorization)) return false;
      if((input.nativeAuthorizationEnvironment ?? input.environment) !== environment || !['apple','google'].includes(input.platform)) return false;
      const binding = await nativeVerificationBinding({challenge,request:input,crypto});
      const hash = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(challenge))));
      let verdict;
      if(input.platform === 'apple') {
        if(typeof appleVerifier?.verify !== 'function') return false;
        verdict = await appleVerifier.verify({authorization,digest:binding.digest,environment,
          readKey:keyHash=>store.readAppleKey?.(keyHash)});
      } else {
        if(typeof googleVerifier?.verify !== 'function') return false;
        verdict = await googleVerifier.verify({authorization,requestHash:binding.requestHash,environment});
      }
      if(!verdict || verdict.verified !== true || verdict.platform !== input.platform) return false;
      return await store.consume({hash,platform:input.platform,purpose:NATIVE_VERIFICATION_PURPOSE,verdict}) === true;
    } catch { return false; }
  };
}
