import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  CENSUS_TYPES,
  censusConsumerEligible,
  createCensusPlace,
  createCommunityIdentityPackage,
  createLegacyAwarenessArea
} from '../tools/lp188/community-package-identity-contract.mjs';

// Structural contract fixtures only. They are not LP188.2A certification outputs.
const baytown = createCensusPlace({
  geoid: '4806128',
  officialName: 'Baytown',
  governedType: CENSUS_TYPES.C1,
  countyMemberships: ['48201', '48071']
});

test('Census and county GEOIDs own identity while names remain display metadata', () => {
  const renamedDisplayFixture = createCensusPlace({ geoid: '4800001', officialName: 'Shared Name', governedType: CENSUS_TYPES.C1, countyMemberships: ['48001'] });
  const sameNameDifferentIdentityFixture = createCensusPlace({ geoid: '4800002', officialName: 'Shared Name', governedType: CENSUS_TYPES.CDP, countyMemberships: ['48001'] });
  const pkg = createCommunityIdentityPackage({ county: { countyFips: '48001', displayName: 'Anderson' }, censusPlaces: [sameNameDifferentIdentityFixture, renamedDisplayFixture] });
  assert.equal(pkg.county.countyFips, '48001');
  assert.equal(pkg.county.displayName, 'Anderson');
  assert.deepEqual(pkg.censusPlaces.map(place => place.placeGeoid), ['4800001', '4800002']);
  assert.equal(new Set(pkg.censusPlaces.map(place => place.placeGeoid)).size, 2);
  assert.deepEqual(new Set(pkg.censusPlaces.map(place => place.displayName)), new Set(['Shared Name']));
});

test('multi-county membership and Baytown survive in each county package', () => {
  assert.deepEqual(baytown.countyMemberships, ['48071', '48201']);
  const chambers = createCommunityIdentityPackage({ county: { countyFips: '48071', displayName: 'Chambers' }, censusPlaces: [baytown] });
  const harris = createCommunityIdentityPackage({ county: { countyFips: '48201', displayName: 'Harris' }, censusPlaces: [baytown] });
  assert.equal(chambers.censusPlaces[0].placeGeoid, harris.censusPlaces[0].placeGeoid);
  assert.throws(() => createCommunityIdentityPackage({ county: { countyFips: '48291', displayName: 'Liberty' }, censusPlaces: [baytown] }), /not a member/);
});

test('C1 and CDP are eligible; classification-based C9 is governed but ineligible', () => {
  assert.equal(censusConsumerEligible(CENSUS_TYPES.C1), true);
  assert.equal(censusConsumerEligible(CENSUS_TYPES.CDP), true);
  assert.equal(censusConsumerEligible(CENSUS_TYPES.C9), false);
  for (const officialName of ['Fixture Alpha', 'Fixture Beta']) {
    const record = createCensusPlace({ geoid: officialName.endsWith('Alpha') ? '4800003' : '4800004', officialName, governedType: CENSUS_TYPES.C9, countyMemberships: ['48001'] });
    assert.equal(record.includedInCensusFoundation, true);
    assert.equal(record.consumerEligible, false);
  }
  assert.throws(() => censusConsumerEligible('UNKNOWN'), /unsupported governed Census place type/);
  assert.throws(() => createCommunityIdentityPackage({
    county: { countyFips: '48001', displayName: 'Anderson' },
    censusPlaces: [{ ...createCensusPlace({ geoid: '4800005', officialName: 'Fixture Gamma', governedType: CENSUS_TYPES.C9, countyMemberships: ['48001'] }), consumerEligible: true }]
  }), /eligibility conflicts/);
});

test('legacy awareness identity coexists without a fabricated Census GEOID', () => {
  const legacy = createLegacyAwarenessArea({ legacyIdentity: 'liberty-tx:tarkington', displayName: 'Tarkington' });
  const pkg = createCommunityIdentityPackage({ county: { countyFips: '48291', displayName: 'Liberty' }, legacyAwarenessAreas: [legacy], communities: ['Dayton', 'Liberty', 'Tarkington'] });
  assert.equal(legacy.identitySource, 'LEGACY_NON_CENSUS');
  assert.equal('placeGeoid' in legacy, false);
  assert.deepEqual(pkg.communities, ['Dayton', 'Liberty', 'Tarkington']);
  assert.throws(() => createLegacyAwarenessArea({ legacyIdentity: '4806128', displayName: 'Not Baytown' }), /must not masquerade/);
});

test('identity contract is additive and introduces no manufacturing, activation, or deployment', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../Community-Packages/community-package-identity-contract.schema.json', import.meta.url)));
  assert.equal(schema.properties.communities.items.type, 'string');
  assert.equal(schema.$defs.censusPlace.properties.identitySource.const, 'CENSUS_PLACE');
  assert.equal(schema.$defs.legacyArea.properties.identitySource.const, 'LEGACY_NON_CENSUS');
  assert.equal(fs.existsSync(new URL('../Community-Packages/generated/lp1883', import.meta.url)), false);
  const implementation = fs.readFileSync(new URL('../tools/lp188/community-package-identity-contract.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(implementation, /Supabase|upload|deploy|activat|ST_Intersects|ST_Intersection/);
});
