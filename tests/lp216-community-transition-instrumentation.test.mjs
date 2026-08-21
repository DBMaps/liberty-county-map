import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/app.js', 'utf8');
const report = JSON.parse(fs.readFileSync('data/generated/lp213-statewide-multi-county-place-audit.json', 'utf8'));

test('LP216 ledger is audit-only and preserves explicit identity fields', () => {
  assert.match(source, /LP216\.community-transition\.v1/);
  assert.match(source, /window\.gridlyTransitionTrace = trace/);
  for (const field of ['transitionId', 'governedMemberships', 'selectedMembership', 'authoritativeMembership', 'authoritativeCounty', 'activeCounty', 'subsystemCounty', 'presentationCoordinate', 'cameraTarget', 'staleState', 'transitionGeneration', 'reason']) assert.match(source, new RegExp(field));
  assert.match(source, /return gridlyRecordCommunityTransitionStage\("transition_started"/);
});

test('explicit multi-county membership is preserved or fails closed, never replaced by membership order', () => {
  assert.match(source, /explicit_operational_membership_missing/);
  assert.match(source, /explicit_governed_membership/);
  assert.doesNotMatch(source.slice(source.indexOf('function gridlySaveCanonicalMultiCountyPlaceHome'), source.indexOf('function searchGridlySettingsAwarenessArea')), /countyMemberships\s*\[\s*0\s*\]/);
  for (const name of ['Midland', 'Abilene']) {
    const row = report.inventory.find(candidate => candidate.label === name);
    assert.ok(row.members.some(member => member.countyId === row.selectedTestOperationalCounty.countyId));
  }
});

test('membership data and LP213 statewide control remain unchanged', () => {
  assert.equal(report.totalCanonicalMultiCountyPlaceCount, 163);
  assert.deepEqual(report.classificationTotals, { PASS: 163, SAME_COLD_START_DEFECT: 0, DIFFERENT_DEFECT: 0, OWNER_REVIEW_REQUIRED: 0 });
  assert.equal(report.inventory.find(row => row.label === 'Midland').members.length, 2);
  assert.equal(report.inventory.find(row => row.label === 'Abilene').members.length, 2);
  const stanton = source.match(/"displayName":"Stanton"[^\n]+?"countyMemberships":\["48317"\]/);
  assert.ok(stanton, 'Stanton remains a single Martin County membership positive control');
});

test('all county-governed consumers emit into the same transaction ledger', () => {
  for (const stage of ['county_scoped_selection', 'label_only_reconstruction', 'authoritative_county_resolution', 'active_county_decision', 'presentation_dispatch', 'crossing_source_resolution', 'crossing_render_county', 'roadway_source_resolution', 'awareness_county_projected', 'settings_county_persisted', 'profile_county_persisted']) assert.match(source, new RegExp(`"${stage}"`));
});
