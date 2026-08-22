const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const cleared = { reportId: 'eb1db382-e1c7-4d88-94de-a5a1fa78e5c5', sourceKind: 'community_report', subtype: 'cleared', status: 'cleared', active: false, countyId: 'reeves-tx' };
const blocked = { reportId: '64dd2efd-1bae-4b94-8026-796b420b0619', sourceKind: 'community_report', subtype: 'blocked_crossing', active: true, countyId: 'reeves-tx' };
const disabled = { id: '095e4648-d1dc-4608-8002-2b20f4d14133', sourceKind: 'active_hazard', subtype: 'disabled_vehicle', active: true, countyId: 'reeves-tx' };

function audit(included = [cleared, blocked, disabled], extra = {}) {
  const sourceCollection = extra.sourceCollection || included;
  const evidence = governed.buildSnapshot({ records: extra.governedRecords || [cleared, blocked, disabled], countyId: 'reeves-tx', nowMs: Date.UTC(2026, 7, 22) }).evidence;
  return governed.buildCurrentCountyVisibleIncidentAudit({ sourceCollection, includedItems: included, excludedItems: extra.excludedItems || [], governedEvidence: evidence, countyId: 'reeves-tx', generation: 12, nowMs: Date.UTC(2026, 7, 22) });
}

test('Pecos live-shape explicitly enumerates the source collection and exact three contributors', () => {
  const out = audit();
  assert.equal(out.currentVisibleIncidentSourceCollection, 'activeHazards + activeReports');
  assert.equal(out.currentVisibleReportCount, 3);
  assert.equal(out.currentVisibleIncidentItems.length, out.currentVisibleReportCount);
  assert.deepEqual(out.currentVisibleIncidentIdentities, [
    'community_report:eb1db382-e1c7-4d88-94de-a5a1fa78e5c5',
    'community_report:64dd2efd-1bae-4b94-8026-796b420b0619',
    'active_hazard:095e4648-d1dc-4608-8002-2b20f4d14133'
  ]);
});

test('cleared history, blocked crossing, and disabled vehicle roles are lifecycle explicit', () => {
  const [history, crossing, vehicle] = audit().currentVisibleIncidentItems;
  assert.equal(history.governedMatch, 'MATCHED_INACTIVE_HISTORY');
  assert.equal(history.lifecycle, 'CURRENT_HISTORY_INACTIVE_CLEARED');
  assert.equal(history.active, false);
  assert.equal(crossing.governedMatch, 'MATCHED_GOVERNED_ACTIVE');
  assert.equal(crossing.subtype, 'blocked_crossing');
  assert.equal(vehicle.governedMatch, 'MATCHED_GOVERNED_ACTIVE');
  assert.equal(vehicle.sourceKind, 'active_hazard');
  assert.equal(history.inclusionReason, 'ACTIVE_INVENTORY_MEMBER_MATCHING_CURRENT_COUNTY');
});

test('stale, duplicate, unmatched, and identity-unavailable records remain distinguishable', () => {
  const stale = { id: 'stale-1', sourceKind: 'active_hazard', subtype: 'debris', status: 'stale', countyId: 'reeves-tx' };
  const unmatched = { id: 'real-1', sourceKind: 'active_hazard', subtype: 'debris', countyId: 'reeves-tx' };
  const noIdentity = { sourceKind: 'consumer_only_projection', subtype: 'unknown', countyId: 'reeves-tx' };
  const out = audit([stale, stale, unmatched, noIdentity], { governedRecords: [stale] });
  assert.equal(out.currentVisibleIncidentItems[0].governedMatch, 'MATCHED_STALE');
  assert.equal(out.currentVisibleIncidentItems[1].governedMatch, 'MATCHED_DUPLICATE');
  assert.equal(out.currentVisibleIncidentItems[2].governedMatch, 'UNMATCHED_REAL_INCIDENT');
  assert.equal(out.currentVisibleIncidentItems[3].governedMatch, 'IDENTITY_UNAVAILABLE');
  assert.deepEqual(out.currentVisibleIncidentStaleIds, ['active_hazard:stale-1', 'active_hazard:stale-1']);
  assert.deepEqual(out.currentVisibleIncidentDuplicateIds, ['active_hazard:stale-1']);
});

test('breakdowns, exclusions, generations, and the non-active visibility contract are explicit', () => {
  const other = { id: 'other', sourceKind: 'active_hazard', subtype: 'debris', countyId: 'ward-tx' };
  const out = audit(undefined, { sourceCollection: [cleared, blocked, disabled, other], excludedItems: [other] });
  assert.deepEqual(out.currentVisibleIncidentSourceBreakdown, { community_report: 2, active_hazard: 1 });
  assert.deepEqual(out.currentVisibleIncidentLifecycleBreakdown, { CURRENT_HISTORY_INACTIVE_CLEARED: 1, CURRENT_ACTIVE: 2 });
  assert.equal(out.currentVisibleIncidentFilterStages.countyExcludedCount, 1);
  assert.equal(out.currentVisibleIncidentFilterStages.lifecycleFilteredCount, 0);
  assert.equal(out.currentVisibleIncidentInactiveHistoryIds.length, 1);
  assert.equal(out.currentVisibleIncidentGeneration, 12);
  assert.equal(out.currentVisibleIncidentCountContract, 'MAP_REPORT_INVENTORY_COUNTY_MEMBERSHIP_NOT_ACTIVE_LIFECYCLE');
});

test('diagnostics are bounded to 100 while production cardinality is unchanged', () => {
  const records = Array.from({ length: 125 }, (_, index) => ({ id: `row-${index}`, sourceKind: 'active_hazard', subtype: 'debris', countyId: 'reeves-tx' }));
  const out = audit(records, { governedRecords: [] });
  assert.equal(out.currentVisibleReportCount, 125);
  assert.equal(out.currentVisibleIncidentItems.length, 100);
});

test('production wiring retains count behavior, links winner identities, and contains no locality exception', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const source = app.slice(app.indexOf('function gridlyGetCurrentCountyVisibleIncidentAudit'), app.indexOf('function gridlySanJacintoReportSubmissionAudit'));
  assert.match(source, /activeHazards[\s\S]*activeReports/);
  assert.match(source, /currentVisibleReports\.length/);
  assert.match(source, /buildCurrentCountyVisibleIncidentAudit/);
  assert.match(app, /currentVisibleIncidentCount: currentVisibleIncidentAudit\?\.currentVisibleIncidentItems \|\| \[\]/);
  assert.match(app, /contributorIdentityRetained: true/);
  assert.match(app, /currentVisibleIncidentAudit, locationContextDomCount/);
  assert.match(app, /window\.gridlyCurrentCountyVisibleIncidentAudit/);
  assert.doesNotMatch(source, /Pecos|Reeves|eb1db382|64dd2efd|095e4648/i);
});
