import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identities, ROOT } from '../lp178/close-launch-execution-readiness.mjs';
import { SECRET_PATTERN } from '../lp173/complete-operational-evidence.mjs';

export const REPORT_DIR = 'reports/lp179';
export const REPORT_NAMES = ['owner-live-validation-evidence.json', 'launch-readiness-reassessment.json', 'lp179-summary.json'];
const encode = value => `${JSON.stringify(value, null, 2)}\n`;

const closed = [
  ['LP167-B002', 'Talco routing'],
  ['LP167-B003-Q', 'Quiet awareness'],
  ['LP167-B003-A', 'Active awareness'],
  ['LP167-B003-C', 'Cleared awareness']
].map(([id, name]) => ({
  id,
  name,
  finalStatus: 'PASS',
  basis: 'OWNER_LIVE_VALIDATION',
  history: ['OPEN', 'OWNER_LIVE_VALIDATED', 'PASS']
}));

const remainingBlockers = [
  { id: 'LP167-B005', classification: 'OWNER_AND_PLATFORM_ACTION_REQUIRED', requirement: 'Physical-device validation on one real Android and one real iPhone, including model, OS, screenshots, timestamps and tester attestation; simulators do not qualify.' },
  { id: 'LP167-B010-A', classification: 'BLOCKED_BY_ENVIRONMENT', requirement: 'Governed Android SDK, signing material and signed release build evidence.' },
  { id: 'LP167-B010-I', classification: 'BLOCKED_BY_ENVIRONMENT', requirement: 'Governed macOS, Xcode, Apple signing and signed release build evidence.' },
  { id: 'LP167-B010-C', classification: 'PLATFORM_ACTION_REQUIRED', requirement: 'Google Play Closed Test and TestFlight evidence.' },
  { id: 'LP167-B011-ACCOUNT', classification: 'OWNER_ACTION_REQUIRED', requirement: 'Store account ownership and readiness evidence.' },
  { id: 'LP167-B011-ASSET', classification: 'OWNER_ACTION_REQUIRED', requirement: 'Store screenshots/assets, metadata, icons, listing readiness and applicable subscription configuration.' },
  { id: 'LP167-B012', classification: 'OWNER_ACTION_REQUIRED', requirement: 'Dated legal approval for privacy, terms, reporting disclaimer, data use, support, applicable subscription/refund terms, and entity/account ownership.' },
  { id: 'LP167-B013', classification: 'OWNER_ACTION_REQUIRED', requirement: 'Final owner approval covering launch window, monitoring/support/rollback/incident owners, release notes, known limitations and launch-day validation.' }
];

export function build(root = ROOT) {
  const ownerEvidence = {
    schemaVersion: 'gridly.lp179.ownerLiveValidationEvidence.v1',
    milestone: 'LP179',
    evidenceCapturedAtUtc: '2026-08-07T17:36:45.157Z',
    currentLocation: { latitude: 30.13067525, longitude: -94.93132075, accuracy: 381 },
    locationEvidenceBoundary: 'SUPPORTING_OWNER_SESSION_EVIDENCE_ONLY; geographic precision is limited to the recorded browser accuracy.',
    validation: { talcoRouting: 'PASS', quietAwareness: 'PASS', activeAwareness: 'PASS', clearedAwareness: 'PASS' },
    liveProof: {
      routeWatchProgressionVerified: true, currentLocationRoutingVerified: true, routeRelevantHazardFilteringVerified: true,
      livePositionPropagationVerified: true, selectiveHazardClearVerified: true, clearedHazardPersistenceVerified: true,
      communitySourceTruthVerified: true, officialSourceTruthVerified: true, weatherSourceTruthVerified: true
    },
    authorizationChanged: false,
    historicalLimitation: 'The abbreviated Talco address did not resolve reliably; the exact successful form was 400 West Broad Street, Talco, TX 75487.',
    hazardExpirationBoundary: 'The remaining flooding hazard later appeared inactive; exact expiration timing is not inferred.',
    screenshotEvidence: {
      classification: 'OWNER_CAPTURED / EXTERNAL_OWNER_EVIDENCE',
      gitIdentityClaimed: false,
      repositoryPaths: [],
      captures: ['Current Location to Talco route', 'Quiet Destination Intelligence', 'Active route condition', 'Expanded active evidence', 'Cleared/selective remaining condition state', 'Final flooding-only consumer truth', 'Final return to quiet after the remaining condition was no longer active']
    },
    requirements: closed
  };
  const authorizations = Object.fromEntries(['deployment', 'activation', 'distribution', 'publicLaunch', 'restore', 'rollback'].map(key => [key, 'NOT_AUTHORIZED']));
  const protectedIdentity = identities(root);
  const reassessment = {
    schemaVersion: 'gridly.lp179.launchReadinessReassessment.v1', milestone: 'LP179',
    closedRequirements: closed.map(item => item.id), remainingBlockers, authorizations,
    authorizationGranted: false, authorizationChanged: false,
    rationale: 'Owner live-awareness evidence is closed, but physical-device, build, closed-testing, store, legal and final-owner prerequisites remain open.',
    operationsPerformed: { deployments: 0, activations: 0, distributions: 0, publicLaunches: 0, restores: 0, rollbacks: 0, runtimeModifications: 0 }
  };
  const summary = {
    schemaVersion: 'gridly.lp179.summary.v1', milestone: 'LP179', classification: 'PASS',
    evidenceClosure: 'PASS', authorizationReassessment: 'FAIL_CLOSED_NOT_AUTHORIZED', remainingBlockerCount: remainingBlockers.length,
    protectedIdentity: protectedIdentity.classification, protectedIdentitySource: 'LP178_CANONICAL_GIT_BLOBS',
    runtimeFilesChanged: false, canonicalLf: 'PASS', utf8WithoutBom: 'PASS', deterministicTwoGeneration: 'PASS', secretSafety: 'PASS'
  };
  return Object.fromEntries(REPORT_NAMES.map((name, i) => [name, [ownerEvidence, reassessment, summary][i]]));
}

export function write(root = ROOT, output = path.join(root, REPORT_DIR)) {
  const reports = build(root); fs.mkdirSync(output, { recursive: true });
  for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8');
  return reports;
}

export function verify(root = ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp179-'));
  try {
    const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(root, a); write(root, b);
    for (const name of REPORT_NAMES) {
      const first = fs.readFileSync(path.join(a, name)); const second = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name));
      if (!first.equals(second) || !first.equals(committed) || first.includes(13) || first[0] === 0xef || SECRET_PATTERN.test(first.toString('utf8'))) throw Error(`LP179 deterministic/canonical/secret-safe verification failed: ${name}`);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if ((process.argv[2] || 'build') === 'verify') { verify(); console.log('LP179 verification PASS'); }
  else { write(); console.log('LP179 evidence closure written; authorization remains NOT_AUTHORIZED; no operation performed.'); }
}
