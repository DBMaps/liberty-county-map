import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const release = 'poi/lp24111-d5-standalone-2026-08-28/runtime-v2';
const manifestBytes = fs.readFileSync(`${release}/manifest.json`);
const manifest = JSON.parse(manifestBytes);
const cohort = ['tx-29-095', 'tx-29-096', 'tx-30-095', 'tx-30-096'];

test('native POI closure preserves the certified statewide authority and physical cohort', () => {
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'), '53bdb47e180836eaede03e2cf7f2acb5ec730507a768c1bae06ba0eab0c7fa9a');
  assert.equal(manifest.runtimeSchemaVersion, 'gridly.poi.runtime.v2');
  assert.equal(manifest.shards.length, 86);
  const ids = new Set(manifest.shards.map(shard => shard.shardId));
  for (const shard of manifest.shards) {
    assert.equal(shard.file, `${shard.shardId}.json.gz`);
    const bytes = fs.readFileSync(`${release}/${shard.file}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), shard.sha256);
  }
  cohort.forEach(id => assert.ok(ids.has(id)));
});

test('native staging and browser fetch share one origin-rooted runtime hierarchy', () => {
  const staging = fs.readFileSync('tools/native-web.mjs', 'utf8');
  const provider = fs.readFileSync('js/gridlyPoiBrowserProvider.js', 'utf8');
  assert.match(staging, /poiRuntimeRelative = `poi\/\$\{poiRelease\}\/runtime-v2`/);
  assert.match(staging, /for \(const shard of poiManifest\.shards\)/);
  assert.match(provider, /RUNTIME_PATH = "\/poi\/lp24111-d5-standalone-2026-08-28\/runtime-v2\/"/);
  assert.match(provider, /runtimeUrl\(meta\.file\)/);
  assert.doesNotMatch(provider, /fallback.*poi|fake.*poi|filler/i);
});

test('focused saved-place flow promotes each intent to a direct consumer save action', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  assert.match(app, /targetType === "home" \? "Set as Home" : targetType === "work" \? "Set as Work" : "Add Favorite"/);
  assert.match(app, /button\.addEventListener\("click", \(\) => beginManagePlaceSinglePurposeFlow\(type\)\)/);
  assert.match(app, /if \(saveGroup\) saveGroup\.hidden = !mode/);
  assert.match(app, /returnToManagePlacesPrimaryScreen\(\)/);
  assert.match(app, /gridlyBuildSavedPlacesDestinationSearchAudit/);
  assert.match(app, /renderRouteWatchInlineControls/);
});
