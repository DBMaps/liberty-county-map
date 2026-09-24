const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const app = fs.readFileSync('js/app.js', 'utf8');
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const h = {
  gridlyTravelBriefCleanLine: value => value,
  gridlyDestinationDecisionFreshnessLine: () => "Checked just now",
  getGridlyDestinationRouteReasonInspectionText: row => [row.type, row.title].join(' ').toLowerCase()
};
vm.createContext(h);
for (const [start, end] of [
  ['function buildGridlyDestinationDecisionPresentation(', 'function getGridlyDestinationRouteReasonInspectionText('],
  ['function gridlyCrossingPresentationState(', 'function gridlyStoryCrossingEvidence('],
  ['function gridlyStoryConfidence(', 'function gridlyStoryConditionIdentity('],
  ['function gridlyTravelBriefConfidenceLine(', 'function gridlyBuildTravelBriefDecisionSection('],
  ['function gridlyTravelBriefDecisionReason(', '// LP064 is a presentation adapter'],
  ['function getGridlyDestinationRouteActiveRailReasonCopy(', 'const GRIDLY_DESTINATION_IMPACT_PANE_STATE']
]) vm.runInContext(section(start, end), h);

test('explicit crossing delay beats stored blocking prose without changing source data', () => {
  for (const type of ['heavy', 'delay', 'delayed', 'rail_delay']) {
    const row = Object.freeze({ reportKind: 'crossing', type, severity: 'high', title: 'Train blocking crossing', detail: 'A train is blocking this crossing.' });
    const before = JSON.stringify(row);
    assert.equal(h.gridlyCrossingPresentationState(row), 'delay');
    assert.match(h.getGridlyDestinationRouteActiveRailReasonCopy([row]), /reported crossing delay/);
    assert.doesNotMatch(h.getGridlyDestinationRouteActiveRailReasonCopy([row]), /blocked|blocking/);
    assert.equal(JSON.stringify(row), before);
  }
});

test('canonical raw state outranks an obsolete outer presentation title/type', () => {
  assert.equal(h.gridlyCrossingPresentationState({ type: 'rail_blocked', raw: { reportKind: 'crossing', legacyReportType: 'heavy' } }), 'delay');
  assert.equal(h.gridlyCrossingPresentationState({ crossingId: 'FRA-762785P', report_type: 'heavy', type: 'rail_blockage_delay' }), 'delay');
});

test('blocked and cleared remain distinct, and road hazards do not acquire rail ownership', () => {
  assert.equal(h.gridlyCrossingPresentationState({ reportKind: 'crossing', type: 'blocked' }), 'blocked');
  assert.equal(h.gridlyCrossingPresentationState({ reportKind: 'crossing', type: 'cleared' }), 'cleared');
  assert.equal(h.gridlyCrossingPresentationState({ reportKind: 'hazard', type: 'road_closed', title: 'Road blocked near tracks' }), '');
  assert.equal(h.gridlyCrossingPresentationState({ type: 'heavy', source: 'official_roadway' }), '');
});

test('mixed crossing states preserve the blockage warning while delay-only brief stays precise', () => {
  const records = [{ reportKind: 'crossing', type: 'heavy' }, { reportKind: 'crossing', type: 'blocked' }];
  assert.match(h.getGridlyDestinationRouteActiveRailReasonCopy(records), /blocked crossing/);
  assert.equal(h.gridlyTravelBriefDecisionReason({}, { community: { count: 1 }, rail: { count: 1, delayCount: 1, blockedCount: 0 } }), 'Community reports indicate a crossing delay.');
  assert.equal(h.gridlyTravelBriefDecisionReason({}, { community: { count: 1 }, rail: { count: 1, delayCount: 0, blockedCount: 1 } }), 'Community reports indicate a blocked crossing.');
});

test('one rail report is one evidence signal; three reports retain the protected activity wording', () => {
  const confidence = h.gridlyStoryConfidence([{ id: 'one' }], { community: { count: 1 }, rail: { count: 1 } });
  assert.equal(h.gridlyTravelBriefConfidenceLine({ confidence }), 'Developing conditions.');
  const multiple = h.gridlyStoryConfidence([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { community: { count: 3 } });
  assert.equal(h.gridlyTravelBriefConfidenceLine({ confidence: multiple }), 'Multiple recent signals.');
});


test('route projections keep delay semantics and do not double-count or corroborate one report', () => {
  const projected = { id: 'same-report', type: 'heavy', title: 'MAIN STREET train blocking crossing', sourceType: 'user', sourceLocationFields: { crossingName: 'MAIN STREET' } };
  assert.equal(h.gridlyCrossingPresentationState(projected), 'delay');
  const reason = h.getGridlyDestinationRouteActiveRailReasonCopy([projected]);
  const presentation = h.buildGridlyDestinationDecisionPresentation({
    audit: { impactLevel: 'high', alertsConsidered: 1, reportsConsidered: 1, primaryImpactReason: reason, confidenceLabel: 'Live reports checked' },
    intelligence: { matchedAlerts: [projected], matchedReports: [projected] },
    coverage: { coverageState: 'COVERAGE_INCOMPLETE' }
  });
  assert.equal(presentation.state, 'active');
  assert.match(presentation.reason, /reported crossing delay/);
  assert.equal(presentation.confidence, 'Developing conditions');
});
