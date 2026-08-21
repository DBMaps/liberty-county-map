import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/app.js', 'utf8');
const multiCounty = JSON.parse(fs.readFileSync('data/generated/lp213-statewide-multi-county-place-audit.json', 'utf8'));
const statewide = JSON.parse(fs.readFileSync('data/generated/lp214-county-community-inventory.json', 'utf8'));
function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  const bodyStart = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}
const helperSource = [
  functionSource('gridlyManualAwarenessMembershipCountyId'),
  functionSource('gridlyManualAwarenessSelectionMatches')
].join('\n');
const context = { gridlyNormalizeCountyId: value => String(value || '').trim().toLowerCase() };
vm.runInNewContext(`${helperSource}\nthis.membershipCounty = gridlyManualAwarenessMembershipCountyId; this.matches = gridlyManualAwarenessSelectionMatches;`, context);

const rowFor = label => multiCounty.inventory.find(row => row.label === label);
const choicesFor = label => {
  const row = rowFor(label);
  return row.members.map(member => ({
    group: { countyId: member.countyId },
    community: {
      value: row.canonicalAwarenessKey,
      key: row.canonicalAwarenessKey,
      requestedOperationalCountyId: member.countyId,
      canonicalResolution: { placeGeoid: row.placeGeoid, community: row.label, countyMemberships: row.members.map(item => item.fips) }
    }
  }));
};

function select(label, countyId) {
  const choices = choicesFor(label);
  const selected = choices.find(({ group, community }) => context.matches(community, group, community.value, countyId));
  return {
    selectedMembership: context.membershipCounty(selected?.community, selected?.group),
    authoritativeMembership: context.membershipCounty(selected?.community, selected?.group),
    authoritativeCounty: context.membershipCounty(selected?.community, selected?.group),
    selectedRows: choices.filter(({ group, community }) => context.matches(community, group, community.value, countyId)).length,
    canonicalResolution: selected?.community.canonicalResolution
  };
}

test('membership rows use canonical PLACE plus explicit governed county identity', () => {
  const abilene = choicesFor('Abilene');
  assert.equal(new Set(abilene.map(({ group, community }) => `${community.canonicalResolution.placeGeoid}:${context.membershipCounty(community, group)}`)).size, 2);
  assert.equal(context.matches(abilene[0].community, abilene[0].group, abilene[0].community.value, abilene[1].group.countyId), false);
  assert.match(source, /data-gridly-manual-awareness-county-id=/);
  assert.doesNotMatch(helperSource, /\.find\(|\[0\]|displayName|\.label/);
});

test('Abilene selection is unique and preserves Taylor or Jones authority through activation', () => {
  for (const countyId of ['taylor-tx', 'jones-tx']) {
    const result = select('Abilene', countyId);
    assert.deepEqual([result.selectedMembership, result.authoritativeMembership, result.authoritativeCounty], [countyId, countyId, countyId]);
    assert.equal(result.selectedRows, 1);
    assert.equal(result.canonicalResolution.community, 'Abilene');
  }
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome\(canonicalResolution, "settings_manual_awareness_area", requestedOperationalCountyId\)/);
});

test('Midland membership rows remain independent positive controls', () => {
  for (const countyId of ['midland-tx', 'martin-tx']) {
    const result = select('Midland', countyId);
    assert.equal(result.selectedMembership, countyId);
    assert.equal(result.selectedRows, 1);
  }
});

test('regression cohort and every static multi-county membership have unique selectable identities', () => {
  const cohort = ['Midland', 'Abilene', 'New Braunfels', 'Austin', 'Corpus Christi', 'San Diego', 'San Marcos', 'Monahans', 'Odessa', 'Denver City'];
  for (const label of cohort) assert.ok(rowFor(label)?.members.length > 1, `${label} remains multi-county`);
  for (const row of multiCounty.inventory) {
    const identities = row.members.map(member => `${row.placeGeoid}:${member.countyId}`);
    assert.equal(new Set(identities).size, row.members.length, `${row.label} identities are unique`);
    for (const member of row.members) assert.equal(select(row.label, member.countyId).selectedRows, 1, `${row.label}/${member.countyId} selects exactly once`);
  }
  assert.equal(multiCounty.totalCanonicalMultiCountyPlaceCount, 163);
  assert.equal(statewide.summary.countyCommunityMembershipCount, 2058);
});

test('canonical card remains county-neutral while operational membership is retained and ambiguity fails closed', () => {
  const taylor = select('Abilene', 'taylor-tx');
  assert.equal(taylor.canonicalResolution.community, 'Abilene');
  assert.equal(taylor.selectedMembership, 'taylor-tx');
  assert.equal(select('Abilene', '').selectedMembership, '');
  const save = source.slice(source.indexOf('function gridlySaveCanonicalMultiCountyPlaceHome'), source.indexOf('function searchGridlySettingsAwarenessArea'));
  assert.match(save, /explicit_operational_membership_missing/);
  assert.doesNotMatch(save, /countyMemberships\s*\[\s*0\s*\]/);
  assert.match(source, /window\.gridlyTransitionTrace = trace/);
});
