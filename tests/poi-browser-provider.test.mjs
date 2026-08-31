import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../js/gridlyPoiBrowserProvider.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
function runtime(overrides = {}) { const context = { console, TextDecoder, Response, Blob, DecompressionStream, crypto: globalThis.crypto, fetch: async () => { throw new Error('network disabled'); }, ...overrides }; context.globalThis = context; vm.runInNewContext(source, context); return context; }
const manifest = JSON.parse(fs.readFileSync(new URL('../poi/lp24111-d5-standalone-2026-08-28/runtime-v2/manifest.json', import.meta.url)));

test('production gate is exact-value fail closed and does not fetch while off', async () => { for (const value of [undefined, null, false, true, 'enabled', 'ON', 'DISABLED']) { let fetched = false; const config = value === undefined ? undefined : { poiBrowserProvider: { enabled: value } }; const ctx = runtime({ GRIDLY_RUNTIME_CONFIG: config, fetch: async () => { fetched = true; } }); const audit = ctx.gridlyPoiBrowserRehearsalAudit(); assert.equal(audit.gateEnabled, false); assert.equal(audit.productionGate, 'OFF'); assert.equal(audit.productionProviderEligible, true); await assert.rejects(ctx.GridlyPoiBrowserProvider.initialize, /POI_PROVIDER_GATE_OFF/); assert.equal(fetched, false); } });
test('only exact production activation or the strict QA override opens the effective gate', () => { const production = runtime({ GRIDLY_RUNTIME_CONFIG: { poiBrowserProvider: { enabled: 'ENABLED' } } }).gridlyPoiBrowserRehearsalAudit(); assert.equal(production.gateEnabled, true); assert.equal(production.productionGate, 'ON'); const qa = runtime({ __GRIDLY_POI_NON_PRODUCTION__: true }).gridlyPoiBrowserRehearsalAudit(); assert.equal(qa.gateEnabled, true); assert.equal(qa.productionGate, 'OFF'); });
test('certified manifest and bounded candidate selection pass', () => { const api = runtime().GridlyPoiBrowserProvider; api._test.validateManifest(manifest); for (const radiusMiles of [5, 10, 25]) assert.ok(api._test.candidateShardIds(manifest, { latitude: 32.7767, longitude: -96.797, radiusMiles }).length <= 4); });
test('release, schema, attribution, and fanout mismatches fail closed', () => { const api = runtime().GridlyPoiBrowserProvider; for (const mutate of [m => m.authorityReleaseId = 'wrong', m => m.runtimeSchemaVersion = 'v1', m => m.legalBinding.target = 'missing', m => m.maxCandidateShards25Mi = 5]) { const copy = structuredClone(manifest); mutate(copy); assert.throws(() => api._test.validateManifest(copy)); } });
test('v2 validator rejects v1, community identity, unknown fields, and coordinates', () => { const validate = runtime().GridlyPoiBrowserProvider._test.validateRecord; const valid = { id: '1', displayName: 'Place', gridlyCategory: 'PHARMACY', latitude: 30, longitude: -95, countyContextId: 'liberty-tx' }; assert.equal(validate(valid), valid); for (const change of [r => delete r.countyContextId, r => r.communityIdentity = {}, r => r.legacyCategory = 'v1', r => r.latitude = 100]) { const row = { ...valid }; change(row); assert.throws(() => validate(row)); } });
test('request identity, radius, rollback, and no-fallback diagnostics are enforced', () => { const ctx = runtime({ __GRIDLY_POI_NON_PRODUCTION__: true }); const api = ctx.GridlyPoiBrowserProvider; assert.throws(() => api._test.validateRequest({ latitude: 30, longitude: -95, countyContextId: 'x', radiusMiles: 6 })); assert.throws(() => api._test.validateRequest({ latitude: 30, longitude: -95, countyContextId: 'x', radiusMiles: 5, originType: 'DIRECT_COORDINATE', communityIdentity: {} })); assert.throws(() => api._test.validateRequest({ latitude: 30, longitude: -95, countyContextId: 'x', radiusMiles: 5, originType: 'GOVERNED_NON_PLACE', communityIdentity: { placeGeoid: 'x' } })); api.rollback(); const audit = api.audit(); assert.equal(audit.providerInitialized, false); assert.equal(audit.fallbackAttempted, false); assert.equal(audit.productionProviderEligible, true); assert.equal(audit.productionGate, 'OFF'); });

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

test('context/request agreement assertion rejects a mismatched governed authority', () => {
  const assertion = runtime().GridlyPoiBrowserProvider._test.assertContextRequestAgreement;
  const context = { label: 'Tarkington', countyContextId: 'liberty-tx', originType: 'GOVERNED_NON_PLACE', communityIdentity: { stableGovernedIdentity: 'liberty-tx:tarkington', placeGeoid: null } };
  assert.throws(() => assertion(context, { name: 'Tarkington', countyContextId: 'liberty-tx', originType: 'DIRECT_COORDINATE' }), /CONTEXT_AUTHORITY/);
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

test('radius is a three-option accessible segment and not a visible native select', () => {
  const surface = source.slice(source.indexOf('section.innerHTML = `<div class="gridly-poi-heading"'), source.indexOf('\n    host.append(section);'));
  assert.doesNotMatch(surface, /<select id="gridlyPoiRadius"/);
  assert.match(surface, /<fieldset id="gridlyPoiRadius"[^>]*>[\s\S]*?<legend>Radius<\/legend>/);
  const radiusValues = [...surface.matchAll(/name="gridlyPoiRadiusMiles" value="(5|10|25)"/g)].map(match => Number(match[1]));
  assert.deepEqual(radiusValues, [5, 10, 25]);
  assert.equal((surface.match(/name="gridlyPoiRadiusMiles"[^>]* checked/g) || []).length, 1);
  assert.match(source, /input\[name="gridlyPoiRadiusMiles"\]:checked/);
});

test('radius and category controls map through the unchanged current-context request contract', () => {
  const context = { label: 'Dayton', latitude: 30.0466, longitude: -94.8852, countyContextId: 'liberty-tx', originType: 'CANONICAL_PLACE', communityIdentity: { stableGovernedIdentity: 'place-4819432', placeGeoid: '4819432' } };
  const api = runtime({ gridlyGetCurrentGovernedLocationContext: () => context }).GridlyPoiBrowserProvider;
  const five = api.requestForCurrentContext('5', 'PHARMACY');
  const ten = api.requestForCurrentContext('10', 'PHARMACY');
  assert.equal(five.radiusMiles, 5);
  assert.equal(ten.radiusMiles, 10);
  assert.equal(ten.category, five.category);
  assert.equal(ten.name, five.name);
  assert.equal(ten.countyContextId, five.countyContextId);
  assert.doesNotMatch(source, /<select id="gridlyPoiCategory"/);
  assert.match(source, /id="gridlyPoiCategoryPicker"[^>]+role="dialog"/);
});

test('shared result selection preserves runtime-v2 identity and context', () => {
  let selected = null;
  const api = runtime({ gridlySelectNearbyPlace: poi => { selected = poi; return true; } }).GridlyPoiBrowserProvider;
  const poi = { id: 'poi-1', displayName: 'Shell', gridlyCategory: 'FUEL', latitude: 29.9, longitude: -93.9, countyContextId: 'jefferson-tx', distanceMiles: 1.2 };
  assert.equal(api._test.selectResult(poi), true);
  assert.deepEqual(JSON.parse(JSON.stringify(selected)), { id: 'poi-1', displayName: 'Shell', gridlyCategory: 'FUEL', latitude: 29.9, longitude: -93.9, countyContextId: 'jefferson-tx' });
});

test('Gridly location projection reads governed selection, presentation, and active county authorities', () => {
  const start = appSource.indexOf('function gridlyGetCurrentGovernedLocationContext()');
  const end = appSource.indexOf('\nfunction getGridlyCanonicalAwarenessPresentationContext', start);
  const helper = appSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(helper, /gridlyActiveGeographicPresentation/);
  assert.match(helper, /presentationAuthority === "GOVERNED_SELECTION"/);
  assert.match(helper, /presentation\.governedAwarenessKey === selectedAwarenessKey/);
  assert.match(helper, /semanticLevel === "LOCAL" && !governedPresentationOwnsCoordinate/);
  assert.match(helper, /getGridlySelectedAwarenessArea\(\)/);
  assert.match(helper, /gridlyGetActiveCountyId\(\)/);
  assert.match(helper, /gridlyResolveGovernedWeatherPoint\(selectedArea\)/);
  assert.match(helper, /gridlyResolveCountyIdForCoordinate\(latitude, longitude\)/);
  assert.match(helper, /originType: "CANONICAL_PLACE"/);
  assert.match(helper, /originType: "GOVERNED_NON_PLACE"/);
  assert.match(helper, /originType: "DIRECT_COORDINATE"/);
  assert.match(helper, /if \(!selectedArea \|\| selectedArea\.fallback === true\) return null/);
});

test('governed selection dispatch marks both PLACE and LOCAL coordinates with selection ownership', () => {
  assert.match(appSource, /semanticLevel: "PLACE"[^\n]+presentationAuthority: "GOVERNED_SELECTION"[^\n]+governedAwarenessKey/);
  assert.match(appSource, /semanticLevel: "LOCAL"[^\n]+presentationAuthority: "GOVERNED_SELECTION"[^\n]+governedAwarenessKey/);
});

test('an unowned or later standalone LOCAL presentation remains direct-coordinate authority', () => {
  const start = appSource.indexOf('function gridlyGetCurrentGovernedLocationContext()');
  const end = appSource.indexOf('\nfunction getGridlyCanonicalAwarenessPresentationContext', start);
  const helper = appSource.slice(start, end);
  assert.match(helper, /originType: "DIRECT_COORDINATE"/);
  assert.match(helper, /communityIdentity: null/);
  assert.ok(helper.indexOf('originType: "DIRECT_COORDINATE"') < helper.indexOf('originType: "GOVERNED_NON_PLACE"'));
});

test('multi-county acceptance cohorts retain selected county independently of identity', () => {
  const api = runtime().GridlyPoiBrowserProvider;
  for (const [name, county] of [['Austin', 'travis-tx'], ['Abilene', 'taylor-tx'], ['Midland', 'midland-tx']]) {
    const request = api.requestForCohort(name, 5, '');
    assert.equal(request.countyContextId, county);
    assert.equal(request.originType, 'CANONICAL_PLACE');
    assert.ok(request.communityIdentity.placeGeoid);
  }
});
