const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const NOW = Date.UTC(2026, 7, 22);
const disabled = { id: 'vehicle-1', sourceKind: 'active_hazard', subtype: 'disabled_vehicle', active: true, countyId: 'reeves-tx' };
const blocked = { reportId: 'crossing-1', sourceKind: 'community_report', subtype: 'blocked_crossing', active: true, countyId: 'reeves-tx' };
const cleared = { reportId: 'history-1', sourceKind: 'community_report', subtype: 'cleared', status: 'cleared', active: false, countyId: 'reeves-tx' };

function audit(records, countyId = 'reeves-tx') {
  const included = records.filter((row) => row.countyId === countyId);
  const excluded = records.filter((row) => row.countyId !== countyId);
  const evidence = governed.buildSnapshot({ records, countyId, nowMs: NOW }).evidence;
  return governed.buildCurrentCountyVisibleIncidentAudit({ sourceCollection: records, includedItems: included, excludedItems: excluded, governedEvidence: evidence, countyId, nowMs: NOW });
}

test('Pecos live-shape retains three inventory rows but governs only two active rows', () => {
  const records = [disabled, blocked, cleared];
  const out = audit(records);
  assert.equal(out.currentVisibleReportCount, 3);
  assert.equal(out.currentActiveVisibleIncidentCount, 2);
  assert.deepEqual(out.currentActiveVisibleIncidentItems.map((row) => row.subtype), ['disabled_vehicle', 'blocked_crossing']);
  assert.equal(records.includes(cleared), true, 'history is retained in the source collection');
  assert.deepEqual(out.inactiveHistoryIds, ['community_report:history-1']);
  assert.equal(out.currentVisibleIncidentCountContract, 'MAP_REPORT_INVENTORY_COUNTY_MEMBERSHIP_NOT_ACTIVE_LIFECYCLE');
  assert.equal(out.currentActiveVisibleIncidentCountContract, 'CURRENT_COUNTY_GOVERNED_ACTIVE_LIFECYCLE_COUNT');
});

test('disabled vehicle, blocked crossing, both, and quiet controls are deterministic', () => {
  assert.equal(audit([disabled]).currentActiveVisibleIncidentCount, 1);
  assert.equal(audit([blocked]).currentActiveVisibleIncidentCount, 1);
  assert.equal(audit([disabled, blocked]).currentActiveVisibleIncidentCount, 2);
  assert.equal(audit([]).currentActiveVisibleIncidentCount, 0);
});

test('stale, inactive, and cleared lifecycle evidence cannot count active', () => {
  const stale = { id: 'stale-1', sourceKind: 'active_hazard', subtype: 'debris', status: 'stale', active: true, countyId: 'reeves-tx' };
  const inactive = { id: 'inactive-1', sourceKind: 'active_hazard', subtype: 'debris', active: false, countyId: 'reeves-tx' };
  const out = audit([stale, inactive, cleared]);
  assert.equal(out.currentVisibleReportCount, 3);
  assert.equal(out.currentActiveVisibleIncidentCount, 0);
  assert.deepEqual(out.staleIds, ['active_hazard:stale-1']);
  assert.equal(out.lifecycleExcludedIds.length, 3);
});

test('duplicates do not inflate governed active count', () => {
  const out = audit([disabled, { ...disabled }]);
  assert.equal(out.currentVisibleReportCount, 2);
  assert.equal(out.currentActiveVisibleIncidentCount, 1);
  assert.deepEqual(out.duplicateIds, ['active_hazard:vehicle-1']);
});

test('current county authority excludes old-county evidence after transition', () => {
  const oldCounty = { ...disabled, id: 'old-vehicle', countyId: 'ward-tx' };
  const reeves = audit([disabled, oldCounty], 'reeves-tx');
  const ward = audit([disabled, oldCounty], 'ward-tx');
  assert.equal(reeves.currentActiveVisibleIncidentCount, 1);
  assert.equal(ward.currentActiveVisibleIncidentCount, 1);
  assert.equal(reeves.currentVisibleIncidentExcludedItems[0].providerRecordId, 'old-vehicle');
});

test('valid official roadway and generated incident evidence remain countable', () => {
  const official = { id: 'txdot-1', sourceKind: 'official_roadway', subtype: 'road_closure', active: true, countyId: 'reeves-tx' };
  const generated = { id: 'road-1', sourceKind: 'generated_road_incident', subtype: 'debris', active: true, countyId: 'reeves-tx' };
  const out = audit([official, generated]);
  assert.equal(out.currentActiveVisibleIncidentCount, 2);
  assert.deepEqual(out.currentActiveVisibleIncidentItems.map((row) => row.sourceKind), ['official_roadway', 'generated_road_incident']);
});

test('production reconciliation admits lifecycle-qualified and shared governed counts only', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const source = app.slice(app.indexOf('function getGridlyReconciledAwarenessActiveIssueCount'), app.indexOf('let gridlyCrossingWatchCountAuditState'));
  const candidates = source.slice(source.indexOf('const allCandidateOperands'), source.indexOf('const returnedValue'));
  assert.match(candidates, /sharedActiveIssueContract/);
  assert.match(candidates, /currentActiveVisibleIncidentCount/);
  assert.doesNotMatch(candidates, /renderedMarkerCount|currentVisibleIncidentCount\s*[,}]/);
  assert.match(source, /currentVisibleIncidentCount: "EXCLUDED_RUNTIME_INVENTORY_COUNT"/);
  assert.match(source, /renderedMarkerCount\)": "EXCLUDED_RENDERED_MARKER_COUNT"/);
});

test('production audits expose inventory, active, exclusions, operands, and winners', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  for (const field of ['currentVisibleIncidentCount', 'currentActiveVisibleIncidentCount', 'currentVisibleIncidentItems', 'currentActiveVisibleIncidentItems', 'inactiveHistoryIds', 'lifecycleExcludedFromActiveCount', 'locationContextInvocationOperands', 'locationContextWinningOperands', 'locationContextWinningValue']) {
    assert.match(app, new RegExp(field));
  }
});

test('LP219 lineage stays explicit and production code has no locality exception', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const source = app.slice(app.indexOf('function gridlyGetCurrentCountyVisibleIncidentAudit'), app.indexOf('function gridlySanJacintoReportSubmissionAudit'));
  assert.match(source, /activeHazards[\s\S]*activeReports/);
  assert.match(source, /gridlyReportMatchesActiveCounty/);
  assert.doesNotMatch(source, /Pecos|Reeves|vehicle-1|crossing-1|history-1/i);
});
