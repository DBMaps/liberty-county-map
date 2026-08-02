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
export const ROAD_VARIANTS = Object.freeze(['County Road 677', 'COUNTY ROAD 677', 'County Rd 677', 'COUNTY RD 677', 'CR 677', 'Co Rd 677', 'CO RD 677']);

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
const variants = (values, build, prefix = []) => values.reduce((all, value) => all.concat(build(value, prefix)), []);
export const REQUIRED_FIELDS = Object.freeze({
  txgio: Object.freeze(['FIPS', 'Add_Number', 'Full_Addr', 'Post_Comm', 'Post_Code']),
  nad: Object.freeze(['State', 'County', 'Add_Number', 'StNam_Full', 'Post_City', 'Zip_Code']),
});
export function schemaArguments(datasource, layer) { return ['-ro', '-so', datasource, layer]; }
export function normalizeFieldType(type) {
  const value = String(type).trim().toLowerCase();
  if (/^(string|text|character)/.test(value)) return 'string';
  if (/^integer64\b/.test(value)) return 'integer64';
  if (/^integer\b/.test(value)) return 'integer';
  if (/^(real|numeric|decimal|float|double)\b/.test(value)) return 'real';
  return 'unsupported';
}
export function parseSchema(output, requiredFields) {
  const result = typeof output === 'string' ? { stdout: output, stderr: '', exitCode: 0 } : output;
  if (result?.exitCode !== 0) throw new Error(`schema inspection failed: ${redactDiagnostic(`${result?.stdout || ''}\n${result?.stderr || ''}`)}`);
  const text = `${result?.stdout || ''}\n${result?.stderr || ''}`;
  if (!/^Layer name:/mi.test(text)) throw new Error(`schema inspection returned no layer schema: ${redactDiagnostic(text) || '(no diagnostic output)'}`);
  const declared = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:]+):\s*([A-Za-z][A-Za-z0-9 ]*?)(?:\s*\([^)]*\))?\s*$/);
    if (match && !/^(Layer name|Geometry|Feature Count|Extent|Layer SRS WKT|FID Column)$/i.test(match[1].trim())) declared.set(match[1].trim().toLowerCase(), { fieldName: match[1].trim(), sourceDeclaredType: match[2].trim() });
  }
  return requiredFields.map(required => {
    const found = declared.get(required.toLowerCase()); const normalizedType = found ? normalizeFieldType(found.sourceDeclaredType) : null;
    const supported = found ? normalizedType !== 'unsupported' : false;
    return { requiredField: required, fieldName: found?.fieldName || null, sourceDeclaredType: found?.sourceDeclaredType || null, normalizedType, found: Boolean(found), supported, typedPredicateConstructable: Boolean(found) && supported };
  });
}
export function typedLiteral(value, field) {
  if (!field?.typedPredicateConstructable) throw new Error(`No typed predicate can be constructed for ${field?.requiredField || 'field'}`);
  if (field.normalizedType === 'string') return quote(value);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value))) throw new Error(`Numeric field ${field.requiredField} requires a numeric literal`);
  return String(value);
}
const fieldMap = fields => Object.fromEntries(fields.map(field => [field.requiredField, field]));
const equal = (fields, name, value) => `${id(fields[name].fieldName)} = ${typedLiteral(value, fields[name])}`;
export function txgioWheres(target = TARGET, schemaFields) {
  if (!schemaFields) throw new Error('TxGIO schema fields are required for typed predicates');
  const fields = fieldMap(schemaFields);
  // Every predicate is an OpenFileGDB native equality. Full_Addr supplies the
  // exact road spelling while component fields independently bind the number,
  // postal community, ZIP, and county FIPS.
  return variants(ROAD_VARIANTS, road => variants(['Dayton', 'DAYTON'], city => [[road, city]]))
    .map(([road, city]) => [equal(fields, 'FIPS', target.fips), equal(fields, 'Add_Number', target.houseNumber), equal(fields, 'Full_Addr', `${target.houseNumber} ${road}`), equal(fields, 'Post_Comm', city), equal(fields, 'Post_Code', target.zip)].join(' AND '));
}
export function nadWheres(target = TARGET, schemaFields) {
  if (!schemaFields) throw new Error('NAD schema fields are required for typed predicates');
  const fields = fieldMap(schemaFields);
  // NAD has a direct street component, so it never depends on a formatted
  // full-address field. The bounded case variants are deliberately separate.
  return variants(ROAD_VARIANTS, road => variants(['Dayton', 'DAYTON'], city => variants(['Liberty', 'LIBERTY'], county => variants(['TX', 'Tx'], state => [[road, city, county, state]]))))
    .map(([road, city, county, state]) => [equal(fields, 'State', state), equal(fields, 'County', county), equal(fields, 'Add_Number', target.houseNumber), equal(fields, 'StNam_Full', road), equal(fields, 'Post_City', city), equal(fields, 'Zip_Code', target.zip)].join(' AND '));
}
export const txgioWhere = (target = TARGET, schemaFields) => txgioWheres(target, schemaFields)[0];
export const nadWhere = (target = TARGET, schemaFields) => nadWheres(target, schemaFields)[0];
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

export function unavailable(sourceId) { return { sourceId, status: SOURCE_UNAVAILABLE, schemaQueryAttempted: false, schemaQueryCompleted: false, schemaFields: [], requiredFieldsFound: false, unsupportedFields: [], schemaFailure: null, typedPredicateStrategy: null, boundedQueryCount: 0, liveQueryExecuted: false, queryCompleted: false, candidateQueryHits: null, uniqueExactCandidateCount: null, exactCandidateCount: null, exactFound: null, queries: [], queryFailure: null }; }
export function assessment(results) {
  const queried = results.filter(item => item.queryCompleted);
  return {
    status: queried.length === results.length ? 'LIVE_QUERY_COMPLETE' : SOURCE_UNAVAILABLE,
    decision: queried.length !== results.length ? 'NO SOURCE-PRESENCE CONCLUSION PERMITTED' : queried.some(item => item.exactFound) ? 'AUTHORITATIVE_CANDIDATE_REQUIRES_SOURCE_REVIEW' : 'NO_EXACT_CANDIDATE_IN_QUERIED_SNAPSHOTS',
    sourceAbsenceClaimed: false,
    productionMutationAuthorized: false,
  };
}

export async function audit(options, dependencies = {}) {
  const ogrinfo = options.gdal || process.env.GRIDLY_GDAL_OGRINFO || process.env.OGRINFO || 'ogrinfo';
  const execute = dependencies.runOgrinfo || runOgrinfo; const identify = dependencies.identity || identity;
  const sources = [];
  const specs = [
    { sourceId: 'txgio-2026-statewide-address-points', kind: 'txgio', path: options.txgioGdb || process.env.GRIDLY_TXGIO_GDB, layer: options.layer, datasource: path => path, buildWheres: txgioWheres },
    { sourceId: 'usdot-nad-r23', kind: 'nad', path: options.nadArchive || process.env.GRIDLY_NAD_R23_ARCHIVE, layer: options.nadLayer, datasource: path => `/vsizip/${path.replaceAll('\\', '/')}/${options.nadGeodatabase}`, buildWheres: nadWheres },
  ];
  for (const spec of specs) {
    if (!spec.path || !(await stat(resolve(spec.path)).catch(() => null))) { sources.push(unavailable(spec.sourceId)); continue; }
    const path = resolve(spec.path); const sourceIdentity = await identify(path);
    let schemaFields; let schemaFailure = null;
    try { schemaFields = parseSchema(await execute(ogrinfo, schemaArguments(spec.datasource(path), spec.layer)), REQUIRED_FIELDS[spec.kind]); }
    catch (error) { schemaFailure = redactDiagnostic(String(error.message).replaceAll(spec.datasource(path), '[IMMUTABLE SOURCE PATH REDACTED]').replaceAll(path, '[IMMUTABLE SOURCE PATH REDACTED]')); }
    const requiredFieldsFound = Boolean(schemaFields) && schemaFields.every(field => field.found);
    const unsupportedFields = (schemaFields || []).filter(field => field.found && !field.supported).map(field => ({ fieldName: field.fieldName, sourceDeclaredType: field.sourceDeclaredType }));
    const constructable = Boolean(schemaFields) && schemaFields.every(field => field.typedPredicateConstructable);
    if (!constructable) {
      const missing = (schemaFields || []).filter(field => !field.found).map(field => field.requiredField);
      sources.push({ ...unavailable(spec.sourceId), status: 'LIVE QUERY INCOMPLETE', schemaQueryAttempted: true, schemaQueryCompleted: Boolean(schemaFields), schemaFields: schemaFields || [], requiredFieldsFound, unsupportedFields, schemaFailure: schemaFailure || (missing.length ? `Required fields missing: ${missing.join(', ')}` : `Unsupported fields: ${unsupportedFields.map(field => field.fieldName).join(', ')}`), sourceIdentity });
      continue;
    }
    const wheres = spec.buildWheres(TARGET, schemaFields);
    const queries = []; let candidateQueryHits = 0;
    for (const where of wheres) {
      const args = queryArguments(spec.datasource(path), spec.layer, where);
      try {
        const count = parseFeatureCount(await execute(ogrinfo, args)); candidateQueryHits += count;
        queries.push({ where, count, completed: true, arguments: args.map((value, index) => index === 4 ? '[IMMUTABLE SOURCE PATH REDACTED]' : value) });
      } catch (error) {
        const safeFailure = String(error.message).replaceAll(spec.datasource(path), '[IMMUTABLE SOURCE PATH REDACTED]').replaceAll(path, '[IMMUTABLE SOURCE PATH REDACTED]');
        queries.push({ where, count: null, completed: false, failure: redactDiagnostic(safeFailure), arguments: args.map((value, index) => index === 4 ? '[IMMUTABLE SOURCE PATH REDACTED]' : value) });
      }
    }
    const failures = queries.filter(query => !query.completed); const queryCompleted = failures.length === 0;
    // The predicates are mutually exclusive because each differs by an exact
    // value for Full_Addr (TxGIO) or the road/city/county/state tuple (NAD).
    const uniqueExactCandidateCount = queryCompleted ? candidateQueryHits : null;
    sources.push({ sourceId: spec.sourceId, status: queryCompleted ? 'LIVE QUERY EXECUTED' : 'LIVE QUERY INCOMPLETE', schemaQueryAttempted: true, schemaQueryCompleted: true, schemaFields, requiredFieldsFound, unsupportedFields, schemaFailure: null, typedPredicateStrategy: 'source-declared schema types; quoted strings and unquoted numeric literals', boundedQueryCount: wheres.length, liveQueryExecuted: queries.some(query => query.completed), queryCompleted, candidateQueryHits, uniqueExactCandidateCount, exactCandidateCount: uniqueExactCandidateCount, exactFound: queryCompleted ? uniqueExactCandidateCount > 0 : null, sourceIdentity, queries, queryFailure: failures.length ? { count: failures.length, details: failures.map(query => query.failure) } : null, query: { method: 'ogrinfo bounded exact filtered Feature Counts', readOnly: true, featureRowsEmitted: false, mutuallyExclusivePredicates: true } });
  }
  const report = { schemaVersion: 'gridly-lp106-authoritative-address-coverage-audit-v1', generatedAt: new Date(options.generatedAt || Date.now()).toISOString(), target: TARGET, methodology: { deterministic: true, readOnly: true, aggregateOnly: true, sourceFilesModified: false }, sources, assessment: assessment(sources) };
  await mkdir(resolve(options.reports), { recursive: true }); await atomicJson(join(resolve(options.reports), 'lp106-authoritative-address-coverage-audit.json'), report);
  return report;
}

export function usage() { return `Usage: node tools/lp106/audit-authoritative-address-coverage.mjs [options]\n\n--txgio-gdb PATH   Immutable Texas-2026.gdb\n--nad-archive PATH Immutable NAD_r23.zip\n--gdal PATH        ogrinfo executable\n--reports PATH     Report directory\n--generated-at ISO Stable report timestamp\n\nMissing sources are reported as \"${SOURCE_UNAVAILABLE}\"; no source-absence conclusion is made.`; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); const report = await audit(options); process.stdout.write(`${report.assessment.status}\n`); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP106 audit failed: ${error.message}\n`); process.exitCode = 1; });
