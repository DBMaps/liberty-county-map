import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v749-launch-focus-portrait-containment-state-fix.json', 'utf8'));
const report = fs.readFileSync('GRIDLY-V749-LAUNCH-FOCUS-PORTRAIT-CONTAINMENT-STATE-FIX.md', 'utf8');

assert.match(app, /function applyLayoutMode\(nextMode\)/, 'applyLayoutMode must remain the layout-state owner');
assert.match(app, /const launchFocusPortraitValidation = Boolean\(\n    activeLayoutMode === "portrait"\n    && shouldSuppressGridlyDesktopGateForLaunchFocus\(\)\n    && \(GRIDLY_LAUNCH_FOCUS_MOBILE_VALIDATION_ENABLED === true \|\| lastLayoutSignal\?\.desktopGateSuppressedForLaunchFocus === true\)\n  \);/, 'containment activation must be decoupled from requiring desktopGateSuppressedForLaunchFocus');
assert.doesNotMatch(app, /activeLayoutMode === "portrait" && shouldSuppressGridlyDesktopGateForLaunchFocus\(\) && lastLayoutSignal\?\.desktopGateSuppressedForLaunchFocus === true/, 'old narrow one-line gate must not remain');
assert.match(app, /function isGridlyDesktopGateIntentionallyRequested\(\)/, 'intentional desktop gate helper must remain');
assert.match(app, /params\.get\("gridlyDesktopGate"\) === "1"/, 'gridlyDesktopGate=1 override must remain');
assert.match(app, /params\.get\("gridlyDesktopGate"\) === "true"/, 'gridlyDesktopGate=true override must remain');
assert.match(app, /dataset\?\.gridlyDesktopGate === "enabled"/, 'data-gridly-desktop-gate enabled override must remain');
assert.match(app, /portraitContainmentReason = mobilePortraitContained \? \(document\.body\?\.dataset\?\.portraitContainmentReason \|\| \(launchFocusPortraitValidation \? GRIDLY_LAUNCH_FOCUS_PORTRAIT_CONTAINER_REASON/, 'isolation audit must report containment activation reason');
assert.match(app, /containmentClassPresentOnBody/, 'layout-state audit must report body containment class presence');
assert.match(app, /containmentStyleApplied/, 'audits must report containment style application');
assert.match(app, /portraitRootWidth/, 'isolation audit must report portrait root width');
assert.match(app, /layoutMode,\n    bodyLayoutMode/, 'layout-state audit must expose final layout mode');

assert.equal(evidence.version, 'V749');
assert.equal(evidence.status, 'PASS');
assert.equal(evidence.v748RootCauseAddressed, true);
assert.equal(evidence.containmentActivationRule.operationsCenterEnabled, false);
assert.equal(evidence.containmentActivationRule.finalLayoutMode, 'portrait');
assert.equal(evidence.containmentActivationRule.intentionalDesktopGateRequested, false);
assert.equal(evidence.containmentActivationRule.reason, 'launch_focus_portrait_container_active');
assert.equal(evidence.isolationAudit.status, 'PASS');
assert.equal(evidence.isolationAudit.desktopGateVisible, false);
assert.equal(evidence.isolationAudit.mobileExperienceVisible, true);
assert.equal(evidence.isolationAudit.mobilePortraitContained, true);
assert.equal(evidence.isolationAudit.portraitContainmentReason, 'launch_focus_portrait_container_active');
assert.equal(evidence.isolationAudit.containedByWidth, true);
assert.equal(evidence.isolationAudit.containmentClassPresent, true);
assert.equal(evidence.isolationAudit.containmentStyleApplied, true);
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
  'V748 root cause addressed',
  'Patch applied',
  'Containment activation rule',
  'Intentional desktop gate override preserved',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise browser validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report missing section: ${section}`);
}

console.log('V749 launch-focus portrait containment state fix validation passed.');
