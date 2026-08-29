import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { isIncluded } from '../tools/lp1831/prepare-cloudflare-preview-artifact.mjs';

const release = 'poi/lp24111-d5-standalone-2026-08-28';
test('Cloudflare static inventory and Capacitor workflow include the certified POI package', () => {
  const runtime = new URL(`../${release}/runtime-v2/`, import.meta.url);
  const paths = new Set([`${release}/runtime-v2/manifest.json`, ...fs.readdirSync(runtime).filter(name => name.endsWith('.json.gz')).map(name => `${release}/runtime-v2/${name}`), ...['legal/THIRD-PARTY-NOTICES.txt', 'legal/foursquare/NOTICE.txt', 'legal/license-reference-manifest.json'].map(name => `${release}/${name}`)]);
  for (const file of paths) assert.equal(isIncluded(file), true);
  assert.ok(paths.has(`${release}/runtime-v2/manifest.json`));
  assert.equal([...paths].filter(file => file.startsWith(`${release}/runtime-v2/`) && file.endsWith('.json.gz')).length, 86);
  for (const legal of ['legal/THIRD-PARTY-NOTICES.txt', 'legal/foursquare/NOTICE.txt', 'legal/license-reference-manifest.json']) assert.ok(paths.has(`${release}/${legal}`));
  const workflow = fs.readFileSync(new URL('../.github/workflows/capacitor-validation.yml', import.meta.url), 'utf8');
  assert.match(workflow, /cp -R css js assets data poi www\//);
});
