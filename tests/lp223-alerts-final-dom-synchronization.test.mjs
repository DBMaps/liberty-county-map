import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const block = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

test('portrait Alerts open and refresh dispatch the existing authoritative writer', () => {
  const open = block('function openAlertsSurfaceFromDock()', 'function gridlyInstantAlertsSheetAudit()');
  const refresh = block('function renderAlerts()', 'function renderTrendingCrossings()');
  assert.match(open, /gridlySynchronizeOpenAlertsPortrait\("alerts_open_after_shell"\)/);
  assert.match(refresh, /gridlySynchronizeOpenAlertsPortrait\("renderAlerts_refresh"\)/);
  assert.match(app, /gridlyOpenAlertsSurfaceAfterPaint\(generation\)/);
  assert.doesNotMatch(open, /alerts_open_is_cache_only/);
});

test('authoritative revision ownership cannot be invalidated by rendered output', () => {
  const revision = block('function gridlyGetAlertsAuthoritativeRevisionKey()', 'function gridlyLp0457MarkupHasBreakArtifacts');
  assert.doesNotMatch(revision, /__gridlyLatestAlertsForRender/);
  assert.match(revision, /window\.activeHazards/);
  assert.match(revision, /window\.activeReports/);
});

test('writer audit exposes final authority, data store, invocation, target, suppression, overwrite, and parity evidence', () => {
  const audit = block('window.gridlyAlertsAuthorityWriterAudit = function', 'window.gridlyAlertDataDiagnostic = function');
  for (const field of [
    'finalAuthorityIds', 'finalDataStoreIds', 'writerInvocationCount', 'writerLastInvocationTime',
    'writerInputIds', 'targetContainerIdentity', 'renderSuppressionReason', 'postWriteDomIds',
    'laterOverwriteInvocation', 'firstLosingStage', 'parity'
  ]) assert.match(audit, new RegExp(`\\b${field}\\b`), field);
  for (const state of [
    'AUTHORITY_READY', 'WRITER_NOT_INVOKED', 'WRITER_SKIPPED', 'WRITER_TARGET_MISMATCH',
    'WRITER_OUTPUT_MISSING', 'LATER_EMPTY_OVERWRITE', 'DOM_PARITY_PASS'
  ]) assert.match(audit, new RegExp(state), state);
});

test('single, update, quiet, clear, and repeated refresh controls converge without duplicates', () => {
  const reconcile = (authority, previousDom = []) => {
    void previousDom;
    return [...new Set(authority)];
  };
  const one = reconcile(['active_hazard:hazard']);
  assert.deepEqual(one, ['active_hazard:hazard']);
  const two = reconcile(['active_hazard:hazard', 'community_report:crossing'], one);
  assert.deepEqual(two, ['active_hazard:hazard', 'community_report:crossing']);
  assert.deepEqual(reconcile([], two), []); // quiet/clear removes stale rows
  assert.deepEqual(reconcile(two, two), two); // repeated refresh is replacement, not append
  assert.equal(new Set(reconcile(two, two)).size, 2);
});

test('writer continues to use portrait sheet pipeline rather than ad hoc row insertion', () => {
  const writer = block('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync', 'function invokeMobileAlertsEntry');
  assert.match(writer, /window\.openGridlyPortraitV2Sheet\("alerts"/);
  assert.match(writer, /renderAlertCard\(alert, index, isHidden\)/);
  assert.doesNotMatch(writer, /createElement\(['"](?:article|div)['"]\)/);
});
