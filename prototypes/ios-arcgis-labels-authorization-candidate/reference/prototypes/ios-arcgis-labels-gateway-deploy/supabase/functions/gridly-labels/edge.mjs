import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createLabelsGateway } from './web-gateway.mjs';
import { createEsriProvider } from './foundation/esri.mjs';
import { denied, leasePath, purpose, safe, unavailable, uuid } from './foundation/protocol.mjs';
import { maxTileBody, tilePath } from './tile-wire.mjs';

export const prefix = '/functions/v1/gridly-labels';
const challengePath = '/v1/labels/challenge';
const headers = ['lease', 'timestamp', 'request', 'signature'].map(name => 'x-gridly-labels-' + name);
const appId = 'com.gridlygo.prototype.labeltiles.pilot';
const maxLeaseBytes = 48 * 1024;

function respond(result) {
  const { status, body, ...data } = result;
  const image = status === 200 && body instanceof Uint8Array;
  return new Response(image ? body : JSON.stringify(data), {
    status: status === 499 ? 408 : status,
    headers: { 'content-type': image ? 'image/png' : 'application/json; charset=utf-8',
      'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function outcome(status) {
  return ({ 200: 'ok', 201: 'ok', 401: 'authorization_denied', 429: 'quota_exhausted',
    502: 'provider_failed', 504: 'provider_timeout', 503: 'unavailable', 408: 'cancelled' })[status] ?? 'invalid';
}

async function boundedBody(request, signal, maximum) {
  if (request.headers.has('content-encoding') || !request.body) throw Error('invalid_body');
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const buffer = new Uint8Array(maximum);
    let size = 0;
    for (;;) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) break;
      if (size + part.value.length > buffer.length) throw Error('body_limit');
      buffer.set(part.value, size);
      size += part.value.length;
    }
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: maximum === maxTileBody }).decode(buffer.subarray(0, size));
  } finally {
    cancel();
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

export function createEdgeHandler({ config, state, admission, transport, now = Date.now }) {
  let inFlight = 0;
  const enabled = () => config.enabled === true &&
    typeof admission?.verifyPaid === 'function' && typeof admission?.verifyAttest === 'function';
  const provider = createEsriProvider({
    environment: config.provider, transport: typeof transport === 'function' ? async (url, init) => {
      if (init.method === 'POST' && await state.reserveOAuth() !== true) return new Response(null, { status: 429 });
      init.signal.throwIfAborted();
      if (typeof state.record === 'function') {
        await state.record(init.method === 'POST' ? 'oauth_dispatch_intent' : 'tile_dispatch_intent', 0);
        if (await state.isEnabled() !== true) return new Response(null, { status: 503 });
        init.signal.throwIfAborted();
      }
      return transport(url, init);
    } : undefined, now, tokenTimeout: config.tokenTimeout,
    tileTimeout: config.tileTimeout, refreshInterval: config.refreshInterval,
    enabled: async () => enabled() && await state.isEnabled() === true
  });
  const gateway = createLabelsGateway({ state, provider, origin: config.origin, appId, enabled,
    timeout: config.timeout, now, verifyPaid: admission?.verifyPaid, verifyAttest: admission?.verifyAttest });

  return async request => {
    const url = new URL(request.url);
    // Supabase's hosted router can remove /functions/v1 before invoking Deno.
    const routePrefix = url.pathname.startsWith(prefix + '/') ? prefix : '/gridly-labels';
    const path = url.pathname.slice(routePrefix.length);
    if (request.url !== url.origin + routePrefix + path || !url.pathname.startsWith(routePrefix + '/')) {
      return respond(safe(404, 'not_found'));
    }
    if (path === '/health' && request.method === 'GET') return respond(safe(200, 'reachable'));
    const lease = path === leasePath, challenge = path === challengePath, tile = path === tilePath;
    if (!lease && !challenge && !tile) return respond(safe(404, 'not_found'));
    if (request.method !== 'POST') return respond(safe(405, 'method_not_allowed'));
    if (!enabled()) return respond(unavailable());
    const ingressKey = request.headers.get('x-gridly-pilot-ingress');
    if (typeof ingressKey !== 'string' || !/^[a-f0-9]{64}$/.test(ingressKey) || ingressKey.length !== 64 ||
        !/^[a-f0-9]{64}$/.test(config.ingressKey ?? '') || config.ingressKey.length !== 64 ||
        !timingSafeEqual(Buffer.from(ingressKey), Buffer.from(config.ingressKey))) return respond(safe(401, 'authorization_required'));
    if ((challenge && request.body !== null) || (tile && headers.some(name => {
      const value = request.headers.get(name);
      return !value || value.length > 86 || value.includes(',');
    }))) return respond(safe(400, 'invalid_request'));
    if (inFlight >= config.maxInFlight) return respond(safe(429, 'usage_limit'));
    inFlight++;
    const started = performance.now();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.timeout)]);
    let stop;
    const deadline = new Promise(resolve => {
      stop = () => resolve(respond(safe(request.signal.aborted ? 499 : 504, 'request_interrupted')));
      if (signal.aborted) stop();
      else signal.addEventListener('abort', stop, { once: true });
    });
    const work = (async () => {
      signal.throwIfAborted();
      if (await state.ingress() !== 'ok') return respond(safe(429, 'usage_limit'));
      signal.throwIfAborted();
      if (challenge) {
        if (!await state.isEnabled()) return respond(unavailable());
        const id = randomUUID();
        const expiry = await state.challenge(id);
        return respond(expiry ? { status: 201, challengeId: id, expiresAt: expiry, purpose } : unavailable());
      }
      if (lease) {
        let evidence;
        try {
          if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw Error('invalid_body');
          evidence = JSON.parse(await boundedBody(request, signal, maxLeaseBytes));
        }
        catch { return respond(safe(400, 'invalid_request')); }
        const id = evidence?.challengeId;
        if (typeof id !== 'string' || id.length !== 36 || !uuid.test(id) || await state.pending(id) !== true) {
          return respond(denied());
        }
        signal.throwIfAborted();
        return respond(await gateway.issueLease(evidence, signal));
      }
      const [leaseId, stamp, requestId, signature] = headers.map(name => request.headers.get(name));
      if (!uuid.test(leaseId) || leaseId.length !== 36 || !uuid.test(requestId) || requestId.length !== 36 ||
          String(Number(stamp)) !== stamp) return respond(safe(400, 'invalid_request'));
      let body;
      try {
        if (request.headers.get('content-type') !== 'application/json') throw Error('invalid_body');
        body = await boundedBody(request, signal, maxTileBody);
      } catch {
        return respond(safe(400, 'invalid_request'));
      }
      const result = await gateway.requestTile({ method: request.method, target: path, body, leaseId,
        timestamp: Number(stamp), requestId, signature, signal });
      return respond(result.status === 200 && result.body.length > config.maxBytes ? safe(502, 'upstream_failed') : result);
    })().catch(() => respond(unavailable()));
    try { return await Promise.race([deadline, work]); }
    finally {
      signal.removeEventListener('abort', stop);
      // Keep the local slot until the handler's work settles. Metrics are
      // best-effort and never contain request values.
      void work.then(async result => {
        if (typeof state.record === 'function') {
          const status = signal.aborted ? (request.signal.aborted ? 408 : 504) : result.status;
          await state.record(outcome(status), Math.min(10_000, Math.round(performance.now() - started)));
        }
      }).catch(() => {}).finally(() => { inFlight--; });
    }
  };
}
