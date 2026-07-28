const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const clientSource = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const qualitySource = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');

const response = (status, payload, headers = {}) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => payload,
  headers: { get: (name) => headers[name] || null }
});
const canonical = (overrides = {}) => ({ ok: true, status: 'success', providerBoundary: 'gridly', cached: false, requestId: 'runtime-test', results: [], ...overrides });

async function scenario(fetchImpl) {
  const window = { URL, crypto: { randomUUID: () => 'runtime-test' }, fetch: fetchImpl };
  vm.runInNewContext(clientSource, { window, URL, fetch: fetchImpl, Object, Set, Date, JSON, Number, String, Array, Boolean });
  vm.runInNewContext(qualitySource, { window, Object, Set, RegExp, String, Number, Array, Boolean });
  const result = await window.gridlyGeocodingClient.search({ intent: 'address', query: 'redacted by test harness', limit: 5 });
  return { window, result, audit: window.gridlyLp101BrowserCertification(), evidence: window.gridlyGeocodingClient.evidence() };
}

(async () => {
  let run = await scenario(async () => response(200, canonical()));
  assert.equal(run.result.ok, true);
  assert.equal(run.audit.safeToMerge, true);
  assert.equal(run.audit.canonicalSuccessResponseObserved, true);

  run = await scenario(async () => response(200, canonical({ ok: false, status: 'no_results', retryAfterSeconds: null })));
  assert.equal(run.audit.canonicalFailureResponseObserved, true);
  assert.equal(run.audit.safeToMerge, true, 'canonical no-result over HTTP 200 is valid runtime evidence');

  for (const [status, payload, failureCode] of [
    [403, canonical({ ok: false, status: 'invalid_request' }), 'invalid_request'],
    [401, canonical({ ok: false, status: 'invalid_request' }), 'client_unauthorized'],
    [404, { message: 'not found' }, 'function_missing'],
    [429, canonical({ ok: false, status: 'rate_limited', retryAfterSeconds: 30 }), 'rate_limited'],
    [503, canonical({ ok: false, status: 'provider_unavailable' }), 'edge_server_error'],
    [200, { ok: true, results: [] }, 'malformed_response']
  ]) {
    run = await scenario(async () => response(status, payload, { 'Retry-After': '30' }));
    assert.equal(run.audit.safeToMerge, false, `HTTP ${status} must fail certification`);
    assert.equal(run.evidence[0].failureCode, failureCode);
  }

  run = await scenario(async () => { throw new Error('offline'); });
  assert.equal(run.audit.safeToMerge, false);
  assert.equal(run.evidence[0].failureCode, 'network_failure');
  assert.deepEqual(Object.keys(run.evidence[0]).sort(), [
    'canonicalFailure', 'canonicalSuccess', 'directProviderRequestDetected', 'endpointOrigin', 'failureCode', 'functionSlug',
    'httpStatus', 'intentType', 'providerBoundaryUsed', 'requestSucceeded', 'requestType', 'timestamp'
  ]);
  assert.doesNotMatch(JSON.stringify(run.evidence), /redacted by test harness/);
  assert.equal(run.window.gridlyGeocodingClient.directProviderRequestCount(), 0);

  assert.match(edge, /status: 200, headers: cors\(origin\)/);
  assert.match(app, /truthfulResults = boundaryFailed && explicitRemoteIntent/);
  assert.match(app, /Search is temporarily unavailable\. Please try again\./);
  assert.match(app, /seedSource === "lp097_governed_curated"/);
  assert.doesNotMatch(app, /fetch\(`https:\/\/nominatim\.openstreetmap\.org\/search/);
  console.log('LP101.1 geocoding runtime recovery contracts passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
