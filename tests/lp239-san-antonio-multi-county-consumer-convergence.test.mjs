import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('js/app.js');
const memberships = JSON.parse(read('data/runtime/canonical-crossing-memberships-v1.json'));
const records = JSON.parse(read('data/runtime/canonical-crossing-records-v1.json')).records;

test('San Antonio fixture is certified solely by the statewide governed registry', () => {
  const place = memberships.places['4865000'];
  assert.equal(place.n, 'San Antonio');
  assert.deepEqual(place.m, ['48029', '48091', '48325']);
  assert.ok(place.m.length > 1);
  assert.equal(place.x.length, 318);
  assert.equal(place.x.filter(([id]) => records[id]).length, place.x.length);
});

test('canonical crossing availability considers every membership and preserves identity', () => {
  const place = memberships.places['4865000'];
  const counts = Object.fromEntries(place.m.map(fips => [fips, 0]));
  place.x.forEach(([id, fips]) => { assert.ok(id); counts[fips] += 1; });
  assert.deepEqual(counts, { '48029': 318, '48091': 0, '48325': 0 });
  assert.equal(new Set(place.x.map(([id]) => id)).size, place.x.length);
});

test('Austin and Dallas retain the shared multi-county contract', () => {
  assert.deepEqual(memberships.places['4805000'].m, ['48021', '48209', '48453', '48491']);
  assert.deepEqual(memberships.places['4819000'].m, ['48085', '48113', '48121', '48257', '48397']);
  for (const geoid of ['4805000', '4819000']) {
    const place = memberships.places[geoid];
    assert.equal(new Set(place.x.map(([id]) => id)).size, place.x.length);
    assert.equal(place.x.filter(([id]) => records[id]).length, place.x.length);
  }
});

test('LP239 audit reuses governed authorities and fails closed without them', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  for (const symbol of ['getGridlySelectedAwarenessArea', 'gridlyResolveCanonicalPlaceGeoid', 'GRIDLY_COUNTY_REGISTRY', 'gridlyGetGovernedConsumerProjection', 'gridlyCanonicalCrossingRuntime', 'resolveGridlyCanonicalPlacePresentationFocus', 'buildGridlyCommunityAwarenessIntelligenceSummary']) assert.match(source, new RegExp(symbol));
  assert.match(source, /canonicalPlaceConsumerConvergencePass/);
  assert.match(source, /missingOfficialRoadwayMemberships/);
  assert.match(source, /missingCrossingMemberships/);
  assert.match(source, /missingWeatherMemberships/);
  assert.match(source, /no per-membership fetch/);
});

test('production repair is town-neutral, passive, and leaves active membership separate', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.doesNotMatch(source, /San Antonio|Bexar|4865000|bexar-tx|Dallas|Austin/);
  assert.doesNotMatch(source, /fetch\s*\(|setInterval|setTimeout|requestAnimationFrame|setActiveCounty|renderCrossings\s*\(/);
  assert.match(source, /activeCounty: gridlyGetActiveCountyId\(\)/);
  assert.match(source, /selectedOperationalMembership: gridlyGetActiveCountyId\(\)/);
});

test('protected roadway, weather, reports, and viewport contracts remain shared', () => {
  assert.match(app, /canonicalResolution\?\.authorityAvailable[\s\S]*canonicalResolution\.records/);
  assert.match(app, /visibilityPolicy\.useViewport/);
  assert.match(app, /provider point\/polygon\/zone\/forecast-zone\/county-warning geography/);
  assert.match(app, /selectedArea\.countyMemberships \|\| \[\]\)\.map\(String\)\.includes\(reportCountyFips\)/);
  assert.match(app, /gridlyAlertWriterRecordId/);
});
