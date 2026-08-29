import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { RELEASE_BINDING, assertReleaseBinding, cachePath, resolveCountyContextId, validateCountyRegistry, validatePoi, validateRequestContext } from '../tools/lp24115c/runtime-v2-contract.mjs';

const registry = JSON.parse(await readFile(new URL('../data/lp149/runtime-county-registry.json', import.meta.url))).identities;
const identities = new Map([
  ['liberty-tx:dayton', 'CANONICAL_PLACE'], ['liberty-tx:tarkington', 'GOVERNED_NON_PLACE'],
  ['texas:austin', 'CANONICAL_PLACE'], ['texas:abilene', 'CANONICAL_PLACE'], ['texas:midland', 'CANONICAL_PLACE']
]);
const poi = { id: 'poi:1', displayName: 'Cafe', gridlyCategory: 'FOOD', latitude: 30.0, longitude: -94.8, countyContextId: 'liberty-tx' };
const request = (originType, communityIdentity, countyContextId = null) => ({ originType, communityIdentity, countyContextId, latitude: 30, longitude: -94.8, radiusMiles: 10 });
const place = (stableGovernedIdentity, placeGeoid) => ({ identityClass: 'CANONICAL_PLACE', stableGovernedIdentity, placeGeoid });

test('v2 POI accepts only governed mandatory and optional fields', () => {
  assert.deepEqual(validatePoi(poi), poi);
  assert.equal(validatePoi({ ...poi, brand: 'Brand', provenanceSummary: 'Overture' }).brand, 'Brand');
  assert.throws(() => validatePoi({ ...poi, id: undefined }), /MISSING_POI_FIELD:id/);
  assert.throws(() => validatePoi({ ...poi, countyContextId: undefined }), /MISSING_POI_FIELD:countyContextId/);
  assert.throws(() => validatePoi({ ...poi, communityIdentity: place('liberty-tx:dayton', '4819432') }), /FORBIDDEN_POI_FIELD:communityIdentity/);
  assert.throws(() => validatePoi({ ...poi, rawSourceMetadata: {} }), /FORBIDDEN_POI_FIELD/);
});

test('county_fips projection is exact, complete, and fail closed', () => {
  assert.equal(validateCountyRegistry(registry), true);
  assert.equal(resolveCountyContextId('48291', registry), 'liberty-tx');
  assert.throws(() => resolveCountyContextId('48999', registry), /UNKNOWN_COUNTY_FIPS/);
  assert.throws(() => resolveCountyContextId('291', registry), /MALFORMED_COUNTY_FIPS/);
  assert.throws(() => resolveCountyContextId('48291', [...registry, registry.find(x => x.fips === '48291')]), /AMBIGUOUS_COUNTY_FIPS/);
});

test('Dayton canonical PLACE and Tarkington governed non-PLACE are request-only identities', () => {
  assert.equal(validateRequestContext(request('CANONICAL_PLACE', place('liberty-tx:dayton', '4819432'), 'liberty-tx'), identities).communityIdentity.placeGeoid, '4819432');
  const tarkington = { identityClass: 'GOVERNED_NON_PLACE', stableGovernedIdentity: 'liberty-tx:tarkington', placeGeoid: null };
  assert.equal(validateRequestContext(request('GOVERNED_NON_PLACE', tarkington, 'liberty-tx'), identities).communityIdentity.placeGeoid, null);
  assert.deepEqual(validatePoi(poi), poi);
});

test('map-center, county-only, rural, direct-coordinate, and unincorporated requests need no community', () => {
  for (const origin of ['MAP_CENTER', 'COUNTY_ONLY', 'RURAL_COORDINATE', 'DIRECT_COORDINATE', 'UNINCORPORATED'])
    assert.equal(validateRequestContext(request(origin, null, origin === 'COUNTY_ONLY' ? 'liberty-tx' : null), identities).communityIdentity, null);
});

test('stale identities and origin fabrication fail closed', () => {
  assert.throws(() => validateRequestContext(request('CANONICAL_PLACE', place('unknown', '4819432')), identities), /STALE_OR_UNKNOWN/);
  assert.throws(() => validateRequestContext(request('MAP_CENTER', place('liberty-tx:dayton', '4819432')), identities), /FORBIDDEN_FOR_ORIGIN/);
});

test('Austin, Abilene, and Midland preserve selected county separately', () => {
  for (const [name, geoid, county] of [['austin', '4805000', 'travis-tx'], ['abilene', '4801000', 'taylor-tx'], ['midland', '4848072', 'midland-tx']]) {
    const value = validateRequestContext(request('CANONICAL_PLACE', place(`texas:${name}`, geoid), county), identities);
    assert.equal(value.countyContextId, county);
    assert.equal(value.communityIdentity.stableGovernedIdentity, `texas:${name}`);
  }
});

test('cross-boundary result retains its county and never inherits request community', () => {
  const origin = validateRequestContext(request('CANONICAL_PLACE', place('liberty-tx:dayton', '4819432'), 'liberty-tx'), identities);
  const result = validatePoi({ ...poi, countyContextId: 'harris-tx' });
  assert.equal(origin.communityIdentity.stableGovernedIdentity, 'liberty-tx:dayton');
  assert.equal(result.countyContextId, 'harris-tx');
  assert.equal('communityIdentity' in result, false);
});

test('v1 cache cannot be reused and release/compliance mismatches fail closed', async () => {
  assert.match(cachePath(RELEASE_BINDING.authorityReleaseId, RELEASE_BINDING.runtimeSchemaVersion, '48291-0001'), /gridly\.poi\.runtime\.v2/);
  assert.throws(() => cachePath(RELEASE_BINDING.authorityReleaseId, 'gridly.poi.runtime.v1', 'x'), /runtimeSchemaVersion/);
  for (const [key, value] of [['authorityReleaseId', 'wrong'], ['sourceInventorySha256', '0'.repeat(64)], ['authorityInputSha256', '0'.repeat(64)], ['foursquareNoticeSha256', '0'.repeat(64)], ['providerGate', 'ON']])
    assert.throws(() => assertReleaseBinding({ ...RELEASE_BINDING, [key]: value }), new RegExp(key));
  const notice = await readFile(new URL('../legal/third-party/foursquare/NOTICE.txt', import.meta.url));
  assert.equal(createHash('sha256').update(notice).digest('hex'), RELEASE_BINDING.foursquareNoticeSha256);
});
