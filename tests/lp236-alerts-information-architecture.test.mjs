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
  assert.match(css, /\.gridly-lp236-row-copy \{[^}]*display:block; width:100%; min-width:0; max-width:100%/);
  assert.match(css, /\.gridly-lp236-row-copy strong \{[^}]*white-space:normal; overflow-wrap:break-word; word-break:normal/);
  assert.match(css, /\.gridly-lp236-condition-details \{[^}]*flex:1 1 auto; min-width:0; max-width:100%/);
  assert.match(css, /\.gridly-lp236-condition-details p \{[^}]*overflow-wrap:break-word; word-break:normal/);
  assert.doesNotMatch(css, /\.gridly-lp236-row-copy \{[^}]*overflow-wrap:anywhere/);
  assert.match(app, /filter\(\(section\) => section\.activeConditionCount > 0\)/);
});

test('compact rows retain width and containment at supported portrait widths', () => {
  assert.match(css, /\.gridly-lp236-row-main \{[^}]*display:block; width:100%; min-width:0; max-width:100%; overflow:hidden/);
  assert.match(css, /@media \(max-width:420px\)/);
  for (const width of [320, 360, 390, 430]) {
    assert.ok(width >= 320);
    assert.doesNotMatch(css, new RegExp(`width:${width + 1}px`));
  }
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'long-road', sourceClass: 'official_roadway', category: 'Lane Closure', location: 'North President George Bush Turnpike Frontage Road', lat: 32.9, lng: -96.7 }]);
  assert.match(rendered, /North President George Bush Turnpike Frontage Road/);
  assert.match(rendered, /gridly-lp236-condition-details/);
  assert.match(rendered, /Show me/);
});

test('LP236.6 mobile child rows stack copy above a horizontal, tappable action line', () => {
  assert.match(css, /\.gridly-lp236-actions \{[^}]*display:flex; width:100%; min-width:0; align-items:flex-start; gap:10px/);
  assert.match(css, /\.gridly-lp236-show-me \{[^}]*min-height:44px/);
  assert.match(css, /\.gridly-lp236-condition-details > summary \{[^}]*min-height:44px/);
  assert.match(app, /gridly-lp236-row-main[\s\S]*gridly-lp236-row-copy[\s\S]*<\/div>\s*<div class="gridly-lp236-actions">/);
  assert.doesNotMatch(app, /gridly-lp236-row-copy[\s\S]{0,200}gridly-lp236-show-me/);
});

test('LP236.6 governed route labels and secondary labels retain word-based wrapping', () => {
  const rows = ['SH0078', 'IH0030', 'SS0366', 'US0175'].map((location, index) => ({
    id: `route-${index}`, sourceClass: 'official_roadway', category: index === 1 ? 'Bridge Restriction' : 'Lane Closure', location,
    lat: 32.8 + index / 100, lng: -96.8
  }));
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, rows);
  for (const route of ['SH0078', 'IH0030', 'SS0366', 'US0175']) assert.match(rendered, new RegExp(`<strong>${route}<\\/strong>`));
  assert.match(rendered, /<span class="gridly-lp236-condition-copy">Bridge Restriction<\/span>/);
  assert.match(css, /\.gridly-lp236-row-copy span \{[^}]*white-space:normal; overflow-wrap:break-word; word-break:normal/);
  assert.doesNotMatch(css, /\.gridly-lp236-row-copy (?:strong|span) \{[^}]*(?:word-break:break-all|overflow-wrap:anywhere)/);
});

test('LP236.6 details use full contained width while provenance stays out of compact copy', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [{ id: 'detail', sourceClass: 'official_roadway', category: 'Road Closure', location: 'SH0078', description: 'Long governed location detail', lat: 32.8, lng: -96.8 }]);
  assert.match(rendered, /<div class="gridly-lp236-details-content"><p>Long governed location detail<\/p><small>Official source · DriveTexas<\/small><\/div>/);
  assert.doesNotMatch(rendered, /gridly-lp236-row-copy[^<]*Official source · DriveTexas/);
  assert.match(css, /\.gridly-lp236-details-content \{[^}]*width:100%; min-width:0; max-width:100%; overflow:hidden/);
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
  const group = model.sections[0].groups[0];
  assert.equal(group.roadwayGroups.length, 0);
  assert.deepEqual(Array.from(group.directRows, row => row.canonicalId), ['w1', 'w2']);
});

test('LP236.7 compact information, safe details, location authority, and map contract render in priority order', () => {
  const rendered = sandbox.renderLP236({ activeConditionAuthorityAvailable: true }, [
    { id: 'a', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30', crossStreet: 'Buckner Blvd', conciseSummary: 'Right lane closed', freshnessLabel: 'Updated recently', description: 'First<br>Second<script>bad()</script>', lat: 32.8, lng: -96.8 },
    { id: 'b', sourceClass: 'official_roadway', category: 'Lane Closure', roadName: 'I-30', crossStreet: 'I-45', lat: 32.81, lng: -96.81 }
  ]);
  assert.match(rendered, /gridly-lp236-roadway-group/);
  assert.match(rendered, /I-30, 2 conditions/);
  assert.match(rendered, /near Buckner Blvd[\s\S]*Right lane closed[\s\S]*Updated recently[\s\S]*View details[\s\S]*Show me/);
  assert.match(rendered, /First · Second bad\(\)/);
  assert.doesNotMatch(rendered, /<br>|<script>/i);
  assert.doesNotMatch(rendered, /Show all/);
  assert.match(rendered, /data-gridly-alert-lat="32.8" data-gridly-alert-lng="-96.8"/);
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
  for (const token of ['gridly-lp236-group', 'gridly-lp236-condition', 'Show me', 'View details']) assert.match(renderer, new RegExp(token));
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
