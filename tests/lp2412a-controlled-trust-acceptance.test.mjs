import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

test('controlled acceptance is an in-memory production-pipeline boundary', () => {
  const start = source.indexOf('function gridlyLP2412ATrustAcceptance(');
  const end = source.indexOf('\nfunction getRouteWatchCommunitySourceIncidents', start);
  assert.ok(start > 0 && end > start, 'acceptance helper is present');
  const helper = source.slice(start, end);

  assert.match(helper, /gridlyResolveRoadHazardCommunityEvidence\(evidence\[0\], evidence, now\)/, 'real lifecycle reducer');
  assert.match(helper, /gridlyBuildRoadHazardIncidentsFromReports\(evidence/, 'real governed incident projection');
  assert.match(helper, /refreshReportHazardViews\(`lp2412a-trust-acceptance-/, 'real map, Alerts, KBYG, and Location Context refresh chain');
  assert.match(helper, /getGridlyCommunityTrustPresentationModel\(/, 'real popup trust presentation');
  assert.doesNotMatch(helper, /supabase|\.insert\s*\(|\.upsert\s*\(|localStorage|sessionStorage|indexedDB/i, 'no persistence API');
  assert.match(helper, /auditFixture:\s*GRIDLY_LP2412A_ACCEPTANCE_TAG/, 'fixture evidence is distinguishable');
  assert.match(helper, /activeHazards = \[\.\.\.snapshot\.activeHazards\]/, 'reset restores the captured runtime collection');
  assert.match(helper, /recentlyClearedRoadHazards = \[\.\.\.snapshot\.recentlyClearedRoadHazards\]/);
});

test('controlled scenarios encode independent evidence without mutating existing report objects', () => {
  assert.match(source, /device_id: `lp2412a-\$\{contributor\}`/);
  assert.match(source, /observation\("active-a"[\s\S]*observation\("active-b"/);
  assert.match(source, /clears\.push\(observation\("clear-b"/);
  assert.match(source, /actives\.push\(observation\("active-restored"/);
  assert.match(source, /gridlyLP2412AAcceptanceSnapshot = \{[\s\S]*\[\.\.\.gridlyDiagnosticArray\(activeHazards\)\]/);
  assert.doesNotMatch(source.slice(source.indexOf('function gridlyLP2412ATrustAcceptance('), source.indexOf('\nfunction getRouteWatchCommunitySourceIncidents')), /Object\.assign\(|\.splice\(|\.shift\(|\.pop\(/);
});

test('audit result covers the owner acceptance contract', () => {
  for (const field of [
    'scenario', 'lifecycleResolution', 'governedConditionCount', 'mapContributionCount',
    'alertsContributionCount', 'kbygContributionCount', 'locationContextContributionCount',
    'recentlyClearedContributionCount', 'duplicateCount', 'expectedCopy', 'actualCopy', 'pass'
  ]) assert.match(source, new RegExp(`\\b${field}\\b`), field);
  assert.match(source, /\{ conflict: "conflict", cleared: "recently_cleared", restored: "active" \}/);
  assert.match(source, /Math\.max\(0, activeCount \+ recentlyClearedCount - 1\)/);
});
