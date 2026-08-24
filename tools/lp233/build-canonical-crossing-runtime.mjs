#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'reports/lp232/crossing-place-memberships.json');
const inventoryPath = path.join(root, 'data/generated/lp214-county-community-inventory.json');
const crossingInventoryPath = path.join(root, 'Crossing-Packages/Texas/fra-crossings-tx.geojson');
const outputPath = path.join(root, 'data/runtime/canonical-crossing-memberships-v1.json');
const manifestPath = path.join(root, 'data/runtime/canonical-crossing-memberships-v1.manifest.json');
const expectedSourceSha256 = '2d3f409de35eded92b391cfe5525ad17ad822ded255bb7fdf5c2bf45f1dfc958';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = value => fs.readFileSync(value);
const sourceBytes = read(sourcePath);
if (sha(sourceBytes) !== expectedSourceSha256) throw new Error('LP232 source artifact hash lock failed');
const source = JSON.parse(sourceBytes);
const inventory = JSON.parse(read(inventoryPath));
const crossingInventory = JSON.parse(read(crossingInventoryPath).toString('utf8').replace(/^\uFEFF/, ''));
const governedCrossingIds = new Set((crossingInventory.features || []).map(feature => String(feature?.properties?.CROSSING || '').trim()).filter(Boolean));

const communities = new Map();
for (const county of inventory.counties) for (const community of county.communities) {
  const geoid = String(community.placeGeoid || /^place-(48\d{5})$/.exec(community.canonicalKey || '')?.[1] || '');
  if (!geoid) continue;
  const row = communities.get(geoid) || { n: community.consumerLabel, m: [], x: [] };
  if (!row.m.includes(county.countyFips)) row.m.push(county.countyFips);
  communities.set(geoid, row);
}
if (communities.size !== 1859) throw new Error(`Expected 1859 canonical communities; found ${communities.size}`);
const seen = new Set();
for (const membership of source.memberships) {
  const id = String(membership.crossingId);
  if (seen.has(id)) throw new Error(`Duplicate certified crossing identity: ${id}`);
  seen.add(id);
  if (!governedCrossingIds.has(id)) throw new Error(`Certified identity cannot be resolved in governed runtime inventory: ${id}`);
  const row = communities.get(String(membership.placeGeoid));
  if (!row) throw new Error(`Unknown governed PLACE GEOID: ${membership.placeGeoid}`);
  row.x.push([id, String(membership.sourceCountyFips), String(membership.sourceCountyName)]);
}
if (seen.size !== 9094) throw new Error(`Expected 9094 memberships; found ${seen.size}`);
const places = Object.fromEntries([...communities].sort(([a], [b]) => a.localeCompare(b)).map(([geoid, row]) => [geoid, { n: row.n, m: row.m.sort(), x: row.x.sort((a, b) => a[0].localeCompare(b[0])) }]));
const runtime = { v: 1, sourceSha256: expectedSourceSha256, authority: 'LP232 boundary-inclusive covers; stable PLACE GEOID lookup', places };
const runtimeBytes = Buffer.from(`${JSON.stringify(runtime)}\n`);
const manifest = {
  schemaVersion: 'gridly.lp233.canonical-crossing-runtime-manifest.v1',
  sourceArtifact: 'reports/lp232/crossing-place-memberships.json', sourceArtifactSha256: expectedSourceSha256,
  runtimeArtifact: 'data/runtime/canonical-crossing-memberships-v1.json', runtimeArtifactSha256: sha(runtimeBytes), runtimeArtifactBytes: runtimeBytes.length,
  canonicalPlaceCount: communities.size, crossingMembershipCount: seen.size,
  communitiesWithCrossings: [...communities.values()].filter(row => row.x.length).length,
  communitiesWithZeroCrossings: [...communities.values()].filter(row => !row.x.length).length,
  derivation: 'Exact stable crossing IDs and source-county lineage grouped by governed PLACE GEOID; no geometry or attribution computation',
};
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
const write = process.argv.includes('--write');
if (write) { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, runtimeBytes); fs.writeFileSync(manifestPath, manifestBytes); }
else {
  if (!fs.existsSync(outputPath) || !read(outputPath).equals(runtimeBytes)) throw new Error('Runtime artifact is not the deterministic LP232 derivation');
  if (!fs.existsSync(manifestPath) || !read(manifestPath).equals(manifestBytes)) throw new Error('Runtime manifest is not current');
}
console.log(`LP233 ${write ? 'write' : 'verify'} PASS ${JSON.stringify(manifest)}`);
