import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v747-launch-focus-portrait-containment-actual-fix.json', 'utf8'));
const report = fs.readFileSync('GRIDLY-V747-LAUNCH-FOCUS-PORTRAIT-CONTAINMENT-ACTUAL-FIX.md', 'utf8');

assert.match(app, /version: "V747"/, 'isolation audit version must be V747');
assert.match(app, /const viewportWidth = Number\(window\.innerWidth/, 'audit must report viewport width');
assert.match(app, /const portraitRootWidth = Number\(portraitRect\?\.width/, 'audit must report measured portrait root width');
assert.match(app, /const portraitMaxAllowedWidth = launchFocusPortraitValidation \? 430/, 'audit must report portrait max allowed width');
assert.match(app, /const containedByWidth = Boolean\(portraitRootWidth > 0 && portraitRootWidth <= portraitMaxAllowedWidth\)/, 'audit must compute width containment');
assert.match(app, /const containmentClassPresent = Boolean\(document\.body\?\.classList\?\.contains\(GRIDLY_LAUNCH_FOCUS_PORTRAIT_CONTAINER_CLASS\)\)/, 'audit must report containment class');
assert.match(app, /const containmentStyleApplied = Boolean\(launchFocusPortraitValidation && portraitShell && portraitStyle/, 'audit must report applied containment style');
assert.match(app, /viewportWidth,\n    portraitRootWidth,\n    portraitMaxAllowedWidth,\n    containedByWidth,\n    containmentClassPresent,\n    containmentStyleApplied,/, 'audit findings must expose V747 diagnostics');
assert.match(css, /body\[data-layout-mode="portrait"\]\.gridly-launch-focus-portrait-validation #gridlyPortraitV2 \{/, 'CSS must target the actual Portrait V2 root under launch-focus validation');
assert.match(css, /transform: translateX\(-50%\);/, 'CSS must create a containing block for fixed portrait chrome');
assert.match(css, /contain: layout paint;/, 'CSS must apply real containment to portrait root');

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
assert.ok(evidence.isolationAudit.viewportWidth >= evidence.isolationAudit.portraitRootWidth);
assert.ok(evidence.isolationAudit.portraitRootWidth <= evidence.isolationAudit.portraitMaxAllowedWidth);

for (const section of [
  'Final determination',
  'Actual containment root cause',
  'Measured portrait root',
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

console.log('V747 launch-focus portrait containment actual fix validation passed.');
