import { createHash, KeyObject, randomUUID, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isMockTilePng } from './png.mjs';

export const LABELS_AUDIENCE = 'gridly-labels-gateway-mock-v1';
export const LABELS_SCOPE = 'imagery-labels:read';
export const MOCK_ORIGIN = 'https://labels.mock.invalid';
const LEASE_MS = 300_000;
const CHALLENGE_MS = 120_000;
const SKEW_MS = 30_000;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const id = /^[a-zA-Z0-9_-]{1,64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const route = /^\/v1\/imagery-labels\/(0|[1-9][0-9]?)\/(0|[1-9][0-9]{0,5})\/(0|[1-9][0-9]{0,5})$/;
const requestFields = new Set(['method', 'target', 'leaseId', 'timestamp', 'requestId', 'signature', 'signal']);
const fixture = readFileSync(new URL('./mock-tile.png', import.meta.url));
const defaultLimits = Object.freeze({
  installationDaily: 500, lineageDaily: 1000, aggregateDaily: 10_000,
  perMinute: 60, perInstallationActive: 4, aggregateActive: 64,
  maxIdentities: 4096, maxLeases: 1024, maxChallenges: 4096, maxReplayPerLease: 512,
  maxPendingIssuance: 32
});

const error = (status, code) => ({ status, code });
const denied = () => error(401, 'authorization_required');
const limited = () => error(429, 'usage_limit');
const unavailable = () => error(503, 'temporarily_unavailable');
const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;

export function parseTileTarget(target) {
  // Check the raw target. URL parsers can remove dot segments before validation.
  if (typeof target !== 'string' || target.length > 42 || /[^/0-9a-z-]/.test(target)) return null;
  const match = route.exec(target);
  if (!match) return null;
  const [level, row, column] = match.slice(1).map(Number);
  if (level > 19 || row >= 2 ** level || column >= 2 ** level) return null;
  return Object.freeze({ level, row, column });
}

export function publicKeyFingerprint(publicKey) {
  if (!(publicKey instanceof KeyObject) || publicKey.type !== 'public' ||
      publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails.namedCurve !== 'prime256v1') return null;
  return createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('base64url');
}

export function tileProofBytes({ method, target, leaseId, timestamp, requestId }) {
  return Buffer.from(JSON.stringify([LABELS_AUDIENCE, method, MOCK_ORIGIN + target, leaseId, timestamp, requestId]));
}

export function verifyTileProof(publicKey, request) {
  const { signature } = request;
  if (typeof signature !== 'string' || signature.length !== 86 || !/^[a-zA-Z0-9_-]+$/.test(signature)) return false;
  const bytes = Buffer.from(signature, 'base64url');
  if (bytes.length !== 64 || bytes.toString('base64url') !== signature) return false;
  return verify('sha256', tileProofBytes(request), { key: publicKey, dsaEncoding: 'ieee-p1363' }, bytes);
}

// A synchronous reservation is atomic within one JS event loop. No remote or
// multi-process callers share this state.
export function createDailyBudget(limits = defaultLimits) {
  let day = -1, aggregate = 0;
  const installations = new Map(), lineages = new Map();
  return {
    reserve(installation, lineage, time) {
      const utcDay = Math.floor(time / DAY_MS);
      if (utcDay < day) return false;
      if (utcDay > day) {
        day = utcDay;
        aggregate = 0;
        installations.clear();
        lineages.clear();
      }
      const installCount = installations.get(installation) ?? 0;
      const lineageCount = lineages.get(lineage) ?? 0;
      if (aggregate >= limits.aggregateDaily || installCount >= limits.installationDaily ||
          lineageCount >= limits.lineageDaily || (!installCount && installations.size >= limits.maxIdentities) ||
          (!lineageCount && lineages.size >= limits.maxIdentities)) return false;
      installations.set(installation, installCount + 1);
      lineages.set(lineage, lineageCount + 1);
      aggregate++;
      return true;
    },
    get attempts() { return aggregate; },
    get identities() { return installations.size + lineages.size; }
  };
}

export function createMockTileProvider() {
  return async () => ({ status: 200, contentType: 'image/png', body: Buffer.from(fixture) });
}

export function createMockGateway({ environment, verifyPaid, verifyIntegrity, provider = createMockTileProvider(),
  now = Date.now, limits: overrides = {}, timeoutMs = 1000 } = {}) {
  const limits = { ...defaultLimits, ...overrides };
  if (!['production', 'sandbox'].includes(environment) ||
      [verifyPaid, verifyIntegrity, provider, now].some(port => typeof port !== 'function') ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 ||
      Object.keys(limits).some(key => !Object.hasOwn(defaultLimits, key) || !Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > 100_000)) {
    throw new TypeError('Invalid mock gateway configuration');
  }
  const leases = new Map(), challenges = new Map(), ingress = new Map();
  const budget = createDailyBudget(limits);
  let lastTime = -1, nextSweep = 0, active = 0, pendingIssuance = 0;

  function time() {
    const current = now();
    if (!validTime(current) || current < lastTime) throw Error('Clock unavailable');
    lastTime = current;
    if (current >= nextSweep) {
      for (const [key, lease] of leases) if (lease.expiresAt <= current) leases.delete(key);
      for (const [key, expiresAt] of challenges) if (expiresAt <= current) challenges.delete(key);
      for (const [key, entry] of ingress) {
        if (!entry.active && (!entry.arrivals.length || entry.arrivals.at(-1) <= current - MINUTE_MS)) ingress.delete(key);
      }
      nextSweep = current + 1000;
    }
    return current;
  }

  async function issueLease({ environment: requested, paidEvidence, integrityEvidence, publicKey } = {}) {
    try {
      if (requested !== environment || typeof paidEvidence !== 'string' || !id.test(paidEvidence) ||
          typeof integrityEvidence !== 'string' || !id.test(integrityEvidence)) return denied();
      const fingerprint = publicKeyFingerprint(publicKey);
      if (!fingerprint) return denied();
      // Only the trusted mock verifier ports may supply a decision or identity.
      if (pendingIssuance >= limits.maxPendingIssuance) return unavailable();
      pendingIssuance++;
      let results;
      try {
        results = await Promise.allSettled([
          Promise.resolve().then(() => verifyPaid(paidEvidence)),
          Promise.resolve().then(() => verifyIntegrity(integrityEvidence))
        ]);
      } finally { pendingIssuance--; }
      if (results.some(result => result.status === 'rejected')) return unavailable();
      const [paid, integrity] = results.map(result => result.value);
      const issuedAt = time();
      if (paid?.verified !== true || paid.kind !== 'paid_admission' || paid.revoked !== false || paid.environment !== environment ||
          paid.evidenceId !== paidEvidence || typeof paid.lineage !== 'string' || !id.test(paid.lineage) ||
          !validTime(paid.verifiedAt) || paid.verifiedAt > issuedAt || issuedAt - paid.verifiedAt >= LEASE_MS ||
          !validTime(paid.periodEnd) || paid.periodEnd <= issuedAt ||
          integrity?.verified !== true || integrity.environment !== environment || integrity.paidEvidenceId !== paid.evidenceId ||
          typeof integrity.installation !== 'string' || !id.test(integrity.installation) ||
          typeof integrity.challengeId !== 'string' || !id.test(integrity.challengeId) || integrity.keyFingerprint !== fingerprint ||
          !validTime(integrity.verifiedAt) || integrity.verifiedAt > issuedAt || issuedAt - integrity.verifiedAt >= CHALLENGE_MS ||
          challenges.has(integrity.challengeId)) return denied();
      if (leases.size >= limits.maxLeases || challenges.size >= limits.maxChallenges) return unavailable();
      const leaseId = randomUUID();
      const expiresAt = Math.min(paid.periodEnd, paid.verifiedAt + LEASE_MS, issuedAt + LEASE_MS);
      challenges.set(integrity.challengeId, integrity.verifiedAt + CHALLENGE_MS);
      leases.set(leaseId, { publicKey, expiresAt, installation: integrity.installation, lineage: paid.lineage, seen: new Set() });
      return { status: 201, leaseId, audience: LABELS_AUDIENCE, scope: LABELS_SCOPE, environment, issuedAt, expiresAt };
    } catch { return unavailable(); }
  }

  function recordIngress(installation, current) {
    let entry = ingress.get(installation);
    if (!entry) {
      if (ingress.size >= limits.maxIdentities) return null;
      entry = { arrivals: [], active: 0 };
      ingress.set(installation, entry);
    }
    while (entry.arrivals[0] <= current - MINUTE_MS) entry.arrivals.shift();
    if (entry.arrivals.length >= limits.perMinute) return null;
    entry.arrivals.push(current);
    return entry;
  }

  async function runProvider(tile, entry, signal) {
    const controller = new AbortController();
    const combined = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let onAbort;
    const interrupted = new Promise(resolve => {
      onAbort = () => resolve(signal?.aborted ? error(499, 'cancelled') : error(504, 'upstream_timeout'));
      combined.addEventListener('abort', onAbort, { once: true });
      if (combined.aborted) onAbort();
    });
    const work = (async () => {
      try {
        const result = await provider(tile, { signal: combined });
        if (combined.aborted) return signal?.aborted ? error(499, 'cancelled') : error(504, 'upstream_timeout');
        if (result?.status !== 200 || result.redirected || result.contentType !== 'image/png' || !isMockTilePng(result.body)) {
          return error(502, 'upstream_failed');
        }
        return { status: 200, contentType: 'image/png', cacheControl: 'no-store', body: Buffer.from(result.body) };
      } catch {
        if (combined.aborted) return signal?.aborted ? error(499, 'cancelled') : error(504, 'upstream_timeout');
        return error(502, 'upstream_failed');
      } finally {
        // Retain both slots until the provider acknowledges completion, even
        // after a timeout or a caller cancellation has returned to the client.
        entry.active--;
        active--;
      }
    })();
    try { return await Promise.race([work, interrupted]); }
    finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', onAbort);
    }
  }

  async function requestTile(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        Object.keys(request).some(key => !requestFields.has(key))) return error(400, 'invalid_request');
    const { method, target, leaseId, timestamp, requestId, signature, signal } = request;
    if (method !== 'GET') return error(405, 'method_not_allowed');
    const tile = parseTileTarget(target);
    if (!tile) return error(400, 'invalid_tile');
    if (signal !== undefined && !(signal instanceof AbortSignal)) return error(400, 'invalid_request');
    if (signal?.aborted) return error(499, 'cancelled');
    try {
      const current = time();
      if (typeof leaseId !== 'string' || !uuid.test(leaseId)) return denied();
      const lease = leases.get(leaseId);
      if (!lease || lease.expiresAt <= current) return denied();
      if (!validTime(timestamp) || Math.abs(timestamp - current) > SKEW_MS || typeof requestId !== 'string' ||
          !uuid.test(requestId) || !verifyTileProof(lease.publicKey, { method, target, leaseId, timestamp, requestId, signature })) return denied();
      if (lease.seen.has(requestId)) return denied();
      const entry = recordIngress(lease.installation, current);
      if (!entry) return limited();
      if (lease.seen.size >= limits.maxReplayPerLease || entry.active >= limits.perInstallationActive || active >= limits.aggregateActive ||
          !budget.reserve(lease.installation, lease.lineage, current)) return limited();
      lease.seen.add(requestId);
      entry.active++;
      active++;
      const result = await runProvider(tile, entry, signal);
      if (result.status === 200 && (time() >= lease.expiresAt || leases.get(leaseId) !== lease)) return denied();
      return result;
    } catch { return unavailable(); }
  }

  return Object.freeze({ issueLease, requestTile,
    revokeLease: leaseId => leases.delete(leaseId),
    inspect: () => ({ leases: leases.size, challenges: challenges.size, ingress: ingress.size,
      replayIds: [...leases.values()].reduce((count, lease) => count + lease.seen.size, 0),
      quotaIdentities: budget.identities, attemptsToday: budget.attempts, active, pendingIssuance }) });
}
