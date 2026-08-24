import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const publisher = fs.readFileSync('js/gridlyAlertsPublishedAwareness.js', 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const body = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test('Fredericksburg published HEALTHY_WITH_DATA alert survives an empty canonical projection', () => {
  const record = {
    id: 'drivetexas:provider:FE00C70A-A3F8-4CEB-8970-228FD50A14CD',
    type: 'Lane Closure',
    title: 'Road closed on US 87',
    severity: 'high',
    providerId: 'drivetexas',
    lifecycleState: 'active'
  };
  const sandbox = {
    gridlyGetCanonicalActiveCommunityState: () => ({ activeRecords: [] }),
    gridlyGetPublishedAwarenessAlertRecordsForCurrentArea: () => [record],
    getGridlyActiveCountSurfaceRows: rows => rows,
    gridlyAlertsGetActiveRenderContext: () => null,
    window: {}
  };
  vm.runInNewContext(`${functionSource(app, 'getGridlyAlertsSurfaceActiveCommunityReportRows')};this.rows=getGridlyAlertsSurfaceActiveCommunityReportRows;`, sandbox);
  const rows = sandbox.rows({ skipLocalizedFallback: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, record.id);
  assert.equal(sandbox.rows({ skipLocalizedFallback: true }).length, 1, 'the active count projection converges on the same row set');
});

test('published Alerts sheet exposes the ranked heading as rendered DOM evidence', () => {
  assert.match(publisher, /resolveGridlyAlertsPanelHeadingCandidate\(\{/);
  assert.match(publisher, /data-gridly-alerts-panel-heading/);
  assert.match(publisher, /class="gridly-alert-headline"/);
  assert.match(publisher, /data-gridly-alert-title="\$\{esc\(title\)\}"/);
});

test('published-awareness markup helper exposes the ranked heading and active card to audited DOM selectors', () => {
  const record = {
    id: 'drivetexas:provider:FE00C70A-A3F8-4CEB-8970-228FD50A14CD',
    type: 'Lane Closure',
    title: 'Road closed on US 87',
    severity: 'high',
    providerId: 'drivetexas',
    lifecycleState: 'active'
  };
  const sandbox = {
    cleanDisplayValue: value => String(value || '').trim(),
    normalizeGridlyCountyAwareDisplayText: value => String(value || '').trim(),
    gridlyResolveVisibleAlertCardLocationLine: () => 'US 87',
    gridlyGetPublishedAwarenessConsumerSummary: () => 'Road closure reported.',
    gridlyBuildVisibleAlertLocationLineMarkup: (location, escape) => `<div>${escape(location)}</div>`,
    gridlyPublishedAwarenessCleanConsumerText: value => String(value || '').trim(),
    gridlyBuildNeutralAlertsSheetMarkup: () => '<div class="gridly-alerts-active"></div>',
    resolveGridlyAlertsPanelHeadingCandidate: () => ({
      selectedAlertsPanelHeadingCandidate: 'Road closed on US 87',
      selectedAlertsPanelHeadingSource: 'active-community-row.title'
    }),
    esc: value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
  };
  vm.runInNewContext(`${functionSource(publisher, 'gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords')};this.build=gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords;`, sandbox);
  const markup = sandbox.build([record]);
  assert.match(markup, /class="gridly-alerts-active"[\s\S]*data-gridly-alerts-panel-heading[\s\S]*>Road closed on US 87<\/h3>/);
  assert.equal((markup.match(/data-gridly-alert-row="true"/g) || []).length, 1);
  assert.match(markup, /data-gridly-alert-title="Road closed on US 87"/);

  assert.doesNotMatch(publisher, /function openAlertsSurfaceFromDock|window\.openAlertsSurfaceFromDock\s*=/,
    'published-awareness retains its markup helper without claiming dock-open authority');
});

test('read-only Alerts audit distinguishes closed lazy state from an open render failure', () => {
  const audit = functionSource(app, 'getGridlyAlertsPanelAuditSnapshot');
  assert.match(audit, /renderContract:\s*"lazy-on-alerts-open"/);
  assert.match(audit, /renderedDomExpected:\s*alertsPanelOpen/);
  assert.match(audit, /"not-rendered-while-closed"/);
  assert.match(audit, /"missing-while-open"/);
});

test('previous UTSA / Northwest context cannot own Fredericksburg distance metadata', () => {
  const sandbox = {
    getGridlyCanonicalAwarenessPresentationContext: () => ({
      canonicalKey: 'place-4827348', label: 'Fredericksburg', countyId: 'gillespie-tx', lat: 30.2752, lng: -98.8719
    }),
    getGridlySelectedAwarenessArea: () => ({ label: 'UTSA / Northwest', lat: 29.5919, lng: -98.6147 }),
    haversineDistance: () => 2.4,
    formatGridlyV313RoadHazardDistanceMiles: miles => `${Math.round(miles)} miles`
  };
  vm.runInNewContext(`${functionSource(app, 'resolveGridlyV313RoadHazardCommunityDistance')};this.resolve=resolveGridlyV313RoadHazardCommunityDistance;`, sandbox);
  const result = sandbox.resolve({ lat: 30.3, lng: -98.9 });
  assert.equal(result.community, 'Fredericksburg');
  assert.doesNotMatch(result.text, /UTSA|Northwest/);
});

test('repair remains statewide and does not alter protected subsystem contracts', () => {
  const changedContract = functionSource(app, 'getGridlyAlertsSurfaceActiveCommunityReportRows');
  assert.doesNotMatch(changedContract, /Fredericksburg|US 87|FE00C70A/);
  assert.doesNotMatch(publisher, /Fredericksburg|US 87|FE00C70A/);
});
