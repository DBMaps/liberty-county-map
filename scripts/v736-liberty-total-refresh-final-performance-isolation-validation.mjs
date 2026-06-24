import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const report = readFileSync('GRIDLY-V736-LIBERTY-TOTAL-REFRESH-FINAL-PERFORMANCE-ISOLATION.md', 'utf8');
const evidence = JSON.parse(readFileSync('assets/evidence/v736-liberty-total-refresh-final-performance-isolation.json', 'utf8'));

assert.match(app, /timeSection\("shared_community_pulse_model_reuse"/, 'updateDailyHabitStatus must isolate the reused Community Pulse dependency');
assert.match(app, /gridlyCommunityPulseAuditState\?\.v734SharedModelSignature === expectedPulseSignature/, 'updateDailyHabitStatus must reuse the V734 shared model when signatures match');
assert.match(app, /refreshGridlyCommunityPulseSharedModel\(\{ reason: "update-daily-habit-status-reuse", topAwarenessMicrolineReadOnly: true \}\)/, 'fallback must use refreshGridlyCommunityPulseSharedModel reuse path');
assert.doesNotMatch(app, /const awarenessPulseModel = typeof buildGridlyCommunityPulseModel === "function" \? buildGridlyCommunityPulseModel\(\{ topAwarenessMicrolineReadOnly: true \}\) : \{\};/, 'updateDailyHabitStatus must not directly rebuild the Community Pulse model');

for (const section of [
  'Final determination',
  'Remaining root cause found',
  'Exact remaining slow section',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Performance expectation',
  'Denise physical-device validation steps',
  'Merge recommendation'
]) {
  assert.ok(report.includes(`## ${section}`), `report must include ${section}`);
}

assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);
assert.equal(evidence.optimization.preservesV729CountReconciliation, true);
assert.equal(evidence.optimization.preservesV732CanonicalLocation, true);
assert.equal(evidence.optimization.preservesV734Reuse, true);
assert.equal(evidence.optimization.preservesV735PortraitLocalizedIntelligenceImprovement, true);
console.log('V736 Liberty total refresh final performance isolation validation passed.');
