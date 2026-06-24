import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V743-OPERATIONS-CENTER-READ-ONLY-DATA-BRIDGE.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v743-operations-center-read-only-data-bridge.json', 'utf8'));

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/, 'Operations Center flag must default false');
assert.match(app, /window\.GRIDLY_OPERATIONS_CENTER_ENABLED = GRIDLY_OPERATIONS_CENTER_ENABLED;/, 'Operations Center flag must remain protected on window');
assert.match(app, /const GRIDLY_OPERATIONS_DATA_BRIDGE_SECTIONS = Object\.freeze/, 'data bridge sections must be isolated');
assert.match(app, /window\.gridlyOperationsDataBridgeAudit = function gridlyOperationsDataBridgeAudit\(\)/, 'data bridge audit helper must exist');
assert.match(app, /exposeGridlyAuditHelper\("gridlyOperationsDataBridgeAudit"/, 'data bridge audit helper must be exposed');
assert.match(app, /dataBridgeRegistered: typeof window\.gridlyOperationsDataBridgeAudit === "function"/, 'isolation audit must report data bridge registration');
assert.match(app, /dataBridgeRendered: operationsCenterEnabled === true && shellRendered === true/, 'bridge rendered status must remain flag gated');
assert.match(app, /dataBridgeReadOnly: true/, 'bridge must be read-only');
assert.match(app, /dataBridgeUsesExistingStateOnly: true/, 'bridge must use existing state only');
assert.match(app, /dataBridgeCreatesNoWrites: true/, 'bridge must create no writes');
assert.match(app, /dataBridgeCreatesNoFetches: true/, 'bridge must create no fetches');
assert.match(app, /dataBridgeCreatesNoTimers: true/, 'bridge must create no timers');
assert.match(app, /dataBridgeTouchesNoMobileDom: false/, 'bridge must not touch mobile DOM');
assert.match(app, /dataBridgeTouchesNoRefreshPipeline: false/, 'bridge must not touch refresh pipeline');
assert.match(app, /dataBridgeTouchesNoCommunityPulseOwnership: false/, 'bridge must not touch Community Pulse ownership');
assert.match(app, /dataBridgeTouchesNoRouteWatchOwnership: false/, 'bridge must not touch Route Watch ownership');
assert.doesNotMatch(app, /gridlyOperationsDataBridgeAudit[\s\S]{0,4000}fetch\(/, 'bridge must not fetch');
assert.doesNotMatch(app, /gridlyOperationsDataBridgeAudit[\s\S]{0,4000}setInterval\(/, 'bridge must not create intervals');
assert.doesNotMatch(app, /gridlyOperationsDataBridgeAudit[\s\S]{0,4000}setTimeout\(/, 'bridge must not create timeouts');

for (const section of [
  'countyStatus',
  'communityStatus',
  'activeIncidents',
  'communityPulse',
  'corridorStatus',
  'communitySummary',
  'newReports',
  'recentlyCleared',
  'routeIntelligenceSummary',
  'sourceHealth',
  'bridgeSafety'
]) {
  assert.match(app, new RegExp(section), `bridge must include ${section}`);
  assert.ok(evidence.dataBridge.sections.includes(section), `evidence must include ${section}`);
}

for (const section of [
  'Final determination',
  'Data bridge scope',
  'Data sources consumed',
  'Read-only safety',
  'Flag gating behavior',
  'Isolation confirmation',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report must include ${section}`);
}

assert.equal(evidence.version, 'V743');
assert.equal(evidence.finalDetermination, 'PASS');
assert.equal(evidence.runtimeFlag.default, false);
assert.equal(evidence.dataBridge.registered, true);
assert.equal(evidence.dataBridge.renderedByDefault, false);
assert.equal(evidence.dataBridge.readOnly, true);
assert.equal(evidence.dataBridge.usesExistingStateOnly, true);
assert.equal(evidence.dataBridge.createsNoWrites, true);
assert.equal(evidence.dataBridge.createsNoFetches, true);
assert.equal(evidence.dataBridge.createsNoTimers, true);
assert.equal(evidence.dataBridge.touchesNoMobileDom, false);
assert.equal(evidence.dataBridge.touchesNoRefreshPipeline, false);
assert.equal(evidence.dataBridge.touchesNoCommunityPulseOwnership, false);
assert.equal(evidence.dataBridge.touchesNoRouteWatchOwnership, false);
assert.equal(evidence.isolationAudit.operationsCenterEnabled, false);
assert.equal(evidence.isolationAudit.dataBridgeRegistered, true);
assert.equal(evidence.isolationAudit.dataBridgeRendered, false);
assert.equal(evidence.isolationAudit.safeForMobile, true);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V743 Operations Center read-only data bridge validation passed');
