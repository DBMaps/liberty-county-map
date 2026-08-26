import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const gridlyLP236AlertsState'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
const sandbox = {
  window: {},
  document: { querySelector: () => null, querySelectorAll: () => [] },
  console,
  gridlyAlertWriterRecordId: (row, index) => row.id || `row-${index}`,
  gridlyAlertsPresentationSourceClass: row => row.sourceClass,
  sanitizeText: value => String(value ?? ''),
  gridlyBuildCanonicalLiveIncidentPresentation: row => ({ title: row.title || row.category || 'Condition', locationLabel: row.location || 'Nearby' }),
  resolveAlertTitleText: row => row.title || row.category || 'Condition',
  pickFirstNonEmptyText: values => values.find(Boolean) || '',
  gridlyLp0952ResolveCrossingAlertTarget: () => ({ coords: {} }),
  gridlyLp0952AlertCardInteractionAttributes: () => '',
  normalizeGridlyUserFacingRoadText: value => value,
  exposeGridlyAuditHelper: () => {}
};
vm.runInNewContext(`${source}\nthis.render = gridlyLP236RenderAlertsPresentation; this.audit = gridlyLP240AlertsStackAudit; this.state = gridlyLP236AlertsState;`, sandbox);

const authority = { activeConditionAuthorityAvailable: true };
const row = (id, type, road, extra = {}) => ({ id, sourceClass: 'official_roadway', category: type, routeName: road, ...extra });
const inspect = rows => {
  const html = sandbox.render(authority, rows);
  return { html, audit: structuredClone(sandbox.audit()) };
};

test('LP240.2A cases A-F and R suppress type disclosures and group repeated roads across types', () => {
  const cases = {
    A: [row('a1', 'Construction', 'US 90')],
    B: [row('b1', 'Construction', 'US 90'), row('b2', 'Construction', 'US 90')],
    C: [row('c1', 'Construction', 'US 90'), row('c2', 'Lane Closure', 'US 90')],
    D: [row('d1', 'Construction', 'US 90'), row('d2', 'Road Closed', 'FM 1960')],
    E: [row('e1', 'Construction', 'US 90'), row('e2', 'Lane Closure', 'US 90'), row('e3', 'Road Closed', 'FM 1960')],
    F: [row('f1', 'Flooding', '')]
  };
  const results = Object.fromEntries(Object.entries(cases).map(([key, rows]) => [key, inspect(rows)]));
  assert.deepEqual([results.A.audit.visibleHierarchy.visibleRoadGroupCount, results.A.audit.visibleHierarchy.directConditionCount], [0, 1]);
  assert.deepEqual(results.B.audit.visibleHierarchy.roadGroups[0].conditionIds, ['b1', 'b2']);
  assert.deepEqual(results.C.audit.visibleHierarchy.roadGroups[0].conditionTypes, ['Construction', 'Lane Closure']);
  assert.deepEqual([results.D.audit.visibleHierarchy.visibleRoadGroupCount, results.D.audit.visibleHierarchy.directConditionCount], [0, 2]);
  assert.deepEqual([results.E.audit.visibleHierarchy.visibleRoadGroupCount, results.E.audit.visibleHierarchy.directConditionCount], [1, 1]);
  assert.equal(results.F.audit.visibleHierarchy.directConditions[0].roadLabel, null);
  for (const { html, audit } of Object.values(results)) {
    const official = html.match(/<details class="gridly-lp236-source"[^>]*data-gridly-lp236-source="official_roadway"[\s\S]*?<\/details>/)?.[0] || '';
    assert.doesNotMatch(official, /class="gridly-lp236-group"/);
    assert.equal(audit.visibleHierarchy.suppressedTypeGroupCount, audit.sources[0].groups.length);
    assert.equal(audit.duplicateIdentityCount, 0);
  }
});

test('LP240.2A cases G-K and O-Q preserve identity, counts, order, Show me, and migrate road disclosure open state', () => {
  sandbox.state.disclosure.initialized = true;
  sandbox.state.disclosure.sourceKeys = new Set(['official_roadway']);
  sandbox.state.disclosure.roadwayGroupKeys = new Set(['official_roadway:construction:us 90']);
  const rows = [
    row('a', 'Construction', 'US 90', { latitude: 30, longitude: -95 }),
    row('b', 'Lane Closure', 'US 90'),
    row('c', 'Road Closed', 'I-45'),
    row('d', 'Construction', 'I-45')
  ];
  const { html, audit } = inspect(rows);
  assert.equal(audit.visibleHierarchy.sourceCount, 4);
  assert.deepEqual(audit.visibleHierarchy.roadGroups.map(group => [group.roadLabel, group.conditionCount]), [['US 90', 2], ['I-45', 2]]);
  assert.deepEqual(audit.visibleHierarchy.roadGroups.flatMap(group => group.conditionIds), ['a', 'b', 'd', 'c']);
  assert.equal(audit.identityCount, 4);
  assert.equal(audit.visibleHierarchy.roadGroups[0].disclosureKey, 'official_roadway:road:us 90');
  assert.match(html, /data-gridly-disclosure-key="official_roadway:road:us 90"[^>]* open/);
  assert.equal((html.match(/data-gridly-lp236-condition-id=/g) || []).length, 4);
  assert.equal((html.match(/gridly-alert-show-on-map/g) || []).length, 1);
});

test('LP240.2A cases L-N leave Weather, Community Reports, and non-active source rendering on LP236 paths', () => {
  const weather = { id: 'w1', sourceClass: 'weather', category: 'hazard', event: 'Heat Advisory', locationLabel: 'Tarkington' };
  const community = { id: 'c1', sourceClass: 'community_report', category: 'High Water', routeName: 'FM 1008' };
  const { html } = inspect([weather, community]);
  assert.match(html, /data-gridly-lp236-source="community_report"[\s\S]*gridly-lp236-group/);
  assert.match(html, /data-gridly-lp236-source="weather"[\s\S]*data-gridly-weather-group-label="true"/);
  assert.match(html, /data-gridly-lp236-source="official_roadway"[^>]*data-gridly-lp236-authority-state="UNAVAILABLE"/);
});
