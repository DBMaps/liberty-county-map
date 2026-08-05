#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { P as LP160, verify as verifyLp160 } from './lp160-build-statewide-destination-integration.mjs';
import { P as LP161, verify as verifyLp161 } from './lp161-certify-statewide-destination-integration.mjs';
import { verifyLp1601mFinalManufacturingCertification } from './lp1601m-verify-final-manufacturing-certification.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = '1970-01-01T00:00:00.000Z';
const REPORT = 'reports/lp1611/deterministic-certification-reconciliation.json';
const abs = (path) => resolve(ROOT, path);
const sha = (path) => existsSync(abs(path)) ? createHash('sha256').update(readFileSync(abs(path))).digest('hex') : null;
function stable(value) { return Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.keys(value).sort().reduce((out, key) => (out[key] = stable(value[key]), out), {}) : value; }
export function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }

export function buildReconciliationReport() {
  const before = Object.fromEntries([...Object.values(LP160), ...Object.values(LP161)].map((path) => [path, sha(path)]));
  const lp161Summary = verifyLp161();
  const lp160Final = verifyLp160();
  const lp1601m = verifyLp1601mFinalManufacturingCertification();
  const after = Object.fromEntries(Object.keys(before).map((path) => [path, sha(path)]));
  const protectedArtifactsModified = Object.keys(before).filter((path) => before[path] !== after[path]);
  const driftChecks = {
    lp161DestinationIntegrationReportDeterministic: before[LP161.integration] === after[LP161.integration],
    lp160DestinationSourceManifestDeterministic: before[LP160.manifest] === after[LP160.manifest],
    lp1601mFinalManufacturingCertificationPasses: lp1601m.status === 'PASS',
    noDestinationManufacturingRebuildPerformed: protectedArtifactsModified.length === 0,
    noRuntimeChangePerformed: lp161Summary.runtime === 'UNCHANGED' && lp160Final.integrationReadyCriteriaSatisfied === false
  };
  const status = Object.values(driftChecks).every(Boolean) ? 'PASS' : 'FAIL';
  return {
    schemaVersion: 'gridly.lp1611.deterministicCertificationReconciliation.v1',
    milestone: 'LP161.1',
    generatedAt: GEN,
    status,
    finalClassification: status === 'PASS' ? 'DETERMINISTIC_CERTIFICATION_RECONCILED' : 'DETERMINISTIC_CERTIFICATION_DRIFT',
    mission: 'Know Before You Go',
    productPhilosophy: ['Awareness Platform First', 'Route Intelligence Second'],
    engineeringPhilosophy: ['Audit First', 'Patch Second'],
    scope: 'Read-only deterministic certification reconciliation; no governed Overture source, staging JSONL, county destination manufacturing outputs, runtime, deployment, or activation changes.',
    lp161: {
      finalClassification: lp161Summary.finalClassification,
      destinationIntegrationReport: LP161.integration,
      destinationIntegrationReportSha256: after[LP161.integration]
    },
    lp160: {
      finalClassification: lp160Final.classification,
      destinationSourceManifest: LP160.manifest,
      destinationSourceManifestSha256: after[LP160.manifest]
    },
    lp1601m: {
      status: lp1601m.status,
      finalClassification: lp1601m.finalClassification,
      manufacturingComplete: lp1601m.finalClassification === 'MANUFACTURING_COMPLETE'
    },
    driftChecks,
    protectedArtifactsModified
  };
}

export function writeReconciliationReport() {
  const report = buildReconciliationReport();
  mkdirSync(dirname(abs(REPORT)), { recursive: true });
  writeFileSync(abs(REPORT), json(report));
  return report;
}

export function verifyReconciliationReport() {
  const report = buildReconciliationReport();
  if (!existsSync(abs(REPORT))) throw new Error(`[LP161.1] missing ${REPORT}`);
  if (readFileSync(abs(REPORT), 'utf8') !== json(report)) throw new Error(`[LP161.1] ${REPORT} differs from deterministic reconciliation output`);
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const report = process.argv.includes('--write') ? writeReconciliationReport() : verifyReconciliationReport();
    console.log(json(report));
    if (report.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
