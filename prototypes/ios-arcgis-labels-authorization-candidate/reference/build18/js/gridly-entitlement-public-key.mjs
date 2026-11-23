// Public DER SPKI verification pin. SHA-256: 963a8a6b5c79f20d0f3948f4cad187794d42276d4c71f40dd577830f865e0d7c
export const PRODUCTION_ENTITLEMENT_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1ZZPLl96vo0iLuxfc/pCQ91yVVnZj4KsYQxE6COM4Xw0j5PUGH+hSpgNQWXy1AKwy0Nv8qD+doEuhGsncG8Z7g==';
export const PRODUCTION_ENTITLEMENT_SPKI_SHA256 = '963a8a6b5c79f20d0f3948f4cad187794d42276d4c71f40dd577830f865e0d7c';

export async function importProductionEntitlementKey(crypto = globalThis.crypto) {
  try {
    const bytes = Uint8Array.from(atob(PRODUCTION_ENTITLEMENT_SPKI_B64), c => c.charCodeAt(0));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (digest !== PRODUCTION_ENTITLEMENT_SPKI_SHA256) return null;
    return await crypto.subtle.importKey('spki', bytes, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
  } catch { return null; }
}

