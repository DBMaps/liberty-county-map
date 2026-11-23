import {appleNodeAdapter} from '../../../reference/build18/supabase/functions/_shared/entitlement/apple-node-provider.mjs';
import {live,until} from './contract.mjs';
// All configuration remains inside the EXISTING verifier environment.
// No secret selection/reads or default fetch. No Apple crypto is reimplemented.
export function existingAppleProviderFactory({url,token,hmacKey,fetchImpl,crypto=globalThis.crypto,now=Date.now}={}){
 if(typeof fetchImpl!=='function')throw Error('configuration_unavailable');
 return ({signal})=>appleNodeAdapter({url,token,hmacKey,crypto,now,fetchImpl:async(target,init)=>{
  live(signal);const combined=AbortSignal.any([signal,init.signal]);
  return until(Promise.resolve().then(()=>{live(combined);return fetchImpl(target,{...init,signal:combined});}),combined);
 }});
}

