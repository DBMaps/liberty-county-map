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
  assert.doesNotMatch(engine, /Sulphur Springs|Pecos|Hopkins|Reeves|FRA/i);
  assert.match(app, /history: reportRows\.filter/);
  assert.match(app, /finalConsumerSurfaceMembership/);
  assert.match(app, /crossingMarkers instanceof Map/);
  assert.match(app, /governedAlertProjection/);
  assert.match(app, /governedKbygAuthorityIds/);
});
