import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildEvidence, parseWorkbook, EXPECTED_WORKBOOK_SHA256 } from '../tools/lp125/build-tcjs-county-jail-evidence.mjs';

const sourceUrl = new URL('../evidence/lp125/sources/PopReportCurrent.xlsx', import.meta.url);
const evidence = JSON.parse(await readFile(new URL('../evidence/lp125/texas-statewide-county-jail-evidence.json', import.meta.url)));
const inventory = JSON.parse(await readFile(new URL('../data/lp104/texas-counties.json', import.meta.url)));
const digest = value => createHash('sha256').update(value).digest('hex');

test('governed authentic workbook is physically present and hash locked', async () => {
  const bytes = await readFile(sourceUrl);
  assert.equal(digest(bytes), EXPECTED_WORKBOOK_SHA256);
  assert.equal(evidence.workbookProvenance.sha256, EXPECTED_WORKBOOK_SHA256);
});

test('authentic OOXML bytes parse the verified worksheets, header, and dictionary', async () => {
  const parsed = await parseWorkbook(sourceUrl);
  assert.equal(parsed.worksheet, 'BY COUNTY');
  assert.equal(parsed.headerRow, 5); assert.equal(parsed.dataStartRow, 6);
  assert.equal(parsed.dictionary['County/Facility'], 'Name of the county, private facility, OLS Unit.');
  assert.equal(parsed.dictionary['(No Jail)'], 'The county does not have a jail, and they house their inmates in another county.');
  assert.equal(parsed.dictionary['(P)'], 'Private Facility');
  assert.equal(parsed.dictionary.OLS, 'Operation Lonestar Unit');
});

test('only latest reporting date is classified rather than historical rows', async () => {
  const parsed = await parseWorkbook(sourceUrl);
  assert.equal(parsed.reportingDate, '2026-07-01');
  assert.equal(parsed.historicalReportingDateCount, 47);
  assert.equal(parsed.latestRows.length, 258);
  assert.ok(parsed.latestRows.every(row => row.reportingDate === parsed.reportingDate));
  assert.equal(evidence.records.length, 254);
});

test('county reconciliation preserves workbook truth and reports its latest-date anomaly', () => {
  assert.equal(new Set(evidence.records.map(x => x.countyFips)).size, 254);
  assert.deepEqual(evidence.records.map(x => x.countyFips).sort(), inventory.counties.map(x => x.fips).sort());
  assert.equal(evidence.reconciliation.reconciledCountyCount, 253);
  assert.deepEqual(evidence.reconciliation.missingCountiesAtLatestDate, [{ county: 'Yoakum County', countyFips: '48501' }]);
  const yoakum = evidence.records.find(x => x.countyFips === '48501');
  assert.deepEqual(yoakum.tcjsClassifications, []); assert.equal(yoakum.reviewStatus, 'REVIEW_REQUIRED');
  const young = evidence.records.find(x => x.countyFips === '48503');
  assert.equal(young.sourceEntries.length, 2); assert.ok(young.sourceEntries.every(x => x.identifier === 'Young'));
});

test('TCJS county-jail, no-jail, private, and OLS semantics remain explicit', () => {
  assert.deepEqual(evidence.summary, { countyJail: 227, noJail: 22, privateFacility: 8, olsCountyRecords: 0, standaloneOlsEntries: 0, reviewRequired: 1 });
  assert.equal(evidence.records.find(x => x.county === 'Armstrong County').sourceEntries[0].identifier, 'Armstrong (no jail)');
  assert.ok(evidence.records.find(x => x.county === 'Jefferson County').tcjsClassifications.includes('PRIVATE_FACILITY'));
  assert.equal(evidence.workbookProvenance.dataDictionary.OLS, 'Operation Lonestar Unit');
});

test('evidence contains no invented facility details and keeps every authorization boundary closed', () => {
  const forbidden = ['facilityName', 'address', 'contact', 'phone', 'email'];
  for (const record of evidence.records) {
    for (const field of forbidden) assert.equal(field in record, false);
    assert.equal(record.candidateApproval, false); assert.equal(record.productionAuthorization, false); assert.equal(record.runtimeEligible, false);
  }
  for (const flag of ['candidateApproval', 'productionAuthorization', 'runtimeEligible', 'countiesActivated', 'runtimeModified']) assert.equal(evidence[flag], false);
});

test('builder is deterministic and its seal covers the canonical payload', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp125-')); const output = join(dir, 'evidence.json');
  const first = await buildEvidence({ source: sourceUrl, output }); const second = await buildEvidence({ source: sourceUrl, output });
  assert.equal(first.seal.canonicalPayloadHash, second.seal.canonicalPayloadHash);
  const { seal, ...payload } = evidence; assert.equal(seal.canonicalPayloadHash, digest(JSON.stringify(payload)));
});

test('tampered workbook bytes are rejected before parsing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lp125-tamper-')); const path = join(dir, 'source.xlsx');
  const bytes = await readFile(sourceUrl); bytes[100] ^= 1; await writeFile(path, bytes);
  await assert.rejects(() => parseWorkbook(path), { code: 'WORKBOOK_HASH_MISMATCH' });
});
