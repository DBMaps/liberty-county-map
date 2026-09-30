import {importProductionEntitlementKey} from './gridly-entitlement-public-key.mjs';
import {createNativeEdgeTransport} from './gridly-native-edge-transport.mjs';
import {createNativeAttestedInvoke} from './gridly-native-attested-invoke.mjs';
import {createAppleVerificationAuthority} from './gridly-apple-storekit.mjs';

export async function productionPaidComposition(capacitor) {
  const platform = capacitor?.isNativePlatform?.() === true ? capacitor.getPlatform?.() : null;
  const publicKey=['ios','android'].includes(platform)?await importProductionEntitlementKey():null;
  // Apple-only admission. Android remains separately closed pending its own proof.
  if(platform!=='ios'||capacitor.isPluginAvailable?.('GridlyStoreKit')!==true||
    capacitor.isPluginAvailable?.('GridlyAppAttest')!==true)return {capacitor,plugin:null,publicKey,authority:null,continuityVault:null};
  // The bundled iOS native bridge injects Plugins directly and has no registerPlugin.
  const plugin=capacitor.Plugins?.GridlyStoreKit??capacitor.registerPlugin?.('GridlyStoreKit')??null;
  const nativeAttestation=capacitor.Plugins?.GridlyAppAttest??capacitor.registerPlugin?.('GridlyAppAttest')??null;
  if(!plugin||!nativeAttestation)return {capacitor,plugin:null,publicKey,authority:null,continuityVault:null};
  const transport=createNativeEdgeTransport({capacitor});
  const invoke=transport&&createNativeAttestedInvoke({platform:'apple',invoke:transport.invoke,
    requestChallenge:transport.requestChallenge,nativeAttestation});
  const authority=invoke&&publicKey?createAppleVerificationAuthority({invoke}):null;
  // Production continuity cannot be carried into a sandbox StoreKit session.
  return {capacitor,plugin,publicKey,authority,continuityVault:null};
}
