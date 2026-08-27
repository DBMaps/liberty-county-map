import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const popupSource = source.slice(source.indexOf('function buildUnifiedIncidentPopup('), source.indexOf('function gridlyHazardPopupAudit('));

function readFunction(name) {
  const functionStart = source.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `${name} exists`);
  const start = source.slice(Math.max(0, functionStart - 6), functionStart) === 'async '
    ? functionStart - 6
    : functionStart;
  const bodyStart = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not read ${name}`);
}

const context = vm.createContext({});
vm.runInContext(`
  function getIncidentLifecycleState(record) {
    const state = String(record.lifecycleState || record.lifecycle || record.status || record.state || '').toLowerCase();
    if (['cleared', 'recently_cleared', 'stale', 'inactive'].includes(state) || record.expired) return state || 'inactive';
    return state === 'active' || record.report_type === 'road_closed' ? 'active' : 'inactive';
  }
  ${readFunction('gridlyCommunityPopupActionsEligible')}
`, context);
const eligible = vm.runInContext('gridlyCommunityPopupActionsEligible', context);

const roadClosed = { id: 'report-sulphur-springs-1', report_type: 'road_closed', lat: 33.138, lng: -95.601, sourceKind: 'community_report' };

test('generated active community road incident is action eligible without a projected status field', () => {
  assert.equal(eligible(roadClosed), true);
  assert.match(popupSource, /gridlyCommunityPopupActionsEligible\(incident\)[\s\S]*>Confirm Still Active<\/button>/);
  assert.match(popupSource, /gridlyCommunityPopupActionsEligible\(incident\)[\s\S]*>Mark Cleared<\/button>/);
});

test('action identity remains bound to the rendered canonical incident', () => {
  assert.match(source, /data-unified-action="confirm" data-incident-id="\$\{sanitizeText\(incident\.id\)\}"/);
  assert.match(source, /data-unified-action="cleared" data-incident-id="\$\{sanitizeText\(incident\.id\)\}"/);
  assert.equal(eligible({ ...roadClosed, id: '' }), false);
  assert.match(source, /if \(unifiedButton\.dataset\.gridlyActionPending === "1"\) return;[\s\S]{0,160}await handleUnifiedIncidentAction\(unifiedButton\)/);
});

test('weather and Official Roadways never receive community actions', () => {
  assert.equal(eligible({ ...roadClosed, sourceKind: 'weather_provider', providerId: 'nws' }), false);
  assert.equal(eligible({ ...roadClosed, sourceKind: 'official_roadway', providerId: 'DriveTexas' }), false);
});

test('cleared, stale, and coordinate-ineligible conditions do not expose active actions', () => {
  assert.equal(eligible({ ...roadClosed, status: 'cleared' }), false);
  assert.equal(eligible({ ...roadClosed, lifecycleState: 'stale' }), false);
  assert.equal(eligible({ ...roadClosed, lat: undefined }), false);
});

test('protected popup copy stays consumer friendly and canonical keys stay out of visible text', () => {
  for (const copy of ['Community reports', 'confidenceLine', 'freshnessLine', 'guidanceLine', 'locationLine']) assert.match(popupSource, new RegExp(copy));
  assert.doesNotMatch(popupSource, />road_closed<|>community_report<|>sourceKind<|>providerId</);
});

const liveRoadIncident = {
  id: 'road-road_closed-33.1383--95.6062',
  report_type: '',
  type: '',
  status: 'active',
  lat: 33.1382609179619,
  lng: -95.6061708927155,
  sourceReportIds: ['5f86ed43-579c-40e7-b182-f7656b59fd22'],
  sourceReportTypes: ['road_closed']
};

function actionHarness() {
  const actionContext = vm.createContext({
    console: { debug() {} },
    crossings: [],
    window: {},
    getUnifiedIncidents: () => [liveRoadIncident],
    createSharedHazardReport: async (...args) => actionContext.confirmCalls.push(args),
    createSharedReport: async () => { throw new Error('rail path must not execute'); },
    setConfirmation: (...args) => actionContext.messages.push(args),
    confirmCalls: [],
    clearCalls: [],
    messages: []
  });
  actionContext.window.clearHazard = async (...args) => actionContext.clearCalls.push(args);
  vm.runInContext(`${readFunction('gridlyResolveCommunityIncidentLifecycleTarget')}\n${readFunction('mapUnifiedRailConfirmType')}\n${readFunction('handleUnifiedIncidentAction')}`, actionContext);
  return actionContext;
}

test('Confirm Still Active targets live source lineage and preserves type and coordinates', async () => {
  const actionContext = actionHarness();
  await actionContext.handleUnifiedIncidentAction({ dataset: {
    unifiedAction: 'confirm',
    incidentId: liveRoadIncident.id,
    incidentCategory: 'road',
    reportType: ''
  } });

  assert.equal(actionContext.confirmCalls.length, 1);
  const [hazardType, lat, lng, confidence, locationName, originalTapCoords, options] = actionContext.confirmCalls[0];
  assert.equal(hazardType, 'road_closed');
  assert.equal(lat, liveRoadIncident.lat);
  assert.equal(lng, liveRoadIncident.lng);
  assert.equal(confidence, 'unified incident confirm still active');
  assert.equal(locationName, '');
  assert.equal(originalTapCoords, null);
  assert.equal(options.lifecycleTargetReportId, liveRoadIncident.sourceReportIds[0]);
  assert.equal(actionContext.clearCalls.length, 0);
});

test('Mark Cleared targets the same live source lineage once', async () => {
  const actionContext = actionHarness();
  await actionContext.handleUnifiedIncidentAction({ dataset: {
    unifiedAction: 'cleared',
    incidentId: liveRoadIncident.id,
    incidentCategory: 'road',
    reportType: ''
  } });

  assert.deepEqual(actionContext.clearCalls, [[
    'road_closed',
    liveRoadIncident.lat,
    liveRoadIncident.lng,
    liveRoadIncident.sourceReportIds[0]
  ]]);
  assert.equal(actionContext.confirmCalls.length, 0);
});

test('community lifecycle actions fail closed rather than creating other_hazard without lineage', async () => {
  const actionContext = actionHarness();
  actionContext.getUnifiedIncidents = () => [{ ...liveRoadIncident, sourceReportIds: [], sourceReportTypes: [] }];
  await actionContext.handleUnifiedIncidentAction({ dataset: {
    unifiedAction: 'confirm', incidentId: liveRoadIncident.id, incidentCategory: 'road', reportType: ''
  } });
  assert.equal(actionContext.confirmCalls.length, 0);
  assert.equal(actionContext.messages.length, 1);
});

test('authorized hazard writers persist lifecycle lineage for confirmation and clear evidence', () => {
  const confirmWriter = readFunction('createSharedHazardReport');
  const clearWriter = source.slice(source.indexOf('window.clearHazard = async function'), source.indexOf('function injectHazardStyles'));
  assert.match(confirmWriter, /options\?\.lifecycleTargetReportId/);
  assert.match(confirmWriter, /lifecycle_report_id:/);
  assert.match(clearWriter, /lifecycleTargetReportId/);
  assert.match(clearWriter, /lifecycle_report_id:/);
});
