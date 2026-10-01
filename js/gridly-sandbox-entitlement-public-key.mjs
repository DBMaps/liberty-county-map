// Internal-test Android candidate only. The matching private key belongs only
// in the sandbox verifier secret; it is never shipped in the app.
const SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEIer/N+bWl1PB/DZQfpH+v9svKljX0cG1w9uaURX3h6cjpese8KRqxZngOUq1+2i4N5upFkG0XvBoWMaya6TKPQ==';
const SPKI_SHA256 = '8937106c99ea6378a4497612d0f4bade5e537e79b69fb74ce5dd6b9ad0d0192c';

export async function importSandboxEntitlementKey(crypto = globalThis.crypto) {
  try {
    const bytes = Uint8Array.from(atob(SPKI_B64), c => c.charCodeAt(0));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== SPKI_SHA256) return null;
    return await crypto.subtle.importKey('spki', bytes, {name:'ECDSA',namedCurve:'P-256'}, false, ['verify']);
  } catch { return null; }
}
