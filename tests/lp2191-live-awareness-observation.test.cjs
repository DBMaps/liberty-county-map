const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const blocked = { id: '64dd', sourceKind: 'community_report', subtype: 'blocked_crossing', status: 'active' };
const cleared = { id: 'eb1d', sourceKind: 'community_report', subtype: 'cleared', status: 'active' };
const hazard = { id: '095e', sourceKind: 'active_hazard', subtype: 'disabled_vehicle', status: 'active' };
const pecos = (extra = {}) => governed.buildSnapshot({ records: [cleared, blocked, hazard], canonicalCommunity: 'Town of Pecos', countyId: 'reeves-tx', evidenceGeneration: 9, transitionGeneration: 9, ...extra });

test('Pecos preserves three current raw records but only two active governed issues', () => {
  const out = pecos();
  assert.equal(out.evidence.length, 3);
  assert.deepEqual(out.currentStaleBreakdown, { current: 3, stale: 0 });
  assert.equal(out.governedEligibleEvidenceCount, 2);
  const row = out.evidence.find((item) => item.subtype === 'cleared');
  assert.equal(row.current, true); assert.equal(row.active, false);
  assert.equal(row.lifecycle.classification, 'CURRENT_HISTORY_INACTIVE_CLEARED');
});

test('production and independent DOM Location Context counts expose parity', () => {
  const out = pecos({ displayedActiveIssueCount: 3, locationContextProductionCount: 3, locationContextDomCount: 3, actual: { locationContext: [cleared, blocked, hazard] } });
  assert.equal(out.locationContextProductionCount, 3); assert.equal(out.locationContextDomCount, 3); assert.equal(out.locationContextCountParity, true);
  assert.equal(out.locationContextProductionEvidenceIds.length, 3);
  assert.deepEqual(out.locationContextUnexpectedEvidenceIds, ['community_report:eb1d']);
  assert.deepEqual(out.locationContextMissingGovernedIds, []);
});

test('visible three can remain identity-unavailable without inventing a third governed ID', () => {
  const out = pecos({ displayedActiveIssueCount: 3, locationContextProductionCount: 3, locationContextDomCount: 3, actual: { locationContext: [blocked, hazard, { label: 'legacy item without identity' }] } });
  assert.equal(out.locationContextProductionEvidenceIds.length, 2);
  assert.equal(out.locationContextUnmatchedProductionItems.length, 1);
  assert.equal(out.surfaces.locationContext.observationStatus, 'OBSERVED_MATCHED');
});

test('surface observation separates observed empty, unmatched, and missing observer', () => {
  const out = pecos({ actual: { alerts: [], kbygCommunity: [], map: [{ id: 'not-governed', sourceKind: 'consumer_only_projection' }] } });
  assert.equal(out.surfaces.alerts.observationStatus, 'OBSERVED_EMPTY');
  assert.equal(out.surfaces.kbygCommunity.surfaceObserved, true);
  assert.equal(out.surfaces.map.observationStatus, 'OBSERVED_UNMATCHED');
  assert.equal(out.surfaces.popup.observationStatus, 'NOT_OBSERVED');
  assert(out.omissions.filter((item) => item.surface === 'popup').every((item) => item.reason === 'IDENTITY_UNAVAILABLE'));
});

test('structured models reconcile IDs and preserve separate report/hazard map paths', () => {
  const out = pecos({ actual: { communityPulse: [blocked, hazard], map: [{ ...blocked, markerRegistry: 'crossingMarkers' }, { ...hazard, markerRegistry: 'unifiedIncidentLayer' }] } });
  assert.deepEqual(out.publishedIds.map, ['community_report:64dd', 'active_hazard:095e']);
  assert.deepEqual(out.publishedIds.communityPulse, ['community_report:64dd', 'active_hazard:095e']);
});

test('eligibility is explicit while undefined community policy remains null', () => {
  const row = pecos().evidence.find((item) => item.evidenceId === 'community_report:64dd');
  assert.equal(row.surfaceEligibility.locationContext.eligible, true);
  assert.equal(row.surfaceEligibility.alerts.eligible, null);
  assert.equal(row.surfaceEligibility.alerts.policyStatus, 'PRODUCT_CONTRACT_UNDEFINED');
});

test('stale and duplicates remain governed and generation ordering is protected', () => {
  const stale = { ...blocked, status: 'stale' };
  const current = governed.buildSnapshot({ records: [blocked, blocked, stale], evidenceGeneration: 10 });
  assert.equal(current.evidence.length, 1); assert.deepEqual(current.duplicateEvidenceIds, ['community_report:64dd', 'community_report:64dd']);
  const rejected = governed.buildSnapshot({ records: [], evidenceGeneration: 8, previousSnapshot: current });
  assert.equal(rejected.evidenceGeneration, 10); assert.equal(rejected.updateReason, 'OLDER_GENERATION_REJECTED');
});

test('instrumentation is behavior-neutral and contains no locality branch', () => {
  const source = fs.readFileSync('js/app.js', 'utf8');
  const engine = fs.readFileSync('js/governed-awareness.js', 'utf8');
  assert.match(source, /locationContextProductionCount: productionCount/);
  assert.match(source, /unifiedIncidentLayer\.eachLayer/);
  for (const name of ['Town of Pecos', 'Cienegas Terrace', 'Val Verde County']) assert.equal(engine.includes(name), false);
});
