import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const gridlyLP236AlertsState'), app.indexOf('\n  function buildAlertsSurfaceHtml'));

const rows = [
  { id: 'official', sourceClass: 'official_roadway', category: 'Closure', routeName: 'US 69' },
  { id: 'community', sourceClass: 'community_report', category: 'Blocked', roadName: 'Main St' },
  { id: 'weather', sourceClass: 'weather', event: 'Flood Warning' }
];

function harness() {
  let mounted = null;
  const document = {
    querySelector: selector => selector === '[data-gridly-lp236-alerts]' ? mounted : null,
    querySelectorAll: () => []
  };
  const sandbox = {
    window: {}, globalThis: {}, document,
    gridlyAlertWriterRecordId: row => row.id,
    gridlyAlertsPresentationSourceClass: row => row.sourceClass,
    sanitizeText: value => String(value ?? ''),
    gridlyBuildCanonicalLiveIncidentPresentation: row => ({ title: row.category || row.event, locationLabel: row.roadName || row.routeName }),
    resolveAlertTitleText: row => row.category || row.event,
    pickFirstNonEmptyText: values => values.find(Boolean) || '',
    gridlyLp0952ResolveCrossingAlertTarget: () => ({ coords: {} }),
    gridlyLp0952AlertCardInteractionAttributes: () => '',
    normalizeGridlyUserFacingRoadText: value => value,
    exposeGridlyAuditHelper: () => {}
  };
  vm.runInNewContext(`${source}\nthis.render = gridlyLP236RenderAlertsPresentation; this.state = gridlyLP236AlertsState;`, sandbox);
  const mount = states => {
    const nodes = Object.entries(states).map(([key, open]) => ({ open, dataset: { gridlyDisclosureKey: key } }));
    mounted = {
      matches: selector => selector === '[data-gridly-lp236-alerts]',
      querySelectorAll: selector => selector === 'details.gridly-lp236-source[open]' ? nodes.filter(node => node.open) : []
    };
  };
  return { sandbox, mount };
}

function sourceIsOpen(html, key) {
  const tag = html.match(new RegExp(`<details class="gridly-lp236-source"[^>]*data-gridly-disclosure-key="${key}"[^>]*>`))?.[0] || '';
  return / open>/.test(tag);
}

test('LP243.C sibling disclosures remain independent across passive rerenders', () => {
  const { sandbox, mount } = harness();
  mount({ official_roadway: false, community_report: true, weather: false });
  let html = sandbox.render({ activeConditionAuthorityAvailable: true }, rows);
  assert.equal(sourceIsOpen(html, 'official_roadway'), false, 'discovery case keeps Official Roadways collapsed');
  assert.equal(sourceIsOpen(html, 'community_report'), true);
  assert.equal(sourceIsOpen(html, 'weather'), false, 'Weather does not mutate siblings');

  mount({ official_roadway: true, community_report: false, weather: false });
  html = sandbox.render({ activeConditionAuthorityAvailable: true }, rows);
  assert.equal(sourceIsOpen(html, 'official_roadway'), true);
  assert.equal(sourceIsOpen(html, 'community_report'), false, 'reverse control keeps Community Reports collapsed');

  for (const states of [
    { official_roadway: true, community_report: true, weather: false },
    { official_roadway: false, community_report: false, weather: false }
  ]) {
    mount(states);
    html = sandbox.render({ activeConditionAuthorityAvailable: true }, rows);
    assert.equal(sourceIsOpen(html, 'official_roadway'), states.official_roadway);
    assert.equal(sourceIsOpen(html, 'community_report'), states.community_report);
  }
});

test('LP243.C semantic source state survives count changes and absent siblings', () => {
  const { sandbox, mount } = harness();
  mount({ official_roadway: false, community_report: true });
  const changed = [...rows, { id: 'community-2', sourceClass: 'community_report', category: 'Flooding', roadName: 'Oak St' }];
  let html = sandbox.render({ activeConditionAuthorityAvailable: true }, changed);
  assert.equal(sourceIsOpen(html, 'official_roadway'), false);
  assert.equal(sourceIsOpen(html, 'community_report'), true);

  mount({ official_roadway: false });
  html = sandbox.render({ activeConditionAuthorityAvailable: true }, rows.filter(row => row.sourceClass === 'official_roadway'));
  assert.equal(sourceIsOpen(html, 'official_roadway'), false, 'missing groups cannot corrupt a surviving semantic sibling');
});

test('LP243.C captures disclosure state before replacement markup is computed', () => {
  const renderer = app.slice(app.indexOf('function gridlyLP236RenderAlertsPresentation'), app.indexOf('window.gridlyLP236RenderAlertsPresentation ='));
  assert.ok(renderer.indexOf('gridlyLP236CaptureDisclosureState(document)') < renderer.indexOf('gridlyLP236BuildModel('));
  const writerStart = app.indexOf('const mountLP236AlertsPresentation');
  const writer = app.slice(writerStart, app.indexOf('const transaction =', writerStart));
  assert.match(writer, /const html = renderedHtml \?\?/);
  assert.match(writer, /gridlyLP236CaptureDisclosureState\?\.\(document\)/, 'writer fallback remains as defense for direct mounts');
});
