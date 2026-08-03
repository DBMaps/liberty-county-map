#!/usr/bin/env node

/** LP116 candidate adapter for Gridly's LP028/LP032 TIGER/Line roadway contract. */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY = join(ROOT, 'data/lp104/texas-counties.json');
const REPORTS = join(ROOT, 'reports/lp116');
export const PARTITION_LIMITS = Object.freeze({ targetFeatureCount: 35000, targetBytes: 10 * 1024 * 1024, hardFeatureCount: 45000, hardBytes: 20 * 1024 * 1024 });
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = value => createHash('sha256').update(value).digest('hex');
const portable = path => relative(ROOT, path).replaceAll('\\', '/');
const exists = path => access(path).then(() => true, () => false);
async function atomic(path, body) { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${process.pid}.tmp`; await writeFile(temporary, body); await rename(temporary, path); }
function value(argv, i) { if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${argv[i]} requires a value`); return argv[i + 1]; }

export function parseArguments(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--candidate', '--resume', '--force'].includes(arg)) out[arg.slice(2)] = true;
    else if (['--fips', '--source', '--reports', '--boundaries'].includes(arg)) { out[arg.slice(2)] = value(argv, i); i += 1; }
    else if (['-h', '--help'].includes(arg)) out.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!out.help && !out.fips) throw new Error('--fips is required');
  if (!out.help && !out.candidate) throw new Error('--candidate is required; LP116 cannot write production assets');
  if (out.resume && out.force) throw new Error('--resume and --force are mutually exclusive');
  return out;
}

export function selectCounties(inventory, input) {
  const values = String(input).split(',').map(x => x.trim());
  if (values.some(x => !/^48\d{3}$/.test(x))) throw new Error('Every FIPS must be a five-digit Texas county FIPS');
  if (new Set(values).size !== values.length) throw new Error('Duplicate FIPS values are not allowed');
  if (inventory.count !== 254 || inventory.counties.length !== 254) throw new Error('Maintained Texas county identity inventory is invalid');
  const byFips = new Map(inventory.counties.map(x => [x.fips, x])); const result = values.map(x => byFips.get(x));
  if (result.some(x => !x)) throw new Error('One or more FIPS codes are absent from the maintained 254-county Texas identity inventory');
  return result;
}

function finitePosition(position) { return Array.isArray(position) && position.length >= 2 && position.every(Number.isFinite); }
export function validLineGeometry(geometry) {
  if (!geometry || !['LineString', 'MultiLineString'].includes(geometry.type)) return false;
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
  return Array.isArray(lines) && lines.length > 0 && lines.every(line => Array.isArray(line) && line.length >= 2 && line.every(finitePosition));
}
function roundGeometry(geometry) { const walk = x => typeof x === 'number' ? Number(x.toFixed(7)) : x.map(walk); return { type: geometry.type, coordinates: walk(geometry.coordinates) }; }
function featureFips(feature) { const p = feature?.properties || {}; const direct = String(p.STCYFIPS || p.CountyCode || p.GEOID || '').trim(); if (direct) return direct.slice(-5); const county = String(p.COUNTYFP || p.COUNTYFP20 || '').trim(); return county ? `${String(p.STATEFP || p.STATEFP20 || '48').padStart(2, '0')}${county.padStart(3, '0')}` : ''; }
function coordinates(geometry) { return (geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat()); }
function pointInRing([x, y], ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if (((yi > y) !== (yj > y)) && x <= ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
function contained(point, geometry) { const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []; return polygons.some(polygon => pointInRing(point, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(point, ring))); }
function bounds(feature) { const c = coordinates(feature.geometry); return c.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]); }
function union(features) { return features.reduce((b, f) => { const x = bounds(f); return [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])]; }, [Infinity, Infinity, -Infinity, -Infinity]); }
function split(features, limits) {
  const bytes = Buffer.byteLength(JSON.stringify(features)); if (features.length <= limits.targetFeatureCount && bytes <= limits.targetBytes) return [features];
  const box = union(features); const axis = box[2] - box[0] >= box[3] - box[1] ? 0 : 1;
  const sorted = [...features].sort((a, b) => { const aa = bounds(a), bb = bounds(b); return (aa[axis] + aa[axis + 2]) - (bb[axis] + bb[axis + 2]) || a.id.localeCompare(b.id); });
  const middle = Math.ceil(sorted.length / 2); if (!middle || middle === sorted.length) return [sorted];
  return [...split(sorted.slice(0, middle), limits), ...split(sorted.slice(middle), limits)];
}
function sourceIdentity(sourcePath, body) { return { authority: 'US Census TIGER/Line county roads (Gridly LP028/LP032 roadway source)', path: portable(sourcePath), sha256: hash(body), format: 'GeoJSON', sourceCrs: 'EPSG:4326', outputCrs: 'EPSG:4326' }; }

async function countyBuild(county, source, evidence, boundaries, options) {
  const root = join(resolve(options.reports || REPORTS), county.fips); const checkpoint = join(root, 'checkpoint.json');
  if (options.resume && await exists(checkpoint)) { const saved = JSON.parse(await readFile(checkpoint, 'utf8')); if (saved.source?.sha256 === evidence.sha256 && saved.status !== 'FAILED') return { ...saved, status: saved.status === 'NOT_APPLICABLE' ? saved.status : 'RESUMED' }; }
  await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true });
  const selected = source.features.filter(feature => featureFips(feature) === county.fips);
  const boundary = boundaries?.features?.find(feature => featureFips(feature) === county.fips)?.geometry;
  const accepted = []; const identities = new Set(); let rejected = 0; let duplicates = 0; let outOfCounty = 0;
  for (const item of selected) {
    if (!validLineGeometry(item.geometry)) { rejected += 1; continue; }
    if (boundary && !coordinates(item.geometry).every(point => contained(point, boundary))) { rejected += 1; outOfCounty += 1; continue; }
    const geometry = roundGeometry(item.geometry); const p = item.properties || {}; const sourceId = String(p.LINEARID || p.LINEARID10 || p.TLID || item.id || '').trim();
    const stableSegmentId = `${county.countyId}-${hash(`${sourceId}|${JSON.stringify(geometry)}`).slice(0, 24)}`;
    if (identities.has(stableSegmentId)) { duplicates += 1; continue; } identities.add(stableSegmentId);
    accepted.push({ type: 'Feature', id: stableSegmentId, properties: { ...p, countyId: county.countyId, countyFips: county.fips, stableSegmentId }, geometry });
  }
  accepted.sort((a, b) => a.id.localeCompare(b.id));
  const base = { schemaVersion: 'gridly-lp116-roadway-candidate-v1', county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, source: evidence, sourceQueryCompleted: true, sourceRecordsSelected: selected.length, acceptedGeometryCount: accepted.length, rejectedGeometryCount: rejected, duplicateCount: duplicates, outOfCountyRejectionCount: outOfCounty, activated: false, productionAuthorization: false, uploadEnabled: false, deploymentEnabled: false };
  if (!accepted.length) {
    const invalidSelection = selected.length > 0;
    const result = { ...base, status: invalidSelection ? 'FAILED' : 'NOT_APPLICABLE', partitionDecision: invalidSelection ? 'FAILED' : 'NOT_REQUIRED', packages: [], candidateManifestStatus: invalidSelection ? 'FAILED' : 'NOT_APPLICABLE', certificationStatus: invalidSelection ? 'FAILED' : 'PASS_ZERO_APPLICABLE', candidateRuntimeIdentity: null, blockingReasons: invalidSelection ? ['Authoritative source selection contained no certifiable roadway geometry'] : [] };
    await atomic(checkpoint, json(result)); return result;
  }
  const limits = { ...PARTITION_LIMITS, ...options.partitionLimits }; const groups = split(accepted, limits); const partitioned = groups.length > 1; const packages = [];
  for (let i = 0; i < groups.length; i += 1) {
    const packageId = partitioned ? `${county.countyId}-tx-p${String(i + 1).padStart(4, '0')}` : `${county.countyId}-tx`;
    const fileName = `${packageId}.roadways.candidate.geojson`; const packageBody = json({ type: 'FeatureCollection', gridlyPackage: { countyId: county.countyId, fips: county.fips, packageId, candidate: true }, features: groups[i] }); const path = join(root, 'packages', fileName); await atomic(path, packageBody);
    packages.push({ packageId, fileName: `packages/${fileName}`, featureCount: groups[i].length, byteLength: Buffer.byteLength(packageBody), sha256: hash(packageBody), bounds: union(groups[i]) });
  }
  const manifest = { schemaVersion: 'gridly-lp116-roadway-manifest-v1', countyId: county.countyId, county: `${county.countyName} County`, fips: county.fips, candidate: true, source: evidence, outputCrs: 'EPSG:4326', partitionStrategy: partitioned ? 'LP032 deterministic adaptive longest-axis spatial partition' : 'single package', featureCount: accepted.length, packageCount: packages.length, packages, activated: false, productionAuthorization: false };
  const manifestPath = join(root, 'candidate-roadway-manifest.json'); await atomic(manifestPath, json(manifest));
  const checks = { countyIdentity: accepted.every(x => x.properties.countyFips === county.fips && x.properties.countyId === county.countyId), sourceIdentity: Boolean(evidence.sha256), validGeometry: accepted.every(x => validLineGeometry(x.geometry)), countyContainment: boundary ? accepted.every(x => coordinates(x.geometry).every(point => contained(point, boundary))) : selected.every(x => featureFips(x) === county.fips), deterministicFeatureIds: identities.size === accepted.length, noDuplicateProductionIdentities: new Set(accepted.map(x => x.id)).size === accepted.length, manifestPackageAgreement: packages.reduce((n, x) => n + x.featureCount, 0) === accepted.length, packageHashes: true, runtimeFilenameIdentity: packages.every(x => x.fileName.includes(county.countyId)), candidateOnly: true };
  for (const pkg of packages) { const body = await readFile(join(root, pkg.fileName)); checks.packageHashes &&= body.length === pkg.byteLength && hash(body) === pkg.sha256; }
  const certificationStatus = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  const certification = { schemaVersion: 'gridly-lp116-roadway-certification-v1', countyId: county.countyId, fips: county.fips, source: evidence, featureCount: accepted.length, partitionCount: packages.length, checks, certificationStatus, productionAuthorization: false };
  const certificationPath = join(root, 'roadway-certification.json'); await atomic(certificationPath, json(certification));
  const result = { ...base, status: certificationStatus === 'PASS' ? 'GENERATED' : 'FAILED', partitionDecision: partitioned ? 'PARTITIONED' : 'SINGLE_PACKAGE', packages, manifest: { path: portable(manifestPath), sizeBytes: (await stat(manifestPath)).size, sha256: hash(await readFile(manifestPath)) }, certification: { path: portable(certificationPath), sizeBytes: (await stat(certificationPath)).size, sha256: hash(await readFile(certificationPath)) }, candidateManifestStatus: certificationStatus === 'PASS' ? 'GENERATED' : 'FAILED', certificationStatus, candidateRuntimeIdentity: { countyId: county.countyId, fips: county.fips, packageIds: packages.map(x => x.packageId), activated: false, productionAuthorization: false }, blockingReasons: certificationStatus === 'PASS' ? [] : ['Roadway certification failed'] };
  await atomic(checkpoint, json(result)); return result;
}

export async function manufacture(options, hooks = {}) {
  const inventory = JSON.parse(await readFile(options.inventoryPath || INVENTORY, 'utf8')); const counties = selectCounties(inventory, options.fips); const reports = resolve(options.reports || REPORTS); await mkdir(reports, { recursive: true });
  const sourcePath = options.source && resolve(options.source); let source; let evidence; let sourceError;
  if (!sourcePath || !await exists(sourcePath)) sourceError = { status: 'REQUIRES_OWNER_SOURCE', message: 'Owner-controlled authoritative TIGER/Line roadway GeoJSON is required via --source' };
  else try { const body = await readFile(sourcePath); source = JSON.parse(body); if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) throw new Error('source is not a GeoJSON FeatureCollection'); evidence = sourceIdentity(sourcePath, body); } catch (error) { sourceError = { status: 'FAILED', message: `Authoritative roadway source query failed: ${error.message}` }; }
  let boundaries; if (options.boundaries) try { boundaries = JSON.parse(await readFile(resolve(options.boundaries))); } catch (error) { sourceError = { status: 'FAILED', message: `County boundary source query failed: ${error.message}` }; }
  const results = [];
  for (const county of counties) {
    if (sourceError) { const result = { schemaVersion: 'gridly-lp116-roadway-candidate-v1', county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, status: sourceError.status, sourceQueryCompleted: false, productionAuthorization: false, activated: false, uploadEnabled: false, deploymentEnabled: false, partitionDecision: 'FAILED', packages: [], candidateManifestStatus: sourceError.status, certificationStatus: sourceError.status, blockingReasons: [sourceError.message] }; await atomic(join(reports, county.fips, 'checkpoint.json'), json(result)); results.push(result); continue; }
    try { results.push(await (hooks.countyBuild || countyBuild)(county, source, evidence, boundaries, options)); } catch (error) { const result = { county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, status: 'FAILED', source: evidence, sourceQueryCompleted: true, productionAuthorization: false, activated: false, uploadEnabled: false, deploymentEnabled: false, partitionDecision: 'FAILED', packages: [], candidateManifestStatus: 'FAILED', certificationStatus: 'FAILED', blockingReasons: [error.message] }; await atomic(join(reports, county.fips, 'checkpoint.json'), json(result)); results.push(result); }
  }
  const report = { schemaVersion: 'gridly-lp116-roadway-manufacturing-v1', requestedFips: counties.map(x => x.fips), source: evidence || null, candidateOnly: true, productionActivation: false, uploadEnabled: false, deploymentEnabled: false, counties: results, failures: results.filter(x => x.status === 'FAILED').map(x => ({ fips: x.fips, reasons: x.blockingReasons })) }; await atomic(join(reports, 'roadway-manufacturing-report.json'), json(report)); return report;
}

export function usage() { return 'Usage: node tools/lp116/manufacture-candidate-roadways.mjs --fips 48051,48455,48469 --candidate --source PATH [--boundaries PATH] [--reports PATH] [--resume|--force]'; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); const report = await manufacture(options); process.stdout.write(`LP116 wrote ${report.counties.length} inactive roadway candidate result(s).\n`); if (report.failures.length) process.exitCode = 1; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP116 failed: ${error.message}\n`); process.exitCode = 1; });
