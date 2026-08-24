import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { geometrySourceState, readTigerPlaceGeometry } from '../tools/lp232/tiger-place-geometry-reader.mjs';

const root = new URL('../', import.meta.url);
const report = JSON.parse(await readFile(new URL('reports/lp232/statewide-crossing-place-attribution-certification.json', root)));
test('LP232 report rebuild is byte-identical', () => assert.match(execFileSync(process.execPath, ['tools/lp232/build-crossing-place-attribution-certification.mjs', '--verify'], { cwd: root, encoding: 'utf8' }), /verify PASS/));
test('missing authoritative geometry is classified NOT_PRESENT', () => assert.equal(geometrySourceState('/definitely/missing/place.shp', false), 'NOT_PRESENT'));
test('present geometry without a reader requests the governed reader', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lp232-state-'));
  try { const shape = path.join(directory, 'place.shp'); for (const extension of ['shp', 'dbf', 'shx', 'prj']) fs.writeFileSync(shape.replace(/shp$/, extension), 'fixture'); assert.equal(geometrySourceState(shape, false), 'PRESENT_REQUIRES_GOVERNED_GEOMETRY_READER'); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('present geometry and successful governed reader proceeds to feature certification', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lp232-reader-'));
  try {
    const shape = path.join(directory, 'place.shp'); for (const extension of ['shp', 'dbf', 'shx', 'prj']) fs.writeFileSync(shape.replace(/shp$/, extension), 'fixture');
    const runner = (_executable, args) => { fs.writeFileSync(args[2], JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { GEOID: '4800001', PLACEFP: '00001', NAME: 'Fixture', __gridly_valid: 1, __gridly_empty: 0 }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]], [[.5, .5], [.5, 1], [1, 1], [.5, .5]]] } }] })); return { status: 0, stdout: '', stderr: '' }; };
    const result = readTigerPlaceGeometry(shape, { ogr: { executable: 'fixture-ogr2ogr', version: 'GDAL fixture' }, runner, tempRoot: directory });
    assert.equal(result.features.length, 1); assert.equal(result.features[0].geometryType, 'Polygon'); assert.equal(result.features[0].geometry.coordinates.length, 2); assert.deepEqual(result.features[0].bbox, [0, 0, 2, 2]);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('workspace report fails closed without inventing geography', () => { assert.equal(report.finalClassification, 'E. INSUFFICIENT_EVIDENCE'); assert.equal(report.geometryAuthority.finding, 'NOT_PRESENT'); assert.equal(report.geometryAuthority.repairPerformed, false); });
test('spatial and identity contract prohibits approximations', () => { assert.equal(report.contract.stableGeoidJoinRequired, true); assert.equal(report.contract.nameOnlyJoinAllowed, false); assert.equal(report.contract.nearestPlaceAllowed, false); assert.equal(report.contract.presentationRadiusAllowed, false); assert.equal(report.contract.countyUnionAllowed, false); assert.match(report.contract.predicate, /boundary/); });
test('certified statewide identity baseline remains governed', () => assert.deepEqual(report.canonicalBaseline, { canonicalCommunities: 1859, governedMemberships: 2058, multiCountyIdentities: 163, counties: 254 }));
test('production behavior is untouched', () => assert.deepEqual(Object.values(report.safety), Array(8).fill(false)));
test('builder contains no network or production runtime integration', async () => { const source = await readFile(new URL('tools/lp232/build-crossing-place-attribution-certification.mjs', root), 'utf8'); assert.doesNotMatch(source, /https?:|fetch\(|js\/app\.js|DriveTexas/); });
