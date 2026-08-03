import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { discoverSource, extract, parseArguments, selectCounties } from '../tools/lp118/extract-tiger-roadways.mjs';
import { manufacture as manufactureRoadways } from '../tools/lp116/manufacture-candidate-roadways.mjs';

const inventoryPath = new URL('../data/lp104/texas-counties.json', import.meta.url);
const inventory = JSON.parse(await readFile(inventoryPath));
const feature = (type, coordinates, id = 'A') => ({ type: 'Feature', id, properties: { LINEARID: id, FULLNAME: 'Fixture Road', RTTYP: 'M', MTFCC: 'S1400' }, geometry: type ? { type, coordinates } : null });
const boundary = (fips, name, x) => ({ type: 'Feature', properties: { GEOID: fips, NAME: name }, geometry: { type: 'Polygon', coordinates: [[[x, 29], [x + 1, 29], [x + 1, 31], [x, 31], [x, 29]]] } });
async function fixtures() { const root = await mkdtemp(join(tmpdir(), 'lp118-')); const reports = join(root, 'reports'); const sources = join(root, 'sources'); await mkdir(sources); const boundaries = join(root, 'boundaries.geojson'); await writeFile(boundaries, JSON.stringify({ type: 'FeatureCollection', features: [boundary('48051', 'Burleson', -97), boundary('48455', 'Trinity', -96), boundary('48469', 'Victoria', -98)] })); return { root, reports, sources, boundaries }; }
const hash = body => createHash('sha256').update(body).digest('hex');

test('FIPS and CLI governance reject ambiguity and sort maintained counties', () => {
  assert.deepEqual(selectCounties(inventory, '48469,48051,48455').map(x => x.fips), ['48051', '48455', '48469']);
  assert.throws(() => selectCounties(inventory, '48051,48051'), /Duplicate/); assert.throws(() => selectCounties(inventory, '49001'), /Texas/); assert.throws(() => selectCounties(inventory, '48998'), /absent/);
  assert.throws(() => parseArguments(['--fips', '48051']), /candidate/); assert.throws(() => parseArguments(['--fips', '48051', '--candidate', '--source', 'a', '--tiger-root', 'b']), /mutually exclusive/); assert.throws(() => parseArguments(['--fips', '48051', '--candidate', '--resume', '--force']), /mutually exclusive/);
});

test('county shapefile/ZIP discovery is exact and ambiguous selection fails closed', async t => {
  const f = await fixtures(); t.after(() => rm(f.root, { recursive: true, force: true }));
  const shp = join(f.sources, 'tl_2025_48051_roads.shp'); await writeFile(shp, 'read-only'); assert.equal(await discoverSource({ tiger_root: f.sources }, '48051'), shp);
  const zip = join(f.sources, 'tl_2025_48455_roads.zip'); await writeFile(zip, 'read-only'); assert.equal(await discoverSource({ tiger_root: f.sources }, '48455'), zip);
  await writeFile(join(f.sources, 'tl_2024_48051_roads.zip'), 'duplicate'); await assert.rejects(discoverSource({ tiger_root: f.sources }, '48051'), /Ambiguous/);
});

test('controlled GeoJSON extraction governs geometry, containment, duplicates, fields, hashes, and candidate state', async t => {
  const f = await fixtures(); t.after(() => rm(f.root, { recursive: true, force: true })); const source = join(f.sources, 'tl_2025_48051_roads.geojson');
  const line = [[-96.8, 30], [-96.7, 30.1]]; await writeFile(source, JSON.stringify({ type: 'FeatureCollection', features: [feature('LineString', line), feature('LineString', line), feature('MultiLineString', [[[-96.6, 30], [-96.5, 30.1]]], 'B'), feature('Point', [-96.5, 30], 'P'), feature('Polygon', [], 'G'), feature(null, null, 'N'), feature('LineString', [[null, 30], [-96.4, 30]], 'NF'), feature('LineString', [[-90, 30], [-89, 30]], 'OUT')] }));
  const before = await readFile(source); const result = (await extract({ fips: '48051', candidate: true, source, boundaries: f.boundaries, reports: f.reports, inventoryPath })).counties[0];
  assert.equal(result.status, 'GENERATED'); assert.equal(result.sourceFeatureCount, 8); assert.equal(result.retainedFeatureCount, 2); assert.equal(result.duplicateCount, 1); assert.equal(result.rejectedGeometryCount, 4); assert.equal(result.outOfCountyRejectionCount, 1); assert.deepEqual(result.geometryTypeCounts, { LineString: 1, MultiLineString: 1 });
  assert.equal(result.outputCrs, 'EPSG:4326'); assert.equal(result.source.sha256, hash(before)); assert.equal(result.boundary.sha256.length, 64); assert.equal(result.productionAuthorized, false); assert.equal(result.activated, false); assert.equal(result.uploadEnabled, false); assert.deepEqual(await readFile(source), before);
  const output = JSON.parse(await readFile(join(f.reports, '48051/burleson-48051.tiger-roadways.candidate.geojson'))); assert.equal(output.features[0].properties.FULLNAME, 'Fixture Road'); assert.ok(output.features.every(x => ['LineString', 'MultiLineString'].includes(x.geometry.type)));
  const lp116 = await manufactureRoadways({ fips: '48051', source: join(f.reports, '48051/burleson-48051.tiger-roadways.candidate.geojson'), boundaries: f.boundaries, reports: join(f.root, 'lp116'), inventoryPath }); assert.equal(lp116.counties[0].certificationStatus, 'PASS');
});

test('determinism, resume binding, invalidation, missing/invalid sources, and county failure isolation are truthful', async t => {
  const f = await fixtures(); t.after(() => rm(f.root, { recursive: true, force: true }));
  for (const [fips, x] of [['48051', -96.8], ['48455', -95.8]]) await writeFile(join(f.sources, `tl_2025_${fips}_roads.geojson`), JSON.stringify({ type: 'FeatureCollection', features: [feature('LineString', [[x, 30], [x + .1, 30.1]], fips)] }));
  const options = { fips: '48455,48051', candidate: true, tiger_root: f.sources, boundaries: f.boundaries, reports: f.reports, inventoryPath }; const first = await extract(options); assert.deepEqual(first.requestedFips, ['48051', '48455']); const hashes = first.counties.map(x => x.output.sha256);
  const resumed = await extract({ ...options, resume: true }); assert.deepEqual(resumed.counties.map(x => x.status), ['RESUMED', 'RESUMED']); assert.deepEqual(resumed.counties.map(x => x.output.sha256), hashes);
  await writeFile(join(f.sources, 'tl_2025_48051_roads.geojson'), JSON.stringify({ type: 'FeatureCollection', features: [feature('LineString', [[-96.8, 30], [-96.6, 30.2]], 'changed')] })); const changed = await extract({ ...options, resume: true }); assert.equal(changed.counties[0].status, 'GENERATED'); assert.notEqual(changed.counties[0].source.sha256, first.counties[0].source.sha256); assert.equal(changed.counties[1].status, 'RESUMED');
  const missing = await extract({ fips: '48469', candidate: true, tiger_root: f.sources, boundaries: f.boundaries, reports: join(f.root, 'missing'), inventoryPath }); assert.equal(missing.counties[0].status, 'REQUIRES_OWNER_SOURCE');
  await writeFile(join(f.sources, 'tl_2025_48469_roads.geojson'), '{bad'); const invalid = await extract({ fips: '48469,48455', candidate: true, tiger_root: f.sources, boundaries: f.boundaries, reports: join(f.root, 'invalid'), inventoryPath }); assert.equal(invalid.counties.find(x => x.fips === '48469').status, 'FAILED'); assert.equal(invalid.counties.find(x => x.fips === '48455').status, 'GENERATED'); assert.ok((await stat(join(f.root, 'invalid/48455/checkpoint.json'))).isFile());
});

test('LP114 contains the LP118 integration contract without production file targets', async () => {
  const source = await readFile(new URL('../tools/lp114/manufacture-county-bundle.mjs', import.meta.url), 'utf8'); assert.match(source, /extractTigerRoadways/); assert.match(source, /--tiger-road-root/); assert.match(source, /manufactureRoadways/); assert.doesNotMatch(await readFile(new URL('../tools/lp118/extract-tiger-roadways.mjs', import.meta.url), 'utf8'), /data\/roadway-runtime-manifest|data\/road-segments/);
});
