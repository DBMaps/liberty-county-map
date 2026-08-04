import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAudit } from '../tools/lp131/audit-statewide-readiness.mjs';

const committed = JSON.parse(await readFile(new URL('../evidence/lp131/statewide-readiness-audit.json', import.meta.url)));

test('LP131 deterministically inventories all Texas counties', async () => {
  const built = await buildAudit();
  assert.deepEqual(built, committed);
  assert.equal(built.counties.length, 254);
  assert.equal(new Set(built.counties.map(x => x.fips)).size, 254);
  assert.ok(built.counties.every(x => x.activationBlocker && x.tier));
});

test('audit preserves candidate and runtime boundaries', () => {
  assert.equal(committed.summary.addressPackages, 254);
  assert.equal(committed.counties.filter(x => x.address.integrity === 'PASS').length, 254);
  assert.equal(committed.counties.filter(x => x.search.address).length, 1);
  assert.ok(committed.counties.every(x => x.activationEligible === (x.runtime === 'PRODUCTION_READY')));
  assert.equal(committed.auditOnly, true);
});

test('summary, gaps, and tiers reconcile to county rows', () => {
  assert.equal(Object.values(committed.tiers).reduce((a, b) => a + b, 0), 254);
  assert.equal(committed.summary.certificationBlocked, 14);
  assert.equal(committed.gaps.certificationBlockedCounties, 14);
  assert.equal(committed.summary.communities, committed.counties.reduce((n, x) => n + x.communities.count, 0));
  assert.equal(committed.summary.destinations, committed.counties.reduce((n, x) => n + x.destinations.count, 0));
  assert.equal(committed.summary.crossings, committed.counties.reduce((n, x) => n + x.crossings.count, 0));
});
