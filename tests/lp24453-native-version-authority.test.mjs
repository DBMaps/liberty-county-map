import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { composeProductionRuntimeConfig } from '../tools/lp1831/prepare-cloudflare-preview-artifact.mjs';
import { communitySubmissionContract, verifyCommunitySubmissionBundle, readConsumerScriptManifest } from '../tools/native-web.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(join(root, path));
async function isolated(t) {
  const directory = await mkdtemp(join(tmpdir(), 'gridly-lp24453-'));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('current configured native CLI accepts independent script revisions and verifies final bytes', async t => {
  const directory = await isolated(t);
  const destination = join(directory, 'web');
  const configFile = join(directory, 'provider.json');
  const reportFile = join(directory, 'identity.json');
  const overlay = Buffer.from(JSON.stringify({ arcgisStaticBasemapApiKey: 'lp24453-test-arcgis', driveTexas: { apiKey: 'lp24453-test-roadways' } }));
  await writeFile(configFile, overlay);
  const run = args => execFileSync(process.execPath, [join(root, 'tools/native-web.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  run(['--output', destination, '--runtime-config-file', configFile, '--report-file', reportFile]);
  assert.match(run(['--verify', '--output', destination, '--report-file', reportFile]), /Native web stage verified:/);
  const contract = await verifyCommunitySubmissionBundle(destination);
  assert.equal(contract.scripts[0], 'js/gridly-report-protocol.js?v=lp244.33-google-play-compliance');
  assert.equal(contract.scripts[1], 'js/app.js?v=lp24448-awareness');
  assert.notEqual(new URL(contract.scripts[1], 'https://gridly.invalid/').searchParams.get('v'), contract.version);
  assert.deepEqual(await communitySubmissionContract(destination), contract);
  const manifest = await readConsumerScriptManifest(root);
  assert.ok(manifest.startupScripts.includes('js/gridly-map-visibility.js?v=lp24448f2'));
  for (const path of ['consumer-script-manifest.json', 'js/app.js', 'js/gridly-map-visibility.js', 'service-worker.js']) {
    assert.deepEqual(await readFile(join(destination, path)), await read(path), path);
  }
  assert.deepEqual(await readFile(join(destination, 'js/gridlyRuntimeEnvironmentConfig.js')),
    composeProductionRuntimeConfig(await read('js/gridlyRuntimeEnvironmentConfig.js'), overlay));
  const index = (await read('index.html')).toString();
  const expectedIndex = index
    .replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'vendor/leaflet/leaflet.css')
    .replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'vendor/leaflet/leaflet.js')
    .replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'vendor/supabase/supabase.js');
  assert.equal(await readFile(join(destination, 'index.html'), 'utf8'), expectedIndex);
  const report = JSON.parse(await readFile(reportFile, 'utf8'));
  assert.match(report.bundleDigest, /^sha256:[a-f0-9]{64}$/);
  await writeFile(reportFile, JSON.stringify({ ...report, bundleDigest: 'sha256:stale' }));
  assert.throws(() => run(['--verify', '--output', destination, '--report-file', reportFile]), /Native configured bundle identity report mismatch/);
});

test('submission guard still rejects changed queries, missing/reordered scripts, retired bytes and stale records', async t => {
  const directory = await isolated(t);
  for (const path of ['index.html', 'js/app.js', 'js/gridly-report-protocol.js', 'js/gridlyPackageRegistry.js', 'service-worker.js']) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await copyFile(join(root, path), join(directory, path));
  }
  const contract = await communitySubmissionContract(directory);
  const index = await readFile(join(directory, 'index.html'), 'utf8');
  const [protocol, app] = contract.scripts;
  for (const mutated of [
    index.replace(app, app.replace('lp24448-awareness', contract.version)),
    index.replace(protocol, protocol.replace(contract.version, 'retired')),
    index.replace(`<script src="${protocol}"></script>`, ''),
    index.replace(protocol, '__APP__').replace(app, protocol).replace('__APP__', app)
  ]) {
    await writeFile(join(directory, 'index.html'), mutated);
    await assert.rejects(communitySubmissionContract(directory), /Submission protocol must precede the current app bundle/);
  }
  await writeFile(join(directory, 'index.html'), index);
  for (const path of Object.keys(contract.runtime)) {
    const original = await readFile(join(directory, path));
    await writeFile(join(directory, path), Buffer.concat([original, Buffer.from('\n// stale client') ]));
    await assert.rejects(communitySubmissionContract(directory), /Retired or mismatched submission client/);
    await writeFile(join(directory, path), original);
  }
  await writeFile(join(directory, 'community-submission-contract.json'), JSON.stringify({ ...contract, version: 'stale' }));
  await assert.rejects(verifyCommunitySubmissionBundle(directory), /Submission bundle manifest is stale/);
});

test('consumer manifest still rejects URL drift, order drift and omitted map visibility', async t => {
  const directory = await isolated(t);
  const manifest = JSON.parse((await read('consumer-script-manifest.json')).toString());
  await copyFile(join(root, 'index.html'), join(directory, 'index.html'));
  for (const transform of [
    scripts => scripts.map(src => src.replace('lp24448f2', 'stale')),
    scripts => [...scripts].reverse(),
    scripts => scripts.filter(src => !src.startsWith('js/gridly-map-visibility.js'))
  ]) {
    await writeFile(join(directory, 'consumer-script-manifest.json'), JSON.stringify({ ...manifest, startupScripts: transform(manifest.startupScripts) }));
    await assert.rejects(readConsumerScriptManifest(directory), /Consumer startup scripts differ from the governed manifest or order/);
  }
});
