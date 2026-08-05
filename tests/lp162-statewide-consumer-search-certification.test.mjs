import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { buildReports, serialize, verify } from '../tools/lp162-certify-statewide-consumer-search.mjs';

const summaryPath = 'reports/lp162/lp162-summary.json';

test('evaluates all counties independently and discloses address blockers', () => {
  const reports = buildReports();
  const inventory = reports['reports/lp162/statewide-consumer-search-inventory.json'];
  const address = reports['reports/lp162/address-search-certification.json'];
  const destination = reports['reports/lp162/destination-search-certification.json'];
  const summary = reports[summaryPath];
  assert.equal(inventory.countyCount, 254);
  assert.equal(inventory.uniqueFipsCount, 254);
  assert.equal(inventory.deterministicFipsOrdering, true);
  assert.equal(address.counties.length, 254);
  assert.equal(address.passCount + address.failCount, 254);
  assert.ok(address.failCount > 0, 'unresolved address evidence must not become PASS');
  assert.equal(destination.passCount, 254);
  assert.equal(summary.finalClassification, 'CONDITIONALLY_CERTIFIED_ADDRESS_BLOCKERS_REMAIN');
});

test('certifies required cohort, categories, isolation, and Liberty truthfulness', () => {
  const reports = buildReports();
  assert.equal(reports['reports/lp162/representative-county-search-report.json'].countiesEvaluated, 16);
  assert.equal(reports['reports/lp162/category-search-certification.json'].categoryChecks.length, 17);
  assert.ok(reports['reports/lp162/cross-county-isolation-report.json'].scenariosEvaluated > 0);
  const liberty = reports['reports/lp162/liberty-search-preservation-report.json'];
  assert.equal(liberty.unresolvedSourceConflict.query, '274 County Road 677');
  assert.equal(liberty.unresolvedSourceConflict.resultManufacturedOrInferred, false);
});

test('builds are byte-identical and returned reports do not leak mutable state', () => {
  const first = buildReports();
  const expected = serialize(first);
  first[summaryPath].resultClasses.push('MUTATION');
  const second = buildReports();
  assert.equal(serialize(second), expected);
  const verified = verify();
  verified.resultClasses.push('MUTATION');
  assert.doesNotThrow(() => verify());
});

test('default CLI is read-only and drift exits nonzero', () => {
  const before = readFileSync(summaryPath, 'utf8');
  execFileSync(process.execPath, ['tools/lp162-certify-statewide-consumer-search.mjs']);
  assert.equal(readFileSync(summaryPath, 'utf8'), before);
  writeFileSync(summaryPath, `${before.trim()}\nDRIFT\n`);
  try {
    const result = spawnSync(process.execPath, ['tools/lp162-certify-statewide-consumer-search.mjs'], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /deterministic drift/);
    assert.equal(readFileSync(summaryPath, 'utf8'), `${before.trim()}\nDRIFT\n`);
  } finally { writeFileSync(summaryPath, before); }
});
