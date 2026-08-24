const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const NOW = Date.parse('2026-08-22T12:00:00Z');
const crossing = (id, extra = {}) => ({ id, reportKind: 'crossing', sourceKind: 'community_report', type: 'blocked_crossing', status: 'active', active: true, geographicEligible: true, countyId: 'generic-tx', canonicalCommunity: 'Generic Place', ...extra });
const hazard = id => ({ id, reportKind: 'hazard', sourceKind: 'active_hazard', type: 'closed_road', status: 'active', active: true, geographicEligible: true, countyId: 'generic-tx' });
const official = id => ({ id, sourceKind: 'official_roadway', provider: 'DriveTexas', type: 'road_closure', status: 'active', active: true, geographicEligible: true, countyId: 'generic-tx' });
const project = records => governed.buildConsumerProjection({ records, nowMs: NOW, countyId: 'generic-tx' });

test('quiet, active, cleared, and stale lifecycle controls are explicit', () => {
  assert.equal(project([]).surfaces.alerts.length, 0);
  const active = project([crossing('one')]);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygCommunity', 'map', 'popup']) assert.equal(active.surfaces[surface].length, 1, surface);
  assert.equal(active.surfaces.history.length, 0);
  const cleared = project([crossing('one', { status: 'cleared' })]);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygCommunity', 'map', 'popup']) assert.equal(cleared.surfaces[surface].length, 0, surface);
  assert.equal(cleared.surfaces.history.length, 1);
  assert.equal(project([crossing('stale', { status: 'stale' })]).surfaces.alerts.length, 0);
});

test('duplicate, old-area, old-county, and identity-unavailable records fail safely', () => {
  const duplicate = project([crossing('same'), crossing('same')]);
  assert.equal(duplicate.surfaces.alerts.length, 1);
  assert.deepEqual(duplicate.snapshot.duplicateEvidenceIds, ['community_report:same']);
  assert.equal(duplicate.lineage[0].deduplicationStatus, 'DEDUPLICATED_SHARED_EVIDENCE');
  assert.equal(project([crossing('area', { geographicEligible: false })]).surfaces.alerts.length, 0);
  assert.equal(project([crossing('county', { countyId: 'old-tx', geographicEligible: false })]).surfaces.kbygCommunity.length, 0);
  assert.equal(project([{ ...crossing(''), id: '', createdAt: '' }]).snapshot.evidence.length, 0);
});

test('mixed hazard and official evidence coexist without changing official ownership', () => {
  const mixed = project([crossing('crossing'), hazard('hazard'), official('official')]);
  assert.equal(mixed.surfaces.alerts.length, 3);
  assert.equal(mixed.surfaces.kbygCommunity.length, 2);
  assert.equal(mixed.surfaces.kbygOfficialRoadways.length, 1);
  assert.equal(mixed.lineage.find(row => row.evidenceId.endsWith(':crossing')).kbygOfficialRoadwaysEligible, false);
});

test('one identity has governed summary ownership and crossing-specific spatial/history ownership', () => {
  const row = project([crossing('canonical')]).lineage[0];
  assert.equal(row.deduplicationIdentity, 'community_report:canonical');
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygCommunity']) assert.equal(row.consumerOwnership[surface].owningPublisher, 'governed_awareness');
  for (const surface of ['map', 'popup', 'history']) assert.equal(row.consumerOwnership[surface].owningPublisher, 'crossing_specific');
  assert.equal(row.consumerOwnership.kbygOfficialRoadways.policyStatus, 'PRODUCT_POLICY_INELIGIBLE');
});

test('policy and production wiring are statewide and expose map, popup, Alerts, KBYG, Location Context, and History audit membership', () => {
  const engine = fs.readFileSync('js/governed-awareness.js', 'utf8');
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.doesNotMatch(engine, /Sulphur Springs|Pecos|Hopkins|Reeves|FRA-\d/i);
  assert.match(app, /history: reportRows\.filter[\s\S]*reportKind[\s\S]*recently\[_ -\]\?cleared/);
  assert.match(app, /finalConsumerSurfaceMembership/);
  assert.match(app, /crossingMarkers instanceof Map/);
  assert.match(app, /governedAlertProjection/);
  assert.match(app, /governedKbygAuthorityIds/);
});

test('blocked-crossing persisted and governed aliases reconcile across a clear without deleting history', () => {
  const active = crossing('5484625f-4d68-466a-86cd-a64fa523f6f7', {
    crossingId: 'FRA-331630H', deviceId: 'owner-device', submittedAt: '2026-08-22T10:00:00Z'
  });
  const roadHazard = hazard('independent-road-hazard');
  const before = project([roadHazard, active]);
  assert.equal(before.surfaces.locationContext.length, 2);
  assert.equal(before.surfaces.alerts.length, 2);
  assert.equal(before.surfaces.history.length, 0);

  const clear = crossing('d8744fba-4b6b-44b8-9125-9cfe0a5d9e2a', {
    // The owner row retained an active-looking status. Its persisted clear role,
    // not that stale boolean, must govern the final reconciled lifecycle.
    type: 'cleared', status: 'active', active: true, crossingId: 'FRA-331630H',
    deviceId: 'owner-device', lifecycleIdentity: '5484625f-4d68-466a-86cd-a64fa523f6f7',
    submittedAt: '2026-08-22T10:05:00Z'
  });
  const after = project([roadHazard, active, clear]);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygCommunity']) {
    assert.deepEqual(after.surfaces[surface].map(row => row.record.id), [roadHazard.id], surface);
  }
  assert.equal(after.surfaces.history.length, 1);
  const activeLineage = after.lineage.find(row => row.persistedReportId === active.id);
  const clearLineage = after.lineage.find(row => row.persistedReportId === clear.id);
  assert.equal(activeLineage.lifecycleIdentity, active.id);
  assert.equal(activeLineage.providerRecordId, 'FRA-331630H');
  assert.equal(activeLineage.aliasReconciliationResult, 'SAME_REPORT_ACTIVE_HISTORY_ALIAS_CONFLICT');
  assert.deepEqual(activeLineage.clearedAliasIds, [`community_report:${clear.id}`]);
  assert.deepEqual(activeLineage.activeAliasIds, [`community_report:${active.id}`]);
  assert.equal(activeLineage.firstLifecycleLosingStage, 'governed_active_lifecycle_alias_reconciliation');
  assert.equal(activeLineage.retiredByClearId, clear.id);
  assert.equal(activeLineage.finalLifecycleEligible, false);
  assert.equal(clearLineage.lifecycleRole, 'CLEAR_HISTORY');
  assert.equal(clearLineage.explicitLifecycleTargetRaw, active.id);
  assert.equal(clearLineage.canonicalLifecycleTarget, active.id);
  assert.notEqual(clearLineage.canonicalLifecycleTarget, clearLineage.persistedReportId);
  assert.equal(clearLineage.targetResolutionSource, 'EXPLICIT_ACTIVE_REPORT_ID');
  assert.equal(clearLineage.finalLifecycleEligible, false);
  assert.equal(clearLineage.finalHistoryEligible, true);
  assert.equal(clearLineage.finalConsumerEligible, false);
  assert.equal(clearLineage.alertsEligible, false);
  assert.equal(clearLineage.kbygCommunityEligible, false);

  const activeGovernedIds = new Set(after.lineage.filter(row => row.finalLifecycleEligible).map(row => row.evidenceId));
  const inactiveHistoryIds = new Set(after.lineage.filter(row => row.finalHistoryEligible).map(row => row.evidenceId));
  const clearedAliasIds = new Set(after.lineage.flatMap(row => row.clearedAliasIds));
  assert.deepEqual([...inactiveHistoryIds].filter(id => activeGovernedIds.has(id)), []);
  assert.deepEqual([...clearedAliasIds].filter(id => activeGovernedIds.has(id)), []);
  assert.equal(after.snapshot.lifecycleAudit.find(row => row.persistedReportId === clear.id).lifecycleRole, 'CLEAR_HISTORY');
  assert.equal(after.snapshot.lifecycleAudit.find(row => row.persistedReportId === clear.id).canonicalLifecycleTarget, active.id);
});

test('a clear UUID presented as its own explicit target is rejected and safely resolved to the exact preceding owner report', () => {
  const active = crossing('5484625f-4d68-466a-86cd-a64fa523f6f7', {
    crossingId: 'FRA-331630H', deviceId: 'owner-device', submittedAt: '2026-08-22T10:00:00Z'
  });
  const clear = crossing('d8744fba-4b6b-44b8-9125-9cfe0a5d9e2a', {
    type: 'cleared', status: 'active', active: true, crossingId: 'FRA-331630H',
    deviceId: 'owner-device', lifecycleIdentity: 'd8744fba-4b6b-44b8-9125-9cfe0a5d9e2a',
    submittedAt: '2026-08-22T10:05:00Z'
  });
  const result = project([active, clear]);
  const activeLineage = result.lineage.find(row => row.persistedReportId === active.id);
  const clearLineage = result.lineage.find(row => row.persistedReportId === clear.id);
  assert.equal(clearLineage.explicitLifecycleTargetRaw, clear.id);
  assert.equal(clearLineage.targetResolutionSource, 'LEGACY_SAME_REPORTER_SAME_CROSSING');
  assert.equal(clearLineage.canonicalLifecycleTarget, active.id);
  assert.notEqual(clearLineage.canonicalLifecycleTarget, clearLineage.persistedReportId);
  assert.equal(activeLineage.retiredByClearId, clear.id);
  assert.equal(activeLineage.finalLifecycleEligible, false);
  assert.equal(result.surfaces.alerts.length, 0);
  assert.equal(result.surfaces.kbygCommunity.length, 0);
  assert.equal(result.surfaces.locationContext.length, 0);
  assert.equal(result.surfaces.history.length, 1);
});

test('explicit alias identity retires one report but never collapses separate reports at the same FRA crossing', () => {
  const first = crossing('report-one', { crossingId: 'FRA-SHARED', deviceId: 'device-one', submittedAt: '2026-08-22T09:00:00Z' });
  const second = crossing('report-two', { crossingId: 'FRA-SHARED', deviceId: 'device-two', submittedAt: '2026-08-22T09:01:00Z' });
  const clear = crossing('clear-one', { type: 'cleared', status: 'cleared', active: false, crossingId: 'FRA-SHARED', deviceId: 'device-one', lifecycleIdentity: 'report-one', submittedAt: '2026-08-22T09:05:00Z' });
  const result = project([first, second, clear]);
  assert.deepEqual(result.surfaces.alerts.map(row => row.record.id), ['report-two']);
  assert.deepEqual(result.surfaces.kbygCommunity.map(row => row.record.id), ['report-two']);
  assert.equal(result.surfaces.history.length, 1);
  assert.equal(result.lineage.find(row => row.persistedReportId === clear.id).targetResolutionSource, 'EXPLICIT_ACTIVE_REPORT_ID');
});

test('hazard survives blocked-crossing clear and repeated clear is idempotent', () => {
  const blocked = crossing('crossing-report', { crossingId: 'FRA-COUNT', deviceId: 'owner', submittedAt: '2026-08-22T08:00:00Z' });
  const roadHazard = hazard('road-hazard');
  assert.equal(project([roadHazard, blocked]).surfaces.locationContext.length, 2);
  const clear = crossing('clear-event', { type: 'cleared', status: 'cleared', active: false, crossingId: 'FRA-COUNT', deviceId: 'owner', lifecycleIdentity: 'crossing-report', submittedAt: '2026-08-22T08:05:00Z' });
  const after = project([roadHazard, blocked, clear, clear]);
  assert.equal(after.surfaces.locationContext.length, 1);
  assert.equal(after.surfaces.locationContext[0].record.id, 'road-hazard');
  assert.equal(after.surfaces.history.length, 1);
  assert.deepEqual(after.snapshot.duplicateEvidenceIds, ['community_report:clear-event']);
});
