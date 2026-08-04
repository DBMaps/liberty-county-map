import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPlan, parseArguments, planCsv, run } from '../tools/lp130/manufacture-remaining-texas-addresses.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const registry = await readJson('data/lp104/texas-counties.json');
const manifest = await readJson('data/generated/lp104/txgio-addresses/manifest.json');
const productionBefore = await readFile(new URL('data/generated/lp104/txgio-addresses/runtime-manifest.json', root));
const plan = await readJson('reports/lp130-statewide-addresses/statewide-batch-plan.json');
const completion = await readJson('evidence/lp130/batch-01-manufacturing-completion.json');

test('official, existing, and remaining identities reconcile without duplicates', () => {
  assert.equal(registry.counties.length, 254);
  assert.equal(new Set(registry.counties.map(item => item.fips)).size, 254);
  assert.equal(plan.startingCandidateCount, 34);
  assert.equal(plan.remainingCountyCount, 220);
  assert.equal(new Set(plan.existingFips).size, 34);
  assert.ok(['48051', '48455', '48469'].every(fips => plan.existingFips.includes(fips)));
});

test('FIPS ordering and default batches are deterministic', () => {
  const fips = plan.batches.flatMap(batch => batch.counties.map(county => county.fips));
  assert.deepEqual(fips, [...fips].sort());
  assert.deepEqual(plan.batches.map(batch => [batch.id, batch.counties.length]), [
    ['batch-01', 25], ['batch-02', 25], ['batch-03', 25], ['batch-04', 25], ['batch-05', 25],
    ['batch-06', 25], ['batch-07', 25], ['batch-08', 25], ['batch-09', 20]
  ]);
  assert.equal(planCsv(plan).trim().split('\n').length, 221);
});

test('completed live manifest leaves no counties to renumber or rebuild', () => {
  const override = createPlan(registry, manifest, 40);
  assert.deepEqual(override.batches, []);
  assert.equal(override.remainingCountyCount, 0);
  assert.equal(override.startingCandidateCount, 254);
  assert.equal(new Set(override.existingFips).size, 254);
});

test('CLI enforces modes and supports required options', () => {
  assert.deepEqual(parseArguments(['--gdb', 'Texas-2026.gdb', '--batch-size', '10', '--batch', '2', '--resume', '--reports', 'out']),
    { batchSize: 10, gdb: 'Texas-2026.gdb', batch: 2, resume: true, reports: 'out' });
  assert.throws(() => parseArguments(['--all', '--dry-run']), /exactly one/);
  assert.throws(() => parseArguments(['--all']), /--gdb is required/);
});

test('dry-run writes plans and creates no package artifacts', async () => {
  const reports = await mkdtemp(join(tmpdir(), 'lp130-dry-run-'));
  const governedPaths = ['evidence/lp130/statewide-batch-plan.csv', 'evidence/lp130/statewide-batch-plan.json'];
  const governedBefore = await Promise.all(governedPaths.map(path => readFile(new URL(path, root))));
  const before = new Set(await readdir(new URL('data/generated/lp104/txgio-addresses/', root)));
  try {
    const result = await run({ dryRun: true, batchSize: 25, reports, registry, aggregate: manifest });
    assert.equal(result.manufactured, false);
    assert.deepEqual((await readdir(reports)).sort(), ['statewide-batch-plan.csv', 'statewide-batch-plan.json']);
    assert.deepEqual(new Set(await readdir(new URL('data/generated/lp104/txgio-addresses/', root))), before);
    assert.deepEqual(await Promise.all(governedPaths.map(path => readFile(new URL(path, root)))), governedBefore);
  } finally {
    await rm(reports, { recursive: true, force: true });
  }
});

test('planning never activates or changes the production runtime manifest', async () => {
  const productionAfter = await readFile(new URL('data/generated/lp104/txgio-addresses/runtime-manifest.json', root));
  assert.deepEqual(productionAfter, productionBefore);
  assert.equal(plan.activated, false);
  assert.equal(plan.candidateOnly, true);
});

test('Batch 1 completion records certification blockers without integrity failures', () => {
  assert.deepEqual([completion.manufacturedCountyCount, completion.certificationPassCount, completion.certificationBlockedCount, completion.packageIntegrityFailureCount], [25, 22, 3, 0]);
  assert.deepEqual(completion.certificationBlocked.map(item => item.fips), ['48019', '48027', '48043']);
  assert.deepEqual(completion.certificationBlocked.map(item => item.failureReasons[0]), ['canonical road alias failed', 'exact address sample failed', 'exact address sample failed']);
  assert.deepEqual(completion.resumeFips, []);
  assert.equal(completion.candidateOnly, true); assert.equal(completion.activated, false); assert.equal(completion.runtimeActivationProhibited, true);
  assert.deepEqual(completion.manifestReconciliation, { baselinePackageCount: 34, currentPackageCount: 59, actualNewUniqueFipsCount: 25, uniqueFips: true, uniqueOutputBasenames: true });
});

test('saved governed plan is stable while the live manifest may grow', () => {
  assert.deepEqual([plan.startingCandidateCount, plan.remainingCountyCount, plan.batchCount], [34, 220, 9]);
  assert.deepEqual(plan.batches[0].counties.map(item => item.fips), ['48001','48003','48005','48007','48009','48011','48013','48017','48019','48021','48023','48025','48027','48029','48031','48033','48035','48037','48043','48045','48047','48049','48053','48055','48059']);
  const grown = structuredClone(manifest);
  grown.packages.push(...plan.batches[0].counties.map(({ countyId, fips }) => ({ fips, outputPath: `${countyId}-${fips}.addresses.jsonl.gz` })));
  assert.equal(new Set(grown.packages.map(item => item.fips)).size, 254);
  assert.deepEqual([plan.remainingCountyCount, plan.batchCount], [220, 9]);
});

test('resume and failures remain explicit in runner implementation', async () => {
  const source = await readFile(new URL('tools/lp130/manufacture-remaining-texas-addresses.mjs', root), 'utf8');
  assert.match(source, /options\.resume && await isComplete/);
  assert.match(source, /statewide-resume-list\.txt/);
  assert.match(source, /CERTIFICATION_BLOCKED/);
  assert.match(source, /const actualNewFips = new Set/);
  assert.match(source, /passed: passed\.map/);
  assert.match(source, /certificationBlocked: certificationBlocked\.map/);
  assert.doesNotMatch(source, /--force/);
});

test('documentation contains exact owner commands and candidate-only boundary', async () => {
  const docs = await readFile(new URL('docs/LP130-TEXAS-ADDRESS-EXPANSION-WAVE-4.md', root), 'utf8');
  for (const option of ['--dry-run', '--batch 1', '--all', '--resume', '--batch-size 25', '--reports "reports/lp130-statewide-addresses"']) assert.match(docs, new RegExp(option.replaceAll('-', '\\-')));
  assert.match(docs, /C:\\GitHub\\Gridly-Source-Data\\Texas-Address-Points\\Raw\\Texas-2026\.gdb/);
  assert.match(docs, /All outputs are inactive candidates/);
});
