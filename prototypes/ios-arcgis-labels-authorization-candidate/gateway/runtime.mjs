import { createPostgresState } from './foundation/state.mjs';
import { createEdgeHandler } from './edge.mjs';

// Only reviewed server modules may supply these ports. An unwired deployment
// must remain closed even if every operator enable flag has been set.
export function admissionPorts({ apple, attest } = {}) {
  if (typeof apple !== 'function' || typeof attest !== 'function') return undefined;
  return Object.freeze({ verifyPaid: input => apple(input), verifyAttest: input => attest(input) });
}

export function readConfig(get) {
  const ref = get('GRIDLY_LABELS_PROJECT_REF');
  const project = get('SUPABASE_URL');
  if (!/^[a-z]{20}$/.test(ref ?? '') || project !== `https://${ref}.supabase.co` ||
      ref === 'nhwhkbkludzkuyxmkkcj') throw Error('invalid_pilot_project');
  function number(name, fallback, min, max) {
    const value = get('GRIDLY_LABELS_' + name);
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isSafeInteger(n) || String(n) !== value || n < min || n > max) throw Error('invalid_pilot_limit');
    return n;
  }
  const timeout = number('TIMEOUT_MS', 6000, 1000, 10000);
  const tokenTimeout = number('TOKEN_TIMEOUT_MS', 2000, 100, timeout);
  const tileTimeout = number('TILE_TIMEOUT_MS', 3000, 100, timeout);
  if (tokenTimeout + tileTimeout >= timeout) throw Error('invalid_pilot_deadlines');
  const dsn = get('GRIDLY_LABELS_DATABASE_URL');
  if (dsn) {
    const url = new URL(dsn);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.username !== 'label_pilot_runtime' ||
        !url.password || url.hostname !== `db.${ref}.supabase.co` || !['', '5432'].includes(url.port) ||
        url.pathname !== '/postgres' || url.search || url.hash) throw Error('invalid_pilot_database');
  }
  const enabled = get('GRIDLY_LABELS_PILOT_ENABLED') === 'true';
  const origin = get('GRIDLY_LABELS_PUBLIC_ORIGIN') ?? project;
  const ingressKey = get('GRIDLY_LABELS_INGRESS_KEY');
  if (enabled && (!dsn || !/^[a-f0-9]{64}$/.test(ingressKey ?? '') || ingressKey.length !== 64 ||
      !origin.startsWith('https://') || new URL(origin).origin !== origin || origin === project)) {
    throw Error('invalid_pilot_ingress');
  }
  return { origin, dsn, enabled, ingressKey,
    timeout, tokenTimeout, tileTimeout, refreshInterval: number('REFRESH_INTERVAL_MS', 5000, 1000, 30000),
    maxInFlight: number('MAX_IN_FLIGHT', 32, 1, 64),
    maxBytes: number('MAX_TILE_BYTES', 524288, 1024, 524288),
    provider: {
      GRIDLY_LABELS_ESRI_ENABLED: get('GRIDLY_LABELS_ESRI_ENABLED'),
      GRIDLY_LABELS_ESRI_CLIENT_ID: get('GRIDLY_LABELS_ESRI_CLIENT_ID'),
      GRIDLY_LABELS_ESRI_CLIENT_SECRET: get('GRIDLY_LABELS_ESRI_CLIENT_SECRET')
    }
  };
}

export function databaseState(query) {
  const original = createPostgresState(query);
  const call = async (sql, values = []) => (await query(sql, values)).rows[0]?.result;
  const { revoke: _adminOnly, ...runtime } = original;
  return { ...runtime, issue: (lease, challenge, expiry, now) =>
    call('select label_pilot.admit($1,$2,$3,$4) as result', [JSON.stringify(lease), challenge, expiry, now]),
    challenge: async id => {
      const expiry = Number(await call('select label_pilot.new_challenge($1) as result', [id]));
      return Number.isSafeInteger(expiry) && expiry > 0 ? expiry : null;
    },
    pending: id => call('select label_pilot.challenge_is_pending($1) as result', [id]),
    record: (outcome, ms) => call('select label_pilot.record_outcome($1,$2) as result', [outcome, ms]),
    ingress: () => call('select label_pilot.preflight() as result'),
    reserveOAuth: () => call('select label_pilot.reserve_oauth() as result') };
}

export function createRuntime({ get, connect, admission, transport }) {
  try {
    const config = readConfig(get);
    // Do not even open a database connection for an unwired or disabled function.
    const state = config.enabled && admission?.verifyPaid && admission?.verifyAttest && config.dsn
      ? databaseState(connect(config.dsn)) : { isEnabled: () => false };
    return createEdgeHandler({ config, state, admission, transport });
  } catch {
    return () => new Response('{"code":"temporarily_unavailable"}', {
      status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
}
