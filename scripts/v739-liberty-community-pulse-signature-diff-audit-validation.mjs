import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V739-LIBERTY-COMMUNITY-PULSE-SIGNATURE-DIFF-AUDIT.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v739-liberty-community-pulse-signature-diff-audit.json', 'utf8'));

assert.match(app, /function gridlyV739BuildCommunityPulseSignatureDiff/, 'V739 field-level signature diff builder must exist');
assert.match(app, /previousCommunityPulseAuthoritativeSignature/, 'V739 audit must expose previous authoritative signature');
assert.match(app, /currentCommunityPulseAuthoritativeSignature/, 'V739 audit must expose current authoritative signature');
assert.match(app, /changedTopLevelFields/, 'V739 audit must expose changed top-level fields');
assert.match(app, /changedRecordValuesBeforeAfter/, 'V739 audit must expose before/after record values');
assert.match(app, /changedRouteWatchFields/, 'V739 audit must expose route-watch field changes');
assert.match(app, /changedCountyOwnershipFields/, 'V739 audit must expose county ownership field changes');
assert.match(app, /changedAwarenessAreaFields/, 'V739 audit must expose awareness-area field changes');
assert.match(app, /changedLifecycleFields/, 'V739 audit must expose lifecycle field changes');
assert.match(app, /changedCoordinateFields/, 'V739 audit must expose coordinate field changes');
assert.match(app, /changedReportCountFields/, 'V739 audit must expose report-count field changes');
assert.match(app, /changedFreshnessFields/, 'V739 audit must expose freshness field changes');
assert.match(app, /exposeGridlyAuditHelper\("gridlyV739CommunityPulseSignatureDiffAudit"/, 'V739 browser helper must be exposed');
assert.match(app, /routeWatchIdle: Boolean\(typeof routeWatchActivated !== "undefined" && routeWatchActivated && typeof routeWatchIdle !== "undefined" && routeWatchIdle\)/, 'routeWatchIdle must be normalized to false unless Route Watch is activated');
assert.doesNotMatch(app, /cacheOutcome: "hit"[\s\S]{0,120}cache_miss_authoritative_signature_changed/, 'V739 must not force cache hits blindly');

for (const section of [
  'Final determination',
  'Signature diff finding',
  'Exact changed field causing miss',
  'Whether changed field is authoritative or volatile/equivalent',
  'Patch applied',
  'What did not change',
  'Protected-system confirmation',
  'Denise physical-device validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report must include ${section}`);
}

assert.equal(evidence.version, 'V739');
assert.equal(evidence.exactChangedFieldCausingMiss, 'routeWatchIdle');
assert.deepEqual(evidence.signatureDiffFinding.changedRouteWatchFields, ['routeWatchIdle']);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V739 Liberty Community Pulse signature diff audit validation passed');
