import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v745-operations-center-desktop-gate-actual-fix.json', 'utf8'));
const report = fs.readFileSync('GRIDLY-V745-OPERATIONS-CENTER-DESKTOP-GATE-ACTUAL-FIX.md', 'utf8');

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/, 'Operations Center must remain disabled by default');
assert.match(app, /const GRIDLY_LAUNCH_FOCUS_MOBILE_VALIDATION_ENABLED = true;/, 'launch-focus mobile validation suppression flag must exist');
assert.match(app, /const GRIDLY_DESKTOP_GATE_SUPPRESSED_REASON = "suppressed_for_launch_focus_or_mobile_validation";/, 'desktop gate suppressed reason must be explicit');
assert.match(app, /function isGridlyDesktopGateIntentionallyRequested\(\)/, 'intentional desktop gate request helper must exist');
assert.match(app, /function shouldSuppressGridlyDesktopGateForLaunchFocus\(\)/, 'desktop gate launch-focus suppression helper must exist');
assert.match(app, /desktopGateSuppressedForLaunchFocus \? "portrait" : forcedDesktop \? "desktop"/, 'layout resolver must prefer portrait when desktop gate is suppressed');
assert.match(app, /const desktopGateReason = desktopGateVisible \? GRIDLY_DESKTOP_GATE_DEFAULT_REASON : getGridlyDesktopGateReason\(\);/, 'isolation audit must expose desktop gate reason');
assert.match(app, /const desktopGateSource = GRIDLY_DESKTOP_GATE_SOURCE;/, 'isolation audit must expose desktop gate source');
assert.match(app, /const mobileExperienceVisibilityReason = mobileExperienceVisible \? "portrait_mobile_surface_visible" : "no_mobile_owned_surface_visible";/, 'isolation audit must expose mobile visibility reason');
assert.match(app, /version: "V745"/, 'isolation audit version must be V745');

assert.equal(evidence.isolationAudit.status, 'PASS');
assert.equal(evidence.isolationAudit.operationsCenterEnabled, false);
assert.equal(evidence.isolationAudit.shellRendered, false);
assert.equal(evidence.isolationAudit.dataBridgeRendered, false);
assert.equal(evidence.isolationAudit.desktopGateVisible, false);
assert.equal(evidence.isolationAudit.desktopGateReason, 'suppressed_for_launch_focus_or_mobile_validation');
assert.equal(evidence.isolationAudit.desktopGateSource, 'css_body_data_layout_mode_desktop_gridlyDesktopGate');
assert.equal(evidence.isolationAudit.mobileExperienceVisible, true);
assert.equal(evidence.isolationAudit.mobileExperienceVisibilityReason, 'portrait_mobile_surface_visible');
assert.equal(evidence.isolationAudit.operationsGateSideEffectDetected, false);
assert.equal(evidence.isolationAudit.safeForMobile, true);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

for (const section of [
  'Final determination',
  'Actual gate root cause',
  'Gate source/reason',
  'Patch applied',
  'What changed',
  'What did not change',
  'Mobile experience confirmation',
  'Operations isolation confirmation',
  'Protected-system confirmation',
  'Denise browser validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report missing section: ${section}`);
}

console.log('V745 Operations Center desktop gate actual fix validation passed.');
