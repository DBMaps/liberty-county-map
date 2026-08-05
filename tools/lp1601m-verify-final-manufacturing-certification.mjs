#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => resolve(ROOT, p);
const readJson = (p) => JSON.parse(readFileSync(rel(p), 'utf8'));

export function verifyLp1601mFinalManufacturingCertification() {
  const final = readJson('reports/lp1601j/final-jsonl-county-manufacturing-assessment.json');
  const writer = readJson('reports/lp1601l/final-county-writer-reconciliation-report.json');
  const assignment = readJson('reports/lp1601l/final-county-assignment-and-writer-assessment.json');
  const certification = readJson('reports/lp1601m/final-statewide-destination-manufacturing-certification.json');
  const summary = readJson('reports/lp1601m/final-manufacturing-summary.json');
  const runtime = readJson('reports/lp1601m/final-runtime-protection-report.json');
  const staging = readJson('data/lp1601f/staging-manifest.json');
  const manifest = readJson('data/lp1601/texas-destination-candidate-registry-manifest.json');

  const candidateManifestRows = manifest.counties.reduce((total, county) => total + county.recordCount, 0);
  const uniqueCountyFips = new Set(manifest.counties.map((county) => county.countyFips));
  const uniqueCountyNames = new Set(manifest.counties.map((county) => county.countyName));
  const manufacturingStart = Date.parse(final.manufacturingStartTime);
  const manufacturingEnd = Date.parse(final.manufacturingEndTime);
  const computedElapsedMs = manufacturingEnd - manufacturingStart;

  const checks = {
    sourceIdentity: certification.sourceIdentity === staging.sourcePathIdentity,
    sourceSha: final.sourceSha256 === staging.sourceSha256 && certification.sourceSha256 === final.sourceSha256,
    jsonlStagingIdentity: certification.jsonlStagingIdentity === staging.parts[0].filename,
    jsonlStagingSha: certification.jsonlStagingSha256 === staging.parts[0].sha256,
    jsonlStagingRowCount: certification.jsonlStagingRowCount === staging.parts[0].rowCount,
    duckDbVersionRecorded: typeof certification.duckDbVersion === 'string' && certification.duckDbVersion.length > 0,
    elapsedMs: Number.isSafeInteger(computedElapsedMs) && computedElapsedMs > 0 && final.elapsedMs === computedElapsedMs && writer.elapsedMs === computedElapsedMs && summary.elapsedMs === computedElapsedMs && certification.elapsedMs === computedElapsedMs,
    stagingEquation: writer.counts.stagedRows === writer.counts.validCoordinateRows + writer.counts.malformedRows + writer.counts.blankRows,
    texasMembershipEquation: writer.counts.validCoordinateRows === writer.counts.texasConfirmedRows + writer.counts.outsideTexasRows + writer.counts.geometryUnresolvedRows + writer.counts.addressGeometryConflictRows,
    exclusionsEquation: writer.counts.governedExclusions === writer.counts.outsideTexasRows + writer.counts.malformedRows + writer.counts.blankRows + writer.counts.geometryUnresolvedRows + writer.counts.addressGeometryConflictRows,
    countyAssignmentEquation: writer.counts.texasConfirmedRows === writer.counts.countyAssignedRows + writer.counts.unresolvedCountyRows + writer.counts.boundaryAmbiguousRows,
    retainedEquation: writer.counts.retainedDestinations === writer.counts.countyAssignedRows - writer.counts.duplicatesRemoved,
    manifestRows: writer.manifestRows === candidateManifestRows && writer.manifestRows === writer.counts.retainedDestinations,
    candidateRows: writer.actualCandidateFileRows === writer.manifestRows && summary.actualCandidateFileRows === writer.actualCandidateFileRows,
    countiesRepresented: manifest.counties.length === 254 && uniqueCountyFips.size === 254 && uniqueCountyNames.size === 254 && assignment.distinctAssignedCounties === 254,
    candidateFiles: writer.actualCandidateFileCount === 254 && assignment.candidateFilesCreated === 254 && summary.candidateFilesCreated === 254,
    writerLifecycle: writer.writer.writersOpened === 254 && writer.writer.writersCompleted === 254 && writer.writer.writersFailed === 0 && writer.writer.filesPromoted === 254,
    writerCollisions: writer.writer.pathCollisions === 0,
    noUnresolvedCountyFailures: writer.counts.unresolvedCountyRows === 0 && writer.counts.boundaryAmbiguousRows === 0,
    protectedRuntime: runtime.performsRuntimeChange === false && runtime.protectedArtifactsModified === false && runtime.protectedRuntime === 'UNCHANGED',
    protectedDeployment: runtime.performsDeploymentChange === false && runtime.deployment === 'UNAUTHORIZED',
    protectedActivation: runtime.performsActivationChange === false && runtime.activation === 'UNAUTHORIZED',
    finalClassification: final.finalClassification === 'MANUFACTURING_COMPLETE' && assignment.finalClassification === 'MANUFACTURING_COMPLETE' && certification.finalClassification === 'MANUFACTURING_COMPLETE' && summary.finalClassification === 'MANUFACTURING_COMPLETE'
  };

  const passed = Object.values(checks).every(Boolean);
  return {
    status: passed ? 'PASS' : 'FAIL',
    finalClassification: passed ? 'MANUFACTURING_COMPLETE' : 'MANUFACTURING_FAILED',
    computedElapsedMs,
    candidateManifestRows,
    representedCountyCount: uniqueCountyFips.size,
    checks
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyLp1601mFinalManufacturingCertification();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
