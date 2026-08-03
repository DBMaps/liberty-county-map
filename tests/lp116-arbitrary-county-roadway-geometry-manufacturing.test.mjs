import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { manufacture, parseArguments, selectCounties, validLineGeometry } from '../tools/lp116/manufacture-candidate-roadways.mjs';
import { manufacture as manufactureBundle } from '../tools/lp114/manufacture-county-bundle.mjs';

const inventoryPath = new URL('../data/lp104/texas-counties.json', import.meta.url);
const inventory = JSON.parse(await readFile(inventoryPath));
const road = (fips, id, geometry = { type: 'LineString', coordinates: [[-96.5, 30], [-96.4, 30.1]] }) => ({ type: 'Feature', id, properties: { STATEFP: '48', COUNTYFP: fips.slice(2), LINEARID: id }, geometry });
async function fixture(features) { const root = await mkdtemp(join(tmpdir(), 'lp116-')); const source = join(root, 'tiger-roads.geojson'); const reports = join(root, 'reports'); await writeFile(source, JSON.stringify({ type: 'FeatureCollection', features })); return { root, source, reports }; }
const sha = body => createHash('sha256').update(body).digest('hex');

test('maintained arbitrary FIPS selection and candidate CLI governance', () => {
  assert.deepEqual(selectCounties(inventory, '48051,48455,48469').map(x => x.fips), ['48051', '48455', '48469']);
  assert.throws(() => selectCounties(inventory, '48051,48051'), /Duplicate/); assert.throws(() => selectCounties(inventory, '49001'), /Texas/); assert.throws(() => selectCounties(inventory, '48998'), /absent/);
  assert.throws(() => parseArguments(['--fips', '48051']), /--candidate/); assert.throws(() => parseArguments(['--fips', '48051', '--candidate', '--resume', '--force']), /mutually exclusive/);
});

test('three-county output reuses LP032 identities and partitions while remaining deterministic and inactive', async t => {
  const f = await fixture([road('48051', 'A'), road('48455', 'B'), road('48469', 'C')]); t.after(() => rm(f.root, { recursive: true, force: true }));
  const production = await readFile(new URL('../data/roadway-runtime-manifest.json', import.meta.url));
  const first = await manufacture({ fips: '48051,48455,48469', source: f.source, reports: f.reports, inventoryPath });
  assert.deepEqual(first.counties.map(x => x.status), ['GENERATED', 'GENERATED', 'GENERATED']);
  for (const county of first.counties) { assert.equal(county.partitionDecision, 'SINGLE_PACKAGE'); assert.equal(county.certificationStatus, 'PASS'); assert.equal(county.productionAuthorization, false); assert.equal(county.uploadEnabled, false); assert.equal(county.acceptedGeometryCount, 1); assert.match(county.packages[0].packageId, new RegExp(`^${county.countyId}-tx`)); }
  const packageHashes = first.counties.map(x => x.packages[0].sha256); const manifestHashes = first.counties.map(x => x.manifest.sha256);
  const second = await manufacture({ fips: '48051,48455,48469', source: f.source, reports: f.reports, inventoryPath }); assert.deepEqual(second.counties.map(x => x.packages[0].sha256), packageHashes); assert.deepEqual(second.counties.map(x => x.manifest.sha256), manifestHashes);
  assert.deepEqual(await readFile(new URL('../data/roadway-runtime-manifest.json', import.meta.url)), production);
});

test('geometry, duplicate, FIPS, and optional polygon containment are fail-closed', async t => {
  assert.equal(validLineGeometry({ type: 'Point', coordinates: [-96, 30] }), false); assert.equal(validLineGeometry({ type: 'LineString', coordinates: [[NaN, 1], [2, 3]] }), false);
  const f = await fixture([road('48051', 'A'), road('48051', 'A'), road('48051', 'bad', { type: 'Polygon', coordinates: [] }), road('48455', 'foreign'), road('48051', 'outside', { type: 'LineString', coordinates: [[-90, 30], [-89, 30]] })]); t.after(() => rm(f.root, { recursive: true, force: true }));
  const boundary = join(f.root, 'boundaries.geojson'); await writeFile(boundary, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { GEOID: '48051' }, geometry: { type: 'Polygon', coordinates: [[[-97, 29], [-95, 29], [-95, 31], [-97, 31], [-97, 29]]] } }] }));
  const result = (await manufacture({ fips: '48051', source: f.source, boundaries: boundary, reports: f.reports, inventoryPath })).counties[0];
  assert.equal(result.acceptedGeometryCount, 1); assert.equal(result.duplicateCount, 1); assert.equal(result.rejectedGeometryCount, 2); assert.equal(result.outOfCountyRejectionCount, 1); assert.equal(result.sourceRecordsSelected, 4);
});

test('zero result, missing owner source, query failure, resume, and independent failures are truthful', async t => {
  const f = await fixture([road('48051', 'A')]); t.after(() => rm(f.root, { recursive: true, force: true }));
  const zero = (await manufacture({ fips: '48455', source: f.source, reports: f.reports, inventoryPath })).counties[0]; assert.equal(zero.status, 'NOT_APPLICABLE'); assert.equal(zero.sourceQueryCompleted, true);
  await manufacture({ fips: '48051', source: f.source, reports: f.reports, inventoryPath }); const resumed = (await manufacture({ fips: '48051', source: f.source, reports: f.reports, resume: true, inventoryPath })).counties[0]; assert.equal(resumed.status, 'RESUMED'); assert.ok((await stat(join(f.reports, '48051/checkpoint.json'))).isFile());
  const missing = (await manufacture({ fips: '48051', source: join(f.root, 'missing'), reports: f.reports, inventoryPath })).counties[0]; assert.equal(missing.status, 'REQUIRES_OWNER_SOURCE');
  await writeFile(f.source, '{broken'); const failed = (await manufacture({ fips: '48051', source: f.source, reports: f.reports, inventoryPath })).counties[0]; assert.equal(failed.status, 'FAILED');
  await writeFile(f.source, JSON.stringify({ type: 'FeatureCollection', features: [road('48051', 'A'), road('48455', 'B')] })); const independent = await manufacture({ fips: '48051,48455', source: f.source, reports: f.reports, inventoryPath }, { countyBuild: async county => { if (county.fips === '48051') throw new Error('controlled'); return { county: county.countyName, fips: county.fips, status: 'GENERATED', blockingReasons: [] }; } }); assert.equal(independent.counties[0].status, 'FAILED'); assert.equal(independent.counties[1].status, 'GENERATED');
});

test('controlled large fixture uses stable LP032-style adaptive partitions', async t => {
  const features = Array.from({ length: 7 }, (_, i) => road('48051', `R${i}`, { type: 'LineString', coordinates: [[-97 + i / 10, 30], [-96.95 + i / 10, 30.05]] })); const f = await fixture(features); t.after(() => rm(f.root, { recursive: true, force: true }));
  const options = { fips: '48051', source: f.source, reports: f.reports, inventoryPath, partitionLimits: { targetFeatureCount: 2, targetBytes: Number.MAX_SAFE_INTEGER } };
  const first = (await manufacture(options)).counties[0]; const second = (await manufacture(options)).counties[0]; assert.equal(first.partitionDecision, 'PARTITIONED'); assert.ok(first.packages.length > 1); assert.deepEqual(second.packages.map(x => [x.packageId, x.sha256]), first.packages.map(x => [x.packageId, x.sha256]));
});

test('LP114 consumes LP116 evidence without mutation or authorization', async t => {
  const f = await fixture([road('48051', 'A')]); t.after(() => rm(f.root, { recursive: true, force: true })); const before = await readFile(new URL('../data/roadway-runtime-manifest.json', import.meta.url));
  const report = await manufactureBundle({ fips: '48051', skip_addresses: true, roadway_source: f.source, reports: join(f.root, 'bundle'), inventoryPath: fileURLToPath(inventoryPath) }); const assets = report.counties[0].assets;
  assert.equal(assets.roadwayGeometry.status, 'GENERATED'); assert.equal(assets.roadwayManifest.status, 'GENERATED'); assert.equal(assets.roadwayCertification.certificationStatus, 'PASS'); assert.equal(assets.candidateRoadwayRuntimeIdentity.activated, false); assert.equal(report.uploadEnabled, false); assert.equal(report.deploymentEnabled, false); assert.deepEqual(await readFile(new URL('../data/roadway-runtime-manifest.json', import.meta.url)), before); assert.equal(sha(before).length, 64);
});
