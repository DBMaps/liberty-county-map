#!/usr/bin/env node

/** Read-only TxGIO 2026 address-point to compact Gridly county package builder. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_CONFIG = join(ROOT, 'data/lp104/txgio-2026-address-source.json');
const COUNTY_MANIFEST = join(ROOT, 'data/lp104/texas-counties.json');
const DEFAULT_OUTPUT = join(ROOT, 'data/generated/lp104/txgio-addresses');
const REQUIRED = ['Add_Number', 'AddNum_Suf', 'Full_Addr', 'Post_Comm', 'Post_Code', 'County', 'FIPS', 'Source', 'DateUpdate'];
const STREET_PARTS = ['St_PreMod', 'St_PreDir', 'St_PreTyp', 'St_PreSep', 'St_Name', 'St_PosTyp', 'St_PosDir', 'St_PosMod'];

export function usage() { return `TxGIO 2026 county address package builder (source is never written)

Usage:
  node tools/lp104/build-txgio-address-packages.mjs --liberty [options]
  node tools/lp104/build-txgio-address-packages.mjs --gridly-counties [options]
  node tools/lp104/build-txgio-address-packages.mjs --all-texas [options]
  node tools/lp104/build-txgio-address-packages.mjs --fips 48291[,.....] [options]

Options:
  --gdb PATH       Texas-2026.gdb (or GRIDLY_TXGIO_GDB)
  --gdal PATH      ogr2ogr executable or QGIS GDAL bin directory
  --output PATH    Generated package directory
  --force          Rebuild an already certified package
  --help           Show help`;
}

function valueAfter(argv, i) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${argv[i]} requires a value`); return argv[i + 1]; }
export function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--liberty', '--gridly-counties', '--all-texas', '--force'].includes(arg)) options[arg.slice(2)] = true;
    else if (['--gdb', '--gdal', '--output', '--fips'].includes(arg)) { options[arg.slice(2)] = valueAfter(argv, i); i += 1; }
    else throw new Error(`Unknown option: ${arg}`);
  }
  const modes = ['liberty', 'gridly-counties', 'all-texas', 'fips'].filter(key => options[key]);
  if (!options.help && modes.length !== 1) throw new Error('Choose exactly one of --liberty, --gridly-counties, --all-texas, or --fips');
  return options;
}

const clean = value => value == null ? '' : String(value).trim().replace(/\s+/g, ' ');
export function completeStreet(properties) { return STREET_PARTS.map(key => clean(properties[key])).filter(Boolean).join(' '); }
export function normalizeFeature(feature, county) {
  const p = feature?.properties || {}; const coordinates = feature?.geometry?.coordinates;
  const house = [clean(p.Add_Number), clean(p.AddNum_Suf)].filter(Boolean).join(''); const street = completeStreet(p); const full = clean(p.Full_Addr);
  if (!house) return { rejection: 'missing exact house number' };
  if (!clean(p.St_Name) || !street) return { rejection: 'missing canonical road' };
  if (!full) return { rejection: 'missing full address' };
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite)) return { rejection: 'missing point coordinates' };
  const fips = clean(p.FIPS).padStart(5, '0');
  if (fips !== county.fips) return { rejection: `unexpected FIPS ${fips || '(blank)'}` };
  const lon = Number(coordinates[0].toFixed(6)); const lat = Number(coordinates[1].toFixed(6));
  const identity = [fips, house.toUpperCase(), street.toUpperCase(), full.toUpperCase(), lon, lat].join('|');
  return { record: { i: createHash('sha256').update(identity).digest('hex').slice(0, 20), h: house, r: street, a: full, p: clean(p.Post_Comm), z: clean(p.Post_Code), c: clean(p.County) || county.countyName, f: fips, x: lon, y: lat, s: clean(p.Source) || 'TxGIO', u: clean(p.DateUpdate) } };
}

export function ogrArguments(gdb, layer, fips) {
  const selected = [...REQUIRED, ...STREET_PARTS].join(',');
  return ['-f', 'GeoJSONSeq', '/vsistdout/', gdb, layer, '-ro', '-where', `FIPS = ${Number(fips)}`, '-select', selected, '-t_srs', 'EPSG:4326', '-lco', 'RS=YES'];
}

async function executable(path) {
  let candidate = path || process.env.GRIDLY_GDAL_OGR2OGR || process.env.OGR2OGR;
  if (!candidate && process.platform === 'win32') candidate = 'C:\\Program Files\\QGIS 3.44.11\\bin';
  if (!candidate) return 'ogr2ogr';
  candidate = resolve(candidate);
  if ((await stat(candidate).catch(() => null))?.isDirectory()) candidate = join(candidate, process.platform === 'win32' ? 'ogr2ogr.exe' : 'ogr2ogr');
  await access(candidate).catch(() => { throw new Error(`GDAL ogr2ogr was not found at ${candidate}. Install QGIS 3.44.11 or pass --gdal.`); });
  return candidate;
}

async function atomicJson(path, value) { const temp = `${path}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`); await rename(temp, path); }
async function sha256(path) { const hash = createHash('sha256'); await pipeline(createReadStream(path), hash); return hash.digest('hex'); }
async function writePackage(linesPath, outputPath) { const temp = `${outputPath}.${process.pid}.tmp`; await pipeline(createReadStream(linesPath), createGzip({ level: 9, mtime: 0 }), createWriteStream(temp, { flags: 'wx' })); await rename(temp, outputPath); }

export async function buildCounty(options, county, config, command) {
  const outputPath = join(options.output, `${county.countyId}-${county.fips}.addresses.jsonl.gz`);
  const certificatePath = `${outputPath}.json`;
  if (!options.force) {
    const old = JSON.parse(await readFile(certificatePath, 'utf8').catch(() => 'null'));
    if (old && old.packageHash === await sha256(outputPath).catch(() => null)) { process.stdout.write(`[${county.fips}] resumed: certified ${outputPath}\n`); return old; }
  }
  process.stdout.write(`[${county.fips}] extracting ${county.countyName} County with ogr2ogr...\n`);
  const staging = `${outputPath}.${process.pid}.records`; const writer = createWriteStream(staging, { flags: 'wx' });
  const child = spawn(command, ogrArguments(options.gdb, config.layer, county.fips), { windowsHide: true });
  const completion = new Promise((resolveClose, rejectClose) => { child.once('error', rejectClose); child.once('close', resolveClose); });
  let buffer = ''; let stderr = ''; let read = 0; let rejected = 0; let duplicates = 0; let accepted = 0; const ids = new Set();
  child.stderr.setEncoding('utf8'); child.stderr.on('data', value => { stderr += value; }); child.stdout.setEncoding('utf8');
  try {
    for await (const chunk of child.stdout) {
      buffer += chunk;
      const rows = buffer.split('\n'); buffer = rows.pop();
      for (const row of rows) {
        const text = row.replace(/^\x1e/, '').trim(); if (!text) continue; read += 1;
        let feature; try { feature = JSON.parse(text); } catch { throw new Error(`ogr2ogr emitted invalid GeoJSONSeq at source record ${read}`); }
        const normalized = normalizeFeature(feature, county); if (!normalized.record) { rejected += 1; continue; }
        if (ids.has(normalized.record.i)) { duplicates += 1; continue; } ids.add(normalized.record.i); accepted += 1;
        if (!writer.write(`${JSON.stringify(normalized.record)}\n`)) await new Promise(resolveDrain => writer.once('drain', resolveDrain));
        if (read % 25000 === 0) process.stdout.write(`[${county.fips}] ${read.toLocaleString()} read; ${accepted.toLocaleString()} accepted\n`);
      }
    }
    if (buffer.replace(/^\x1e/, '').trim()) {
      read += 1; const feature = JSON.parse(buffer.replace(/^\x1e/, '').trim()); const normalized = normalizeFeature(feature, county);
      if (!normalized.record) rejected += 1; else if (ids.has(normalized.record.i)) duplicates += 1; else { ids.add(normalized.record.i); accepted += 1; writer.write(`${JSON.stringify(normalized.record)}\n`); }
    }
    const code = await completion;
    if (code !== 0) throw new Error(`ogr2ogr exited ${code} for FIPS ${county.fips}: ${stderr.trim() || 'no diagnostic output'}`);
  } catch (error) { child.kill(); throw error; } finally { await new Promise(resolveEnd => writer.end(resolveEnd)); }
  if (!read) { await rm(staging, { force: true }); throw new Error(`No TxGIO records matched FIPS ${county.fips}; verify the GDB, layer, and FIPS field type.`); }
  await writePackage(staging, outputPath); await rm(staging, { force: true });
  const result = { countyId: county.countyId, county: county.countyName, fips: county.fips, sourceRecordsRead: read, acceptedRecords: accepted, rejectedRecords: rejected, duplicates, outputBytes: (await stat(outputPath)).size, outputPath, packageHash: await sha256(outputPath), outputCrs: config.outputCrs };
  await atomicJson(certificatePath, result);
  process.stdout.write(`[${county.fips}] source records read: ${read}\naccepted records: ${accepted}\nrejected records: ${rejected}\nduplicates: ${duplicates}\noutput size: ${result.outputBytes} bytes\noutput path: ${outputPath}\n`);
  return result;
}

export async function run(options) {
  const config = JSON.parse(await readFile(SOURCE_CONFIG)); const manifest = JSON.parse(await readFile(COUNTY_MANIFEST));
  options.gdb = resolve(options.gdb || process.env.GRIDLY_TXGIO_GDB || config.defaultWindowsGdb); options.output = resolve(options.output || DEFAULT_OUTPUT);
  await access(options.gdb).catch(() => { throw new Error(`Immutable TxGIO geodatabase not found: ${options.gdb}. Pass --gdb or set GRIDLY_TXGIO_GDB.`); }); await mkdir(options.output, { recursive: true });
  let counties;
  if (options.liberty) counties = manifest.counties.filter(item => item.fips === '48291');
  else if (options['gridly-counties']) counties = manifest.counties.filter(item => item.certificationCohort === 'initial28');
  else if (options['all-texas']) counties = manifest.counties;
  else { const requested = new Set(options.fips.split(',').map(value => value.trim().padStart(5, '0'))); counties = manifest.counties.filter(item => requested.has(item.fips)); if (counties.length !== requested.size) throw new Error('One or more requested FIPS codes are absent from the maintained Texas county manifest'); }
  const command = await executable(options.gdal); const results = [];
  for (const county of counties) results.push(await buildCounty(options, county, config, command));
  const manifestPath = join(options.output, 'manifest.json');
  const previous = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => 'null'));
  const packages = new Map((previous?.packages || []).map(item => [item.fips, item]));
  for (const result of results) packages.set(result.fips, result);
  const statewide = { schemaVersion: 'gridly-txgio-address-package-manifest-v1', generatedAt: new Date().toISOString(), source: config.sourceName, sourceRecordCount: config.statewideRecordCount, sourceCrs: config.sourceCrs, outputCrs: config.outputCrs, packages: [...packages.values()].sort((a, b) => a.fips.localeCompare(b.fips)) };
  await atomicJson(manifestPath, statewide); return statewide;
}

export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); await run(options); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`TxGIO package build failed: ${error.message}\n`); process.exitCode = 1; });
