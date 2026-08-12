import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { EXPECTED_FIPS, SCHEMA, classifyBytes, governedExpectations, parseArguments, probe, readiness, verifyOwnerEvidence } from '../scripts/lp1901-owner-remote-payload-recovery-probe.mjs';

const ROOT = process.cwd();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const audit = JSON.parse(await readFile('reports/lp190/restricted-county-lp130-recovery-audit.json', 'utf8'));
const expectations = await governedExpectations();

test('governed expectations use the exact restricted set and proven LP147 keys', () => {
  assert.deepEqual(expectations.map(x => x.countyFips), EXPECTED_FIPS);
  for (const row of expectations) assert.equal(row.remoteObjectKey, `lp104/txgio-addresses/${row.lp130ExpectedArtifact.split('/').at(-1)}`);
  assert.deepEqual(parseArguments(['--whatif', '--json']), { mode: 'whatif', json: true });
});

test('WHATIF works without credentials and promises no write or activation', () => {
  const result = spawnSync(process.execPath, ['scripts/lp1901-owner-remote-payload-recovery-probe.mjs', '--whatif', '--json'], { encoding: 'utf8', env: {} });
  assert.equal(result.status, 0); const value = JSON.parse(result.stdout);
  assert.equal(value.counties.length, 11); assert.equal(value.productionWriteWillOccur, false); assert.equal(value.countyActivationWillOccur, false);
});

test('PROBE fails closed without owner credentials', async () => {
  const result = await probe(expectations, {}, { noWrite: true });
  assert.ok(result.counties.every(x => x.classification === 'OWNER_CREDENTIALS_REQUIRED'));
  const cli = spawnSync(process.execPath, ['scripts/lp1901-owner-remote-payload-recovery-probe.mjs', '--probe', '--json'], { encoding: 'utf8', env: {} });
  assert.notEqual(cli.status, 0);
});

test('metadata presence is never promoted to an exact byte match', async () => {
  const fetchImpl = async () => new Response(null, { status: 200, headers: { 'content-length': String(expectations[0].expectedByteLength), etag: 'not-a-sha-contract' } });
  const result = await probe([expectations[0]], { SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'secret' }, { fetchImpl, attempts: 1, noWrite: true });
  assert.equal(result.counties[0].classification, 'REMOTE_OBJECT_PRESENT_METADATA_MATCH');
  assert.notEqual(result.counties[0].classification, 'REMOTE_OBJECT_EXACT_MATCH');
});

test('exact byte classification requires both governed length and SHA-256', () => {
  const good = Buffer.from('governed'); const item = { expectedByteLength: good.length, expectedSha256: sha(good) };
  assert.equal(classifyBytes(item, good).classification, 'REMOTE_OBJECT_EXACT_MATCH');
  assert.equal(classifyBytes({ ...item, expectedByteLength: good.length + 1 }, good).classification, 'REMOTE_OBJECT_BYTE_LENGTH_MISMATCH');
  assert.equal(classifyBytes({ ...item, expectedSha256: '0'.repeat(64) }, good).classification, 'REMOTE_OBJECT_SHA256_MISMATCH');
  assert.equal(readiness({ counties: [{ classification: 'REMOTE_OBJECT_PRESENT_METADATA_MATCH' }] }).aggregate.exactMatches, 0);
});

test('owner evidence paths are precisely ignored and governed payload target remains separate', () => {
  for (const path of ['evidence/lp1901/owner-remote-payload-probe.local.json', 'evidence/lp1901/recovered-payloads.local/test.gz']) {
    const checked = spawnSync('git', ['check-ignore', '-q', path]); assert.equal(checked.status, 0, `${path} must be ignored`);
  }
  assert.equal(spawnSync('git', ['check-ignore', '-q', 'reports/lp1901/restricted-county-remote-recovery-readiness.json']).status, 1);
  for (const row of expectations) assert.notEqual(`evidence/lp1901/recovered-payloads.local/${row.lp130ExpectedArtifact.split('/').at(-1)}`, row.lp130ExpectedArtifact);
});

test('verification recomputes quarantined bytes and rejects post-recovery mutation', async () => {
  const directory = join(ROOT, 'evidence/lp1901/recovered-payloads.local'); const evidencePath = join(ROOT, 'evidence/lp1901/owner-remote-payload-probe.local.json');
  await mkdir(directory, { recursive: true });
  try {
    const counties = [];
    for (const source of audit.counties) {
      const bytes = Buffer.from(`fixture-${source.countyFips}`); const name = source.lp130ExpectedArtifact.split('/').at(-1); await writeFile(join(directory, name), bytes);
      counties.push({ ...expectations.find(x => x.countyFips === source.countyFips), expectedByteLength: bytes.length, expectedSha256: sha(bytes), actualByteLength: bytes.length, actualSha256: sha(bytes), classification: 'REMOTE_OBJECT_EXACT_MATCH', quarantinedLocalPath: `evidence/lp1901/recovered-payloads.local/${name}` });
    }
    const fixtureAudit = join(directory, 'audit.json'); await writeFile(fixtureAudit, JSON.stringify({ counties: counties.map(x => ({ countyFips: x.countyFips, countyName: x.countyName, lp130ExpectedArtifact: x.lp130ExpectedArtifact, expectedByteLength: x.expectedByteLength, expectedSha256: x.expectedSha256 })) }));
    const fixtureExpectations = await governedExpectations(fixtureAudit); await writeFile(evidencePath, JSON.stringify({ schemaVersion: SCHEMA, counties }));
    assert.equal((await verifyOwnerEvidence(fixtureExpectations, { evidencePath })).aggregate.exactMatches, 11);
    await writeFile(join(directory, counties[0].lp130ExpectedArtifact.split('/').at(-1)), 'changed');
    await assert.rejects(verifyOwnerEvidence(fixtureExpectations, { evidencePath }), /identity changed/);
  } finally { await rm(evidencePath, { force: true }); await rm(directory, { recursive: true, force: true }); }
});

test('protected canonical Git blobs and the 243/11 runtime remain unchanged', () => {
  const protectedPaths = ['js/app.js','assets/package-registry/runtime-package-registry.json','js/gridlyPackageRegistry.js','assets/location-resolution/gridly-authoritative-county-geometry-v1.json','assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json'];
  for (const path of protectedPaths) assert.equal(execFileSync('git', ['rev-parse', `HEAD:${path}`], { encoding: 'utf8' }).trim(), audit.protectedProduction.files[path].expectedGitBlob);
  const report = JSON.parse(execFileSync(process.execPath, ['tools/lp190-verify-restricted-county-recovery-audit.mjs'], { encoding: 'utf8' }));
  assert.equal(report.operationalCountyCount, 243); assert.equal(report.restrictedCountyCount, 11); assert.equal(report.protectedProductionSurfaceChanges, 0);
});
