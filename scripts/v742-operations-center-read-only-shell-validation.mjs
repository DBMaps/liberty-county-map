import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');
const report = fs.readFileSync('GRIDLY-V742-OPERATIONS-CENTER-READ-ONLY-SHELL.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v742-operations-center-read-only-shell.json', 'utf8'));

assert.match(app, /const GRIDLY_OPERATIONS_CENTER_ENABLED = false;/, 'Operations Center flag must default false');
assert.match(app, /window\.GRIDLY_OPERATIONS_CENTER_ENABLED = GRIDLY_OPERATIONS_CENTER_ENABLED;/, 'Operations Center flag must remain protected on window');
assert.match(app, /function renderGridlyOperationsCenterShell\(target = document\.body\)/, 'read-only shell render helper must exist');
assert.match(app, /if \(!isGridlyOperationsCenterEnabled\(\)\) \{\n    return \{ rendered: false, reason: "GRIDLY_OPERATIONS_CENTER_ENABLED false" \};\n  \}/, 'shell render must be blocked when the flag is false');
assert.match(app, /window\.renderGridlyOperationsCenterShell = renderGridlyOperationsCenterShell;/, 'render helper must be registered');
assert.match(app, /window\.gridlyOperationsIsolationAudit = function gridlyOperationsIsolationAudit\(\)/, 'Operations isolation audit helper must exist');
assert.match(app, /shellRegistered/, 'audit must report shellRegistered');
assert.match(app, /shellRendered/, 'audit must report shellRendered');
assert.match(app, /shellRenderBlockedWhenDisabled/, 'audit must report shellRenderBlockedWhenDisabled');
assert.match(app, /mobileRefreshHookAdded: false/, 'Operations Center must not add mobile refresh hooks');
assert.match(app, /portraitRendererModified: false/, 'Operations Center must not modify portrait renderer');
assert.match(app, /communityPulseOwnershipChanged: false/, 'Community Pulse ownership must remain unchanged');
assert.match(app, /routeWatchOwnershipChanged: false/, 'Route Watch ownership must remain unchanged');
assert.match(app, /refreshPipelineModified: false/, 'Refresh pipeline must remain unchanged');
assert.match(css, /\.gridly-operations-center-shell/, 'isolated Operations Center CSS must exist');

for (const text of [
  'Gridly Operations Center',
  'Know Before You Respond',
  'Liberty County',
  'Community Status',
  'Active Incidents',
  'Community Pulse',
  'Corridor Status',
  'Community Summary',
  'New Reports',
  'Recently Cleared'
]) {
  assert.match(app, new RegExp(text), `shell must include ${text}`);
}

for (const section of [
  'Final determination',
  'Shell scope',
  'Flag gating behavior',
  'Isolation confirmation',
  'What changed',
  'What did not change',
  'Protected-system confirmation',
  'Denise validation steps',
  'Merge recommendation'
]) {
  assert.match(report, new RegExp(`## ${section}`), `report must include ${section}`);
}

assert.equal(evidence.version, 'V742');
assert.equal(evidence.finalDetermination, 'PASS');
assert.equal(evidence.runtimeFlag.default, false);
assert.equal(evidence.shell.registered, true);
assert.equal(evidence.shell.renderedByDefault, false);
assert.equal(evidence.shell.renderBlockedWhenDisabled, true);
assert.deepEqual(evidence.shell.sections, [
  'Community Status',
  'Active Incidents',
  'Community Pulse',
  'Corridor Status',
  'Community Summary',
  'New Reports',
  'Recently Cleared'
]);
assert.equal(evidence.isolationAudit.operationsCenterEnabled, false);
assert.equal(evidence.isolationAudit.shellRegistered, true);
assert.equal(evidence.isolationAudit.shellRendered, false);
assert.equal(evidence.isolationAudit.shellRenderBlockedWhenDisabled, true);
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

console.log('V742 Operations Center read-only shell validation passed');
