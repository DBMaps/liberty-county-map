import {importProductionEntitlementKey} from './gridly-entitlement-public-key.mjs';

// The native verifier transport remains closed until a production native
// admission port is implemented on both sides of the Edge boundary.
export async function productionPaidComposition(capacitor) {
  const platform = capacitor?.isNativePlatform?.() === true ? capacitor.getPlatform?.() : null;
  const name = ({ios:'GridlyStoreKit', android:'GridlyPlayBilling'})[platform];
  const publicKey = name ? await importProductionEntitlementKey() : null;
  const authority = null;
  return {capacitor, plugin:authority && publicKey ? capacitor?.Plugins?.[name] : null,
    publicKey, authority, continuityVault:name ? capacitor?.Plugins?.GridlyContinuity : null};
}
