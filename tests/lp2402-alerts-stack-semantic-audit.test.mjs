import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const gridlyLP236AlertsState'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
const sandbox = {
  window: {}, document: { querySelector: () => null },
  gridlyAlertWriterRecordId: (row, index) => row.id || `row-${index}`,
  gridlyAlertsPresentationSourceClass: row => row.sourceClass,
  sanitizeText: value => String(value ?? ''),
  gridlyBuildCanonicalLiveIncidentPresentation: row => ({ title: row.title || row.event || row.category || 'Condition', locationLabel: row.location || 'Nearby' }),
  resolveAlertTitleText: row => row.title || row.event || row.category || 'Condition',
  pickFirstNonEmptyText: values => values.find(Boolean) || '',
  gridlyLp0952ResolveCrossingAlertTarget: () => ({ coords: {} }),
  gridlyLp0952AlertCardInteractionAttributes: () => '',
  normalizeGridlyUserFacingRoadText: value => value,
  exposeGridlyAuditHelper: () => {}
};
vm.runInNewContext(`${source}\nthis.render = gridlyLP236RenderAlertsPresentation; this.stackAudit = gridlyLP240AlertsStackAudit;`, sandbox);
const authority = { activeConditionAuthorityAvailable: true };
const inspect = rows => { sandbox.render(authority, rows); return structuredClone(sandbox.stackAudit()); };
const row = (id, sourceClass, type, road, extra = {}) => ({ id, sourceClass, category: type, routeName: road, ...extra });
const active = audit => audit.sources.filter(source => source.sourceCount);
const hierarchy = audit => active(audit).map(source => ({
  source: source.sourceClass, count: source.sourceCount,
  groups: source.groups.map(group => ({ type: group.groupKey, count: group.groupCount, key: group.disclosureKey,
    roads: group.roadGroups.map(roadGroup => ({ road: roadGroup.roadLabel, count: roadGroup.roadCount, key: roadGroup.disclosureKey, ids: roadGroup.conditions.map(condition => condition.conditionId) })),
    direct: group.conditions.map(condition => condition.conditionId) }))
}));

test('LP240.2 shapes A-F certify the exact current official-roadway hierarchy', () => {
  const cases = {
    A: [row('a1', 'official_roadway', 'Construction', 'US 90')],
    B: [row('b1', 'official_roadway', 'Construction', 'US 90'), row('b2', 'official_roadway', 'Construction', 'US 90')],
    C: [row('c1', 'official_roadway', 'Construction', 'US 90'), row('c2', 'official_roadway', 'Construction', 'US 90'), row('c3', 'official_roadway', 'Construction', 'I-45'), row('c4', 'official_roadway', 'Construction', 'I-45')],
    D: [row('d1', 'official_roadway', 'Construction', 'US 90'), row('d2', 'official_roadway', 'Road Closed', 'US 90')],
    E: [row('e1', 'official_roadway', 'Construction', 'US 90'), row('e2', 'official_roadway', 'Construction', 'US 90'), row('e3', 'official_roadway', 'Road Closed', 'I-45'), row('e4', 'official_roadway', 'Road Closed', 'I-45')],
    F: [row('f1', 'official_roadway', 'Construction', '')]
  };
  const audited = Object.fromEntries(Object.entries(cases).map(([key, rows]) => [key, hierarchy(inspect(rows))[0]]));
  assert.deepEqual(audited.A.groups[0], { type: 'construction', count: 1, key: 'official_roadway:construction', roads: [], direct: ['a1'] });
  assert.deepEqual(audited.B.groups[0].roads[0], { road: 'US 90', count: 2, key: 'official_roadway:construction:us 90', ids: ['b1', 'b2'] });
  assert.deepEqual(audited.C.groups[0].roads.map(r => r.road), ['US 90', 'I-45']);
  assert.deepEqual(audited.D.groups.map(g => [g.type, g.roads.length, g.direct]), [['construction', 0, ['d1']], ['road_closures', 0, ['d2']]]);
  assert.deepEqual(audited.E.groups.map(g => [g.type, g.roads[0].road]), [['construction', 'US 90'], ['road_closures', 'I-45']]);
  assert.deepEqual(audited.F.groups[0].direct, ['f1']);
});

test('LP240.2 shapes G-I independently freeze Community and Weather controls', () => {
  const g = inspect([row('g1', 'community_report', 'Blocked Crossing', 'FM 1008', { lat: 30.1, lng: -94.9 })]);
  assert.deepEqual(hierarchy(g)[0].groups[0], { type: 'blocked_crossing', count: 1, key: 'community_report:blocked_crossing', roads: [], direct: ['g1'] });
  assert.equal(active(g)[0].groups[0].conditions[0].showMeTargetAvailable, true);
  const h = inspect([row('h1', 'weather', 'hazard', '', { event: 'Heat Advisory', locationLabel: 'Tarkington', lat: 30.2, lng: -94.8 })]);
  assert.deepEqual(hierarchy(h)[0].groups[0], { type: 'heat_advisory', count: 1, key: 'weather:heat_advisory', roads: [], direct: ['h1'] });
  const i = inspect([
    row('i2', 'weather', 'hazard', '', { event: 'Heat Advisory' }),
    row('i1', 'weather', 'hazard', '', { event: 'Heat Advisory' }),
    row('i3', 'weather', 'hazard', '', { event: 'Flood Warning' })
  ]);
  assert.deepEqual(hierarchy(i)[0].groups.map(group => [group.type, group.count, group.direct]), [['flood_warning', 1, ['i3']], ['heat_advisory', 2, ['i1', 'i2']]]);
  assert.ok(active(i)[0].groups.every(group => group.roadGroups.length === 0));
});

test('LP240.2 shape J freezes source order, counts, identity uniqueness, keys, and Show me ownership', () => {
  const audit = inspect([
    row('o2', 'official_roadway', 'Construction', 'US 90', { latitude: 30, longitude: -95 }),
    row('o1', 'official_roadway', 'Construction', 'US 90'),
    row('c1', 'community_report', 'High Water', '', { lat: 30.1, lng: -95.1 }),
    row('w1', 'weather', 'hazard', '', { event: 'Heat Advisory' })
  ]);
  assert.deepEqual(audit.sourceOrder, ['official_roadway', 'community_report', 'weather']);
  assert.deepEqual(audit.sources.map(source => source.sourceCount), [2, 1, 1]);
  assert.deepEqual(audit.conditionIds, ['o1', 'o2', 'c1', 'w1']);
  assert.deepEqual(audit.duplicateConditionIds, []);
  assert.equal(audit.sources[0].groups[0].roadGroups[0].disclosureKey, 'official_roadway:construction:us 90');
  const conditions = audit.sources.flatMap(source => source.groups.flatMap(group => [...group.conditions, ...group.roadGroups.flatMap(road => road.conditions)]));
  assert.ok(conditions.every(condition => condition.disclosureKey === null));
  assert.deepEqual(conditions.filter(condition => condition.showMeTargetAvailable).map(condition => condition.conditionId), ['o2', 'c1']);
});

test('LP240.2 helper is passive and the product renderer remains structurally unchanged', () => {
  const helper = source.slice(source.indexOf('function gridlyLP240AlertsStackAudit'), source.indexOf('function gridlyLP236RenderAlertsPresentation'));
  assert.doesNotMatch(helper, /\.open\s*=|innerHTML|replaceChildren|appendChild|gridlyLP236BuildModel\(/);
  assert.match(helper, /gridlyLP236AlertsState\.model/);
  assert.match(app, /window\.gridlyLP240AlertsStackAudit = gridlyLP240AlertsStackAudit/);
});
