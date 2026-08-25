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
vm.runInNewContext(`${source}\nthis.buildLP236 = gridlyLP236BuildModel; this.renderLP236 = gridlyLP236RenderAlertsPresentation; this.auditLP236 = gridlyLP236AlertsInformationArchitectureAudit; this.bindLP236 = gridlyLP236BindDisclosureState; this.captureLP236 = gridlyLP236CaptureDisclosureState; this.locationClueLP236 = gridlyLP236LocationClue;`, sandbox);
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
  assert.match(app, /gridlyLP236AlertsState\.disclosure\.initialized[\s\S]*groupIndex === 0/);
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

test('LP236.9 uses only source, type, and repeated-roadway disclosures', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'one', sourceClass: 'official_roadway', category: 'Lane Closure', routeName: 'SH0078', latitude: 32.8, longitude: -96.8 }]);
  assert.match(rendered, /gridly-lp236-source/);
  assert.match(rendered, /gridly-lp236-group/);
  assert.match(rendered, /SH0078[\s\S]*Lane Closure[\s\S]*Show me/);
  assert.doesNotMatch(rendered, /View details|gridly-lp236-condition-details/);
  assert.doesNotMatch(app.slice(app.indexOf('function gridlyLP236BuildModel'), app.indexOf('function gridlyLP236AlertsInformationArchitectureAudit')), /filter\(\(section\) => section\.activeConditionCount > 0\)/);
});

test('LP236.10 isolated condition copy preserves full governed DOM text', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'bridge', sourceClass: 'official_roadway', category: 'Bridge Restriction', routeName: 'I-30', description: '- The roadway is closed due to construction.', freshnessLabel: 'now', latitude: 32.8, longitude: -96.8 }]);
  assert.match(rendered, /gridly-lp236-condition-title">Bridge Restriction<\/span>/);
  assert.match(rendered, /gridly-lp236-condition-summary"[^>]*>The roadway is closed due to construction\.<\/span>/);
  assert.doesNotMatch(rendered, />- The roadway/);
  assert.match(rendered, /gridly-lp236-condition-time">now<\/span>/);
});

test('LP236.11 excludes condition copy from the legacy fixed-size alert icon rule', () => {
  const legacyIconRule = css.match(/body\[data-layout-mode="portrait"\][^{]+> div:first-child:not\(\.gridly-lp236-condition-body\) \{[^}]+\}/)?.[0] || '';
  assert.match(legacyIconRule, /width: 24px !important;/);
  assert.match(legacyIconRule, /min-width: 24px !important;/);
  assert.doesNotMatch(css, /\[data-gridly-alert-row="true"\] > div:first-child\s*\{[^}]*width:\s*24px/);
});

test('LP236.11 condition geometry stays usable at 320/360/390/430px', () => {
  const isolatedCss = css.slice(css.indexOf('/* LP236.11 condition isolation'), css.indexOf('.gridly-lp236-critical'));
  assert.match(css, /\.gridly-lp236-alerts \{[^}]*grid-template-columns:minmax\(0, 1fr\); width:100%; min-width:0; max-width:100%/);
  assert.match(css, /\.gridly-lp236-groups \{[^}]*grid-template-columns:minmax\(0, 1fr\); width:100%; min-width:0; box-sizing:border-box/);
  assert.match(css, /\.gridly-lp236-roadway-group \{[^}]*width:100%; min-width:0; max-width:100%; box-sizing:border-box/);
  assert.match(css, /\.gridly-lp236-roadway-rows \{[^}]*width:100%; min-width:0; box-sizing:border-box/);
  assert.match(isolatedCss, /\.gridly-lp236-condition-item \{[^}]*position:static; display:block; float:none; width:100%; min-width:0; max-width:none; box-sizing:border-box;[^}]*overflow:visible; contain:none; transform:none/);
  assert.match(isolatedCss, /\.gridly-lp236-condition-body \{[^}]*width:100%; min-width:0; max-width:none; box-sizing:border-box; overflow:visible/);
  assert.doesNotMatch(isolatedCss, /\.gridly-lp236-condition-body\s*\{[^}]*(?:width|min-width|inline-size):\s*24px/);
  assert.match(isolatedCss, /\.gridly-lp236-condition-body > :is\(strong, span\) \{[^}]*display:block;[^}]*width:auto; min-width:0; max-width:none/);
  assert.match(isolatedCss, /text-overflow:clip; white-space:normal; overflow-wrap:break-word; word-break:normal/);
  assert.doesNotMatch(isolatedCss, /position:absolute|max-width:(?!none)|min-content|(?:^|[;{]\s*)overflow:(?:hidden|clip)|text-overflow:ellipsis|word-break:break-all|overflow-wrap:anywhere|flex-shrink/);
  // Deterministic box-model fixture: nested insets are 16 + 10 + 16px and the
  // action is a following block, so it consumes none of the copy inline-size.
  for (const viewportWidth of [320, 360, 390, 430]) {
    const conditionElementWidth = viewportWidth - 42;
    const summaryElementWidth = conditionElementWidth - 16;
    assert.ok(conditionElementWidth >= 278);
    assert.ok(summaryElementWidth >= 262);
  }
});

test('LP236.10 mobile rows are vertical with a non-competing action line', () => {
  assert.match(css, /\.gridly-lp236-condition-actions \{[^}]*position:static; display:flex; width:100%; min-width:0; box-sizing:border-box; justify-content:flex-end/);
  assert.match(css, /\.gridly-lp236-show-me \{[^}]*min-height:44px/);
  assert.match(app, /gridly-lp236-condition-body[\s\S]*gridly-lp236-condition-actions/);
  assert.doesNotMatch(app.slice(app.indexOf('const renderRow'), app.indexOf('const renderGroup')), /View details|<details|gridly-lp236-row-main|gridly-lp236-row-copy/);
});

test('LP236.9 uses the trusted roadway formatter without truncating route identity', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, ['SH0078', 'IH0030', 'US0175'].map((routeName, index) => ({ id: `r${index}`, sourceClass: 'official_roadway', category: 'Lane Closure', routeName })));
  for (const route of ['SH0078', 'IH0030', 'US0175']) assert.match(rendered, new RegExp(route));
  assert.match(source, /normalizeGridlyUserFacingRoadText\(governedRoad\)/);
});

test('LP236.9 extracts one bounded provider sentence and omits repeated provenance', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'detail', sourceClass: 'official_roadway', category: 'Road Closure', routeName: 'SH0078', description: 'Long governed location detail' }]);
  assert.match(rendered, /Long governed location detail\./);
  assert.doesNotMatch(rendered, /View details/);
  assert.equal((rendered.match(/Official source · DriveTexas/g) || []).length, 1);
});

test('LP236.7 condition types conditionally group only repeated governed roadways', () => {
  const model = build([
    { id: 'i30-a', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30', crossStreet: 'Buckner Blvd' },
    { id: 'i30-b', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30', crossStreet: 'I-45' },
    { id: 'us175', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'US 175' },
    { id: 'i30-road', sourceClass: 'official_roadway', category: 'Road Closure', roadName: 'I-30' }
  ]);
  const lanes = model.sections[0].groups.find(group => group.conditionType === 'lane_closures');
  const roads = model.sections[0].groups.find(group => group.conditionType === 'road_closures');
  assert.equal(lanes.roadwayGroups.length, 1);
  assert.equal(lanes.roadwayGroups[0].roadway, 'I-30');
  assert.deepEqual(Array.from(lanes.roadwayGroups[0].rows, row => row.canonicalId), ['i30-a', 'i30-b']);
  assert.deepEqual(Array.from(lanes.directRows, row => row.canonicalId), ['us175']);
  assert.equal(roads.roadwayGroups.length, 0);
  assert.deepEqual(Array.from(roads.directRows, row => row.canonicalId), ['i30-road']);
});

test('LP236.7 weather stays direct and every identity is represented once', () => {
  const model = build([
    { id: 'w1', sourceClass: 'weather', event: 'Flood Warning', roadName: 'I-30' },
    { id: 'w2', sourceClass: 'weather', event: 'Flood Warning', roadName: 'I-30' }
  ]);
  const group = model.sections.find(section => section.sourceClass === 'weather').groups[0];
  assert.equal(group.roadwayGroups.length, 0);
  assert.deepEqual(Array.from(group.directRows, row => row.canonicalId), ['w1', 'w2']);
});

test('LP236.9 readable summaries use trusted clues, concise governed condition, freshness, and Show me', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [
    { id: 'a', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30', crossStreet: 'Buckner Blvd', conciseSummary: 'Right lane closed', freshnessLabel: 'Updated recently', description: 'Main lanes are open.<br>Second<script>bad()</script>', lat: 32.8, lng: -96.8 },
    { id: 'b', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30', crossStreet: 'Bl', lat: 32.81, lng: -96.81 }
  ]);
  assert.match(rendered, /near Buckner Blvd[\s\S]*Right lane closed[\s\S]*Updated recently[\s\S]*Show me/);
  assert.match(rendered, /Main lanes are open\./);
  assert.doesNotMatch(rendered, /near Bl|<br>|<script>|bad\(\)|View details/i);
  assert.match(rendered, /data-gridly-alert-lat="32.8" data-gridly-alert-lng="-96.8"/);
});

test('LP236.9 singleton roadway presents roadway and trusted clue without another disclosure', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'single', sourceClass: 'official_roadway', category: 'Bridge Restriction', roadName: 'SL 12', referenceRoadA: 'Loop 12', lat: 32.8, lng: -96.8 }]);
  assert.match(rendered, /<strong class="gridly-lp236-condition-roadway">SL 12<\/strong>[\s\S]*near Loop 12[\s\S]*Bridge Restriction[\s\S]*Show me/);
  assert.doesNotMatch(rendered, /gridly-lp236-roadway-group/);
});

test('sheet and content expose one primary count without repeating Alerts', () => {
  const transaction = app.slice(app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'), app.indexOf('function invokeMobileAlertsEntry'));
  assert.match(transaction, /authorityAvailable \? "Alerts"/);
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'one', sourceClass: 'official_roadway' }]);
  assert.match(rendered, /<header class="gridly-lp236-header"><strong aria-label="1 active condition">1 active condition<\/strong>/);
  assert.doesNotMatch(rendered, /<strong>Alerts<\/strong>/);
});

test('mobile Alerts entry owns one transaction and passive audit does not span prior opens', () => {
  const binding = app.slice(app.indexOf('function bindBottomDockRealButtons'), app.indexOf('function setMobileUiMode'));
  const tacticalBinding = app.slice(app.indexOf('document.getElementById("mobileDockAlertsBtn")?.addEventListener'), app.indexOf('document.getElementById("mobileHeaderSettingsBtn")'));
  assert.match(binding, /isTacticalLandscapeDockMode\(\) \? undefined : invokeMobileAlertsEntry\('bottom_dock_runtime_bind', event\)/);
  assert.doesNotMatch(tacticalBinding, /invokeMobileAlertsEntry|openAlertsSurfaceFromDock/);
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

test('LP236.4 restores the renderer scope and asynchronous entry return contracts', () => {
  const transaction = app.slice(app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'), app.indexOf('const gridlySettingsDockTapTrace'));
  const dock = app.slice(app.indexOf('function openAlertsSurfaceFromDock'), app.indexOf('function gridlyInstantAlertsSheetAudit'));
  const entry = app.slice(app.indexOf('function invokeMobileAlertsEntry'), app.indexOf('const gridlySettingsDockTapTrace'));
  assert.match(app, /window\.gridlyLP236RenderAlertsPresentation = \(snapshot, suppliedAlerts = null\) =>/);
  assert.match(transaction, /window\.gridlyLP236RenderAlertsPresentation\(authoritySnapshot, alerts\)/);
  assert.match(dock, /return shellResult/);
  assert.match(entry, /return entryResult\.then\(\(opened\) =>/);
  assert.match(entry, /return opened/);
});

test('LP236.4 open audit covers all authority states and exactly one writer', () => {
  const audit = app.slice(app.indexOf('const gridlyLP236AlertsOpenAuditState'), app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'));
  const transaction = app.slice(app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync'), app.indexOf('function invokeMobileAlertsEntry'));
  for (const state of ['AVAILABLE_NONEMPTY', 'AVAILABLE_EMPTY', 'UNAVAILABLE']) assert.match(transaction, new RegExp(state));
  for (const field of ['entryInvoked', 'openInvoked', 'mountInvoked', 'writerInvoked', 'writerInvocationCount', 'writerResult', 'openReturnValue', 'entryReturnValue', 'authorityState', 'exception', 'overallPass']) assert.match(audit, new RegExp(field));
  assert.equal((transaction.match(/window\.openGridlyPortraitV2Sheet\("alerts"/g) || []).length, 1);
  assert.doesNotMatch(transaction, /openPortraitV2Sheet\('alerts'\)|No active community alerts|No active alerts right now/);
});

test('LP236.4 renderer failure fails closed without provider, polling, or town logic', () => {
  const bridge = app.slice(app.indexOf('window.gridlyLP236RenderAlertsPresentation ='), app.indexOf('\n\n  function buildAlertsSurfaceHtml'));
  assert.match(bridge, /catch \(error\)/);
  assert.match(bridge, /activeConditionAuthorityAvailable: false/);
  assert.doesNotMatch(bridge, /fetch\(|setTimeout|setInterval|Dallas|Dayton|Katy/);
});

test('positive, authoritative zero, and unavailable transactions all render through LP236', () => {
  const positive = sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alerts: [] }, [{ id: 'official-1', sourceClass: 'official_roadway', category: 'Lane Closure' }]);
  assert.match(positive, /data-gridly-lp236-alerts="true"/);
  assert.match(positive, /1 active condition/);
  assert.match(positive, /Official Roadways/);

  const familyQuiet = { official_roadway: { checked: true, available: true }, community_report: { checked: true, available: true }, weather: { checked: true, available: true } };
  const quiet = sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alertsFamilyAuthority: familyQuiet, alerts: [] }, []);
  assert.match(quiet, /No active official roadway conditions/);
  assert.match(quiet, /No active community reports/);
  assert.match(quiet, /No active weather alerts/);

  const unavailable = sandbox.renderLP236({ activeConditionAuthorityAvailable: false, activeConditionAuthorityReason: 'governed authority loading', alerts: [] }, []);
  assert.match(unavailable, /Official roadway information unavailable/);
  assert.match(unavailable, /Community report information unavailable/);
  assert.match(unavailable, /Weather information unavailable/);
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
  assert.deepEqual(Array.from(audit.sections, section => section.sourceClass), ['official_roadway', 'community_report', 'weather']);
});

test('live hierarchy consumes supplied governed conditions without refetch or nested detail', () => {
  const renderer = app.slice(app.indexOf('function gridlyLP236RenderAlertsPresentation'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
  for (const token of ['gridly-lp236-group', 'gridly-lp236-condition', 'Show me']) assert.match(renderer, new RegExp(token));
  assert.doesNotMatch(renderer, /View details|fetch\(|setTimeout|setInterval|Dallas/);
});

test('quiet state requires explicit governed authority and official evidence cannot render quiet', () => {
  const official = build([{ id: 'txdot-78', sourceClass: 'official_roadway', category: 'Lane Closure' }]);
  assert.equal(official.total, 1);
  assert.equal(official.sections[0].sourceClass, 'official_roadway');
  const renderer = app.slice(app.indexOf('function gridlyLP236RenderAlertsPresentation'), app.indexOf('\n  function buildAlertsSurfaceHtml'));
  assert.match(renderer, /source\.authorityState !== "ACTIVE"/);
  assert.match(renderer, /Weather information unavailable/);
  assert.doesNotMatch(renderer, /if \(!model\.total\) return|You're all caught up/);
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

test('LP236.12 supplies governed community and weather records before source partitioning', () => {
  const governed = fs.readFileSync(new URL('../js/governed-awareness.js', import.meta.url), 'utf8');
  const handoff = app.slice(app.indexOf('function gridlyGetGovernedConsumerProjection'), app.indexOf('function gridlyGetGovernedActiveAwarenessRows'));
  assert.match(handoff, /gridlySelectConsumerVisibleWeatherSituations/);
  assert.match(handoff, /sourceKind: "weather_provider"/);
  assert.match(governed, /const WEATHER_POLICY = Object\.freeze\([^;]*alerts: true/);
  for (const subtype of ['rail_crossing_issue', 'disabled_vehicle', 'flooded_road', 'closed_road']) assert.match(governed, new RegExp(`${subtype}:[^\\n]+alerts: true`));
  assert.doesNotMatch(handoff, /Dallas|Austin|Corpus Christi|San Antonio|fetch\(|setInterval|setTimeout/);
});

test('LP236.12 audit reports exact per-family and Show me coverage', () => {
  const lp236 = app.slice(app.indexOf('// LP236 is a presentation projection'), app.indexOf('function escapeV2SettingsText'));
  for (const field of ['governedAlertsInputCount', 'officialRoadwayInputCount', 'communityReportInputCount', 'weatherInputCount', 'officialRoadwayRenderedCount', 'communityReportRenderedCount', 'weatherRenderedCount', 'missingOfficialRoadwayIds', 'missingCommunityReportIds', 'missingWeatherIds', 'showMeEligibleConditionCount', 'showMeRenderedActionCount', 'showMeMissingConditionIds', 'sourceCoveragePass', 'showMeCoveragePass', 'identityCoveragePass', 'overallPass']) assert.match(lp236, new RegExp(field));
});

test('LP236.12 Show me uses governed nested coordinates and preserves the sheet', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [
    { id: 'nested', sourceClass: 'community_report', category: 'High Water', raw: { latitude: 32.8, longitude: -96.8 } },
    { id: 'area', sourceClass: 'weather', event: 'Flood Warning' }
  ]);
  assert.match(rendered, /data-gridly-alert-lat="32.8" data-gridly-alert-lng="-96.8"[\s\S]*Show me/);
  assert.equal((rendered.match(/>Show me<\/button>/g) || []).length, 1);
  const clickBinding = app.slice(app.indexOf('const bindAlertsPanelClick'), app.indexOf('const normalizeToken'));
  assert.match(clickBinding, /preserveSurface: true/);
  assert.match(app, /focus\?\.preserveSurface !== true/);
});


test('LP236.9 real DriveTexas field contract is narrow and proven', () => {
  const provider = fs.readFileSync(new URL('../js/gridlyDriveTexasProvider.js', import.meta.url), 'utf8');
  for (const field of ['id', 'providerId', 'category', 'title', 'description', 'routeName', 'latitude', 'longitude', 'startTime', 'endTime', 'sourceTrace']) assert.match(provider, new RegExp(`\\b${field}\\b`));
  const roadway = source.slice(source.indexOf('function gridlyLP236Roadway'), source.indexOf('function gridlyLP236UsefulStructuredClue'));
  assert.match(roadway, /roadName, alert\?\.routeName, alert\?\.primaryRoad/);
  assert.doesNotMatch(roadway, /raw\?|source\?|corridor|roadwayName/);
});

test('LP236.9 location clues reject invalid short values, omit missing values, and accept structured clues', () => {
  assert.equal(sandbox.locationClueLP236({ crossStreet: 'Bl' }, 'I-30'), '');
  assert.equal(sandbox.locationClueLP236({}, 'I-30'), '');
  assert.equal(sandbox.locationClueLP236({ crossStreet: 'Buckner Blvd' }, 'I-30'), 'Buckner Blvd');
  assert.equal(sandbox.locationClueLP236({ referenceRoadA: 'I-45', direction: 'East' }, 'I-30'), 'East of I-45');
});

test('LP236.9 concise summary strips raw markup and bounds long governed copy', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'x', sourceClass: 'official_roadway', routeName: 'SL0012', conciseSummary: '<b>Bridge restriction</b><br>' + 'x'.repeat(120) }]);
  assert.match(rendered, /Bridge restriction/);
  assert.doesNotMatch(rendered, /<b>|<br>|x{100}/);
});

test('LP236.9 disclosures are user-owned and never close siblings', () => {
  let handler;
  const stateRoot = { dataset: {}, matches: () => true, addEventListener: (name, fn, capture) => { assert.equal(name, 'toggle'); assert.equal(capture, true); handler = fn; } };
  assert.equal(sandbox.bindLP236(stateRoot), true);
  assert.equal(sandbox.bindLP236(stateRoot), false);
  const typeA = { open: true, dataset: { gridlyDisclosureKey: 'official_roadway:lane_closures' }, matches: q => q === '.gridly-lp236-group' };
  const typeB = { open: true, dataset: { gridlyDisclosureKey: 'official_roadway:road_closures' }, matches: typeA.matches };
  handler({ target: typeA });
  handler({ target: typeB });
  assert.equal(typeA.open, true);
  assert.equal(typeB.open, true);
  typeA.open = false;
  handler({ target: typeA });
  assert.equal(typeA.open, false);
  assert.equal(typeB.open, true);
});

test('LP236.9 stable disclosure keys survive ordinary rerenders', () => {
  const rows = [
    { id: 'a', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30' },
    { id: 'b', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30' },
    { id: 'c', sourceClass: 'official_roadway', category: 'Road Closure', roadName: 'US 75' }
  ];
  const nodes = (keys) => keys.map(gridlyDisclosureKey => ({ dataset: { gridlyDisclosureKey } }));
  const root = { matches: () => true, querySelectorAll: selector => selector.includes('source') ? nodes(['official_roadway']) : selector.includes('roadway-group') ? nodes(['official_roadway:lane_closures:i-30']) : nodes(['official_roadway:lane_closures', 'official_roadway:road_closures']) };
  assert.equal(sandbox.captureLP236(root), true);
  const rerendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, rows);
  assert.match(rerendered, /data-gridly-disclosure-key="official_roadway"[^>]* open/);
  assert.match(rerendered, /data-gridly-disclosure-key="official_roadway:lane_closures"[^>]* open/);
  assert.match(rerendered, /data-gridly-disclosure-key="official_roadway:road_closures"[^>]* open/);
  assert.match(rerendered, /data-gridly-disclosure-key="official_roadway:lane_closures:i-30"[^>]* open/);
  assert.doesNotMatch(source, /gridlyLP236BindAccordions|sibling\.open\s*=\s*false|DOM index|card position/);
});

test('LP236.9 Show me remains a button and cannot toggle disclosure ancestors', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'map', sourceClass: 'official_roadway', category: 'Road Closure', routeName: 'US0175', latitude: 32.8, longitude: -96.8 }]);
  assert.match(rendered, /<button class="gridly-alert-show-on-map gridly-lp236-show-me"[^>]*>Show me<\/button>/);
  assert.doesNotMatch(rendered, /<summary[^>]*>Show me/);
});

test('LP236.9 audit exposes the full passive identity and accordion contract', () => {
  for (const field of ['totalActiveConditionCount','roadwayGroupCount','directConditionCount','representedConditionIdentityCount','unrepresentedConditionIds','duplicateRepresentedConditionIds','locationClueCoverageCount','invalidLocationClueCount','rawMarkupLeakCount','showMeActionCount','openSourceKeys','openConditionTypeKeys','openRoadwayGroupKeys','userDisclosureStatePreserved','autoCollapseDetected','disclosurePersistencePass','summarySentenceCoverageCount','identityCoveragePass','sourceSemanticsPass','overallPass']) assert.match(source, new RegExp(field));
  assert.doesNotMatch(source, /fetch\(|setInterval|setTimeout|navigator\.geolocation|Dallas/);
});

test('LP236.13 always models three independently certified source families in deterministic order', () => {
  const authority = {
    official_roadway: { checked: true, available: true, reason: 'official checked' },
    community_report: { checked: true, available: true, reason: 'community checked' },
    weather: { checked: true, available: false, reason: 'weather unavailable' }
  };
  const model = sandbox.buildLP236([{ id: 'o', sourceClass: 'official_roadway' }], { activeConditionAuthorityAvailable: true, alertsFamilyAuthority: authority });
  assert.deepEqual(Array.from(model.sections, row => row.sourceClass), ['official_roadway', 'community_report', 'weather']);
  assert.deepEqual(Array.from(model.sections, row => row.authorityState), ['ACTIVE', 'QUIET', 'UNAVAILABLE']);
  assert.equal(model.total, 1);
});

test('LP236.13 quiet and unavailable families are restrained status rows, not empty disclosures', () => {
  const authority = {
    official_roadway: { checked: true, available: true, reason: 'checked' },
    community_report: { checked: true, available: true, reason: 'checked' },
    weather: { checked: true, available: false, reason: 'selector unavailable' }
  };
  const html = sandbox.renderLP236({ activeConditionAuthorityAvailable: true, alertsFamilyAuthority: authority }, [{ id: 'o', sourceClass: 'official_roadway' }]);
  assert.match(html, /data-gridly-lp236-source="official_roadway"[^>]*data-gridly-lp236-authority-state="ACTIVE"/);
  assert.match(html, /data-gridly-lp236-source="community_report"[^>]*data-gridly-lp236-authority-state="QUIET"[\s\S]*No active community reports/);
  assert.match(html, /data-gridly-lp236-source="weather"[^>]*data-gridly-lp236-authority-state="UNAVAILABLE"[\s\S]*Weather information unavailable/);
  assert.doesNotMatch(html, /<details[^>]+data-gridly-lp236-source="community_report"|<details[^>]+data-gridly-lp236-source="weather"/);
  assert.match(html, /1 active condition/);
});

test('LP236.13 authority certification preserves governed community and weather geography', () => {
  const handoff = app.slice(app.indexOf('function gridlyGetGovernedConsumerProjection'), app.indexOf('function gridlyGetGovernedActiveAwarenessRows'));
  assert.match(handoff, /gridlySelectConsumerVisibleWeatherSituations\(\{ selectedAwarenessArea: selectedArea \}\)/);
  assert.match(handoff, /governed active community report and hazard lifecycle evaluated for canonical community/);
  assert.match(handoff, /point,[\s\S]*polygon,[\s\S]*zone,[\s\S]*forecast zone,[\s\S]*county warning/);
  assert.doesNotMatch(handoff, /countyUnion|county union|Dallas|Austin|Corpus Christi|San Antonio/);
});

test('LP236.13 Show me markup exactly satisfies the established delegated handler contract', () => {
  const handler = app.slice(app.indexOf('function gridlyLp019BindAlertFocusHandlers'), app.indexOf('if (typeof window !== "undefined")', app.indexOf('function gridlyLp019BindAlertFocusHandlers')));
  const renderer = app.slice(app.indexOf('function gridlyLP236RenderAlertsPresentation'), app.indexOf('function buildAlertsSurfaceHtml'));
  assert.match(renderer, /class="gridly-alert-show-on-map gridly-lp236-show-me" data-gridly-show-on-map="true"/);
  assert.match(handler, /closest\?\.\("\[data-gridly-show-on-map='true'\]"\)/);
  assert.match(renderer, /data-gridly-alert-id=/);
  assert.match(renderer, /data-gridly-alert-lat=/);
  assert.match(renderer, /data-gridly-alert-lng=/);
  assert.match(handler, /focusGridlyAlertIncident\(/);
  assert.equal((handler.match(/panel\.addEventListener\("click"/g) || []).length, 1);
});

test('LP236.13 behavior audit is NOT_TESTED until a click and cannot pass from coverage alone', () => {
  for (const token of ['showMeBehaviorPass = behavior.tested ?', 'showMeLastClickConditionId', 'showMeLastTargetResolved', 'showMeLastTargetType', 'showMeLastMapFocusInvoked', 'showMeLastMapFocusResult', 'firstLosingStage']) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /!behavior\.tested \? "NOT_TESTED"/);
  assert.doesNotMatch(source, /showMeBehaviorPass\s*=\s*showMeCoveragePass/);
});

test('LP236.13 Show me preserves the sheet and disclosure state and does not fabricate targets', () => {
  const handler = app.slice(app.indexOf('function gridlyLp019BindAlertFocusHandlers'), app.indexOf('if (typeof window !== "undefined")', app.indexOf('function gridlyLp019BindAlertFocusHandlers')));
  assert.match(app, /preserveZoom = focus\?\.source === "alerts_show_on_map"/);
  assert.match(handler, /source: showOnMapAction \? "alerts_show_on_map"/);
  const withoutCoordinates = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'x', sourceClass: 'official_roadway' }]);
  assert.doesNotMatch(withoutCoordinates, />Show me<\/button>/);
  assert.doesNotMatch(source, /sibling\.open\s*=\s*false/);
});

test('LP236.13 has no refetch, polling, town branch, search, or crossing production change', () => {
  const lp236 = app.slice(app.indexOf('// LP236 is a presentation projection'), app.indexOf('function escapeV2SettingsText'));
  assert.doesNotMatch(lp236, /fetch\(|setInterval|setTimeout|Dallas|Austin|Corpus Christi|San Antonio/);
  assert.match(lp236, /gridlyLp0952ResolveCrossingAlertTarget/);
  const changedProduction = `${lp236}\n${app.slice(app.indexOf('function gridlyGetGovernedConsumerProjection'), app.indexOf('function gridlyGetGovernedActiveAwarenessRows'))}`;
  assert.doesNotMatch(changedProduction, /geocode|countyUnion|searchResults/);
});
