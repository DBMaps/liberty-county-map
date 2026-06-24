import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V744-OPERATIONS-CENTER-GATE-ISOLATION-FIX.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v744-operations-center-gate-isolation-fix.json', 'utf8'));

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/, 'Operations Center flag must default false');
assert.match(app, /window\.GRIDLY_OPERATIONS_CENTER_ENABLED = GRIDLY_OPERATIONS_CENTER_ENABLED;/, 'Operations Center flag must remain protected on window');
assert.match(app, /const desktopGateVisible = isOperationsAuditNodeVisible\(document\.getElementById\("gridlyDesktopGate"\)\);/, 'isolation audit must inspect visible desktop gate state');
assert.match(app, /const mobileExperienceVisible = Boolean\(/, 'isolation audit must inspect visible mobile experience state');
assert.match(app, /const operationsGateSideEffectDetected = Boolean\(operationsCenterEnabled === false/, 'isolation audit must detect disabled Operations gate side effects');
assert.match(app, /desktopGateVisible,/, 'audit findings must expose desktopGateVisible');
assert.match(app, /mobileExperienceVisible,/, 'audit findings must expose mobileExperienceVisible');
assert.match(app, /operationsGateSideEffectDetected,/, 'audit findings must expose operationsGateSideEffectDetected');
assert.match(app, /dataBridgeRendered,/, 'audit findings must expose dataBridgeRendered');
assert.match(app, /findings\.desktopGateVisible === false/, 'audit pass must require desktop gate hidden');
assert.match(app, /findings\.mobileExperienceVisible === true/, 'audit pass must require mobile experience visible');
assert.match(app, /findings\.operationsGateSideEffectDetected === false/, 'audit pass must require no Operations gate side effect');
assert.doesNotMatch(app, /renderGridlyOperationsCenterShell\(\);/, 'Operations shell must not auto-render');

for (const section of [
  'Final determination',
  'Gate issue root cause',
  'What changed',
  'What did not change',
  'Isolation confirmation',
  'Desktop gate behavior',
  'Mobile experience confirmation',
  'Protected-system confirmation',
  'Denise validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report must include ${section}`);
}

assert.equal(evidence.version, 'V744');
assert.equal(evidence.finalDetermination, 'PASS');
assert.equal(evidence.runtimeFlag.default, false);
assert.equal(evidence.runtimeFlag.confirmedFalseDuringIssue, true);
assert.equal(evidence.isolationAudit.operationsCenterEnabled, false);
assert.equal(evidence.isolationAudit.shellRendered, false);
assert.equal(evidence.isolationAudit.dataBridgeRendered, false);
assert.equal(evidence.isolationAudit.desktopGateVisible, false);
assert.equal(evidence.isolationAudit.mobileExperienceVisible, true);
assert.equal(evidence.isolationAudit.operationsGateSideEffectDetected, false);
assert.equal(evidence.isolationAudit.safeForMobile, true);
assert.equal(evidence.desktopGateBehavior.operationsRegistrationAltersDesktopGate, false);
assert.equal(evidence.desktopGateBehavior.operationsCssAddsDesktopOrLandingClasses, false);
assert.equal(evidence.desktopGateBehavior.operationsDomHelperTouchesPresentationStateWhenDisabled, false);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V744 Operations Center gate isolation fix validation passed');
