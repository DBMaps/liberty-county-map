import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildStatewideCertification, countyCsv } from '../tools/lp135/build-statewide-certification.mjs';

const committed = JSON.parse(await readFile(new URL('../evidence/lp135/statewide-certification.json', import.meta.url)));

test('LP135 processes and exactly reconciles all Texas counties', async () => {
  const generated = await buildStatewideCertification();
  assert.deepEqual(generated, committed);
  assert.equal(generated.counties.length, 254);
  assert.equal(generated.summary.certified + generated.summary.certificationBlocked, 254);
  assert.equal(generated.summary.certificationPercentage, 95.67);
  assert.equal(new Set(generated.counties.map(item => item.fips)).size, 254);
});

test('LP135 gives every result evidence and every blocker deterministic remediation', () => {
  assert.ok(committed.counties.every(item => item.evidenceReference));
  const blocked = committed.counties.filter(item => item.certificationStatus === 'CERTIFICATION_BLOCKED');
  assert.equal(blocked.length, committed.summary.certificationBlocked);
  for (const item of blocked) {
    assert.equal(item.failureStage, 'PACKAGE_AVAILABILITY');
    assert.equal(item.primaryClassification, 'LOCAL_PACKAGE_UNAVAILABLE');
    assert.equal(item.packageRegenerationRequired, false);
    assert.ok(item.governingEvidence && item.recommendedCorrectiveAction && item.readinessImpact);
  }
});

test('LP135 locks the non-modification boundary and generated inventory', async () => {
  assert.equal(committed.regression.manufacturingArtifactsModified, false);
  assert.equal(committed.regression.runtimeArtifactsModified, false);
  assert.equal(committed.regression.deploymentModified, false);
  assert.equal(committed.regression.protectedSystemsModified, false);
  assert.equal(await readFile(new URL('../evidence/lp135/county-certification-inventory.csv', import.meta.url), 'utf8'), countyCsv(committed));
});
