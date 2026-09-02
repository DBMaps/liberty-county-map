#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { composeProductionRuntimeConfig } from './lp1831/prepare-cloudflare-preview-artifact.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : 'www');
// This is intentionally an allowlist.  These are consumer artifacts, not a list
// of things which happen not to be forbidden today.  Manufacturing trees remain
// in the repository, but can enter a native bundle only through this contract.
export const runtimePolicy = Object.freeze({
  trees: ['js'],
  files: [
    'index.html', 'manifest.json', 'service-worker.js', 'css/styles.css',
    'assets/UI', 'assets/desktop-gate', 'assets/icons', 'assets/markers', 'assets/onboarding',
    'assets/favicon-32.png', 'assets/gridly-header-compact.png',
    'assets/gridly-header-ultra-compact.png', 'assets/gridly-header-ultra-compact-fixed.png',
    'assets/gridly-logo-horizontal-lite-mode.png', 'assets/gridly-logo-primary.png',
    'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
    'assets/store/branding', 'assets/store/icons/gridly-icon-master-1024.png',
    'assets/package-registry/runtime-package-registry.json',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json',
    'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json',
    'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json',
    'data/gridly-consumer-zip-overrides-v1.json', 'data/gridly-crossing-review-overrides.json',
    'data/gridly-zip-awareness-index-v2.json', 'data/liberty-county-rail-crossings.geojson',
    'data/liberty-county-road-segments.geojson', 'data/roadway-runtime-manifest.json',
    'data/runtime', 'data/lp104/texas-county-coverage.json',
    'data/lp149/runtime-county-registry.json',
    'data/generated/gridly-statewide-consumer-zip-index-v1.json',
    'data/generated/gridly-statewide-place-presentation-v1.json'
  ]
});
const poiRelease = 'lp24111-d5-standalone-2026-08-28';
const poiRuntimeRelative = `poi/${poiRelease}/runtime-v2`;
const poiRuntimeSource = join(root, poiRuntimeRelative);
const daytonPhysicalCohort = Object.freeze(['tx-29-095', 'tx-29-096', 'tx-30-095', 'tx-30-096']);
export const prohibited = [
  /(^|\/)node_modules\//, /(^|\/)(tests|tools|reports|evidence|audit|certification|owner-local)\//,
  /(^|\/)(android|ios)\//, /(^|\/)[^/]*\.local\.js$/,
  /(^|\/)css\/styles\.backup-[^/]+\.css$/,
  /(?:^|\/)(?:county-sources|directional-intelligence|road-segments|source)(?:\/|$)/,
  /\.(?:shp|shx|dbf|prj|cpg)(?:\.|$)/i, /\.addresses\.jsonl$/
];
const governedSourcePathException = 'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson';
const isProhibited = (path) => path !== governedSourcePathException && prohibited.some((pattern) => pattern.test(path));
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
  const copyRuntime = async (entry) => {
    const normalized = entry.replaceAll('\\', '/');
    if (isProhibited(normalized)) throw new Error(`Runtime policy attempted to stage prohibited path: ${normalized}`);
    await mkdir(dirname(join(destination, normalized)), { recursive: true });
    await cp(join(root, normalized), join(destination, normalized), { recursive: true, preserveTimestamps: false });
  };
  for (const entry of [...runtimePolicy.trees, ...runtimePolicy.files]) await copyRuntime(entry);

  // Computed/data-driven authorities are expanded from their production
  // manifests, rather than approximated with broad directory copies.
  const packageRegistry = JSON.parse(await readFile(join(root, 'assets/package-registry/runtime-package-registry.json')));
  if (packageRegistry.packages?.length !== 508) throw new Error('Statewide runtime package registry must contain exactly 508 records.');
  let packagedManifests = 0;
  for (const record of packageRegistry.packages) {
    try {
      await stat(join(root, record.manifest));
      await copyRuntime(record.manifest);
      packagedManifests += 1;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (packagedManifests !== 282) throw new Error(`Expected 282 repository-backed package manifests; found ${packagedManifests}.`);
  const crossingManifest = JSON.parse(await readFile(join(root, 'Crossing-Packages/production-crossing-manifest.json')));
  if (crossingManifest.records?.length !== 254) throw new Error('Statewide crossing manifest must contain exactly 254 county records.');
  await copyRuntime('Crossing-Packages/production-crossing-manifest.json');
  for (const record of crossingManifest.records) await copyRuntime(record.packageFile);
  for (const legacy of [
    'Crossing-Packages/liberty/liberty-crossings.geojson', 'Crossing-Packages/liberty/liberty-crossings-curated.geojson'
  ]) await copyRuntime(legacy);

  // Current address search consumes only the package declared by this runtime
  // manifest. Raw JSONL and undeclared statewide manufacturing outputs are not
  // consumer inputs.
  const addressManifestPath = 'data/generated/lp104/txgio-addresses/runtime-manifest.json';
  const addressManifest = JSON.parse(await readFile(join(root, addressManifestPath)));
  await copyRuntime(addressManifestPath);
  for (const record of addressManifest.packages) {
    await copyRuntime(record.path);
    await copyRuntime(record.certificate);
  }

  // County-specific paths are runtime only where the consumer configuration
  // directly names them. Source shapefiles and supporting evidence are excluded.
  for (const entry of [
    'assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson',
    ...['austin','brazoria','brazos','calhoun','chambers','colorado','fayette','fort-bend','galveston','grimes','hardin','harris','jackson','jasper','jefferson','lavaca','matagorda','montgomery','newton','orange','polk','san-jacinto','tyler','walker','waller','washington','wharton'].map((county) => `assets/county-implementation/${county}/boundary/${county}-county-boundary.geojson`),
    'assets/county-implementation/montgomery/manifests/montgomery-package-manifest.json',
    'assets/county-implementation/montgomery/registry/montgomery-county-registry-artifact.json',
    'assets/county-implementation/montgomery/containment/montgomery-containment-fixture-suite-v578.json',
    'assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json',
    'assets/county-implementation/san-jacinto/manifests/san-jacinto-runtime-onboarding-v639.json',
    'assets/county-implementation/san-jacinto/registry/san-jacinto-county-runtime-registry-v639.json',
    'assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-crossing-review-overrides.json',
    'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson',
    'assets/county-implementation/chambers/runtime-assets/chambers-county-crossing-review-overrides.json',
    'assets/county-implementation/jefferson/runtime-assets/jefferson-county-crossing-review-overrides.json'
  ]) {
    // The San Jacinto GeoJSON is a directly fetched generated runtime despite a
    // legacy directory name; it is the sole governed exception to /source/.
    if (entry === governedSourcePathException) {
      await mkdir(dirname(join(destination, entry)), { recursive: true });
      await cp(join(root, entry), join(destination, entry), { preserveTimestamps: false });
    } else await copyRuntime(entry);
  }
  // Stage runtime-v2 from its certified manifest so gzip assets cannot be
  // silently omitted by a broad directory copy.
  const poiManifestBytes = await readFile(join(poiRuntimeSource, 'manifest.json'));
  const poiManifest = JSON.parse(poiManifestBytes);
  if (poiManifest.runtimeSchemaVersion !== 'gridly.poi.runtime.v2' || poiManifest.shards?.length !== 86) throw new Error('Certified POI runtime-v2 manifest must reference exactly 86 shards.');
  const runtimeDestination = join(destination, poiRuntimeRelative);
  await mkdir(runtimeDestination, { recursive: true });
  await writeFile(join(runtimeDestination, 'manifest.json'), poiManifestBytes);
  await mkdir(join(runtimeDestination, 'native'), { recursive: true });
  for (const shard of poiManifest.shards) {
    if (shard.file !== `${shard.shardId}.json.gz`) throw new Error(`Invalid POI runtime-relative path for ${shard.shardId}.`);
    await cp(join(poiRuntimeSource, shard.file), join(runtimeDestination, shard.file), { preserveTimestamps: false });
    // Capacitor's Android local server can reject double-extension .json.gz
    // paths even when AssetManager contains them. Publish an extension-safe
    // alias without transforming the certified bytes.
    await cp(join(poiRuntimeSource, shard.file), join(runtimeDestination, 'native', `${shard.shardId}.bin`), { preserveTimestamps: false });
  }
  await cp(join(root, 'poi', poiRelease, 'legal'), join(destination, 'poi', poiRelease, 'legal'), { recursive: true, preserveTimestamps: false });
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
  const referenced = new Set();
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) referenced.add(match[1]);
  const css = await readFile(join(directory, 'css/styles.css'), 'utf8');
  for (const match of css.matchAll(/url\(["']?([^)'"?#]+)["']?\)/g)) referenced.add(join('css', match[1]));
  for (const reference of referenced) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(reference)) continue;
    const local = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    await stat(join(directory, local));
  }
  const shards = paths.filter((path) => path.startsWith('poi/lp24111-d5-standalone-2026-08-28/runtime-v2/') && path.endsWith('.json.gz'));
  if (shards.length !== 86) throw new Error(`Expected exactly 86 POI runtime-v2 shards; found ${shards.length}.`);
  const nativeAliases = paths.filter((path) => path.startsWith(`${poiRuntimeRelative}/native/`) && path.endsWith('.bin'));
  if (nativeAliases.length !== 86) throw new Error(`Expected exactly 86 native-served POI aliases; found ${nativeAliases.length}.`);
  const manifestBytes = await readFile(join(directory, poiRuntimeRelative, 'manifest.json'));
  if (createHash('sha256').update(manifestBytes).digest('hex') !== '53bdb47e180836eaede03e2cf7f2acb5ec730507a768c1bae06ba0eab0c7fa9a') throw new Error('Staged POI manifest is not the certified authority.');
  const manifest = JSON.parse(manifestBytes);
  for (const shard of manifest.shards) {
    const runtimePath = join(poiRuntimeRelative, shard.file);
    const [sourceBytes, stagedBytes] = await Promise.all([readFile(join(root, runtimePath)), readFile(join(directory, runtimePath))]);
    if (!sourceBytes.equals(stagedBytes) || createHash('sha256').update(stagedBytes).digest('hex') !== shard.sha256) throw new Error(`Staged POI shard bytes differ from certified source: ${shard.shardId}.`);
    const nativeBytes = await readFile(join(directory, poiRuntimeRelative, 'native', `${shard.shardId}.bin`));
    if (!nativeBytes.equals(sourceBytes)) throw new Error(`Native-served POI alias differs from certified source: ${shard.shardId}.`);
  }
  for (const id of daytonPhysicalCohort) await stat(join(directory, poiRuntimeRelative, `${id}.json.gz`));
  const forbidden = paths.filter(isProhibited);
  if (forbidden.length) throw new Error(`Prohibited native web files: ${forbidden.join(', ')}`);

  const totalBytes = (await identity(directory)).files.reduce((sum, file) => sum + file.bytes, 0);
  if (paths.length > 1_200 || totalBytes > 300 * 1024 * 1024) throw new Error(`Native web budget exceeded: ${paths.length} files, ${totalBytes} bytes.`);

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
    console.log(`Native web stage verified: ${paths.length} files, ${totalBytes} bytes, 86 POI shards, digest ${actual.digest}`);
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
