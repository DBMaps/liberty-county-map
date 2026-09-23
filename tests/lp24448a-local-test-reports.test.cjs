const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const source = app.slice(app.indexOf('// LP244.48A browser acceptance harness.'));
const html = fs.readFileSync('index.html', 'utf8');

function boot(protocol, hostname, capacitor) {
  const window = { location: { protocol, hostname }, Capacitor: capacitor };
  vm.runInNewContext(source, { window });
  return window;
}

test('helper is available on HTTP loopback only', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    const page = boot('http:', host);
    assert.equal(typeof page.gridlyLocalTestReports?.add, 'function');
    assert.equal(page.gridlyLocalTestReports.status().persistence, 'page memory only');
  }
  for (const [protocol, host] of [['https:', 'gridlygo.com'], ['https:', 'localhost'], ['http:', 'gridlygo.com'], ['capacitor:', 'localhost']]) {
    const page = boot(protocol, host);
    assert.equal(page.gridlyLocalTestReports, undefined);
    assert.equal(page.gridlyApplyLocalTestReports(), undefined);
  }
});

test('native packaging fails closed even with a loopback hostname', () => {
  for (const capacitor of [
    { isNativePlatform: () => true, getPlatform: () => 'android' },
    { isNativePlatform: () => false, getPlatform: () => 'ios' },
    { isNativePlatform: () => { throw Error('unknown'); } }
  ]) {
    const page = boot('http:', 'localhost', capacitor);
    assert.equal(page.gridlyLocalTestReports, undefined);
  }
});

test('local injection is after history capture and before consumer publication', () => {
  const history = app.indexOf('gridlyCaptureHistoryFromReports(visibleNormalized, { source: `loadSharedReports:${reason}` });');
  const local = app.indexOf('window.gridlyApplyLocalTestReports();', history);
  const publish = app.indexOf('refreshReportHazardViews(`loadSharedReports:${reason}`', local);
  assert.ok(history >= 0 && history < local && local < publish);
  const refresh = app.indexOf('function refreshReportHazardViews(source = "unspecified", options = {})');
  assert.ok(refresh >= 0 && app.indexOf('window.gridlyApplyLocalTestReports();', refresh) < app.indexOf('const endRefreshHazardTrace', refresh));
  assert.ok(source.includes('normalizeReports(rows)'));
  assert.ok(app.includes('!String(normalized.id || "").startsWith("gridly-test-lp24448a-")'));
  assert.ok(app.includes('buildHistoricalProjection(gridlyHistoricalProjectionCurrentSources(), { source })'));
  assert.ok(source.includes('refreshReportHazardViews("local-test-reports")'));
  assert.ok(html.includes('js/app.js?v=lp24448-awareness'));
  assert.ok(!html.includes('js/gridlyLocalTestReports.js'));
});

test('fixture action interception is ahead of all production confirm and clear paths', () => {
  const dispatcher = app.indexOf('async function handleUnifiedIncidentAction(button)');
  const local = app.indexOf('window.gridlyHandleLocalTestReportAction({ action, category, crossingId, incident, communityLifecycleTarget })', dispatcher);
  const confirm = app.indexOf('await createSharedReport(crossing, mapUnifiedRailConfirmType', dispatcher);
  const clear = app.indexOf('await window.clearHazard(', dispatcher);
  assert.ok(dispatcher >= 0 && dispatcher < local && local < confirm && local < clear);
  assert.ok(!source.includes('gridlySubmitCommunityOperation('));
  assert.ok(!source.includes('supabaseClient.from('));
  assert.ok(!source.includes('localStorage.'));
  assert.ok(!source.includes('sessionStorage.'));
});

test('add, confirm, clear, and clear-all preserve existing report objects without storage or backend access', () => {
  const liveHazard = { id: 'real-road-report', reportKind: 'hazard' };
  const liveCrossing = { id: 'real-crossing-report', reportKind: 'crossing' };
  let normalizations = 0;
  let renders = 0;
  let county = 'liberty-tx';
  const capturedRows = [];
  const context = {
    window: { location: { protocol: 'http:', hostname: 'localhost' } },
    activeHazards: [liveHazard], activeReports: [liveCrossing],
    map: { getCenter: () => ({ lat: 30.0466, lng: -94.8852 }) },
    gridlyGetActiveCountyId: () => county,
    gridlyResolveCountyIdForCoordinate: () => ({ countyId: 'liberty-tx' }),
    HAZARD_TYPES: { flooding: { detail: 'Flooding may affect travel.', severity: 'high' } },
    normalizeReports: (rows) => { normalizations += 1; capturedRows.push(...rows); return rows.map((row) => ({ id: row.id, reportKind: 'hazard', type: row.report_type })); },
    gridlyLp0534cInvalidateCurrentStateModels: () => {},
    refreshReportHazardViews: () => { renders += 1; }
  };
  vm.runInNewContext(source, context);
  const api = context.window.gridlyLocalTestReports;
  const fixture = api.add('flooded-roadway');
  assert.match(fixture.id, /^gridly-test-lp24448a-/);
  assert.equal(capturedRows[0].device_id, null);
  assert.equal(Object.hasOwn(capturedRows[0], 'submission_token'), false);
  assert.equal(context.activeHazards[0], liveHazard);
  assert.equal(context.activeReports[0], liveCrossing);
  assert.equal(context.activeHazards.length, 2);
  county = 'harris-tx';
  context.window.gridlyApplyLocalTestReports();
  assert.deepEqual(context.activeHazards, [liveHazard]);
  county = 'liberty-tx';
  context.window.gridlyApplyLocalTestReports();
  assert.equal(context.activeHazards.length, 2);
  assert.equal(api.confirm(fixture.id).reportCount, 2);
  assert.equal(context.activeHazards.length, 3);
  assert.equal(api.clearOne(fixture.id).state, 'cleared');
  assert.deepEqual(context.activeHazards, [liveHazard]);
  assert.equal(api.clear().removed, 1);
  assert.deepEqual(context.activeHazards, [liveHazard]);
  assert.deepEqual(context.activeReports, [liveCrossing]);
  assert.ok(normalizations >= 4 && renders >= 4);
});
