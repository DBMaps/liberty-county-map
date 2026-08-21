import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/app.js', 'utf8');
const report = JSON.parse(fs.readFileSync('data/generated/lp213-statewide-multi-county-place-audit.json', 'utf8'));
const saveStart = source.indexOf('function gridlySaveCanonicalMultiCountyPlaceHome');
const saveEnd = source.indexOf('function searchGridlySettingsAwarenessArea', saveStart);
const scopedStart = source.indexOf('function selectGridlySettingsAwarenessArea');
const scopedEnd = source.indexOf('function gridlyCommunityCoverageExpansionAudit', scopedStart);

test('canonical callers carry the owner-selected governed county and ambiguous saves fail closed', () => {
  const save = source.slice(saveStart, saveEnd);
  assert.match(save, /requestedOperationalCountyId/);
  assert.match(save, /explicit_operational_membership_missing/);
  assert.match(save, /countyMemberships \|\| \[\]\)\.map\(String\)\.includes\(requestedCountyFips\)/);
  assert.doesNotMatch(save, /countyMemberships\s*\[\s*0\s*\]/);
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome\(result, "settings_awareness_area_search", candidate\.countyId\)/);
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome\(canonicalResolution, "lp0517_manual_place_personalization", requestedOperationalCountyId\)/);
});

test('county-scoped activation bypasses label-only reconstruction', () => {
  const scoped = source.slice(scopedStart, scopedEnd);
  assert.match(scoped, /return gridlySaveCanonicalMultiCountyPlaceHome\(canonicalResult, source, selectedCountyId\)/);
  assert.doesNotMatch(scoped, /label_only_reconstruction/);
  assert.doesNotMatch(scoped, /reconstructedArea/);
});

test('canonical PLACE persistence binds and restores explicit governed county authority', () => {
  assert.match(source, /countyId: requestedCountyId, countyName: requestedCounty\.name/);
  assert.match(source, /const homeCountyId = validateMemberCounty\(homeRecord\?\.countyId\)/);
  assert.match(source, /if \(homeCountyId\) return homeCountyId/);
  assert.match(source, /canonicalMultiCountyPlace \? gridlyProjectCanonicalPlaceOperationalCounty/);
  assert.match(source, /do not inherit the previous active county/);
});

test('known C/J cohort and statewide multi-county identities retain governed memberships', () => {
  assert.equal(report.totalCanonicalMultiCountyPlaceCount, 163);
  assert.deepEqual(report.classificationTotals, { PASS: 163, SAME_COLD_START_DEFECT: 0, DIFFERENT_DEFECT: 0, OWNER_REVIEW_REQUIRED: 0 });
  for (const label of ['Midland', 'Abilene', 'New Braunfels', 'Austin', 'Corpus Christi', 'San Diego', 'San Marcos', 'Monahans', 'Odessa', 'Denver City']) {
    const row = report.inventory.find(candidate => candidate.label === label);
    assert.ok(row, `${label} is certified`);
    assert.ok(row.members.length > 1, `${label} retains multiple memberships`);
  }
  const expected = new Map([['Midland', 'midland-tx'], ['Abilene', 'taylor-tx']]);
  for (const [label, countyId] of expected) {
    assert.ok(report.inventory.find(row => row.label === label).members.some(member => member.countyId === countyId));
  }
  assert.match(source, /"displayName":"Stanton"[^\n]+?"countyMemberships":\["48317"\]/);
});

test('LP216 ledger and stale-generation guards remain wired to converging consumers', () => {
  assert.match(source, /window\.gridlyTransitionTrace = trace/);
  assert.match(source, /cameraGeneration !== gridlyActiveCountyTransitionGeneration/);
  for (const stage of ['authoritative_county_resolution', 'active_county_decision', 'crossing_source_resolution', 'crossing_render_county', 'roadway_source_resolution', 'awareness_county_projected', 'settings_county_persisted', 'profile_county_persisted']) {
    assert.match(source, new RegExp(`"${stage}"`));
  }
});
