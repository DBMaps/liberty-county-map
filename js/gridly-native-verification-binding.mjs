import {storeVerificationRequest} from './gridly-store-verification.mjs';

export const NATIVE_VERIFICATION_PURPOSE = 'gridly-subscription-verification-v1';
const encoder = new TextEncoder();
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function nativeVerificationBinding({challenge, request, crypto=globalThis.crypto}) {
  if(typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) throw Error('native_binding_unavailable');
  const input = storeVerificationRequest(request);
  if(request.productId !== input.productId ||
    (input.platform === 'google' && request.basePlanId !== input.basePlanId) ||
    (input.platform === 'apple' && request.basePlanId !== undefined)) throw Error('native_binding_unavailable');
  const values = input.evidence[input.platform === 'apple' ? 'signedTransactions' : 'purchaseTokens'];
  if(values.length !== 1) throw Error('native_binding_unavailable');
  const evidenceBytes = encoder.encode(JSON.stringify(values));
  const evidenceHash = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', evidenceBytes)));
  const canonical = JSON.stringify([NATIVE_VERIFICATION_PURPOSE, challenge, input.platform, input.environment,
    input.productId, input.platform === 'google' ? input.basePlanId : '', input.nonce,
    input.continuityBinding ?? '', evidenceHash]);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(canonical)));
  return Object.freeze({purpose:NATIVE_VERIFICATION_PURPOSE, digest, requestHash:base64url(digest), evidenceHash});
}
