import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { certificateFor } from '../tools/lp107/generate-runtime-certificates.mjs';
import { buildLocalInventory, parseArguments, run } from '../tools/lp147/publish-statewide-storage.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'lp147-'));
  const bytes = Buffer.from('existing certified package bytes');
  const identity = { fips: '48001', countyId: 'anderson', packageName: 'anderson-48001.addresses.jsonl.gz', sizeBytes: bytes.length, sha256: hash(bytes) };
  const packageInventory = [identity, ...Array.from({ length: 253 }, (_, index) => ({ ...identity, fips: `x${index}` }))];
  await writeFile(join(directory, identity.packageName), bytes);
  const certificate = certificateFor({ slug: 'anderson', name: 'Anderson', fips: '48001' }, identity.packageName, bytes.length, hash(bytes));
  await writeFile(join(directory, 'anderson-48001.runtime-certificate.json'), `${JSON.stringify(certificate, null, 2)}\n`);
  return { directory, bytes, identity, hooks: { reconciliation: { packageInventory }, manifest: { counties: [{ fips: '48001', countyName: 'Anderson' }] } } };
}

test('LP147 modes are explicit and replacement stays guarded', () => {
  assert.deepEqual(parseArguments(['--plan']), { plan: true });
  assert.deepEqual(parseArguments(['--upload', '--county-fips', '48001']), { upload: true, countyFips: '48001' });
  assert.throws(() => parseArguments([]), /exactly one/);
  assert.throws(() => parseArguments(['--upload', '--verify-remote']), /exactly one/);
  assert.throws(() => parseArguments(['--verify-remote', '--replace-mismatched']), /requires --upload/);
});

test('local preflight accepts only byte-identical LP130 package and existing valid certificate', async () => {
  const value = await fixture();
  try {
    const inventory = await buildLocalInventory({ countyFips: '48001', packageDirectory: value.directory }, value.hooks);
    assert.equal(inventory.length, 1);
    assert.equal(inventory[0].objects.length, 2);
    await writeFile(join(value.directory, value.identity.packageName), 'modified');
    await assert.rejects(buildLocalInventory({ countyFips: '48001', packageDirectory: value.directory }, value.hooks), /identity mismatch/);
  } finally { await rm(value.directory, { recursive: true, force: true }); }
});

test('plan is local-only, creates two governed paths, and records no artifact modification', async () => {
  const value = await fixture(); const reportPath = join(value.directory, 'plan.json');
  try {
    const report = await run({ plan: true, countyFips: '48001', packageDirectory: value.directory, reportPath }, value.hooks);
    assert.equal(report.objects.length, 2);
    assert.ok(report.objects.every(item => item.path.startsWith('lp104/txgio-addresses/')));
    assert.equal(report.localArtifactsModified, false);
    assert.deepEqual(JSON.parse(await readFile(reportPath, 'utf8')), report);
  } finally { await rm(value.directory, { recursive: true, force: true }); }
});

test('remote verification independently downloads and hashes both expected objects', async () => {
  const value = await fixture(); const reportPath = join(value.directory, 'verify.json');
  try {
    const certificateBytes = await readFile(join(value.directory, 'anderson-48001.runtime-certificate.json'));
    const report = await run({ verifyRemote: true, countyFips: '48001', packageDirectory: value.directory, reportPath }, { ...value.hooks,
      env: { SUPABASE_URL: 'https://project.example', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fixture' }, attempts: 1,
      fetchImpl: async (url) => url.endsWith('/bucket/certified-addresses') ? new Response('{}') : new Response(url.endsWith('.json') ? certificateBytes : value.bytes) });
    assert.equal(report.outcome, 'STATEWIDE_STORAGE_VERIFIED');
    assert.deepEqual([report.totals.matching, report.totals.missing, report.totals.mismatched], [2, 0, 0]);
  } finally { await rm(value.directory, { recursive: true, force: true }); }
});
