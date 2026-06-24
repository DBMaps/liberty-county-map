import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v748-launch-focus-layout-state-root-cause-audit.json', 'utf8'));
const report = fs.readFileSync('GRIDLY-V748-LAUNCH-FOCUS-LAYOUT-STATE-ROOT-CAUSE-AUDIT.md', 'utf8');

assert.match(app, /const gridlyLaunchFocusLayoutStateTrace = \{/, 'read-only layout trace must exist');
assert.match(app, /window\.gridlyLaunchFocusLayoutStateAudit = function gridlyLaunchFocusLayoutStateAudit\(\)/, 'V748 audit helper must exist');
assert.match(app, /exposeGridlyAuditHelper\("gridlyLaunchFocusLayoutStateAudit"/, 'V748 audit helper must be exposed');
assert.match(app, /containmentClassElementExpected = "body"/, 'audit must identify body as containment class target');
assert.match(app, /lastLayoutSignal\.desktopGateSuppressedForLaunchFocus/, 'audit must identify desktop-gate suppression coupling');
assert.match(app, /recommendedNextFix: "In a later behavior-change milestone/, 'audit must recommend next fix without applying it');
assert.doesNotMatch(app, /const launchFocusPortraitValidation = Boolean\(activeLayoutMode === "portrait" && shouldSuppressGridlyDesktopGateForLaunchFocus\(\)\);/, 'V748 must not patch containment behavior yet');

assert.equal(evidence.version, 'V748');
assert.equal(evidence.rootCauseFound, true);
assert.equal(evidence.containmentClassElementExpected, 'body');
assert.equal(evidence.operationsCenterCausedIssue, false);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

for (const section of [
  'Final determination',
  'Root cause found or not found',
  'Layout state ownership map',
  'Desktop gate ownership map',
  'Portrait containment ownership map',
  'Exact reason containment did not activate',
  'Why portraitMaxAllowedWidth was 980 instead of 430',
  'Whether Operations Center caused the issue',
  'Recommended next fix',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report missing section: ${section}`);
}

console.log('V748 launch-focus layout state root cause audit validation passed.');
