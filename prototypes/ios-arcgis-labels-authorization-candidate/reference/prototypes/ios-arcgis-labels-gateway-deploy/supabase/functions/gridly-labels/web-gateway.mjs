import { randomUUID } from 'node:crypto';
import { audience, denied, environments, identity, leaseBinding, limited, milliseconds,
  purpose, safe, scope, unavailable, uuid } from './foundation/protocol.mjs';
import { validTilePng } from './foundation/png.mjs';
import { p256Key, verifyProof } from './web-proof.mjs';
import { parseTileBody, tilePath } from './tile-wire.mjs';

const leaseTime = 300_000;
const challengeTime = 120_000;
const leaseFields = new Set(['paidEvidence', 'attestEvidence', 'challengeId', 'spki']);
const tileFields = new Set(['method', 'target', 'body', 'leaseId', 'timestamp', 'requestId', 'signature', 'signal']);
const boundedEvidence = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= 20_000;
const exactRecord = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => fields.has(key));
const recent = (value, now, age) => milliseconds(value) && value <= now && now - value < age;
const isId = value => typeof value === 'string' && identity.test(value) && value.trim() === value;
const isUuid = value => typeof value === 'string' && value.length === 36 && uuid.test(value);

function stateError(result) {
  if (result === 'limited') return limited();
  return result === 'denied' ? denied() : unavailable();
}

export function createLabelsGateway({ state, provider, verifyPaid = async () => null, verifyAttest = async () => null,
  origin, appId, now = Date.now, enabled = () => false, timeout = 6000 } = {}) {
  if (!state || typeof provider !== 'function' || typeof appId !== 'string' || !/^[A-Za-z0-9.-]{3,180}$/.test(appId) ||
      new URL(origin).origin !== origin || !origin.startsWith('https://') ||
      !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30_000) throw TypeError('invalid_gateway_configuration');
  let pendingIssuance = 0;
  const allowed = async () => enabled() === true && await state.isEnabled() === true;
  function time() {
    const value = now();
    if (!milliseconds(value)) throw Error('clock_unavailable');
    return value;
  }

  async function issueLease(request, caller) {
    if (!exactRecord(request, leaseFields) || !boundedEvidence(request.paidEvidence) ||
        !boundedEvidence(request.attestEvidence) || !isUuid(request.challengeId)) return denied();
    const { paidEvidence, attestEvidence, challengeId, spki } = request;
    const publicKey = await p256Key(spki);
    if (!publicKey || pendingIssuance >= 32) return publicKey ? limited() : denied();
    pendingIssuance++;
    const deadline = AbortSignal.timeout(timeout);
    const signal = caller ? AbortSignal.any([caller, deadline]) : deadline;
    try {
      if (!await allowed()) return unavailable();
      signal.throwIfAborted();
      const binding = leaseBinding({ appId, challengeId, paidEvidence, fingerprint: publicKey.fingerprint, ...environments });
      const attest = await verifyAttest({ evidence: attestEvidence, binding, purpose, challengeId, appId, signal,
        environment: environments.attest });
      const verifiedAt = time();
      if (attest?.verified !== true || attest.binding !== binding || attest.purpose !== purpose ||
          attest.challengeId !== challengeId || attest.appId !== appId || attest.environment !== environments.attest ||
          !isId(attest.installation) || !recent(attest.verifiedAt, verifiedAt, challengeTime) ||
          !milliseconds(attest.challengeExpiresAt) || attest.challengeExpiresAt <= verifiedAt ||
          attest.challengeExpiresAt > verifiedAt + challengeTime) return denied();
      signal.throwIfAborted();
      const paid = await verifyPaid({ evidence: paidEvidence, environment: environments.store, signal });
      signal.throwIfAborted();
      const issuedAt = time();
      if (paid?.verified !== true || paid.kind !== 'paid_admission' || paid.environment !== environments.store ||
          paid.revoked !== false || !isId(paid.lineage) || !recent(paid.verifiedAt, issuedAt, leaseTime) ||
          !milliseconds(paid.periodEnd) || paid.periodEnd <= issuedAt || attest.challengeExpiresAt <= issuedAt ||
          !recent(attest.verifiedAt, issuedAt, challengeTime)) return denied();
      const expiresAt = Math.min(issuedAt + leaseTime, paid.verifiedAt + leaseTime, paid.periodEnd);
      const id = randomUUID();
      if (!await allowed()) return unavailable();
      signal.throwIfAborted();
      const outcome = await state.issue({ id, spki, expiresAt, installation: attest.installation, lineage: paid.lineage },
        challengeId, attest.challengeExpiresAt, issuedAt);
      return outcome === 'ok'
        ? { status: 201, leaseId: id, issuedAt, expiresAt, audience, scope, ...environments }
        : stateError(outcome);
    } catch {
      return unavailable();
    } finally {
      pendingIssuance--;
    }
  }

  async function runReserved(tile, request) {
    const deadline = new AbortController();
    const signal = request.signal ? AbortSignal.any([request.signal, deadline.signal]) : deadline.signal;
    const timer = setTimeout(() => deadline.abort(), timeout);
    let onAbort;
    const interrupted = new Promise(resolve => {
      onAbort = () => resolve(request.signal?.aborted ? safe(499, 'cancelled') : safe(504, 'upstream_timeout'));
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
    const work = (async () => {
      let result;
      try {
        signal.throwIfAborted();
        if (!await allowed()) result = unavailable();
        else {
          signal.throwIfAborted();
          const fetched = await provider(tile, { signal });
          if (fetched?.status === 200 && validTilePng(fetched.body)) result = { status: 200, body: fetched.body };
          else if (fetched?.status === 504) result = safe(504, 'upstream_timeout');
          else if (fetched?.status === 503) result = unavailable();
          else result = safe(502, 'upstream_failed');
        }
      } catch {
        result = unavailable();
      }
      // Keep both slots until the transport settles, including on cancellation.
      const finish = await state.finish(request.leaseId, request.requestId, time());
      if (signal.aborted) return request.signal?.aborted ? safe(499, 'cancelled') : safe(504, 'upstream_timeout');
      if (result.status !== 200) return result;
      return finish === 'ok' && await allowed() ? result : denied();
    })().catch(unavailable);
    try { return await Promise.race([work, interrupted]); }
    finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }

  async function requestTile(request) {
    if (!exactRecord(request, tileFields)) return safe(400, 'invalid_request');
    if (request.method !== 'POST') return safe(405, 'method_not_allowed');
    const tile = request.target === tilePath && parseTileBody(request.body);
    if (!tile) return safe(400, 'invalid_tile');
    if (request.signal !== undefined && !(request.signal instanceof AbortSignal)) return safe(400, 'invalid_request');
    if (request.signal?.aborted) return safe(499, 'cancelled');
    try {
      if (!await allowed()) return unavailable();
      if (!isUuid(request.leaseId) || !isUuid(request.requestId) || !milliseconds(request.timestamp)) return denied();
      const lease = await state.get(request.leaseId);
      const current = time();
      const key = lease && !lease.revoked && lease.expiresAt > current && await p256Key(lease.spki);
      if (!key || Math.abs(request.timestamp - current) > 30_000 || !await verifyProof(request, origin, key.key)) return denied();
      if (request.signal?.aborted) return safe(499, 'cancelled');
      const outcome = await state.reserve(request.leaseId, request.requestId, current);
      return outcome === 'ok' ? await runReserved(tile, request) : stateError(outcome);
    } catch {
      return unavailable();
    }
  }
  return Object.freeze({ issueLease, requestTile });
}
