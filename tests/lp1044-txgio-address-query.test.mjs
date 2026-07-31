import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { canonicalRoad, findExactMatches, formatResult, normalizeQuery, parseArguments } from '../tools/lp104/query-txgio-address-package.mjs';

const records = [
  { i: '0123456789abcdefabcd', h: '274', r: 'CO RD 677', a: '274 CO RD 677', p: 'Dayton', z: '77535', x: -94.91, y: 30.12 },
  { i: 'fedcba9876543210abcd', h: '698', r: 'County Road 677', a: '698 County Road 677', p: 'Dayton', z: '77535', x: -94.92, y: 30.13 },
];
const certification = JSON.parse(await readFile(new URL('./fixtures/lp1044-liberty-strict-address-certification.json', import.meta.url), 'utf8'));

async function fixture() {
  const path = join(tmpdir(), `lp1044-query-${process.pid}-${Math.random()}.jsonl.gz`);
  await writeFile(path, gzipSync(`${records.map(JSON.stringify).join('\n')}\n`));
  return path;
}

test('canonicalizes all required county-road aliases consistently', () => {
  for (const road of ['County Road 677', 'County Rd 677', 'CR 677', 'Co Rd 677']) assert.equal(canonicalRoad(road), 'CR 677');
  assert.deepEqual(normalizeQuery('274 County Rd 677, Dayton, TX 77535'), {
    input: '274 County Rd 677, Dayton, TX 77535', houseNumber: '274', road: 'CR 677', normalizedAddress: '274 CR 677, Dayton, TX 77535',
  });
  assert.throws(() => normalizeQuery('274 County Road 677'), /full address/);
});

test('streams the gzip package read-only and requires exact house and road agreement', async () => {
  const path = await fixture();
  const before = { bytes: (await stat(path)).size, hash: createHash('sha256').update(await readFile(path)).digest('hex') };
  const result = await findExactMatches(path, '274 County Road 677, Dayton, TX 77535');
  assert.equal(result.outcome, 'exact_match');
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].i, records[0].i);
  const output = formatResult(result);
  assert.match(output, /Exact matches: 1/);
  assert.match(output, /Normalized query: 274 CR 677, Dayton, TX 77535/);
  for (const label of ['Matched full address:', 'Postal community:', 'ZIP:', 'Longitude:', 'Latitude:', 'Deterministic record ID:']) assert.match(output, new RegExp(label));
  assert.doesNotMatch(output, /698 County Road/);
  const after = { bytes: (await stat(path)).size, hash: createHash('sha256').update(await readFile(path)).digest('hex') };
  assert.deepEqual(after, before);
});

test('reports zero exact matches without accepting a same-road different house', async () => {
  const result = await findExactMatches(await fixture(), '275 CR 677, Dayton, TX 77535');
  assert.equal(result.matches.length, 0);
  assert.equal(result.outcome, 'truthful_no_result');
  assert.match(formatResult(result), /^Outcome: truthful_no_result/m);
  assert.match(formatResult(result), /^Exact matches: 0/m);
});

test('certifies Liberty County Road 677 as strict exact-address lookup', async () => {
  const [absent, positive] = certification.cases;
  assert.equal(certification.matchingRoadRecordCount, 23);
  assert.deepEqual(certification.observedNearbyHouseNumbers, ['238', '240', '276', '288']);

  // Model all 23 same-road package records while keeping the supplied nearby-number evidence explicit.
  const houseNumbers = [...certification.observedNearbyHouseNumbers];
  for (let number = 300; houseNumbers.length < certification.matchingRoadRecordCount; number += 2) houseNumbers.push(String(number));
  assert.ok(!houseNumbers.includes('275'), 'the absent certification number is not manufactured or interpolated');
  const packageRecords = houseNumbers.map((houseNumber, index) => ({
    i: `liberty-cr677-${String(index).padStart(3, '0')}`,
    h: houseNumber,
    r: index % 2 ? 'CR 677' : 'County Road 677',
    a: `${houseNumber} County Road 677`,
    p: 'Dayton', z: '77535', x: -94.9 - index / 10000, y: 30.1 + index / 10000,
  }));
  const path = join(tmpdir(), `lp1044-liberty-certification-${process.pid}-${Math.random()}.jsonl.gz`);
  await writeFile(path, gzipSync(`${packageRecords.map(JSON.stringify).join('\n')}\n`));

  const noResult = await findExactMatches(path, absent.query);
  assert.equal(noResult.outcome, absent.expected);
  assert.deepEqual(noResult.matches, [], 'canonical road agreement alone is insufficient');
  assert.ok(!noResult.matches.some(record => absent.mustNotReturnHouseNumbers.includes(record.h)), '276 is not returned for 275');
  assert.equal(absent.allowNearbyNumberFallback, false);
  assert.equal(absent.allowInterpolation, false);

  const exact = await findExactMatches(path, positive.query);
  assert.equal(exact.outcome, positive.expected);
  assert.equal(exact.matches.length, 1);
  assert.equal(exact.matches[0].h, positive.expectedHouseNumber);
});

test('accepts a quoted full query and optional package path', () => {
  assert.deepEqual(parseArguments(['274 Co Rd 677, Dayton, TX 77535', '--package', './fixture.gz']), {
    query: '274 Co Rd 677, Dayton, TX 77535', packagePath: join(process.cwd(), 'fixture.gz'),
  });
  assert.throws(() => parseArguments([]), /required/);
});
