#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { composeProductionRuntimeConfig } from './lp1831/prepare-cloudflare-preview-artifact.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : 'www');
const entries = ['index.html', 'manifest.json', 'service-worker.js', 'css', 'js', 'assets', 'data', 'poi', 'Community-Packages', 'Crossing-Packages'];
const prohibited = [/(^|\/)node_modules\//, /(^|\/)(tests|tools|reports|evidence|owner-local)\//, /(^|\/)android\//, /(^|\/)ios\//, /(^|\/)[^/]*\.local\.js$/];
const runtimeConfigPath = 'js/gridlyRuntimeEnvironmentConfig.js';
const vendorAssets = [
  ['node_modules/leaflet/dist/leaflet.js', 'vendor/leaflet/leaflet.js'],
  ['node_modules/leaflet/dist/leaflet.css', 'vendor/leaflet/leaflet.css'],
  ['node_modules/leaflet/dist/images/marker-icon.png', 'vendor/leaflet/images/marker-icon.png'],
  ['node_modules/leaflet/dist/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-icon-2x.png'],
  ['node_modules/leaflet/dist/images/marker-shadow.png', 'vendor/leaflet/images/marker-shadow.png'],
  ['node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'vendor/supabase/supabase.js']
];
const nativeStartupReplacements = [
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'vendor/leaflet/leaflet.css'],
  ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'vendor/leaflet/leaflet.js'],
  ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 'vendor/supabase/supabase.js']
];

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`${name} requires a value.`);
  return resolve(process.argv[index + 1]);
}

export async function stage(destination, { runtimeConfigFile } = {}) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const entry of entries) await cp(join(root, entry), join(destination, entry), {
    recursive: true,
    preserveTimestamps: false,
    filter: (source) => {
      const path = relative(root, source).replaceAll('\\', '/');
      return !prohibited.some((pattern) => pattern.test(path));
    }
  });
  for (const [source, target] of vendorAssets) {
    await mkdir(dirname(join(destination, target)), { recursive: true });
    await cp(join(root, source), join(destination, target), { preserveTimestamps: false });
  }
  const stagedIndexPath = join(destination, 'index.html');
  let stagedIndex = await readFile(stagedIndexPath, 'utf8');
  for (const [remote, local] of nativeStartupReplacements) {
    if (!stagedIndex.includes(remote)) throw new Error(`Native startup authority missing from source index: ${remote}`);
    stagedIndex = stagedIndex.replace(remote, local);
  }
  await writeFile(stagedIndexPath, stagedIndex);
  if (runtimeConfigFile) {
    const ownerInput = resolve(runtimeConfigFile);
    if (ownerInput.startsWith(`${destination}/`) || ownerInput === resolve(root, runtimeConfigPath)) throw new Error('Native runtime config input must be external to the output and canonical config.');
    const composed = composeProductionRuntimeConfig(await readFile(join(root, runtimeConfigPath)), await readFile(ownerInput));
    await writeFile(join(destination, runtimeConfigPath), composed);
  }
}

async function files(directory) {
  const result = [];
  async function walk(current) {
    for (const name of (await readdir(current)).sort()) {
      const path = join(current, name);
      const info = await stat(path);
      if (info.isDirectory()) await walk(path); else result.push(relative(directory, path).replaceAll('\\', '/'));
    }
  }
  await walk(directory);
  return result;
}

async function identity(directory) {
  const hash = createHash('sha256');
  const records = [];
  for (const file of await files(directory)) {
    const bytes = await readFile(join(directory, file));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    records.push({ path: file, bytes: bytes.length, sha256 });
    hash.update(`${file}\0${bytes.length}\0${sha256}\n`);
  }
  return { digest: `sha256:${hash.digest('hex')}`, files: records };
}

async function verify(directory, { reportFile } = {}) {
  const required = [
    'index.html', 'manifest.json', 'service-worker.js', 'css', 'js', 'assets', 'data', 'poi',
    'Community-Packages', 'Crossing-Packages',
    ...vendorAssets.map(([, target]) => target),
    'poi/lp24111-d5-standalone-2026-08-28/runtime-v2/manifest.json',
    'poi/lp24111-d5-standalone-2026-08-28/legal/THIRD-PARTY-NOTICES.txt',
    'poi/lp24111-d5-standalone-2026-08-28/legal/foursquare/NOTICE.txt'
  ];
  for (const item of required) await stat(join(directory, item));
  const paths = await files(directory);
  const shards = paths.filter((path) => path.startsWith('poi/lp24111-d5-standalone-2026-08-28/runtime-v2/') && path.endsWith('.json.gz'));
  if (shards.length !== 86) throw new Error(`Expected exactly 86 POI runtime-v2 shards; found ${shards.length}.`);
  const forbidden = paths.filter((path) => prohibited.some((pattern) => pattern.test(path)));
  if (forbidden.length) throw new Error(`Prohibited native web files: ${forbidden.join(', ')}`);

  const temporary = join(tmpdir(), `gridly-native-web-${process.pid}`);
  try {
    const actual = await identity(directory);
    if (reportFile) {
      const report = JSON.parse(await readFile(reportFile, 'utf8'));
      if (report.bundleDigest !== actual.digest || JSON.stringify(report.files) !== JSON.stringify(actual.files)) throw new Error('Native configured bundle identity report mismatch.');
    } else {
      await stage(temporary);
      const repeated = await identity(temporary);
      if (actual.digest !== repeated.digest) throw new Error(`Staged web identity differs from a clean repeat (${actual.digest} != ${repeated.digest}).`);
    }
    console.log(`Native web stage verified: ${paths.length} files, 86 POI shards, digest ${actual.digest}`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

const runtimeConfigFile = option('--runtime-config-file');
const reportFile = option('--report-file');
if (process.argv.includes('--verify')) await verify(output, { reportFile }); else {
  await stage(output, { runtimeConfigFile });
  if (runtimeConfigFile) {
    if (!reportFile) throw new Error('--report-file is required with --runtime-config-file.');
    const attestation = await identity(output);
    const runtimeBytes = await readFile(join(output, runtimeConfigPath));
    const report = {
      schemaVersion: 'gridly.nativeConfiguredWebBundle.v1',
      candidateGitSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      bundleDigest: attestation.digest,
      runtimeConfig: { path: runtimeConfigPath, bytes: runtimeBytes.length, sha256: createHash('sha256').update(runtimeBytes).digest('hex'), classification: 'OWNER_COMPOSED_BROWSER_PUBLIC_CONFIG' },
      files: attestation.files
    };
    await mkdir(dirname(reportFile), { recursive: true });
    await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`Staged Gridly native web bundle at ${relative(root, output) || '.'}.`);
}
