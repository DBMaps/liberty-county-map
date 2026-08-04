#!/usr/bin/env node

/** LP135 read-only reconciliation of observed statewide certification evidence. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = async path => JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export async function buildStatewideCertification() {
  const [readiness, reconciliation, lp134] = await Promise.all([
    readJson('evidence/lp131/statewide-readiness-audit.json'),
    readJson('evidence/lp130/final-reconciliation.json'),
    readJson('evidence/lp134/certification-results.json')
  ]);
  const identities = new Map(reconciliation.packageInventory.map(item => [item.fips, item]));
  const blockers = new Map(lp134.remaining.map(item => [item.fips, item]));
  const counties = readiness.counties.map(item => {
    const identity = identities.get(item.fips);
    const blocker = blockers.get(item.fips);
    if (!identity) throw new Error(`LP130 identity missing for ${item.fips}`);
    return {
      county: item.county,
      fips: item.fips,
      certificationStatus: blocker ? 'CERTIFICATION_BLOCKED' : 'CERTIFIED',
      failureStage: blocker ? 'PACKAGE_AVAILABILITY' : null,
      primaryClassification: blocker ? blocker.reasonCode : 'OBSERVED_PASS',
      evidenceReference: blocker
        ? `evidence/lp134/certification-results.json#/remaining/${lp134.remaining.indexOf(blocker)}`
        : item.address.certificationEvidence,
      packageIdentity: { name: identity.packageName, sizeBytes: identity.sizeBytes, sha256: identity.sha256 },
      ...(blocker && { governingEvidence: blocker.reason,
        recommendedCorrectiveAction: 'Restore or securely mount the byte-identical LP130 package, verify its recorded size and SHA-256, and execute the LP134 certifier twice.',
        packageRegenerationRequired: false,
        readinessImpact: 'LP132 Gate 2 remains closed; this does not change activation or runtime status.' })
    };
  });
  const certified = counties.filter(item => item.certificationStatus === 'CERTIFIED').length;
  const blocked = counties.length - certified;
  if (counties.length !== 254 || certified !== lp134.current.pass || blocked !== lp134.current.fail) {
    throw new Error('LP135 totals do not reconcile with the observed LP134 authority');
  }
  return {
    schemaVersion: 'gridly-lp135-statewide-certification-v1', milestone: 'LP135', observationDate: '2026-08-04',
    scope: 'CERTIFICATION_EVIDENCE_ONLY', authoritativeManufacturingBaseline: 'LP130', certificationTooling: 'LP134',
    outcome: blocked === 0 ? 'STATEWIDE_CERTIFICATION_ACHIEVED' : 'STATEWIDE_CERTIFICATION_INCOMPLETE',
    summary: { countiesProcessed: counties.length, certified, certificationBlocked: blocked,
      certificationPercentage: Number((certified * 100 / counties.length).toFixed(2)) },
    comparisons: { lp131: { certified: 240, certificationBlocked: 14, changeInCertified: certified - 240 },
      lp134: { certified: lp134.current.pass, certificationBlocked: lp134.current.fail, changeInCertified: certified - lp134.current.pass } },
    regression: {
      packageIdentities: 'UNCHANGED_FROM_LP130_INVENTORY', manufacturingArtifactsModified: false,
      runtimeArtifactsModified: false, deploymentModified: false, protectedSystemsModified: false,
      limitation: 'Eleven immutable package byte streams are unavailable in this checkout; their package and sidecar hashes cannot be re-observed and their prior blocked status is not inferred to PASS.'
    },
    counties
  };
}

export function countyCsv(report) {
  const header = ['County', 'FIPS', 'Certification status', 'Failure stage', 'Primary classification', 'Evidence reference'];
  return [header, ...report.counties.map(item => [item.county, item.fips, item.certificationStatus, item.failureStage, item.primaryClassification, item.evidenceReference])]
    .map(row => row.map(quote).join(',')).join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildStatewideCertification();
  const directory = resolve(ROOT, 'evidence/lp135');
  await mkdir(directory, { recursive: true });
  const outputs = new Map([
    [resolve(directory, 'statewide-certification.json'), JSON.stringify(report, null, 2) + '\n'],
    [resolve(directory, 'county-certification-inventory.csv'), countyCsv(report)]
  ]);
  if (process.argv.includes('--verify')) {
    for (const [path, expected] of outputs) if (await readFile(path, 'utf8') !== expected) throw new Error(`Stale LP135 output: ${path}`);
  } else for (const [path, content] of outputs) await writeFile(path, content);
  console.log(JSON.stringify(report.summary));
}
