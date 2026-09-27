// Release composition remains intentionally unavailable until LP244.62 provider,
// signing, cache and native admission prerequisites are separately certified.
// A future reviewed composition pins the public verification key and fixed native
// admission transport here. Never accept configuration from storage/query/window.
export function productionPaidComposition(capacitor) {
  const name=capacitor?.getPlatform?.()==='ios' ? 'GridlyStoreKit' : 'GridlyPlayBilling';
  return {capacitor, plugin:capacitor?.Plugins?.[name], publicKey:null, authority:null, continuityVault:capacitor?.Plugins?.GridlyContinuity};
}
