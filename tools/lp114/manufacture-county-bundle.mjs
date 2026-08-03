#!/usr/bin/env node

/** LP114 governed, local-only county asset manufacturing orchestrator. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { certifyCountyPackage } from '../lp104/certify-texas-address-package.mjs';
import { certificateFor, validateRuntimeCertificate } from '../lp107/generate-runtime-certificates.mjs';
import { manufacture as manufactureCrossings } from '../lp115/manufacture-candidate-crossings.mjs';
import { manufacture as manufactureRoadways } from '../lp116/manufacture-candidate-roadways.mjs';
import { manufacture as manufactureLp117Assets } from '../lp117/manufacture-county-assets.mjs';
import { extract as extractTigerRoadways } from '../lp118/extract-tiger-roadways.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COUNTY_INVENTORY = join(ROOT, 'data/lp104/texas-counties.json');
const DEFAULT_ADDRESS_DIR = join(ROOT, 'data/generated/lp104/txgio-addresses');
const DEFAULT_REPORTS = join(ROOT, 'reports/lp114');
export const STATUSES = Object.freeze(['GENERATED', 'RESUMED', 'VERIFIED_EXISTING', 'NOT_APPLICABLE', 'REQUIRES_OWNER_SOURCE', 'REVIEW_REQUIRED', 'FAILED', 'NOT_AUTHORIZED']);
export const ASSET_KEYS = Object.freeze(['countyIdentity', 'countyBoundary', 'addresses', 'addressSidecar', 'addressCertification', 'addressRuntimeCertificate', 'railroadCrossingSource', 'productionCrossings', 'crossingCertification', 'roadwaySource', 'roadwayGeometry', 'roadwayManifest', 'roadwayCertification', 'candidateRoadwayRuntimeIdentity', 'communityLocality', 'zipCoverage', 'curatedDestinations', 'searchCoverage', 'countyPromotionMetadata', 'candidateRuntimeIdentity', 'storageUploadPlan']);

const json = value => `${JSON.stringify(value, null, 2)}\n`;
async function atomicJson(path, value) { await mkdir(dirname(path), { recursive: true }); const temp = `${path}.${process.pid}.tmp`; await writeFile(temp, json(value)); await rename(temp, path); }
async function digest(path) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return hash.digest('hex'); }
async function fileEvidence(path) { return { path: portable(path), sizeBytes: (await stat(path)).size, sha256: await digest(path) }; }
const portable = path => relative(ROOT, path).replaceAll('\\', '/');
const exists = path => access(path).then(() => true, () => false);
function argValue(argv, index) { if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${argv[index]} requires a value`); return argv[index + 1]; }

export function parseArguments(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (['--resume', '--force', '--dry-run', '--addresses-only', '--skip-addresses'].includes(arg)) out[arg.slice(2).replaceAll('-', '_')] = true;
    else if (['--fips', '--reports', '--gdb', '--gdal', '--address-dir', '--crossing-source', '--crossing-reports', '--roadway-source', '--roadway-boundaries', '--roadway-reports', '--tiger-road-root', '--tiger-gdal', '--tiger-reports'].includes(arg)) { out[arg.slice(2).replaceAll('-', '_')] = argValue(argv, i); i += 1; }
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!out.help && !out.fips) throw new Error('--fips is required');
  if (out.resume && out.force) throw new Error('--resume and --force are mutually exclusive');
  if (out.addresses_only && out.skip_addresses) throw new Error('--addresses-only and --skip-addresses are mutually exclusive');
  if (out.roadway_source && out.tiger_road_root) throw new Error('--roadway-source and --tiger-road-root are mutually exclusive');
  return out;
}

export function selectCounties(inventory, input) {
  const values = String(input).split(',').map(value => value.trim());
  if (values.some(value => !/^48\d{3}$/.test(value))) throw new Error('Every FIPS must be a five-digit Texas county FIPS');
  if (new Set(values).size !== values.length) throw new Error('Duplicate FIPS values are not allowed');
  const byFips = new Map(inventory.counties.map(county => [county.fips, county]));
  const selected = values.map(fips => byFips.get(fips));
  if (selected.some(value => !value)) throw new Error('One or more FIPS codes are absent from the maintained 254-county Texas identity inventory');
  if (inventory.count !== 254 || byFips.size !== 254) throw new Error('Maintained Texas county identity inventory is invalid');
  return selected;
}

async function runBuilder(args) {
  await new Promise((accept, reject) => {
    const child = spawn(process.execPath, [join(ROOT, 'tools/lp104/build-txgio-address-packages.mjs'), ...args], { stdio: 'inherit', windowsHide: true });
    child.once('error', reject); child.once('close', code => code === 0 ? accept() : reject(new Error(`address builder exited ${code}`)));
  });
}

async function inspectAddress(county, options, countyDir) {
  const addressDir = resolve(options.address_dir || DEFAULT_ADDRESS_DIR);
  const stem = `${county.countyId}-${county.fips}`;
  const packagePath = join(addressDir, `${stem}.addresses.jsonl.gz`);
  const sidecarPath = `${packagePath}.json`;
  const packageExists = await exists(packagePath); const sidecarExists = await exists(sidecarPath);
  if (options.skip_addresses && (!packageExists || !sidecarExists)) throw new Error('address reuse requested but package or sidecar is unavailable');
  let addressStatus = 'VERIFIED_EXISTING';
  if (!packageExists || !sidecarExists) {
    if (options.dry_run || !options.gdb) return { missing: true, assets: { addresses: { status: 'REQUIRES_OWNER_SOURCE', prerequisite: 'TxGIO 2026 geodatabase and existing package, or --gdb' }, addressSidecar: { status: 'REQUIRES_OWNER_SOURCE', prerequisite: 'TxGIO address package manufacture' }, addressCertification: { status: 'REQUIRES_OWNER_SOURCE' }, addressRuntimeCertificate: { status: 'REQUIRES_OWNER_SOURCE' } } };
    await runBuilder(['--fips', county.fips, '--gdb', options.gdb, '--output', addressDir, ...(options.gdal ? ['--gdal', options.gdal] : []), ...(options.force ? ['--force'] : [])]);
    addressStatus = 'GENERATED';
  } else if (options.resume) addressStatus = 'RESUMED';
  const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
  const actual = { sizeBytes: (await stat(packagePath)).size, sha256: await digest(packagePath) };
  if (sidecar.fips !== county.fips || sidecar.countyId !== county.countyId || sidecar.outputBytes !== actual.sizeBytes || sidecar.packageHash !== actual.sha256) throw new Error('address package sidecar integrity mismatch');
  const runtimePath = join(countyDir, `${stem}.runtime-certificate.candidate.json`);
  const identity = { slug: county.countyId, name: county.countyName, fips: county.fips };
  const runtime = certificateFor(identity, `${stem}.addresses.jsonl.gz`, actual.sizeBytes, actual.sha256);
  runtime.milestone = 'LP114-candidate'; runtime.activated = false; runtime.productionAuthorization = false;
  const validationExpected = { ...certificateFor(identity, `${stem}.addresses.jsonl.gz`, actual.sizeBytes, actual.sha256), milestone: 'LP114-candidate' };
  if (validateRuntimeCertificate(runtime, validationExpected).length) throw new Error('candidate runtime certificate validation failed');
  await atomicJson(runtimePath, runtime);
  const certificationPath = join(countyDir, 'address-certification.json');
  const certification = await certifyCountyPackage({ packagePath, certificatePath: runtimePath, county: `${county.countyName} County`, fips: county.fips });
  await atomicJson(certificationPath, certification);
  if (certification.certificationStatus !== 'PASS') throw new Error(`LP113 address certification failed: ${certification.failures.join('; ')}`);
  return { actual, assets: {
    addresses: { status: addressStatus, path: portable(packagePath), ...actual },
    addressSidecar: { status: addressStatus, ...await fileEvidence(sidecarPath) },
    addressCertification: { status: 'GENERATED', ...await fileEvidence(certificationPath), certificationStatus: 'PASS' },
    addressRuntimeCertificate: { status: 'GENERATED', ...await fileEvidence(runtimePath), activated: false, productionAuthorization: false }
  } };
}

function unsupportedAssets(addressesOnly) {
  const notAuthorized = key => ({ status: 'NOT_AUTHORIZED', reason: `${key} skipped because --addresses-only was selected` });
  const result = {
    countyBoundary: notAuthorized('county boundary'), roadwaySource: notAuthorized('roadway source'), communityLocality: notAuthorized('community/locality'), zipCoverage: notAuthorized('ZIP coverage'), curatedDestinations: notAuthorized('curated destination'), searchCoverage: notAuthorized('search coverage')
  };
  return result;
}

function roadwayAssets(result) {
  const common = { productionAuthorization: false, activated: false };
  const status = result.status;
  if (['REQUIRES_OWNER_SOURCE', 'FAILED'].includes(status)) return {
    roadwayGeometry: { status, ...common, reason: result.blockingReasons?.join('; ') }, roadwayManifest: { status, ...common, reason: result.blockingReasons?.join('; ') },
    roadwayCertification: { status, ...common, reason: result.blockingReasons?.join('; ') }, candidateRoadwayRuntimeIdentity: { status, ...common, reason: result.blockingReasons?.join('; ') }
  };
  return {
    roadwayGeometry: { status, ...common, sourceRecordsSelected: result.sourceRecordsSelected, acceptedGeometryCount: result.acceptedGeometryCount, rejectedGeometryCount: result.rejectedGeometryCount, duplicateCount: result.duplicateCount, outOfCountyRejectionCount: result.outOfCountyRejectionCount, partitionDecision: result.partitionDecision, packages: result.packages },
    roadwayManifest: { status: result.candidateManifestStatus === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : status, ...common, manifest: result.manifest || null },
    roadwayCertification: { status, ...common, certificationStatus: result.certificationStatus, certification: result.certification || null },
    candidateRoadwayRuntimeIdentity: { status, ...common, identity: result.candidateRuntimeIdentity }
  };
}

function crossingAssets(result) {
  const common = { productionAuthorized: false, activated: false };
  if (result.status === 'REQUIRES_OWNER_SOURCE' || result.status === 'FAILED') return {
    railroadCrossingSource: { status: result.status, ...common, reason: result.blockingReasons?.join('; ') },
    productionCrossings: { status: result.status, ...common, reason: result.blockingReasons?.join('; ') },
    crossingCertification: { status: result.status, ...common, reason: result.blockingReasons?.join('; ') }
  };
  const status = result.status;
  return {
    railroadCrossingSource: { status, ...common, source: result.source, sourceRecordsSelected: result.sourceRecordsSelected, sourceQueryCompleted: result.sourceQueryCompleted },
    productionCrossings: { status, ...common, package: result.package, productionCrossingCount: result.productionCrossingCount, classificationCounts: result.classificationCounts },
    crossingCertification: { status, ...common, certificationStatus: result.certificationStatus, duplicateCount: result.duplicateCount, rejectedCount: result.rejectedCount, candidateManifestStatus: result.candidateManifestStatus }
  };
}

export async function manufacture(options, hooks = {}) {
  const startedAt = (hooks.now?.() || new Date()).toISOString();
  const inventory = JSON.parse(await readFile(options.inventoryPath || COUNTY_INVENTORY, 'utf8'));
  const counties = selectCounties(inventory, options.fips);
  const reports = resolve(options.reports || DEFAULT_REPORTS); await mkdir(reports, { recursive: true });
  let crossingByFips = new Map();
  let roadwayByFips = new Map();
  let foundationByFips = new Map();
  if (!options.addresses_only) {
    const foundation = await (hooks.manufactureLp117Assets || manufactureLp117Assets)({ fips: counties.map(x => x.fips).join(','), boundaries: options.roadway_boundaries, roadway_source: options.tiger_road_root ? null : options.roadway_source, reports, resume: options.resume, inventoryPath: options.inventoryPath || COUNTY_INVENTORY });
    foundationByFips = new Map(foundation.counties.map(row => [row.fips, row]));
    const crossingReport = await (hooks.manufactureCrossings || manufactureCrossings)({ fips: counties.map(x => x.fips).join(','), source: options.crossing_source, reports: options.crossing_reports || join(reports, 'crossings'), resume: options.resume, inventoryPath: options.inventoryPath || COUNTY_INVENTORY });
    crossingByFips = new Map(crossingReport.counties.map(row => [row.fips, row]));
    let extractedByFips = new Map();
    if (options.tiger_road_root) {
      const extraction = await (hooks.extractTigerRoadways || extractTigerRoadways)({ fips: counties.map(x => x.fips).join(','), tiger_root: options.tiger_road_root, boundaries: options.roadway_boundaries, gdal: options.tiger_gdal, reports: options.tiger_reports || join(reports, 'tiger-roadways'), resume: options.resume, force: options.force, inventoryPath: options.inventoryPath || COUNTY_INVENTORY });
      extractedByFips = new Map(extraction.counties.map(row => [row.fips, row]));
    }
    const roadwayRows = [];
    for (const county of counties) {
      const extracted = extractedByFips.get(county.fips); const source = extracted?.output ? join(resolve(options.tiger_reports || join(reports, 'tiger-roadways')), county.fips, `${county.countyId}-${county.fips}.tiger-roadways.candidate.geojson`) : options.roadway_source || null;
      const roadwayReport = await (hooks.manufactureRoadways || manufactureRoadways)({ fips: county.fips, source, boundaries: options.roadway_boundaries, reports: options.roadway_reports || join(reports, 'roadways'), resume: options.resume, force: options.force, inventoryPath: options.inventoryPath || COUNTY_INVENTORY });
      const row = roadwayReport.counties[0]; if (extracted && !extracted.output) { row.status = extracted.status; row.blockingReasons = extracted.failures || ['TIGER roadway extraction unavailable']; } roadwayRows.push(row);
    }
    const roadwayReport = { counties: roadwayRows };
    roadwayByFips = new Map(roadwayReport.counties.map(row => [row.fips, row]));
  }
  const results = [];
  for (const county of counties) {
    const countyDir = join(reports, county.fips); await mkdir(countyDir, { recursive: true });
    const foundation = foundationByFips.get(county.fips);
    const extraction = !options.addresses_only && options.tiger_road_root ? roadwayByFips.get(county.fips) : null;
    const generalized = foundation ? { countyBoundary: foundation.boundary, roadwaySource: extraction?.source ? { status: extraction.status, source: extraction.source, sourceRecordsSelected: extraction.sourceRecordsSelected, containment: true } : foundation.roadwaySource, communityLocality: foundation.communities, zipCoverage: foundation.zipCoverage, curatedDestinations: foundation.curatedDestinations, searchCoverage: foundation.searchCoverage } : unsupportedAssets(options.addresses_only);
    const assets = { countyIdentity: { status: 'VERIFIED_EXISTING', inventory: portable(options.inventoryPath || COUNTY_INVENTORY) }, ...generalized,
      candidateRuntimeIdentity: { status: 'GENERATED', activated: false, productionAuthorization: false }, storageUploadPlan: { status: 'NOT_AUTHORIZED', uploadEnabled: false } };
    if (options.addresses_only) Object.assign(assets, { railroadCrossingSource: { status: 'NOT_AUTHORIZED', reason: '--addresses-only selected' }, productionCrossings: { status: 'NOT_AUTHORIZED', reason: '--addresses-only selected' }, crossingCertification: { status: 'NOT_AUTHORIZED', reason: '--addresses-only selected' } });
    else Object.assign(assets, crossingAssets(crossingByFips.get(county.fips)), roadwayAssets(roadwayByFips.get(county.fips)));
    if (options.addresses_only) for (const key of ['roadwayGeometry', 'roadwayManifest', 'roadwayCertification', 'candidateRoadwayRuntimeIdentity']) assets[key] = { status: 'NOT_AUTHORIZED', reason: '--addresses-only selected', activated: false, productionAuthorization: false };
    const failures = [];
    if (assets.crossingCertification.status === 'FAILED') failures.push({ asset: 'crossings', message: assets.crossingCertification.reason });
    if (assets.roadwayCertification.status === 'FAILED') failures.push({ asset: 'roadways', message: assets.roadwayCertification.reason });
    if (!options.skip_addresses || await exists(join(resolve(options.address_dir || DEFAULT_ADDRESS_DIR), `${county.countyId}-${county.fips}.addresses.jsonl.gz`))) {
      try { Object.assign(assets, (await (hooks.inspectAddress || inspectAddress)(county, options, countyDir)).assets); }
      catch (error) { failures.push({ asset: 'addresses', message: error.message }); for (const key of ['addresses', 'addressSidecar', 'addressCertification', 'addressRuntimeCertificate']) assets[key] = { status: 'FAILED', error: error.message }; }
    } else for (const key of ['addresses', 'addressSidecar', 'addressCertification', 'addressRuntimeCertificate']) assets[key] = { status: 'REQUIRES_OWNER_SOURCE', prerequisite: 'Existing owner-local package or TxGIO --gdb' };
    const blockingReasons = Object.entries(assets).filter(([, value]) => ['REQUIRES_OWNER_SOURCE', 'REVIEW_REQUIRED', 'FAILED'].includes(value.status)).map(([key, value]) => `${key}: ${value.error || value.prerequisite || value.reason || value.status}`);
    assets.countyPromotionMetadata = { status: 'GENERATED', missingPrerequisites: blockingReasons, productionAuthorized: false, activated: false, uploadEnabled: false, deploymentEnabled: false };
    const candidate = { schemaVersion: 'gridly-lp117-county-candidate-v1', milestone: 'LP117', sourceMilestone: 'LP114', county: `${county.countyName} County`, fips: county.fips, activated: false, productionAuthorized: false, productionAuthorization: false, uploadEnabled: false, deploymentEnabled: false, assets, certificationState: assets.addressCertification?.certificationStatus || 'NOT_CERTIFIED', reviewRequirements: blockingReasons.filter(x => x.includes('REVIEW_REQUIRED')), blockingReasons };
    await atomicJson(join(countyDir, 'candidate-manifest.json'), candidate);
    const result = { county: `${county.countyName} County`, fips: county.fips, productionAuthorized: false, activated: false, assets, failures, completeForCandidateReview: blockingReasons.length === 0, blockingReasons };
    const completedAssetKeys = [];
    for (const asset of ASSET_KEYS) {
      completedAssetKeys.push(asset);
      await atomicJson(join(countyDir, 'checkpoint.json'), { schemaVersion: 'gridly-lp114-checkpoint-v1', ...result, completedAssetKeys: [...completedAssetKeys], lastCompletedAsset: asset });
    }
    results.push(result);
  }
  const report = { schemaVersion: 'gridly-lp114-county-bundle-v1', requestedFips: counties.map(x => x.fips), sourcePaths: { countyInventory: portable(options.inventoryPath || COUNTY_INVENTORY), addressDirectory: portable(resolve(options.address_dir || DEFAULT_ADDRESS_DIR)), txgioGeodatabaseProvided: Boolean(options.gdb), gdalProvided: Boolean(options.gdal) }, startedAt, completedAt: (hooks.now?.() || new Date()).toISOString(), resume: Boolean(options.resume), force: Boolean(options.force), dryRun: Boolean(options.dry_run), productionActivation: false, uploadEnabled: false, deploymentEnabled: false, counties: results, failures: results.flatMap(row => row.failures.map(failure => ({ fips: row.fips, ...failure }))), missingOwnerPrerequisites: results.flatMap(row => row.blockingReasons.filter(x => x.includes('REQUIRES_OWNER_SOURCE')).map(reason => ({ fips: row.fips, reason }))) };
  await atomicJson(join(reports, 'county-bundle-manufacturing-report.json'), report);
  return report;
}

export function usage() { return 'Usage: node tools/lp114/manufacture-county-bundle.mjs --fips 48051,48455,48469 [--resume|--force] [--reports PATH] [--address-dir PATH] [--gdb PATH] [--gdal PATH] [--crossing-source FRA.geojson] [--tiger-road-root PATH|--roadway-source TIGER-roads.geojson] [--tiger-gdal PATH] [--roadway-boundaries counties.geojson] [--dry-run] [--addresses-only|--skip-addresses]'; }
export async function main(argv = process.argv.slice(2)) { const options = parseArguments(argv); if (options.help) return process.stdout.write(`${usage()}\n`); const report = await manufacture(options); process.stdout.write(`LP114 wrote ${report.counties.length} inactive candidate county bundle(s).\n`); if (report.failures.length) process.exitCode = 1; }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`LP114 failed: ${error.message}\n`); process.exitCode = 1; });
