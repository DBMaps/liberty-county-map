#!/usr/bin/env node

/** LP104.3: bounded, read-only NAD measurements through GDAL /vsizip/. */

import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_GDB = 'NAD_r23.gdb';
const DEFAULT_LAYER = 'NAD';
const MAX_GDAL_OUTPUT_BYTES = 4 * 1024 * 1024;
const REPORT_NAMES = {
  json: 'lp104.3-nad-r23-texas-measurement.json',
  markdown: 'lp104.3-nad-r23-texas-measurement.md',
  countiesCsv: 'lp104.3-nad-r23-texas-counties.csv',
};

function usage() {
  return `Usage: node tools/lp104/measure-nad-r23.mjs --archive <NAD_r23.zip> --reports <directory> [options]

Required:
  --archive <path>       Local NAD R23 ZIP (never extracted or modified)
  --reports <directory> Output directory for report/checkpoint files

Options:
  --gdal <path>          ogrinfo executable or GDAL bin directory
  --geodatabase <path>  ZIP member path (default: NAD_r23.gdb)
  --layer <name>         Feature layer (default: NAD)
  --state <value>        Exact two-character State value (default: TX)
  --county <value>       Proof county value (default: Liberty)
  --generated-at <ISO>  Reproducible report timestamp
  --debug                Print every attempted strategy and exact argument array
  --core-only            Skip optional per-county counts
  --help                 Show this help

The tool reads /vsizip/ with native OpenFileGDB attribute filters and ogrinfo -ro -so. It does
not force a driver, request JSON, use SQLite GROUP BY, dump features, or extract.\n`;
}

export function parseArguments(argv) {
  const options = { geodatabase: DEFAULT_GDB, layer: DEFAULT_LAYER, state: 'TX', county: 'Liberty', top: 25 };
  const valued = new Set(['--archive', '--reports', '--gdal', '--geodatabase', '--layer', '--state', '--county', '--generated-at', '--top']);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--debug') options.debug = true;
    else if (arg === '--core-only') options.coreOnly = true;
    else if (valued.has(arg)) {
      const value = argv[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.help && !options.archive) throw new Error('--archive is required');
  if (!options.help && !options.reports) throw new Error('--reports is required');
  options.top = Number(options.top);
  if (!Number.isInteger(options.top) || options.top < 1 || options.top > 1000) throw new Error('--top must be an integer from 1 to 1000');
  if (!/^[A-Za-z]{2}$/.test(options.state)) throw new Error('--state must be a two-character state code');
  options.state = options.state.toUpperCase();
  if (options.generatedAt && Number.isNaN(Date.parse(options.generatedAt))) throw new Error('--generated-at must be an ISO date/time');
  return options;
}

async function onPath(name) {
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  for (const folder of (process.env.PATH || '').split(delimiter)) for (const suffix of suffixes) {
    const candidate = resolve(folder || '.', `${name}${suffix}`);
    try { await access(candidate, fsConstants.X_OK); return candidate; } catch { /* continue */ }
  }
  return null;
}

export async function discoverOgrinfo(explicit) {
  const configured = explicit || process.env.GRIDLY_GDAL_OGRINFO || process.env.OGRINFO;
  if (configured) {
    let candidate = resolve(configured);
    try {
      if ((await stat(candidate)).isDirectory()) candidate = join(candidate, process.platform === 'win32' ? 'ogrinfo.exe' : 'ogrinfo');
      await access(candidate, fsConstants.X_OK); return candidate;
    } catch { throw new Error(`GDAL ogrinfo is unavailable at: ${candidate}`); }
  }
  const found = await onPath('ogrinfo');
  if (!found) throw new Error('GDAL ogrinfo was not found. Use --gdal or GRIDLY_GDAL_OGRINFO.');
  return found;
}

function diagnostic(executable, args) { return `executable: ${JSON.stringify(executable)}\narguments: ${JSON.stringify(args)}`; }

export function runOgrinfo(executable, args, label, { debug = false, spawnImpl = spawn, maxOutputBytes = MAX_GDAL_OUTPUT_BYTES } = {}) {
  return new Promise((resolveRun, reject) => {
    const invocation = diagnostic(executable, args);
    if (debug) process.stderr.write(`[LP104.3 probe] ${label}\n${invocation}\n`);
    let child;
    try { child = spawnImpl(executable, args, { shell: false, windowsHide: true, detached: false, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { reject(new Error(`${label} spawn error: ${error.message}\n${invocation}`)); return; }
    let stdout = ''; let stderr = ''; let bytes = 0; let settled = false;
    const fail = error => { if (!settled) { settled = true; reject(error); } };
    const collect = (stream, append) => stream.on('data', chunk => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > maxOutputBytes) { child.kill(); fail(new Error(`${label} exceeded the ${maxOutputBytes}-byte output limit\n${invocation}`)); }
      else append(chunk);
    });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    collect(child.stdout, chunk => { stdout += chunk; }); collect(child.stderr, chunk => { stderr += chunk; });
    child.on('error', error => fail(new Error(`${label} spawn error: ${error.message}\n${invocation}`)));
    child.on('close', (code, signal) => {
      if (settled) return; settled = true;
      if (code === 0) resolveRun(stdout);
      else reject(new Error(`${label} process failure\nexit code: ${code ?? 'null'}\nsignal: ${signal || 'none'}\nstdout:\n${stdout || '(empty)'}\nstderr:\n${stderr || '(empty)'}\n${invocation}`));
    });
  });
}

export function parseFeatureCount(text, label = 'Filtered feature count') {
  const match = String(text).match(/^Feature Count:\s*([0-9][0-9,]*)\s*$/mi);
  if (!match) throw new Error(`${label} returned no parseable Feature Count`);
  const count = Number(match[1].replaceAll(',', ''));
  if (!Number.isSafeInteger(count)) throw new Error(`${label} returned an unsafe Feature Count`);
  return count;
}

function layerFromSchemaText(text, expectedLayer) {
  if (!/using driver [`']OpenFileGDB['`] successful/i.test(text)) throw new Error('Schema inspection did not confirm the OpenFileGDB driver');
  const layer = text.match(/^Layer name:\s*(.+)$/mi)?.[1].trim();
  if (!layer || layer.toLowerCase() !== expectedLayer.toLowerCase()) throw new Error(`Schema inspection returned no ${expectedLayer} layer`);
  const fields = [...text.matchAll(/^([^\r\n:]+):\s+(?:Integer|Integer64|Real|String|Date|Time|DateTime|Binary)(?:\s|\(|$).*$/gmi)].map(match => match[1].trim());
  return { fields, geometry: text.match(/^Geometry:\s*(.+)$/mi)?.[1].trim() || null };
}

function field(fields, wanted, required = false) {
  const result = fields.find(name => name.toLowerCase() === wanted.toLowerCase());
  if (!result && required) throw new Error(`Required NAD field is unavailable: ${wanted}`);
  return result;
}
function identifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function equality(name, value) { return `${identifier(name)} = ${literal(value)}`; }

export function filteredCountArguments(datasource, layer, where) {
  return [datasource, '-ro', '-so', '-where', where, layer];
}

async function atomic(path, content) {
  const temporary = `${path}.tmp`; await writeFile(temporary, content, 'utf8');
  try { await rename(temporary, path); } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
}
function csvCell(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

async function writeReports(reports, report) {
  await mkdir(reports, { recursive: true });
  const core = report.calculatedMeasurements;
  const markdown = `# LP104.3 NAD R23 Texas measurement\n\nGenerated: ${report.generatedAt}\n\n## Core proof\n\n- Texas records: ${core.texas.featureCount.toLocaleString('en-US')}\n- Liberty County records: ${core.libertyCounty.featureCount.toLocaleString('en-US')}\n- Target exact candidates: ${core.targetAddress.candidateCount.toLocaleString('en-US')}\n\n## Status\n\n${report.status === 'complete' ? 'Core proof and all optional per-county counts completed.' : 'Core proof is preserved; one or more optional measurements were deferred or failed.'}\n\nNational State inventory was deliberately deferred because full-layer SQLite GROUP BY crashed GDAL on Windows. No ingestion or merge is recommended until the owner confirms the real Texas and Liberty counts.\n`;
  const countyRows = report.calculatedMeasurements.counties || [];
  const csv = `county,fips,count,status\r\n${countyRows.map(row => [row.county, row.fips, row.count ?? '', row.status].map(csvCell).join(',')).join('\r\n')}\r\n`;
  await atomic(join(reports, REPORT_NAMES.json), `${JSON.stringify(report, null, 2)}\n`);
  await atomic(join(reports, REPORT_NAMES.markdown), markdown);
  await atomic(join(reports, REPORT_NAMES.countiesCsv), csv);
}

export async function measure(options, dependencies = {}) {
  const archive = resolve(options.archive); const reports = resolve(options.reports);
  const before = await stat(archive).catch(() => { throw new Error(`Archive not found: ${archive}`); });
  if (!before.isFile()) throw new Error(`Archive not found: ${archive}`);
  const ogrinfo = await (dependencies.discoverOgrinfo || discoverOgrinfo)(options.gdal);
  const run = dependencies.runOgrinfo || runOgrinfo;
  const datasource = `/vsizip/${archive.replaceAll('\\', '/')}/${options.geodatabase.replaceAll('\\', '/').replace(/^\/+/, '')}`;
  const attemptLog = [];
  const attempt = async (strategy, args) => {
    const record = { strategy, arguments: args, status: 'attempted' }; attemptLog.push(record);
    try { const output = await run(ogrinfo, args, strategy, { debug: options.debug }); record.status = 'succeeded'; return output; }
    catch (error) { record.status = 'failed'; record.error = error.message; throw error; }
  };
  const schema = layerFromSchemaText(await attempt('minimal-schema-discovery', [datasource, '-ro', '-so', options.layer]), options.layer);
  const stateField = field(schema.fields, 'State', true); const countyField = field(schema.fields, 'County', true);
  const stateWhere = equality(stateField, options.state);
  const count = async (label, where) => parseFeatureCount(await attempt(label, filteredCountArguments(datasource, options.layer, where)), label);
  const texasCount = await count('native-texas-filtered-feature-count', stateWhere);
  const libertyWhere = `${stateWhere} AND ${equality(countyField, options.county)}`;
  const libertyCount = await count('native-liberty-filtered-feature-count', libertyWhere);

  const numberField = field(schema.fields, 'Add_Number') || field(schema.fields, 'AddNo_Full');
  const streetField = field(schema.fields, 'StNam_Full') || field(schema.fields, 'Street') || field(schema.fields, 'St_Name');
  if (!numberField || !streetField) throw new Error('Target diagnostic requires an address-number field and street-name field');
  const targetParts = [libertyWhere, `(${equality(numberField, '274')} OR ${identifier(numberField)} = 274)`, `(${identifier(streetField)} LIKE ${literal('%COUNTY ROAD 677%')} OR ${identifier(streetField)} LIKE ${literal('%COUNTY RD 677%')} OR ${identifier(streetField)} LIKE ${literal('%CR 677%')})`];
  const cityField = field(schema.fields, 'Post_City'); const zipField = field(schema.fields, 'Zip_Code');
  if (cityField) targetParts.push(`(${equality(cityField, 'Dayton')} OR ${equality(cityField, 'DAYTON')})`);
  if (zipField) targetParts.push(`(${equality(zipField, '77535')} OR ${identifier(zipField)} = 77535)`);
  const targetCount = await count('native-bounded-target-address-count', targetParts.join(' AND '));

  const report = {
    reportSchema: 'gridly.lp104.3.nad-measurement.v2', generatedAt: new Date(options.generatedAt || Date.now()).toISOString(), status: 'partial',
    sourceFacts: { archive: archive.replaceAll('\\', '/'), geodatabase: options.geodatabase, layer: options.layer, geometry: schema.geometry, fields: schema.fields, access: 'read-only /vsizip/; native OpenFileGDB filters' },
    calculatedMeasurements: { texas: { selector: options.state, featureCount: texasCount }, libertyCounty: { selector: options.county, featureCount: libertyCount }, targetAddress: { query: '274 County Road 677, Dayton, TX 77535', candidateCount: targetCount, exactFound: targetCount > 0 }, counties: [] },
    diagnostics: { attempts: attemptLog }, limitations: ['National State-value inventory deferred: SQLite GROUP BY against the national zipped FileGDB crashed GDAL on Windows.', 'Counts establish dataset presence; address candidate rows are not dumped.'],
    methodology: { core: 'Native ogrinfo -where -so Feature Count', nationalGroupBy: 'not attempted', forcedDriver: false, jsonOutput: false, extraction: false, readOnly: true },
    proceedToIngestionDesign: false,
  };
  await writeReports(reports, report); // Preserve the required proof before optional work.

  if (!options.coreOnly) {
    let inventory = [];
    try { inventory = JSON.parse(await readFile(resolve('data/lp104/texas-counties.json'), 'utf8')).counties || []; }
    catch (error) { report.limitations.push(`Official Texas county iteration list unavailable: ${error.message}`); }
    for (const item of inventory) {
      const name = (item.countyName || item.name).replace(/\s+County$/i, '');
      try { report.calculatedMeasurements.counties.push({ county: name, fips: item.fips, count: await count(`native-county-count:${name}`, `${stateWhere} AND ${equality(countyField, name)}`), status: 'measured' }); }
      catch (error) { report.calculatedMeasurements.counties.push({ county: name, fips: item.fips, count: null, status: 'unavailable', error: error.message }); report.limitations.push(`Optional county count failed for ${name}; core measurements remain valid.`); }
      await writeReports(reports, report);
    }
    report.status = report.calculatedMeasurements.counties.some(row => row.status !== 'measured') ? 'partial' : 'complete';
  }
  const after = await stat(archive);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('NAD archive changed during measurement');
  await writeReports(reports, report);
  return { report, reports, files: REPORT_NAMES };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv); if (options.help) { process.stdout.write(`${usage()}\n`); return; } await measure(options);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP104.3 measurement failed: ${error.message}\n\n${usage()}\n`); process.exitCode = 1; });
