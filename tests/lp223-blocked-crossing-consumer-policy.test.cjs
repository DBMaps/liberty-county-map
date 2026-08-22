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
  const before = project([active]);
  assert.equal(before.surfaces.alerts.length, 1);
  assert.equal(before.surfaces.history.length, 0);

  const clear = crossing('d8744fba-4b6b-44b8-9125-9cfe0a5d9e2a', {
    type: 'cleared', status: 'cleared', active: false, crossingId: 'FRA-331630H',
    deviceId: 'owner-device', submittedAt: '2026-08-22T10:05:00Z'
  });
  const after = project([active, clear]);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygCommunity']) assert.equal(after.surfaces[surface].length, 0, surface);
  assert.equal(after.surfaces.history.length, 1);
  const activeLineage = after.lineage.find(row => row.persistedReportId === active.id);
  assert.equal(activeLineage.lifecycleIdentity, active.id);
  assert.equal(activeLineage.providerRecordId, 'FRA-331630H');
  assert.equal(activeLineage.aliasReconciliationResult, 'SAME_REPORT_ACTIVE_HISTORY_ALIAS_CONFLICT');
  assert.deepEqual(activeLineage.clearedAliasIds, [`community_report:${clear.id}`]);
  assert.deepEqual(activeLineage.activeAliasIds, [`community_report:${active.id}`]);
  assert.equal(activeLineage.firstLifecycleLosingStage, 'governed_active_lifecycle_alias_reconciliation');
});

test('explicit alias identity retires one report but never collapses separate reports at the same FRA crossing', () => {
  const first = crossing('report-one', { crossingId: 'FRA-SHARED', deviceId: 'device-one', submittedAt: '2026-08-22T09:00:00Z' });
  const second = crossing('report-two', { crossingId: 'FRA-SHARED', deviceId: 'device-two', submittedAt: '2026-08-22T09:01:00Z' });
  const clear = crossing('clear-one', { type: 'cleared', status: 'cleared', active: false, crossingId: 'FRA-SHARED', deviceId: 'device-one', lifecycleIdentity: 'report-one', submittedAt: '2026-08-22T09:05:00Z' });
  const result = project([first, second, clear]);
  assert.deepEqual(result.surfaces.alerts.map(row => row.record.id), ['report-two']);
  assert.deepEqual(result.surfaces.kbygCommunity.map(row => row.record.id), ['report-two']);
  assert.equal(result.surfaces.history.length, 1);
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
