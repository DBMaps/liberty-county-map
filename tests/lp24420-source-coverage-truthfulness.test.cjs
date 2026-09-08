const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const app = fs.readFileSync('js/app.js', 'utf8');
const weatherPolicy = fs.readFileSync('js/gridlyLP240WeatherAuthorityAudit.js', 'utf8');
const condition = require('../js/gridlyConditionDisplayLabel.js');
const cut = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const families = ['official_roadway', 'community_report', 'weather'];

function harness() {
  const context = {
    window: {}, console, Date, Object, JSON, Array, Map, Set,
    document: { querySelector: () => null },
    gridlyActiveCountyTransitionGeneration: 1, LIVE_REFRESH_MS: 15000,
    area: { canonicalKey: 'place-a', countyId: 'county-a' },
    gridlyReportReadPresentationState: { state: 'not_started' },
    road: { sourceStatus: 'SOURCE_UNAVAILABLE' }, roadRuntime: {}, weather: {},
    gridlyAlertWriterRecordId: (row, index) => row.id || `row-${index}`,
    gridlyAlertsPresentationSourceClass: row => row.sourceClass,
    sanitizeText: value => String(value ?? ''),
    gridlyBuildCanonicalLiveIncidentPresentation: row => ({ title: row.title || 'Condition', locationLabel: 'Nearby' }),
    resolveAlertTitleText: row => row.title || 'Condition',
    pickFirstNonEmptyText: values => values.find(Boolean) || '',
    gridlyLp0952ResolveCrossingAlertTarget: () => ({ coords: {} }),
    gridlyLp0952AlertCardInteractionAttributes: () => '',
    normalizeGridlyUserFacingRoadText: value => value,
    gridlyConditionDisplayLabel: condition.gridlyConditionDisplayLabel,
    exposeGridlyAuditHelper() {},
    gridlyWeatherTravelerTiming: () => '', gridlyWeatherDetailParts: () => []
  };
  context.getGridlySelectedAwarenessArea = () => context.area;
  context.gridlyGetActiveCountyId = () => context.area.countyId;
  context.gridlyStoryTransportationSourceStatusEnvelope = () => context.road;
  context.window.gridlyDriveTexasConnectorRuntimeAudit = () => context.roadRuntime;
  vm.createContext(context);
  vm.runInContext(weatherPolicy, context);
  context.window.gridlyGetWeatherRuntimeAuthorityEnvelope = () => context.weather;
  vm.runInContext(cut('// LP244.20: project existing', 'function gridlyGetGovernedConsumerProjection'), context);
  vm.runInContext(cut('const gridlyLP236AlertsState', '\n  function buildAlertsSurfaceHtml'), context);
  vm.runInContext(cut('  function gridlyLP226ConsumerSnapshot', '  function gridlyLP226CommitSnapshot'), context);
  const set = (family, state) => {
    if (family === 'official_roadway') {
      context.road = { sourceStatus: state === 'quiet' || state === 'active' ? 'HEALTHY_EMPTY' : state === 'stale' ? 'SOURCE_FAILED_WITH_RETAINED_DATA' : 'SOURCE_UNAVAILABLE', quietEligible: true, areaOwnershipMatches: true };
      context.roadRuntime = { lastFetchSucceeded: state === 'quiet' || state === 'active', requestInFlight: state === 'loading', lastSuccessfulAt: new Date().toISOString(), refreshIntervalMs: 180000 };
    } else if (family === 'community_report') {
      context.gridlyReportReadPresentationState = { owner: context.gridlySourceCoverageOwner(), revision: 1, completedAt: Date.now(),
        state: state === 'quiet' || state === 'active' ? 'succeeded' : state === 'loading' ? 'loading' : state === 'unavailable' ? 'not_started' : 'failed',
        lastSuccessfulAt: state === 'stale' ? 100 : null };
    } else {
      context.weather = { configured: true, requestAttempted: state !== 'unavailable',
        requestSucceeded: state === 'quiet' || state === 'active', healthy: state === 'quiet' || state === 'active',
        freshEnoughForAuthority: state === 'quiet' || state === 'active', canonicalGeographyResolved: true,
        geographyAgreementPass: true, freshness: state === 'stale' ? 'STALE' : 'UNKNOWN', requestInFlight: state === 'loading', currentApplicableCount: 0 };
    }
  };
  const render = (rows = [], snapshot = {}) => context.gridlyLP236RenderAlertsPresentation({ activeConditionAuthorityAvailable: true, ...snapshot }, rows);
  const model = (rows = [], snapshot = {}) => context.gridlyLP236BuildModel(rows, { activeConditionAuthorityAvailable: true, ...snapshot });
  return { context, set, render, model };
}
const row = (family, id) => ({ id, sourceClass: family, category: 'Road Closure', latitude: 30, longitude: -95 });
const section = (html, family) => html.match(new RegExp('<(?:div|details)[^>]*data-gridly-lp236-source="' + family + '"[\\s\\S]*?(?=<details class="gridly-lp236-source"|<div class="gridly-lp236-source-status |$)'))?.[0] || '';

for (const family of families) {
  test(`${family}: completed empty is visibly and accessibly zero`, () => {
    const h = harness(); h.set(family, 'quiet');
    const html = section(h.render(), family);
    assert.match(html, /aria-label="0 active conditions">0<\/b>/);
    assert.match(html, /data-gridly-lp236-authority-state="QUIET"/);
  });
  test(`${family}: current counts preserve identities, singular/plural and Show me`, () => {
    const h = harness(); h.set(family, 'active');
    for (const count of [1, 3]) {
      const rows = Array.from({ length: count }, (_, i) => row(family, `id-${i}`));
      const html = section(h.render(rows), family);
      assert.ok(html.includes(`aria-label="${count} active condition${count === 1 ? '' : 's'}"`));
      assert.equal((html.match(/data-gridly-show-on-map="true"/g) || []).length, count);
      assert.equal(h.model(rows).sections.find(s => s.sourceClass === family).activeConditionCount, count);
    }
  });
  for (const state of ['unavailable', 'failed', 'loading', 'stale']) {
    test(`${family}: ${state} never becomes visible or accessible zero`, () => {
      const h = harness(); h.set(family, state);
      const html = section(h.render(), family);
      assert.doesNotMatch(html, /0 active|>0<|No active/);
      assert.match(html, state === 'loading' ? /Checking conditions/ : state === 'stale' ? /Information is stale; not a current condition count/ : /Information unavailable; conditions have not been checked/);
    });
  }
  test(`${family}: stale nonzero is excluded from current count and current rows`, () => {
    const h = harness(); h.set(family, 'stale');
    const rows = [row(family, 'retained')];
    assert.equal(h.model(rows).total, 1, 'canonical membership remains intact');
    assert.equal(h.model(rows).currentTotal, 0);
    const html = h.render(rows);
    assert.match(section(html, family), /Information is stale/);
    assert.doesNotMatch(section(html, family), /1 active condition|data-gridly-show-on-map/);
    assert.match(html, /<header[^>]*><strong aria-label="Coverage incomplete">/);
  });
}

test('one failed family preserves both successful families and qualifies the header', () => {
  for (const failed of families) {
    const h = harness(); const rows = [];
    for (const family of families) { h.set(family, family === failed ? 'failed' : 'active'); if (family !== failed) rows.push(row(family, family)); }
    assert.equal(h.model(rows).currentTotal, 2);
    assert.match(h.render(rows), /2 current conditions · Coverage incomplete/);
    assert.match(section(h.render(rows), failed), /Information unavailable/);
  }
});

test('active, quiet and unavailable produce truthful distinct source rows and header', () => {
  const h = harness(); h.set('official_roadway', 'active'); h.set('community_report', 'quiet');
  const html = h.render([row('official_roadway', 'road')]);
  assert.match(html, /1 current condition · Coverage incomplete/);
  assert.match(section(html, 'community_report'), /0 active conditions/);
  assert.doesNotMatch(section(html, 'weather'), /0 active conditions/);
});

test('complete quiet coverage alone permits a zero header', () => {
  const h = harness(); families.forEach(f => h.set(f, 'quiet'));
  assert.match(h.render(), /<header[^>]*><strong aria-label="0 active conditions">0 active conditions/);
});

test('late report success and failure cannot overwrite another area or newer request', () => {
  const h = harness(); h.set('community_report', 'loading');
  const old = h.context.gridlyReportReadPresentationState;
  h.context.area = { canonicalKey: 'place-b', countyId: 'county-b' };
  h.context.gridlyActiveCountyTransitionGeneration++;
  h.set('community_report', 'quiet');
  for (const state of ['succeeded', 'failed']) assert.equal(h.context.gridlyCommitReportReadCoverage(old, state), false);
  assert.equal(h.context.gridlyCurrentReportReadState(), 'succeeded');
  const current = h.context.gridlyReportReadPresentationState;
  h.context.gridlyReportReadPresentationState = { ...current, revision: 2, state: 'loading' };
  assert.equal(h.context.gridlyCommitReportReadCoverage(current, 'succeeded'), false);
  assert.equal(h.context.gridlyCurrentReportReadState(), 'loading');
});

test('area transition withdraws old quiet and active snapshot coverage', () => {
  const h = harness(); families.forEach(f => h.set(f, 'quiet'));
  const snapshot = { sourceCoverageOwner: h.context.gridlySourceCoverageOwner() };
  h.context.area = { canonicalKey: 'place-b', countyId: 'county-a' };
  const html = h.render([row('official_roadway', 'old')], snapshot);
  assert.doesNotMatch(html, /0 active conditions|1 active condition|No active/);
  assert.match(html, /Checking conditions/);
  assert.equal(h.context.gridlyCurrentReportReadState(), 'not_started');
});

test('existing refresh completion resolves loading to quiet, failure stays isolated', () => {
  const h = harness(); h.set('official_roadway', 'active'); h.set('community_report', 'loading');
  assert.equal(h.context.gridlyCommitReportReadCoverage(h.context.gridlyReportReadPresentationState, 'succeeded'), true);
  assert.match(section(h.render(), 'community_report'), /0 active conditions/);
  h.set('community_report', 'loading');
  h.context.gridlyCommitReportReadCoverage(h.context.gridlyReportReadPresentationState, 'failed');
  const rows = [row('official_roadway', 'road')];
  assert.match(section(h.render(rows), 'official_roadway'), /1 active condition/);
  assert.doesNotMatch(section(h.render(rows), 'community_report'), /0 active conditions/);
});

test('cached snapshot health refreshes without mutating membership or cached authority', () => {
  const h = harness(); h.set('community_report', 'quiet');
  const cached = { alerts: [], presentationAlerts: [], normalizedAlertItems: [], alertsFamilyAuthority: h.context.gridlyReadAlertsFamilyAuthority() };
  h.set('community_report', 'loading');
  const copy = h.context.gridlyLP226ConsumerSnapshot(cached);
  assert.equal(copy.alertsFamilyAuthority.community_report.state, 'LOADING');
  assert.equal(cached.alertsFamilyAuthority.community_report.checked, true);
  assert.equal(cached.alertsFamilyAuthority.community_report.state, null, 'a completed report read does not predeclare the selected-area count');
  assert.notEqual(copy.alerts, cached.alerts);
});

test('unknown geography and incomplete roadway projection cannot certify quiet', () => {
  const h = harness(); h.set('official_roadway', 'quiet');
  for (const patch of [{ areaOwnershipMatches: false }, { sourceStatus: 'PROJECTION_DEFECT' }, { quietEligible: false }]) {
    const saved = h.context.road; h.context.road = { ...saved, ...patch };
    assert.doesNotMatch(section(h.render(), 'official_roadway'), /0 active conditions/);
    h.context.road = saved;
  }
});

test('report loading starts only after suppression guards; completion precedes shared publication', () => {
  const loader = cut('async function loadSharedReports', '\nif (typeof window !== "undefined")');
  assert.ok(loader.indexOf('gridlyReportReadPresentationState = reportReadRequest') > loader.indexOf('if (audit.inFlight && audit.inFlightPromise)'));
  assert.ok(loader.indexOf('gridlyCommitReportReadCoverage(reportReadRequest, "succeeded")') < loader.indexOf('const publishBaseReportTruth'));
  assert.match(loader, /if \(recentRoadClearedError\)/);
  assert.match(loader, /lp0534cLoaderGenerationAtStart < gridlyLp0534cClearConvergenceGeneration/);
});

test('protected hierarchy stays compact and unknown copy contains no internal vocabulary', () => {
  const h = harness(); const html = h.render();
  const consumerText = html.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(consumerText, /governed|authority|UNAVAILABLE|LOADING|QUIET/);
  assert.equal((html.match(/gridly-lp236-source-status /g) || []).length, 3);
  assert.equal((html.match(/<b aria-hidden="true">—<\/b>/g) || []).length, 3);
  const css = fs.readFileSync('css/styles.css', 'utf8');
  assert.match(css, /\.gridly-lp236-source-status > span \{[^}]*min-width:0/);
  assert.doesNotMatch(html, /<button[^>]*>Retry/);
});

test('elapsed existing refresh windows withdraw prior roadway and community quiet proof', () => {
  const h = harness(); families.forEach(f => h.set(f, 'quiet'));
  const before = h.context.gridlySourceCoverageRevision();
  h.context.roadRuntime.lastSuccessfulAt = new Date(Date.now() - 180001).toISOString();
  h.context.gridlyReportReadPresentationState.completedAt = Date.now() - 15001;
  assert.notEqual(h.context.gridlySourceCoverageRevision(), before);
  const html = h.render();
  for (const f of ['official_roadway', 'community_report']) {
    assert.match(section(html, f), /Information is stale/);
    assert.doesNotMatch(section(html, f), /0 active conditions/);
  }
});

test('authority-positive missing rows never certify a completed empty evaluation', () => {
  const h = harness(); h.set('official_roadway', 'active');
  h.context.road.sourceStatus = 'HEALTHY_WITH_DATA';
  assert.doesNotMatch(section(h.render(), 'official_roadway'), /0 active conditions/);
  assert.equal(h.model().sections[0].authorityState, 'UNAVAILABLE');
});

test('health-only revisions invalidate an in-flight presentation even when row counts match', () => {
  const h = harness(); h.set('community_report', 'quiet');
  vm.runInContext(cut('function gridlyGetAlertsAuthoritativeRevisionKey()', 'function gridlyLp0457MarkupHasBreakArtifacts'), h.context);
  const before = h.context.gridlyGetAlertsAuthoritativeRevisionKey();
  h.set('community_report', 'loading');
  assert.notEqual(h.context.gridlyGetAlertsAuthoritativeRevisionKey(), before);
  assert.match(app, /revisionKey === gridlyGetAlertsAuthoritativeRevisionKey\(\)/);
  assert.equal(h.context.window.activeReports, undefined, 'no record mutation was needed');
});

test('KBYG cannot claim quiet when the same family is loading, stale or unavailable', () => {
  const h = harness();
  h.context.gridlyStoryTransportationImpact = () => false;
  h.context.gridlyStoryWeatherMeaningfulImpact = () => false;
  h.context.gridlyGetAwarenessEvidenceCompleteness = () => ({ canStateNoActiveWeatherAlerts: true });
  vm.runInContext(cut('function gridlyKbygRoadwayAuthorityState', 'function gridlyTravelBriefDriveTexasLines'), h.context);
  for (const state of ['loading', 'stale', 'unavailable']) {
    h.set('official_roadway', state); h.set('weather', state);
    assert.equal(h.context.gridlyKbygRoadwayAuthorityState([], { healthyEmpty: true }), 'UNAVAILABLE');
    assert.equal(h.context.gridlyKbygWeatherAuthorityState(null), 'UNAVAILABLE');
  }
  h.set('official_roadway', 'quiet'); h.set('weather', 'quiet');
  assert.equal(h.context.gridlyKbygRoadwayAuthorityState([], { healthyEmpty: true }), 'QUIET');
  assert.equal(h.context.gridlyKbygWeatherAuthorityState(null), 'QUIET');
});

test('DriveTexas exposes actual pending, success and failed retry health without extra requests', async () => {
  const pending = [];
  const context = { console, Date, Promise, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    GRIDLY_CONFIG: { driveTexas: { apiKey: 'fixture' } },
    getGridlySelectedAwarenessArea: () => ({ label: 'Fixture', countyId: 'county-a', lat: 30, lng: -95, radiusMiles: 5 }),
    getDistanceMiles: () => 0,
    fetch: () => new Promise(resolve => pending.push(resolve))
  };
  context.globalThis = context; vm.createContext(context);
  for (const file of ['js/gridlyDriveTexasProvider.js', 'js/gridlyDriveTexasLiveConnector.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
  const connector = context.gridlyDriveTexasConnector;
  const audit = context.gridlyDriveTexasConnectorRuntimeAudit;
  const first = connector.fetchNow();
  assert.equal(audit().requestInFlight, true);
  connector.fetchNow();
  assert.equal(pending.length, 1, 'existing in-flight deduplication is preserved');
  pending.shift()({ ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features: [] }) });
  await first;
  assert.equal(audit().requestInFlight, false);
  assert.equal(audit().lastFetchSucceeded, true);
  const retry = connector.fetchNow();
  assert.equal(audit().requestInFlight, true);
  pending.shift()({ ok: false, status: 400, json: async () => ({}) });
  await retry;
  assert.equal(audit().requestInFlight, false);
  assert.equal(audit().lastFetchSucceeded, false);
  assert.ok(audit().lastSuccessfulAt, 'failed refresh does not erase previous-success evidence');
});

test('renderer failure falls back to unavailable without re-reading a failing health accessor', () => {
  const h = harness(); families.forEach(f => h.set(f, 'quiet'));
  h.context.console = { warn() {} };
  h.context.gridlyStoryTransportationSourceStatusEnvelope = () => { throw Error('fixture health failure'); };
  const html = h.context.window.gridlyLP236RenderAlertsPresentation({ activeConditionAuthorityAvailable: true }, []);
  assert.doesNotMatch(html, /0 active conditions|No active/);
  assert.equal((html.match(/data-gridly-lp236-authority-state="UNAVAILABLE"/g) || []).length, 3);
});
