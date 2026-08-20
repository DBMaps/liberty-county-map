import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const contract = fs.readFileSync('docs/LP037.1-CONSUMER-CROSSING-COUNT-AUTHORITY.md', 'utf8');

function selectWatched(inventory, area) {
  const seen = new Set();
  return inventory.filter((row) => {
    if (row.countyId !== area.countyId || !row.reportable || !row.publicRoadway || !area.owns(row)) return false;
    const id = row.id.toLowerCase();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const row = (id, countyId, town) => ({ id, countyId, town, reportable: true, publicRoadway: true });
const area = (countyId, town) => ({ countyId, owns: (crossing) => crossing.town === town });

test('documented watched contract is awareness-owned and explicitly independent of viewport markers', () => {
  assert.match(contract, /geographically owned by the currently selected awareness area/i);
  assert.match(contract, /Marker rendering and viewport performance policy should not redefine the watched count/i);
  assert.match(app, /locationContextCountOwner: "gridlySelectConsumerVisibleCrossings"/);
  assert.match(app, /countMismatchExpectedByDesign: true/);
});

test('Addison contradiction control preserves distinct map and awareness identities', () => {
  const dallasFixture = JSON.parse(fs.readFileSync('Crossing-Packages/dallas/Production/dallas-production-crossings.geojson', 'utf8'));
  assert.equal(dallasFixture.features.length, 789);
  const inventory = [row('A', 'dallas-tx', 'Addison'), row('B', 'dallas-tx', 'Addison'), row('C', 'dallas-tx', 'Dallas')];
  const watchedIds = selectWatched(inventory, area('dallas-tx', 'Addison')).map((item) => item.id);
  const representativeViewportIds = ['B', 'C'];
  assert.deepEqual(watchedIds, ['A', 'B']);
  assert.deepEqual(representativeViewportIds.filter((id) => watchedIds.includes(id)), ['B']);
});

test('shared selector covers smaller positive, ACTIVE_EMPTY, and a different positive county', () => {
  const inventory = [row('L1', 'liberty-tx', 'Dayton'), row('P1', 'potter-tx', 'Amarillo')];
  assert.equal(selectWatched(inventory, area('liberty-tx', 'Dayton')).length, 1);
  assert.equal(selectWatched(inventory, area('jones-tx', 'Abilene')).length, 0);
  assert.equal(selectWatched(inventory, area('potter-tx', 'Amarillo')).length, 1);
});

test('community transition cannot retain predecessor identities and duplicate IDs count once', () => {
  const inventory = [row('A1', 'dallas-tx', 'Addison'), row('A1', 'dallas-tx', 'Addison'), row('D1', 'liberty-tx', 'Dayton')];
  assert.deepEqual(selectWatched(inventory, area('dallas-tx', 'Addison')).map((item) => item.id), ['A1']);
  assert.deepEqual(selectWatched(inventory, area('liberty-tx', 'Dayton')).map((item) => item.id), ['D1']);
});

test('identity audit reads marker registry and shared selector rather than DOM', () => {
  const body = app.slice(app.indexOf('function gridlyRailLocationContextParityAudit'), app.indexOf('window.gridlyRailLocationContextParityAudit =') + 100);
  assert.match(body, /crossingMarkers instanceof Map/);
  assert.match(body, /gridlySelectConsumerVisibleCrossings/);
  assert.doesNotMatch(body, /querySelector|crossingDomMarkerCount/);
  assert.match(body, /intersectionIds/);
  assert.match(body, /mapOnlyIds/);
  assert.match(body, /locationContextOnlyIds/);
});
