const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const cleared = { reportId: 'pecos-cleared', sourceKind: 'community_report', subtype: 'cleared', status: 'cleared', countyId: 'reeves' };
const blocked = { reportId: 'pecos-blocked', sourceKind: 'community_report', subtype: 'blocked_crossing', active: true, countyId: 'reeves' };
const disabled = { id: 'pecos-disabled', evidenceId: 'active_hazard:pecos-disabled', sourceKind: 'active_hazard', subtype: 'disabled_vehicle', active: true, countyId: 'reeves' };

function capture(overrides = {}) {
  return governed.captureActiveIssueReconciliationInvocation({
    timestamp: '2026-08-22T02:30:51.173Z', transitionGeneration: 9, evidenceGeneration: 9, providerRefreshGeneration: 4,
    operands: { reports: 3, hazards: 1, shared: 2 }, returnedValue: 3,
    collections: { reports: [cleared, blocked, disabled], hazards: [disabled] },
    scalarSources: { shared: { sourceField: 'activeIssueCount', sourceObjectModel: 'sharedActiveIssueContract', assignedAt: 'buildGridlySharedActiveIssueContract', contributorIdentityRetained: true } },
    ...overrides
  });
}

test('captures every supplied invocation operand and preserves the production return', () => {
  const out = capture();
  assert.deepEqual(out.allCandidateOperands, { reports: 3, hazards: 1, shared: 2 });
  assert.equal(out.returnedValue, 3);
  assert.equal(out.winningValue, 3);
  assert.deepEqual(out.winningOperandNames, ['reports']);
});

test('reports every tied winner and traces scalar sources', () => {
  const out = capture({ operands: { reports: 3, shared: 3 }, returnedValue: 3 });
  assert.deepEqual(out.winningOperandNames, ['reports', 'shared']);
  assert.equal(out.scalarSources.shared.sourceField, 'activeIssueCount');
  assert.equal(out.scalarSources.shared.sourceObjectModel, 'sharedActiveIssueContract');
});

test('collection winner exposes bounded lifecycle-safe Pecos identities', () => {
  const out = capture();
  assert.equal(out.candidateCollections.reports.length, 3);
  assert.deepEqual(out.candidateCollections.reports.boundedIdentities.map((row) => row.subtype), ['cleared', 'blocked_crossing', 'disabled_vehicle']);
  assert.equal(out.candidateCollections.reports.boundedIdentities[0].cleared, true);
  assert.equal(out.candidateCollections.hazards.boundedIdentities[0].governedEvidenceId, 'active_hazard:pecos-disabled');
});

test('Pecos live-shape raw aggregate is explicit and retains all three contributor roles', () => {
  const name = 'safeNumber(counts.activeIssueCount)';
  const out = capture({ operands: { [name]: 3, 'safeLength(safeSummary.activeReportsInArea)': 2, 'safeLength(safeSummary.activeHazardsInArea)': 1 }, returnedValue: 3, collections: { [name]: [cleared, blocked, disabled], 'safeLength(safeSummary.activeReportsInArea)': [cleared, blocked], 'safeLength(safeSummary.activeHazardsInArea)': [disabled] } });
  assert.deepEqual(out.winningOperandNames, [name]);
  assert.deepEqual(out.candidateCollections[name].boundedIdentities.map((row) => row.subtype), ['cleared', 'blocked_crossing', 'disabled_vehicle']);
});

test('diagnostic rows are bounded to 100 without changing cardinality', () => {
  const rows = Array.from({ length: 125 }, (_, id) => ({ id: `hazard-${id}`, sourceKind: 'active_hazard', subtype: 'debris' }));
  const out = capture({ operands: { hazards: 125 }, returnedValue: 125, collections: { hazards: rows } });
  assert.equal(out.candidateCollections.hazards.length, 125);
  assert.equal(out.candidateCollections.hazards.boundedIdentities.length, 100);
  assert.equal(out.returnedValue, 125);
});

test('revision and generation counters are metadata, never candidates', () => {
  const out = capture({ providerRefreshGeneration: 3 });
  assert.equal(out.providerRefreshGeneration, 3);
  assert.equal(Object.hasOwn(out.allCandidateOperands, 'gridlyOfficialRoadwayAwarenessRevision'), false);
});

test('production source captures all 12 exact Math.max expressions at return boundary', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const expected = [
    'safeNumber(safeSummary.sharedActiveIssueContract?.activeIssueCount)', 'safeNumber(counts.activeIssueCount)',
    'safeNumber(counts.hazardCount)', 'safeNumber(counts.reportCount)', 'safeLength(safeSummary.activeReportsInArea)',
    'safeLength(safeSummary.activeHazardsInArea)', 'safeNumber(safeSummary.reportCount)',
    'safeNumber(safeSummary.activeReportsInAreaCount)', 'safeNumber(visibleCountModel?.visibleAlertIncidentCount)',
    'safeNumber(visibleCountModel?.renderedMarkerCount)', 'safeNumber(visibleCountModel?.bottomAwarenessDisplayedHazardCount)',
    'currentVisibleIncidentCount'
  ];
  for (const expression of expected) assert.match(app, new RegExp(expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(app, /const returnedValue = Math\.max\(\.\.\.Object\.values\(allCandidateOperands\)\);[\s\S]*captureActiveIssueReconciliationInvocation[\s\S]*return returnedValue;/);
});

test('timeline retains 0 to 3 operands and first-producing event across later 3 to 3 calls', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /previousCount, newCount: productionCount, allCandidateOperands: invocationOperands/);
  assert.match(app, /locationContextFirstProducingEvent: firstProducingEvent/);
  assert.match(app, /retainedFirstEvent\?\.newCount === productionCount/);
  assert.match(app, /generation < Number\(gridlyLocationContextProductionDiagnosticState\.generation/);
});

test('audit exposes winner, operands, collections, items and timeline without locality special cases', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  for (const field of ['locationContextWinningOperands', 'locationContextWinningValue', 'locationContextInvocationOperands', 'locationContextWinningCollections', 'locationContextWinningItems', 'locationContextUpdateTimeline']) assert.match(app, new RegExp(field));
  const reconciliation = app.slice(app.indexOf('function getGridlyReconciledAwarenessActiveIssueCount'), app.indexOf('let gridlyCrossingWatchCountAuditState'));
  assert.doesNotMatch(reconciliation, /Pecos|Reeves|locality|placeGeoid\s*===/i);
});
