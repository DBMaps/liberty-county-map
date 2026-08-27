import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
function readFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const body = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = body; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not read ${name}`);
}

const now = Date.parse('2026-08-27T12:00:00Z');
const context = vm.createContext({ HAZARD_REPORT_EXPIRATION_MINUTES: 180 });
vm.runInContext(`
  const gridlyDiagnosticArray = value => Array.isArray(value) ? value : [];
  const gridlyIsRoadClearedHazardRecord = row => row.type === 'hazard_cleared';
  const gridlyRoadClusterReportTimeMs = row => Date.parse(row.created_at);
  const gridlyRoadClusterReportAgeMinutes = (row, nowMs) => Math.round((nowMs - Date.parse(row.created_at)) / 60000);
  const gridlyRoadHazardClearMatchReason = (left, right) => left.condition === right.condition ? 'governed-condition' : '';
  const gridlyClassifyHazardLifecycle = (row, { nowMs }) => ({ lifecycleState: gridlyRoadClusterReportAgeMinutes(row, nowMs) <= 120 ? 'ACTIVE' : 'STALE' });
  ${readFunction('gridlyRoadHazardEvidenceContributorKey')}
  ${readFunction('gridlyRoadHazardEvidenceIsRecentActive')}
  ${readFunction('gridlyResolveRoadHazardCommunityEvidence')}
`, context);
const resolve = context.gridlyResolveRoadHazardCommunityEvidence;
const at = minutesAgo => new Date(now - minutesAgo * 60000).toISOString();
const active = (id, minutesAgo, device = id, condition = 'flood-a') => ({ id, device_id: device, type: 'flooding', condition, created_at: at(minutesAgo) });
const clear = (id, minutesAgo, device = id, condition = 'flood-a') => ({ id, device_id: device, type: 'hazard_cleared', condition, created_at: at(minutesAgo) });
const state = rows => resolve(rows[0], rows, now).state;

test('A: one active and one newer clear becomes Recently Cleared', () => assert.equal(state([active('a', 20), clear('c', 10)]), 'recently_cleared'));
test('B: two recent independent active reports and one newer clear conflict', () => assert.equal(state([active('a1', 30), active('a2', 20), clear('c', 10)]), 'conflict'));
test('C: five recent independent active reports and one newer clear conflict', () => assert.equal(state([...Array.from({ length: 5 }, (_, i) => active(`a${i}`, 30 - i)), clear('c', 10)]), 'conflict'));
test('D: five old lifecycle-stale active reports and one newer clear become Recently Cleared', () => assert.equal(state([...Array.from({ length: 5 }, (_, i) => active(`a${i}`, 170 - i)), clear('c', 10)]), 'recently_cleared'));
test('E: multiple recent active reports and two independent clears become Recently Cleared', () => assert.equal(state([active('a1', 30), active('a2', 20), clear('c1', 10), clear('c2', 5)]), 'recently_cleared'));
test('F: newer active evidence after clear returns Active', () => assert.equal(state([clear('c', 20), active('a', 10)]), 'active'));
test('G: clear remains authoritative after its 90-minute presentation window', () => assert.equal(state([active('a', 150), clear('c', 100)]), 'recently_cleared'));
test('H: newer active after an aged-out clear presentation returns Active', () => assert.equal(state([active('old', 150), clear('c', 100), active('new', 20)]), 'active'));

test('same-device duplicates do not create independent corroboration', () => {
  const rows = [active('a1', 30, 'same'), active('a2', 20, 'same'), clear('c', 10, 'clearer')];
  assert.equal(resolve(rows[0], rows, now).recentActiveEvidenceCount, 1);
  assert.equal(state(rows), 'recently_cleared');
});

test('different governed conditions cannot influence resolution', () => {
  const rows = [active('a', 20), clear('foreign', 10, 'c', 'debris-b')];
  assert.equal(state(rows), 'active');
});

test('conflict is one traveler-relevant governed condition with bounded copy', () => {
  const rows = [active('a1', 30), active('a2', 20), clear('c', 10)];
  const resolution = resolve(rows[0], rows, now);
  assert.equal(resolution.conflict, true);
  assert.equal([resolution].filter(item => item.state === 'active' || item.state === 'conflict').length, 1, 'one map/Alert/KBYG/Location Context contribution');
  assert.match(source, /Reports conflict · Conditions may have changed/);
  assert.doesNotMatch('Reports conflict · Conditions may have changed', /flood-a|coordtype|roadcluster|score/i);
});

test('loader retains clear lifecycle authority for active TTL while presentation remains 90 minutes', () => {
  assert.match(source, /recentRoadClearedCutoffIso = new Date\(Date\.now\(\) - HAZARD_REPORT_EXPIRATION_MINUTES \* 60000\)/);
  assert.match(source, /Number\(ageMinutes\) <= RECENTLY_CLEARED_WINDOW_MINUTES/);
});

test('A-H: governed anonymous contributors persist independent lifecycle evidence without multiplying incidents', () => {
  const persisted = [];
  const condition = 'disabled-vehicle-33.1382--95.6121';
  const write = (id, device, type, minutesAgo) => {
    const candidate = type === 'hazard_cleared'
      ? clear(id, minutesAgo, device, condition)
      : { ...active(id, minutesAgo, device, condition), type: 'disabled_vehicle' };
    const duplicate = persisted.find(row => row.device_id === device && row.type === type && row.condition === condition);
    if (!duplicate) persisted.push(candidate);
    return !duplicate;
  };

  assert.equal(write('active-a', 'normal-edge-installation', 'disabled_vehicle', 30), true, 'A initial report persists');
  assert.equal(persisted.length, 1);
  assert.equal(write('active-a-repeat', 'normal-edge-installation', 'disabled_vehicle', 25), false, 'B same contributor is suppressed');
  assert.equal(write('active-b', 'inprivate-edge-installation', 'disabled_vehicle', 20), true, 'C distinct governed identity persists');
  assert.equal(new Set(persisted.map(row => row.condition)).size, 1, 'D one governed condition');

  let resolution = resolve(persisted[0], persisted, now);
  assert.equal(resolution.recentActiveEvidenceCount, 2, 'E two independent active observations');
  assert.equal(write('clear-c', 'private-session-c', 'hazard_cleared', 10), true);
  resolution = resolve(persisted[0], persisted, now);
  assert.equal(resolution.state, 'conflict', 'F one independent newer clear conflicts');
  assert.equal(write('clear-d', 'private-session-d', 'hazard_cleared', 5), true);
  resolution = resolve(persisted[0], persisted, now);
  assert.equal(resolution.state, 'recently_cleared', 'G second independent clear resolves');
  assert.equal(resolution.clearEvidenceCount, 2);
  assert.notEqual('inprivate-edge-installation', 'private-session-c', 'H isolated stores receiving distinct IDs are independent');
});
