import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

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
  assert.match(source, /canonicalPlaceId && membershipAuthorityAvailable/);
  assert.match(source, /MEMBERSHIP_AUTHORITY_UNRESOLVED/);
  assert.match(source, /membershipAuthorityAvailable/);
  assert.match(source, /membershipAuthorityReason/);
  assert.match(source, /membershipApplicability/);
  assert.match(source, /no per-membership fetch/);
});

test('canonical PLACE with zero governed membership cannot pass', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.match(source, /membershipCountyFips\.length/);
  assert.match(source, /canonicalPlaceConsumerConvergencePass = Boolean\(canonicalPlaceId && membershipAuthorityAvailable/);
  assert.match(source, /convergencePass: canonicalPlaceConsumerConvergencePass/);
  assert.match(source, /overallPass: canonicalPlaceConsumerConvergencePass/);
  assert.doesNotMatch(source, /membershipCountyIds\.length === membershipCountyFips\.length\s*&& officialAuthorityAvailable/);
});

test('Waskom resolves as authoritative single-county Harrison control', () => {
  const place = memberships.places['4876636'];
  assert.equal(place.n, 'Waskom');
  assert.deepEqual(place.m, ['48203']);
  assert.equal(place.x.length, 6);
  assert.ok(place.x.every(([, countyFips]) => countyFips === '48203'));
  assert.match(app.slice(app.indexOf('// LP239:')), /membershipCountyIds\.length === 1 \? "SINGLE_COUNTY_CONTROL"/);
});

test('crossing inventory cannot substitute for PLACE membership authority', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.ok(source.includes('gridlyCanonicalCrossingRuntime?.lookup?.'));
  assert.match(source, /canonicalMembership\?\.governedCountyFips/);
  assert.doesNotMatch(source, /crossingIds.*membershipCountyFips|crossing\.records.*membershipCountyFips/);
  const waskom = memberships.places['4876636'];
  assert.notEqual(waskom.m, waskom.x);
});

test('owner-proven cohort membership contracts are unchanged', () => {
  const expected = {
    '4865000': ['48029', '48091', '48325'],
    '4805000': ['48021', '48209', '48453', '48491'],
    '4819000': ['48085', '48113', '48121', '48257', '48397'],
    '4801000': ['48253', '48441'],
    '4848072': ['48317', '48329'],
    '4817000': ['48007', '48273', '48355', '48409'],
    '4850820': ['48091', '48187'],
    '4811428': ['48251', '48439']
  };
  for (const [placeGeoid, countyFips] of Object.entries(expected)) {
    assert.deepEqual(memberships.places[placeGeoid].m, countyFips);
  }
});

test('production repair is town-neutral, passive, and leaves active membership separate', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.doesNotMatch(source, /San Antonio|Bexar|4865000|bexar-tx|Dallas|Austin|Waskom|4876636|Harrison/);
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

test('LP239 reconciles through the established canonical crossing runtime using resolved PLACE identity', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.match(source, /crossingIdentity = canonicalPlaceId \? Object\.freeze\(\{ placeGeoid: canonicalPlaceId \}\)/);
  assert.match(source, /gridlyCanonicalCrossingRuntime\?\.resolveRecords\?\.\(crossingIdentity\)/);
  assert.doesNotMatch(source, /resolveRecords\?\.\(area\)/);
  assert.match(source, /crossingAuthorityOwner/);
  assert.match(source, /crossingAuthorityAgreementPass/);
  assert.match(source, /crossingCanonicalInventoryCount > 0/);
});

test('canonical inventory, watched selection, and rendered marker observations remain distinct', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.match(source, /crossingCanonicalInventoryCount = crossingIds\.length/);
  assert.match(source, /gridlySelectConsumerVisibleCrossings\(area\)/);
  assert.match(source, /crossingRenderedMarkerCount = crossingMarkers instanceof Map \? crossingMarkers\.size : 0/);
  assert.doesNotMatch(source, /crossingWatchedCount\s*=\s*crossingCanonicalInventoryCount/);
  assert.doesNotMatch(source, /crossingRenderedMarkerCount\s*=\s*crossingCanonicalInventoryCount/);
});

test('Beaumont populated canonical authority retains Jefferson attribution', () => {
  const place = memberships.places['4807000'];
  assert.equal(place.n, 'Beaumont');
  assert.deepEqual(place.m, ['48245']);
  assert.ok(place.x.length > 0);
  assert.ok(place.x.some(([, countyFips]) => countyFips === '48245'));
  assert.equal(place.x.filter(([id]) => records[id]).length, place.x.length);
});

test('League City and owner controls keep populated shared canonical records', () => {
  for (const geoid of ['4841980', '4865000', '4805000', '4819000', '4876636']) {
    const place = memberships.places[geoid];
    assert.ok(place.x.length > 0, geoid);
    assert.equal(place.x.filter(([id]) => records[id]).length, place.x.length, geoid);
  }
});

test('audit reconciliation creates no inventory, activation, viewport, or town-specific production branch', () => {
  const source = app.slice(app.indexOf('// LP239:'));
  assert.doesNotMatch(source, /new Map|new Set\(crossing|fetch\s*\(|loadCrossings|ensureGridlyActiveCountyCrossingInventory|setActiveCounty|renderCrossings\s*\(|map\.getBounds/);
  assert.doesNotMatch(source, /Beaumont|Jefferson|4807000|San Antonio|Austin|Dallas|League City|Waskom/);
  assert.match(source, /crossingCountyIds: Object\.freeze\(\[\.\.\.membershipCountyIds\]\)/);
});

test('LP239.3 live audit resolves the owner cohort through the complete LP149 browser identity contract', () => {
  const identitySource = read('js/gridlyRuntimeCountyIdentity.js');
  assert.match(identitySource, /rows\.length !== 254/);
  assert.match(app.slice(app.indexOf('// LP239:')), /gridlyRuntimeCountyIdentity\?\.resolveFips/);
  assert.doesNotMatch(app.slice(app.indexOf('// LP239:')), /Object\.entries\(GRIDLY_COUNTY_REGISTRY \|\| \{\}\)[\s\S]{0,100}countyFips/);
  const lp149 = JSON.parse(read('data/lp149/runtime-county-registry.json'));
  const sandbox = { window: {} };
  vm.createContext(sandbox); vm.runInContext(identitySource, sandbox);
  const runtimeIdentity = sandbox.window.gridlyRuntimeCountyIdentity;
  assert.equal(runtimeIdentity.identityCount, lp149.identityCount);
  assert.ok(lp149.identities.every(({ fips, countyId }) => runtimeIdentity.resolveFips(fips)?.countyId === countyId));
  const cohort = {
    Waskom: ['48203'], Texarkana: ['48037'], Katy: ['48157', '48201', '48473'],
    Pearland: ['48039', '48157', '48201'], 'League City': ['48167', '48201']
  };
  for (const [name, fips] of Object.entries(cohort)) {
    assert.deepEqual(fips.map(value => runtimeIdentity.resolveFips(value)?.countyId), {
      Waskom: ['harrison-tx'], Texarkana: ['bowie-tx'], Katy: ['fort-bend-tx', 'harris-tx', 'waller-tx'],
      Pearland: ['brazoria-tx', 'fort-bend-tx', 'harris-tx'], 'League City': ['galveston-tx', 'harris-tx']
    }[name]);
  }
});
