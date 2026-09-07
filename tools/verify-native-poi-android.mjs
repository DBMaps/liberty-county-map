#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const relativeRuntime = 'poi/lp24111-d5-standalone-2026-08-28/runtime-v2';
const source = join(root, relativeRuntime);
const android = join(root, 'android/app/src/main/assets/public', relativeRuntime);
const cohort = ['tx-29-095', 'tx-29-096', 'tx-30-095', 'tx-30-096'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

const sourceManifestBytes = await readFile(join(source, 'manifest.json'));
const androidManifestBytes = await readFile(join(android, 'manifest.json'));
if (!sourceManifestBytes.equals(androidManifestBytes) || digest(androidManifestBytes) !== '53bdb47e180836eaede03e2cf7f2acb5ec730507a768c1bae06ba0eab0c7fa9a') throw new Error('Capacitor POI manifest differs from certified source.');
const manifest = JSON.parse(sourceManifestBytes);
if (manifest.runtimeSchemaVersion !== 'gridly.poi.runtime.v2' || manifest.shards.length !== 86) throw new Error('Capacitor POI runtime contract is not the statewide 86-shard v2 authority.');
const packaged = (await readdir(android)).filter(name => name.endsWith('.json.gz'));
if (packaged.length !== 86) throw new Error(`Capacitor public assets contain ${packaged.length} POI shards; expected 86.`);
for (const shard of manifest.shards) {
  const [certified, copied] = await Promise.all([readFile(join(source, shard.file)), readFile(join(android, shard.file))]);
  if (!certified.equals(copied) || digest(copied) !== shard.sha256) throw new Error(`Capacitor POI shard mismatch: ${shard.shardId}.`);
}
for (const id of cohort) if (!packaged.includes(`${id}.json.gz`)) throw new Error(`Physical Dayton regression shard missing: ${id}.`);
console.log(`Capacitor Android POI assets verified: ${packaged.length} certified shards; Dayton cohort present.`);
