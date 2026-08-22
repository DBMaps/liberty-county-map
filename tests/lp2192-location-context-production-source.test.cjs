const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const cleared = { reportId: 'eb1db382-e1c7-4d88-94de-a5a1fa78e5c5', sourceKind: 'community_report', subtype: 'cleared' };
const blocked = { reportId: 'pecos-blocked', sourceKind: 'community_report', subtype: 'blocked_crossing' };
const disabled = { id: 'pecos-disabled', sourceKind: 'active_hazard', subtype: 'disabled_vehicle' };
const snapshot = governed.buildSnapshot({ records: [cleared, blocked, disabled], evidenceGeneration: 7 });
const audit = (items = [cleared, blocked, disabled], extra = {}) => governed.buildLocationContextProductionAudit({
  governedEvidence: snapshot.evidence,
  productionItems: items.map((record) => ({ record, countedReason: 'retained summary collection member' })),
  productionCount: 3,
  operands: { rawActiveIssueCount: 3, finalActiveIssueCount: 3 },
  ...extra
});

test('Pecos production source enumerates the exact retained three behind visible three', () => {
  const out = audit();
  assert.match(out.locationContextProductionSource, /normalizeGridlyMobileAwarenessPanelSummary/);
  assert.equal(out.locationContextProductionCount, 3);
  assert.equal(out.locationContextProductionCollectionCardinality, 3);
  assert.deepEqual(out.locationContextProductionItems.map((row) => row.subtype), ['cleared', 'blocked_crossing', 'disabled_vehicle']);
  assert.equal(out.locationContextProductionItems[0].matchStatus, 'MATCHED_INACTIVE_HISTORY');
  assert.deepEqual(out.locationContextInactiveHistoryIds, ['community_report:eb1db382-e1c7-4d88-94de-a5a1fa78e5c5']);
  assert.equal(snapshot.evidence.filter((row) => row.countedByLocationContext).length, 2);
});

test('stable identities reconcile while identity unavailable is never invented', () => {
  const out = audit([blocked, { title: 'legacy projection' }, disabled]);
  assert.equal(out.locationContextIdentityUnavailableItems.length, 1);
  assert.equal(out.locationContextIdentityUnavailableItems[0].governedEvidenceId, null);
  assert.deepEqual([...out.locationContextMatchedGovernedIds].sort(), ['active_hazard:pecos-disabled', 'community_report:pecos-blocked'].sort());
});

test('unmatched, stale and duplicate production classifications remain explicit', () => {
  const staleRecord = { id: 'old', sourceKind: 'active_hazard', subtype: 'debris', status: 'stale' };
  const governedWithStale = governed.buildSnapshot({ records: [blocked, staleRecord], evidenceGeneration: 8 });
  const out = governed.buildLocationContextProductionAudit({ governedEvidence: governedWithStale.evidence, productionItems: [blocked, blocked, staleRecord, { id: 'new-real', sourceKind: 'active_hazard', subtype: 'debris' }], productionCount: 4 });
  assert.equal(out.locationContextProductionItems[1].matchStatus, 'MATCHED_DUPLICATE');
  assert.equal(out.locationContextProductionItems[2].matchStatus, 'MATCHED_STALE');
  assert.equal(out.locationContextProductionItems[3].matchStatus, 'UNMATCHED_PRODUCTION_ITEM');
});

test('instrumentation traces LP214 max operands without changing production behavior', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /getGridlyReconciledAwarenessActiveIssueCount/);
  assert.match(app, /LP214_MAX_RECONCILIATION/);
  assert.match(app, /window\.gridlyLocationContextProductionAudit/);
  assert.match(app, /generation < Number\(gridlyLocationContextProductionDiagnosticState\.generation/);
  assert.match(app, /\.slice\(-40\)/);
  assert.doesNotMatch(governed.buildLocationContextProductionAudit.toString(), /Pecos|Cienegas|Val Verde/);
});

test('DOM parity remains an independent observation', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /locationContextDomCount: domCount/);
  assert.match(app, /productionCount === null \|\| domCount === null/);
});
