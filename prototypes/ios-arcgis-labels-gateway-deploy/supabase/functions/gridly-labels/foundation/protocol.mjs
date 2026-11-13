import { createHash, createPublicKey, verify } from 'node:crypto';

export const audience = 'gridly-labels-pilot-v1';
export const scope = 'imagery-labels:read';
export const purpose = 'gridly-labels-lease-v1';
export const leasePath = '/v1/labels/lease';
export const environments = Object.freeze({ store: 'sandbox', attest: 'production' });
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const identity = /^[A-Za-z0-9_-]{1,64}$/;
export const milliseconds = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('base64url');
export const safe = (status, code) => ({ status, code });
export const denied = () => safe(401, 'authorization_required');
export const limited = () => safe(429, 'usage_limit');
export const unavailable = () => safe(503, 'temporarily_unavailable');

export function parseTileTarget(target) {
  // Match the raw request target before any URL parser can normalize it.
  if (typeof target !== 'string' || target.length > 42) return null;
  const match = /^\/v1\/imagery-labels\/(0|[1-9][0-9]?)\/(0|[1-9][0-9]{0,5})\/(0|[1-9][0-9]{0,5})$/.exec(target);
  if (!match || match[0] !== target) return null;
  const [level, row, column] = match.slice(1).map(Number);
  return level <= 19 && row < 2 ** level && column < 2 ** level ? { level, row, column } : null;
}

export function p256Key(spki) {
  if (typeof spki !== 'string' || spki.length !== 122 || !/^[A-Za-z0-9_-]+$/.test(spki)) return null;
  try {
    const bytes = Buffer.from(spki, 'base64url');
    if (bytes.toString('base64url') !== spki) return null;
    const key = createPublicKey({ key: bytes, type: 'spki', format: 'der' });
    return key.asymmetricKeyType === 'ec' && key.asymmetricKeyDetails.namedCurve === 'prime256v1' &&
      key.export({ type: 'spki', format: 'der' }).equals(bytes) ? { key, fingerprint: sha256(bytes) } : null;
  } catch {
    return null;
  }
}

export function leaseBinding({ appId, challengeId, paidEvidence, fingerprint, store, attest }) {
  return sha256(Buffer.from(JSON.stringify([purpose, appId, store, attest, challengeId, sha256(paidEvidence), fingerprint])));
}

export function proofBytes({ target, leaseId, timestamp, requestId }, origin, proofAudience = audience) {
  return Buffer.from(JSON.stringify([proofAudience, 'GET', origin + target, leaseId, timestamp, requestId]));
}

export function verifyProof(request, origin, key, proofAudience = audience) {
  const { signature } = request;
  if (typeof signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(signature)) return false;
  const bytes = Buffer.from(signature, 'base64url');
  return bytes.length === 64 && bytes.toString('base64url') === signature &&
    verify('sha256', proofBytes(request, origin, proofAudience), { key, dsaEncoding: 'ieee-p1363' }, bytes);
}
