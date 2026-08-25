const test = require('node:test');
const assert = require('node:assert/strict');
const governed = require('../js/governed-awareness.js');

const NOW = Date.parse('2026-08-25T12:00:00Z');

function hazard({ type, device = 'device-a', town = 'Austin', countyId = 'travis', id = 'report-uuid-1' }) {
  return {
    id,
    persistedReportId: id,
    providerRecordId: `hazard-${device}-1787695743108`,
    crossingId: `hazard-${device}-1787695743108`,
    reportKind: type === 'blocked' ? 'crossing' : 'hazard',
    type,
    source: 'user',
    canonicalCommunity: town,
    canonicalKey: town === 'Austin' ? 'place:4805000' : 'place:4865000',
    countyId,
    lat: town === 'Austin' ? 30.2724 : 29.4241,
    lng: town === 'Austin' ? -97.7422 : -98.4936,
    createdAt: '2026-08-25T11:59:00Z',
    expiresAt: '2026-08-25T14:00:00Z',
    active: true
  };
}

function presentation(record) {
  const mapType = record.type === 'road_closed' ? 'closed' : record.type;
  return { id: `road-${mapType}-${record.lat}-${record.lng}`, sourceKind: 'generated_road_incident', latestReport: record };
}

for (const fixture of [
  { type: 'flooding', label: 'Flooding' },
  { type: 'road_closed', label: 'Road Closed' },
  { type: 'blocked', label: 'Blocked Crossing' },
  { type: 'debris', label: 'Debris / Obstruction' }
]) {
  test(`LP237 reconciles ${fixture.label} presentation aliases into one governed condition`, () => {
    const record = hazard({ type: fixture.type, device: fixture.type });
    const map = presentation(record);
    const snapshot = governed.buildSnapshot({
      records: [record], nowMs: NOW,
      actual: { map: [map], alerts: [map], kbygCommunity: [map], locationContext: [map] }
    });
    assert.equal(snapshot.evidence.length, 1);
    const row = snapshot.evidence[0];
    assert.equal(row.active, true);
    assert.match(row.evidenceId, /^(?:active_hazard|community_report):/);
    assert.ok(row.aliasCandidates.includes(record.providerRecordId));
    assert.equal(snapshot.surfaces.map.unmatchedConsumerItems.length, 0);
    assert.equal(row.published.map, true);
    assert.equal(row.published.alerts, true);
    assert.equal(row.published.locationContext, true);
    assert.equal(row.published.kbygCommunity, true);
    assert.deepEqual(snapshot.duplicateEvidenceIds, []);
  });
}

test('LP237 keeps the same canonical owner before and after two authoritative refreshes', () => {
  const optimistic = hazard({ type: 'flooding', device: 'device-a', id: '' });
  delete optimistic.id;
  optimistic.persistedReportId = null;
  const authoritative = { ...optimistic, id: 'supabase-report-uuid', persistedReportId: 'supabase-report-uuid' };
  const before = governed.buildSnapshot({ records: [optimistic], nowMs: NOW, actual: { map: [presentation(optimistic)] } });
  const afterFirst = governed.buildSnapshot({ records: [authoritative], nowMs: NOW + 1000, actual: { map: [presentation(optimistic)] } });
  const afterSecond = governed.buildSnapshot({ records: [{ ...authoritative }], nowMs: NOW + 2000, actual: { map: [presentation(optimistic)] } });
  assert.equal(before.evidence.length, 1, 'PRESENT BEFORE RECONCILIATION');
  assert.equal(afterSecond.evidence.length, 1, 'PRESENT AFTER RECONCILIATION');
  assert.equal(before.evidence[0].evidenceId, afterFirst.evidence[0].evidenceId);
  assert.equal(afterFirst.evidence[0].evidenceId, afterSecond.evidence[0].evidenceId, 'SAME CANONICAL GOVERNED IDENTITY');
  assert.equal(afterSecond.surfaces.map.unmatchedConsumerItems.length, 0);
});

test('LP237 global contract works for a different subtype outside Austin without county rekeying', () => {
  const record = hazard({ type: 'debris', device: 'san-antonio-device', town: 'San Antonio', countyId: 'bexar', id: 'sa-report' });
  const projection = governed.buildConsumerProjection({ records: [record], nowMs: NOW });
  assert.equal(projection.snapshot.canonicalCommunity, '');
  assert.equal(projection.surfaces.map.length, 1);
  assert.equal(projection.surfaces.alerts.length, 1);
  assert.equal(projection.surfaces.locationContext.length, 1);
  assert.equal(projection.snapshot.evidence[0].countyId, 'bexar');
  assert.equal(projection.snapshot.evidence[0].canonicalCommunity, 'San Antonio');
});

test('LP237 does not change official roadway canonical identity semantics', () => {
  const official = { sourceKind: 'official_roadway', providerRecordId: 'txdot-19', type: 'flooding', active: true };
  assert.equal(governed.identity(official), 'official_roadway:txdot-19');
});
