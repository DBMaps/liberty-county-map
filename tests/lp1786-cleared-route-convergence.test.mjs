import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

const helpers = {};
vm.runInNewContext(`${extract('function getGridlyDestinationRouteImpactInspectionText(', '\nfunction isGridlyDestinationRouteHighImpactRailMatch(')}
this.flooding = isGridlyDestinationRouteFloodingMatch;
this.official = isGridlyDestinationRouteOfficialRoadwayEvidence;`, helpers);

const active = (type, extra = {}) => ({ id: type, type, category: type, status: 'active', sourceType: 'community', providerId: '', ...extra });
const reduceLifecycle = rows => {
  const clears = rows.filter(row => row.type === 'hazard_cleared');
  return rows.filter(row => row.type !== 'hazard_cleared' && !clears.some(clear => clear.clearedType === row.type && clear.at >= row.at));
};

test('two active conditions are independently represented', () => {
  const rows = [active('road_closed', { at: 1 }), active('flooding', { at: 2 })];
  assert.deepEqual(rows.map(row => row.type), ['road_closed', 'flooding']);
  assert.equal(helpers.flooding(rows[1]), true);
});

test('selective clear and repeated persistence refresh preserve flooding only', () => {
  const rows = [active('road_closed', { at: 1 }), active('flooding', { at: 2 }), { type: 'hazard_cleared', clearedType: 'road_closed', at: 3 }];
  const immediate = reduceLifecycle(rows);
  const refreshed = reduceLifecycle([...rows]);
  assert.deepEqual(immediate.map(row => row.type), ['flooding']);
  assert.deepEqual(refreshed.map(row => row.type), ['flooding']);
  assert.equal(refreshed.some(row => row.type === 'hazard_cleared'), false);
});

test('consumer flooding truth replaces cleared road-closure wording', () => {
  const primaryReason = extract('function getGridlyDestinationRoutePrimaryImpactReason(', '\nfunction getGridlyDestinationRoutePrimaryImpactLocationSelection(');
  assert.match(primaryReason, /Flooding reported near this route/);
  assert.ok(primaryReason.indexOf('closureMatches.length') < primaryReason.indexOf('floodingMatches.length'));
  assert.match(extract('function buildGridlyDestinationRouteImpactAudit(', '\nwindow.gridlyDestinationRouteImpactAudit'), /floodingMatches/);
});

test('official support requires current normalized official identity', () => {
  assert.equal(helpers.official(active('flooding')), false);
  assert.equal(helpers.official(active('flooding', { impactText: '(future_source: txdot_flooding)' })), false);
  assert.equal(helpers.official(active('flooding', { sourceType: 'txdot', providerId: 'drivetexas' })), true);
  assert.equal(helpers.official(active('flooding', { sourceType: 'txdot', status: 'cleared' })), false);
});

test('Destination evidence counts normalized community and official records directly', () => {
  const render = extract('function renderGridlyDestinationImpactPane(', '\nfunction gridlyLp063DestinationDecisionAudit(');
  assert.match(render, /isGridlyDestinationRouteOfficialRoadwayEvidence/);
  assert.doesNotMatch(render, /records\.length - railCount - weatherCount - communityCount/);
});

test('clear and refresh invalidate Route Watch consumer cache identity', () => {
  const convergence = extract('function gridlyLp0534cInvalidateCurrentStateModels(', '\nfunction gridlyApplyImmediateClearLifecycleConvergence(');
  const signature = extract('function getGridlyDestinationRouteSourceSignature(', '\nfunction getGridlyDestinationRouteCacheKey(');
  assert.match(convergence, /invalidateGridlyDestinationRouteIntelligenceCache/);
  assert.match(signature, /routeWatch: buildSignature\(getRouteWatchCommunitySourceIncidents\(\)\)/);
});

test('freshness and confidence continue to consume the remaining live proximity set', () => {
  assert.match(extract('window.gridlyFreshnessAudit', '\n\nwindow.gridlyConfidenceAudit'), /getLiveProximityRouteIntelligenceIncidents\(\)/);
  assert.match(extract('window.gridlyConfidenceAudit', '\n\nwindow.gridlyRouteConfidenceAudit'), /getLiveProximityRouteIntelligenceIncidents\(\)/);
});

test('Dayton Awareness stays local and Route Watch stop stays isolated', () => {
  const sourceIncidents = extract('function getRouteIntelligenceSourceIncidents(', '\nfunction getLiveProximityRouteIntelligenceIncidents(');
  const stop = extract('function stopGridlyRouteWatch(', '\nfunction clearGridlyRoute(');
  assert.match(sourceIncidents, /if \(!routeWatchActivated\) return localAndOfficial/);
  assert.match(sourceIncidents, /remoteCommunity/);
  assert.match(stop, /stopGridlyRouteWatchPositionUpdates\(\)/);
  assert.doesNotMatch(sourceIncidents, /gridlySetAwarenessArea/);
});
