import {createNativeEdgeTransport} from './gridly-native-edge-transport.mjs';
import {createNativeAttestedInvoke} from './gridly-native-attested-invoke.mjs';
import {importProductionEntitlementKey} from './gridly-entitlement-public-key.mjs';
import {storeVerificationRequest} from './gridly-store-verification.mjs';
import {verifyGoogleReviewProof,googleReviewAllowed,GOOGLE_REVIEW_ENDPOINT,reviewBase64} from './gridly-google-review-proof.mjs';

export async function productionGoogleReviewComposition(capacitor) {
  if(capacitor?.isNativePlatform?.()!==true||capacitor.getPlatform?.()!=='android'||capacitor.isPluginAvailable?.('GridlyPlayIntegrity')!==true)return null;
  const nativeAttestation=capacitor.Plugins?.GridlyPlayIntegrity??capacitor.registerPlugin?.('GridlyPlayIntegrity');
  const transport=createNativeEdgeTransport({capacitor,googleReviewAccess:true});
  const invoke=transport&&createNativeAttestedInvoke({platform:'google',...transport,nativeAttestation,googleReviewAccess:true});
  const publicKey=await importProductionEntitlementKey();
  return invoke&&publicKey?{invoke,publicKey}:null;
}

// This wrapper never changes subscription ownership, StoreKit/Billing state or
// persisted entitlement. A credential alone cannot admit the protected runtime.
export function withGoogleReviewAccess(normal,{invoke,publicKey,now=Date.now,crypto=globalThis.crypto}={}) {
  let credential=null,proof=null,snapshot=null,timer=null,expiryTimer=null,inflight=null,stopped=false,generation=0;
  const listeners=new Set();
  const isReviewActive=()=>!stopped&&googleReviewAllowed(snapshot,now());
  const allowed=()=>isReviewActive()||normal.allowed();
  const read=()=>isReviewActive()?Object.freeze({...normal.read(),state:'entitled',allowed:true,temporaryAccess:false,reviewAccess:true,action:null,errorCategory:'none'}):normal.read();
  const emit=()=>{for(const fn of listeners)fn(read());};
  const drop=()=>{generation++;credential=null;proof=null;snapshot=null;clearTimeout(timer);clearTimeout(expiryTimer);timer=expiryTimer=null;};
  const refreshReview=async()=>{
    if(inflight)return inflight;
    const ticket=generation;
    inflight=(async()=>{
      try {
        if(stopped||!credential||typeof invoke!=='function'||!publicKey)throw Error();
        const nonce=reviewBase64(crypto.getRandomValues(new Uint8Array(32)));
        const body=storeVerificationRequest({platform:'google',environment:'production',nonce,evidence:{purchaseTokens:[credential]}});
        const result=await invoke(GOOGLE_REVIEW_ENDPOINT,{body});
        const verified=await verifyGoogleReviewProof({proof:result?.data?.proof,publicKey,nonce,now:now(),crypto});
        if(result?.error||!googleReviewAllowed(verified,now())||stopped||ticket!==generation)throw Error();
        proof=result.data.proof;snapshot=verified;
        clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>{drop();emit();},verified.expiresAt-now());expiryTimer?.unref?.();
        clearTimeout(timer);timer=setTimeout(()=>{void refreshReview();},Math.min(120000,verified.expiresAt-now()));timer?.unref?.();
        emit();return true;
      }catch{if(ticket===generation){drop();emit();}return false;}
      finally{inflight=null;}
    })();
    return inflight;
  };
  const unsubscribe=normal.subscribe(()=>emit());
  return Object.freeze({...normal,read,allowed,isReviewActive,
    enterReview:async code=>{
      if(inflight||stopped||typeof code!=='string'||!/^grr_[a-f0-9]{32}_[A-Za-z0-9_-]{43}$/.test(code))return false;
      drop();credential=code;return refreshReview();
    },
    refresh:()=>credential?refreshReview():normal.refresh(),resume:()=>credential?refreshReview():normal.resume(),
    subscribe:fn=>{listeners.add(fn);fn(read());return()=>listeners.delete(fn);},
    getReportingProof:async()=>{
      if(credential){if(!isReviewActive()||snapshot.expiresAt-now()<30000)await refreshReview();if(isReviewActive())return proof;return null;}
      return normal.getReportingProof();
    },
    validateReviewOperation:async (operation,args,client)=>{
      if(!isReviewActive())return {status:'authorization_required'};
      if(snapshot.expiresAt-now()<30000)await refreshReview();
      if(!isReviewActive())return {status:'authorization_required'};
      try {
        const result=await client.functions.invoke(GOOGLE_REVIEW_ENDPOINT,{body:{proof,protocol_version:2,operation,args}});
        const value=result?.data;
        if(result?.error||value?.status!=='review_validated'||value.authority!==snapshot.authority||value.protocol_version!==2||value.publication!=='none'||
          Object.keys(value).sort().join(',')!=='authority,protocol_version,publication,status')return {status:'authorization_required'};
        return Object.freeze({status:'review_validated',publication:'none'});
      }catch{return {status:'authorization_required'};}
    },
    initializeRuntime:async work=>{
      if(!isReviewActive())return normal.initializeRuntime(work);
      if(!allowed())throw Error('verification_required');await work(allowed);if(!allowed())throw Error('verification_required');
    },
    purchase:async()=>{drop();emit();return normal.purchase();},restore:async()=>{drop();emit();return normal.restore();},
    stop:async()=>{stopped=true;drop();unsubscribe();listeners.clear();return normal.stop();}
  });
}
