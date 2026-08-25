import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('const gridlyLP236AlertsState'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
const sandbox = {
  window: {}, globalThis: {}, document: { querySelector: () => null },
  gridlyAlertWriterRecordId: (row, index) => row.id || `row-${index}`,
  gridlyAlertsPresentationSourceClass: row => row.sourceClass,
  sanitizeText: value => String(value ?? ''),
  gridlyBuildCanonicalLiveIncidentPresentation: row => ({ title: row.title || row.category || 'Condition', locationLabel: row.location || 'Nearby', conditionLabel: row.category || 'Condition' }),
  resolveAlertTitleText: row => row.title || row.category || 'Condition',
  pickFirstNonEmptyText: values => values.find(Boolean) || '',
  gridlyLp0952ResolveCrossingAlertTarget: () => ({ coords: {} }),
  gridlyLp0952AlertCardInteractionAttributes: () => '',
  normalizeGridlyUserFacingRoadText: value => value,
  exposeGridlyAuditHelper: () => {}
};
vm.runInNewContext(`${source}\nthis.buildLP236 = gridlyLP236BuildModel; this.renderLP236 = gridlyLP236RenderAlertsPresentation; this.auditLP236 = gridlyLP236AlertsInformationArchitectureAudit;`, sandbox);
const build = rows => sandbox.buildLP236(rows, { authoritativeMembership: { community: 'Dallas' } });

test('top and section counts use governed active identities rather than presentation cards', () => {
  const model = build(Array.from({ length: 26 }, (_, index) => ({ id: `official-${index}`, sourceClass: 'official_roadway', category: index % 2 ? 'Lane Closure' : 'Road Closure' })));
  assert.equal(model.total, 26);
  assert.equal(model.sections[0].activeConditionCount, 26);
  assert.equal(model.sections[0].groups.reduce((sum, group) => sum + group.rows.length, 0), 26);
});

test('source grouping precedes deterministic condition grouping and preserves semantics', () => {
  const model = build([
    { id: 'o', sourceClass: 'official_roadway', category: 'Lane Closure' },
    { id: 'c', sourceClass: 'community_report', type: 'High Water' },
    { id: 'w', sourceClass: 'weather', event: 'Flash Flood Warning' }
  ]);
  assert.deepEqual(Array.from(model.sections, section => section.sourceClass), ['official_roadway', 'community_report', 'weather']);
  assert.equal(model.sections[0].groups[0].conditionType, 'lane_closures');
  assert.equal(model.sections[1].groups[0].rows[0].canonicalId, 'c');
  assert.equal(model.sections[2].groups[0].rows[0].canonicalId, 'w');
});

test('large inventories remain compact by default while retaining every lineage row', () => {
  for (const count of [1, 5, 26, 50, 100]) {
    const model = build(Array.from({ length: count }, (_, index) => ({ id: `id-${index}`, sourceClass: 'official_roadway', category: `Type ${index % 7}` })));
    assert.equal(model.sections.flatMap(section => section.groups.flatMap(group => group.rows)).length, count);
    assert.equal(new Set(model.sections.flatMap(section => section.groups.flatMap(group => group.rows.map(row => row.canonicalId)))).size, count);
  }
  assert.match(app, /const open = model\.total === 1 \|\| \(model\.total <= 5/);
  assert.doesNotMatch(app.slice(app.indexOf('function gridlyLP236BuildModel'), app.indexOf('function gridlyLP236AlertsInformationArchitectureAudit')), /slice\(0,/);
});

test('critical callouts require weather source and governed severity', () => {
  const model = build([
    { id: 'routine-weather', sourceClass: 'weather', event: 'Rain Advisory' },
    { id: 'severe-weather', sourceClass: 'weather', event: 'Flood Warning', severity: 'severe' },
    { id: 'road', sourceClass: 'official_roadway', category: 'Closure', severity: 'high' }
  ]);
  assert.deepEqual(Array.from(model.critical, row => row.canonicalId), ['severe-weather']);
});

test('markup preserves compact detail, Show me, empty omission, and accessible native disclosure', () => {
  for (const token of ['gridly-lp236-source', 'gridly-lp236-group', 'gridly-lp236-condition-details', 'gridly-alert-show-on-map', 'aria-label=', '<details', '<summary']) assert.match(app, new RegExp(token));
  assert.match(css, /min-height:48px/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.match(app, /filter\(\(section\) => section\.activeConditionCount > 0\)/);
});

test('LP236 is a bounded passive presentation and protected systems remain untouched', () => {
  const lp236 = app.slice(app.indexOf('// LP236 is a presentation projection'), app.indexOf('function escapeV2SettingsText'));
  assert.doesNotMatch(lp236, /fetch\(|setInterval|setTimeout|navigator\.geolocation|turf\.|Dallas|Austin|Katy|Corpus Christi|Abilene|Midland/);
  assert.match(lp236, /gridlyFilterAlertRecordsBySelectedAwarenessArea/);
  assert.match(lp236, /gridlyLp0952ResolveCrossingAlertTarget/);
  for (const field of ['totalActiveConditionCount', 'sections', 'criticalCalloutCount', 'officialRoadwayConditionCount', 'communityReportConditionCount', 'weatherConditionCount', 'displayedConditionIdentityCount', 'unrepresentedConditionIds', 'duplicateDisplayedConditionIds', 'sourceSemanticsPass', 'countSemanticsPass', 'identityCoveragePass', 'showMeActionCount', 'emptySectionsRendered', 'accessibilityPass', 'overallPass']) assert.match(lp236, new RegExp(field));
});

test('production Alerts writer mounts LP236 through the existing single DOM writer', () => {
  const writer = app.slice(app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'), app.indexOf('function invokeMobileAlertsEntry'));
  assert.match(writer, /gridlyLP236RenderAlertsPresentation\(snapshot, alertsForRender\)/);
  assert.equal((writer.match(/openGridlyPortraitV2Sheet\("alerts"/g) || []).length, 1);
  assert.doesNotMatch(writer.slice(writer.indexOf('// LP236 owns the presentation projection')), /renderAlertCard\(alert, index, isHidden\)/);
  assert.match(writer, /title: `\$\{alertsForRender\.length\} active condition/);
});

test('positive, authoritative zero, and unavailable transactions all render through LP236', () => {
  const positive = sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alerts: [] }, [{ id: 'official-1', sourceClass: 'official_roadway', category: 'Lane Closure' }]);
  assert.match(positive, /data-gridly-lp236-alerts="true"/);
  assert.match(positive, /1 active condition/);
  assert.match(positive, /Official Roadways/);

  const quiet = sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alerts: [] }, []);
  assert.match(quiet, /No Active Alerts/);
  assert.match(quiet, /You're all caught up/);

  const unavailable = sandbox.renderLP236({ activeConditionAuthorityAvailable: false, activeConditionAuthorityReason: 'governed authority loading', alerts: [] }, []);
  assert.match(unavailable, /Alerts unavailable/);
  assert.match(unavailable, /Active conditions are still loading/);
  assert.doesNotMatch(unavailable, /all caught up/i);
});

test('audit recognizes mounted positive, zero, and unavailable LP236 states', () => {
  const root = {
    querySelector: () => null,
    querySelectorAll: selector => selector === 'summary' ? [] : []
  };
  sandbox.document.querySelector = selector => selector === '[data-gridly-lp236-alerts]' ? root : null;

  sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alerts: [] }, [{ id: 'official-1', sourceClass: 'official_roadway', category: 'Closure' }]);
  let audit = sandbox.auditLP236();
  assert.equal(audit.authorityState, 'AVAILABLE_NONEMPTY');
  assert.equal(audit.authorityAvailable, true);

  sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alerts: [] }, []);
  root.querySelector = selector => selector === '.gridly-alert-empty-state' ? {} : null;
  audit = sandbox.auditLP236();
  assert.equal(audit.authorityState, 'AVAILABLE_EMPTY');
  assert.equal(audit.authorityAvailable, true);
  assert.equal(audit.quietStateAuthorityPass, true);

  sandbox.renderLP236({ activeConditionAuthorityAvailable: false, activeConditionAuthorityReason: 'governed authority loading', alerts: [] }, []);
  root.querySelector = () => null;
  audit = sandbox.auditLP236();
  assert.equal(audit.authorityState, 'UNAVAILABLE');
  assert.equal(audit.authorityAvailable, false);
  assert.equal(audit.authorityReason, 'governed authority loading');
  assert.equal(audit.available, true);
});

test('legacy quiet and competing Alerts writers are not production reachable', () => {
  const transaction = app.slice(app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'), app.indexOf('function invokeMobileAlertsEntry'));
  assert.doesNotMatch(transaction, /fallbackTemplate|fallback retained|openPortraitV2Sheet\('alerts'\)|No active community alerts/);
  assert.equal((transaction.match(/openGridlyPortraitV2Sheet\("alerts"/g) || []).length, 1);
  const entry = app.slice(app.indexOf('function invokeMobileAlertsEntry'), app.indexOf('const gridlySettingsDockTapTrace'));
  assert.doesNotMatch(entry, /openGridlyPortraitV2Sheet/);
});

test('LP236 audit fails closed with an array when mounted authority is unavailable', () => {
  const audit = sandbox.auditLP236();
  assert.equal(audit.authorityAvailable, false);
  assert.equal(typeof audit.authorityReason, 'string');
  assert.ok(audit.authorityReason.length > 0);
  assert.deepEqual(Array.from(audit.sections), []);
});

test('live hierarchy renderer consumes supplied governed conditions without refetching', () => {
  const renderer = app.slice(app.indexOf('function gridlyLP236RenderAlertsPresentation'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
  for (const token of ['gridly-lp236-group', 'gridly-lp236-condition', 'Show me', 'Details']) assert.match(renderer, new RegExp(token));
  for (const sourceLabel of ['Official Roadways', 'Community Reports', 'Weather']) assert.match(source, new RegExp(sourceLabel));
  assert.match(renderer, /Array\.isArray\(suppliedAlerts\) \? suppliedAlerts/);
  assert.doesNotMatch(renderer, /fetch\(|setTimeout|setInterval|RenderCompleteAlertCard|Dallas/);
});

test('quiet state requires explicit governed authority and official evidence cannot render quiet', () => {
  const official = build([{ id: 'txdot-78', sourceClass: 'official_roadway', category: 'Lane Closure' }]);
  assert.equal(official.total, 1);
  assert.equal(official.sections[0].sourceClass, 'official_roadway');
  const renderer = app.slice(app.indexOf('function gridlyLP236RenderAlertsPresentation'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
  assert.match(renderer, /activeConditionAuthorityAvailable !== true/);
  assert.match(renderer, /Active conditions are still loading/);
  assert.match(renderer, /if \(!model\.total\) return/);
  assert.ok(renderer.indexOf('activeConditionAuthorityAvailable !== true') < renderer.indexOf("You're all caught up"));
});

test('source handoff remains governed and separates all three families without consumer dependencies', () => {
  const model = build([
    { id: 'official', sourceClass: 'official_roadway' },
    { id: 'community', sourceClass: 'community_report' },
    { id: 'weather', sourceClass: 'weather' }
  ]);
  assert.deepEqual(Array.from(model.sections, section => section.sourceClass), ['official_roadway', 'community_report', 'weather']);
  const snapshot = app.slice(app.indexOf('function getAlertsSurfaceSnapshot()'), app.indexOf('window.getAlertsSurfaceSnapshot = getAlertsSurfaceSnapshot'));
  assert.match(snapshot, /governedConsumerProjection\?\.surfaces\?\.alerts/);
  assert.doesNotMatch(snapshot, /querySelector|textContent|fetch\(/);
  assert.doesNotMatch(snapshot, /Dallas|KBYG|Location Context/);
});

test('audit exposes active-condition authority, lineage counts, and quiet-state proof', () => {
  const lp236 = app.slice(app.indexOf('// LP236 is a presentation projection'), app.indexOf('function escapeV2SettingsText'));
  for (const field of ['sourceConditionCount', 'sourceConditionIds', 'officialRoadwayConditionCount', 'communityReportConditionCount', 'weatherConditionCount', 'quietStateRendered', 'quietStateAuthorityPass', 'firstStageWhereActiveConditionsBecomeEmpty']) assert.match(lp236, new RegExp(field));
  assert.match(lp236, /overallPass: Boolean\(root\) && quietStateAuthorityPass/);
});
