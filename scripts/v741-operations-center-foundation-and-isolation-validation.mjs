import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V741-OPERATIONS-CENTER-FOUNDATION-AND-ISOLATION.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v741-operations-center-foundation-and-isolation.json', 'utf8'));

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/, 'Operations Center flag must default false');
assert.match(app, /window\.GRIDLY_OPERATIONS_CENTER_ENABLED = GRIDLY_OPERATIONS_CENTER_ENABLED;/, 'Operations Center flag must be protected on window');
assert.match(app, /window\.gridlyOperationsIsolationAudit = function gridlyOperationsIsolationAudit\(\)/, 'Operations Center isolation audit helper must exist');
assert.match(app, /exposeGridlyAuditHelper\("gridlyOperationsIsolationAudit"/, 'Operations Center isolation audit helper must be exposed');
assert.match(app, /mobileRefreshLoopParticipant: false/, 'Operations Center must not participate in mobile refresh loop');
assert.match(app, /portraitDomUpdatesAllowed: false/, 'Operations Center must not update portrait DOM');
assert.match(app, /portraitRefreshCallbacksRegistered: false/, 'Operations Center must not register portrait callbacks');
assert.match(app, /communityPulseOwnershipModified: false/, 'Community Pulse ownership must remain unchanged');
assert.match(app, /routeWatchOwnershipModified: false/, 'Route Watch ownership must remain unchanged');
assert.match(app, /refreshPipelineModified: false/, 'Refresh pipeline must remain unchanged');
assert.doesNotMatch(app, /createElement\(["']gridlyOperationsCenter|appendChild\(.*gridlyOperationsCenter|dispatch-board-replacement/i, 'V741 must not add Operations Center UI implementation markers');

for (const section of [
  'Final determination',
  'Architecture overview',
  'Isolation contract',
  'Protected systems',
  'Operations Center vision',
  'Non-goals',
  'Mobile regression prevention',
  'Denise validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report must include ${section}`);
}

assert.equal(evidence.version, 'V741');
assert.equal(evidence.finalDetermination, 'PASS');
assert.equal(evidence.runtimeFlag.name, 'GRIDLY_OPERATIONS_CENTER_ENABLED');
assert.equal(evidence.runtimeFlag.default, false);
assert.equal(evidence.runtimeFlag.mobileParityWhenFalse, true);
assert.equal(evidence.isolationAuditExpectedResult, 'PASS');
assert.equal(evidence.isolationAudit.mobileDomModified, false);
assert.equal(evidence.isolationAudit.portraitRendererModified, false);
assert.equal(evidence.isolationAudit.mobileRefreshHookAdded, false);
assert.equal(evidence.isolationAudit.sharedModelOwnershipChanged, false);
assert.equal(evidence.isolationAudit.communityPulseOwnershipChanged, false);
assert.equal(evidence.isolationAudit.routeWatchOwnershipChanged, false);
assert.equal(evidence.isolationAudit.refreshPipelineModified, false);
assert.equal(evidence.isolationAudit.safeForMobile, true);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V741 Operations Center foundation and isolation validation passed');
