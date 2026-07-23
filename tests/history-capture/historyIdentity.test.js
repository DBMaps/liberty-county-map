const assert = require('assert');
require('../../js/history-capture/historyIdentity.js');
require('../../js/history-capture/historyCaptureEnvelope.js');
require('../../js/history-capture/historyCaptureIdempotency.js');

const identityApi = globalThis.gridlyPassiveHistoryCaptureIdentity;
const envelopeApi = globalThis.gridlyPassiveHistoryCaptureEnvelope;
assert.ok(identityApi, 'identity API is available');
assert.strictEqual(identityApi.IDENTITY_VERSION, 'historical_identity_v1');
assert.strictEqual(identityApi.normalizeHistoricalIdentityToken(' US90 '), 'us-90');
assert.strictEqual(identityApi.normalizeHistoricalIdentityToken('US 90'), 'us-90');
assert.strictEqual(identityApi.normalizeHistoricalIdentityToken('US-90'), 'us-90');

function sanitized(input) { return envelopeApi.sanitizePhase1AHistoricalReport(input); }
function ident(report, eventType = 'report_created', observedAt = '2026-01-01T00:00:00.000Z') {
  return identityApi.buildPhase1AHistoricalIdentity(sanitized(report), { eventType, observedAt });
}

// A. Certified crossing identity.
const crossing = ident({ id: 'safe-report-a', reportType: 'crossing', category: 'blocked', crossing_id: 'DOT-123', crossingName: 'Waco Street', railroad: 'Example Rail', county_id: 'liberty', state: 'TX', lat: 30.123456, lng: -94.987654 });
assert.strictEqual(crossing.locationKey, 'crossing:dot-123');
assert.strictEqual(crossing.locationStrength, 'certified');
assert.strictEqual(crossing.conditionFamily, 'rail-crossing-obstruction');
assert.ok(crossing.recurrenceKey);
assert.ok(crossing.incidentCandidateKey);
assert.ok(crossing.observationKey);
assert.strictEqual(sanitized({ crossing_id: 'DOT-123', lat: 30.1, lng: -94.1 }).generalizedLocation, undefined);

// B. Crossing blocked and cleared linkage.
const crossingClear = ident({ id: 'safe-report-b', reportType: 'crossing', category: 'cleared', lifecycle: 'clear', crossing_id: 'DOT-123', crossingName: 'Waco Street', railroad: 'Example Rail' }, 'report_cleared', '2026-01-01T01:00:00.000Z');
assert.notStrictEqual(crossing.observationKey, crossingClear.observationKey);
assert.strictEqual(crossing.locationKey, crossingClear.locationKey);
assert.strictEqual(crossing.recurrenceKey, crossingClear.recurrenceKey);
assert.strictEqual(crossing.incidentCandidateKey, crossingClear.incidentCandidateKey);
assert.strictEqual(crossing.lifecycleState, 'active');
assert.strictEqual(crossingClear.lifecycleState, 'clear');
assert.strictEqual(crossing.conditionFamily, crossingClear.conditionFamily);

// C. Crossing later recurrence.
const crossingLater = ident({ id: 'safe-report-c', reportType: 'crossing', category: 'blocked', crossing_id: 'DOT-123' }, 'report_created', '2026-01-01T03:00:00.000Z');
assert.strictEqual(crossing.locationKey, crossingLater.locationKey);
assert.strictEqual(crossing.recurrenceKey, crossingLater.recurrenceKey);
assert.notStrictEqual(crossing.incidentCandidateKey, crossingLater.incidentCandidateKey);

// D. Crossing label change.
const crossingRelabeled = ident({ id: 'safe-report-d', reportType: 'crossing', category: 'blocked', crossing_id: 'DOT-123', crossingName: 'Renamed', railroad: 'Different' });
assert.strictEqual(crossing.locationKey, crossingRelabeled.locationKey);
assert.strictEqual(crossing.recurrenceKey, crossingRelabeled.recurrenceKey);

// E. Structured road intersection identity.
const flood = ident({ id: 'safe-flood-a', reportType: 'hazard', category: 'flooding', intersection: 'Main St & US90', county_id: 'liberty', state: 'TX', lat: 30.123456, lng: -94.987654 });
assert.match(flood.locationKey, /^intersection:tx:liberty:/);
assert.strictEqual(flood.locationStrength, 'structured');
assert.ok(flood.recurrenceKey);
assert.ok(flood.incidentCandidateKey);
assert.strictEqual(flood.candidateWindowMinutes, 360);

// F. Approximate road bucket identity.
const disabled = ident({ id: 'safe-disabled-a', reportType: 'hazard', category: 'disabled_vehicle', roadName: 'US90', county_id: 'liberty', state: 'TX', lat: 30.123456, lng: -94.987654 });
assert.match(disabled.locationKey, /^road-bucket:tx:liberty:us-90:/);
assert.strictEqual(disabled.locationStrength, 'approximate');
assert.ok(disabled.recurrenceKey);
assert.ok(disabled.incidentCandidateKey);
assert.strictEqual(disabled.candidateWindowMinutes, 120);

// G. Road hazard create and clear linkage.
const floodClear = ident({ id: 'safe-flood-b', reportType: 'hazard', category: 'flooding', lifecycle: 'clear', intersection: 'Main St and US-90', county_id: 'liberty', state: 'TX', lat: 30.1234, lng: -94.9876 }, 'report_cleared', '2026-01-01T01:00:00.000Z');
assert.notStrictEqual(flood.observationKey, floodClear.observationKey);
assert.strictEqual(flood.recurrenceKey, floodClear.recurrenceKey);
assert.strictEqual(flood.incidentCandidateKey, floodClear.incidentCandidateKey);
assert.strictEqual(flood.lifecycleState, 'active');
assert.strictEqual(floodClear.lifecycleState, 'clear');

// H. Hazard clear without original family.
const unknownClear = ident({ id: 'safe-clear-a', reportType: 'hazard', lifecycle: 'clear', intersection: 'Main St & US90', county_id: 'liberty', state: 'TX' }, 'report_cleared');
assert.strictEqual(unknownClear.conditionFamily, 'unknown');
assert.strictEqual(unknownClear.incidentCandidateKey, null);
assert.strictEqual(unknownClear.recurrenceKey, null);

// I. Confirmation grouping.
const confirmA = ident({ id: 'safe-confirm-a', reportType: 'hazard', category: 'debris', roadName: 'FM 1960', county_id: 'liberty', state: 'TX', lat: 30.2222, lng: -94.1111 }, 'report_created', '2026-01-01T00:15:00.000Z');
const confirmB = ident({ id: 'safe-confirm-b', reportType: 'hazard', category: 'debris', roadName: 'FM-1960', county_id: 'liberty', state: 'TX', lat: 30.2223, lng: -94.1112 }, 'report_created', '2026-01-01T01:15:00.000Z');
assert.notStrictEqual(confirmA.observationKey, confirmB.observationKey);
assert.strictEqual(confirmA.incidentCandidateKey, confirmB.incidentCandidateKey);
assert.strictEqual(confirmA.recurrenceKey, confirmB.recurrenceKey);

// J. Separate incidents same day.
const debrisLater = ident({ id: 'safe-confirm-c', reportType: 'hazard', category: 'debris', roadName: 'FM 1960', county_id: 'liberty', state: 'TX', lat: 30.2222, lng: -94.1111 }, 'report_created', '2026-01-01T03:00:00.000Z');
assert.notStrictEqual(confirmA.incidentCandidateKey, debrisLater.incidentCandidateKey);
assert.strictEqual(confirmA.recurrenceKey, debrisLater.recurrenceKey);

// K. Different hazard families same location.
const construction = ident({ id: 'safe-construction-a', reportType: 'hazard', category: 'construction', intersection: 'Main St & US90', county_id: 'liberty', state: 'TX', lat: 30.1234, lng: -94.9876 });
assert.strictEqual(flood.locationKey, construction.locationKey);
assert.notStrictEqual(flood.conditionFamily, construction.conditionFamily);
assert.notStrictEqual(flood.recurrenceKey, construction.recurrenceKey);
assert.notStrictEqual(flood.incidentCandidateKey, construction.incidentCandidateKey);
assert.strictEqual(construction.candidateWindowMinutes, 1440);

// L. Unsafe identifiers.
const unsafeA = ident({ id: 'hazard-device-a-1770000000000', device_id: 'device-a', detail: 'private text', reportType: 'hazard', category: 'disabled_vehicle', roadName: 'US 90', county_id: 'liberty', state: 'TX', lat: 30.12341, lng: -94.98761 });
const unsafeB = ident({ id: 'hazard-device-b-1770000000000', device_id: 'device-b', detail: 'changed text', reportType: 'hazard', category: 'disabled_vehicle', roadName: 'US-90', county_id: 'liberty', state: 'TX', lat: 30.12342, lng: -94.98762 });
assert.strictEqual(unsafeA.sourceReportId, null);
assert.strictEqual(unsafeA.locationKey, unsafeB.locationKey);
assert.strictEqual(unsafeA.incidentCandidateKey, unsafeB.incidentCandidateKey);
assert.strictEqual(unsafeA.recurrenceKey, unsafeB.recurrenceKey);
for (const value of [unsafeA.locationKey, unsafeA.incidentCandidateKey, unsafeA.recurrenceKey]) {
  assert.ok(!String(value).includes('device-a'));
  assert.ok(!String(value).includes('private'));
  assert.ok(!String(value).includes('30.12341'));
}

// M. Invalid timestamp.
const invalidTime = ident({ id: 'safe-invalid-time', reportType: 'hazard', category: 'flooding', intersection: 'Main & US90', county_id: 'liberty', state: 'TX' }, 'report_created', 'not-a-time');
assert.ok(invalidTime.observationKey);
assert.strictEqual(invalidTime.incidentCandidateKey, null);
assert.ok(invalidTime.recurrenceKey);

// N. Insufficient location.
const insufficient = ident({ id: 'safe-insufficient', reportType: 'hazard', category: 'flooding' });
assert.strictEqual(insufficient.locationStrength, 'insufficient');
assert.strictEqual(insufficient.locationKey, null);
assert.strictEqual(insufficient.incidentCandidateKey, null);
assert.strictEqual(insufficient.recurrenceKey, null);

// O. Input immutability.
const original = sanitized({ id: 'safe-immutable', reportType: 'hazard', category: 'crash', roadName: 'TX 146', county_id: 'liberty', state: 'TX', lat: 30.1, lng: -94.9 });
const before = JSON.stringify(original);
const immutableIdentity = identityApi.buildPhase1AHistoricalIdentity(original, { eventType: 'report_created', observedAt: '2026-01-01T00:00:00.000Z' });
assert.strictEqual(JSON.stringify(original), before);
assert.notStrictEqual(immutableIdentity, original);
assert.strictEqual(Object.getPrototypeOf(immutableIdentity), Object.prototype);
assert.doesNotThrow(() => JSON.stringify(immutableIdentity));
assert.strictEqual(Object.isFrozen(immutableIdentity), true);

// P. Fail-open and envelope integration.
const envelope = envelopeApi.buildPhase1AEnvelope('report_created', { id: 'safe-envelope', reportType: 'hazard', category: 'crash', roadName: 'TX 146', county_id: 'liberty', state: 'TX', lat: 30.1, lng: -94.9, detail: 'private' }, { observedAt: '2026-01-01T00:00:00.000Z' });
assert.ok(envelope.identity);
assert.strictEqual(envelope.report.detail, undefined);
assert.strictEqual(envelope.identity.conditionFamily, 'crash');
assert.strictEqual(globalThis.gridlyPassiveHistoryCaptureIdempotency.createPhase1AIdempotencyKey(envelope).startsWith('phase1a:'), true);

// Q. LP053.2 regression and audit.
const minimized = sanitized({ id: 'hazard-cleared-device-123-1770000000000', device_id: 'device-123', detail: 'hidden', reportType: 'hazard', category: 'flooding', lat: 30.123456, lng: -94.987654 });
assert.strictEqual(minimized.device_id, undefined);
assert.strictEqual(minimized.id, undefined);
assert.strictEqual(minimized.detail, undefined);
assert.strictEqual(minimized.lat, undefined);
assert.strictEqual(minimized.locationBucket, '30.123,-94.988');
const audit = globalThis.gridlyLp0533HistoricalEventIdentityAudit();
assert.strictEqual(audit.certificationStatus, 'pass');
assert.strictEqual(audit.historicalReadsRemainDisabled, true);
assert.strictEqual(audit.historicalUiRemainsDisabled, true);

// R. Protected-system smoke coverage by no production hook replacement.
assert.strictEqual(globalThis.createSharedReport, undefined);
assert.strictEqual(globalThis.gridlyDriveTexasLiveConnectorEnabled, undefined);

console.log('historyIdentity.test.js passed');
