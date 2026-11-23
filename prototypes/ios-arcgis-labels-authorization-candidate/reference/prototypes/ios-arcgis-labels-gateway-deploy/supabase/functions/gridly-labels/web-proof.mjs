import { sha256 } from './foundation/protocol.mjs';
import { tileProofBytes } from './tile-wire.mjs';

// Canonical uncompressed P-256 SubjectPublicKeyInfo (EC and prime256v1 OIDs).
const prefix = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d03010703420004', 'hex');
export async function p256Key(spki) {
  if (typeof spki !== 'string' || !/^[A-Za-z0-9_-]{122}$/.test(spki) || spki.length !== 122) return null;
  try {
    const bytes = Buffer.from(spki, 'base64url');
    if (bytes.length !== 91 || bytes.toString('base64url') !== spki ||
        !bytes.subarray(0, prefix.length).equals(prefix)) return null;
    const key = await crypto.subtle.importKey('spki', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return { key, fingerprint: sha256(bytes) };
  } catch {
    return null;
  }
}

export async function verifyProof(request, origin, key) {
  const { signature } = request;
  if (typeof signature !== 'string' || signature.length !== 86 || !/^[A-Za-z0-9_-]{86}$/.test(signature)) return false;
  const bytes = Buffer.from(signature, 'base64url');
  return bytes.length === 64 && bytes.toString('base64url') === signature &&
    await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, bytes, tileProofBytes(request, origin));
}
