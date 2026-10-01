import {importProductionEntitlementKey} from './gridly-entitlement-public-key.mjs';
import {importSandboxEntitlementKey} from './gridly-sandbox-entitlement-public-key.mjs';
import {createNativeEdgeTransport} from './gridly-native-edge-transport.mjs';
import {createNativeAttestedInvoke} from './gridly-native-attested-invoke.mjs';
import {createAppleVerificationAuthority} from './gridly-apple-storekit.mjs';
import {createGoogleVerificationAuthority} from './gridly-google-play-billing.mjs';

export async function productionPaidComposition(capacitor,{googleLicenseTest=false}={}) {
  const platform = capacitor?.isNativePlatform?.() === true ? capacitor.getPlatform?.() : null;
  const googleEnvironment=platform==='android'&&googleLicenseTest===true?'sandbox/test':'production';
  const publicKey=platform==='android'&&googleEnvironment==='sandbox/test'?await importSandboxEntitlementKey():
    ['ios','android'].includes(platform)?await importProductionEntitlementKey():null;
  if(platform==='android') {
    if(capacitor.isPluginAvailable?.('GridlyPlayBilling')!==true||
      capacitor.isPluginAvailable?.('GridlyPlayIntegrity')!==true)
      return {capacitor,plugin:null,publicKey,authority:null,continuityVault:null};
    const plugin=capacitor.Plugins?.GridlyPlayBilling??capacitor.registerPlugin?.('GridlyPlayBilling')??null;
    const nativeAttestation=capacitor.Plugins?.GridlyPlayIntegrity??capacitor.registerPlugin?.('GridlyPlayIntegrity')??null;
    if(!plugin||!nativeAttestation)return {capacitor,plugin:null,publicKey,authority:null,continuityVault:null};
    const transport=createNativeEdgeTransport({capacitor,googleEnvironment});
    const invoke=transport&&createNativeAttestedInvoke({platform:'google',invoke:transport.invoke,
      requestChallenge:transport.requestChallenge,nativeAttestation,googleEnvironment});
    const authority=invoke&&publicKey?createGoogleVerificationAuthority({invoke,environment:googleEnvironment}):null;
    return {capacitor,plugin,publicKey,authority,continuityVault:null,googleEnvironment};
  }
  // Preserve the independently certified Apple admission path.
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
