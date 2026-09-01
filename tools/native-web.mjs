#!/usr/bin/env node
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] : 'www');
const entries = ['index.html', 'manifest.json', 'service-worker.js', 'css', 'js', 'assets', 'data', 'poi', 'Community-Packages', 'Crossing-Packages'];
const prohibited = [/(^|\/)node_modules\//, /(^|\/)(tests|tools|reports|evidence|owner-local)\//, /(^|\/)android\//, /(^|\/)ios\//, /(^|\/)[^/]*\.local\.js$/];

export async function stage(destination) {
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
  for (const file of await files(directory)) {
    hash.update(file); hash.update('\0'); hash.update(await readFile(join(directory, file))); hash.update('\0');
  }
  return hash.digest('hex');
}

async function verify(directory) {
  const required = [
    'index.html', 'manifest.json', 'service-worker.js', 'css', 'js', 'assets', 'data', 'poi',
    'Community-Packages', 'Crossing-Packages',
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
    await stage(temporary);
    const [actual, repeated] = await Promise.all([identity(directory), identity(temporary)]);
    if (actual !== repeated) throw new Error(`Staged web identity differs from a clean repeat (${actual} != ${repeated}).`);
    console.log(`Native web stage verified: ${paths.length} files, 86 POI shards, sha256 ${actual}`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

if (process.argv.includes('--verify')) await verify(output); else {
  await stage(output);
  console.log(`Staged Gridly native web bundle at ${relative(root, output) || '.'}.`);
}
