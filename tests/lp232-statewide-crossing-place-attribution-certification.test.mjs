import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { geometrySourceState, readTigerPlaceGeometry } from '../tools/lp232/tiger-place-geometry-reader.mjs';
import { reconcileGovernedPlaceGeometry } from '../tools/lp232/governed-place-reconciliation.mjs';

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
test('workspace report is internally consistent with observed source evidence', () => {
  const { sourceState, finding, repairPerformed } = report.geometryAuthority;
  const { artifactProduced, deterministicRebuildPass } = report.attribution;

  assert.equal(repairPerformed, false);
  if (sourceState === 'NOT_PRESENT') {
    assert.equal(finding, 'NOT_PRESENT');
    assert.equal(report.identityReconciliation, null);
    assert.equal(artifactProduced, false);
    assert.equal(report.finalClassification, 'E. INSUFFICIENT_EVIDENCE');
  } else if (sourceState === 'PRESENT_REQUIRES_GOVERNED_GEOMETRY_READER') {
    assert.equal(finding, 'PRESENT_REQUIRES_GOVERNED_GEOMETRY_READER');
    assert.equal(report.identityReconciliation, null);
    assert.equal(artifactProduced, false);
    assert.equal(report.finalClassification, 'E. INSUFFICIENT_EVIDENCE');
  } else {
    assert.equal(sourceState, 'PRESENT_READER_AVAILABLE');
    const geometryCertificationReady = report.geometryAuthority.archive !== null
      && report.geometryAuthority.geoidUnique === true
      && report.geometryAuthority.placefpUniqueWithinTexas === true
      && report.identityReconciliation?.geometryReconciliationPass === true;
    if (finding === 'PRESENT_REQUIRES_RECONCILIATION') {
      assert.equal(geometryCertificationReady, false);
      assert.equal(artifactProduced, false);
      assert.equal(report.finalClassification, 'C. SOURCE_GEOMETRY_REQUIRES_RECONCILIATION');
    } else {
      assert.equal(finding, 'CERTIFIED');
      assert.equal(geometryCertificationReady, true);
      assert.equal(artifactProduced, true);
      assert.equal(deterministicRebuildPass, true);
      assert.equal(
        report.finalClassification,
        report.crossingAuthority.identityPass
          ? 'B. NEW_OFFLINE_CROSSING_PLACE_ATTRIBUTION_CERTIFIED'
          : 'D. CROSSING_IDENTITY_REQUIRES_RECONCILIATION',
      );
    }
  }
});
test('spatial and identity contract prohibits approximations', () => { assert.equal(report.contract.stableGeoidJoinRequired, true); assert.equal(report.contract.nameOnlyJoinAllowed, false); assert.equal(report.contract.nearestPlaceAllowed, false); assert.equal(report.contract.presentationRadiusAllowed, false); assert.equal(report.contract.countyUnionAllowed, false); assert.match(report.contract.predicate, /boundary/); });
test('certified statewide identity baseline remains governed', () => assert.deepEqual(report.canonicalBaseline, { canonicalCommunities: 1859, governedMemberships: 2058, multiCountyIdentities: 163, counties: 254 }));
test('production behavior is untouched', () => assert.deepEqual(Object.values(report.safety), Array(8).fill(false)));
test('builder contains no network or production runtime integration', async () => { const source = await readFile(new URL('tools/lp232/build-crossing-place-attribution-certification.mjs', root), 'utf8'); assert.doesNotMatch(source, /https?:|fetch\(|js\/app\.js|DriveTexas/); });

const eligible = [{ geoid: '4800001', officialName: 'Active', placeFips: '00001', classFp: 'C1', funcStat: 'A', governedType: 'INCORPORATED_PLACE' }];
const inactive = { geoid: '4800002', officialName: 'Inactive', placeFips: '00002', classFp: 'C9', funcStat: 'I', governedType: 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE' };
const geometry = (GEOID, PLACEFP = GEOID.slice(-5)) => ({ GEOID, PLACEFP, valid: true, empty: false });

test('governed geometry coverage permits an authority-classified source exclusion', () => {
  const result = reconcileGovernedPlaceGeometry([geometry('4800001'), geometry('4800002')], [...eligible, inactive], ['4800001']);
  assert.equal(result.exactGovernedGeometryMatches, 1);
  assert.equal(result.missingGovernedGeometryCount, 0);
  assert.equal(result.governedExcludedGeometryCount, 1);
  assert.equal(result.unknownExtraGeometryCount, 0);
  assert.equal(result.geometryReconciliationPass, true);
  assert.deepEqual(result.excludedGeometryIdentities.map(row => row.geoid), ['4800002']);
});

test('unknown additional source geometry fails closed', () => {
  const result = reconcileGovernedPlaceGeometry([geometry('4800001'), geometry('4899999')], [...eligible, inactive], ['4800001']);
  assert.equal(result.unknownExtraGeometryCount, 1);
  assert.equal(result.geometryReconciliationPass, false);
});

test('missing and duplicate governed geometry fail closed', () => {
  assert.equal(reconcileGovernedPlaceGeometry([], eligible, ['4800001']).geometryReconciliationPass, false);
  assert.equal(reconcileGovernedPlaceGeometry([geometry('4800001'), geometry('4800001')], eligible, ['4800001']).geometryReconciliationPass, false);
});

test('exclusions are derived from governed classification rather than GEOID constants', async () => {
  const source = await readFile(new URL('tools/lp232/governed-place-reconciliation.mjs', root), 'utf8');
  assert.match(source, /censusConsumerEligible\(authority\.governedType\)/);
  assert.doesNotMatch(source, /4832684|4850184|4850724|4860644/);
});

test('source lineage builder preserves inactive identities and source geometry', async () => {
  const source = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  assert.match(source, /INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE/);
  assert.match(source, /Write-StableJson \(Join-Path \$promote 'texas-place-canonical\.json'\) \$canonical/);
  assert.match(source, /sourceGeometryModified=\$false/);
  assert.match(source, /membershipMethod='POLYGON_AREA_INTERSECTION'/);
});

test('attribution is gated by successful governed reconciliation and excludes inactive geometry', async () => {
  const source = await readFile(new URL('tools/lp232/build-crossing-place-attribution-certification.mjs', root), 'utf8');
  assert.match(source, /reconciliation\?\.geometryReconciliationPass === true/);
  assert.match(source, /eligiblePlaces\.filter|const eligiblePlaces/);
  assert.match(source, /excludedInactiveOnly/);
});
