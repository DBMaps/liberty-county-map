#!/usr/bin/env node

/** LP118 read-only TIGER/Line county-road extraction adapter for LP116. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY = join(ROOT, 'data/lp104/texas-counties.json');
const BOUNDARIES = join(ROOT, 'assets/boundaries/texas-counties-boundaries.geojson');
const REPORTS = join(ROOT, 'reports/lp118');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = body => createHash('sha256').update(body).digest('hex');
const exists = path => access(path).then(() => true, () => false);
const portable = path => { const value = relative(ROOT, path).replaceAll('\\', '/'); return value.startsWith('../') ? `[owner-source]/${basename(path)}` : value; };
async function atomic(path, body) { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, body); await rename(temporary, path); }
function next(argv, i) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${argv[i]} requires a value`); return argv[i + 1]; }

export function parseArguments(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--candidate', '--resume', '--force'].includes(arg)) out[arg.slice(2)] = true;
    else if (['--fips', '--tiger-root', '--source', '--boundaries', '--gdal', '--reports'].includes(arg)) { out[arg.slice(2).replace('-', '_')] = next(argv, i); i += 1; }
    else if (['--help', '-h'].includes(arg)) out.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!out.help && !out.fips) throw new Error('--fips is required');
  if (!out.help && !out.candidate) throw new Error('--candidate is required; LP118 cannot write production assets');
  if (out.resume && out.force) throw new Error('--resume and --force are mutually exclusive');
  if (out.source && out.tiger_root) throw new Error('--source and --tiger-root are mutually exclusive');
  return out;
}

export function selectCounties(inventory, input) {
  const requested = String(input).split(',').map(x => x.trim());
  if (requested.some(x => !/^48\d{3}$/.test(x))) throw new Error('Every FIPS must be exactly five digits and begin with Texas state FIPS 48');
  if (new Set(requested).size !== requested.length) throw new Error('Duplicate FIPS values are not allowed');
  if (inventory.count !== 254 || inventory.counties.length !== 254) throw new Error('Maintained Texas county identity inventory is invalid');
  const byFips = new Map(inventory.counties.map(x => [x.fips, x]));
  const counties = requested.map(x => byFips.get(x));
  if (counties.some(x => !x)) throw new Error('One or more FIPS codes are absent from the maintained Texas county inventory');
  return counties.sort((a, b) => a.fips.localeCompare(b.fips));
}

async function walk(root) { const found = []; for (const entry of await readdir(root, { withFileTypes: true })) { const path = join(root, entry.name); if (entry.isDirectory()) found.push(...await walk(path)); else found.push(path); } return found; }
export async function discoverSource(options, fips, countyCount = 1) {
  if (options.source) {
    if (countyCount !== 1) throw new Error('--source is valid only for one requested county');
    return await exists(resolve(options.source)) ? resolve(options.source) : null;
  }
  if (!options.tiger_root || !await exists(resolve(options.tiger_root))) return null;
  const expected = new RegExp(`^tl_\\d{4}_${fips}_roads\\.(?:shp|zip|geojson)$`, 'i');
  const matches = (await walk(resolve(options.tiger_root))).filter(path => expected.test(basename(path))).sort();
  if (matches.length > 1) throw new Error(`Ambiguous TIGER source selection for ${fips}: ${matches.map(portable).join(', ')}`);
  return matches[0] || null;
}

function fipsOf(feature) { const p = feature?.properties || {}; const direct = String(p.GEOID || p.STCYFIPS || p.countyFips || '').trim(); if (direct) return direct.slice(-5); const county = String(p.COUNTYFP || p.COUNTYFP20 || '').trim(); return county ? `${String(p.STATEFP || p.STATEFP20 || '48').padStart(2, '0')}${county.padStart(3, '0')}` : ''; }
function positions(value, out = []) { if (!Array.isArray(value)) return out; if (value.length >= 2 && value.every(Number.isFinite)) out.push(value); else for (const child of value) positions(child, out); return out; }
function validGeometry(geometry) { if (!geometry || !['LineString', 'MultiLineString'].includes(geometry.type)) return false; const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates; return Array.isArray(lines) && lines.length > 0 && lines.every(line => Array.isArray(line) && line.length >= 2 && line.every(p => Array.isArray(p) && p.length >= 2 && p.every(Number.isFinite))); }
function pointOnSegment([x, y], [ax, ay], [bx, by]) { const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax); return Math.abs(cross) <= 1e-10 && x >= Math.min(ax, bx) - 1e-10 && x <= Math.max(ax, bx) + 1e-10 && y >= Math.min(ay, by) - 1e-10 && y <= Math.max(ay, by) + 1e-10; }
function inRing(point, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { if (pointOnSegment(point, ring[j], ring[i])) return true; const [xi, yi] = ring[i], [xj, yj] = ring[j], [x, y] = point; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
function contained(point, geometry) { const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []; return polygons.some(p => inRing(point, p[0]) && !p.slice(1).some(r => inRing(point, r))); }
function rounded(geometry) { const round = x => typeof x === 'number' ? Number(x.toFixed(7)) : x.map(round); return { type: geometry.type, coordinates: round(geometry.coordinates) }; }
function ogrExecutable(gdal) { if (!gdal) return process.platform === 'win32' ? 'ogr2ogr.exe' : 'ogr2ogr'; const path = resolve(gdal); return /ogr2ogr(?:\.exe)?$/i.test(path) ? path : join(path, process.platform === 'win32' ? 'ogr2ogr.exe' : 'ogr2ogr'); }
async function convert(sourcePath, output, gdal) {
  const ext = extname(sourcePath).toLowerCase();
  if (ext === '.geojson' || ext === '.json') { await writeFile(output, await readFile(sourcePath)); return { command: 'controlled GeoJSON input (no conversion)', diagnostics: '', sourceCrs: 'EPSG:4326' }; }
  const input = ext === '.zip' ? `/vsizip/${sourcePath.replaceAll('\\', '/')}` : sourcePath;
  const args = ['-f', 'GeoJSON', '-s_srs', 'EPSG:4269', '-t_srs', 'EPSG:4326', '-lco', 'RFC7946=YES', output, input];
  const executable = ogrExecutable(gdal);
  const diagnostics = await new Promise((accept, reject) => { let text = ''; const child = spawn(executable, args, { windowsHide: true }); child.stdout.on('data', x => { text += x; }); child.stderr.on('data', x => { text += x; }); child.once('error', reject); child.once('close', code => code === 0 ? accept(text) : reject(new Error(`ogr2ogr exited ${code}: ${text.trim()}`))); });
  return { command: [basename(executable), ...args.map((x, i) => i === args.length - 1 ? portable(sourcePath) : x)].join(' '), diagnostics, sourceCrs: 'EPSG:4269' };
}

async function extractCounty(county, sourcePath, boundary, boundaryEvidence, options) {
  const root = join(resolve(options.reports || REPORTS), county.fips); const checkpoint = join(root, 'checkpoint.json'); const expectedOutput = join(root, `${county.countyId}-${county.fips}.tiger-roadways.candidate.geojson`); await mkdir(root, { recursive: true });
  const sourceBody = await readFile(sourcePath); const sourceEvidence = { path: portable(sourcePath), type: extname(sourcePath).slice(1).toUpperCase(), sizeBytes: sourceBody.length, sha256: sha(sourceBody) };
  if (options.resume && await exists(checkpoint)) { const saved = JSON.parse(await readFile(checkpoint)); if (saved.status !== 'FAILED' && saved.source?.sha256 === sourceEvidence.sha256 && saved.boundary?.sha256 === boundaryEvidence.sha256 && saved.output && await exists(expectedOutput)) { const body = await readFile(expectedOutput); if (body.length === saved.output.sizeBytes && sha(body) === saved.output.sha256) return { ...saved, status: 'RESUMED' }; } }
  await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true }); const temporary = join(root, `.ogr-${process.pid}.geojson`);
  let conversion;
  try { conversion = await convert(sourcePath, temporary, options.gdal); const parsed = JSON.parse(await readFile(temporary)); if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) throw new Error('extracted source is not a GeoJSON FeatureCollection');
    const accepted = []; const identities = new Set(); let rejectedGeometryCount = 0; let outOfCountyRejectionCount = 0; let duplicateCount = 0;
    for (const feature of parsed.features) { if (!validGeometry(feature.geometry)) { rejectedGeometryCount += 1; continue; } if (!positions(feature.geometry.coordinates).every(p => contained(p, boundary.geometry))) { outOfCountyRejectionCount += 1; continue; } const geometry = rounded(feature.geometry); const p = feature.properties || {}; const identity = String(p.LINEARID || p.LINEARID10 || p.TLID || feature.id || sha(JSON.stringify([p.FULLNAME || '', geometry]))); const key = sha(`${identity}|${JSON.stringify(geometry)}`); if (identities.has(key)) { duplicateCount += 1; continue; } identities.add(key); accepted.push({ type: 'Feature', id: identity, properties: { ...p, STATEFP: String(p.STATEFP || '48'), COUNTYFP: String(p.COUNTYFP || county.fips.slice(2)).padStart(3, '0'), countyFips: county.fips }, geometry }); }
    accepted.sort((a, b) => String(a.id).localeCompare(String(b.id)) || JSON.stringify(a.geometry).localeCompare(JSON.stringify(b.geometry)));
    const outputPath = expectedOutput; const outputBody = json({ type: 'FeatureCollection', name: `${county.countyId}-${county.fips}-tiger-roadways-candidate`, crs: { type: 'name', properties: { name: 'EPSG:4326' } }, candidate: true, features: accepted }); await atomic(outputPath, outputBody);
    const geometryTypeCounts = Object.fromEntries(['LineString', 'MultiLineString'].map(type => [type, accepted.filter(x => x.geometry.type === type).length]));
    const result = { schemaVersion: 'gridly-lp118-tiger-roadway-extraction-v1', milestone: 'LP118', county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, status: 'GENERATED', source: { ...sourceEvidence, sourceCrs: conversion.sourceCrs }, boundary: boundaryEvidence, outputCrs: 'EPSG:4326', sourceFeatureCount: parsed.features.length, retainedFeatureCount: accepted.length, rejectedFeatureCount: rejectedGeometryCount + outOfCountyRejectionCount + duplicateCount, rejectedGeometryCount, outOfCountyRejectionCount, duplicateCount, geometryTypeCounts, output: { path: portable(outputPath), sizeBytes: Buffer.byteLength(outputBody), sha256: sha(outputBody) }, gdal: { command: conversion.command, diagnostics: conversion.diagnostics.slice(-4000) }, activated: false, productionAuthorized: false, uploadEnabled: false, deploymentEnabled: false };
    await atomic(checkpoint, json(result)); return result;
  } finally { await rm(temporary, { force: true }); }
}

export async function extract(options, hooks = {}) {
  const inventory = JSON.parse(await readFile(options.inventoryPath || INVENTORY)); const counties = selectCounties(inventory, options.fips);
  if (options.source && counties.length !== 1) throw new Error('--source is valid only for one requested county');
  const boundaryPath = resolve(options.boundaries || BOUNDARIES); const boundaryBody = await readFile(boundaryPath); const boundaryCollection = JSON.parse(boundaryBody); const boundaryEvidence = { path: portable(boundaryPath), sizeBytes: boundaryBody.length, sha256: sha(boundaryBody) };
  const reports = resolve(options.reports || REPORTS); await mkdir(reports, { recursive: true }); const results = [];
  for (const county of counties) { let result; try { const matches = boundaryCollection.features.filter(x => fipsOf(x) === county.fips); if (matches.length !== 1) throw new Error(`Boundary source must contain exactly one ${county.fips} feature`); const name = matches[0].properties?.NAME || matches[0].properties?.NAMELSAD?.replace(/ County$/, ''); if (name && name.toLowerCase() !== county.countyName.toLowerCase()) throw new Error(`Boundary county name/FIPS disagreement for ${county.fips}`); const sourcePath = await discoverSource(options, county.fips, counties.length); if (!sourcePath) result = { schemaVersion: 'gridly-lp118-tiger-roadway-extraction-v1', milestone: 'LP118', county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, status: 'REQUIRES_OWNER_SOURCE', boundary: boundaryEvidence, source: null, sourceFeatureCount: 0, retainedFeatureCount: 0, rejectedFeatureCount: 0, duplicateCount: 0, outOfCountyRejectionCount: 0, activated: false, productionAuthorized: false, uploadEnabled: false, deploymentEnabled: false, failures: ['Maintained county TIGER roads source not found'] }; else result = await (hooks.extractCounty || extractCounty)(county, sourcePath, matches[0], boundaryEvidence, options); } catch (error) { result = { schemaVersion: 'gridly-lp118-tiger-roadway-extraction-v1', milestone: 'LP118', county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, status: 'FAILED', source: null, boundary: boundaryEvidence, activated: false, productionAuthorized: false, uploadEnabled: false, deploymentEnabled: false, failures: [error.message] }; }
    await atomic(join(reports, county.fips, 'checkpoint.json'), json(result)); results.push(result); }
  const report = { schemaVersion: 'gridly-lp118-tiger-roadway-extraction-report-v1', milestone: 'LP118', requestedFips: counties.map(x => x.fips), sourceRoot: options.tiger_root ? portable(resolve(options.tiger_root)) : null, explicitSource: options.source ? portable(resolve(options.source)) : null, gdalIdentity: options.gdal ? portable(resolve(options.gdal)) : 'PATH:ogr2ogr', boundarySource: boundaryEvidence, counties: results, failures: results.filter(x => x.status === 'FAILED').map(x => ({ fips: x.fips, failures: x.failures })), productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false }; await atomic(join(reports, 'tiger-roadway-extraction-report.json'), json(report)); return report;
}

export function usage() { return 'Usage: node tools/lp118/extract-tiger-roadways.mjs --fips 48051,48455,48469 --candidate (--tiger-root PATH | --source FILE) [--boundaries FILE] [--gdal DIR] [--reports DIR] [--resume|--force]'; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); const report = await extract(options); process.stdout.write(`LP118 wrote ${report.counties.length} inactive candidate extraction result(s).\n`); if (report.failures.length) process.exitCode = 1; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP118 failed: ${error.message}\n`); process.exitCode = 1; });
