import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPlan, parseArguments, planCsv, run } from '../tools/lp130/manufacture-remaining-texas-addresses.mjs';

const root = new URL('../', import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const registry = await readJson('data/lp104/texas-counties.json');
const manifest = await readJson('data/generated/lp104/txgio-addresses/manifest.json');
const productionBefore = await readFile(new URL('data/generated/lp104/txgio-addresses/runtime-manifest.json', root));
const plan = createPlan(registry, manifest, 25);

test('official, existing, and remaining identities reconcile without duplicates', () => {
  assert.equal(registry.counties.length, 254);
  assert.equal(new Set(registry.counties.map(item => item.fips)).size, 254);
  assert.equal(plan.startingCandidateCount, 34);
  assert.equal(plan.remainingCountyCount, 220);
  assert.equal(new Set(manifest.packages.map(item => item.fips)).size, 34);
  assert.equal(new Set(manifest.packages.map(item => item.outputPath.split(/[\\/]/).at(-1))).size, 34);
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

test('batch size override is deterministic and existing candidates are excluded', () => {
  const override = createPlan(registry, manifest, 40);
  assert.deepEqual(override.batches.map(batch => batch.counties.length), [40, 40, 40, 40, 40, 20]);
  const remaining = new Set(override.batches.flatMap(batch => batch.counties.map(county => county.fips)));
  assert.ok(manifest.packages.every(item => !remaining.has(item.fips)));
});

test('CLI enforces modes and supports required options', () => {
  assert.deepEqual(parseArguments(['--gdb', 'Texas-2026.gdb', '--batch-size', '10', '--batch', '2', '--resume', '--reports', 'out']),
    { batchSize: 10, gdb: 'Texas-2026.gdb', batch: 2, resume: true, reports: 'out' });
  assert.throws(() => parseArguments(['--all', '--dry-run']), /exactly one/);
  assert.throws(() => parseArguments(['--all']), /--gdb is required/);
});

test('dry-run writes plans and creates no package artifacts', async () => {
  const reports = await mkdtemp(join(tmpdir(), 'lp130-dry-run-'));
  const before = new Set(await readdir(new URL('data/generated/lp104/txgio-addresses/', root)));
  const result = await run({ dryRun: true, batchSize: 25, reports, registry, aggregate: manifest });
  assert.equal(result.manufactured, false);
  assert.deepEqual((await readdir(reports)).sort(), ['statewide-batch-plan.csv', 'statewide-batch-plan.json']);
  assert.deepEqual(new Set(await readdir(new URL('data/generated/lp104/txgio-addresses/', root))), before);
});

test('planning never activates or changes the production runtime manifest', async () => {
  const productionAfter = await readFile(new URL('data/generated/lp104/txgio-addresses/runtime-manifest.json', root));
  assert.deepEqual(productionAfter, productionBefore);
  assert.equal(plan.activated, false);
  assert.equal(plan.candidateOnly, true);
});

test('resume and failures remain explicit in runner implementation', async () => {
  const source = await readFile(new URL('tools/lp130/manufacture-remaining-texas-addresses.mjs', root), 'utf8');
  assert.match(source, /options\.resume && await isComplete/);
  assert.match(source, /statewide-resume-list\.txt/);
  assert.match(source, /status: batchFailures\.length.*'INCOMPLETE'/s);
  assert.doesNotMatch(source, /--force/);
});

test('documentation contains exact owner commands and candidate-only boundary', async () => {
  const docs = await readFile(new URL('docs/LP130-TEXAS-ADDRESS-EXPANSION-WAVE-4.md', root), 'utf8');
  for (const option of ['--dry-run', '--batch 1', '--all', '--resume', '--batch-size 25', '--reports "reports/lp130-statewide-addresses"']) assert.match(docs, new RegExp(option.replaceAll('-', '\\-')));
  assert.match(docs, /C:\\GitHub\\Gridly-Source-Data\\Texas-Address-Points\\Raw\\Texas-2026\.gdb/);
  assert.match(docs, /All outputs are inactive candidates/);
});
