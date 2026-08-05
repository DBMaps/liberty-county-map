import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverRealStagingFiles, parseDuckDbScalarCount, buildRealStagingManifest, rejectPlaceholderResults, reconcileLp1601h, CONTROLLED_TEST_FIXTURE, OWNER_SOURCE, PARTITION_COUNT, shaText } from '../tools/lp1601f-streaming-manufacture.mjs';

test('LP160.1H owner mode cannot emit controlled fixture staging metadata', () => {
  assert.throws(() => buildRealStagingManifest({ source: CONTROLLED_TEST_FIXTURE, mode: OWNER_SOURCE, release: '2026-07-22.0', sourceSha256: 'ABC', extractionQuerySha256: shaText('q'), rowCounts: { stagingRows: 0, files: [] }, stagingFiles: [] }), /FIXTURE_METADATA_IN_OWNER_MODE/);
});

test('LP160.1H discovers real staging files recursively and ignores placeholders', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp1601h-stage-'));
  await mkdir(join(root, 'a'), { recursive: true });
  await writeFile(join(root, 'a', 'real.parquet'), Buffer.from('PAR1data'));
  await writeFile(join(root, 'CONTROLLED_TEST_FIXTURE.parquet'), Buffer.from('PAR1bad'));
  await writeFile(join(root, 'empty.parquet'), Buffer.alloc(0));
  await writeFile(join(root, 'staging-manifest.json'), '{}');
  const files = await discoverRealStagingFiles({ stagingDirectory: root, release: '2026-07-22.0', sourceSha256: 'ABC', extractionQuerySha256: 'DEF' });
  assert.equal(files.length, 1);
  assert.equal(files[0].filename, 'a/real.parquet');
  assert.equal(files[0].byteSize, 8);
  assert.equal(files[0].format, 'parquet');
});

test('LP160.1H parses DuckDB machine-readable scalar counts without using partition count', () => {
  assert.equal(parseDuckDbScalarCount('12345\n'), 12345);
  assert.equal(parseDuckDbScalarCount('[{"row_count":987}]'), 987);
  assert.equal(rejectPlaceholderResults({ executionMode: OWNER_SOURCE, sourceRows: PARTITION_COUNT, verifiedSourceRowCount: false }), 'MANUFACTURING_FAILED:INVALID_SOURCE_ROW_COUNT');
});

test('LP160.1H real staging bytes and one large parquet shape populate manifest', () => {
  const manifest = buildRealStagingManifest({ source: '/owner/texas-places.geoparquet', mode: OWNER_SOURCE, release: '2026-07-22.0', sourceSha256: 'ABC', extractionQuerySha256: 'DEF', rowCounts: { stagingRows: 42, files: [{ filename: 'one.geoparquet', rowCount: 42 }] }, stagingFiles: [{ filename: 'one.geoparquet', ownerLocalPath: '/owner/staging/one.geoparquet', format: 'geoparquet', byteSize: 1875035097, sha256: 'HASH' }] });
  assert.equal(manifest.sourcePathIdentity, 'texas-places.geoparquet');
  assert.equal(manifest.partitionCount, 1);
  assert.equal(manifest.totalByteSize, 1875035097);
  assert.equal(manifest.parts[0].rowCount, 42);
  assert.equal(JSON.stringify(manifest).includes(CONTROLLED_TEST_FIXTURE), false);
});

test('LP160.1H placeholder failure checks reject empty and unconsumed staged output', () => {
  assert.equal(rejectPlaceholderResults({ executionMode: OWNER_SOURCE, manifest: { sourcePath: CONTROLLED_TEST_FIXTURE } }), 'MANUFACTURING_FAILED:FIXTURE_METADATA_IN_OWNER_MODE');
  assert.equal(rejectPlaceholderResults({ executionMode: OWNER_SOURCE, discoveredBytes: 10, manifest: { totalByteSize: 0 } }), 'MANUFACTURING_FAILED:STAGING_MANIFEST_MISMATCH');
  assert.equal(rejectPlaceholderResults({ executionMode: OWNER_SOURCE, stagedRows: 10, processedRows: 0 }), 'MANUFACTURING_FAILED:STAGING_NOT_CONSUMED');
  assert.equal(rejectPlaceholderResults({ executionMode: OWNER_SOURCE, stagedRows: 10, processedRows: 10, retained: 0, exclusions: 0, duplicates: 0 }), 'MANUFACTURING_FAILED:UNRECONCILED_ZERO_OUTPUT');
});

test('LP160.1H reconciliation equations and 254 county representation are enforced', () => {
  const ok = reconcileLp1601h({ sourceRows: 10, stagedRows: 8, extractionExclusions: 2, processedRows: 7, malformedRows: 1, retained: 3, exclusions: 3, duplicatesRemoved: 1, countyCandidateRows: 3, stagingFileRows: 8, countyReportRows: 3 });
  assert.equal(ok.status, 'PASS');
  const bad = reconcileLp1601h({ sourceRows: 10, stagedRows: 8, extractionExclusions: 0, processedRows: 0, malformedRows: 0, retained: 0, exclusions: 0, duplicatesRemoved: 0, countyCandidateRows: 0, stagingFileRows: 0, countyReportRows: 0 });
  assert.equal(bad.status, 'FAIL');
});
