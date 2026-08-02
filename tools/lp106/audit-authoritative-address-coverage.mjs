#!/usr/bin/env node

/** LP106 deterministic, read-only exact-address audit across governed source snapshots. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE_UNAVAILABLE = 'SOURCE UNAVAILABLE / LIVE QUERY NOT EXECUTED';
export const TARGET = Object.freeze({ houseNumber: '274', road: 'COUNTY ROAD 677', city: 'DAYTON', zip: '77535', county: 'LIBERTY', fips: '48291' });

export function parseArguments(argv) {
  const options = { layer: 'stratmap_2026_address_points_48', nadGeodatabase: 'NAD_r23.gdb', nadLayer: 'NAD', reports: join(ROOT, 'reports/lp106') };
  const valued = new Set(['--txgio-gdb', '--nad-archive', '--gdal', '--reports', '--generated-at', '--layer', '--nad-geodatabase', '--nad-layer']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (valued.has(arg)) { if (!argv[i + 1]) throw new Error(`${arg} requires a value`); options[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i]; }
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.generatedAt && Number.isNaN(Date.parse(options.generatedAt))) throw new Error('--generated-at must be an ISO date/time');
  return options;
}

const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const id = value => `"${String(value).replaceAll('"', '""')}"`;
const roadPredicate = field => `UPPER(TRIM(${id(field)})) IN (${['COUNTY ROAD 677', 'COUNTY RD 677', 'CR 677', 'CO RD 677'].map(quote).join(', ')})`;
export function txgioWhere(target = TARGET) {
  const full = `UPPER(TRIM(${id('Full_Addr')}))`;
  const exactRoad = ['COUNTY ROAD 677', 'COUNTY RD 677', 'CR 677', 'CO RD 677'].map(road => `${full} LIKE ${quote(`${target.houseNumber} ${road}%`)}`).join(' OR ');
  return [`CAST(${id('FIPS')} AS INTEGER) = ${Number(target.fips)}`, `CAST(${id('Add_Number')} AS TEXT) = ${quote(target.houseNumber)}`, `(${exactRoad})`, `UPPER(TRIM(${id('Post_Comm')})) = ${quote(target.city)}`, `CAST(${id('Post_Code')} AS TEXT) = ${quote(target.zip)}`].join(' AND ');
}
export function nadWhere(target = TARGET) {
  return [`UPPER(TRIM(${id('State')})) = 'TX'`, `UPPER(TRIM(${id('County')})) = ${quote(target.county)}`, `CAST(${id('Add_Number')} AS TEXT) = ${quote(target.houseNumber)}`, roadPredicate('StNam_Full'), `UPPER(TRIM(${id('Post_City')})) = ${quote(target.city)}`, `CAST(${id('Zip_Code')} AS TEXT) = ${quote(target.zip)}`].join(' AND ');
}
export function queryArguments(datasource, layer, where) { return ['-ro', '-so', '-where', where, datasource, layer]; }

const countFrom = output => String(output || '').match(/^Feature Count:\s*([0-9][0-9,]*)\s*$/mi);
export function redactDiagnostic(value, limit = 400) {
  const redacted = String(value || '')
    .replaceAll(/\b[A-Za-z]:[\\/][^\r\n"'`]+/g, '[WINDOWS SOURCE PATH REDACTED]')
    .replaceAll(/\/vsizip\/[^\s"'`]+/g, '[ARCHIVE SOURCE PATH REDACTED]')
    .replaceAll(/[\r\n\t]+/g, ' ').replaceAll(/\s{2,}/g, ' ').trim();
  return redacted.length > limit ? `${redacted.slice(0, limit)}…` : redacted;
}
export function parseFeatureCount(output) {
  const result = typeof output === 'string' ? { stdout: output, stderr: '', exitCode: 0, signal: null, completed: true } : output;
  const stdoutMatch = countFrom(result?.stdout);
  // Some GDAL distributions route informational output to stderr. Only an
  // anchored Feature Count line is accepted; warnings and feature rows cannot
  // become a count.
  const match = result?.exitCode === 0 ? stdoutMatch || countFrom(result?.stderr) : null;
  if (!match) {
    const stdout = String(result?.stdout || ''); const stderr = String(result?.stderr || '');
    const combined = `${stdout}\n${stderr}`;
    const excerpt = redactDiagnostic(combined) || '(no diagnostic output)';
    throw new Error(`GDAL returned no parseable Feature Count (executable completed: ${result?.completed === true ? 'yes' : 'no'}; exit code: ${result?.exitCode ?? 'unknown'}; stdout length: ${stdout.length}; stderr length: ${stderr.length}; layer appears opened: ${/^Layer name:/mi.test(combined) || /using driver .+ successful/i.test(combined) ? 'yes' : 'no'}; diagnostic excerpt: ${excerpt})`);
  }
  return Number(match[1].replaceAll(',', ''));
}

export async function runOgrinfo(executable, args, { spawnImpl = spawn } = {}) {
  const child = spawnImpl(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
  const { code, signal } = await new Promise((ok, fail) => { child.once('error', () => fail(new Error('ogrinfo could not be started'))); child.once('close', (code, signal) => ok({ code, signal })); });
  return { stdout, stderr, exitCode: code, signal: signal || null, completed: true };
}

async function sha256(path) { const hash = createHash('sha256'); await pipeline(createReadStream(path), hash); return hash.digest('hex'); }
async function directoryFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true }); const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...await directoryFiles(root, path));
    else if (entry.isFile()) files.push({ path, relativePath: relative(root, path).replaceAll('\\', '/') });
  }
  return files;
}
async function identity(path) {
  const initial = await stat(path); const files = initial.isDirectory() ? await directoryFiles(path) : [{ path, relativePath: basename(path) }];
  const hash = createHash('sha256'); let sizeBytes = 0;
  for (const file of files) { const before = await stat(file.path); const digest = await sha256(file.path); const after = await stat(file.path); if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('Immutable source changed during audit'); sizeBytes += before.size; hash.update(`${file.relativePath}\0${before.size}\0${digest}\n`); }
  const final = await stat(path); if (initial.mtimeMs !== final.mtimeMs) throw new Error('Immutable source changed during audit');
  return { fileName: basename(path), fileCount: files.length, sizeBytes, sha256: hash.digest('hex'), sourcePathExcludedFromReport: true };
}
async function atomicJson(path, value) { const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`); await rename(temporary, path); }

export function unavailable(sourceId) { return { sourceId, status: SOURCE_UNAVAILABLE, liveQueryExecuted: false, exactCandidateCount: null, exactFound: null }; }
export function assessment(results) {
  const queried = results.filter(item => item.liveQueryExecuted);
  return {
    status: queried.length === results.length ? 'LIVE_QUERY_COMPLETE' : SOURCE_UNAVAILABLE,
    decision: queried.some(item => item.exactFound) ? 'AUTHORITATIVE_CANDIDATE_REQUIRES_SOURCE_REVIEW' : queried.length === results.length ? 'NO_EXACT_CANDIDATE_IN_QUERIED_SNAPSHOTS' : 'NO SOURCE-PRESENCE CONCLUSION PERMITTED',
    sourceAbsenceClaimed: false,
    productionMutationAuthorized: false,
  };
}

export async function audit(options, dependencies = {}) {
  const ogrinfo = options.gdal || process.env.GRIDLY_GDAL_OGRINFO || process.env.OGRINFO || 'ogrinfo';
  const execute = dependencies.runOgrinfo || runOgrinfo; const identify = dependencies.identity || identity;
  const sources = [];
  const specs = [
    { sourceId: 'txgio-2026-statewide-address-points', path: options.txgioGdb || process.env.GRIDLY_TXGIO_GDB, layer: options.layer, datasource: path => path, where: txgioWhere() },
    { sourceId: 'usdot-nad-r23', path: options.nadArchive || process.env.GRIDLY_NAD_R23_ARCHIVE, layer: options.nadLayer, datasource: path => `/vsizip/${path.replaceAll('\\', '/')}/${options.nadGeodatabase}`, where: nadWhere() },
  ];
  for (const spec of specs) {
    if (!spec.path || !(await stat(resolve(spec.path)).catch(() => null))) { sources.push(unavailable(spec.sourceId)); continue; }
    const path = resolve(spec.path); const sourceIdentity = await identify(path);
    const args = queryArguments(spec.datasource(path), spec.layer, spec.where);
    const exactCandidateCount = parseFeatureCount(await execute(ogrinfo, args));
    sources.push({ sourceId: spec.sourceId, status: 'LIVE QUERY EXECUTED', liveQueryExecuted: true, exactCandidateCount, exactFound: exactCandidateCount > 0, sourceIdentity, query: { method: 'ogrinfo filtered Feature Count', readOnly: true, featureRowsEmitted: false, arguments: args.map((value, index) => index === 4 ? '[IMMUTABLE SOURCE PATH REDACTED]' : value) } });
  }
  const report = { schemaVersion: 'gridly-lp106-authoritative-address-coverage-audit-v1', generatedAt: new Date(options.generatedAt || Date.now()).toISOString(), target: TARGET, methodology: { deterministic: true, readOnly: true, aggregateOnly: true, sourceFilesModified: false }, sources, assessment: assessment(sources) };
  await mkdir(resolve(options.reports), { recursive: true }); await atomicJson(join(resolve(options.reports), 'lp106-authoritative-address-coverage-audit.json'), report);
  return report;
}

export function usage() { return `Usage: node tools/lp106/audit-authoritative-address-coverage.mjs [options]\n\n--txgio-gdb PATH   Immutable Texas-2026.gdb\n--nad-archive PATH Immutable NAD_r23.zip\n--gdal PATH        ogrinfo executable\n--reports PATH     Report directory\n--generated-at ISO Stable report timestamp\n\nMissing sources are reported as \"${SOURCE_UNAVAILABLE}\"; no source-absence conclusion is made.`; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); const report = await audit(options); process.stdout.write(`${report.assessment.status}\n`); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP106 audit failed: ${error.message}\n`); process.exitCode = 1; });
