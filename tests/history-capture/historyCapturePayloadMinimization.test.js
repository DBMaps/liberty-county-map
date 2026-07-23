const assert = require('assert');
require('../../js/history-capture/historyCaptureFlags.js');
require('../../js/history-capture/historyCaptureEnvelope.js');
require('../../js/history-capture/historyCaptureIdempotency.js');
require('../../js/history-capture/historyCaptureWriter.js');
require('../../js/history-capture/historyCapturePhase1A.js');

const api = globalThis.gridlyPassiveHistoryCaptureEnvelope;
const sanitize = api.sanitizePhase1AHistoricalReport;
const deviceId = 'device-abc-123';

const crossing = {
  crossing_id: 'DOT-123456A', crossing_name: 'Main St', railroad: 'BNSF',
  latitude: 33.1234567, longitude: -96.9876543, device_id: deviceId,
  detail: 'free-form text', report_type: 'crossing', county_id: 'collin', state: 'TX'
};
const cleanCrossing = sanitize(crossing);
assert.strictEqual(cleanCrossing.crossingId, 'DOT-123456A');
assert.strictEqual(cleanCrossing.crossingName, 'Main St');
assert.strictEqual(cleanCrossing.railroad, 'BNSF');
assert.strictEqual(cleanCrossing.reportType, 'crossing');
assert.strictEqual(cleanCrossing.countyId, 'collin');
assert.strictEqual(cleanCrossing.state, 'TX');
assert.ok(!('device_id' in cleanCrossing));
assert.ok(!('detail' in cleanCrossing));
assert.ok(!('latitude' in cleanCrossing));
assert.ok(!('longitude' in cleanCrossing));
assert.strictEqual(cleanCrossing.locationBucket, '33.123,-96.988');
assert.ok(!('generalizedLocation' in cleanCrossing), 'certified crossing identity avoids coordinate object');

const hazard = {
  id: `hazard-${deviceId}-1770000000000`, hazard_category: 'flooding',
  lat: 33.1234567, lng: -96.9876543, road_name: 'FM 6', intersection: 'Main St',
  deviceId, detail: 'water over road', source: 'community', confidence: 'medium', county_id: 'hunt', state: 'TX'
};
const cleanHazard = sanitize(hazard);
assert.ok(!('id' in cleanHazard));
assert.strictEqual(cleanHazard.category, 'flooding');
assert.strictEqual(cleanHazard.roadName, 'FM 6');
assert.strictEqual(cleanHazard.intersection, 'Main St');
assert.strictEqual(cleanHazard.source, 'community');
assert.strictEqual(cleanHazard.confidence, 'medium');
assert.strictEqual(cleanHazard.countyId, 'hunt');
assert.strictEqual(cleanHazard.state, 'TX');
assert.deepStrictEqual(cleanHazard.generalizedLocation, { precision: 3, lat: 33.123, lng: -96.988, bucket: '33.123,-96.988' });
assert.ok(!('deviceId' in cleanHazard));
assert.ok(!('detail' in cleanHazard));

const clear = sanitize({ id: `hazard-cleared-${deviceId}-1770000000001`, report_state: 'hazard_cleared', hazard_type: 'debris', lat: 33.1234, lng: -96.9876, device_id: deviceId });
assert.ok(!('id' in clear));
assert.strictEqual(clear.reportState, 'hazard_cleared');
assert.strictEqual(clear.category, 'debris');
assert.strictEqual(clear.locationBucket, '33.123,-96.988');
assert.ok(!('device_id' in clear));

const original = { reportType: 'hazard', randomField: 'x', debugData: { secret: true }, html: '<b>x</b>', nested: { raw: true }, fn: () => true };
const beforeKeys = Object.keys(original).sort();
const cleanOriginal = sanitize(original);
assert.notStrictEqual(cleanOriginal, original);
assert.deepStrictEqual(Object.keys(original).sort(), beforeKeys);
assert.deepStrictEqual(cleanOriginal, { reportType: 'hazard' });

const observedAt = '2026-07-23T00:00:00.000Z';
const e1 = api.buildPhase1AEnvelope('report_created', { ...hazard, device_id: 'A', detail: 'first', lat: 33.12341, lng: -96.98761 }, { observedAt });
const e2 = api.buildPhase1AEnvelope('report_created', { ...hazard, device_id: 'B', detail: 'second', lat: 33.12342, lng: -96.98762 }, { observedAt });
assert.deepStrictEqual(e1.report, e2.report);
assert.strictEqual(globalThis.gridlyPassiveHistoryCaptureIdempotency.createPhase1AIdempotencyKey(e1), globalThis.gridlyPassiveHistoryCaptureIdempotency.createPhase1AIdempotencyKey(e2));
assert.ok(!JSON.stringify(e1).includes(deviceId));
assert.ok(!JSON.stringify(e1).includes('water over road'));

(async () => {
  const badStorage = { schema() { return { from() { return { async insert() { throw new Error('writer failed'); } }; } }; } };
  const result = await globalThis.gridlyPassiveHistoryCapturePhase1A.capturePhase1AEvent({ eventType: 'report_created', report: hazard, storageClient: badStorage, writerEnabled: true });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.noop, true);
  assert.strictEqual(result.reason, 'passive_history_capture_sidecar_writer_fail_open');
  assert.ok(!JSON.stringify(result).includes(deviceId));

  const audit = globalThis.gridlyLp0532HistoricalPayloadMinimizationAudit?.();
  assert.strictEqual(audit.certificationStatus, 'pass');
  assert.strictEqual(audit.historicalReadsRemainDisabled, true);
  assert.strictEqual(audit.historicalUiRemainsDisabled, true);
  assert.strictEqual(audit.safeToProceedToLp0533, true);

  assert.strictEqual(globalThis.createSharedReport, undefined);
  assert.strictEqual(globalThis.gridlyRouteWatch, undefined);
  console.log('historyCapturePayloadMinimization.test.js passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
