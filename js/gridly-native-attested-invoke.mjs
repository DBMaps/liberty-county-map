import {nativeVerificationBinding} from './gridly-native-verification-binding.mjs';

const names = Object.freeze({apple:'gridly-verify-apple-subscription',google:'gridly-verify-google-subscription'});
const sandboxGoogleName='gridly-verify-google-sandbox-subscription';

// A routing adapter only. The Edge authorizer must independently verify the
// native object and atomically consume the server challenge before minting proof.
export function createNativeAttestedInvoke({platform,invoke,requestChallenge,nativeAttestation,googleEnvironment='production',crypto=globalThis.crypto,now=Date.now}={}) {
  if(!Object.hasOwn(names,platform) || typeof invoke !== 'function' || typeof requestChallenge !== 'function' ||
    typeof nativeAttestation?.authorize !== 'function' || (platform==='google'&&!['production','sandbox/test'].includes(googleEnvironment))) return null;
  return async (name,{body}={}) => {
    const expected=platform==='google'&&googleEnvironment==='sandbox/test'?sandboxGoogleName:names[platform];
    if(name !== expected || body?.platform !== platform || (platform==='google'&&body.environment!==googleEnvironment)) throw Error('verification_unavailable');
    const challengeResult = await requestChallenge({platform});
    const challenge = challengeResult?.data?.challenge, expiresAt = challengeResult?.data?.expiresAt;
    if(challengeResult?.error || Object.keys(challengeResult?.data ?? {}).sort().join(',') !== 'challenge,expiresAt,protocolVersion' ||
      challengeResult.data.protocolVersion !== 'gridly-subscription-verification-v1' ||
      typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now() || Date.parse(expiresAt) > now()+300000) throw Error('verification_unavailable');
    const binding = await nativeVerificationBinding({challenge,request:body,crypto});
    if(platform === 'google' && (typeof nativeAttestation.prepare !== 'function' ||
      (await nativeAttestation.prepare())?.prepared !== true)) throw Error('verification_unavailable');
    const authorization = await nativeAttestation.authorize({digest:binding.requestHash});
    if(!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) throw Error('verification_unavailable');
    if(platform === 'apple' && !['apple_initial','apple_assertion'].includes(authorization.type)) throw Error('verification_unavailable');
    if(platform === 'google' && authorization.type !== 'google_standard') throw Error('verification_unavailable');
    const result = await invoke(name,{body:{...body,nativeChallenge:challenge,nativeAuthorization:authorization}});
    if(platform === 'apple' && authorization.type === 'apple_initial' && result?.data?.proof) {
      if(typeof nativeAttestation.confirm !== 'function' ||
        (await nativeAttestation.confirm({keyId:authorization.keyId}))?.confirmed !== true) throw Error('verification_unavailable');
    }
    return result;
  };
}
