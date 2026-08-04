#!/usr/bin/env node

/** LP130 owner-local statewide candidate manufacturing. Nothing in this file activates runtime data. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { manufacture, sha256File } from '../lp1051/manufacture-gridly-28-address-counties.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY = join(ROOT, 'data/lp104/texas-counties.json');
const PACKAGE_DIR = join(ROOT, 'data/generated/lp104/txgio-addresses');
const AGGREGATE = join(PACKAGE_DIR, 'manifest.json');
const PRODUCTION = join(PACKAGE_DIR, 'runtime-manifest.json');
const EVIDENCE = join(ROOT, 'evidence/lp130');
const DEFAULT_REPORTS = join(ROOT, 'reports/lp130-statewide-addresses');
export const DEFAULT_BATCH_SIZE = 25;

async function atomic(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, path);
}
const json = (path, value) => atomic(path, `${JSON.stringify(value, null, 2)}\n`);
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));

export function parseArguments(argv) {
  const options = { batchSize: DEFAULT_BATCH_SIZE };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--all', '--resume', '--dry-run'].includes(arg)) options[arg.slice(2).replace('dry-run', 'dryRun')] = true;
    else if (['--gdb', '--batch-size', '--batch', '--reports'].includes(arg)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace('batch-size', 'batchSize')] = argv[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  options.batchSize = Number(options.batchSize);
  if (!Number.isSafeInteger(options.batchSize) || options.batchSize < 1) throw new Error('--batch-size must be a positive integer');
  if (options.batch !== undefined) options.batch = Number(options.batch);
  if (options.batch !== undefined && (!Number.isSafeInteger(options.batch) || options.batch < 1)) throw new Error('--batch must be a positive integer');
  if ([Boolean(options.all), options.batch !== undefined, Boolean(options.dryRun)].filter(Boolean).length !== 1) throw new Error('Choose exactly one of --dry-run, --batch <number>, or --all');
  if (!options.dryRun && !options.gdb) throw new Error('--gdb is required for manufacturing');
  return options;
}

export function createPlan(registry, aggregate, batchSize = DEFAULT_BATCH_SIZE) {
  if (registry.count !== 254 || registry.counties.length !== 254) throw new Error('Official Texas registry must contain exactly 254 counties');
  const officialFips = registry.counties.map(county => county.fips);
  const existingFips = aggregate.packages.map(item => item.fips);
  const packageNames = aggregate.packages.map(item => item.outputPath.split(/[\\/]/).at(-1));
  if (new Set(officialFips).size !== officialFips.length) throw new Error('Official registry contains duplicate FIPS identities');
  if (new Set(existingFips).size !== existingFips.length) throw new Error('Aggregate manifest contains duplicate FIPS identities');
  if (new Set(packageNames).size !== packageNames.length) throw new Error('Aggregate manifest contains duplicate package names');
  const represented = new Set(existingFips);
  const remaining = registry.counties.filter(county => !represented.has(county.fips)).sort((a, b) => a.fips.localeCompare(b.fips));
  const batches = [];
  for (let offset = 0; offset < remaining.length; offset += batchSize) {
    const number = batches.length + 1;
    batches.push({ id: `batch-${String(number).padStart(2, '0')}`, number, counties: remaining.slice(offset, offset + batchSize).map(county => ({ countyId: county.countyId, county: `${county.countyName} County`, fips: county.fips })) });
  }
  return { schemaVersion: 'gridly-lp130-statewide-batch-plan-v1', milestone: 'LP130', officialCountyCount: 254,
    startingCandidateCount: existingFips.length, remainingCountyCount: remaining.length, batchSize, batchCount: batches.length,
    ordering: 'ascending official five-digit FIPS', candidateOnly: true, activated: false, existingFips: [...existingFips].sort(), batches };
}

export function planCsv(plan) {
  return ['batch,batchNumber,position,countyId,county,fips', ...plan.batches.flatMap(batch => batch.counties.map((county, i) =>
    `${batch.id},${batch.number},${i + 1},${county.countyId},${county.county},${county.fips}`))].join('\n') + '\n';
}

async function inspectCounty(county, batchDirectory) {
  const stem = `${county.countyId}-${county.fips}`;
  const packagePath = join(PACKAGE_DIR, `${stem}.addresses.jsonl.gz`);
  const sidecarPath = `${packagePath}.json`;
  const certificatePath = join(batchDirectory, 'certificates', `${stem}.runtime-certificate.json`);
  const certificationPath = join(batchDirectory, 'certification', `${stem}.certification.json`);
  const [sidecar, certificate, certification, packageStat] = await Promise.all([readJson(sidecarPath), readJson(certificatePath), readJson(certificationPath), stat(packagePath)]);
  const hash = await sha256File(packagePath);
  let records = 0;
  const input = createReadStream(packagePath).pipe(createGunzip());
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (record.f !== county.fips || record.c !== county.county.replace(/ County$/, '')) throw new Error(`${county.fips}: JSONL county identity mismatch`);
    records += 1;
  }
  const reconciled = sidecar.sourceRecordsRead === sidecar.acceptedRecords + sidecar.rejectedRecords + sidecar.duplicates;
  if (!reconciled || records !== sidecar.acceptedRecords || packageStat.size !== sidecar.outputBytes || hash !== sidecar.packageHash ||
      certificate.fips !== county.fips || certificate.sizeBytes !== packageStat.size || certificate.sha256 !== hash ||
      certification.countyFips !== county.fips || certification.packageSize !== packageStat.size || certification.sha256 !== hash ||
      certification.indexedAddressCount !== records || certification.certificationStatus !== 'PASS') throw new Error(`${county.fips}: package metadata validation failed`);
  return { ...county, package: `${stem}.addresses.jsonl.gz`, sizeBytes: packageStat.size, sha256: hash, records, status: 'PASS' };
}

async function isComplete(county, batchDirectory) { try { return await inspectCounty(county, batchDirectory); } catch { return null; } }

async function writePlan(plan, reports) {
  await Promise.all([json(join(EVIDENCE, 'statewide-batch-plan.json'), plan), atomic(join(EVIDENCE, 'statewide-batch-plan.csv'), planCsv(plan)),
    json(join(reports, 'statewide-batch-plan.json'), plan), atomic(join(reports, 'statewide-batch-plan.csv'), planCsv(plan))]);
}

export async function run(options, dependencies = {}) {
  const reports = resolve(options.reports || DEFAULT_REPORTS);
  const registry = options.registry || await readJson(REGISTRY);
  const aggregate = options.aggregate || await readJson(AGGREGATE);
  const computedPlan = createPlan(registry, aggregate, options.batchSize || DEFAULT_BATCH_SIZE);
  // Once manufacturing starts, the aggregate grows. Preserve the original cohort and batch identities across owner invocations.
  const savedPlan = !options.dryRun && !options.registry && !options.aggregate
    ? await readJson(join(reports, 'statewide-batch-plan.json')).catch(() => null) : null;
  const plan = savedPlan?.batchSize === computedPlan.batchSize ? savedPlan : computedPlan;
  await writePlan(plan, reports);
  if (options.dryRun) return { plan, manufactured: false };
  const selected = options.all ? plan.batches : [plan.batches[options.batch - 1]];
  if (selected.some(item => !item)) throw new Error(`Batch ${options.batch} does not exist`);
  const productionBefore = await sha256File(PRODUCTION);
  const progress = [];
  const failures = [];
  for (const batch of selected) {
    const batchDirectory = join(reports, batch.id);
    const aggregateBefore = await readJson(AGGREGATE);
    const skipped = [], pending = [];
    for (const county of batch.counties) {
      const complete = options.resume && await isComplete(county, batchDirectory);
      if (complete) skipped.push(complete); else pending.push(county);
    }
    let manufacturingResult;
    if (pending.length) manufacturingResult = await (dependencies.manufacture || manufacture)({ fips: pending.map(item => item.fips).join(','), gdb: options.gdb, reports: batchDirectory });
    const completed = [], batchFailures = [];
    for (const county of pending) {
      try { completed.push(await inspectCounty(county, batchDirectory)); }
      catch (error) { batchFailures.push({ ...county, failure: error.message }); }
    }
    // The candidate surface is deliberately the complete batch cohort, including valid resumed counties.
    const valid = [...skipped, ...completed].sort((a, b) => a.fips.localeCompare(b.fips));
    const aggregateAfter = await readJson(AGGREGATE);
    const afterFips = aggregateAfter.packages.map(item => item.fips);
    const afterNames = aggregateAfter.packages.map(item => item.outputPath.split(/[\\/]/).at(-1));
    const beforeFips = new Set(aggregateBefore.packages.map(item => item.fips));
    const newlyCompleted = completed.filter(item => !beforeFips.has(item.fips)).length;
    if (aggregateAfter.packages.length !== aggregateBefore.packages.length + newlyCompleted ||
        new Set(afterFips).size !== afterFips.length || new Set(afterNames).size !== afterNames.length) {
      throw new Error(`${batch.id}: aggregate manifest count or uniqueness validation failed`);
    }
    await json(join(batchDirectory, 'runtime-manifest.candidate.json'), { schemaVersion: 1, milestone: 'LP130-candidate', batch: batch.id, activated: false,
      packages: valid.map(item => ({ countyId: `${item.countyId}-tx`, county: item.county, fips: item.fips, path: `data/generated/lp104/txgio-addresses/${item.package}`, sizeBytes: item.sizeBytes, sha256: item.sha256,
        certificate: `reports/lp130-statewide-addresses/${batch.id}/certificates/${item.package.replace('.addresses.jsonl.gz', '.runtime-certificate.json')}` })) });
    await json(join(batchDirectory, 'validation-report.json'), { schemaVersion: 'gridly-lp130-batch-validation-v1', batch: batch.id,
      expectedCountyCount: batch.counties.length, completedCountyCount: valid.length, status: valid.length === batch.counties.length && !batchFailures.length ? 'PASS' : 'FAIL', counties: valid, failures: batchFailures });
    await json(join(batchDirectory, 'package-hashes.json'), { schemaVersion: 'gridly-lp130-package-hashes-v1', batch: batch.id,
      packages: valid.map(({ fips, package: name, sizeBytes, sha256 }) => ({ fips, package: name, sizeBytes, sha256 })) });
    progress.push({ batch: batch.id, expected: batch.counties.length, skipped: skipped.map(item => item.fips), completed: completed.map(item => item.fips), failed: batchFailures.map(item => item.fips), status: batchFailures.length || valid.length !== batch.counties.length ? 'INCOMPLETE' : 'COMPLETE' });
    failures.push(...batchFailures.map(item => ({ batch: batch.id, ...item })));
    void manufacturingResult;
    process.stdout.write(`${batch.id}: ${valid.length}/${batch.counties.length} complete; ${batchFailures.length} failed.\nFiles ready to stage: data/generated/lp104/txgio-addresses, ${batchDirectory}\nCommit: Add Texas statewide address batch ${batch.id.slice(-2)}\n`);
  }
  if (await sha256File(PRODUCTION) !== productionBefore) throw new Error('Production runtime manifest changed during LP130 orchestration');
  const resumeFips = failures.map(item => item.fips).sort();
  await Promise.all([json(join(reports, 'statewide-progress.json'), { schemaVersion: 'gridly-lp130-progress-v1', candidateOnly: true, activated: false, batches: progress }),
    json(join(reports, 'statewide-failures.json'), { schemaVersion: 'gridly-lp130-failures-v1', failures }), atomic(join(reports, 'statewide-resume-list.txt'), resumeFips.join('\n') + (resumeFips.length ? '\n' : ''))]);
  return { plan, progress, failures, manufactured: true };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const result = await run(options);
  if (options.dryRun) process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\nDry run only; no packages manufactured.\n`);
  if (result.failures?.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
