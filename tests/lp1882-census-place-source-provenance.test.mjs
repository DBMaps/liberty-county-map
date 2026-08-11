import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const provenancePath = new URL(
  '../reports/lp1882/census-texas-place-source-provenance.json',
  import.meta.url,
);
const expectedSourcePath = new URL(
  '../Gridly-Source-Data/Census/TIGER2025/PLACE/original/tl_2025_48_place.zip',
  import.meta.url,
);

test('LP188.2 fails closed with a complete blocked-acquisition record', async () => {
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));

  assert.equal(provenance.sourceAuthority, 'United States Census Bureau');
  assert.equal(provenance.sourceEdition, 'TIGER/Line 2025');
  assert.equal(provenance.stateFips, '48');
  assert.equal(
    provenance.sourceUrl,
    'https://www2.census.gov/geo/tiger/TIGER2025/PLACE/tl_2025_48_place.zip',
  );
  assert.equal(
    provenance.sourceLockStatus,
    'SOURCE_ACQUISITION_BLOCKED_OWNER_ACTION_REQUIRED',
  );
  assert.equal(provenance.acquisitionFailure.substituteUsed, false);
  assert.equal(provenance.sourceBytesPreserved, false);
  assert.equal(provenance.byteSize, null);
  assert.equal(provenance.sha256, null);
  assert.equal(provenance.recordCount, null);
  assert.equal(provenance.classificationValidated, false);
  assert.equal(provenance.geometryValidated, false);

  await assert.rejects(stat(expectedSourcePath), { code: 'ENOENT' });
});

test('LP188.2 creates no community package output', async () => {
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  assert.equal(Object.hasOwn(provenance, 'manufacturedPackages'), false);
  assert.equal(Object.hasOwn(provenance, 'activationAuthorized'), false);
});
