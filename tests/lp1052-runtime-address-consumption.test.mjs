import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupLibertyCertifiedAddress } from '../supabase/functions/_shared/liberty-certified-address.mjs';
import { applyGovernedRoadOnlyAcceptance, governedRoadOnlyRequest } from '../supabase/functions/_shared/governed-road-only-acceptance.mjs';

const root = new URL('../', import.meta.url);
let packageAccesses = 0;
const fixtureStorage = {
  from(bucket) { return { download: async (objectPath) => {
    if (bucket !== 'certified-addresses') return { data: null, error: { statusCode: 404 } };
    if (objectPath.endsWith('.gz')) packageAccesses += 1;
    try { return { data: new Blob([await readFile(new URL(`data/generated/${objectPath}`, root))]), error: null }; }
    catch { return { data: null, error: { statusCode: 404 } }; }
  } }; }
};
const request = (query, overrides = {}) => ({ intent: 'address', query, limit: 5, requestMode: 'explicit_search', ...overrides });
const lookup = (query, overrides) => lookupLibertyCertifiedAddress(request(query, overrides), { storage: fixtureStorage });
const candidate = (overrides = {}) => ({ name: 'County Road 677', resultType: 'road', type: 'road', precision: 'road',
  sourceClassification: 'primary_geocoder', address: { houseNumber: '', road: 'County Road 677' }, ...overrides });

test('road-only acceptance rejects residential promotion from fresh and cached fallback while retaining roads and truthful misses', () => {
  const roadOnly = request('County Road 677, Dayton, TX');
  assert.equal(governedRoadOnlyRequest(roadOnly), true);
  const promoted = candidate({ name: '677 County Road 6681', resultType: 'address', type: 'house', precision: 'address_point',
    address: { houseNumber: '677', road: 'County Road 6681' } });
  for (const source of ['fresh provider', 'fallback cache']) {
    const governed = applyGovernedRoadOnlyAcceptance(roadOnly, [promoted]);
    assert.deepEqual(governed.results, [], `${source} residential response must not escape acceptance`);
    assert.equal(governed.residentialRejected, true);
  }
  assert.deepEqual(applyGovernedRoadOnlyAcceptance(roadOnly, [candidate()]).results, [candidate()],
    'a matching road feature remains acceptable');
  assert.deepEqual(applyGovernedRoadOnlyAcceptance(roadOnly, []).results, [], 'truthful no-result remains acceptable');
  assert.deepEqual(applyGovernedRoadOnlyAcceptance(roadOnly, [candidate({ address: { houseNumber: '', road: 'County Road 6681' } })]).results, [],
    'an unrelated numbered road is not promoted as the requested corridor');
});

test('road-only governance is narrow and preserves numbered-road, exact-address, and business intent', () => {
  assert.equal(governedRoadOnlyRequest(request('US 90, Dayton, TX')), true);
  const highway = candidate({ name: 'US 90', address: { houseNumber: '', road: 'US Highway 90' } });
  assert.deepEqual(applyGovernedRoadOnlyAcceptance(request('US 90, Dayton, TX'), [highway]).results, [highway]);
  assert.equal(governedRoadOnlyRequest(request('276 County Road 677, Dayton, TX 77535')), false);
  assert.equal(governedRoadOnlyRequest(request('Dayton Walmart', { intent: 'business_place' })), false);
});

test('certified Liberty lookup is exact across governed road aliases', async () => {
  for (const alias of ['County Road 677', 'County Rd 677', 'CR 677', 'Co Rd 677']) {
    const result = await lookup(`276 ${alias}, Dayton, TX 77535`);
    assert.equal(result.outcome, 'exact_match');
    assert.equal(result.results[0].address.houseNumber, '276');
    assert.equal(result.results[0].address.county, 'Liberty');
    assert.equal(result.results[0].routePreviewEligible, true);
    assert.ok(result.lookupMs >= 0 && result.totalMs >= result.lookupMs);
  }
});

test('source-conflict, proven-absent, road-only, and conflicting requests fail truthfully without substitution', async () => {
  const sourceConflict = await lookup('274 County Road 677, Dayton, TX 77535');
  assert.equal(sourceConflict.outcome, 'truthful_no_result');
  assert.deepEqual(sourceConflict.results, []);
  const missing = await lookup('275 County Road 677, Dayton, TX 77535');
  assert.equal(missing.outcome, 'truthful_no_result');
  assert.deepEqual(missing.results, []);
  assert.equal((await lookup('County Road 677, Dayton, TX')).attempted, false);
  for (const query of ['276 County Road 677, Austin, TX 78701', '276 County Road 677, Liberty County, TX 77535']) {
    assert.equal((await lookup(query)).attempted, false);
  }
  assert.equal((await lookup('276 County Road 677, Dayton, TX 77535', { context: { countyFips: '48201' } })).attempted, false);
});

test('business, curated, and non-Liberty traffic never accesses the package', async () => {
  const before = packageAccesses;
  assert.equal((await lookupLibertyCertifiedAddress({ intent: 'business_place', query: 'Dayton Walmart' }, { storage: fixtureStorage })).attempted, false);
  assert.equal((await lookup('100 Congress Avenue, Austin, TX 78701')).attempted, false);
  assert.equal(packageAccesses, before);
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /GRIDLY_LP097_CURATED_DESTINATIONS/);
});

test('missing or invalid certificate fails closed and browser retains provider boundary', async () => {
  const unavailable = await lookupLibertyCertifiedAddress(request('276 County Road 677, Dayton, TX 77535'), { storage: null });
  assert.equal(unavailable.outcome, 'package_unavailable');
  assert.equal(unavailable.packageAccessed, false);
  const invalidStorage = { from: () => ({ download: async () => ({ data: new Blob([JSON.stringify({ countyId: 'liberty-tx' })]), error: null }) }) };
  const invalid = await lookupLibertyCertifiedAddress(request('276 County Road 677, Dayton, TX 77535'), { storage: invalidStorage });
  assert.equal(invalid.outcome, 'package_unavailable');
  assert.equal(invalid.packageAccessed, false, 'certificate rejection occurs before the gzip package is opened');
  assert.equal(invalid.runtimeDiagnostic.lastCompletedStage, 'runtime_certificate_retrieved');
  assert.equal(invalid.runtimeDiagnostic.failureStage, 'certificate_validated');
  assert.equal(invalid.runtimeDiagnostic.certificateValidated, false);
  assert.equal(invalid.runtimeDiagnostic.packageOpened, false);
  const client = await readFile(new URL('../js/gridly-geocoding-client.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(client, /functions\/v1\/gridly-geocode/);
  assert.doesNotMatch(html, /lp1045-txgio-address-runtime\.js/);
});

test('runtime diagnostics identify every completed certified lookup stage without request data', async () => {
  const exact = await lookup('276 County Road 677, Dayton, TX 77535');
  assert.deepEqual(exact.runtimeDiagnostic.completedStages, [
    'browser_request_received', 'eligible_for_certified_provider', 'storage_bucket_selected',
    'runtime_certificate_requested', 'runtime_certificate_retrieved', 'certificate_validated',
    'liberty_package_requested', 'liberty_package_retrieved', 'package_integrity_validated', 'gzip_stream_opened',
    'exact_lookup_executed', 'exact_match_found'
  ]);
  assert.equal(exact.runtimeDiagnostic.lastCompletedStage, 'exact_match_found');
  assert.equal(exact.runtimeDiagnostic.failureStage, null);
  assert.equal(exact.runtimeDiagnostic.certifiedProviderExecuted, true);
  assert.equal(exact.runtimeDiagnostic.certificateValidated, true);
  assert.equal(exact.runtimeDiagnostic.packageOpened, true);
  assert.equal(exact.runtimeDiagnostic.exactLookupExecuted, true);
  assert.equal(exact.runtimeDiagnostic.storageBucket, 'certified-addresses');
  assert.equal(exact.runtimeDiagnostic.certificateObjectPath, 'lp104/txgio-addresses/liberty-48291.runtime-certificate.json');
  assert.equal(exact.runtimeDiagnostic.packageObjectPath, 'lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz');
  assert.equal(exact.runtimeDiagnostic.storageStatusCategory, 'success');
  assert.equal(exact.runtimeDiagnostic.certificateFetchCompleted, true);
  assert.equal(exact.runtimeDiagnostic.certificateFetchReason, 'successful_retrieval');
  assert.doesNotMatch(JSON.stringify(exact.runtimeDiagnostic), /276|County Road|Dayton|77535/);
});

test('Storage failures are bounded, private, and fail closed', async () => {
  const eligible = request('276 County Road 677, Dayton, TX 77535');
  for (const [status, category] of [[404, 'not_found'], [403, 'authorization_failure'], [500, 'server_error']]) {
    const storage = { from: () => ({ download: async () => ({ data: null, error: { statusCode: status } }) }) };
    const result = await lookupLibertyCertifiedAddress(eligible, { storage });
    assert.equal(result.outcome, 'package_unavailable');
    assert.equal(result.runtimeDiagnostic.storageStatusCategory, category);
    assert.equal(result.runtimeDiagnostic.certificateFetchReason, category);
  }
  const network = await lookupLibertyCertifiedAddress(eligible, { storage: { from: () => ({ download: async () => { throw new TypeError('secret connection detail'); } }) } });
  assert.equal(network.runtimeDiagnostic.certificateFetchCompleted, false);
  assert.equal(network.runtimeDiagnostic.certificateFetchReason, 'storage_network_failure');
  assert.doesNotMatch(JSON.stringify(network.runtimeDiagnostic), /secret|credential|authorization/i);
  const timeout = await lookupLibertyCertifiedAddress(eligible, { certificateTimeoutMs: 1,
    storage: { from: () => ({ download: async () => new Promise(() => {}) }) } });
  assert.equal(timeout.runtimeDiagnostic.certificateFetchCompleted, false);
  assert.equal(timeout.runtimeDiagnostic.certificateFetchReason, 'timeout');
  const invalid = await lookupLibertyCertifiedAddress(eligible, { storage: { from: () => ({ download: async () => ({ data: new Blob(['{}']), error: null }) }) } });
  assert.equal(invalid.runtimeDiagnostic.certificateFetchCompleted, true);
  assert.equal(invalid.runtimeDiagnostic.certificateFetchReason, 'invalid_certificate');
});

test('missing package and package integrity mismatch fail closed after certificate validation', async () => {
  const certificate = await readFile(new URL('data/generated/lp104/txgio-addresses/liberty-48291.runtime-certificate.json', root));
  for (const packageResult of [{ data: null, error: { statusCode: 404 } }, { data: new Blob(['wrong bytes']), error: null }]) {
    const storage = { from: () => ({ download: async (path) => path.endsWith('.json')
      ? { data: new Blob([certificate]), error: null } : packageResult }) };
    const result = await lookupLibertyCertifiedAddress(request('276 County Road 677, Dayton, TX 77535'), { storage });
    assert.equal(result.outcome, 'package_unavailable');
    assert.equal(result.runtimeDiagnostic.certificateValidated, true);
    assert.equal(result.runtimeDiagnostic.packageOpened, false);
  }
});

test('eligible certified requests bypass stale fallback cache and never continue after provider failure', async () => {
  const edge = await readFile(new URL('../supabase/functions/gridly-geocode/index.ts', import.meta.url), 'utf8');
  const execute = edge.slice(edge.indexOf('async function execute('), edge.indexOf('\nDeno.serve('));
  const certifiedLookup = execute.indexOf('lookupLibertyCertifiedAddress(');
  const cacheLookup = execute.indexOf('gridly_geocode_cache');
  const unavailableGuard = execute.indexOf('if (certified.attempted)');
  const primaryProvider = execute.indexOf('gridly_reserve_geocode_provider_slot');
  assert.ok(certifiedLookup >= 0 && certifiedLookup < cacheLookup,
    'the certified provider executes before a response produced by an older fallback can be returned');
  assert.ok(unavailableGuard > certifiedLookup && unavailableGuard < cacheLookup,
    'an eligible certified request fails closed before cache or fallback when its package is unavailable');
  assert.ok(cacheLookup < primaryProvider, 'ineligible traffic retains the existing cache and provider path');
  assert.match(execute, /certifiedProviderRejectionReason/);
  assert.match(execute, /runtimeAddressDiagnostics\("certified_provider_unavailable"\)/);
  assert.match(execute, /runtimeAddressDiagnostics\(governed\.results\.length \? "fallback_cache" : "fallback_cache_no_result", true\)/);
  assert.ok(execute.indexOf('applyGovernedRoadOnlyAcceptance(body, Array.isArray(cached.response?.results)') > cacheLookup,
    'cached fallback results pass through the same road-only acceptance boundary');
  assert.ok(execute.indexOf('applyGovernedRoadOnlyAcceptance(body, results)') > primaryProvider,
    'fresh primary results pass through the road-only acceptance boundary');
  assert.match(execute, /residential_promotion_rejected/);
});

test('browser exposes an async, console-only LP105.2 runtime certification helper', async () => {
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  const helper = app.match(/window\.gridlyLp1052RuntimeAddressCertification\s*=\s*async function[\s\S]*?\n};/);
  assert.ok(helper, 'async certification helper is exposed on window');
  for (const caseName of ['exact', 'missing_nearby_number', 'alias_county_rd', 'alias_cr', 'alias_co_rd', 'road_only', 'business_control']) {
    assert.match(helper[0], new RegExp(`\\["${caseName}"`));
  }
  assert.match(helper[0], /client\.search\(\{ intent, query, limit: 5, requestMode: "explicit_search" \}\)/);
  assert.match(helper[0], /passed, safeToMerge: passed/);
  for (const field of ['lastCompletedStage', 'failureStage', 'responseSource', 'certifiedProviderExecuted',
    'certificateValidated', 'packageOpened', 'exactLookupExecuted', 'fallbackExecuted', 'certificateUrl',
    'certificateHttpStatus', 'certificateFetchCompleted', 'certificateFetchReason', 'storageBucket',
    'certificateObjectPath', 'packageObjectPath', 'storageStatusCategory']) assert.match(helper[0], new RegExp(field));
  for (const field of ['roadOnlyRequest', 'roadOnlyResidentialRejected', 'fallbackAcceptanceOutcome']) assert.match(helper[0], new RegExp(field));
  assert.doesNotMatch(helper[0], /fetch\s*\(/, 'helper must retain the Gridly client boundary');
  assert.doesNotMatch(helper[0], /data\/generated\/lp104|\.jsonl\.gz|lp1045-txgio-address-runtime/i,
    'browser must not load LP104 packages directly');
});

test('browser client exposes only the bounded LP105.5 runtime diagnostic contract', async () => {
  const client = await readFile(new URL('../js/gridly-geocoding-client.js', import.meta.url), 'utf8');
  assert.match(client, /runtimeAddressDiagnostics/);
  assert.match(client, /completedStages\.slice\(0, 16\)/);
  assert.match(client, /storageBucket:[\s\S]*slice\(0, 63\)/);
  assert.match(client, /certificateObjectPath:[\s\S]*slice\(0, 512\)/);
  assert.match(client, /roadOnlyResidentialRejected: runtime\.roadOnlyResidentialRejected === true/);
  assert.doesNotMatch(client, /runtime\.query|runtime\.baseUrl|runtime\.packageUrl/);
  const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /window\.gridlyLp1055RuntimeAddressCertification = window\.gridlyLp1052RuntimeAddressCertification/);
});

test('eligible Liberty runtime has no external artifact host dependency', async () => {
  const edge = await readFile(new URL('../supabase/functions/gridly-geocode/index.ts', import.meta.url), 'utf8');
  const adapter = await readFile(new URL('../supabase/functions/_shared/liberty-certified-address.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(edge.slice(edge.indexOf('async function execute('), edge.indexOf('\nDeno.serve(')), /GRIDLY_CERTIFIED_ADDRESS_BASE_URL|https:\/\/gridly\.app/);
  assert.doesNotMatch(adapter, /fetch\s*\(|signedUrl|createSignedUrl|gridly\.app/);
  assert.match(edge, /GRIDLY_CERTIFIED_ADDRESS_BUCKET/);
});
