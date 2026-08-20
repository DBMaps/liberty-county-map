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
