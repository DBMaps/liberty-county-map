import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const evidence = await readJson('evidence/lp129/texas-address-expansion-wave-3-preflight.json');
const counties = await readJson('data/lp104/texas-counties.json');

async function exists(path) {
  return access(new URL(path, root)).then(() => true, () => false);
}

test('LP129 records a source-blocked audit for exactly the Wave 3 cohort', () => {
  assert.equal(evidence.status, 'BLOCKED_SOURCE_UNAVAILABLE');
  assert.equal(evidence.decision, 'DO_NOT_MANUFACTURE');
  assert.equal(evidence.baseline.slice(0, 8), '9ae36009');
  assert.deepEqual(evidence.counties.map(({ fips }) => fips), ['48051', '48455', '48469']);
  assert.deepEqual(evidence.counties.map(({ county }) => county), ['Burleson County', 'Trinity County', 'Victoria County']);
  assert.ok(evidence.counties.every(({ status }) => status === 'NOT_MANUFACTURED'));
});

test('LP129 cohort identities exist in the maintained Texas county manifest', () => {
  for (const expected of evidence.counties) {
    const actual = counties.counties.find(({ fips }) => fips === expected.fips);
    assert.deepEqual([actual.countyId, `${actual.countyName} County`], [expected.countyId, expected.county]);
  }
});

test('LP129 does not claim or commit manufactured county artifacts', async () => {
  for (const county of evidence.counties) {
    const stem = `${county.countyId}-${county.fips}`;
    assert.equal(await exists(`data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz`), false);
    assert.equal(await exists(`data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz.json`), false);
    assert.equal(await exists(`reports/lp129-wave-3/certificates/${stem}.runtime-certificate.json`), false);
    assert.equal(await exists(`reports/lp129-wave-3/certification/${stem}.certification.json`), false);
  }
});

test('LP129 preserves the production manifest and candidate-only boundaries', async () => {
  const production = await readFile(new URL('data/generated/lp104/txgio-addresses/runtime-manifest.json', root));
  assert.equal(createHash('sha256').update(production).digest('hex'), evidence.audit.productionRuntimeManifestSha256);
  assert.deepEqual(evidence.boundaries, {
    candidateOnly: true,
    candidateApproval: false,
    productionAuthorization: false,
    runtimeEligible: false,
    storageUploadOccurred: false,
    deploymentOccurred: false,
    runtimeActivated: false,
    protectedSystemsChanged: false,
    productionRuntimeManifestChanged: false
  });
});

test('LP129 resume command remains bounded to the selected cohort and inactive reports', () => {
  assert.match(evidence.authorizedResume.command, /--fips 48051,48455,48469/);
  assert.match(evidence.authorizedResume.command, /--reports reports\/lp129-wave-3/);
  assert.doesNotMatch(evidence.authorizedResume.command, /--gridly-counties/);
});
