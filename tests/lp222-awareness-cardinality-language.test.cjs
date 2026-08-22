const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const governed = require('../js/governed-awareness.js');

const app = fs.readFileSync('js/app.js', 'utf8');
const NOW = Date.parse('2026-08-22T12:00:00Z');
const hazard = (id, extra = {}) => ({ id, sourceKind: 'active_hazard', reportKind: 'hazard', type: 'road_hazard', status: 'active', active: true, geographicEligible: true, countyId: 'hopkins-tx', canonicalCommunity: 'Sulphur Springs', canonicalKey: '4870904', ...extra });
const official = (id, extra = {}) => ({ id, sourceKind: 'official_roadway', provider: 'DriveTexas', type: 'road_closure', title: 'Road closure', status: 'active', active: true, geographicEligible: true, ...extra });
const project = records => governed.buildConsumerProjection({ records, nowMs: NOW, countyId: 'hopkins-tx', canonicalCommunity: 'Sulphur Springs', canonicalKey: '4870904' });

const presentationStart = app.indexOf('function gridlyCommunityPulseDecisionFreshnessLine');
const presentationEnd = app.indexOf('function syncGridlyCommunityPulseCopyFromModel', presentationStart);
const presentationContext = vm.createContext({ Object, Array, Number, Math, Date, RegExp, String, Set });
vm.runInContext(`function safeDisplayText(value, fallback = '') { return String(value || fallback || '').trim(); }\n${app.slice(presentationStart, presentationEnd)}`, presentationContext);
const compact = (ids, fallbackCount = ids.length) => presentationContext.buildGridlyCommunityPulseDecisionPresentation({
  selectedCommunityCount: fallbackCount,
  mobilityPressureCategory: 'building',
  activeAwareness: { activeAwarenessCount: fallbackCount, governedKbygEvidenceIds: ids, activeAwarenessSamples: [{ updatedAt: new Date().toISOString() }] }
});

const authorityStart = app.indexOf('function gridlyStoryConditionIdentity');
const authorityEnd = app.indexOf('function buildGridlyAwarenessStory', authorityStart);
const authorityContext = vm.createContext({ Object, Array, Number, Math, Date, RegExp, String, Set });
vm.runInContext(`
function gridlyStoryRecordText(record = {}) { return [record.title, record.type, record.description].filter(Boolean).join(' '); }
function gridlyStoryTransportationImpact(record = {}) { return /closure|closed|crash|lane|construction/i.test(gridlyStoryRecordText(record)) ? { kind: 'road_closure' } : null; }
${app.slice(authorityStart, authorityEnd)}
`, authorityContext);
const travelAuthority = (community = [], roadway = [], weather = null) => authorityContext.gridlyStoryRelevantConditionAuthority(community, roadway, weather);

function assertNumber(decision, expected) {
  const text = `${decision.headline} ${decision.subline}`;
  if (expected === 'quiet') assert.doesNotMatch(text, /Several conditions|Multiple conditions|A community report is active nearby/i);
  if (expected === 'singular') {
    assert.match(text, /A community report is active nearby/i);
    assert.doesNotMatch(text, /Several conditions|Multiple conditions|Multiple recent signals/i);
  }
  if (expected === 'plural') assert.match(text, /Several conditions may affect travel.*Multiple recent signals/i);
}

test('quiet control preserves quiet copy without active cardinality wording', () => {
  const out = project([]); const decision = compact(out.surfaces.kbygCommunity.map(row => row.evidenceId));
  assert.equal(decision.state, 'quiet'); assertNumber(decision, 'quiet'); assert.equal(travelAuthority().grammaticalNumber, 'quiet');
});

test('Sulphur Springs single governed hazard selects singular wording', () => {
  const out = project([hazard('sulphur-1')]); const ids = out.surfaces.kbygCommunity.map(row => row.evidenceId); const decision = compact(ids);
  assert.equal(out.snapshot.governedEligibleEvidenceCount, 1); assert.deepEqual(ids, ['active_hazard:sulphur-1']); assertNumber(decision, 'singular');
});

test('two governed active conditions retain approved plural wording', () => {
  const out = project([hazard('p1'), hazard('p2')]); assertNumber(compact(out.surfaces.kbygCommunity.map(row => row.evidenceId)), 'plural');
  assert.equal(travelAuthority(out.surfaces.kbygCommunity.map(row => row.record)).grammaticalNumber, 'plural');
});

test('single official-roadway condition has singular Travel Brief authority', () => {
  const authority = travelAuthority([], [official('tx-1')]); assert.equal(authority.authoritativeConditionCount, 1); assert.equal(authority.grammaticalNumber, 'singular');
});

test('mixed multi-source state is plural without duplicate inflation', () => {
  const authority = travelAuthority([hazard('h1')], [official('tx-1'), official('tx-1')]);
  assert.equal(authority.authoritativeConditionCount, 2); assert.equal(authority.grammaticalNumber, 'plural');
});

test('cleared history does not force active grammar', () => {
  const out = project([hazard('old', { status: 'cleared' })]); assertNumber(compact(out.surfaces.kbygCommunity.map(row => row.evidenceId)), 'quiet');
});

test('stale evidence does not force active grammar', () => {
  const out = project([hazard('stale', { status: 'stale' })]); assertNumber(compact(out.surfaces.kbygCommunity.map(row => row.evidenceId)), 'quiet');
});

test('duplicate evidence does not force plural grammar', () => {
  const out = project([hazard('same'), hazard('same')]); assert.equal(out.snapshot.duplicateEvidenceIds.length, 1); assertNumber(compact(out.surfaces.kbygCommunity.map(row => row.evidenceId)), 'singular');
});

test('old-area evidence cannot affect current-community grammar', () => {
  const out = project([hazard('current'), hazard('old-area', { countyId: 'reeves-tx', canonicalCommunity: 'Pecos', geographicEligible: false })]);
  assertNumber(compact(out.surfaces.kbygCommunity.map(row => row.evidenceId)), 'singular');
});

test('compact and Travel Brief agree for the same governed scoped set', () => {
  for (const records of [[], [hazard('one')], [hazard('one'), hazard('two')]]) {
    const out = project(records); const rows = out.surfaces.kbygCommunity; const ids = rows.map(row => row.evidenceId);
    const compactNumber = ids.length === 0 ? 'quiet' : ids.length === 1 ? 'singular' : 'plural';
    assert.equal(travelAuthority(rows.map(row => row.record)).grammaticalNumber, compactNumber);
    assertNumber(compact(ids), compactNumber);
  }
});

test('production exposes LP222 aggregate audit and no mobility-pressure plural override remains', () => {
  assert.match(app, /window\.gridlyAwarenessCardinalityLanguageAudit = gridlyAwarenessCardinalityLanguageAudit/);
  assert.match(app, /semanticScope: "governed-kbyg-community-current-conditions"/);
  assert.doesNotMatch(app.slice(app.indexOf('function buildGridlyCommunityPulseDecisionPresentation'), app.indexOf('function syncGridlyCommunityPulseCopyFromModel')), /mobilityPressureCategory/);
});
