// Paste into the physical iPhone's Gridly Web Inspector console only.
// No purchase, provider evidence, challenge, App Attest object, or key ID is logged.
void (async () => {
  let stage = 'native_bridge';
  const report = value => console.log('LP24466P_PROBE', JSON.stringify(value));
  try {
    const capacitor = window.Capacitor;
    if (capacitor?.isNativePlatform?.() !== true || capacitor.getPlatform?.() !== 'ios' ||
        capacitor.isPluginAvailable?.('GridlyAppAttest') !== true) throw Error();
    const [{createNativeEdgeTransport}, {nativeVerificationBinding}] = await Promise.all([
      import(new URL('js/gridly-native-edge-transport.mjs', location.href).href),
      import(new URL('js/gridly-native-verification-binding.mjs', location.href).href)
    ]);
    const transport = createNativeEdgeTransport({capacitor});
    if (!transport) throw Error();

    stage = 'challenge';
    const issued = await transport.requestChallenge({platform:'apple'});
    if (issued.error) { report({stage, status:issued.error.context?.status ?? null}); return; }
    const challenge = issued.data?.challenge, expiresAt = Date.parse(issued.data?.expiresAt);
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge ?? '') ||
        issued.data.protocolVersion !== 'gridly-subscription-verification-v1' ||
        !Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 120000) throw Error();

    stage = 'native_authorization';
    const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    // A deliberately invalid JWS satisfies the request shape but cannot prove store ownership.
    const body = {platform:'apple', environment:'production', nonce,
      productId:'com.gridlygo.gridly.monthly',
      evidence:{signedTransactions:['invalid.invalid.invalid']}};
    const binding = await nativeVerificationBinding({challenge, request:body});
    const authorization = await capacitor.nativePromise('GridlyAppAttest', 'authorize', {digest:binding.requestHash});
    if (!['apple_initial', 'apple_assertion'].includes(authorization?.type)) throw Error();

    stage = 'verifier';
    const requestBody = {...body, nativeChallenge:challenge, nativeAuthorization:authorization};
    const first = await transport.invoke('gridly-verify-apple-subscription', {body:requestBody});
    if (!first.error) { report({stage, result:'unexpected_success'}); return; }
    const replay = await transport.invoke('gridly-verify-apple-subscription', {body:requestBody});
    report({stage:'complete', challenge:'shape_and_expiry_valid', nativeType:authorization.type,
      firstStatus:first.error.context?.status ?? null,
      replayStatus:replay.error?.context?.status ?? null,
      paidProofReturned:!replay.error});
  } catch {
    report({stage, result:'unavailable'});
  }
})();
