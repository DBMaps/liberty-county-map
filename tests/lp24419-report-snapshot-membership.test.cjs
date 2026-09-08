const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');

function productionRuntime() {
  const start = app.indexOf('// LP244.19 REPORT SNAPSHOT MEMBERSHIP START');
  const end = app.indexOf('// LP244.19 REPORT SNAPSHOT MEMBERSHIP END');
  assert.notEqual(start, -1, 'LP244.19 production block exists');
  assert.notEqual(end, -1, 'LP244.19 production block has a bounded end');
  const context = {
    Object, Set, Number,
    GRIDLY_COUNTY_REGISTRY: { 'liberty-tx': { fips: '48291' } },
    getIncidentLifecycleState: (report) => report.lifecycleState || 'active',
    gridlyReportMatchesActiveCounty: (report) => report.countyScopeMatch !== false
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}; this.buildSnapshot = gridlyBuildLoadedReportSnapshot; this.audit = gridlyReportSnapshotMembershipAudit;`, context);
  return context;
}

function report(id, extra = {}) {
  return {
    id,
    reportKind: 'crossing',
    type: 'rail_blocked',
    lat: 30.05,
    lng: -94.89,
    severity: 'medium',
    countyId: 'liberty-tx',
    countyFips: '48291',
    countyName: 'Liberty County',
    communityName: 'Dayton',
    communityKey: 'dayton-tx',
    placeGeoid: '4819360',
    submittedAt: '2026-09-07T12:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    deviceId: 'private-device',
    internalSecret: 'must-not-leak',
    ...extra
  };
}

function rawFor(item) {
  return {
    id: item.id,
    created_at: item.submittedAt,
    device_id: item.deviceId,
    crossing_id: item.crossingId,
    crossing_name: item.crossingName,
    report_type: item.type,
    expires_at: item.expiresAt,
    private_payload: 'must-not-leak'
  };
}

function args(normalized, { sourceVisible = normalized, active = normalized.filter((item) => item.reportKind !== 'hazard') } = {}) {
  return {
    normalized,
    rawRows: normalized.map(rawFor),
    sourceVisibleNormalized: sourceVisible,
    activeReports: active,
    activeHazardIds: new Set(normalized.filter((item) => item.reportKind === 'hazard' && item.lifecycleState !== 'cleared').map((item) => String(item.id || ''))),
    lifecycleFilterNow: Date.parse('2026-09-07T12:30:00.000Z'),
    activeCountyId: 'liberty-tx'
  };
}

function legacySnapshot(input) {
  const { normalized, rawRows, sourceVisibleNormalized, activeReports, activeHazardIds } = input;
  return Object.freeze(normalized.map((item, index) => {
    const raw = rawRows[index] || {};
    const lifecycleState = item.lifecycleState || 'active';
    const hasCoordinates = Number.isFinite(item.lat) && Number.isFinite(item.lng);
    const countyScopeMatch = item.countyScopeMatch !== false;
    const sourceAllowed = sourceVisibleNormalized.includes(item);
    const genericHazard = item.reportKind === 'hazard';
    const activeLifecycle = lifecycleState === 'active';
    const activeCollection = genericHazard ? activeHazardIds.has(String(item.id || '')) : activeReports.includes(item);
    const surfaceEligible = sourceAllowed && countyScopeMatch && activeLifecycle && hasCoordinates && activeCollection;
    return Object.freeze({
      id: raw.id ?? item.id ?? null,
      created_at: raw.created_at ?? item.submittedAt ?? null,
      device_id: raw.device_id ?? item.deviceId ?? null,
      crossing_id: raw.crossing_id ?? item.crossingId ?? null,
      crossing_name: raw.crossing_name ?? item.crossingName ?? null,
      report_type: raw.report_type ?? item.type ?? null,
      lat: Number.isFinite(item.lat) ? item.lat : null,
      lng: Number.isFinite(item.lng) ? item.lng : null,
      severity: item.severity || null,
      expires_at: raw.expires_at ?? item.expiresAt ?? null,
      countyId: item.countyId || null,
      countyFips: item.countyFips || (item.countyId === 'liberty-tx' ? '48291' : null),
      countyName: item.countyName || null,
      communityName: item.communityName || null,
      communityKey: item.communityKey || null,
      placeGeoid: item.placeGeoid || null,
      lifecycleState,
      mapEligible: surfaceEligible,
      alertsEligible: surfaceEligible,
      awarenessEligible: surfaceEligible,
      predicates: Object.freeze({ sourceAllowed, countyScopeMatch, genericHazard, activeLifecycle, hasCoordinates, activeCollection })
    });
  }));
}

function comparable(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertParity(runtime, input) {
  const expected = legacySnapshot(input);
  const actual = runtime.buildSnapshot(input);
  assert.deepEqual(comparable(actual), comparable(expected));
  return actual;
}

test('empty and single-report snapshots retain exact predicate output', () => {
  const runtime = productionRuntime();
  assert.deepEqual(comparable(assertParity(runtime, args([]))), []);
  const single = report('single');
  const snapshot = assertParity(runtime, args([single]));
  assert.deepEqual(comparable(snapshot[0].predicates), { sourceAllowed: true, countyScopeMatch: true, genericHazard: false, activeLifecycle: true, hasCoordinates: true, activeCollection: true });
});

test('mixed active/inactive, hazard/non-hazard, and source visibility retain parity', () => {
  const runtime = productionRuntime();
  const activeCrossing = report('crossing-active');
  const inactiveCrossing = report('crossing-inactive', { lifecycleState: 'cleared' });
  const activeHazard = report('hazard-active', { reportKind: 'hazard', type: 'flooding' });
  const hiddenHazard = report('hazard-hidden', { reportKind: 'hazard', type: 'other_hazard' });
  const normalized = [activeCrossing, inactiveCrossing, activeHazard, hiddenHazard];
  const snapshot = assertParity(runtime, args(normalized, { sourceVisible: [activeCrossing, inactiveCrossing, activeHazard], active: [activeCrossing, inactiveCrossing] }));
  assert.deepEqual(snapshot.map((row) => [row.predicates.genericHazard, row.predicates.sourceAllowed, row.predicates.activeLifecycle, row.mapEligible]), [
    [false, true, true, true], [false, true, false, false], [true, true, true, true], [true, false, true, false]
  ]);
});

test('duplicate IDs on distinct objects preserve strict object-identity membership', () => {
  const runtime = productionRuntime();
  const included = report('duplicate-id');
  const excluded = report('duplicate-id');
  const snapshot = assertParity(runtime, args([included, excluded], { sourceVisible: [included], active: [included] }));
  assert.equal(snapshot[0].predicates.sourceAllowed && snapshot[0].predicates.activeCollection, true);
  assert.equal(snapshot[1].predicates.sourceAllowed || snapshot[1].predicates.activeCollection, false);
});

test('ordering, sanitization, nested freezing, and outer freezing remain unchanged', () => {
  const runtime = productionRuntime();
  const normalized = [report('first'), report('second'), report('third')];
  const snapshot = assertParity(runtime, args(normalized));
  assert.deepEqual(snapshot.map((row) => row.id), ['first', 'second', 'third']);
  assert.equal('internalSecret' in snapshot[0], false);
  assert.equal('private_payload' in snapshot[0], false);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot[0]), true);
  assert.equal(Object.isFrozen(snapshot[0].predicates), true);
});

test('public getter continues returning a new frozen deep-enough row copy', () => {
  const getterStart = app.indexOf('function gridlyGetLoadedReportSnapshot()');
  const getterEnd = app.indexOf('\nwindow.gridlyGetLoadedReportSnapshot', getterStart);
  assert.ok(getterStart > 0 && getterEnd > getterStart);
  const originalRow = Object.freeze({ id: 'copy', predicates: Object.freeze({ sourceAllowed: true }) });
  const context = { Object, gridlyLoadedReportSnapshot: Object.freeze([originalRow]) };
  vm.createContext(context);
  vm.runInContext(`${app.slice(getterStart, getterEnd)}; this.getSnapshot = gridlyGetLoadedReportSnapshot;`, context);
  const copy = context.getSnapshot();
  assert.notEqual(copy, context.gridlyLoadedReportSnapshot);
  assert.notEqual(copy[0], originalRow);
  assert.equal(Object.isFrozen(copy), true);
  assert.equal(Object.isFrozen(copy[0]), true);
  assert.deepEqual(comparable(copy), comparable(context.gridlyLoadedReportSnapshot));
});

for (const size of [300, 1000, 5000]) {
  test(`${size}-row fixture retains output parity with linear membership lookup counts`, () => {
    const runtime = productionRuntime();
    const normalized = Array.from({ length: size }, (_, index) => report(`report-${index}`));
    const snapshot = assertParity(runtime, args(normalized));
    assert.equal(snapshot.length, size);
    const audit = runtime.audit();
    assert.equal(audit.lastSnapshotRowCount, size);
    assert.equal(audit.sourceVisibleSetBuildCount, 1);
    assert.equal(audit.activeSetBuildCount, 1);
    assert.equal(audit.sourceVisibleLookupCount, size);
    assert.equal(audit.activeLookupCount, size);
    assert.equal(audit.linearMembershipFallbackCount, 0);
    assert.equal(audit.snapshotParityPass, true);
    assert.equal(audit.constantTimeMembershipPass, true);
    assert.equal(audit.overallPass, true);
  });
}

test('production source proves one-time Set construction and no linear fallback in the snapshot loop', () => {
  const start = app.indexOf('// LP244.19 REPORT SNAPSHOT MEMBERSHIP START');
  const end = app.indexOf('// LP244.19 REPORT SNAPSHOT MEMBERSHIP END');
  const block = app.slice(start, end);
  assert.match(block, /new Set\(sourceVisibleNormalized\)/);
  assert.match(block, /new Set\(activeReports\)/);
  assert.match(block, /sourceVisibleSet\.has\(report\)/);
  assert.match(block, /activeReportSet\.has\(report\)/);
  assert.doesNotMatch(block, /sourceVisibleNormalized\.includes\(report\)/);
  assert.doesNotMatch(block, /activeReports\.includes\(report\)/);
  for (const field of ['available', 'snapshotBuildCount', 'lastSnapshotRowCount', 'sourceVisibleSetBuildCount', 'activeSetBuildCount', 'sourceVisibleLookupCount', 'activeLookupCount', 'linearMembershipFallbackCount', 'snapshotParityPass', 'constantTimeMembershipPass', 'overallPass']) {
    assert.match(block, new RegExp(`\\b${field}\\b`), field);
  }
});

test('runtime audit is frozen, read-only, and does not rebuild the snapshot', () => {
  const runtime = productionRuntime();
  runtime.buildSnapshot(args([report('audit-row')]));
  const before = runtime.audit();
  const after = runtime.audit();
  assert.equal(Object.isFrozen(before), true);
  assert.deepEqual(comparable(after), comparable(before));
  assert.equal(after.snapshotBuildCount, 1);
  assert.equal(after.lastSnapshotRowCount, 1);
});

test('LP244.12 completeness, active+clear lifecycle, multi-county governance, and Route Watch contracts remain intact', () => {
  const loaderStart = app.indexOf('async function loadSharedReports(');
  const loader = app.slice(loaderStart, app.indexOf('\nfunction normalizeReports(', loaderStart));
  assert.match(loader, /gridlyFetchCompleteReportPages[\s\S]*queryFamily: "active"/);
  assert.match(loader, /gridlyFetchCompleteReportPages[\s\S]*queryFamily: "clear"/);
  assert.match(loader, /rawRowsByKey\.set\(key, row\)/);
  assert.match(loader, /gridlyReportMatchesActiveCounty/);
  assert.match(loader, /routeWatchSourceHazards = gridlyFilterRoadHazardsByLatestLifecycle\(routeSourceHazards/);
  assert.match(app, /selectedArea\?\.canonicalMultiCountyPlace === true/);
  assert.match(app, /lifecycle_report_id/);
});
