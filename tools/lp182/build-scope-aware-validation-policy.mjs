import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CANDIDATE_COMMIT = '6a1489aebd7cb8ad9e730ca87d08247a421747cf';
export const HOSTNAME = 'preview.gridlygo.com';
export const PURPOSE = 'PHYSICAL_DEVICE_VALIDATION';
export const AUDIENCE = 'OWNER_APPROVED_TESTERS';
export const REPORT_DIR = 'reports/lp182';
export const REPORT_NAMES = ['scope-aware-validation-policy.json', 'preview-validation-authorization.json', 'lp182-summary.json'];
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const PROTECTED_FILES = ['index.html', 'js/app.js', 'manifest.json', 'service-worker.js'];
const GLOBAL_STATES = Object.freeze({ deployment: 'NOT_AUTHORIZED', distribution: 'NOT_AUTHORIZED', activation: 'NOT_AUTHORIZED', publicLaunch: 'NOT_AUTHORIZED', restore: 'NOT_AUTHORIZED', rollback: 'NOT_AUTHORIZED' });
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

export function candidateIdentity(root = ROOT) {
  const protectedArtifacts = PROTECTED_FILES.map(file => ({ file, gitBlob: git(root, 'rev-parse', `${CANDIDATE_COMMIT}:${file}`) }));
  return { candidateIdentity: sha256(encode(protectedArtifacts)), protectedArtifacts };
}

export const previewPrerequisites = [
  { id: 'LP167-B005', classification: 'NOT_REQUIRED_BEFORE_SCOPED_PREVIEW', rationale: 'The validation is the evidence-producing activity and cannot be its own prerequisite.' },
  { id: 'LP167-B010-A', classification: 'REQUIRED_BEFORE_NATIVE_DISTRIBUTION', rationale: 'An Android release build is not used by the web/PWA preview.' },
  { id: 'LP167-B010-I', classification: 'REQUIRED_BEFORE_NATIVE_DISTRIBUTION', rationale: 'An iOS release build is not used by the web/PWA preview.' },
  { id: 'LP167-B010-C', classification: 'REQUIRED_BEFORE_NATIVE_DISTRIBUTION', rationale: 'Play/TestFlight testing governs native packages, not the bounded web/PWA preview.' },
  { id: 'LP167-B011-ACCOUNT', classification: 'REQUIRED_BEFORE_NATIVE_DISTRIBUTION', rationale: 'Store accounts are not used by the web/PWA preview.' },
  { id: 'LP167-B011-ASSET', classification: 'REQUIRED_BEFORE_NATIVE_DISTRIBUTION', rationale: 'Store listings are not used by the web/PWA preview.' },
  { id: 'LP167-B012', classification: 'REQUIRED_BEFORE_PUBLIC_LAUNCH', rationale: 'Full public legal readiness remains mandatory for public launch; the access-controlled, owner-approved validation scope is not a public offering.' },
  { id: 'LP167-B013', classification: 'OWNER_APPROVAL_REQUIRED', rationale: 'Explicit scope-specific owner approval is required before any scoped deployment or distribution.' }
];

export function evaluateScope(request, policy = buildPolicy()) {
  if (!request || typeof request !== 'object' || !policy || policy.schemaVersion !== 'gridly.lp182.scopeAwareValidationPolicy.v1') return { status: 'NOT_AUTHORIZED', reason: 'MALFORMED_POLICY_OR_REQUEST' };
  if (request.hostname !== policy.hostname) return { status: 'NOT_AUTHORIZED', reason: 'HOSTNAME_MISMATCH' };
  if (request.purpose !== policy.purpose) return { status: 'NOT_AUTHORIZED', reason: 'PURPOSE_MISMATCH' };
  if (request.audience !== policy.audience) return { status: 'NOT_AUTHORIZED', reason: 'AUDIENCE_MISMATCH' };
  if (request.candidateCommit !== policy.candidateCommit) return { status: 'STALE_CANDIDATE', reason: 'CANDIDATE_COMMIT_MISMATCH' };
  if (request.candidateIdentity !== policy.candidateIdentity) return { status: 'STALE_CANDIDATE', reason: 'PROTECTED_ARTIFACT_MISMATCH' };
  if (!['DEPLOYMENT', 'DISTRIBUTION', 'ROLLBACK'].includes(request.operation)) return { status: 'NOT_AUTHORIZED', reason: 'OPERATION_NOT_ALLOWED' };
  if (request.revoked) return { status: 'REVOKED', reason: 'OWNER_OR_SECURITY_REVOCATION' };
  if (request.expired) return { status: 'EXPIRED', reason: 'VALIDATION_WINDOW_CLOSED' };
  if (!request.accessControlReady) return { status: 'NOT_AUTHORIZED', reason: 'ACCESS_CONTROL_REQUIRED' };
  if (!request.rollbackReady) return { status: 'NOT_AUTHORIZED', reason: 'ROLLBACK_PREREQUISITE_MISSING' };
  if (!request.ownerApprovalEvidence) return { status: 'POLICY_READY_OWNER_APPROVAL_REQUIRED', reason: 'OWNER_APPROVAL_ABSENT' };
  return { status: 'AUTHORIZED', reason: 'EXACT_SCOPE_CONDITIONS_SATISFIED' };
}

export function buildPolicy(root = ROOT) {
  const identity = candidateIdentity(root);
  return {
    schemaVersion: 'gridly.lp182.scopeAwareValidationPolicy.v1', milestone: 'LP182', generatedAt: GENERATED_AT,
    globalAuthorizationModel: 'GLOBAL_OPERATION_AUTHORIZATION_PLUS_SEPARATE_SCOPED_VALIDATION_AUTHORIZATION', globalAuthorizationStates: { ...GLOBAL_STATES },
    scopedAuthorizationSupported: true, scopeType: 'PHYSICAL_DEVICE_VALIDATION_PREVIEW', scopeStatus: 'POLICY_READY_OWNER_APPROVAL_REQUIRED',
    hostname: HOSTNAME, purpose: PURPOSE, audience: AUDIENCE, candidateBranch: 'main', candidateCommit: CANDIDATE_COMMIT,
    candidateIdentity: identity.candidateIdentity, protectedArtifacts: identity.protectedArtifacts,
    deploymentAllowedWithinScope: true, distributionAllowedWithinScope: true, activationAllowedWithinScope: false, publicLaunchAllowedWithinScope: false,
    canonicalProductionPromotionAllowed: false, appStoreDistributionAllowed: false, automaticDeploymentAllowed: false, marketingAllowed: false, betaReopeningAllowed: false,
    accessControlRequirement: { status: 'ACCESS_CONTROL_REQUIRED', requiredClass: 'AUTHENTICATED_ALLOWLIST_OR_EQUIVALENT_OWNER_CONTROLLED_ADMISSION', noindexIsAccessControl: false, obscurityIsAccessControl: false },
    discoverabilityPolicy: { marketingLinksAllowed: false, sitemapPromotionAllowed: false, canonicalPromotionAllowed: false, socialAnnouncementAllowed: false, publicLaunchMessagingAllowed: false, noindex: 'RECOMMENDED_SUPPLEMENT_ONLY' },
    rollbackRequirement: 'REQUIRED_BEFORE_SCOPED_DEPLOYMENT', rollbackMechanism: { deploymentMode: 'MANUAL_ONLY', priorKnownGoodPreviewArtifactMustBeRecorded: true, actions: ['DISABLE_PREVIEW_PUBLICATION', 'REDEPLOY_PRIOR_KNOWN_GOOD_PREVIEW_ARTIFACT'], hostnameBoundary: HOSTNAME, canonicalProductionUntouched: true },
    rollbackAuthorizationWithinScope: 'PREAUTHORIZED_ONLY_TO_UNDO_AUTHORIZED_PREVIEW_DEPLOYMENT', restoreApplicabilityWithinScope: 'NOT_APPLICABLE_WITHIN_PREVIEW_SCOPE',
    expirationConditions: ['ANDROID_AND_IPHONE_OWNER_VALIDATION_EVIDENCE_COMPLETE', 'OWNER_CLOSES_VALIDATION_WINDOW', 'CANDIDATE_IDENTITY_CHANGES', 'PREVIEW_HOSTNAME_CHANGES'],
    revocationConditions: ['SECURITY_DEFECT', 'MATERIAL_RUNTIME_DEFECT', 'OWNER_REVOCATION', 'ROLLBACK_REQUIRED_WITHOUT_AVAILABLE_MECHANISM'],
    staleCandidateConditions: ['CANDIDATE_COMMIT_DIFFERS', 'ANY_PROTECTED_GIT_BLOB_DIFFERS'],
    previewPrerequisites, nativeDistributionPrerequisites: previewPrerequisites.filter(x => x.classification === 'REQUIRED_BEFORE_NATIVE_DISTRIBUTION').map(x => x.id),
    publicLaunchPrerequisites: ['LP167-B005', 'LP167-B010-A', 'LP167-B010-I', 'LP167-B010-C', 'LP167-B011-ACCOUNT', 'LP167-B011-ASSET', 'LP167-B012', 'LP167-B013'],
    ownerApprovalRequired: true, ownerApprovalEvidence: { status: 'ABSENT_FOR_THIS_SPECIFIC_SCOPE', instructionIsPolicyRequestNotExecutionApproval: true },
    platformActionsAfterAuthorization: ['Configure access-controlled hosting and exact custom hostname in a separate execution milestone', 'Record prior known-good preview artifact before manual deployment'],
    repositoryActionsAfterAuthorization: ['Record immutable execution evidence and validation-window state in a separate milestone'],
    performsDnsChange: false, performsHostingConfiguration: false, performsDeployment: false, performsDistribution: false, performsActivation: false, performsPublicLaunch: false, performsRestore: false, performsRollback: false,
    runtimeModified: false, protectedSystemsModified: [], secretSafety: 'PASS', classification: 'SCOPE_POLICY_READY_OWNER_APPROVAL_REQUIRED'
  };
}

export function build(root = ROOT) {
  const policy = buildPolicy(root);
  const authorization = {
    schemaVersion: 'gridly.lp182.previewValidationAuthorization.v1', milestone: 'LP182', generatedAt: GENERATED_AT,
    globalAuthorizationStates: { ...GLOBAL_STATES }, scopeType: policy.scopeType, scopeStatus: policy.scopeStatus,
    hostname: policy.hostname, purpose: policy.purpose, audience: policy.audience, candidateBranch: policy.candidateBranch, candidateCommit: policy.candidateCommit, candidateIdentity: policy.candidateIdentity, protectedArtifacts: policy.protectedArtifacts,
    ownerApprovalRequired: true, ownerApprovalEvidence: policy.ownerApprovalEvidence,
    scopedOperations: { deployment: 'NOT_AUTHORIZED_PENDING_OWNER_APPROVAL_AND_PREREQUISITES', distribution: 'NOT_AUTHORIZED_PENDING_OWNER_APPROVAL_AND_PREREQUISITES', activation: 'NOT_AUTHORIZED', publicLaunch: 'NOT_AUTHORIZED', rollback: 'PREAUTHORIZED_CONDITIONALLY_WITHIN_PREVIEW_SCOPE', restore: 'NOT_APPLICABLE_WITHIN_PREVIEW_SCOPE' },
    prohibitedOperations: { canonicalProductionPromotion: 'NOT_AUTHORIZED', appStoreDistribution: 'NOT_AUTHORIZED', automaticDeployment: 'NOT_AUTHORIZED', marketing: 'NOT_AUTHORIZED', betaReopening: 'NOT_AUTHORIZED' },
    zeroExecution: { dnsChanges: 0, hostingConfigurationChanges: 0, deployments: 0, distributions: 0, activations: 0, publicLaunches: 0, restores: 0, rollbacks: 0 }, classification: policy.classification
  };
  const summary = {
    schemaVersion: 'gridly.lp182.summary.v1', milestone: 'LP182', generatedAt: GENERATED_AT, classification: policy.classification,
    extensionPoint: 'LP167/LP176 global authorization decisions, extended beside rather than inside their immutable historical artifacts', globalAuthorizationStates: { ...GLOBAL_STATES },
    scopedAuthorizationSupported: true, scopeStatus: policy.scopeStatus, hostname: policy.hostname, candidateCommit: policy.candidateCommit, candidateIdentity: policy.candidateIdentity,
    deterministicCanonicalOutput: 'PASS', secretSafety: 'PASS', runtimeModified: false, protectedSystemsModified: [], mergeRecommendation: 'READY_TO_MERGE'
  };
  return { [REPORT_NAMES[0]]: policy, [REPORT_NAMES[1]]: authorization, [REPORT_NAMES[2]]: summary };
}

export function write(output = path.join(ROOT, REPORT_DIR), root = ROOT) { const reports = build(root); fs.mkdirSync(output, { recursive: true }); for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8'); return reports; }
export function verify(root = ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp182-'));
  try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root); write(b, root); for (const name of REPORT_NAMES) { const one = fs.readFileSync(path.join(a, name)); const two = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name)); if (!one.equals(two) || !one.equals(committed)) throw Error(`LP182 deterministic drift: ${name}`); if (one.includes(13) || (one[0] === 0xef && one[1] === 0xbb && one[2] === 0xbf)) throw Error(`LP182 canonical encoding failure: ${name}`); if (/(?:BEGIN [A-Z ]*PRIVATE KEY|service[_ -]?role\s*[:=]|bearer\s+[A-Za-z0-9._-]+|(?:secret|private)[_ -]?key\s*[:=])/i.test(one.toString('utf8'))) throw Error(`LP182 secret-safety failure: ${name}`); } return true; }
  finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { if ((process.argv[2] ?? 'build') === 'verify') { verify(); console.log('LP182 verification PASS'); } else { write(); console.log('LP182 policy reports written; zero execution performed.'); } }
