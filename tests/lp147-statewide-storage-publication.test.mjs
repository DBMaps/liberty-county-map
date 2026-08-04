import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import countyManifest from '../data/lp104/texas-counties.json' with { type: 'json' };
import { certificateFor } from '../tools/lp107/generate-runtime-certificates.mjs';
import { buildLocalInventory, discoverAuthoritativeCertificates, parseArguments, run } from '../tools/lp147/publish-statewide-storage.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'lp147-'));
  const certificateRoot = join(directory, 'lp130');
  const expansionDirectory = join(certificateRoot, 'batch-01', 'certificates');
  await mkdir(expansionDirectory, { recursive: true });
  const operationalFips = new Set(countyManifest.counties.filter(item => item.certificationCohort === 'initial28').map(item => item.fips));
  const identities = countyManifest.counties.map(item => {
    const packageName = `${item.countyId}-${item.fips}.addresses.jsonl.gz`;
    const bytes = Buffer.from(`certified package ${item.fips}`);
    return { fips: item.fips, countyId: item.countyId, countyName: item.countyName, packageName, sizeBytes: bytes.length, sha256: hash(bytes), bytes };
  });
  for (const identity of identities) {
    const operational = operationalFips.has(identity.fips);
    const certificate = { ...certificateFor({ slug: identity.countyId, name: identity.countyName, fips: identity.fips }, identity.packageName, identity.sizeBytes, identity.sha256), milestone: operational ? 'LP104.5' : 'LP105.1-candidate' };
    const path = join(operational ? directory : expansionDirectory, identity.packageName.replace('.addresses.jsonl.gz', '.runtime-certificate.json'));
    await writeFile(path, `${JSON.stringify(certificate, null, 2)}\n`);
  }
  for (const fips of ['48001', '48015']) {
    const identity = identities.find(item => item.fips === fips); await writeFile(join(directory, identity.packageName), identity.bytes);
  }
  return { directory, certificateRoot, expansionDirectory, operationalFips, identities,
    hooks: { certificateRoot, reconciliation: { packageInventory: identities }, manifest: countyManifest } };
}
const cleanup = value => rm(value.directory, { recursive: true, force: true });
const certName = identity => identity.packageName.replace('.addresses.jsonl.gz', '.runtime-certificate.json');

test('LP147 modes are explicit and replacement stays guarded', () => {
  assert.deepEqual(parseArguments(['--plan']), { plan: true });
  assert.throws(() => parseArguments([]), /exactly one/);
  assert.throws(() => parseArguments(['--upload', '--verify-remote']), /exactly one/);
  assert.throws(() => parseArguments(['--verify-remote', '--replace-mismatched']), /requires --upload/);
});

test('authoritative merge resolves 28 operational and 226 expansion certificates', async () => {
  const value = await fixture();
  try {
    const found = await discoverAuthoritativeCertificates(value.identities, value.operationalFips, { packageDirectory: value.directory, certificateRoot: value.certificateRoot });
    assert.equal(found.size, 254);
    assert.deepEqual([...found.values()].reduce((counts, item) => ({ ...counts, [item.source]: counts[item.source] + 1 }), { operational: 0, expansion: 0 }), { operational: 28, expansion: 226 });
    assert.equal(basename(found.get('48015').path), 'austin-48015.runtime-certificate.json');
    assert.equal(basename(dirname(found.get('48015').path)), basename(value.directory));
    assert.equal(basename(found.get('48001').path), 'anderson-48001.runtime-certificate.json');
    assert.equal(basename(dirname(found.get('48001').path)), 'certificates');
    assert.equal(basename(dirname(dirname(found.get('48001').path))), 'batch-01');
    assert.equal(new Set(found.keys()).size, 254);
  } finally { await cleanup(value); }
});

test('LP105.1 historical copies are ignored', async () => {
  const value = await fixture();
  try {
    const historical = join(value.directory, 'lp1051', 'certificates'); await mkdir(historical, { recursive: true });
    await writeFile(join(historical, 'anderson-48001.runtime-certificate.json'), 'ignored historical bytes');
    const found = await discoverAuthoritativeCertificates(value.identities, value.operationalFips, { packageDirectory: value.directory, certificateRoot: value.certificateRoot });
    assert.equal(found.size, 254);
  } finally { await cleanup(value); }
});

test('missing operational and expansion certificates fail closed', async () => {
  for (const [fips, pattern] of [['48015', /required operational certificate unavailable/], ['48001', /required expansion certificate unavailable/]]) {
    const value = await fixture();
    try {
      const identity = value.identities.find(item => item.fips === fips);
      await rm(join(value.operationalFips.has(fips) ? value.directory : value.expansionDirectory, certName(identity)));
      await assert.rejects(discoverAuthoritativeCertificates(value.identities, value.operationalFips, { packageDirectory: value.directory, certificateRoot: value.certificateRoot }), pattern);
    } finally { await cleanup(value); }
  }
});

test('cross-source duplicate and wrong-source certificates fail closed', async () => {
  const value = await fixture();
  try {
    const austin = value.identities.find(item => item.fips === '48015');
    await writeFile(join(value.expansionDirectory, certName(austin)), await readFile(join(value.directory, certName(austin))));
    await assert.rejects(discoverAuthoritativeCertificates(value.identities, value.operationalFips, { packageDirectory: value.directory, certificateRoot: value.certificateRoot }), /same FIPS appears in both/);
  } finally { await cleanup(value); }
});

test('local preflight requires package byte/SHA identity and preserves remote paths', async () => {
  const value = await fixture();
  try {
    for (const [fips, source] of [['48001', 'expansion'], ['48015', 'operational']]) {
      const inventory = await buildLocalInventory({ countyFips: fips, packageDirectory: value.directory }, value.hooks);
      assert.equal(inventory[0].certificateSource, source);
      assert.equal(inventory[0].certificateRemotePath, `lp104/txgio-addresses/${certName(value.identities.find(item => item.fips === fips))}`);
    }
    const anderson = value.identities.find(item => item.fips === '48001');
    await writeFile(join(value.directory, anderson.packageName), Buffer.alloc(anderson.sizeBytes, 1));
    await assert.rejects(buildLocalInventory({ countyFips: '48001', packageDirectory: value.directory }, value.hooks), /package identity mismatch/);
  } finally { await cleanup(value); }
});

test('certificate byte-count and SHA mismatches fail closed without regeneration', async () => {
  for (const field of ['sizeBytes', 'sha256']) {
    const value = await fixture();
    try {
      const identity = value.identities.find(item => item.fips === '48001'); const path = join(value.expansionDirectory, certName(identity));
      const certificate = JSON.parse(await readFile(path)); certificate[field] = field === 'sizeBytes' ? certificate.sizeBytes + 1 : '0'.repeat(64); await writeFile(path, JSON.stringify(certificate));
      await assert.rejects(buildLocalInventory({ countyFips: '48001', packageDirectory: value.directory }, value.hooks), new RegExp(`certificate ${field} mismatch`));
    } finally { await cleanup(value); }
  }
});

test('plan is local-only and records both governed source cohorts with no writes', async () => {
  const value = await fixture(); const reportPath = join(value.directory, 'plan.json');
  try {
    const report = await run({ plan: true, countyFips: '48015', packageDirectory: value.directory, reportPath }, value.hooks);
    assert.equal(report.objects.length, 2); assert.equal(report.localPreflight.operationalCertificateSources, 1);
    assert.equal(report.localPreflight.writesPerformed, 0); assert.deepEqual(JSON.parse(await readFile(reportPath, 'utf8')), report);
  } finally { await cleanup(value); }
});

test('six governed restorations preserve approved source bytes and package identities', async () => {
  const report = JSON.parse(await readFile(join(process.cwd(), 'reports/lp147/lp130-certificate-restoration.json')));
  assert.deepEqual(report.summary, { expectedRestorations: 6, completedRestorations: 6, validationFailures: 0, conflictingSourceCopies: 0, regeneratedCertificates: 0 });
  assert.deepEqual(report.restorations.map(item => item.fips), ['48051', '48287', '48331', '48395', '48455', '48469']);
  for (const item of report.restorations) {
    const [source, destination, packageBytes] = await Promise.all([readFile(item.sourcePath), readFile(item.destinationPath), readFile(item.packagePath)]);
    assert.deepEqual(destination, source);
    assert.equal(destination.byteLength, source.byteLength); assert.equal(hash(destination), hash(source));
    assert.equal(packageBytes.byteLength, item.packageBytes); assert.equal(hash(packageBytes), item.packageSha256);
    const certificate = JSON.parse(destination);
    assert.equal(certificate.fips, item.fips); assert.equal(certificate.artifact, item.packagePath.split('/').at(-1));
    assert.equal(certificate.sizeBytes, packageBytes.byteLength); assert.equal(certificate.sha256, hash(packageBytes));
    assert.deepEqual(certificate.acceptance, { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false });
    assert.equal(item.bytePreserved, true); assert.equal(item.regenerated, false);
  }
  const expected = countyManifest.counties.map(item => ({ fips: item.fips, countyId: item.countyId }));
  const operationalFips = new Set(countyManifest.counties.filter(item => item.certificationCohort === 'initial28').map(item => item.fips));
  const inventory = await discoverAuthoritativeCertificates(expected, operationalFips);
  assert.equal([...inventory.values()].filter(item => item.source === 'expansion').length, 226);
  assert.equal(inventory.size, 254);
});
