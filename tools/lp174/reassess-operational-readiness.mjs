import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, ROOT } from '../lp172/collect-owner-operational-evidence.mjs';
import { SECRET_PATTERN } from '../lp173/complete-operational-evidence.mjs';

export const REPORT_DIR = 'reports/lp174';
export const REPORT_NAMES = [
  'operational-evidence-summary.json',
  'authorization-reassessment-report.json',
  'deterministic-validation-report.json'
];

const AUTHORIZATIONS = {
  activation: 'NOT_AUTHORIZED',
  deployment: 'NOT_AUTHORIZED',
  distribution: 'NOT_AUTHORIZED',
  productionRestore: 'NOT_AUTHORIZED',
  productionRollback: 'NOT_AUTHORIZED',
  publicLaunch: 'NOT_AUTHORIZED'
};
const OPERATIONS_PERFORMED = {
  activations: 0,
  deployments: 0,
  distributions: 0,
  productionRestores: 0,
  productionRollbacks: 0,
  publicLaunches: 0,
  runtimeModifications: 0
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function readJson(root, relativePath) {
  const bytes = fs.readFileSync(path.join(root, relativePath));
  if (bytes[0] === 0xef || bytes.includes(13)) throw Error(`LP174 non-canonical input: ${relativePath}`);
  const text = bytes.toString('utf8');
  if (Buffer.from(text, 'utf8').compare(bytes) !== 0 || SECRET_PATTERN.test(text)) throw Error(`LP174 unsafe input: ${relativePath}`);
  return JSON.parse(text);
}

export function build(root = ROOT) {
  const lp173 = readJson(root, 'reports/lp173/lp173-summary.json');
  const discovery = readJson(root, 'reports/lp1731/auto-discovery-summary.json');
  const blockers = [
    ...lp173.sourceUnavailableFacts.map(fact => ({ classification: 'SOURCE_UNAVAILABLE', fact })),
    ...lp173.ownerActionRequiredFacts.map(fact => ({ classification: 'OWNER_ACTION_REQUIRED', fact }))
  ];
  const evidenceComplete = lp173.evidenceClassification === 'EVIDENCE_COMPLETE' && blockers.length === 0;
  const protectedPass = lp173.validation.protectedGitBlobIdentities === 'PASS';
  const ready = evidenceComplete && protectedPass;
  const validationPass = ['canonicalLf', 'deterministicTwoGeneration', 'protectedGitBlobIdentities', 'secretSafety', 'utf8WithoutBom']
    .every(name => lp173.validation[name] === 'PASS');

  const operationalSummary = {
    schemaVersion: 'gridly.lp174.operationalEvidenceSummary.v1',
    milestone: 'LP174',
    boundary: 'METADATA_ONLY_NON_AUTHORIZING_OPERATIONAL_REASSESSMENT',
    classification: evidenceComplete ? 'EVIDENCE_COMPLETE' : 'EVIDENCE_INCOMPLETE',
    machineVerifiedFacts: lp173.machineVerifiedFacts,
    ownerAttestedFacts: lp173.ownerAttestedFacts,
    blockers,
    blockerCounts: {
      ownerActionRequired: lp173.ownerActionRequiredFacts.length,
      sourceUnavailable: lp173.sourceUnavailableFacts.length,
      total: blockers.length
    },
    discoveryClassification: discovery.classification,
    metadataOnly: true
  };
  const reassessment = {
    schemaVersion: 'gridly.lp174.authorizationReassessment.v1',
    milestone: 'LP174',
    authorizationReassessment: ready ? 'READY_FOR_AUTHORIZATION_REASSESSMENT' : 'NOT_READY_FOR_AUTHORIZATION_REASSESSMENT',
    rationale: ready
      ? 'All governed operational evidence is complete and protected Git-blob identities pass.'
      : 'Governed operational evidence remains incomplete; readiness cannot be inferred.',
    authorizationGranted: false,
    authorizationUnchanged: true,
    authorizations: AUTHORIZATIONS,
    operationsPerformed: OPERATIONS_PERFORMED
  };
  const validation = {
    schemaVersion: 'gridly.lp174.deterministicValidation.v1',
    milestone: 'LP174',
    classification: validationPass ? 'PASS' : 'FAIL',
    checks: {
      canonicalLf: lp173.validation.canonicalLf,
      deterministicTwoGeneration: lp173.validation.deterministicTwoGeneration,
      metadataOnlyEvidence: operationalSummary.metadataOnly ? 'PASS' : 'FAIL',
      protectedGitBlobIdentities: lp173.validation.protectedGitBlobIdentities,
      protectedIdentitySource: lp173.validation.protectedIdentityProvenance.identitySource,
      secretSafety: lp173.validation.secretSafety,
      utf8WithoutBom: lp173.validation.utf8WithoutBom,
      workingTreeIgnored: lp173.validation.protectedIdentityProvenance.workingTreeIgnored ? 'PASS' : 'FAIL'
    },
    protectedArtifactCount: lp173.protectedArtifacts.length,
    protectedArtifacts: lp173.protectedArtifacts,
    protectedIdentityProvenance: lp173.validation.protectedIdentityProvenance,
    failClosedAuthorization: !ready && reassessment.authorizationGranted === false ? 'PASS' : 'NOT_APPLICABLE'
  };
  return Object.fromEntries(REPORT_NAMES.map((name, index) => [name, [operationalSummary, reassessment, validation][index]]));
}

export function write(root = ROOT, output = path.join(root, REPORT_DIR)) {
  const reports = build(root);
  fs.mkdirSync(output, { recursive: true });
  for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8');
  return reports;
}

export function verify(root = ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp174-'));
  try {
    const first = path.join(temp, 'first');
    const second = path.join(temp, 'second');
    write(root, first);
    write(root, second);
    for (const name of REPORT_NAMES) {
      const expected = fs.readFileSync(path.join(first, name));
      const regenerated = fs.readFileSync(path.join(second, name));
      const committed = fs.readFileSync(path.join(root, REPORT_DIR, name));
      if (!expected.equals(regenerated) || !expected.equals(committed) || expected[0] === 0xef || expected.includes(13) || SECRET_PATTERN.test(expected.toString('utf8'))) {
        throw Error(`LP174 verification failed: ${name}; expected sha256 ${hash(expected)}; actual sha256 ${hash(committed)}`);
      }
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'build';
  if (mode === 'verify') {
    verify();
    console.log('LP174 deterministic, canonical, secret-safe reassessment verification: PASS');
  } else {
    const reports = write();
    console.log(`LP174 authorization reassessment: ${reports[REPORT_NAMES[1]].authorizationReassessment}`);
  }
}
