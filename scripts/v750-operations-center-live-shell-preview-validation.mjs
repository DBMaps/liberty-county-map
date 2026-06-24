import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V750-OPERATIONS-CENTER-LIVE-SHELL-PREVIEW.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v750-operations-center-live-shell-preview.json', 'utf8'));

const v753PreviewDisabled = /GRIDLY V753 disabled Operations Center preview/.test(app);

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/);
assert.match(app, /window\.GRIDLY_OPERATIONS_CENTER_ENABLED = GRIDLY_OPERATIONS_CENTER_ENABLED;/);
assert.match(app, /window\.gridlyEnableOperationsCenterPreviewForTest = function gridlyEnableOperationsCenterPreviewForTest/);
assert.match(app, /window\.gridlyDisableOperationsCenterPreviewForTest = function gridlyDisableOperationsCenterPreviewForTest/);
assert.match(app, /previewRendered/);
assert.match(app, /previewUsesDataBridge/);
assert.match(app, /previewReadOnly: true/);
assert.match(app, /previewCreatesNoWrites: true/);
assert.match(app, /previewCreatesNoFetches: true/);
assert.match(app, /previewCreatesNoTimers: true/);
assert.match(app, /previewTouchesNoMobileDom: false/);
assert.match(app, /previewTouchesNoRefreshPipeline: false/);
assert.match(app, /previewTouchesNoCommunityPulseOwnership: false/);
assert.match(app, /previewTouchesNoRouteWatchOwnership: false/);
assert.doesNotMatch(app, /gridlyEnableOperationsCenterPreviewForTest[\s\S]{0,1200}(localStorage|sessionStorage|indexedDB)/);

if (v753PreviewDisabled) {
  assert.match(app, /window\.gridlyOperationsDataBridgeAudit = function gridlyOperationsDataBridgeAudit/);
  assert.match(app, /safeForMobile: true/);
  assert.doesNotMatch(app, /function buildGridlyOperationsCenterShellDocument/);
  assert.doesNotMatch(app, /gridly-operations-center-preview-host[\s\S]{0,800}document\.createElement\("aside"\)/);
} else {
  const css = fs.readFileSync('css/styles.css', 'utf8');
  assert.match(app, /window\.gridlyOperationsDataBridgeAudit\(\)/, 'preview must use V743 data bridge audit');
  assert.match(app, /dataset\.gridlyOperationsPreviewUsesDataBridge = "true"/);
  assert.doesNotMatch(app, /buildGridlyOperationsCenterShellDocument[\s\S]{0,9000}fetch\(/);
  assert.doesNotMatch(app, /buildGridlyOperationsCenterShellDocument[\s\S]{0,9000}setInterval\(/);
  assert.doesNotMatch(app, /buildGridlyOperationsCenterShellDocument[\s\S]{0,9000}setTimeout\(/);
  assert.match(css, /\.gridly-operations-center-shell/);
  assert.match(css, /\.gridly-operations-center-shell__metric/);
}

for (const section of [
  'Final determination',
  'Preview scope',
  'Data bridge usage',
  'Default disabled behavior',
  'Enabled preview behavior',
  'Isolation confirmation',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise browser validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`));
}

assert.equal(evidence.version, 'V750');
assert.equal(evidence.finalDetermination, 'PASS');
assert.equal(evidence.runtimeFlag.default, false);
assert.equal(evidence.defaultDisabledAudit.operationsCenterEnabled, false);
assert.equal(evidence.defaultDisabledAudit.shellRendered, false);
assert.equal(evidence.defaultDisabledAudit.dataBridgeRendered, false);
assert.equal(evidence.defaultDisabledAudit.previewRendered, false);
assert.equal(evidence.defaultDisabledAudit.safeForMobile, true);

if (!v753PreviewDisabled) {
  assert.equal(evidence.enabledPreviewAudit.operationsCenterEnabled, true);
  assert.equal(evidence.enabledPreviewAudit.previewRendered, true);
  assert.equal(evidence.enabledPreviewAudit.previewUsesDataBridge, true);
}

assert.equal(evidence.enabledPreviewAudit.previewReadOnly, true);
assert.equal(evidence.enabledPreviewAudit.previewCreatesNoWrites, true);
assert.equal(evidence.enabledPreviewAudit.previewCreatesNoFetches, true);
assert.equal(evidence.enabledPreviewAudit.previewCreatesNoTimers, true);
assert.equal(evidence.preview.touchesNoMobileDom, false);
assert.equal(evidence.preview.touchesNoRefreshPipeline, false);
assert.equal(evidence.preview.touchesNoCommunityPulseOwnership, false);
assert.equal(evidence.preview.touchesNoRouteWatchOwnership, false);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log(v753PreviewDisabled
  ? 'V750 Operations Center preview validation passed in V753 disabled-preview compatibility mode'
  : 'V750 Operations Center live shell preview validation passed');
