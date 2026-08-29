import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../js/gridlyPoiBrowserProvider.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
function runtime(overrides = {}) { const context = { console, TextDecoder, Response, Blob, DecompressionStream, crypto: globalThis.crypto, fetch: async () => { throw new Error('network disabled'); }, ...overrides }; context.globalThis = context; vm.runInNewContext(source, context); return context; }
const manifest = JSON.parse(fs.readFileSync(new URL('../poi/lp24111-d5-standalone-2026-08-28/runtime-v2/manifest.json', import.meta.url)));

test('gate defaults OFF and does not fetch', async () => { let fetched = false; const ctx = runtime({ fetch: async () => { fetched = true; } }); assert.equal(ctx.gridlyPoiBrowserRehearsalAudit().gateEnabled, false); await assert.rejects(ctx.GridlyPoiBrowserProvider.initialize, /NON_PRODUCTION_GATE_OFF/); assert.equal(fetched, false); });
test('certified manifest and bounded candidate selection pass', () => { const api = runtime().GridlyPoiBrowserProvider; api._test.validateManifest(manifest); for (const radiusMiles of [5, 10, 25]) assert.ok(api._test.candidateShardIds(manifest, { latitude: 32.7767, longitude: -96.797, radiusMiles }).length <= 4); });
test('release, schema, attribution, and fanout mismatches fail closed', () => { const api = runtime().GridlyPoiBrowserProvider; for (const mutate of [m => m.authorityReleaseId = 'wrong', m => m.runtimeSchemaVersion = 'v1', m => m.legalBinding.target = 'missing', m => m.maxCandidateShards25Mi = 5]) { const copy = structuredClone(manifest); mutate(copy); assert.throws(() => api._test.validateManifest(copy)); } });
test('v2 validator rejects v1, community identity, unknown fields, and coordinates', () => { const validate = runtime().GridlyPoiBrowserProvider._test.validateRecord; const valid = { id: '1', displayName: 'Place', gridlyCategory: 'PHARMACY', latitude: 30, longitude: -95, countyContextId: 'liberty-tx' }; assert.equal(validate(valid), valid); for (const change of [r => delete r.countyContextId, r => r.communityIdentity = {}, r => r.legacyCategory = 'v1', r => r.latitude = 100]) { const row = { ...valid }; change(row); assert.throws(() => validate(row)); } });
test('request identity, radius, rollback, and no-fallback diagnostics are enforced', () => { const ctx = runtime({ __GRIDLY_POI_NON_PRODUCTION__: true }); const api = ctx.GridlyPoiBrowserProvider; assert.throws(() => api._test.validateRequest({ latitude: 30, longitude: -95, countyContextId: 'x', radiusMiles: 6 })); assert.throws(() => api._test.validateRequest({ latitude: 30, longitude: -95, countyContextId: 'x', radiusMiles: 5, originType: 'DIRECT_COORDINATE', communityIdentity: {} })); assert.throws(() => api._test.validateRequest({ latitude: 30, longitude: -95, countyContextId: 'x', radiusMiles: 5, originType: 'GOVERNED_NON_PLACE', communityIdentity: { placeGeoid: 'x' } })); api.rollback(); const audit = api.audit(); assert.equal(audit.providerInitialized, false); assert.equal(audit.fallbackAttempted, false); assert.equal(audit.productionProviderEligible, false); assert.equal(audit.productionGate, 'OFF'); });

test('current canonical Dayton context builds the request without a POI location selection', () => {
  const context = { label: 'Dayton', latitude: 30.0466, longitude: -94.8852, countyContextId: 'liberty-tx', originType: 'CANONICAL_PLACE', communityIdentity: { stableGovernedIdentity: 'place-4819432', placeGeoid: '4819432' } };
  const request = runtime({ gridlyGetCurrentGovernedLocationContext: () => context }).GridlyPoiBrowserProvider.requestForCurrentContext(5, 'PHARMACY');
  assert.deepEqual(JSON.parse(JSON.stringify(request)), { name: 'Dayton', latitude: 30.0466, longitude: -94.8852, countyContextId: 'liberty-tx', originType: 'CANONICAL_PLACE', communityIdentity: context.communityIdentity, radiusMiles: 5, category: 'PHARMACY', limit: 50 });
});

test('current governed non-PLACE context keeps stable identity and null PLACE GEOID', () => {
  const context = { label: 'Tarkington', latitude: 30.3205, longitude: -94.996, countyContextId: 'liberty-tx', originType: 'GOVERNED_NON_PLACE', communityIdentity: { stableGovernedIdentity: 'liberty-tx:tarkington', placeGeoid: null } };
  const request = runtime({ gridlyGetCurrentGovernedLocationContext: () => context }).GridlyPoiBrowserProvider.requestForCurrentContext(10, '');
  assert.equal(request.originType, 'GOVERNED_NON_PLACE');
  assert.equal(request.communityIdentity.stableGovernedIdentity, 'liberty-tx:tarkington');
  assert.equal(request.communityIdentity.placeGeoid, null);
});

test('current multi-county selection preserves its authoritative county membership', () => {
  const context = { label: 'Austin', latitude: 30.2672, longitude: -97.7431, countyContextId: 'williamson-tx', originType: 'CANONICAL_PLACE', communityIdentity: { stableGovernedIdentity: 'place-4805000', placeGeoid: '4805000' } };
  const request = runtime({ gridlyGetCurrentGovernedLocationContext: () => context }).GridlyPoiBrowserProvider.requestForCurrentContext(25, 'HOSPITAL');
  assert.equal(request.communityIdentity.placeGeoid, '4805000');
  assert.equal(request.countyContextId, 'williamson-tx');
  assert.equal(request.radiusMiles, 25);
  assert.equal(request.category, 'HOSPITAL');
});

test('unresolved current context does not create a default request', () => {
  const api = runtime({ gridlyGetCurrentGovernedLocationContext: () => null }).GridlyPoiBrowserProvider;
  assert.equal(api.requestForCurrentContext(5, ''), null);
});

test('consumer surface is contextual while cohort selection remains API-only', () => {
  assert.match(source, /Nearby places around/);
  assert.match(source, /Choose a location first to see nearby places\./);
  assert.doesNotMatch(source, /id="gridlyPoiCohort"/);
  assert.match(source, /await search\(request\)/);
  assert.match(source, /id="gridlyPoiRadius"/);
  assert.match(source, /id="gridlyPoiCategory"/);
  assert.match(source, /POI data sources and licenses/);
});

test('Gridly location projection reads governed selection, presentation, and active county authorities', () => {
  const start = appSource.indexOf('function gridlyGetCurrentGovernedLocationContext()');
  const end = appSource.indexOf('\nfunction getGridlyCanonicalAwarenessPresentationContext', start);
  const helper = appSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(helper, /gridlyActiveGeographicPresentation/);
  assert.match(helper, /getGridlySelectedAwarenessArea\(\)/);
  assert.match(helper, /gridlyGetActiveCountyId\(\)/);
  assert.match(helper, /gridlyResolveGovernedWeatherPoint\(selectedArea\)/);
  assert.match(helper, /gridlyResolveCountyIdForCoordinate\(latitude, longitude\)/);
  assert.match(helper, /originType: "CANONICAL_PLACE"/);
  assert.match(helper, /originType: "GOVERNED_NON_PLACE"/);
  assert.match(helper, /originType: "DIRECT_COORDINATE"/);
  assert.match(helper, /if \(!selectedArea \|\| selectedArea\.fallback === true\) return null/);
});
