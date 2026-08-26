import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { buildCertification, certifyPlaceMemberships } from '../tools/lp239/build-statewide-place-membership-certification.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const report = JSON.parse(read('reports/lp239-statewide/statewide-place-membership-certification.json'));
const result = buildCertification();
const byId = new Map(result.rows.map(row => [row.canonicalPlaceId, row]));

test('every canonical PLACE resolves a non-vacuous authoritative membership row', () => {
  assert.equal(result.summary.canonicalPlaceCount, 1859);
  assert.equal(result.summary.zeroMembershipPlaceCount, 0);
  assert.equal(result.summary.membershipAuthorityPassCount, result.summary.canonicalPlaceCount);
  assert.ok(result.rows.every(row => row.canonicalPlaceId && row.membershipAuthorityAvailable && row.membershipCount >= 1));
});

test('every governed FIPS maps exactly once and authoritative memberships contain no duplicates', () => {
  assert.equal(result.summary.unresolvedCountyFipsCount, 0);
  assert.equal(result.summary.invalidRuntimeCountyMappingCount, 0);
  assert.equal(result.summary.duplicateMembershipPlaceCount, 0);
  assert.ok(result.rows.every(row => row.membershipCountyFips.length === row.membershipCountyIds.length && !row.duplicateCountyIds.length));
});

test('single and multi-county classifications are exact', () => {
  assert.ok(result.rows.some(row => row.membershipApplicability === 'SINGLE_COUNTY_CONTROL' && row.membershipCount === 1));
  assert.ok(result.rows.some(row => row.membershipApplicability === 'MULTI_COUNTY_CONVERGENCE' && row.membershipCount > 1));
  assert.equal(result.summary.singleCountyPlaceCount + result.summary.multiCountyPlaceCount, result.summary.canonicalPlaceCount);
});

test('zero membership and missing registry identity fail closed; vacuous PASS is impossible', () => {
  const countyRegistry = { 'alpha-tx': { id: 'alpha-tx', name: 'Alpha County', countyFips: '48001' } };
  const zero = certifyPlaceMemberships({ canonicalPlaces: [{ placeGeoid: '4800001', displayName: 'Zero', countyMemberships: [] }], countyRegistry });
  assert.equal(zero.summary.overallPass, false);
  assert.equal(zero.rows[0].membershipApplicability, 'MEMBERSHIP_AUTHORITY_UNRESOLVED');
  const missing = certifyPlaceMemberships({ canonicalPlaces: [{ displayName: 'Missing', countyMemberships: ['48001'] }], countyRegistry });
  assert.equal(missing.rows[0].membershipAuthorityPass, false);
  assert.equal(missing.rows[0].membershipApplicability, 'REGISTRY_IDENTITY_MISMATCH');
});

test('invalid and duplicate membership mappings fail with their exact classes', () => {
  const duplicate = certifyPlaceMemberships({ canonicalPlaces: [{ placeGeoid: '1', displayName: 'D', countyMemberships: ['48001', '48001'] }], countyRegistry: { a: { countyFips: '48001' } } });
  assert.equal(duplicate.rows[0].membershipApplicability, 'DUPLICATE_MEMBERSHIP');
  const invalid = certifyPlaceMemberships({ canonicalPlaces: [{ placeGeoid: '1', displayName: 'I', countyMemberships: ['48999'] }], countyRegistry: {} });
  assert.equal(invalid.rows[0].membershipApplicability, 'INVALID_MEMBERSHIP_MAPPING');
});

test('a thinner operational projection never replaces authoritative membership', () => {
  const fixture = certifyPlaceMemberships({
    canonicalPlaces: [{ placeGeoid: '1', displayName: 'Shared', countyMemberships: ['48001', '48003'] }],
    countyRegistry: { a: { id: 'a-tx', countyFips: '48001' }, b: { id: 'b-tx', countyFips: '48003' } },
    operationalRows: [{ placeGeoid: '1', displayName: 'Shared', countyMemberships: ['48001'] }]
  });
  assert.equal(fixture.rows[0].operationalProjectionThinnerThanRegistry, true);
  assert.equal(fixture.rows[0].membershipCount, 2);
  assert.equal(fixture.rows[0].membershipAuthorityPass, true);
});

const ownerCohort = {
  '4876636': ['Waskom', ['48203'], ['harrison-tx'], 'SINGLE_COUNTY_CONTROL'],
  '4872368': ['Texarkana', ['48037'], ['bowie-tx'], 'SINGLE_COUNTY_CONTROL'],
  '4838476': ['Katy', ['48157', '48201', '48473'], ['fort-bend-tx', 'harris-tx', 'waller-tx'], 'MULTI_COUNTY_CONVERGENCE'],
  '4856348': ['Pearland', ['48039', '48157', '48201'], ['brazoria-tx', 'fort-bend-tx', 'harris-tx'], 'MULTI_COUNTY_CONVERGENCE'],
  '4841980': ['League City', ['48167', '48201'], ['galveston-tx', 'harris-tx'], 'MULTI_COUNTY_CONVERGENCE']
};
test('owner-observed zero-membership cohort is sound in authoritative registry', () => {
  for (const [id, [name, fips, countyIds, classification]] of Object.entries(ownerCohort)) {
    const row = byId.get(id);
    assert.equal(row.canonicalCommunity, name); assert.deepEqual(row.membershipCountyFips, fips);
    assert.deepEqual(row.membershipCountyIds, countyIds); assert.equal(row.membershipApplicability, classification);
    assert.equal(row.membershipAuthorityPass, true);
  }
});

const controls = ['4865000', '4805000', '4819000', '4801000', '4848072', '4817000', '4850820', '4811428', '4830464', '4846452'];
test('known single and multi-county controls remain certified from committed registry values', () => {
  for (const id of controls) assert.equal(byId.get(id)?.membershipAuthorityPass, true, id);
});

test('consumer consideration is membership-wide while truthful zero crossing records remain valid', () => {
  assert.ok(result.rows.every(row => row.crossingCanonicalPlaceAvailable && row.officialRoadwayConsumerAvailable && row.weatherConsumerAvailable));
  assert.ok(result.rows.some(row => JSON.parse(read('data/runtime/canonical-crossing-memberships-v1.json')).places[row.canonicalPlaceId].x.length === 0 && row.membershipAuthorityPass));
});

test('production remains town-neutral and does not expand provider fetches', () => {
  const app = read('js/app.js').slice(read('js/app.js').indexOf('// LP239:'));
  assert.doesNotMatch(app, /if\s*\([^)]*(Waskom|Texarkana|Katy|Pearland|League City)/i);
  assert.doesNotMatch(app, /membershipCounty(?:Fips|Ids)[\s\S]{0,160}fetch\s*\(/);
  assert.match(app, /no per-membership fetch/);
  assert.match(app, /canonicalMembership\?\.governedCountyFips/);
});

test('committed JSON, CSV, Markdown, and empty failure ledger are deterministic', () => {
  assert.deepEqual(report.summary, result.summary);
  assert.equal(result.summary.overallPass, true);
  assert.deepEqual(report.failures, []);
  assert.deepEqual(JSON.parse(read('reports/lp239-statewide/failure-ledger.json')), []);
  assert.match(read('reports/lp239-statewide/statewide-place-membership-certification.csv'), /^canonicalCommunity,canonicalPlaceId,/);
  assert.match(read('reports/lp239-statewide/README.md'), /Failure ledger[\s\S]*Empty/);
});
