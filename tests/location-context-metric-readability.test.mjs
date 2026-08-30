import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const source = app.match(/function buildGridlyLocationContextMetricLines\([\s\S]*?\n}/)?.[0];
assert.ok(source, 'shared Location Context formatter exists');
const present = Function(`${source}; return buildGridlyLocationContextMetricLines;`)();
const line = (activeIssueCount, reportCount = 0, crossingsWatchedCount = 0) =>
  present({ activeIssueCount, reportCount, crossingsWatchedCount, crossingInventoryAvailable: true });

test('collapsed Dallas card presents actionable state without inventory metrics', () => {
  assert.deepEqual(line(16, 17, 209), {
    activeIssuesLine: '16 active issues nearby',
    secondaryMetricsLine: ''
  });
});

test('quiet, singular, and plural active-condition grammar is truthful', () => {
  assert.equal(line(0).activeIssuesLine, 'No active issues nearby');
  assert.equal(line(1).activeIssuesLine, '1 active issue nearby');
  assert.equal(line(2).activeIssuesLine, '2 active issues nearby');
});

test('shared collapsed renderer suppresses duplicate title, status, and inventory row', () => {
  const sync = app.slice(app.indexOf('function syncMobileDestinationCommandCard'), app.indexOf('function clearGridlyDestinationRoutePreview'));
  assert.match(sync, /safeText\("mobileAwarenessPanelKicker", getGridlyLocationAwarenessCardKicker/);
  assert.match(sync, /safeText\("mobileDestinationCommandTitle", ""\)/);
  assert.match(sync, /safeText\("mobileDestinationCommandMeta", ""\)/);
  assert.match(sync, /safeText\("mobileAwarenessPanelIssues", awarenessSummary\.activeIssuesLine\)/);
  assert.match(sync, /safeText\("mobileAwarenessPanelCrossings", ""\)/);
  assert.match(sync, /mobileDestinationCommandTitle"\)\?\.toggleAttribute\("hidden", true\)/);
  assert.match(sync, /mobileDestinationCommandMeta"\)\?\.toggleAttribute\("hidden", true\)/);
  assert.match(sync, /mobileAwarenessPanelCrossings"\)\?\.toggleAttribute\("hidden", true\)/);
  assert.doesNotMatch(sync, /safeText\("mobileAwarenessPanelCrossings", awarenessSummary\.secondaryMetricsLine\)/);
});

test('underlying report and watched-crossing authorities remain in the summary model', () => {
  const normalize = app.slice(app.indexOf('function normalizeGridlyMobileAwarenessPanelSummary'), app.indexOf('function getGridlyAwarenessSummaryAreaIdentity'));
  assert.match(normalize, /homeLocationContextReportCount: evidenceReportCount/);
  assert.match(normalize, /crossingsWatchedCount: crossingWatchModel\.crossingsWatchedCount/);
  assert.match(normalize, /crossingWatchModel,/);
  assert.match(normalize, /resolveLocationContextActiveIssueCount/);
  assert.match(normalize, /alertsGroupedIssueCount/);
});

test('Search remains a single action wired to the existing search shell', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/id="mobileDestinationCommandBtn"/g) || []).length, 1);
  assert.match(html, /id="mobileDestinationCommandBtn"[^>]*aria-controls="gridlySearchShell"/);
  assert.match(app, /safeText\("mobileDestinationCommandBtn", "Search"\)/);
  assert.match(app, /els\.mobileDestinationCommandBtn\.addEventListener\("click"[\s\S]*?openGridlyDestinationSearchSurface\(\{ source: "destinationCommandButton" \}\)/);
});

test('repair is shared and contains no community-specific exception', () => {
  const formatterAndRenderer = app.slice(app.indexOf('function buildGridlyLocationContextMetricLines'), app.indexOf('function clearGridlyDestinationRoutePreview'));
  assert.doesNotMatch(formatterAndRenderer, /Dallas|Dayton|Tarkington|789|209/);
});
