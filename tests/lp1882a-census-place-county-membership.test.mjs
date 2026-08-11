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

test('PowerShell builder reports deterministic reconciliation diagnostics and failing gates', async () => {
  const script = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  const labels = [
    'Canonical places', 'Duplicate GEOIDs', 'Non-Texas records', 'Unmatched places',
    'Invalid geometries', 'Other requires review', 'Single-county places',
    'Multi-county places', 'Total memberships', 'Counties with Census places',
    'Counties with zero Census places', 'Duplicate-name groups',
  ];
  let previous = -1;
  for (const label of labels) {
    const position = script.indexOf(`@('${label}',`);
    assert.ok(position > previous, `${label} diagnostic must be present in deterministic order`);
    previous = position;
  }
  assert.match(script, /Failing reconciliation gates:/);
  assert.match(script, /foreach \(\$failedGate in \$failedGates\)/);
  assert.match(script, /if \(\$failedGates\.Count -gt 0\)/);
  assert.match(script, /Certification reconciliation failed; temporary output will not be promoted\./);
});

test('PowerShell builder promotes polygon features to multi without simplifying geometry', async () => {
  const script = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  assert.match(script, /'-nlt','PROMOTE_TO_MULTI'/);
  assert.doesNotMatch(script, /-simplify|-segmentize/);
});

test('PowerShell reconciliation records retain ordered JSON fields with property semantics', async () => {
  const script = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  const canonicalRecord = script.match(/\[pscustomobject\]\[ordered\]@\{ stateFips=\$p\.STATEFP;[^\r\n]+intptLon=\$p\.INTPTLON \}/)?.[0];
  const membershipRecord = script.match(/\[pscustomobject\]\[ordered\]@\{ placeGeoid=\$p\.placeGeoid;[^\r\n]+membershipMethod='POLYGON_AREA_INTERSECTION' \}/)?.[0];

  assert.ok(canonicalRecord, 'canonical rows are ordered PSCustomObjects');
  assert.ok(membershipRecord, 'membership rows are ordered PSCustomObjects');
  assert.ok(canonicalRecord.indexOf('stateFips=') < canonicalRecord.indexOf('geoid='));
  assert.ok(canonicalRecord.indexOf('geoid=') < canonicalRecord.indexOf('officialName='));
  assert.ok(membershipRecord.indexOf('placeGeoid=') < membershipRecord.indexOf('countyFips='));
  assert.ok(membershipRecord.indexOf('countyFips=') < membershipRecord.indexOf('membershipSource='));
});

test('PowerShell reconciliation groups and matches property-addressable record values', async () => {
  const script = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  for (const operation of [
    '$canonical | Group-Object geoid',
    '$memberships | Group-Object placeGeoid -AsHashTable -AsString',
    '$membershipByPlace.ContainsKey($_.geoid)',
    '$canonical | Group-Object officialName',
    '$memberships.countyFips',
  ]) assert.ok(script.includes(operation), `${operation} must operate on PSCustomObject properties`);

  assert.match(script, /if \(\$duplicateGeoids\.Count -gt 0\)/);
  assert.match(script, /if \(\$unmatched\.Count -gt 0\)/);
  assert.match(script, /throw 'Certification reconciliation failed; temporary output will not be promoted\.'/);
});

test('record grouping fixture distinguishes real identity and name property values', () => {
  const canonical = [
    { geoid: '4800001', officialName: 'Alpha' },
    { geoid: '4800002', officialName: 'Beta' },
    { geoid: '4800003', officialName: 'Alpha' },
  ];
  const memberships = [
    { placeGeoid: '4800001', countyFips: '48001' },
    { placeGeoid: '4800002', countyFips: '48003' },
  ];
  const groupBy = (rows, property) => Map.groupBy(rows, (row) => row[property]);
  const byGeoid = groupBy(canonical, 'geoid');
  const byPlaceGeoid = groupBy(memberships, 'placeGeoid');
  const membershipKeys = new Set(byPlaceGeoid.keys());

  assert.deepEqual([...byGeoid.keys()], ['4800001', '4800002', '4800003']);
  assert.deepEqual([...byPlaceGeoid.keys()], ['4800001', '4800002']);
  assert.deepEqual(canonical.filter((row) => !membershipKeys.has(row.geoid)).map((row) => row.geoid), ['4800003']);
  assert.deepEqual([...groupBy(canonical, 'officialName')].filter(([, rows]) => rows.length > 1).map(([name]) => name), ['Alpha']);
});

test('GIS operation and geometry promotion remain structurally locked', async () => {
  const script = await readFile(new URL('Gridly-Source-Data/Tools/Build-Scripts/Build-CensusPlaceCountyMemberships.ps1', root), 'utf8');
  assert.match(script, /ST_Intersects\(p\.geom,c\.geom\)/);
  assert.match(script, /ST_Area\(ST_Intersection\(p\.geom,c\.geom\)\) > 0/);
  assert.match(script, /'-nlt','PROMOTE_TO_MULTI'/);
});
