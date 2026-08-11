import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EXPECTED, manufacture, reconcileInputs } from '../tools/lp188/manufacture-community-packages.mjs';

// Synthetic contract-scale data exercises reconciliation only. It is never
// written to the governed output location and is not LP188.2A evidence.
function contractScaleInputs() {
  const countyIds = Array.from({ length: EXPECTED.counties }, (_, i) => `48${String(i + 1).padStart(3, '0')}`);
  const geoids = Array.from({ length: EXPECTED.places }, (_, i) => `48${String(i + 1).padStart(5, '0')}`);
  geoids[100] = '4806128';
  const canonical = geoids.map((geoid, i) => ({
    geoid,
    officialName: i < 2 ? 'Duplicate Display Fixture' : `Fixture Place ${i}`,
    governedType: i < 4 ? 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE' : i % 2 ? 'CENSUS_DESIGNATED_PLACE' : 'INCORPORATED_PLACE'
  }));
  const membershipIds = new Map(geoids.map((geoid, i) => [geoid, [countyIds[i % countyIds.length]]]));
  membershipIds.set('4806128', ['48071', '48201']);
  const candidates = geoids.filter(geoid => geoid !== '4806128').slice(0, 162);
  for (const [i, geoid] of candidates.entries()) {
    const values = membershipIds.get(geoid);
    const add = offset => {
      let candidate = countyIds[(i + offset) % countyIds.length];
      while (values.includes(candidate)) candidate = countyIds[(countyIds.indexOf(candidate) + 1) % countyIds.length];
      values.push(candidate);
    };
    add(73);
    if (i < 36) add(149);
  }
  const byGeoid = new Map(canonical.map(place => [place.geoid, place]));
  const memberships = [...membershipIds].flatMap(([placeGeoid, counties]) => counties.map(countyFips => ({
    placeGeoid,
    placeName: byGeoid.get(placeGeoid).officialName,
    countyFips,
    countyName: countyFips === '48071' ? 'Chambers' : countyFips === '48201' ? 'Harris' : `County ${countyFips}`
  }))).sort((a, b) => a.placeGeoid.localeCompare(b.placeGeoid) || a.countyFips.localeCompare(b.countyFips));
  assert.equal(memberships.length, EXPECTED.memberships);
  const summary = {
    milestone: 'LP188.2A', finalClassification: 'PLACE_COUNTY_MEMBERSHIP_CERTIFIED_READY_FOR_COMMUNITY_MANUFACTURING',
    counts: { TOTAL_PLACES: 1863, TOTAL_PLACE_COUNTY_MEMBERSHIPS: 2062, COUNTIES_WITH_AT_LEAST_ONE_PLACE: 254, UNMATCHED_PLACES: 0, DUPLICATE_GEOIDS: 0, INVALID_GEOMETRIES: 0, OTHER_REQUIRES_REVIEW: 0, MULTI_COUNTY_PLACES: 163, INCORPORATED_INACTIVE_OR_NONFUNCTIONING: 4 }
  };
  return { canonical, memberships, summary, duplicateNames: [{ displayName: 'Duplicate Display Fixture', placeGeoids: geoids.slice(0, 2) }] };
}

test('certified LP188.2A identities reconcile at required statewide scale', () => {
  const result = reconcileInputs(contractScaleInputs());
  assert.equal(result.packages.length, 254);
  assert.equal(result.representedGeoids.length, 1863);
  assert.equal(result.packages.reduce((count, item) => count + item.censusPlaces.length, 0), 2062);
  assert.equal(result.multiCountyGeoids.length, 163);
  assert.equal(result.c9Geoids.length, 4);
  assert.ok(result.packages.flatMap(item => item.censusPlaces).filter(place => place.governedType.endsWith('INCORPORATED_PLACE')).every(place => place.consumerEligible === (place.governedType !== 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE')));
});

test('PLACE GEOID, county FIPS, complete multi-county identity, and duplicate names remain distinct', () => {
  const result = reconcileInputs(contractScaleInputs());
  const baytown = result.packages.flatMap(item => item.censusPlaces.map(place => ({ county: item.county.countyFips, place }))).filter(item => item.place.placeGeoid === '4806128');
  assert.deepEqual(baytown.map(item => item.county), ['48071', '48201']);
  assert.ok(baytown.every(item => JSON.stringify(item.place.countyMemberships) === JSON.stringify(['48071', '48201'])));
  const sameName = result.packages.flatMap(item => item.censusPlaces).filter(place => place.displayName === 'Duplicate Display Fixture');
  assert.equal(new Set(sameName.map(place => place.placeGeoid)).size, 2);
  assert.ok(result.packages.every(item => /^48\d{3}$/.test(item.county.countyFips)));
});

test('names cannot substitute for governed IDs and no membership can be invented', () => {
  const badId = contractScaleInputs(); badId.canonical[0].geoid = badId.canonical[0].officialName;
  assert.throws(() => reconcileInputs(badId), /invalid or name-substituted GEOID/);
  const invented = contractScaleInputs(); invented.memberships[0].placeGeoid = '4899999';
  assert.throws(() => reconcileInputs(invented), /unknown PLACE GEOID/);
  const badCounty = contractScaleInputs(); badCounty.memberships[0].countyFips = badCounty.memberships[0].countyName;
  assert.throws(() => reconcileInputs(badCounty), /unknown county FIPS/);
});

test('legacy identity remains separate and the string-only projection is unchanged', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1883-legacy-'));
  try {
    const manifest = path.join(root, 'fixture', 'package-manifest.json'); fs.mkdirSync(path.dirname(manifest));
    fs.writeFileSync(manifest, JSON.stringify({ county: 'County 48001', communities: ['Existing Area'] }));
    const result = reconcileInputs({ ...contractScaleInputs(), legacyRoot: root });
    const county = result.packages.find(item => item.county.countyFips === '48001');
    assert.deepEqual(county.communities, ['Existing Area']);
    assert.deepEqual(county.legacyAwarenessAreas, [{ identitySource: 'LEGACY_NON_CENSUS', legacyIdentity: 'Existing Area', displayName: 'Existing Area', consumerEligible: true }]);
    assert.ok(!('placeGeoid' in county.legacyAwarenessAreas[0]));
    assert.deepEqual(result.packages.find(item => item.county.countyFips === '48002').communities, []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('two complete generations are deterministic and certification is fail-closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1883-build-'));
  try {
    const input = path.join(root, 'input'); const output = path.join(root, 'output'); fs.mkdirSync(input);
    const data = contractScaleInputs();
    const files = { canonical: 'texas-place-canonical.json', memberships: 'texas-place-county-memberships.json', summary: 'texas-place-certification-summary.json', duplicateNames: 'texas-place-duplicate-names.json' };
    for (const [key, name] of Object.entries(files)) fs.writeFileSync(path.join(input, name), JSON.stringify(data[key]));
    const certification = manufacture({ inputDirectory: input, outputDirectory: output });
    assert.equal(certification.overallClassification, 'PASS');
    assert.equal(certification.deterministicGenerationPass, true);
    assert.equal(fs.readdirSync(path.join(output, 'counties')).length, 254);
    const before = fs.readFileSync(path.join(output, 'counties', '48071.json'));
    manufacture({ inputDirectory: input, outputDirectory: output });
    assert.deepEqual(fs.readFileSync(path.join(output, 'counties', '48071.json')), before);
    assert.equal(before[0], 0x7b); assert.equal(before.at(-1), 0x0a);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('manufacturer has no geometry, activation, deployment, or operational-manifest behavior', () => {
  const source = fs.readFileSync(new URL('../tools/lp188/manufacture-community-packages.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /ogr2ogr|ogrinfo|ST_Intersects|ST_Intersection|supabase/i);
  assert.doesNotMatch(source, /gridlyPackageRegistry|county-manifest\.json|defaultAwarenessAreas|deploy|activate/i);
});
