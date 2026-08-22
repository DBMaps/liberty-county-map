const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const governed = require('../js/governed-awareness.js');

const record = (id, subtype, extra = {}) => ({ id, source: 'community', subtype, canonicalCommunity: 'Fixture', countyId: 'fixture-tx', status: 'active', ...extra });
const snapshot = (records, extra = {}) => governed.buildSnapshot({ records, evidenceGeneration: 4, transitionGeneration: 4, ...extra });

test('one governed provider identity is stable across consumer projections', () => {
  const base = { reportId: 'r-1', source: 'community', subtype: 'blocked_crossing' };
  assert.equal(governed.identity(base), governed.identity({ ...base, title: 'different projection text' }));
  const out = snapshot([base, { ...base, title: 'map copy' }]);
  assert.equal(out.evidence.length, 1); assert.deepEqual(out.duplicateEvidenceIds, ['community_report:r-1']);
});

test('Location Context derives from unique governed eligible evidence, not rows', () => {
  const out = snapshot([record('a', 'blocked_crossing'), record('b', 'closed_road')], { displayedActiveIssueCount: 2, actual: { kbygCommunity: ['a'] } });
  assert.equal(out.governedEligibleEvidenceCount, 2); assert.equal(out.locationContextCountAgreement, true); assert.equal(out.publishedIds.kbygCommunity.length, 1);
});

test('grouped KBYG rows do not redefine Rankin underlying count', () => {
  const rows = [1, 2, 3].map((n) => ({ id: `rankin-${n}`, sourceKind: 'official_roadway', subtype: 'lane_closure' }));
  const out = snapshot(rows, { displayedActiveIssueCount: 3, actual: { kbygOfficialRoadways: ['rankin-1'] } });
  assert.equal(out.governedEligibleEvidenceCount, 3); assert.equal(out.publishedIds.kbygOfficialRoadways.length, 1);
});

for (const [subtype, counted] of [['blocked_crossing', true], ['disabled_vehicle', false], ['flooded_road', true], ['closed_road', true], ['rail_crossing_issue', true]]) {
  test(`${subtype} community report has deterministic existing-runtime classification`, () => {
    const row = snapshot([record(subtype, subtype)]).evidence[0];
    assert.equal(row.eligible.locationContext, counted); assert.equal(row.eligible.map, true);
    assert.equal(row.omissionReasons.alerts, 'PRODUCT_CONTRACT_UNDEFINED');
    assert.equal(row.eligible.kbygOfficialRoadways, false);
  });
}

test('Pecos two-report fixture proves blocked crossing is the single counted issue', () => {
  const out = snapshot([record('pecos-blocked', 'blocked_crossing'), record('pecos-disabled', 'disabled_vehicle')], { displayedActiveIssueCount: 1, actual: { map: ['pecos-blocked', 'pecos-disabled'] } });
  assert.deepEqual(out.locationContextCountedIds, ['community_report:pecos-blocked']); assert.equal(out.locationContextCountAgreement, true);
});

test('Cienegas initial blocked crossing is map-published and count eligible', () => {
  const out = snapshot([record('ct-blocked', 'blocked_crossing')], { displayedActiveIssueCount: 1, actual: { map: ['ct-blocked'] } });
  assert.equal(out.evidence[0].published.map, true); assert.equal(out.governedEligibleEvidenceCount, 1);
});

test('Cienegas later four fails closed unless all four identities are available', () => {
  const out = snapshot([record('ct-blocked', 'blocked_crossing')], { displayedActiveIssueCount: 4 });
  assert.equal(out.governedEligibleEvidenceCount, 1); assert.equal(out.locationContextCountAgreement, false);
});

test('four identified Cienegas items explain four without duplicate inflation', () => {
  const rows = [record('ct-blocked', 'blocked_crossing'), ...['g1','g2','g3'].map((id) => ({ id, sourceKind: 'generated_road_incident', subtype: 'debris' }))];
  assert.equal(snapshot(rows, { displayedActiveIssueCount: 4 }).governedEligibleEvidenceCount, 4);
});

test('Val Verde generated incident remains evidence when Alerts and KBYG omit it', () => {
  const row = snapshot([{ incidentId: 'road-laughlin', sourceKind: 'generated_road_incident', subtype: 'debris' }]).evidence[0];
  assert.equal(row.countedByLocationContext, true); assert.equal(row.omissionReasons.alerts, 'PROPAGATION_FAILURE'); assert.equal(row.omissionReasons.kbygCommunity, 'PROPAGATION_FAILURE');
});

test('Pearsall official flooding is full-stack eligible', () => {
  const row = snapshot([{ id: 'fm140', provider: 'DriveTexas', sourceKind: 'official_roadway', subtype: 'Flooding' }]).evidence[0];
  for (const surface of ['locationContext','communityPulse','alerts','kbygOfficialRoadways','map','popup']) assert.equal(row.eligible[surface], true);
});

test('Floydada Travel Advisory stays present and exposes KBYG propagation failure', () => {
  const row = snapshot([{ id: 'floyd-advisory', provider: 'DriveTexas', sourceKind: 'official_roadway', subtype: 'Travel Advisory' }]).evidence[0];
  assert.equal(row.subtype, 'travel_advisory'); assert.equal(row.omissionReasons.kbygOfficialRoadways, 'PROPAGATION_FAILURE');
});

test('quiet control is governed zero', () => { const out = snapshot([], { displayedActiveIssueCount: 0 }); assert.equal(out.governedEligibleEvidenceCount, 0); assert.equal(out.locationContextCountAgreement, true); });
test('stale evidence cannot inflate current count', () => { assert.equal(snapshot([record('old', 'closed_road', { status: 'stale' })]).governedEligibleEvidenceCount, 0); });
test('duplicate evidence cannot inflate current count', () => { assert.equal(snapshot([record('same', 'closed_road'), record('same', 'closed_road')]).governedEligibleEvidenceCount, 1); });
test('older asynchronous generation cannot overwrite current snapshot', () => {
  const current = snapshot([record('new', 'closed_road')], { evidenceGeneration: 8 });
  const rejected = snapshot([], { evidenceGeneration: 7, previousSnapshot: current });
  assert.equal(rejected.evidenceGeneration, 8); assert.equal(rejected.updateReason, 'OLDER_GENERATION_REJECTED');
});
test('map publication does not imply Alerts or KBYG eligibility', () => {
  const row = snapshot([record('disabled', 'disabled_vehicle')], { actual: { map: ['disabled'] } }).evidence[0];
  assert.equal(row.published.map, true); assert.equal(row.eligible.alerts, false); assert.equal(row.omissionReasons.alerts, 'PRODUCT_CONTRACT_UNDEFINED');
});
test('identity-less projection fails closed and cannot become evidence', () => { assert.equal(snapshot([{ sourceKind: 'consumer_only_projection' }]).evidence.length, 0); });
test('production instrumentation is bounded and contains no town/county special cases', () => {
  const source = fs.readFileSync('js/governed-awareness.js', 'utf8');
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /window\.gridlyGovernedAwarenessAudit = gridlyGovernedAwarenessAudit/);
  for (const forbidden of ['Pecos','Cienegas','Val Verde','McAllen','Del Rio']) assert.equal(source.includes(forbidden), false);
});
