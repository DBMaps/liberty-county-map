#!/usr/bin/env node

/** LP115 candidate-only adapter for the authoritative V790 production crossing rule. */
import { createHash } from 'node:crypto';
import { readFile, mkdir, rename, stat, writeFile, access } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY = join(ROOT, 'data/lp104/texas-counties.json');
const FRA_SOURCE = join(ROOT, 'Crossing-Packages/Texas/fra-crossings-tx.geojson');
const REPORTS = join(ROOT, 'reports/lp115');
const CLASSIFICATIONS = ['PUBLIC_ROADWAY', 'PRIVATE_ROAD', 'INDUSTRIAL', 'RAIL_YARD', 'TEMPORARY_ACCESS'];
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = value => createHash('sha256').update(value).digest('hex');
const portable = path => relative(ROOT, path).replaceAll('\\', '/');
const exists = path => access(path).then(() => true, () => false);
async function atomicJson(path, value) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.tmp`; await writeFile(temp, json(value)); await rename(temp, path); }
function cleanJson(body) { return JSON.parse(body.replace(/^\uFEFF/, '')); }

export function selectCounties(inventory, input) {
  const fips = String(input).split(',').map(x => x.trim());
  if (fips.some(x => !/^48\d{3}$/.test(x))) throw new Error('Every FIPS must be a five-digit Texas county FIPS');
  if (new Set(fips).size !== fips.length) throw new Error('Duplicate FIPS values are not allowed');
  if (inventory.count !== 254 || inventory.counties.length !== 254) throw new Error('Maintained Texas county identity inventory is invalid');
  const byFips = new Map(inventory.counties.map(x => [x.fips, x]));
  const result = fips.map(x => byFips.get(x));
  if (result.some(x => !x)) throw new Error('One or more FIPS codes are absent from the maintained 254-county Texas identity inventory');
  return result;
}

export function classifyFeature(feature) {
  const properties = { ...feature.properties };
  const crossing = String(properties.CROSSING || '').trim();
  if (!crossing) throw new Error('FRA crossing record has no CROSSING identity');
  const inherited = properties.gridlyClassification;
  const classification = CLASSIFICATIONS.includes(inherited) ? inherited : 'PUBLIC_ROADWAY';
  const displayName = String(properties.STREET || '').trim() || String(properties.HIGHWAY || '').trim() || 'Unnamed Crossing';
  return { ...feature, properties: { ...properties, gridlyProductionCertified: true, gridlyClassification: classification, gridlyDisplayName: displayName, gridlyId: `FRA-${crossing}` } };
}

function counts(features) {
  const classificationCounts = Object.fromEntries(CLASSIFICATIONS.map(x => [x, 0]));
  for (const feature of features) classificationCounts[feature.properties.gridlyClassification] = (classificationCounts[feature.properties.gridlyClassification] || 0) + 1;
  return { classificationCounts, publicCrossings: classificationCounts.PUBLIC_ROADWAY, hiddenCrossings: features.length - classificationCounts.PUBLIC_ROADWAY };
}

async function manufactureCounty(county, source, sourceEvidence, options) {
  const countyDir = join(resolve(options.reports || REPORTS), county.fips);
  const checkpointPath = join(countyDir, 'checkpoint.json');
  if (options.resume && await exists(checkpointPath)) {
    const checkpoint = cleanJson(await readFile(checkpointPath, 'utf8'));
    if (checkpoint.source?.sha256 === sourceEvidence.sha256 && checkpoint.fips === county.fips && checkpoint.status !== 'FAILED') return { ...checkpoint, status: checkpoint.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'RESUMED' };
  }
  const selected = source.features.filter(feature => String(feature?.properties?.STCYFIPS || feature?.properties?.CountyCode || '') === county.fips);
  const sourceIds = new Set(); let duplicateCount = 0;
  for (const feature of selected) { const id = String(feature?.properties?.CROSSING || '').trim(); if (sourceIds.has(id)) duplicateCount += 1; sourceIds.add(id); }
  const base = { schemaVersion: 'gridly-lp115-crossing-candidate-v1', county: `${county.countyName} County`, countyId: county.countyId, fips: county.fips, authoritativeSource: 'FRA Texas statewide crossing GeoJSON', source: sourceEvidence, sourceQueryCompleted: true, sourceFilter: { property: 'STCYFIPS (CountyCode fallback)', value: county.fips }, sourceRecordsSelected: selected.length, productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false };
  if (!selected.length) {
    const result = { ...base, status: 'NOT_APPLICABLE', productionCrossingCount: 0, duplicateCount: 0, rejectedCount: 0, certificationStatus: 'PASS_ZERO_APPLICABLE', candidateManifestStatus: 'NOT_APPLICABLE', package: null, blockingReasons: [] };
    await atomicJson(join(countyDir, 'crossing-certification.json'), result); await atomicJson(join(countyDir, 'candidate-crossing-manifest.json'), result); await atomicJson(checkpointPath, result); return result;
  }
  if (duplicateCount) throw new Error(`${duplicateCount} duplicate FRA CROSSING identity record(s) selected; certification fails closed`);
  const sourcePackage = { type: 'FeatureCollection', features: selected };
  const productionFeatures = selected.map(classifyFeature);
  const productionPackage = { ...sourcePackage, features: productionFeatures };
  const productionIds = new Set(productionFeatures.map(x => x.properties.gridlyId));
  if (productionIds.size !== productionFeatures.length) throw new Error('duplicate production identities');
  if (productionFeatures.some(x => String(x.properties.STCYFIPS || x.properties.CountyCode) !== county.fips)) throw new Error('cross-county leakage');
  const sourcePath = join(countyDir, `${county.countyId}-${county.fips}.source-crossings.candidate.geojson`);
  const packagePath = join(countyDir, `${county.countyId}-${county.fips}.production-crossings.candidate.geojson`);
  await atomicJson(sourcePath, sourcePackage); await atomicJson(packagePath, productionPackage);
  const packageBody = await readFile(packagePath); const stats = counts(productionFeatures);
  const result = { ...base, status: 'GENERATED', totalSourceCrossings: selected.length, productionCrossingCount: productionFeatures.length, ...stats, duplicateCount, rejectedCount: 0, sourcePackagePath: portable(sourcePath), package: { path: portable(packagePath), sizeBytes: (await stat(packagePath)).size, sha256: sha(packageBody) }, certificationStatus: 'PASS', candidateManifestStatus: 'GENERATED', productionRule: 'V790 Add-ProductionVisibilityFields (preserve source; certified; governed classification; display name; FRA identity)', blockingReasons: [] };
  await atomicJson(join(countyDir, 'crossing-certification.json'), result); await atomicJson(join(countyDir, 'candidate-crossing-manifest.json'), result); await atomicJson(checkpointPath, result); return result;
}

export async function manufacture(options) {
  const inventory = cleanJson(await readFile(options.inventoryPath || INVENTORY, 'utf8'));
  const counties = selectCounties(inventory, options.fips); const reports = resolve(options.reports || REPORTS); await mkdir(reports, { recursive: true });
  const sourcePath = resolve(options.source || FRA_SOURCE); let sourceBody;
  try { sourceBody = await readFile(sourcePath, 'utf8'); }
  catch (error) {
    const status = error.code === 'ENOENT' ? 'REQUIRES_OWNER_SOURCE' : 'FAILED';
    return { schemaVersion: 'gridly-lp115-report-v1', requestedFips: counties.map(x => x.fips), productionActivation: false, uploadEnabled: false, deploymentEnabled: false, counties: counties.map(county => ({ county: `${county.countyName} County`, fips: county.fips, status, productionAuthorized: false, activated: false, blockingReasons: [error.message] })) };
  }
  let source; try { source = cleanJson(sourceBody); if (source.type !== 'FeatureCollection' || !Array.isArray(source.features)) throw new Error('authoritative source is not a GeoJSON FeatureCollection'); }
  catch (error) { return { schemaVersion: 'gridly-lp115-report-v1', requestedFips: counties.map(x => x.fips), productionActivation: false, uploadEnabled: false, deploymentEnabled: false, counties: counties.map(county => ({ county: `${county.countyName} County`, fips: county.fips, status: 'FAILED', productionAuthorized: false, activated: false, blockingReasons: [error.message] })) }; }
  const evidence = { identity: portable(sourcePath), sizeBytes: Buffer.byteLength(sourceBody), sha256: sha(sourceBody) }; const results = [];
  for (const county of counties) { try { results.push(await manufactureCounty(county, source, evidence, options)); } catch (error) { const failed = { county: `${county.countyName} County`, fips: county.fips, status: 'FAILED', source: evidence, productionAuthorized: false, activated: false, blockingReasons: [error.message] }; await atomicJson(join(reports, county.fips, 'checkpoint.json'), failed); results.push(failed); } }
  const report = { schemaVersion: 'gridly-lp115-report-v1', requestedFips: counties.map(x => x.fips), authoritativeSource: evidence, productionActivation: false, uploadEnabled: false, deploymentEnabled: false, counties: results };
  await atomicJson(join(reports, 'crossing-manufacturing-report.json'), report); return report;
}

export function parseArguments(argv) { const out = { candidate: false }; for (let i = 0; i < argv.length; i++) { const arg = argv[i]; if (['--candidate', '--resume'].includes(arg)) out[arg.slice(2)] = true; else if (['--fips', '--reports', '--source'].includes(arg)) { if (!argv[i + 1]) throw new Error(`${arg} requires a value`); out[arg.slice(2)] = argv[++i]; } else if (arg === '--help' || arg === '-h') out.help = true; else throw new Error(`Unknown option: ${arg}`); } if (!out.help && !out.fips) throw new Error('--fips is required'); if (!out.help && !out.candidate) throw new Error('--candidate is required; LP115 cannot activate production'); return out; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write('Usage: node tools/lp115/manufacture-candidate-crossings.mjs --fips 48051,48455,48469 --candidate [--resume] [--source PATH] [--reports PATH]\n'); const report = await manufacture(options); process.stdout.write(`LP115 wrote evidence for ${report.counties.length} inactive crossing candidate(s).\n`); if (report.counties.some(x => x.status === 'FAILED')) process.exitCode = 1; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP115 failed: ${error.message}\n`); process.exitCode = 1; });
