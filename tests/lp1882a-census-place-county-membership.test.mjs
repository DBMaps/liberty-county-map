import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);

test('LP188.2A certification evidence fails closed without claiming outputs', async () => {
  const report = JSON.parse(await readFile(new URL('reports/lp1882a/census-place-county-membership-certification.json', root)));
  assert.equal(report.finalClassification, 'CERTIFICATION_BLOCKED_REQUIRED_GIS_SOURCES_AND_TOOLCHAIN_UNAVAILABLE');
  assert.equal(report.certificationRunCompleted, false);
  assert.equal(report.certifiedCounts, null);
  assert.deepEqual(report.outputArtifactsProduced, []);
  assert.equal(report.runtimeChanged, false);
  assert.equal(report.communityPackagesManufactured, false);
  assert.equal(report.addressRestrictionsRemoved, false);
});

test('PowerShell builder encodes deterministic, positive-area, fail-closed contract', async () => {
  const script = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  for (const contract of [
    ". (Join-Path $PSScriptRoot 'gridly-gis-env.ps1')",
    "ST_Area(ST_Intersection(p.geom,c.geom)) > 0",
    "POLYGON_AREA_INTERSECTION",
    "Sort-Object placeGeoid,countyFips",
    "[Text.UTF8Encoding]::new($false)",
    "Expected 1863 Texas places",
    "Expected 254 Texas counties",
  ]) assert.match(script, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(script, /Community-Packages|Supabase|defaultAwarenessAreas|app\.js/);
});
