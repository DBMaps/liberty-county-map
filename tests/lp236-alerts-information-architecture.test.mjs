import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const gridlyLP236AlertsState'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
const sandbox = {
  window: {}, globalThis: {}, document: { querySelector: () => null },
  gridlyAlertWriterRecordId: (row, index) => row.id || `row-${index}`,
  gridlyAlertsPresentationSourceClass: row => row.sourceClass,
  exposeGridlyAuditHelper: () => {}
};
vm.runInNewContext(`${source}\nthis.buildLP236 = gridlyLP236BuildModel;`, sandbox);
const build = rows => sandbox.buildLP236(rows, { authoritativeMembership: { community: 'Dallas' } });

test('top and section counts use governed active identities rather than presentation cards', () => {
  const model = build(Array.from({ length: 26 }, (_, index) => ({ id: `official-${index}`, sourceClass: 'official_roadway', category: index % 2 ? 'Lane Closure' : 'Road Closure' })));
  assert.equal(model.total, 26);
  assert.equal(model.sections[0].activeConditionCount, 26);
  assert.equal(model.sections[0].groups.reduce((sum, group) => sum + group.rows.length, 0), 26);
});

test('source grouping precedes deterministic condition grouping and preserves semantics', () => {
  const model = build([
    { id: 'o', sourceClass: 'official_roadway', category: 'Lane Closure' },
    { id: 'c', sourceClass: 'community_report', type: 'High Water' },
    { id: 'w', sourceClass: 'weather', event: 'Flash Flood Warning' }
  ]);
  assert.deepEqual(Array.from(model.sections, section => section.sourceClass), ['official_roadway', 'community_report', 'weather']);
  assert.equal(model.sections[0].groups[0].conditionType, 'lane_closures');
  assert.equal(model.sections[1].groups[0].rows[0].canonicalId, 'c');
  assert.equal(model.sections[2].groups[0].rows[0].canonicalId, 'w');
});

test('large inventories remain compact by default while retaining every lineage row', () => {
  for (const count of [1, 5, 26, 50, 100]) {
    const model = build(Array.from({ length: count }, (_, index) => ({ id: `id-${index}`, sourceClass: 'official_roadway', category: `Type ${index % 7}` })));
    assert.equal(model.sections.flatMap(section => section.groups.flatMap(group => group.rows)).length, count);
    assert.equal(new Set(model.sections.flatMap(section => section.groups.flatMap(group => group.rows.map(row => row.canonicalId)))).size, count);
  }
  assert.match(app, /const open = model\.total === 1 \|\| \(model\.total <= 5/);
  assert.doesNotMatch(app.slice(app.indexOf('function gridlyLP236BuildModel'), app.indexOf('function gridlyLP236AlertsInformationArchitectureAudit')), /slice\(0,/);
});

test('critical callouts require weather source and governed severity', () => {
  const model = build([
    { id: 'routine-weather', sourceClass: 'weather', event: 'Rain Advisory' },
    { id: 'severe-weather', sourceClass: 'weather', event: 'Flood Warning', severity: 'severe' },
    { id: 'road', sourceClass: 'official_roadway', category: 'Closure', severity: 'high' }
  ]);
  assert.deepEqual(Array.from(model.critical, row => row.canonicalId), ['severe-weather']);
});

test('markup preserves compact detail, Show me, empty omission, and accessible native disclosure', () => {
  for (const token of ['gridly-lp236-source', 'gridly-lp236-group', 'gridly-lp236-condition-details', 'gridly-alert-show-on-map', 'aria-label=', '<details', '<summary']) assert.match(app, new RegExp(token));
  assert.match(css, /min-height:48px/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(app, /filter\(\(section\) => section\.activeConditionCount > 0\)/);
});

test('LP236 is a bounded passive presentation and protected systems remain untouched', () => {
  const lp236 = app.slice(app.indexOf('// LP236 is a presentation projection'), app.indexOf('function escapeV2SettingsText'));
  assert.doesNotMatch(lp236, /fetch\(|setInterval|setTimeout|navigator\.geolocation|turf\.|Dallas|Austin|Katy|Corpus Christi|Abilene|Midland/);
  assert.match(lp236, /gridlyFilterAlertRecordsBySelectedAwarenessArea/);
  assert.match(lp236, /gridlyLp0952ResolveCrossingAlertTarget/);
  for (const field of ['totalActiveConditionCount', 'sections', 'criticalCalloutCount', 'officialRoadwayConditionCount', 'communityReportConditionCount', 'weatherConditionCount', 'displayedConditionIdentityCount', 'unrepresentedConditionIds', 'duplicateDisplayedConditionIds', 'sourceSemanticsPass', 'countSemanticsPass', 'identityCoveragePass', 'showMeActionCount', 'emptySectionsRendered', 'accessibilityPass', 'overallPass']) assert.match(lp236, new RegExp(field));
});
