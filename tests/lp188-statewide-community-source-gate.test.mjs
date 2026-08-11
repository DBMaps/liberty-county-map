import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('LP188 fails closed when the authoritative statewide place source is absent', () => {
  execFileSync(process.execPath, ['tools/lp188/audit-statewide-community-source.mjs', 'verify']);
  const report = read('reports/lp188/statewide-community-source-gate.json');
  assert.equal(report.finalClassification, 'STATEWIDE_COMMUNITY_SOURCE_REQUIRED');
  assert.equal(report.decision.sourceGatePassed, false);
  assert.equal(report.decision.manufacturingStarted, false);
  assert.deepEqual(report.counts, { texasCounties:254, countyPackages:0, countywideFallbacks:0, canonicalPlaces:0, incorporatedPlaces:0, censusDesignatedPlaces:0, recognizedUnincorporatedCommunities:0, countyMemberships:0, multiCountyPlaces:0, duplicateDisplayNameGroups:0, certifiedCounties:0, failedCounties:254 });
  assert.equal(report.exactMissingSource.ownerActionRequired, true);
  assert.equal(report.restrictedCountyStatus.length, 11);
  assert.ok(report.restrictedCountyStatus.every(row => row.downstreamActivationBlocker === 'ADDRESS_RESTORATION_REQUIRED' && row.restrictionPreserved));
  assert.ok(Object.values(report.safety).every(value => value === false));
});

test('LP188 audit output is byte deterministic across isolated output captures', () => {
  const first = fs.readFileSync('reports/lp188/statewide-community-source-gate.json');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lp188-'));
  execFileSync(process.execPath, ['tools/lp188/audit-statewide-community-source.mjs', 'build']);
  fs.copyFileSync('reports/lp188/statewide-community-source-gate.json', path.join(temporary, 'pass-one.json'));
  execFileSync(process.execPath, ['tools/lp188/audit-statewide-community-source.mjs', 'build']);
  const second = fs.readFileSync('reports/lp188/statewide-community-source-gate.json');
  assert.deepEqual(second, fs.readFileSync(path.join(temporary, 'pass-one.json')));
  assert.deepEqual(second, first);
});
