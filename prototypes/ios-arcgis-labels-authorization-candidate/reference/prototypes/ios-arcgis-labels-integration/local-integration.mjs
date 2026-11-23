import { parseTileTarget } from '../ios-arcgis-labels-gateway/gateway.mjs';

const schemePrefix = 'gridly-label://mock/tile/';

export function schemeTarget(url, method = 'GET') {
  if (method !== 'GET' || typeof url !== 'string' || !url.startsWith(schemePrefix)) return null;
  const target = '/v1/imagery-labels/' + url.slice(schemePrefix.length);
  return parseTileTarget(target) ? target : null;
}

// Host test adapter. The signer lives in the Node test process and is never
// installed into the map VM. The app uses the independent Swift adapter.
export function createLocalSession(scenario, client = scenario.client()) {
  let activeLease, issuing;

  async function issue(options) {
    const result = await scenario.gateway.issueLease(client.evidence(options));
    if (result.status === 201) activeLease = result;
    return result;
  }

  function sign(url, lease, overrides) {
    const target = schemeTarget(url);
    return target && client.request(lease, { target, ...overrides });
  }

  async function load(url, { method = 'GET', signal } = {}) {
    const target = schemeTarget(url, method);
    if (!target) return { status: 400, code: 'invalid_tile' };
    if (signal?.aborted) return { status: 499, code: 'cancelled' };
    if (!activeLease || activeLease.expiresAt <= scenario.now()) {
      issuing ??= issue().finally(() => { issuing = undefined; });
      if ((await issuing).status !== 201) return { status: 401, code: 'authorization_required' };
    }
    return scenario.gateway.requestTile(client.request(activeLease, { target, signal }));
  }

  return Object.freeze({ issue, sign, load });
}
