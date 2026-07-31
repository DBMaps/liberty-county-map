#!/usr/bin/env node

/** LP105.1 offline manufacturing orchestration. This module never activates its candidate manifest. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { run as runBuilder } from '../lp104/build-txgio-address-packages.mjs';
import { certifyCountyPackage } from '../lp104/certify-texas-address-package.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COUNTY_MANIFEST = join(ROOT, 'data/lp104/texas-counties.json');
const PACKAGE_DIRECTORY = join(ROOT, 'data/generated/lp104/txgio-addresses');
const DEFAULT_REPORTS = join(ROOT, 'data/generated/lp1051');

const portablePath = path => isAbsolute(path) && !relative(ROOT, path).startsWith(`..${sep}`)
  ? relative(ROOT, path).split(sep).join('/') : path.split(sep).join('/');
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}
export async function sha256File(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

export function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--force' || argument === '--gridly-counties') options[argument.slice(2)] = true;
    else if (['--gdb', '--gdal', '--reports', '--fips'].includes(argument)) {
      if (!argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = argv[++index];
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.fips && options['gridly-counties']) throw new Error('Choose --fips or --gridly-counties, not both');
  if (!options.fips) options['gridly-counties'] = true;
  return options;
}

export function selectCounties(manifest, options = {}) {
  let counties;
  if (options.fips) {
    const requested = new Set(String(options.fips).split(',').map(value => value.trim().padStart(5, '0')));
    counties = manifest.counties.filter(county => requested.has(county.fips));
    if (counties.length !== requested.size) throw new Error('One or more requested FIPS codes are absent from the maintained Texas county manifest');
  } else counties = manifest.counties.filter(county => county.certificationCohort === 'initial28');
  return counties.sort((left, right) => left.fips.localeCompare(right.fips));
}

function runtimeCertificate(county, packagePath, sizeBytes, sha256) {
  return {
    schemaVersion: 1, milestone: 'LP105.1-candidate', countyId: `${county.countyId}-tx`,
    county: `${county.countyName} County`, fips: county.fips, artifact: packagePath.split(sep).pop(),
    sizeBytes, sha256, sourcePackageModified: false,
    acceptance: { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false }
  };
}

export async function manufacture(options = {}, dependencies = {}) {
  const reports = resolve(options.reports || DEFAULT_REPORTS);
  const packageDirectory = resolve(options.packageDirectory || PACKAGE_DIRECTORY);
  const manifest = options.countyManifest || JSON.parse(await readFile(COUNTY_MANIFEST, 'utf8'));
  const counties = selectCounties(manifest, options);
  const build = dependencies.runBuilder || runBuilder;
  const certify = dependencies.certifyCountyPackage || certifyCountyPackage;
  const candidateManifestPath = join(reports, 'runtime-manifest.candidate.json');
  const reportPath = join(reports, 'lp1051-28-county-manufacturing-report.json');
  const productionManifestPath = join(ROOT, 'data/generated/lp104/txgio-addresses/runtime-manifest.json');
  const productionBefore = await sha256File(productionManifestPath);
  const results = [];
  const candidates = [];
  await mkdir(join(reports, 'certificates'), { recursive: true });
  await mkdir(join(reports, 'certification'), { recursive: true });

  for (const county of counties) {
    const packagePath = join(packageDirectory, `${county.countyId}-${county.fips}.addresses.jsonl.gz`);
    const builderCertificatePath = `${packagePath}.json`;
    const result = {
      county: `${county.countyName} County`, fips: county.fips, buildStatus: 'FAIL', resumedStatus: false,
      packagePath: portablePath(packagePath), packageSize: null, sha256: null,
      runtimeCertificateStatus: 'NOT_GENERATED', candidateManifestStatus: 'EXCLUDED',
      lp1046CertificationStatus: 'NOT_RUN', indexedAddressCount: null, runtimeLoadDurationMs: null, failures: []
    };
    try {
      const oldCertificate = JSON.parse(await readFile(builderCertificatePath, 'utf8').catch(() => 'null'));
      const oldHash = await sha256File(packagePath).catch(() => null);
      result.resumedStatus = !options.force && oldCertificate?.packageHash === oldHash;
      const builtManifest = await build({ fips: county.fips, gdb: options.gdb, gdal: options.gdal, output: packageDirectory, force: options.force });
      const built = builtManifest.packages.find(item => item.fips === county.fips);
      if (!built) throw new Error('LP104.4 did not return the county package');
      result.buildStatus = result.resumedStatus ? 'RESUMED' : 'BUILT';

      // Deliberately do not trust LP104.4 metadata: independently read the final artifact.
      result.packageSize = (await stat(packagePath)).size;
      result.sha256 = await sha256File(packagePath);
      if (result.packageSize !== built.outputBytes || result.sha256 !== built.packageHash) throw new Error('independent package size/SHA-256 verification failed');
      const certificatePath = join(reports, 'certificates', `${county.countyId}-${county.fips}.runtime-certificate.json`);
      await atomicJson(certificatePath, runtimeCertificate(county, packagePath, result.packageSize, result.sha256));
      result.runtimeCertificateStatus = 'GENERATED';
      candidates.push({ countyId: `${county.countyId}-tx`, county: result.county, fips: county.fips,
        path: portablePath(packagePath), sizeBytes: result.packageSize, sha256: result.sha256, certificate: portablePath(certificatePath) });
      result.candidateManifestStatus = 'INCLUDED';
    } catch (error) { result.failures.push(`manufacturing: ${error.message}`); }
    results.push(result);
  }

  const candidateManifest = { schemaVersion: 1, milestone: 'LP105.1-candidate', activated: false, packages: candidates };
  await atomicJson(candidateManifestPath, candidateManifest);
  for (const result of results.filter(item => item.candidateManifestStatus === 'INCLUDED')) {
    const certificationPath = join(reports, 'certification', `${result.packagePath.split('/').pop().replace('.addresses.jsonl.gz', '')}.certification.json`);
    try {
      const certification = await certify({ manifestPath: candidateManifestPath, fips: result.fips });
      await atomicJson(certificationPath, certification);
      result.lp1046CertificationStatus = certification.certificationStatus;
      result.indexedAddressCount = certification.indexedAddressCount;
      result.runtimeLoadDurationMs = certification.runtimeLoadDurationMs;
      if (certification.certificationStatus !== 'PASS') result.failures.push(...certification.failures.map(failure => `LP104.6: ${failure}`));
    } catch (error) {
      result.lp1046CertificationStatus = 'FAIL';
      result.failures.push(`LP104.6: ${error.message}`);
      await atomicJson(certificationPath, { county: result.county, countyFips: result.fips, certificationStatus: 'FAIL', failures: [error.message] });
    }
  }
  if (await sha256File(productionManifestPath) !== productionBefore) throw new Error('Production runtime manifest changed during LP105.1 orchestration');
  const report = { schemaVersion: 'gridly-lp1051-manufacturing-report-v1', cohort: options.fips ? 'selected' : 'initial28', activated: false,
    completedCount: results.length, successCount: results.filter(item => !item.failures.length).length,
    failureCount: results.filter(item => item.failures.length).length, counties: results };
  await atomicJson(reportPath, report);
  return { report, reportPath, candidateManifestPath };
}

export async function main(argv = process.argv.slice(2)) {
  const result = await manufacture(parseArguments(argv));
  process.stdout.write(`LP105.1 processed ${result.report.completedCount} counties; ${result.report.failureCount} failed.\n`);
  if (result.report.failureCount) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
