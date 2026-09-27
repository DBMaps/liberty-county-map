import {createHandler} from './handler.mjs';
import {appleAdapter,googleAdapter} from './providers.mjs';
import {tokenCipher,acknowledgmentQueue} from './acknowledgment.mjs';
// Trusted deployment composition; never constructed from a request or URL flag.
// No default native admission implementation exists. Missing/invalid ports close.
function compose(environment,ports={}) {
 const closed=platform=>createHandler({platform});
 try {
  const {authorizeNative,cache,signingKey,fingerprintKey,crypto=globalThis.crypto,apple,google}=ports;
  if(typeof authorizeNative!=='function'||typeof cache?.apply!=='function'||signingKey?.type!=='private'||signingKey.extractable||signingKey.algorithm?.name!=='ECDSA'||signingKey.algorithm.namedCurve!=='P-256'||!signingKey.usages.includes('sign')||fingerprintKey?.algorithm?.name!=='HMAC'||fingerprintKey.algorithm.hash?.name!=='SHA-256'||fingerprintKey.extractable)throw Error();
  const shared={authorizeNative:args=>args.environment===environment&&authorizeNative(args),cache,signingKey,fingerprintKey,crypto};
  const appleReady=typeof apple?.signedVerifier?.verifyAndDecodeTransaction==='function'&&typeof apple?.signedVerifier?.verifyAndDecodeRenewalInfo==='function'&&typeof apple?.apiClient?.getAllSubscriptionStatuses==='function';
  const appleHandler=appleReady?createHandler({...shared,platform:'apple',provider:appleAdapter({...apple,env:environment})}):closed('apple');
  let googleHandler=closed('google'),retry=null;
  if(typeof google?.accessToken==='function'&&google?.store&&google?.encryptionKey){
   const provider=googleAdapter({...google,env:environment});
   const queue=acknowledgmentQueue({environment,store:google.store,cipher:tokenCipher({key:google.encryptionKey,crypto}),provider,cache,fingerprintKey,crypto});
   googleHandler=createHandler({...shared,platform:'google',provider,ackQueue:queue});retry=()=>queue.drain();
  }
  return Object.freeze({apple:appleHandler,google:googleHandler,retryGoogle:retry});
 }catch{return Object.freeze({apple:closed('apple'),google:closed('google'),retryGoogle:null});}
}
export const productionComposition=ports=>compose('production',ports);
// Separate deployment AND candidate keys/build required. Production entrypoints
// never import this factory. No env/request switch enables this test composition.
export const sandboxAcceptanceComposition=ports=>compose('sandbox/test',ports);
