import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { buildCertification, certifyCrossingAuthority } from '../tools/lp239/build-statewide-crossing-certification.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const result = await buildCertification();
const byId = new Map(result.rows.map(row => [row.canonicalPlaceId, row]));

test('all 1,859 canonical PLACEs use available canonical crossing authority', () => {
  assert.equal(result.summary.canonicalPlaceCount, 1859);
  assert.equal(result.summary.crossingAuthorityPassCount, 1859);
  assert.equal(result.summary.crossingAuthorityFailCount, 0);
  assert.equal(result.summary.unavailablePlaceCount, 0);
  assert.ok(result.rows.every(row => row.crossingAuthorityAvailable && row.crossingAuthorityPass));
});

test('populated and truthful-empty inventories resolve with exact identity parity', () => {
  assert.ok(result.summary.availableNonemptyPlaceCount > 0);
  assert.ok(result.summary.availableEmptyPlaceCount > 0);
  assert.equal(result.summary.totalCanonicalCrossingIdentityCount, result.summary.totalResolvedCrossingRecordCount);
  assert.equal(result.summary.unresolvedCrossingIdentityCount, 0);
  assert.equal(result.summary.duplicateCrossingIdentityCount, 0);
  const empty = result.rows.find(row => row.crossingAuthorityState === 'AVAILABLE_EMPTY');
  assert.deepEqual({ available: empty.crossingAuthorityAvailable, identities: empty.canonicalCrossingIdentityCount, records: empty.resolvedCrossingRecordCount, unresolved: empty.unresolvedCrossingIds, duplicates: empty.duplicateCrossingIds, pass: empty.crossingAuthorityPass }, { available: true, identities: 0, records: 0, unresolved: [], duplicates: [], pass: true });
});

function fixture(overrides = {}) {
  const membership = { placeGeoid: '4800001', canonicalCommunity: 'Fixture', governedCountyFips: ['48001'], crossingIds: ['A'] };
  return certifyCrossingAuthority({ canonicalPlaces: [{ placeGeoid: '4800001', displayName: 'Fixture', countyMemberships: ['48001'] }], resolveCountyFips: fips => ({ countyId: fips === '48001' ? 'alpha-tx' : 'beta-tx' }), resolveRecords: identity => ({ authorityAvailable: true, membership, records: [{ id: 'A', crossingId: 'A' }], ...overrides(identity, membership) }) });
}

test('thin selected-area identity cannot substitute for canonical GEOID', () => {
  let received;
  fixture(identity => { received = identity; return {}; });
  assert.deepEqual(received, { placeGeoid: '4800001' });
  assert.equal(Object.keys(received).length, 1);
});

test('unavailable, unresolved, duplicate, county, and canonical identity defects fail closed', () => {
  assert.equal(fixture(() => ({ authorityAvailable: false, reason: 'offline', records: [] })).failures[0].failureClass, 'CROSSING_AUTHORITY_UNAVAILABLE');
  assert.equal(fixture(() => ({ records: [] })).failures[0].failureClass, 'UNRESOLVED_CROSSING_IDENTITY');
  assert.equal(fixture((_identity, membership) => ({ membership: { ...membership, crossingIds: ['A', 'A'] } })).failures[0].failureClass, 'DUPLICATE_CROSSING_IDENTITY');
  assert.equal(fixture((_identity, membership) => ({ membership: { ...membership, governedCountyFips: ['48003'] } })).failures[0].failureClass, 'CROSSING_COUNTY_MEMBERSHIP_MISMATCH');
  assert.equal(fixture((_identity, membership) => ({ membership: { ...membership, placeGeoid: '4800002' } })).failures[0].failureClass, 'CANONICAL_IDENTITY_MISMATCH');
});

test('Beaumont exact repaired contract is certified', () => {
  const row = byId.get('4807000');
  assert.equal(row.canonicalCommunity, 'Beaumont');
  assert.deepEqual(row.membershipCountyIds, ['jefferson-tx']);
  assert.equal(row.canonicalCrossingIdentityCount, 146);
  assert.equal(row.resolvedCrossingRecordCount, 146);
  assert.equal(row.crossingAuthorityPass, true);
});

const controls = ['4865000', '4805000', '4819000', '4801000', '4848072', '4817000', '4850820', '4811428', '4830464', '4846452', '4841980', '4876636', '4872368', '4838476', '4856348'];
test('all prior owner controls retain canonical crossing parity', () => {
  for (const id of controls) assert.equal(byId.get(id)?.crossingAuthorityPass, true, id);
});

test('certification adds no town branch, activation, viewport, or provider-fetch behavior', () => {
  const source = read('tools/lp239/build-statewide-crossing-certification.mjs');
  assert.doesNotMatch(source, /if\s*\([^)]*(Beaumont|San Antonio|Austin|Dallas|League City|Waskom|Texarkana|Katy|Pearland)/i);
  assert.doesNotMatch(source, /setActiveCounty|crossingMarkers|map\.getBounds|gridlySelectConsumerVisibleCrossings/);
  assert.doesNotMatch(source, /fetch\s*\([^)]*(provider|api)/i);
  assert.match(source, /resolveRecords\(\{ placeGeoid: canonicalPlaceId \}\)/);
});

test('JSON, CSV, Markdown, and empty failure ledger are committed deterministically', () => {
  const report = JSON.parse(read('reports/lp239-crossing-statewide/statewide-crossing-certification.json'));
  assert.deepEqual(report.summary, result.summary);
  assert.deepEqual(JSON.parse(read('reports/lp239-crossing-statewide/failure-ledger.json')), []);
  assert.match(read('reports/lp239-crossing-statewide/statewide-crossing-certification.csv'), /^canonicalCommunity,canonicalPlaceId,/);
  assert.match(read('reports/lp239-crossing-statewide/README.md'), /Failure ledger[\s\S]*Empty/);
});
