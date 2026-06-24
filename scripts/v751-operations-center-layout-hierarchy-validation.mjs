import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const report = fs.readFileSync('GRIDLY-V751-OPERATIONS-CENTER-LAYOUT-HIERARCHY.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v751-operations-center-layout-hierarchy.json', 'utf8'));

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/);
assert.match(app, /window\.gridlyEnableOperationsCenterPreviewForTest = function gridlyEnableOperationsCenterPreviewForTest/);
assert.match(app, /window\.gridlyOperationsLayoutHierarchyAudit = function gridlyOperationsLayoutHierarchyAudit/);
assert.match(app, /window\.gridlyOperationsDataBridgeAudit\(\)/, 'preview must continue using V743 data bridge audit');
assert.match(app, /dataset\.gridlyOperationsPreviewUsesDataBridge = "true"/);
assert.match(app, /dataset\.gridlyOperationsLayoutHierarchy = "v751"/);
assert.match(app, /gridlyOperationsCardTier/);
assert.match(app, /primaryStatusCardsRendered/);
assert.match(app, /readOnlyPresentationOnly/);
assert.match(app, /noMobileBleedDetected/);
assert.doesNotMatch(app, /buildGridlyOperationsCenterShellDocument[\s\S]{0,12000}fetch\(/);
assert.doesNotMatch(app, /buildGridlyOperationsCenterShellDocument[\s\S]{0,12000}setInterval\(/);
assert.doesNotMatch(app, /buildGridlyOperationsCenterShellDocument[\s\S]{0,12000}setTimeout\(/);
assert.doesNotMatch(app, /gridlyOperationsLayoutHierarchyAudit[\s\S]{0,6000}(localStorage|sessionStorage|indexedDB|fetch\(|setInterval\(|setTimeout\()/);

for (const cls of [
  'gridly-operations-center-shell__dashboard',
  'gridly-operations-center-shell__sections--primary',
  'gridly-operations-center-shell__card--primary',
  'gridly-operations-center-shell__card-header',
  'gridly-operations-center-shell__empty-state'
]) assert.match(css, new RegExp(cls));

for (const section of [
  'Final determination',
  'Layout hierarchy',
  'Default disabled audit result',
  'Enabled preview audit result',
  'Isolation confirmation',
  'Protected-system confirmation',
  'Denise browser validation block',
  'Merge recommendation'
]) assert.match(report, new RegExp(`## ${section}`));

assert.equal(evidence.version, 'V751');
assert.equal(evidence.finalDetermination, 'PASS');
assert.equal(evidence.runtimeFlag.default, false);
assert.equal(evidence.defaultDisabledAudit.operationsCenterEnabled, false);
assert.equal(evidence.defaultDisabledAudit.shellRendered, false);
assert.equal(evidence.defaultDisabledAudit.previewRendered, false);
assert.equal(evidence.defaultDisabledAudit.safeForMobile, true);
assert.equal(evidence.enabledPreviewAudit.operationsCenterEnabled, true);
assert.equal(evidence.enabledPreviewAudit.operationsDashboardRendered, true);
assert.equal(evidence.enabledPreviewAudit.layoutHierarchyPass, true);
assert.equal(evidence.enabledPreviewAudit.primaryStatusCardsRendered, true);
assert.equal(evidence.enabledPreviewAudit.sectionHeadersReadable, true);
assert.equal(evidence.enabledPreviewAudit.emptyStatesReadable, true);
assert.equal(evidence.enabledPreviewAudit.noMobileBleedDetected, true);
assert.equal(evidence.enabledPreviewAudit.readOnlyPresentationOnly, true);
assert.equal(evidence.enabledPreviewAudit.previewUsesDataBridge, true);
assert.equal(evidence.enabledPreviewAudit.previewReadOnly, true);
assert.equal(evidence.enabledPreviewAudit.previewCreatesNoWrites, true);
assert.equal(evidence.enabledPreviewAudit.previewCreatesNoFetches, true);
assert.equal(evidence.enabledPreviewAudit.previewCreatesNoTimers, true);
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V751 Operations Center layout hierarchy validation passed');
