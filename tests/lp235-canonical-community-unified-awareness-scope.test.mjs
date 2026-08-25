import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memberships = JSON.parse(read('data/runtime/canonical-crossing-memberships-v1.json'));
const recordAsset = JSON.parse(read('data/runtime/canonical-crossing-records-v1.json'));
const app = read('js/app.js');
const controls = { '4805000':154, '4819000':415, '4838476':11, '4817000':59, '4801000':49, '4848072':15, '4870904':36, '4842568':17, '4827348':0, '4873493':40 };

test('canonical PLACE search publishes one identity row and county behavior remains separate', () => {
  assert.match(app, /a governed membership is not a search-result identity/);
  assert.match(app, /canonicalGroups\.push/);
  assert.doesNotMatch(app, /occurrences\.forEach\(\(\{ group, community \}\) => canonicalGroups\.push/);
  assert.match(app, /countyLabel: "City"/);
  assert.match(app, /community\.countyWide \? `Watch all of/);
});

test('same-name identity is never the dedup key', () => {
  assert.match(app, /occurrencesByPlaceGeoid/);
  assert.match(app, /community\.placeGeoid/);
  assert.doesNotMatch(app, /collapsedNames|occurrencesByName/);
});

test('multi-county controls retain identical membership independent of selected county', () => {
  for (const geoid of ['4805000','4819000','4838476','4817000','4801000','4848072']) {
    const ids = memberships.places[geoid].x.map(row => row[0]);
    assert.ok(memberships.places[geoid].m.length > 1, geoid);
    for (const _membership of memberships.places[geoid].m) assert.deepEqual(memberships.places[geoid].x.map(row => row[0]), ids);
  }
});

test('LP233 IDs and single-county controls remain unchanged and all resolve exactly', () => {
  for (const [geoid,count] of Object.entries(controls)) {
    const ids = memberships.places[geoid].x.map(row => row[0]);
    assert.equal(ids.length,count,geoid);
    assert.equal(ids.filter(id => recordAsset.records[id]).length,count,geoid);
  }
  assert.equal(Object.keys(recordAsset.records).length,9094);
});

test('browser runtime resolves exact canonical records and fails closed', async () => {
  const context={window:{},fetch:async url=>({ok:true,json:async()=>url.includes('records')?recordAsset:memberships})};
  vm.runInNewContext(read('js/gridlyCanonicalCrossingRuntime.js'),context);
  await context.window.gridlyCanonicalCrossingRuntime.load();
  const d=context.window.gridlyCanonicalCrossingRuntime.resolveRecords({canonicalKey:'place-4819000'});
  assert.equal(d.membership.certifiedCrossingCount,415); assert.equal(d.records.length,415); assert.equal(d.authorityAvailable,true);
  assert.equal(context.window.gridlyCanonicalCrossingRuntime.resolveRecords({label:'Dallas'}),null);
});

test('map bridge preserves viewport and representative policy instead of county inventory', () => {
  assert.match(app, /canonicalResolution\?\.authorityAvailable[\s\S]*canonicalResolution\.records/);
  assert.match(app, /getGridlyPolicyVisibleCrossings/);
  assert.match(app, /visibilityPolicy\.useViewport/);
  assert.match(app, /visibilityPolicy\.markerLimit/);
  assert.match(app, /renderMode !== "representative"/);
  assert.doesNotMatch(app, /canonicalResolution[\s\S]{0,300}setActiveCounty/);
});

test('provider and consumer authorities remain protected and fail closed', () => {
  assert.match(app, /gridlyLP235CanonicalCommunityScopeAudit/);
  assert.match(app, /active local reports do not expose certified PLACE attribution/);
  assert.match(app, /provider point\/zone authority unavailable/);
  assert.match(app, /LP233 exact crossing IDs -> governed runtime record index -> existing viewport/);
  assert.match(app, /alertsUnaccountedIds/);
  assert.match(app, /allGovernedEvidenceAccountedFor/);
  assert.doesNotMatch(app.slice(app.indexOf('// LP235 is passive')), /setInterval|setTimeout|pointInPolygon|setActiveCounty/);
});
