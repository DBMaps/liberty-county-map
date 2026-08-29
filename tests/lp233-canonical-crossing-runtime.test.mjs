import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root));
const json = relative => JSON.parse(read(relative));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceBytes = read('reports/lp232/crossing-place-memberships.json');
const source = JSON.parse(sourceBytes);
const runtimeBytes = read('data/runtime/canonical-crossing-memberships-v1.json');
const runtime = JSON.parse(runtimeBytes);
const manifest = json('data/runtime/canonical-crossing-memberships-v1.manifest.json');

test('LP232 hash lock and deterministic LP233 rebuild pass', () => {
  assert.equal(sha(sourceBytes), '2d3f409de35eded92b391cfe5525ad17ad822ded255bb7fdf5c2bf45f1dfc958');
  assert.match(execFileSync(process.execPath, ['tools/lp233/build-canonical-crossing-runtime.mjs'], { cwd: root, encoding: 'utf8' }), /verify PASS/);
  assert.equal(sha(runtimeBytes), manifest.runtimeArtifactSha256);
});

test('all 9,094 stable memberships are preserved exactly without duplicates', () => {
  const expected = source.memberships.map(row => `${row.placeGeoid}|${row.crossingId}|${row.sourceCountyFips}|${row.sourceCountyName}`).sort();
  const actual = Object.entries(runtime.places).flatMap(([geoid, row]) => row.x.map(item => `${geoid}|${item.join('|')}`)).sort();
  assert.equal(actual.length, 9094); assert.equal(new Set(actual).size, 9094); assert.deepEqual(actual, expected);
});

test('statewide canonical and zero-crossing certification is retained', () => {
  const rows = Object.values(runtime.places);
  assert.equal(rows.length, 1859); assert.equal(rows.filter(row => row.x.length).length, 760); assert.equal(rows.filter(row => !row.x.length).length, 1099);
  assert.equal(manifest.crossingMembershipCount, 9094);
});

const controls = { '4838476': 11, '4817000': 59, '4805000': 154, '4801000': 49, '4848072': 15, '4870904': 36, '4842568': 17, '4827348': 0, '4873493': 40 };
test('certified owner controls use PLACE GEOID authority', () => {
  for (const [geoid, count] of Object.entries(controls)) assert.equal(runtime.places[geoid].x.length, count, geoid);
  assert.deepEqual(runtime.places['4838476'].m, ['48157', '48201', '48473']);
});

test('Katy, Corpus Christi, and Austin memberships are county-selection invariant', () => {
  for (const geoid of ['4838476', '4817000', '4805000']) {
    const ids = runtime.places[geoid].x.map(row => row[0]);
    for (const selectedMembership of runtime.places[geoid].m) assert.deepEqual(runtime.places[geoid].x.map(row => row[0]), ids, selectedMembership);
  }
});

test('browser lookup rejects display-name-only and missing identities fail closed', async () => {
  const context = { window: {}, fetch: async () => ({ ok: true, json: async () => runtime }) };
  vm.runInNewContext(read('js/gridlyCanonicalCrossingRuntime.js').toString(), context);
  await context.window.gridlyCanonicalCrossingRuntime.load();
  assert.equal(context.window.gridlyCanonicalCrossingRuntime.lookup({ label: 'Katy' }), null);
  assert.equal(context.window.gridlyCanonicalCrossingRuntime.lookup({ placeGeoid: '4899999' }), null);
  assert.equal(context.window.gridlyCanonicalCrossingRuntime.lookup({ placeGeoid: '4838476' }).certifiedCrossingCount, 11);
});

test('watched authority is separate from rendering and preserves governance', () => {
  const app = read('js/app.js').toString();
  const watchedConsumer = app.slice(app.indexOf('function getGridlyBottomPanelAwarenessCrossingCount'), app.indexOf('let gridlyCrossingSelectorRejoinAuditState'));
  assert.match(watchedConsumer, /gridlySelectConsumerVisibleCrossings\(selectedArea\)\.length/);
  assert.doesNotMatch(watchedConsumer, /canonicalMembership|resolvedRuntimeCrossingCount/);
  assert.match(app, /gridlyCanonicalCrossingRuntime\?\.lookup/);
  assert.match(app, /renderingSeparatedFromWatchedMembership/);
  assert.match(app, /selectedMembership === activeCounty/);
  assert.doesNotMatch(read('js/gridlyCanonicalCrossingRuntime.js').toString(), /setActiveCounty|setInterval|setTimeout|pointInPolygon|radiusMiles/);
});

test('LP233 owner audit normalizes Gridly county IDs through registry FIPS authority', () => {
  const app = read('js/app.js').toString();
  const countyFips = countyId => {
    const registryEntry = app.match(new RegExp(`"${countyId}": Object\\.freeze\\(\\{([\\s\\S]*?)\\n  \\}\\),`))?.[1] || '';
    return registryEntry.match(/countyFips: "(\d{5})"/)?.[1] || registryEntry.match(/GEOID (\d{5})/)?.[1] || '';
  };
  const governed = runtime.places['4838476'].m;
  const invariant = (selectedMembership, activeCounty) => {
    const selectedMembershipFips = countyFips(selectedMembership);
    const activeCountyFips = countyFips(activeCounty);
    return selectedMembership === activeCounty
      && Boolean(selectedMembershipFips)
      && selectedMembershipFips === activeCountyFips
      && governed.includes(selectedMembershipFips);
  };

  assert.equal(countyFips('harris-tx'), '48201');
  assert.equal(countyFips('fort-bend-tx'), '48157');
  assert.equal(countyFips('waller-tx'), '48473');
  for (const countyId of ['harris-tx', 'fort-bend-tx', 'waller-tx']) assert.equal(invariant(countyId, countyId), true, countyId);
  assert.equal(invariant('liberty-tx', 'liberty-tx'), false);
  for (const field of ['selectedMembershipFips', 'allGovernedMembershipFips', 'activeCountyFips']) assert.match(app, new RegExp(`\\b${field}\\b`));
  assert.match(app, /GRIDLY_COUNTY_REGISTRY\[countyId\]\?\.countyFips \|\| GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID\?\.\[countyId\]/);
});

test('LP233 runtime contains no geometry, county union, writer, or unrelated awareness integration', () => {
  const runtimeSource = read('js/gridlyCanonicalCrossingRuntime.js').toString();
  assert.doesNotMatch(runtimeSource, /Polygon|coordinates|DriveTexas|weather|hazard|Alert|KBYG|Supabase|writer|poll/);
  assert.equal(runtime.authority, 'LP232 boundary-inclusive covers; stable PLACE GEOID lookup');
});

test('indexed lookup performance remains constant-time and parse-once', () => {
  const start = performance.now(); const parsed = JSON.parse(runtimeBytes); const parseMs = performance.now() - start;
  const lookupStart = performance.now(); for (let index = 0; index < 10000; index += 1) void parsed.places[index % 2 ? '4838476' : '4805000'];
  const lookupMs = performance.now() - lookupStart;
  assert.ok(parseMs < 250, `parse ${parseMs}ms`); assert.ok(lookupMs < 50, `lookups ${lookupMs}ms`);
  console.log(`LP233 performance: bytes=${runtimeBytes.length} parseMs=${parseMs.toFixed(3)} lookups10000Ms=${lookupMs.toFixed(3)}`);
});
