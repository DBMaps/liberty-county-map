import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js','utf8');
const functionBody = name => app.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}`))?.[0] || '';

test('Location Context broad active-issue count includes shared active hazards', () => {
  const reconcile = functionBody('getGridlyReconciledAwarenessActiveIssueCount');
  assert.match(reconcile, /safeLength\(safeSummary\.activeHazardsInArea\)/);
  assert.match(reconcile, /safeLength\(safeSummary\.activeReportsInArea\)/);
});

test('Alerts narrower grouped count cannot mask a larger shared awareness count', () => {
  const normalize = app.slice(app.indexOf('function normalizeGridlyMobileAwarenessPanelSummary'), app.indexOf('function getGridlyAwarenessSummaryAreaIdentity'));
  assert.match(normalize, /Math\.max\(0, alertsGroupedIssueCount, reconciledActiveIssueCount\)/);
  assert.match(normalize, /const rawActiveIssueCount = hazardCount \+ reportCount \+ crossingReportCount/);
});

test('official publisher lifecycle excludes cleared records, deduplicates, and refreshes statewide shared state', () => {
  const publisher = fs.readFileSync('js/gridlyAwarenessOfficialRoadwayPublisherRepair.js','utf8');
  assert.match(publisher, /cleared\|expired\|inactive\|historical\|removed\|resolved/);
  assert.match(publisher, /const seen = new Set\(existing\.map\(recordKey\)\)/);
  assert.match(publisher, /providerId === "drivetexas"/);
  assert.match(publisher, /refreshGridlyCommunityPulseSharedModel/);
  assert.doesNotMatch(publisher, /Dallas|place-4819000|Houston|place-4835000/);
});
