import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectStagingFormat, readerExpressionForFormat, assertReaderMatchesFormat, validateJsonlBounded, parseDuckDbScalarCount, reconcileLp1601h, rejectPlaceholderResults, LP1601I_FAILURES, OWNER_SOURCE } from '../tools/lp1601f-streaming-manufacture.mjs';

test('LP160.1I selects JSONL reader for .jsonl and never read_parquet', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp1601i-jsonl-'));
  const file = join(dir, 'lp1601c-part-00000.jsonl');
  await writeFile(file, '{"id":"CONTROLLED_TEST_FIXTURE-1","longitude":-94.8,"latitude":30.1}\n');
  const detected = await inspectStagingFormat(file, 'jsonl');
  assert.equal(detected.detectedFormat, 'jsonl');
  assert.match(detected.initialByteSignature, /^\{"/);
  assert.equal(detected.conflictStatus, 'NONE');
  assert.match(detected.selectedReader, /read_json_auto/);
  assert.doesNotMatch(detected.selectedReader, /read_parquet/);
  assertReaderMatchesFormat('jsonl', detected.selectedReader);
});

test('LP160.1I selects Parquet reader only for PAR1 parquet content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp1601i-parquet-'));
  const file = join(dir, 'part.parquet');
  await writeFile(file, Buffer.from('PAR1CONTROLLED_TEST_FIXTUREPAR1'));
  const detected = await inspectStagingFormat(file, 'parquet');
  assert.equal(detected.detectedFormat, 'parquet');
  assert.equal(readerExpressionForFormat(file, detected.detectedFormat).includes('read_parquet'), true);
});

test('LP160.1I rejects format conflicts and JSONL queried as Parquet', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp1601i-conflict-'));
  const file = join(dir, 'bad.parquet');
  await writeFile(file, '{"id":"CONTROLLED_TEST_FIXTURE","longitude":-94,"latitude":30}\n');
  const detected = await inspectStagingFormat(file, 'parquet');
  assert.equal(detected.conflictStatus, 'CONFLICT');
  assert.throws(() => assertReaderMatchesFormat('jsonl', `read_parquet('${file}')`), /STAGING_FORMAT_READER_MISMATCH/);
  assert.equal(LP1601I_FAILURES.manifestMismatch, 'MANUFACTURING_FAILED:STAGING_MANIFEST_FORMAT_MISMATCH');
});

test('LP160.1I bounded JSONL validation consumes lines and reports malformed rows', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp1601i-validate-'));
  const ok = join(dir, 'ok.jsonl');
  await writeFile(ok, '{"id":"CONTROLLED_TEST_FIXTURE-1","longitude":-94,"latitude":30}\n{"id":"CONTROLLED_TEST_FIXTURE-2","longitude":-95,"latitude":31}\n');
  const report = await validateJsonlBounded(ok);
  assert.equal(report.finalValidationClassification, 'PASS');
  const bad = join(dir, 'bad.jsonl');
  await writeFile(bad, '{"id":"CONTROLLED_TEST_FIXTURE-1","longitude":-94,"latitude":30}\nnot-json\n');
  const badReport = await validateJsonlBounded(bad);
  assert.equal(badReport.tailStatus, 'FAIL');
});

test('LP160.1I scalar row counts and reconciliation failure codes are governed', () => {
  assert.equal(parseDuckDbScalarCount('2070451\n'), 2070451);
  assert.equal(rejectPlaceholderResults({ executionMode: OWNER_SOURCE, stagedRows: 10, processedRows: 0 }), 'MANUFACTURING_FAILED:STAGING_NOT_CONSUMED');
  assert.equal(LP1601I_FAILURES.jsonlNotConsumed, 'MANUFACTURING_FAILED:JSONL_NOT_CONSUMED');
  const ok = reconcileLp1601h({ sourceRows: 4, stagedRows: 4, extractionExclusions: 0, processedRows: 4, malformedRows: 0, retained: 2, exclusions: 1, duplicatesRemoved: 1, countyCandidateRows: 2, stagingFileRows: 4, countyReportRows: 2 });
  assert.equal(ok.status, 'PASS');
});
