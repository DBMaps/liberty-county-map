const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const governed = require('../js/governed-awareness.js');

const app = fs.readFileSync('js/app.js', 'utf8');
const NOW = Date.parse('2026-08-22T12:00:00Z');
const area = { countyId: 'liberty-tx', canonicalCommunity: 'Dayton', canonicalKey: '4819432' };
const community = (id, extra = {}) => ({ id, sourceKind: 'community_report', type: 'blocked_crossing', status: 'active', active: true, ...area, ...extra });
const hazard = (id, extra = {}) => ({ id, sourceKind: 'active_hazard', reportKind: 'hazard', type: 'road_hazard', status: 'active', active: true, ...area, ...extra });
const official = (id, extra = {}) => ({ id, providerRecordId: id, sourceKind: 'official_roadway', type: 'road_closure', status: 'active', active: true, geographicEligible: true, ...area, ...extra });
const project = (records) => governed.buildConsumerProjection({ records, nowMs: NOW, ...area });

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const argumentsStart = app.indexOf('(', start);
  let parentheses = 0;
  let brace = -1;
  for (let index = argumentsStart; index < app.length; index += 1) {
    if (app[index] === '(') parentheses += 1;
    if (app[index] === ')') parentheses -= 1;
    if (parentheses === 0) {
      brace = app.indexOf('{', index);
      break;
    }
  }
  assert.notEqual(brace, -1, `${name} body must exist`);
  let depth = 0;
  for (let index = brace; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}' && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function makeHarness(projections, canonicalRecords = []) {
  let projectionCalls = 0;
  const context = vm.createContext({
    gridlyGetCanonicalActiveCommunityState: () => ({ activeRecords: canonicalRecords }),
    gridlyGetGovernedConsumerProjection: () => projections[Math.min(projectionCalls++, projections.length - 1)]
  });
  const auditStart = app.indexOf('const gridlyTravelBriefProjectionAuditState =');
  const auditEnd = app.indexOf('function gridlyBuildTravelBriefModel(', auditStart);
  assert.ok(auditStart >= 0 && auditEnd > auditStart, 'Travel Brief projection context must be extractable');
  vm.runInContext(`${extractFunction('gridlyGetGovernedActiveAwarenessRows')};${extractFunction('gridlyStoryActiveRecords')};${app.slice(auditStart, auditEnd)};this.api={ build:gridlyBuildTravelBriefProjectionContext, audit:gridlyTravelBriefProjectionAudit, story:gridlyStoryActiveRecords, awareness:gridlyGetGovernedActiveAwarenessRows };`, context);
  return { api: context.api, projectionCalls: () => projectionCalls };
}

function ids(rows) {
  return Array.from(rows, (row) => row.evidenceId || row.id);
}

test('active Travel Brief consumers retain their legacy semantics with one projection construction', () => {
  const projection = project([hazard('hazard-a')]);
  const legacy = makeHarness([projection, projection]);
  const legacyRecords = legacy.api.story();
  const legacyRows = legacy.api.awareness();
  assert.equal(legacy.projectionCalls(), 2, 'pre-change call chain constructs twice');

  const consolidated = makeHarness([projection]);
  const output = consolidated.api.build();
  assert.equal(consolidated.projectionCalls(), 1);
  assert.deepEqual(ids(output.records), ids(legacyRecords));
  assert.deepEqual(ids(output.awarenessRows), ids(legacyRows));
  assert.deepEqual({ ...consolidated.api.audit() }, {
    available: true, buildCount: 1, lastBuildProjectionConstructCount: 1,
    storyConsumerRowCount: 1, awarenessConsumerRowCount: 1,
    countParityPass: true, identityParityPass: true, orderingParityPass: true,
    singleProjectionPass: true, overallPass: true,
    duplicateProjectionAvoidedCount: 1, expectedProjectionConstructCount: 1
  });
});

test('multiple conditions preserve governed identity and order', () => {
  const projection = project([community('crossing-a'), hazard('hazard-b'), community('crossing-c')]);
  const harness = makeHarness([projection]);
  const output = harness.api.build();
  assert.deepEqual(ids(output.awarenessRows), ['community_report:crossing-a', 'active_hazard:hazard-b', 'community_report:crossing-c']);
  assert.deepEqual(ids(output.records), ['crossing-a', 'hazard-b', 'crossing-c']);
  assert.equal(harness.api.audit().orderingParityPass, true);
});

test('duplicate evidence retains governed canonical suppression', () => {
  const projection = project([hazard('same'), hazard('same')]);
  assert.equal(projection.snapshot.duplicateEvidenceIds.length, 1);
  const harness = makeHarness([projection]);
  const output = harness.api.build();
  assert.deepEqual(ids(output.awarenessRows), ['active_hazard:same']);
  assert.deepEqual(ids(output.records), ['same']);
  assert.equal(harness.api.audit().overallPass, true);
});

test('cleared, stale, inactive, and empty inputs remain excluded', () => {
  for (const records of [
    [hazard('cleared', { status: 'cleared' })],
    [hazard('stale', { status: 'stale' })],
    [hazard('inactive', { status: 'inactive', active: false })],
    []
  ]) {
    const projection = project(records);
    const harness = makeHarness([projection]);
    const output = harness.api.build();
    assert.deepEqual(ids(output.awarenessRows), []);
    assert.deepEqual(ids(output.records), []);
    assert.equal(harness.api.audit().overallPass, true);
  }
});

test('source-family mix keeps community rows first and official roadways separate from story records', () => {
  const projection = project([official('txdot-a'), community('crossing-a'), hazard('hazard-a')]);
  const harness = makeHarness([projection]);
  const output = harness.api.build();
  assert.deepEqual(ids(output.records), ['crossing-a', 'hazard-a']);
  assert.deepEqual(ids(output.awarenessRows), ['community_report:crossing-a', 'active_hazard:hazard-a', 'official_roadway:txdot-a']);
  const audit = harness.api.audit();
  assert.equal(audit.storyConsumerRowCount, 2);
  assert.equal(audit.awarenessConsumerRowCount, 3);
  assert.equal(audit.countParityPass, true);
  assert.equal(audit.identityParityPass, true);
  assert.equal(audit.orderingParityPass, true);
});

test('separate builds construct fresh projections and never reuse prior rows', () => {
  const first = project([hazard('first')]);
  const second = project([hazard('second')]);
  const harness = makeHarness([first, second]);
  assert.deepEqual(ids(harness.api.build().records), ['first']);
  assert.deepEqual(ids(harness.api.build().records), ['second']);
  assert.equal(harness.projectionCalls(), 2);
  assert.deepEqual({ buildCount: harness.api.audit().buildCount, lastBuildProjectionConstructCount: harness.api.audit().lastBuildProjectionConstructCount, duplicateProjectionAvoidedCount: harness.api.audit().duplicateProjectionAvoidedCount }, { buildCount: 2, lastBuildProjectionConstructCount: 1, duplicateProjectionAvoidedCount: 2 });
});

test('production Travel Brief is wired to the build-scoped context and exposes the audit', () => {
  const model = extractFunction('gridlyBuildTravelBriefModel');
  assert.match(model, /const projectionContext = gridlyBuildTravelBriefProjectionContext\(\)/);
  assert.match(model, /const records = projectionContext\.records/);
  assert.match(model, /projectionContext\.awarenessRows\.map/);
  assert.doesNotMatch(model, /gridlyStoryActiveRecords\(\)|gridlyGetGovernedActiveAwarenessRows\(\)/);
  assert.match(app, /window\.gridlyTravelBriefProjectionAudit = gridlyTravelBriefProjectionAudit/);
});
