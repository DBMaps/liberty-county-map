import { maxTileBytes, validTilePng } from './png.mjs';
import { parseTileTarget, safe, unavailable } from './protocol.mjs';

const tokenEndpoint = 'https://www.arcgis.com/sharing/rest/oauth2/token';
const tileEndpoint = 'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile';
const maxTokenBytes = 16_384;
const bearer = /^[A-Za-z0-9._~+\/-]+=*$/;

function rejected(status) {
  if (status === 401 || status === 403) return safe(502, 'provider_authorization');
  if (status === 429) return safe(503, 'provider_throttled');
  return safe(502, 'provider_unavailable');
}

async function boundedBody(response, maximum, signal) {
  const length = response.headers.get('content-length');
  const reader = response.body?.getReader();
  if (!reader) throw Error('missing_body');
  let buffer = Buffer.allocUnsafe(Math.min(8192, maximum));
  let total = 0, done = false;
  try {
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) throw Error('body_limit');
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) {
        done = true;
        return buffer.subarray(0, total);
      }
      if (!part.value.byteLength) continue;
      const size = total + part.value.byteLength;
      if (size > maximum) throw Error('body_limit');
      if (size > buffer.length) {
        const grown = Buffer.allocUnsafe(Math.min(maximum, Math.max(size, buffer.length * 2)));
        buffer.copy(grown, 0, 0, total);
        buffer = grown;
      }
      buffer.set(part.value, total);
      total = size;
    }
  } finally {
    if (!done) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function abandon(response) {
  if (response.body) void response.body.cancel().catch(() => {});
}

async function withinDeadline(timeout, operation, caller, holdUntilSettled = false) {
  const controller = new AbortController();
  const signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), timeout);
  let abort;
  const stopped = new Promise(resolve => {
    abort = () => resolve(caller?.aborted ? safe(499, 'cancelled') : safe(504, 'upstream_timeout'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  const work = Promise.resolve().then(() => {
    signal.throwIfAborted();
    return operation(signal);
  }).catch(() => safe(502, 'provider_unavailable'));
  try {
    const result = await Promise.race([stopped, work]);
    if (!signal.aborted) return result;
    if (holdUntilSettled) await work;
    return caller?.aborted ? safe(499, 'cancelled') : safe(504, 'upstream_timeout');
  }
  finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export function createEsriProvider({ environment = {}, transport, enabled = () => false,
  now = Date.now, tokenTimeout = 2500, tileTimeout = 3000, refreshInterval = 5000 } = {}) {
  for (const value of [tokenTimeout, tileTimeout, refreshInterval]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 30_000) throw TypeError('invalid_provider_deadline');
  }
  let token, refresh, nextRefresh = -Infinity, nextTileAt = -Infinity, lastTime = -Infinity;
  function clock() {
    const time = now();
    if (!Number.isSafeInteger(time) || time < lastTime) throw Error('clock_unavailable');
    lastTime = time;
    return time;
  }
  const allowed = async () => environment.GRIDLY_LABELS_ESRI_ENABLED === 'true' &&
    typeof transport === 'function' && await enabled() === true;

  async function requestToken() {
    const clientId = environment.GRIDLY_LABELS_ESRI_CLIENT_ID;
    const clientSecret = environment.GRIDLY_LABELS_ESRI_CLIENT_SECRET;
    if (![clientId, clientSecret].every(value => typeof value === 'string' && value.length > 0 && value.length <= 2048)) {
      return unavailable();
    }
    return withinDeadline(tokenTimeout, async signal => {
      if (!await allowed()) return unavailable();
      const sentAt = clock();
      const response = await transport(tokenEndpoint, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
      });
      if (response.redirected || response.status !== 200 ||
          response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        abandon(response);
        return rejected(response.status);
      }
      const body = JSON.parse(new TextDecoder('utf-8', { fatal: true })
        .decode(await boundedBody(response, maxTokenBytes, signal)));
      const value = body?.access_token;
      const lifetime = body?.expires_in;
      if (body?.error?.code === 401 || body?.error?.code === 403 || body?.error?.code === 429) return rejected(body.error.code);
      if (body?.error || typeof value !== 'string' || value.length > 4096 || value.trim() !== value || !bearer.test(value) ||
          !Number.isSafeInteger(lifetime) || lifetime < 1 || lifetime > 1_209_600 ||
          (body.token_type !== undefined &&
            (typeof body.token_type !== 'string' || body.token_type.toLowerCase() !== 'bearer'))) {
        return rejected(502);
      }
      const expiresAt = sentAt + lifetime * 1000;
      if (expiresAt <= clock() || !await allowed()) return unavailable();
      return { value, expiresAt, refreshAt: expiresAt - Math.min(60_000, Math.floor(lifetime * 1000 / 5)) };
    }, undefined, true);
  }

  async function accessToken() {
    const time = clock();
    if (token && time < token.refreshAt) return token;
    if (!refresh && time >= nextRefresh) {
      nextRefresh = time + refreshInterval;
      refresh = requestToken().then(result => {
        if (result.value) token = result;
        return result;
      }).finally(() => { refresh = undefined; });
    }
    const result = refresh ? await refresh : unavailable();
    if (result.value) return result;
    // Use an unexpired token during a transient refresh failure only.
    return token && clock() < token.expiresAt &&
      ['provider_unavailable', 'provider_throttled', 'upstream_timeout', 'temporarily_unavailable'].includes(result.code)
      ? token : result;
  }

  return async function tile({ level, row, column }, { signal: caller } = {}) {
    try {
      if (!await allowed()) return unavailable();
      const path = `/v1/imagery-labels/${level}/${row}/${column}`;
      const parsed = parseTileTarget(path);
      if (!parsed || parsed.level !== level || parsed.row !== row || parsed.column !== column) return safe(400, 'invalid_tile');
      // Cancel this caller's wait without cancelling a shared token refresh.
      const authorization = await withinDeadline(tokenTimeout, () => accessToken(), caller);
      if (!authorization.value) return authorization;
      return await withinDeadline(tileTimeout, async signal => {
        if (!await allowed() || clock() >= authorization.expiresAt) return unavailable();
        if (clock() < nextTileAt) return rejected(429);
        signal.throwIfAborted();
        const response = await transport(`${tileEndpoint}/${level}/${row}/${column}`, {
          method: 'GET', redirect: 'error', signal,
          headers: { authorization: `Bearer ${authorization.value}`, accept: 'image/png' }
        });
        if (response.redirected || response.status !== 200 ||
            response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/png') {
          abandon(response);
          if ([401, 403].includes(response.status) && token === authorization) token = undefined;
          if (response.status === 429) {
            const after = response.headers.get('retry-after');
            const wait = after && /^\d{1,5}$/.test(after) ? Math.min(60, Math.max(5, Number(after))) : 5;
            nextTileAt = Math.max(nextTileAt, clock() + wait * 1000);
          }
          return rejected(response.status);
        }
        const body = await boundedBody(response, maxTileBytes, signal);
        if (!validTilePng(body)) return safe(502, 'invalid_provider_image');
        return { status: 200, body };
      }, caller, true);
    } catch {
      return unavailable();
    }
  };
}
