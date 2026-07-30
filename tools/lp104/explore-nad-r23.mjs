#!/usr/bin/env node

/** Small, read-only NAD File Geodatabase record explorer. */

import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_FIELDS = ['Add_Number', 'StNam_Full', 'County', 'Post_City', 'Zip_Code', 'Uninc_Comm', 'Placement', 'AddAuth', 'NAD_Source'];
const FILTERS = new Map([
  ['state', 'State'], ['county', 'County'], ['city', 'Post_City'], ['road', 'StNam_Full'], ['house-number', 'Add_Number'],
]);

export function usage() {
  return `Gridly NAD R23 data explorer (read-only; small result sets only)

Usage:
  node tools/lp104/explore-nad-r23.mjs [NAD_r23.gdb] [options]

Filters (may be combined):
  --state VALUE              Exact State match
  --county VALUE             Exact County match
  --city VALUE               Exact Post_City match
  --road TEXT                StNam_Full contains TEXT
  --contains TEXT            Alias for --road
  --house-number VALUE       Exact Add_Number match
  --uninc-populated          Uninc_Comm is not null or empty
  --missing-zip              Zip_Code is null or empty
  --missing-house-number     Add_Number is null or empty

Result and output options:
  --limit N                  1..1000 records (default: 20)
  --fields A,B,C             Output fields (default: common address fields)
  --layer NAME               Feature layer (default: NAD)
  --reports DIRECTORY        Export directory (default: beside extracted/)
  --name NAME                Safe export basename (default: nad-explorer-<time>)
  --gdal PATH                ogrinfo executable or GDAL bin directory
  --help                     Show this help

Every successful query prints a console table and atomically writes CSV and JSON.
The explorer uses the extracted .gdb directly: /vsizip/ is rejected. No counts,
GROUP BY, benchmark, or aggregate query is performed.`;
}

function take(argv, index, option) {
  if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error(`${option} requires a value`);
  return argv[index + 1];
}

export function parseArguments(argv) {
  const options = { limit: 20, layer: 'NAD', fields: [...DEFAULT_FIELDS], filters: {} };
  let positional;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--uninc-populated' || arg === '--missing-zip' || arg === '--missing-house-number') options.filters[arg.slice(2)] = true;
    else if (arg === '--limit') { options.limit = Number(take(argv, i, arg)); i += 1; }
    else if (arg === '--fields') { options.fields = take(argv, i, arg).split(',').map(value => value.trim()).filter(Boolean); i += 1; }
    else if (['--layer', '--reports', '--name', '--gdal'].includes(arg)) { options[arg.slice(2)] = take(argv, i, arg); i += 1; }
    else if (arg.startsWith('--') && (FILTERS.has(arg.slice(2)) || arg === '--contains')) { options.filters[arg === '--contains' ? 'road' : arg.slice(2)] = take(argv, i, arg); i += 1; }
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else if (positional) throw new Error(`Unexpected argument: ${arg}`);
    else positional = arg;
  }
  options.gdb = positional || process.env.GRIDLY_NAD_GDB;
  if (!options.help && !options.gdb) throw new Error('Provide the extracted NAD_r23.gdb path or set GRIDLY_NAD_GDB');
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000) throw new Error('--limit must be an integer from 1 through 1000');
  if (!options.fields.length) throw new Error('--fields must contain at least one field');
  if (options.name && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(options.name)) throw new Error('--name may contain only letters, numbers, dot, underscore, and hyphen');
  return options;
}

function identifier(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function literal(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function actualField(fields, wanted) { return fields.find(name => name.toLowerCase() === wanted.toLowerCase()); }

export function parseSchema(text, expectedLayer) {
  const layer = text.match(/^Layer name:\s*(.+)$/mi)?.[1].trim();
  if (!layer || layer.toLowerCase() !== expectedLayer.toLowerCase()) throw new Error(`Layer not found: ${expectedLayer}`);
  const fields = [...text.matchAll(/^([^\r\n:]+):\s+(?:Integer|Integer64|Real|String|Date|Time|DateTime|Binary)(?:\s|\(|$).*$/gmi)].map(match => match[1].trim());
  if (!fields.length) throw new Error(`No fields found in layer: ${expectedLayer}`);
  return fields;
}

export function prepareQuery(options, availableFields) {
  const requireField = wanted => {
    const found = actualField(availableFields, wanted);
    if (!found) throw new Error(`Invalid or unavailable NAD field: ${wanted}. Available fields: ${availableFields.join(', ')}`);
    return found;
  };
  const selected = options.fields.map(requireField);
  const predicates = [];
  for (const [key, value] of Object.entries(options.filters)) {
    if (!value) continue;
    if (key === 'uninc-populated') { const field = requireField('Uninc_Comm'); predicates.push(`(${identifier(field)} IS NOT NULL AND ${identifier(field)} <> '')`); }
    else if (key === 'missing-zip' || key === 'missing-house-number') {
      const field = requireField(key === 'missing-zip' ? 'Zip_Code' : 'Add_Number');
      predicates.push(`(${identifier(field)} IS NULL OR ${identifier(field)} = '')`);
    } else {
      const field = requireField(FILTERS.get(key));
      predicates.push(key === 'road' ? `${identifier(field)} LIKE ${literal(`%${value}%`)}` : `${identifier(field)} = ${literal(value)}`);
    }
  }
  return { selected, where: predicates.length ? predicates.join(' AND ') : null };
}

export function queryArguments(gdb, layer, query, limit) {
  // ogrinfo has no ogr2ogr-style -select option. A projection-only OGRSQL
  // statement requests just the chosen columns; simple WHERE predicates are
  // delegated to the source layer, while -limit stops feature iteration.
  const sql = `SELECT ${query.selected.map(identifier).join(', ')} FROM ${identifier(layer)}${query.where ? ` WHERE ${query.where}` : ''}`;
  return [gdb, '-ro', '-q', '-json', '-geom=NO', '-fields=YES', '-limit', String(limit), '-dialect', 'OGRSQL', '-sql', sql];
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
  if (!found) throw new Error('GDAL ogrinfo was not found. Use --gdal, GRIDLY_GDAL_OGRINFO, OGRINFO, or PATH.');
  return found;
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { windowsHide: true }); let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun(stdout) : reject(new Error(`ogrinfo exited ${code}: ${stderr.trim() || 'unknown error'}`)));
  });
}

function rowsFromJson(text, fields) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('ogrinfo returned invalid JSON'); }
  const features = parsed.features || parsed.layers?.flatMap(layer => layer.features || []) || [];
  return features.map(feature => Object.fromEntries(fields.map(field => [field, feature.properties?.[field] ?? null])));
}
function csvCell(value) { const text = value == null ? '' : String(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
async function atomic(path, content) { const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, content); try { await rename(temporary, path); } catch (error) { await unlink(temporary).catch(() => {}); throw error; } }

export async function explore(options, dependencies = {}) {
  const gdb = resolve(options.gdb);
  if (/\/vsizip\//i.test(options.gdb)) throw new Error('/vsizip/ is forbidden; provide the extracted .gdb directory');
  if (!/\.gdb[\\/]?$/i.test(gdb)) throw new Error('Datasource must be an extracted .gdb directory');
  await access(gdb).catch(() => { throw new Error(`Extracted geodatabase not found: ${gdb}`); });
  const ogrinfo = await (dependencies.discoverOgrinfo || discoverOgrinfo)(options.gdal);
  const execute = dependencies.run || run;
  const fields = parseSchema(await execute(ogrinfo, [gdb, '-ro', '-so', options.layer]), options.layer);
  const query = prepareQuery(options, fields);
  const rows = rowsFromJson(await execute(ogrinfo, queryArguments(gdb, options.layer, query, options.limit)), query.selected);
  console.table(rows);
  if (!rows.length) process.stdout.write('No matching NAD records found.\n');
  const reports = resolve(options.reports || join(dirname(dirname(gdb)), 'reports'));
  const name = options.name || `nad-explorer-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await mkdir(reports, { recursive: true });
  const jsonPath = join(reports, `${name}.json`); const csvPath = join(reports, `${name}.csv`);
  const csv = `${query.selected.map(csvCell).join(',')}\r\n${rows.map(row => query.selected.map(field => csvCell(row[field])).join(',')).join('\r\n')}${rows.length ? '\r\n' : ''}`;
  await atomic(jsonPath, `${JSON.stringify(rows, null, 2)}\n`); await atomic(csvPath, csv);
  process.stdout.write(`Returned ${rows.length} record(s); limit ${options.limit}.\nCSV: ${csvPath}\nJSON: ${jsonPath}\n`);
  return { rows, csvPath, jsonPath, arguments: queryArguments(gdb, options.layer, query, options.limit) };
}

export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) { process.stdout.write(`${usage()}\n`); return; } await explore(options); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`NAD explorer error: ${error.message}\n`); process.exitCode = 1; });
