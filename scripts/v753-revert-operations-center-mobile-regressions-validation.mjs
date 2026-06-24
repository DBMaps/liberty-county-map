import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const report = fs.readFileSync('GRIDLY-V753-REVERT-OPERATIONS-CENTER-MOBILE-REGRESSIONS.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v753-revert-operations-center-mobile-regressions.json', 'utf8'));

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/);
assert.match(app, /window\.gridlyMobilePortraitVisualIntegrityAudit = function gridlyMobilePortraitVisualIntegrityAudit/);
assert.match(app, /getBoundingClientRect/);
assert.match(app, /version: "V753"/);
assert.match(app, /gridlyEnableOperationsCenterPreviewForTest/);
assert.match(app, /GRIDLY V753 disabled Operations Center preview helper/);
assert.match(app, /GRIDLY V753 disabled Operations Center preview to protect mobile portrait containment/);
assert.match(app, /operationsPreviewAffectsMobileLayout/);
assert.match(app, /operationsCssLeakDetected/);
assert.match(app, /horizontalSplitDetected/);
assert.match(app, /mobileContentClipped/);
assert.match(app, /leftBleedDetected/);
assert.match(app, /window\.gridlyOperationsDataBridgeAudit = function gridlyOperationsDataBridgeAudit/);
assert.match(app, /window\.gridlyOperationsIsolationAudit = function gridlyOperationsIsolationAudit/);
assert.doesNotMatch(app, /function buildGridlyOperationsCenterShellDocument/);
assert.doesNotMatch(app, /function gridlyOperationsResolvePreviewHost/);
assert.doesNotMatch(app, /dataset\.gridlyOperationsLayoutHierarchy = "v751"/);
assert.doesNotMatch(app, /document\.createElement\("aside"\)[\s\S]{0,400}gridly-operations-center-preview-host/);
assert.doesNotMatch(css, /gridly-operations-center-preview-host/);
assert.doesNotMatch(css, /gridly-operations-center-shell/);
assert.doesNotMatch(css, /GRIDLY V751/);

for (const section of [
  'Final determination',
  'Exact root cause removed',
  'Operations preview status',
  'Mobile portrait audit expected result',
  'What changed',
  'What did not change',
  'Denise browser validation block',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`));
}

assert.equal(evidence.version, 'V753');
assert.equal(evidence.finalDetermination, 'BLOCKED_PENDING_DENISE_VISUAL_CONFIRMATION');
assert.equal(evidence.operationsCenter.previewDisabled, true);
assert.equal(evidence.operationsCenter.operationsCenterEnabled, false);
assert.equal(evidence.operationsCenter.shellRendered, false);
assert.equal(evidence.operationsCenter.previewRendered, false);
assert.equal(evidence.operationsCenter.safeForMobile, true);
assert.equal(evidence.expectedMobilePortraitAudit.mobilePortraitIntegrityPass, true);
assert.equal(evidence.expectedMobilePortraitAudit.horizontalSplitDetected, false);
assert.equal(evidence.expectedMobilePortraitAudit.mobileContentClipped, false);
assert.equal(evidence.expectedMobilePortraitAudit.leftBleedDetected, false);
assert.equal(evidence.expectedMobilePortraitAudit.operationsCssLeakDetected, false);
assert.equal(evidence.expectedMobilePortraitAudit.operationsPreviewAffectsMobileLayout, false);

console.log('V753 Operations Center mobile regression revert validation passed.');
