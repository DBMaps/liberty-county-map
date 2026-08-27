import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const popupSource = source.slice(source.indexOf('function buildUnifiedIncidentPopup('), source.indexOf('function gridlyHazardPopupAudit('));

function readFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
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
