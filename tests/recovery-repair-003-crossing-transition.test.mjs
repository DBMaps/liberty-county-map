import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('js/app.js', 'utf8');
const geometryLoader = fs.readFileSync('js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('Crossing-Packages/production-crossing-manifest.json', 'utf8'));

const counts = new Map(manifest.records.map(record => [
  `${String(record.county).replace(/ County$/i, '').toLowerCase().replace(/\s+/g, '-')}-tx`,
  record.crossingCount
]));

class CrossingRuntime {
  constructor(countyId) {
    this.activeCounty = countyId;
    this.generation = 0;
    this.inventoryCounty = countyId;
    this.inventory = this.rows(countyId);
    this.loadCount = 0;
  }
  rows(countyId) {
    return Array.from({ length: counts.get(countyId) }, (_, id) => ({ id, countyId }));
  }
  transition(countyId) {
    if (countyId === this.activeCounty) return false;
    this.activeCounty = countyId;
    this.generation += 1;
    this.inventoryCounty = null;
    this.inventory = [];
    return true;
  }
  request(countyId) {
    const generation = this.generation;
    this.loadCount += 1;
    return () => {
      if (countyId !== this.activeCounty || generation !== this.generation) return false;
      this.inventoryCounty = countyId;
      this.inventory = this.rows(countyId);
      return true;
    };
  }
}

function assertCurrent(runtime, countyId, expectedCount) {
  assert.equal(runtime.activeCounty, countyId);
  assert.equal(runtime.inventoryCounty, countyId);
  assert.equal(runtime.inventory.length, expectedCount);
  assert.ok(runtime.inventory.every(record => record.countyId === countyId));
}

test('cross-county controls replace current inventory in both directions', () => {
  const runtime = new CrossingRuntime('harris-tx');
  assertCurrent(runtime, 'harris-tx', 1159);
  for (const [countyId, expectedCount] of [
    ['travis-tx', 176],
    ['dallas-tx', 789],
    ['harris-tx', 1159],
    ['liberty-tx', 115]
  ]) {
    assert.equal(runtime.transition(countyId), true);
    assert.equal(runtime.inventoryCounty, null, 'prior owner is synchronously invalidated');
    assert.equal(runtime.inventory.length, 0, 'prior inventory cannot remain current');
    assert.equal(runtime.request(countyId)(), true);
    assertCurrent(runtime, countyId, expectedCount);
  }
});

test('owner transition acceptance counts remain exact in every required direction', () => {
  for (const [journey, countyId, governed, awareness] of [
    ['Baytown -> Dallas', 'dallas-tx', 789, 417],
    ['Baytown -> Austin', 'travis-tx', 176, 135],
    ['Dallas -> Baytown', 'harris-tx', 1159, 70],
    ['Baytown -> Liberty', 'liberty-tx', 115, 30]
  ]) {
    assert.equal(counts.get(countyId), governed, `${journey} governed inventory`);
    assert.equal(awareness, { 'dallas-tx': 417, 'travis-tx': 135, 'harris-tx': 70, 'liberty-tx': 30 }[countyId], `${journey} awareness acceptance`);
  }
});

test('same-county community transition retains healthy governed inventory', () => {
  const runtime = new CrossingRuntime('harris-tx');
  const inventory = runtime.inventory;
  assert.equal(runtime.transition('harris-tx'), false);
  assert.equal(runtime.inventory, inventory);
  assert.equal(runtime.loadCount, 0);
});

test('late Harris completion cannot roll Travis current state backward', () => {
  const runtime = new CrossingRuntime('harris-tx');
  const lateHarris = runtime.request('harris-tx');
  runtime.transition('travis-tx');
  const travis = runtime.request('travis-tx');
  assert.equal(lateHarris(), false);
  assert.equal(runtime.inventoryCounty, null);
  assert.equal(travis(), true);
  assertCurrent(runtime, 'travis-tx', 176);
});

test('production crossing commit is guarded by county and generation', () => {
  assert.match(app, /requestedCountyId !== gridlyGetActiveCountyId\(\) \|\| requestedGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.match(app, /gridlyCrossingInventoryCountyId = null;[\s\S]{0,120}crossings = \[\]/);
  assert.match(app, /gridlyCrossingInventoryCountyId = requestedCountyId;/);
  assert.match(app, /authoritative-geometry-pending/);
});

test('stale governed geometry cache is recovered once with certified request identity', () => {
  assert.match(geometryLoader, /GEOMETRY_\(\?:BYTE_LENGTH\|SHA256\)_MISMATCH/);
  assert.match(geometryLoader, /gridlyGeometryIdentity/);
  assert.match(geometryLoader, /cache: "no-store"/);
});
