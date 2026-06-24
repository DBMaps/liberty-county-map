import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v746-mobile-portrait-viewport-containment-fix.json', 'utf8'));
const report = fs.readFileSync('GRIDLY-V746-MOBILE-PORTRAIT-VIEWPORT-CONTAINMENT-FIX.md', 'utf8');

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/, 'Operations Center must remain disabled by default');
assert.match(app, /const GRIDLY_LAUNCH_FOCUS_PORTRAIT_CONTAINER_CLASS = "gridly-launch-focus-portrait-validation";/, 'launch-focus portrait containment class must be explicit');
assert.match(app, /const GRIDLY_LAUNCH_FOCUS_PORTRAIT_CONTAINER_REASON = "launch_focus_portrait_container_active";/, 'portrait containment reason must be explicit');
assert.match(app, /function isGridlyLaunchFocusPortraitValidationActive\(\)/, 'launch-focus portrait validation helper must exist');
assert.match(app, /document\.body\.classList\.toggle\(GRIDLY_LAUNCH_FOCUS_PORTRAIT_CONTAINER_CLASS, launchFocusPortraitValidation\);/, 'layout application must toggle portrait containment class');
assert.match(app, /const mobilePortraitContained = Boolean\(/, 'isolation audit must compute mobilePortraitContained');
assert.match(app, /const portraitContainmentReason = mobilePortraitContained \?/, 'isolation audit must compute portraitContainmentReason');
assert.match(app, /mobilePortraitContained,/, 'audit findings must expose mobilePortraitContained');
assert.match(app, /portraitContainmentReason,/, 'audit findings must expose portraitContainmentReason');
assert.match(app, /findings\.mobilePortraitContained === true/, 'audit PASS must require portrait containment');
assert.match(app, /version: "V746"/, 'isolation audit version must be V746');
assert.match(css, /body\[data-layout-mode="portrait"\]\.gridly-launch-focus-portrait-validation #gridlyPortraitV2/, 'CSS must scope bounded portrait container to launch-focus validation');
assert.match(css, /max-width: 430px;/, 'launch-focus portrait container must be phone-width bounded');

assert.equal(evidence.isolationAudit.status, 'PASS');
assert.equal(evidence.isolationAudit.desktopGateVisible, false);
assert.equal(evidence.isolationAudit.desktopGateReason, 'suppressed_for_launch_focus_or_mobile_validation');
assert.equal(evidence.isolationAudit.mobileExperienceVisible, true);
assert.equal(evidence.isolationAudit.mobilePortraitContained, true);
assert.equal(evidence.isolationAudit.portraitContainmentReason, 'launch_focus_portrait_container_active');
assert.equal(evidence.isolationAudit.operationsCenterEnabled, false);
assert.equal(evidence.isolationAudit.shellRendered, false);
assert.equal(evidence.isolationAudit.dataBridgeRendered, false);
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
  'Portrait containment root cause',
  'Patch applied',
  'What changed',
  'What did not change',
  'Mobile experience confirmation',
  'Operations isolation confirmation',
  'Desktop gate behavior',
  'Protected-system confirmation',
  'Denise browser validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report missing section: ${section}`);
}

console.log('V746 mobile portrait viewport containment fix validation passed.');
