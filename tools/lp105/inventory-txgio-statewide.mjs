#!/usr/bin/env node

/** LP105 read-only, aggregate-only TxGIO county source inventory. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COUNTY_FILE = join(ROOT, 'data/lp104/texas-counties.json');
const SOURCE_FILE = join(ROOT, 'data/lp104/txgio-2026-address-source.json');
const LICENSE_FILE = join(ROOT, 'data/lp105/txgio-license-decision.json');
const DEFAULT_REPORTS = join(ROOT, 'data/generated/lp105');
export const DEFAULT_CONCURRENCY = 1;
export const REQUIRED_LICENSE_FIELDS = ['redistributionApproved', 'derivativePackagesApproved', 'publicBrowserDeliveryApproved', 'residentialAddressDistributionApproved', 'attributionTextApproved', 'retentionTermsApproved'];

const valueAfter = (argv, index) => { if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${argv[index]} requires a value`); return argv[index + 1]; };
export function parseArguments(argv) {
  const options = { concurrency: DEFAULT_CONCURRENCY, name: 'texas-statewide-source-inventory', resume: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--gridly-counties', '--all-texas', '--force', '--resume'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--gdb', '--gdal', '--reports', '--name', '--fips', '--concurrency'].includes(arg)) { options[arg.slice(2)] = valueAfter(argv, i); i += 1; }
    else throw new Error(`Unknown option: ${arg}`);
  }
  const modes = ['gridly-counties', 'all-texas', 'fips'].filter(key => options[key]);
  if (!options.help && modes.length !== 1) throw new Error('Choose exactly one of --fips, --gridly-counties, or --all-texas');
  options.concurrency = Number(options.concurrency);
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 4) throw new Error('--concurrency must be an integer from 1 through 4');
  return options;
}

export function selectCounties(options, manifest) {
  if (options['all-texas']) return [...manifest.counties];
  if (options['gridly-counties']) return manifest.counties.filter(c => c.certificationCohort === 'initial28');
  const requested = [...new Set(options.fips.split(',').map(v => v.trim().padStart(5, '0')).filter(Boolean))];
  const selected = requested.map(fips => manifest.counties.find(c => c.fips === fips));
  if (selected.some(c => !c)) throw new Error('One or more requested FIPS codes are absent from the maintained Texas county manifest');
  return selected;
}

export function licenseIsApproved(license) { return REQUIRED_LICENSE_FIELDS.every(field => license[field] === true) && Boolean(license.approvalEvidenceReference && license.reviewedBy && license.reviewedAt); }
export function estimateSizes(usable, evidence) {
  const compressedPerRecord = evidence.compressedBytes / evidence.acceptedRecords;
  const uncompressedPerRecord = evidence.uncompressedBytes / evidence.acceptedRecords;
  return { estimatedCompressedPackageBytes: Math.round(usable * compressedPerRecord), estimatedUncompressedPackageBytes: Math.round(usable * uncompressedPerRecord), sizeEstimateMethod: `Liberty accepted-record baseline (${compressedPerRecord.toFixed(2)} compressed and ${uncompressedPerRecord.toFixed(2)} uncompressed bytes/record; estimates, not artifacts)` };
}

export function privacySafeSourceIdentity(gdb, config, metadata) {
  const datasetName = basename(String(gdb).replaceAll('\\', '/')); const portable = { datasetName, sourceName: config.sourceName, sourceLayer: config.layer, sourceRecordCountDeclared: config.statewideRecordCount, directorySizeBytes: metadata.size, directoryModifiedAt: metadata.mtime.toISOString() };
  return { ...portable, fingerprint: createHash('sha256').update(JSON.stringify(portable)).digest('hex'), sourcePathExcludedFromReport: true };
}
let atomicSequence = 0;
export async function atomicJson(path, value) { const temp = `${path}.${process.pid}.${atomicSequence += 1}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); await rename(temp, path); }

export function aggregateSql(layer, fips) {
  return `SELECT COUNT(*) AS raw_count, SUM(CASE WHEN geometry IS NOT NULL THEN 1 ELSE 0 END) AS valid_coordinate_count, SUM(CASE WHEN Add_Number IS NOT NULL AND TRIM(CAST(Add_Number AS TEXT)) <> '' THEN 1 ELSE 0 END) AS valid_house_count, SUM(CASE WHEN St_Name IS NOT NULL AND TRIM(St_Name) <> '' THEN 1 ELSE 0 END) AS valid_street_count, SUM(CASE WHEN geometry IS NOT NULL AND Add_Number IS NOT NULL AND TRIM(CAST(Add_Number AS TEXT)) <> '' AND St_Name IS NOT NULL AND TRIM(St_Name) <> '' AND Full_Addr IS NOT NULL AND TRIM(Full_Addr) <> '' THEN 1 ELSE 0 END) AS usable_count FROM "${layer.replaceAll('"', '""')}" WHERE FIPS = ${Number(fips)}`;
}

async function executable(gdal) {
  let candidate = gdal || process.env.GRIDLY_GDAL_OGRINFO || process.env.OGRINFO || 'ogrinfo';
  if (candidate !== 'ogrinfo') { candidate = resolve(candidate); if ((await stat(candidate).catch(() => null))?.isDirectory()) candidate = join(candidate, process.platform === 'win32' ? 'ogrinfo.exe' : 'ogrinfo'); await access(candidate).catch(() => { throw new Error(`GDAL ogrinfo was not found at ${candidate}`); }); }
  return candidate;
}

export async function queryCounty(command, gdb, config, county, { spawnImpl = spawn, heartbeatMs = 15000 } = {}) {
  const args = ['-ro', '-q', '-json', gdb, '-dialect', 'SQLITE', '-sql', aggregateSql(config.layer, county.fips)];
  const child = spawnImpl(command, args, { windowsHide: true }); let stdout = ''; let stderr = '';
  child.stdout?.setEncoding('utf8'); child.stderr?.setEncoding('utf8'); child.stdout?.on('data', v => { stdout += v; }); child.stderr?.on('data', v => { stderr += v; });
  const heartbeat = setInterval(() => process.stdout.write(`[${county.fips}] GDAL aggregate query is still active...\n`), heartbeatMs);
  const code = await new Promise((ok, fail) => { child.once('error', fail); child.once('close', ok); }).finally(() => clearInterval(heartbeat));
  if (code !== 0) throw new Error(`ogrinfo exited ${code}: ${stderr.trim() || 'no diagnostic output'}`);
  const json = JSON.parse(stdout); const p = json.features?.[0]?.properties;
  if (!p) throw new Error('ogrinfo returned no aggregate result');
  return { raw: Number(p.raw_count || 0), coordinates: Number(p.valid_coordinate_count || 0), houses: Number(p.valid_house_count || 0), streets: Number(p.valid_street_count || 0), usable: Number(p.usable_count || 0) };
}

export function countyResult(county, counts, context) {
  const raw = counts.raw; const usable = counts.usable; const warnings = ['Package sizes are estimates; street lengths, compression ratios, rejection variation, and source order may differ.'];
  if (raw > 500000) warnings.push('Dense urban county: runtime and compression behavior require later pilot validation.');
  if (raw > 0 && usable / raw < 0.8) warnings.push('Potentially usable percentage is below 80%; data-quality review required.');
  const licensingApproved = licenseIsApproved(context.license); const qualityReady = raw > 0 && usable / raw >= 0.8;
  let inventoryStatus = raw === 0 ? 'SOURCE_EMPTY' : qualityReady ? (licensingApproved ? 'SOURCE_READY' : 'BLOCKED_LICENSE') : 'BLOCKED_DATA_QUALITY';
  return { countyId: county.countyId, countyName: county.countyName, countyFips: county.fips, sourcePresent: raw > 0, rawRecordCount: raw, validCoordinateCount: counts.coordinates, invalidCoordinateCount: raw - counts.coordinates, validHouseNumberCount: counts.houses, missingHouseNumberCount: raw - counts.houses, validStreetNameCount: counts.streets, missingStreetNameCount: raw - counts.streets, potentiallyUsableRecordCount: usable, rejectedEstimateCount: raw - usable, usablePercentage: raw ? Number((usable * 100 / raw).toFixed(2)) : 0, ...estimateSizes(usable, context.evidence), inventoryStatus, inventoryWarnings: warnings, inspectedAt: context.now(), sourceIdentity: context.sourceIdentity.fingerprint, sourceLayer: context.config.layer, sourceRecordCountDeclared: context.config.statewideRecordCount, sourcePathExcludedFromReport: true };
}
export function failureResult(county, context, error) { return { countyId: county.countyId, countyName: county.countyName, countyFips: county.fips, sourcePresent: false, rawRecordCount: 0, validCoordinateCount: 0, invalidCoordinateCount: 0, validHouseNumberCount: 0, missingHouseNumberCount: 0, validStreetNameCount: 0, missingStreetNameCount: 0, potentiallyUsableRecordCount: 0, rejectedEstimateCount: 0, usablePercentage: 0, ...estimateSizes(0, context.evidence), inventoryStatus: 'SOURCE_QUERY_FAILED', inventoryWarnings: [`Aggregate query failed: ${error.message}`], inspectedAt: context.now(), sourceIdentity: context.sourceIdentity.fingerprint, sourceLayer: context.config.layer, sourceRecordCountDeclared: context.config.statewideRecordCount, sourcePathExcludedFromReport: true }; }

const sum = (rows, field) => rows.reduce((n, row) => n + row[field], 0);
export function buildSummary(rows, context, run) {
  const sorted = [...rows].sort((a, b) => a.countyFips.localeCompare(b.countyFips)); const successful = sorted.filter(r => r.inventoryStatus !== 'SOURCE_QUERY_FAILED'); const gridly = new Set(context.manifest.counties.filter(c => c.certificationCohort === 'initial28').map(c => c.fips));
  const group = values => ({ countyCount: values.length, rawRecordCount: sum(values, 'rawRecordCount'), potentiallyUsableRecordCount: sum(values, 'potentiallyUsableRecordCount'), estimatedCompressedPackageBytes: sum(values, 'estimatedCompressedPackageBytes'), estimatedUncompressedPackageBytes: sum(values, 'estimatedUncompressedPackageBytes') });
  const ranked = [...successful].sort((a, b) => a.potentiallyUsableRecordCount - b.potentiallyUsableRecordCount || a.countyFips.localeCompare(b.countyFips)); const failures = sorted.filter(r => r.inventoryStatus === 'SOURCE_QUERY_FAILED');
  return { schemaVersion: 'gridly-lp105-statewide-source-inventory-v1', sourceIdentity: context.sourceIdentity, runConfiguration: run, startedAt: run.startedAt, completedAt: context.now(), countyCountRequested: sorted.length, countyCountInspected: sorted.length, countyCountSuccessful: successful.length, countyCountFailed: failures.length, rawStatewideRecordTotalObserved: sum(successful, 'rawRecordCount'), potentiallyUsableStatewideTotal: sum(successful, 'potentiallyUsableRecordCount'), estimatedCompressedStatewideBytes: sum(successful, 'estimatedCompressedPackageBytes'), estimatedUncompressedStatewideBytes: sum(successful, 'estimatedUncompressedPackageBytes'), smallestCountiesByUsableRecords: ranked.slice(0, 5).map(r => r.countyFips), largestCountiesByUsableRecords: ranked.slice(-5).reverse().map(r => r.countyFips), countiesWithZeroRecords: successful.filter(r => !r.rawRecordCount).map(r => r.countyFips), countiesWithQueryFailures: failures.map(r => r.countyFips), countiesRequiringDataReview: sorted.filter(r => ['BLOCKED_DATA_QUALITY', 'SOURCE_PRESENT_REVIEW_REQUIRED'].includes(r.inventoryStatus)).map(r => r.countyFips), currentGridly28Summary: group(sorted.filter(r => gridly.has(r.countyFips))), remaining226Summary: group(sorted.filter(r => !gridly.has(r.countyFips))), statewideSourceCoveragePercentage: Number((successful.filter(r => r.sourcePresent).length * 100 / sorted.length).toFixed(2)), statewideInventoryPass: sorted.length === 254 && failures.length === 0 && successful.every(r => r.sourcePresent), licensingGateStatus: licenseIsApproved(context.license) ? 'APPROVED' : 'BLOCKED_UNRESOLVED', productionEligibilityStatus: licenseIsApproved(context.license) && failures.length === 0 ? 'DATA_REVIEW_REQUIRED' : 'BLOCKED', sizeEstimateUncertainty: { rangeMultiplier: [0.65, 1.5], warnings: ['Dense urban counties', 'Unusual street-string lengths', 'Varying compression ratios', 'Rejected-record variation', 'Source-order differences'] }, counties: sorted };
}

export function buildLedger(manifest, rows, oldLedger) {
  const byFips = new Map(rows.map(r => [r.countyFips, r])); const old = new Map((oldLedger?.counties || []).map(r => [r.fips, r]));
  return { schemaVersion: 'gridly-lp105-coverage-ledger-v1', countyCount: 254, counties: manifest.counties.map(c => { const prior = old.get(c.fips) || {}; const row = byFips.get(c.fips); return { countyId: c.countyId, countyName: c.countyName, countyFips: c.fips, sourcePresent: row?.sourcePresent || false, sourceInventoried: Boolean(row && row.inventoryStatus !== 'SOURCE_QUERY_FAILED'), sourceUsableEstimate: row?.potentiallyUsableRecordCount || 0, licensingApproved: false, productionEligible: false, packageBuilt: prior.buildStatus === 'built' || prior.fips === '48291', packageCertified: prior.certificationStatus === 'certified' || prior.fips === '48291', runtimeActivated: prior.activationStatus === 'active' || prior.fips === '48291' }; }) };
}

export function markdown(summary) { return `# LP105 Texas source inventory\n\n> Aggregate-only readiness evidence. No address rows or packages are included. Sizes are estimates.\n\n- Inspected: ${summary.countyCountInspected}/${summary.countyCountRequested}\n- Successful: ${summary.countyCountSuccessful}; failed: ${summary.countyCountFailed}\n- Raw observed: ${summary.rawStatewideRecordTotalObserved.toLocaleString()}\n- Potentially usable: ${summary.potentiallyUsableStatewideTotal.toLocaleString()}\n- Source coverage: ${summary.statewideSourceCoveragePercentage}%\n- Licensing: **${summary.licensingGateStatus}**\n- Production eligibility: **${summary.productionEligibilityStatus}**\n\n## Failures\n${summary.countiesWithQueryFailures.length ? summary.countiesWithQueryFailures.join(', ') : 'None'}\n\n## Zero-record counties\n${summary.countiesWithZeroRecords.length ? summary.countiesWithZeroRecords.join(', ') : 'None'}\n` ; }

export function buildPilotReport(summary) {
  const rows = summary.counties.filter(r => r.inventoryStatus !== 'SOURCE_QUERY_FAILED' && r.sourcePresent); const byFips = new Map(rows.map(r => [r.countyFips, r]));
  const largest = [...rows].sort((a,b) => b.potentiallyUsableRecordCount - a.potentiallyUsableRecordCount || a.countyFips.localeCompare(b.countyFips))[0];
  const profiles = [
    ['maximum-density urban', largest, 'Peak package size and browser-memory pressure'],
    ['mixed urban/rural', byFips.get('48339') || rows[Math.floor(rows.length * .65)], 'Mixed road naming and density'],
    ['low-density rural', byFips.get('48407') || rows[Math.floor(rows.length * .15)], 'Sparse coverage and rejection sensitivity'],
    ['major metro outside current footprint', byFips.get('48029') || rows[Math.floor(rows.length * .8)], 'Large metro outside current footprint'],
    ['sparse or geographically large', byFips.get('48043') || byFips.get('48377') || rows[0], 'Large geography and sparse points']
  ];
  return { schemaVersion: 'gridly-lp105-pilot-candidates-v1', generatedFrom: summary.runConfiguration.reportName, packagesBuilt: false, candidates: profiles.filter(([,r]) => r).map(([profile, r, risk]) => ({ profile, county: r.countyName, countyFips: r.countyFips, sourceRecordCount: r.rawRecordCount, potentiallyUsableCount: r.potentiallyUsableRecordCount, estimatedPackageSizeBytes: r.estimatedCompressedPackageBytes, operationalValue: `Exercises the ${profile} profile using observed inventory evidence.`, principalRiskTested: risk, licensingStatus: summary.licensingGateStatus, eligibleForFuturePilot: summary.licensingGateStatus === 'APPROVED' && r.inventoryStatus === 'SOURCE_READY' })) };
}

export async function run(options, dependencies = {}) {
  const now = dependencies.now || (() => new Date().toISOString()); const manifest = JSON.parse(await readFile(COUNTY_FILE)); const config = JSON.parse(await readFile(SOURCE_FILE)); const license = JSON.parse(await readFile(LICENSE_FILE));
  const counties = selectCounties(options, manifest); const configuredGdb = options.gdb || process.env.GRIDLY_TXGIO_GDB; if (!configuredGdb) throw new Error('Pass --gdb or set GRIDLY_TXGIO_GDB'); const gdb = resolve(configuredGdb); await access(gdb).catch(() => { throw new Error('Immutable TxGIO geodatabase is unavailable. Pass --gdb or set GRIDLY_TXGIO_GDB.'); });
  const reports = resolve(options.reports || DEFAULT_REPORTS); await mkdir(reports, { recursive: true }); const metadata = await stat(gdb); const sourceIdentity = privacySafeSourceIdentity(gdb, config, metadata); const evidence = { acceptedRecords: 54368, compressedBytes: 2555016, uncompressedBytes: 11498625 };
  const context = { now, manifest, config, license, sourceIdentity, evidence }; const checkpointPath = join(reports, `${options.name}.checkpoint.json`); let checkpoint = null;
  if (!options.force && options.resume) checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8').catch(() => 'null'));
  if (checkpoint && checkpoint.sourceIdentity.fingerprint !== sourceIdentity.fingerprint) throw new Error('Resume refused: source identity changed. Use --force to start a replacement inventory.');
  const completed = new Map((checkpoint?.counties || []).filter(r => r.inventoryStatus !== 'SOURCE_QUERY_FAILED').map(r => [r.countyFips, r])); const results = []; const command = dependencies.command || await executable(options.gdal); const startedAt = checkpoint?.startedAt || now();
  let checkpointWrite = Promise.resolve(); let cursor = 0; async function worker() { while (true) { const index = cursor++; if (index >= counties.length) return; const county = counties[index]; if (completed.has(county.fips)) { process.stdout.write(`[${index + 1}/${counties.length}] resume skip ${county.countyName} (${county.fips})\n`); results.push(completed.get(county.fips)); continue; } const began = Date.now(); process.stdout.write(`[${index + 1}/${counties.length}] query start ${county.countyName} (${county.fips})\n`); let result; try { const counts = await (dependencies.queryCounty || queryCounty)(command, gdb, config, county); result = countyResult(county, counts, context); process.stdout.write(`[${index + 1}/${counties.length}] query complete raw=${counts.raw} usable=${counts.usable} elapsed=${Date.now() - began}ms\n`); } catch (error) { result = failureResult(county, context, error); process.stderr.write(`[${index + 1}/${counties.length}] FAILED ${county.fips}: ${error.message}\n`); } results.push(result); checkpointWrite = checkpointWrite.then(() => atomicJson(checkpointPath, { schemaVersion: 'gridly-lp105-checkpoint-v1', sourceIdentity, startedAt, counties: [...completed.values(), ...results].sort((a,b) => a.countyFips.localeCompare(b.countyFips)) })); await checkpointWrite; } }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, counties.length) }, worker)); const summary = buildSummary(results, context, { mode: options['all-texas'] ? 'all-texas' : options['gridly-counties'] ? 'gridly-counties' : 'fips', concurrency: options.concurrency, reportName: options.name, startedAt });
  await atomicJson(join(reports, `${options.name}.json`), summary); await writeFile(join(reports, `${options.name}.md`), markdown(summary)); await atomicJson(join(reports, `${options.name}.pilot-candidates.json`), buildPilotReport(summary)); const oldLedger = JSON.parse(await readFile(join(ROOT, 'data/lp104/texas-county-coverage.json'))); await atomicJson(join(reports, `${options.name}.coverage-ledger.json`), buildLedger(manifest, results, oldLedger));
  process.stdout.write(`Final: ${summary.countyCountSuccessful} successful, ${summary.countyCountFailed} failed, ${summary.rawStatewideRecordTotalObserved} raw, ${summary.potentiallyUsableStatewideTotal} usable estimate\n`); if (summary.countyCountFailed) process.exitCode = 1; return summary;
}

export function usage() { return `Usage: node tools/lp105/inventory-txgio-statewide.mjs (--fips LIST | --gridly-counties | --all-texas) [--gdb PATH] [--gdal BIN] [--reports DIR] [--name NAME] [--resume] [--force] [--concurrency 1-4]`; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); await run(options); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP105 inventory failed: ${error.message}\n`); process.exitCode = 1; });
