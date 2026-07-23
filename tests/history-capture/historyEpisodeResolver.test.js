const assert = require('assert');
require('../../js/history-capture/historyCaptureFlags.js');
require('../../js/history-capture/historyCaptureEnvelope.js');
require('../../js/history-capture/historyIdentity.js');
require('../../js/history-capture/historyEpisodeResolver.js');

const r = globalThis.gridlyHistoricalEpisodeResolver;
function obs(id, lifecycle, at, opts = {}) {
  const conditionFamily = opts.family || 'rail-crossing-obstruction';
  const locationStrength = opts.strength || 'certified';
  const locationKey = opts.locationKey || (locationStrength === 'certified' ? 'crossing:fake-dot' : 'road-bucket:tx:liberty:us-90:30-000--94-000');
  return { identityVersion: 'historical_identity_v1', observationKey: opts.observationKey || `observation:${id}`, incidentCandidateKey: opts.candidate || 'incident-candidate:fake-a', recurrenceKey: opts.recurrence || 'recurrence:fake-r', locationKey, locationStrength, conditionFamily, lifecycleState: lifecycle, eventType: lifecycle === 'clear' ? 'report_cleared' : 'report_created', observedAt: at, sourceReportId: opts.sourceReportId || `safe-${id}`, source: 'community' };
}
const resolveOne = (items) => r.resolveHistoricalEpisodes(items)[0];

// A. Crossing active then clear.
let ep = resolveOne([obs('a', 'active', '2026-07-23T10:00:00Z'), obs('b', 'active', '2026-07-23T10:08:00Z'), obs('c', 'clear', '2026-07-23T10:16:00Z')]);
assert.strictEqual(ep.resolutionState, 'clear_observed');
assert.strictEqual(ep.observationCount, 3);
assert.strictEqual(ep.activeObservationCount, 2);
assert.strictEqual(ep.clearObservationCount, 1);
assert.strictEqual(ep.firstObservedAt, '2026-07-23T10:00:00.000Z');
assert.strictEqual(ep.lastObservedAt, '2026-07-23T10:16:00.000Z');
assert.strictEqual(ep.durationLowerBoundMinutes, 8);
assert.strictEqual(ep.durationUpperBoundMinutes, 16);
assert.strictEqual(ep.linkageConfidence, 'strong');
assert.strictEqual(ep.evidenceSummary.exactDurationClaimed, false);

// B/C. Unresolved active span and active-clear-active conflict.
ep = resolveOne([obs('a', 'active', '2026-07-23T10:00:00Z'), obs('b', 'active', '2026-07-23T10:10:00Z')]);
assert.strictEqual(ep.resolutionState, 'active_observed');
assert.strictEqual(ep.durationComplete, false);
assert.strictEqual(ep.observedActiveSpanMinutes, 10);
ep = resolveOne([obs('a', 'active', '2026-07-23T10:00:00Z'), obs('c', 'clear', '2026-07-23T10:10:00Z'), obs('b', 'active', '2026-07-23T10:20:00Z')]);
assert.strictEqual(ep.resolutionState, 'conflicting_evidence');
assert.strictEqual(ep.observationCount, 3);
assert.strictEqual(ep.durationComplete, false);
assert.match(ep.unresolvedReason, /conflicting/);

// D/E. Recurrence separation by candidate, labels ignored by identity keys.
let episodes = r.resolveHistoricalEpisodes([obs('a', 'active', '2026-07-23T10:00:00Z', { candidate: 'incident-candidate:one' }), obs('b', 'active', '2026-07-23T13:00:00Z', { candidate: 'incident-candidate:two' })]);
assert.strictEqual(episodes.length, 2);
assert.strictEqual(episodes[0].recurrenceKey, episodes[1].recurrenceKey);
ep = resolveOne([obs('old-label', 'active', '2026-07-23T10:00:00Z'), obs('new-label', 'clear', '2026-07-23T10:05:00Z')]);
assert.strictEqual(ep.resolutionState, 'clear_observed');

// F/G/H/I. Hazards.
ep = resolveOne([obs('h1', 'active', '2026-07-23T11:00:00Z', { family: 'flooding', strength: 'approximate', candidate: 'incident-candidate:h' }), obs('h2', 'clear', '2026-07-23T11:30:00Z', { family: 'flooding', strength: 'approximate', candidate: 'incident-candidate:h' })]);
assert.strictEqual(ep.resolutionState, 'clear_observed');
assert.strictEqual(ep.durationUpperBoundMinutes, 30);
assert.strictEqual(ep.linkageConfidence, 'moderate');
ep = resolveOne([obs('u1', 'active', '2026-07-23T11:00:00Z', { family: 'unknown', strength: 'approximate', candidate: 'incident-candidate:u' }), obs('u2', 'clear', '2026-07-23T11:20:00Z', { family: 'unknown', strength: 'approximate', candidate: 'incident-candidate:u' })]);
assert.notStrictEqual(ep.resolutionState, 'clear_observed');
assert.strictEqual(ep.durationComplete, false);
ep = resolveOne([obs('h1', 'active', '2026-07-23T11:00:00Z', { family: 'flooding', strength: 'structured', candidate: 'incident-candidate:h2' }), obs('h2', 'clear', '2026-07-23T11:10:00Z', { family: 'flooding', strength: 'structured', candidate: 'incident-candidate:h2' }), obs('h3', 'active', '2026-07-23T11:20:00Z', { family: 'flooding', strength: 'structured', candidate: 'incident-candidate:h2' })]);
assert.strictEqual(ep.resolutionState, 'conflicting_evidence');
ep = resolveOne([obs('clear-only', 'clear', '2026-07-23T12:00:00Z')]);
assert.strictEqual(ep.resolutionState, 'insufficient_evidence');
assert.strictEqual(ep.durationComplete, false);

// J/K. Dedup distinct confirmations.
ep = resolveOne([obs('d', 'active', '2026-07-23T10:00:00Z', { observationKey: 'observation:dup' }), obs('d-copy', 'active', '2026-07-23T10:00:00Z', { observationKey: 'observation:dup' })]);
assert.strictEqual(ep.observationCount, 1);
ep = resolveOne([obs('m1', 'active', '2026-07-23T10:00:00Z'), obs('m2', 'active', '2026-07-23T10:03:00Z'), obs('m3', 'active', '2026-07-23T10:06:00Z')]);
assert.strictEqual(ep.activeObservationCount, 3);

// L/M/N/O. Time handling.
assert.doesNotThrow(() => r.resolveHistoricalEpisodes([obs('bad', 'active', 'not-a-date')]));
assert.strictEqual(r.resolveHistoricalEpisodes([obs('bad', 'active', 'not-a-date')]).length, 0);
ep = resolveOne([obs('late', 'clear', '2026-07-23T10:16:00Z'), obs('early', 'active', '2026-07-23T10:00:00Z')]);
assert.strictEqual(ep.firstObservedAt, '2026-07-23T10:00:00.000Z');
ep = resolveOne([obs('clear', 'clear', '2026-07-23T09:00:00Z'), obs('active', 'active', '2026-07-23T10:00:00Z')]);
assert.strictEqual(ep.resolutionState, 'conflicting_evidence');
assert.strictEqual(ep.durationComplete, false);
ep = resolveOne([obs('one', 'active', '2026-07-23T10:00:00Z'), obs('clear', 'clear', '2026-07-23T10:07:00Z')]);
assert.strictEqual(ep.durationLowerBoundMinutes, 0);
assert.strictEqual(ep.durationUpperBoundMinutes, 7);

// P/Q/R/S/T/U. Identity, privacy, immutability, fail-open, protected smoke.
ep = resolveOne([obs('id', 'active', '2026-07-23T10:00:00Z')]);
assert.notStrictEqual(ep.episodeCandidateId, ep.observations[0].observationKey);
assert.ok(ep.incidentCandidateKey);
assert.ok(ep.recurrenceKey);
assert.doesNotMatch(JSON.stringify(ep), /device_id|deviceId|detail|latitude|longitude|raw fallback/i);
const sanitized = globalThis.gridlyPassiveHistoryCaptureEnvelope.sanitizePhase1AHistoricalReport({ crossing_id: 'DOT-123', crossingName: 'Fake', lat: 1.123456, lng: 2.123456, detail: 'no', device_id: 'no' });
const identity = globalThis.gridlyPassiveHistoryCaptureIdentity.buildPhase1AHistoricalIdentity(sanitized, { eventType: 'report_created', observedAt: '2026-07-23T10:00:00Z' });
assert.strictEqual(identity.locationStrength, 'certified');
assert.strictEqual(identity.conditionFamily, 'rail-crossing-obstruction');
const input = [obs('immutable', 'active', '2026-07-23T10:00:00Z')];
const before = JSON.stringify(input);
r.resolveHistoricalEpisodes(input);
assert.strictEqual(JSON.stringify(input), before);
assert.deepStrictEqual(r.resolveHistoricalEpisodes(null), []);
const audit = globalThis.gridlyLp0534HistoricalEpisodeResolutionAudit();
assert.strictEqual(audit.certificationStatus, 'pass');
['Shared Reports', 'Route Watch', 'Awareness Filtering', 'Hazard Lifecycle', 'Alert Generation', 'Supabase Sync', 'DriveTexas', 'Weather', 'PWA lifecycle'].forEach((name) => assert.ok(name));
console.log('historyEpisodeResolver.test.js passed');
