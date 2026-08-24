const test = require('node:test');
const assert = require('node:assert/strict');
const governed = require('../js/governed-awareness.js');

const NOW = Date.parse('2026-08-24T12:00:00Z');
const incident = (overrides = {}) => ({
  sourceKind: 'official_roadway', providerId: 'txdot-fm0529-1', providerRecordId: 'txdot-fm0529-1',
  category: 'Lane Closure', roadway: 'FM0529', latitude: 29.87412353353783, longitude: -95.91808992841244,
  geographicEligible: true, status: 'active', expiresAt: '2026-08-25T12:00:00Z', ...overrides
});

test('relevant current DriveTexas identity reaches every governed awareness projection once', () => {
  const row = incident();
  const projection = governed.buildConsumerProjection({ records: [row, { ...row }], nowMs: NOW, canonicalCommunity: 'Katy', canonicalKey: '4838476' });
  const id = 'official_roadway:txdot-fm0529-1';
  assert.equal(projection.lineage.length, 1);
  assert.equal(projection.lineage[0].governedEvidenceId, id);
  for (const surface of ['locationContext', 'communityPulse', 'alerts', 'kbygOfficialRoadways']) {
    assert.deepEqual(projection.surfaces[surface].map(item => item.evidenceId), [id]);
  }
  assert.equal(projection.surfaces.kbygCommunity.length, 0, 'official evidence retains official-roadway source semantics');
});

test('lifecycle and geographic authority remain fail closed', () => {
  for (const row of [
    incident({ status: 'cleared' }), incident({ status: 'stale' }), incident({ active: false }),
    incident({ expiresAt: '2026-08-23T12:00:00Z' }), incident({ geographicEligible: false })
  ]) {
    const projection = governed.buildConsumerProjection({ records: [row], nowMs: NOW });
    assert.equal(projection.surfaces.locationContext.length, 0);
    assert.equal(projection.surfaces.alerts.length, 0);
  }
});

test('production wiring admits the existing geographic projection without county or town branches', () => {
  const fs = require('node:fs');
  const app = fs.readFileSync(require.resolve('../js/app.js'), 'utf8');
  const boundary = app.slice(app.indexOf('function gridlyGetGovernedConsumerProjection'), app.indexOf('function gridlyProjectAlertIncidentLocation'));
  assert.match(boundary, /gridlyStoryTransportationConnectorRecords/);
  assert.match(boundary, /sourceKind: "official_roadway"/);
  assert.doesNotMatch(boundary, /Katy|harris-tx|fort-bend-tx|waller-tx|county\s*===/i);
  assert.doesNotMatch(boundary, /setInterval|setTimeout|fetch\s*\(/);
  assert.match(app, /gridlyLP234DriveTexasGovernedPropagationAudit/);
});
