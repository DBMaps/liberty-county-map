import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { EXPECTED_FIPS, governedExpectations } from '../scripts/lp1901-owner-remote-payload-recovery-probe.mjs';
import { buildReport, certifyTwice, digestFile, parseArguments, restoreCounty } from '../scripts/lp1902-restore-governed-payloads.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp1902-')); const quarantine = join(root, 'evidence/lp1901/recovered-payloads.local'); await mkdir(quarantine, { recursive: true });
  const bytes = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xde, 0xad, 0xbe, 0xef]);
  const row = { countyFips: '48061', countyName: 'Cameron', lp130ExpectedArtifact: 'data/generated/lp104/txgio-addresses/cameron-48061.addresses.jsonl.gz', expectedByteLength: bytes.length, expectedSha256: sha(bytes) };
  const source = join(quarantine, 'cameron-48061.addresses.jsonl.gz'); await writeFile(source, bytes); return { root, quarantine, bytes, row, target: join(root, row.lp130ExpectedArtifact) };
};

test('LP190.2 is bound to the exact governed 11-FIPS set and explicit modes', async () => {
  assert.deepEqual((await governedExpectations()).map(x => x.countyFips).sort(), EXPECTED_FIPS);
  assert.equal(parseArguments(['--apply', '--json']).mode, 'apply');
  assert.throws(() => parseArguments(['--apply', '--verify']));
});

test('apply copies the exact opaque bytes and recomputes target identity', async () => {
  const x = await fixture(); const result = await restoreCounty(x.row, 'apply', x);
  assert.equal(result.restorationClassification, 'RESTORED_EXACT');
  assert.deepEqual(await readFile(x.target), x.bytes);
  assert.deepEqual(await digestFile(x.target), { byteLength: x.bytes.length, sha256: sha(x.bytes) });
  assert.equal((await restoreCounty(x.row, 'apply', x)).restorationClassification, 'ALREADY_RESTORED_EXACT');
});

test('mismatched source and existing target fail closed without overwrite', async () => {
  const sourceCase = await fixture(); await writeFile(join(sourceCase.quarantine, 'cameron-48061.addresses.jsonl.gz'), Buffer.from('changed'));
  assert.equal((await restoreCounty(sourceCase.row, 'apply', sourceCase)).restorationClassification, 'SOURCE_IDENTITY_MISMATCH');
  const targetCase = await fixture(); await mkdir(join(targetCase.root, 'data/generated/lp104/txgio-addresses'), { recursive: true }); await writeFile(targetCase.target, 'do-not-overwrite');
  assert.equal((await restoreCounty(targetCase.row, 'apply', targetCase)).restorationClassification, 'TARGET_IDENTITY_MISMATCH_REFUSED');
  assert.equal(await readFile(targetCase.target, 'utf8'), 'do-not-overwrite');
});

test('two unchanged LP134 PASS runs and deterministic agreement are mandatory', async () => {
  const x = await fixture(); const restored = await restoreCounty(x.row, 'apply', x); let calls = 0;
  const certifier = async () => { calls += 1; return { certificationStatus: 'PASS', sha256: x.row.expectedSha256, packageSize: x.bytes.length, indexedAddressCount: 1, exactMatchStatistics: { sampled: 1, passed: 1, failed: 0 }, rejectionStatistics: {}, normalizationStatistics: {}, integrityStatistics: {}, failures: [], runtimeLoadDurationMs: calls }; };
  await certifyTwice([restored], { ...x, reportRoot: join(x.root, 'runs'), certifier });
  assert.equal(calls, 2); assert.equal(restored.lp134Deterministic, true); assert.equal(restored.restrictionCanBeCleared, true);
  const report = buildReport('certify-twice', Array.from({ length: 11 }, () => ({ ...restored })));
  assert.equal(report.aggregate.lp134DoublePassCount, 11); assert.equal(report.aggregate.safeForActivationReconciliation, true);
  assert.deepEqual(report.runtime, { operationalCountyCount: 243, restrictedCountyCount: 11, changed: false }); assert.equal(report.activationPerformed, false);
});

test('LP190.2 does not modify protected production surfaces', async () => {
  const changed = (await import('node:child_process')).execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const protectedPaths = ['js/app.js','assets/package-registry/runtime-package-registry.json','js/gridlyPackageRegistry.js','assets/location-resolution/gridly-authoritative-county-geometry-v1.json','assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json'];
  assert.deepEqual(changed.filter(x => protectedPaths.includes(x) || x.startsWith('Crossing-Packages/')), []);
});
