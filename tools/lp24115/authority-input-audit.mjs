import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reportPath = path.join(root, 'reports/lp24115/lp24115-authority-input-audit.json');
const authorityReleaseId = 'lp24111-d5-standalone-2026-08-28';
const runtimeSchemaVersion = 'gridly.poi.runtime.v1';
const expectedGovernedRecordCount = 391772;
const sourceInventorySha256 = 'a9d7a77b964af35fcb21ad3cd061ceb1e1a33ae4dc5091a25a119bada92cec13';

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const evidence = (relativePath, format, recordCount, role) => {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  return { path: relativePath, format, bytes: bytes.length, sha256: sha256(bytes), recordCount, role };
};

export function buildAudit() {
  const releaseManifest = readJson('poi/lp24111-d5-standalone-2026-08-28/manifest.json');
  const d4 = readJson('data/lp24111/phase-d4-certified-measurements.json');
  const compact = readJson('reports/lp24111/compact-package-measurements.json');
  const shardContract = readJson('reports/lp24112/lp24112-shard-resolution-contract.json');
  const expectedInputs = [
    'owner-local/lp24111/overture-texas-rich-authority-dedup.parquet',
    'owner-local/lp24111/overture-texas-normalized-poi.parquet'
  ].map((relativePath) => ({ path: relativePath, available: fs.existsSync(path.join(root, relativePath)) }));
  const exactAuthorityPath = 'owner-local/lp24111/identity-governed-eligible.parquet';
  const exactAuthorityArtifact = { path: exactAuthorityPath, available: fs.existsSync(path.join(root, exactAuthorityPath)) };
  const exactAuthorityAvailable = exactAuthorityArtifact.available;

  return {
    schemaVersion: 'gridly.lp24115.authority-input-audit.v1',
    milestone: 'LP241.15',
    auditScope: 'LOCAL_CHECKOUT_ONLY_NO_REMOTE_FETCH',
    authorityReleaseId,
    runtimeSchemaVersion,
    expectedGovernedRecordCount,
    sourceInventorySha256,
    exactFrozenAuthorityArtifacts: [exactAuthorityArtifact],
    otherOwnerLocalIntermediateArtifacts: expectedInputs,
    availableCertifiedEvidence: [
      evidence('poi/lp24111-d5-standalone-2026-08-28/manifest.json', 'JSON release/legal manifest', releaseManifest.licenseExposure.total, 'METADATA_ONLY_NOT_POI_ROWS'),
      evidence('data/lp24111/phase-d4-certified-measurements.json', 'JSON bounded aggregate measurements', d4.input.rows, 'AGGREGATE_EVIDENCE_ONLY_NOT_POI_ROWS'),
      evidence('reports/lp24111/compact-package-measurements.json', 'JSON shard aggregate measurements', compact.statistics.totalEligibleRows, 'AGGREGATE_EVIDENCE_ONLY_NOT_POI_ROWS')
    ],
    authorityBindingsObserved: {
      releaseManifestAuthorityReleaseId: releaseManifest.authorityReleaseId,
      releaseManifestRuntimeSchemaVersion: releaseManifest.runtimeSchemaVersion,
      releaseManifestSourceInventorySha256: releaseManifest.reviewedSourceInventoryHash,
      d4OwnerLocalInputPath: d4.input.path,
      d4OwnerLocalInputRows: d4.input.rows,
      d4OwnerLocalInputSha256: d4.input.sha256
    },
    reconstructionAssessment: {
      exactFrozenAuthorityAvailable: exactAuthorityAvailable,
      allGovernedRuntimePoisAvailable: false,
      reconstructableWithoutUpstreamFetch: false,
      reconstructableWithoutRenormalization: false,
      reason: 'Certified manifests and aggregate measurements are present, but no row-bearing frozen 391772-record authority artifact is present.'
    },
    existingRuntimeDesign: {
      source: 'reports/lp24112/lp24112-shard-resolution-contract.json',
      architecture: shardContract.architecture,
      formula: shardContract.formula,
      allowedRadiiMiles: shardContract.allowedRadiiMiles,
      maximumFanout: shardContract.maximumFanout,
      wholeTexas: shardContract.wholeTexas,
      measuredHistoricalShardCount: compact.statistics.shardCount,
      note: 'The 86-shard measurement describes a 393038-row pre-D.4 eligible population and is not a materialized manifest for the frozen 391772-row authority.'
    },
    materialization: {
      executed: false,
      runtimeDirectoryCreated: false,
      shardCount: 0,
      materializedGovernedRecordCount: 0,
      determinismCertificationExecuted: false,
      negativeCaseSuiteExecuted: false
    },
    historicalLp24114EvidencePreserved: true,
    blockedState: 'RUNTIME_SHARD_MATERIALIZATION_BLOCKED_FROZEN_AUTHORITY_NOT_AVAILABLE',
    certificationState: 'FAIL_CLOSED',
    readyForLp24114Rehearsal: false,
    productionSafety: {
      deployed: false,
      productionSupabaseMutation: false,
      productionProviderEligible: false,
      providerGate: 'OFF',
      runtimeActive: false,
      runtimeActivated: false,
      productionPoiSearch: 'NOT_LAUNCHED_NOT_CERTIFIED',
      productionBehaviorChanged: false,
      remoteUpstreamPoiFetch: false,
      osmPoiMerge: false,
      authorityNormalizationRerun: false,
      d4Rerun: false,
      d3Rerun: false,
      d2Rerun: false
    },
    ownerNextAction: 'Restore the exact owner-local identity-governed-eligible.parquet whose certified SHA-256 is 6c63fc555ea4a887162541cb1a4587f9d3edb52fb70cb3e81982598b9a82f85c and row count is 391772 at owner-local/lp24111/identity-governed-eligible.parquet, then rerun npm run audit:lp24115. Do not refetch or rebuild authority data.'
  };
}

const stable = (value) => `${JSON.stringify(value, null, 2)}\n`;
export function writeAudit() {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stable(buildAudit()));
}
export function verifyAudit() {
  if (!fs.existsSync(reportPath) || fs.readFileSync(reportPath, 'utf8') !== stable(buildAudit())) {
    throw new Error('LP241.15 authority input audit is missing or stale');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write')) writeAudit();
  else if (process.argv.includes('--verify')) verifyAudit();
  else throw new Error('Use --write or --verify');
  console.log('RUNTIME_SHARD_MATERIALIZATION_BLOCKED_FROZEN_AUTHORITY_NOT_AVAILABLE');
}
