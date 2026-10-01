// Internal-test Android candidate only. The matching private key belongs only
// in the sandbox verifier secret; it is never shipped in the app.
const SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEs686fE4PNE2hDV9qaDxxxiq9cwD/o6zrdFqQsCiszv/LIQ+WJQSaBQ4QI+k4I3xNNTcLPhzRh3JmP5RO1W08Mw==';
const SPKI_SHA256 = '307a2533275dc0f071cf190d9710d319c00a07f8a8f860fb159345fdd628b1cd';

export async function importSandboxEntitlementKey(crypto = globalThis.crypto) {
  try {
    const bytes = Uint8Array.from(atob(SPKI_B64), c => c.charCodeAt(0));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== SPKI_SHA256) return null;
    return await crypto.subtle.importKey('spki', bytes, {name:'ECDSA',namedCurve:'P-256'}, false, ['verify']);
  } catch { return null; }
}
