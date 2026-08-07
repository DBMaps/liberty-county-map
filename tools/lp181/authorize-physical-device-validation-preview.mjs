import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CANDIDATE_COMMIT = '05f9edb4720dbc5474547a233ee1b850e76ac5c9';
export const REPORT_DIR = 'reports/lp181';
export const REPORT_NAMES = ['physical-device-validation-deployment-authorization.json', 'lp181-summary.json'];
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: args[0] === 'show' ? null : 'utf8', maxBuffer: 32 * 1024 * 1024 });

export function candidateIdentity(root = ROOT) {
  const files = ['index.html', 'js/app.js', 'manifest.json', 'service-worker.js'];
  const artifacts = files.map(file => ({ file, sha256: hash(git(root, 'show', `${CANDIDATE_COMMIT}:${file}`)) }));
  return { type: 'CANONICAL_GIT_BLOB_SET', commit: CANDIDATE_COMMIT, artifacts };
}

const blockers = [
  ['LP167-B005', 'physical-device validation', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'The global Distribution gate requires the evidence that the proposed distribution is intended to collect.'],
  ['LP167-B010-A', 'Android release build', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'LP167/LP176 does not distinguish web validation distribution from native distribution.'],
  ['LP167-B010-I', 'iOS release build', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'LP167/LP176 does not distinguish web validation distribution from native distribution.'],
  ['LP167-B010-C', 'Play/TestFlight closed testing', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'LP167/LP176 applies the closed-testing gate to Distribution globally.'],
  ['LP167-B011-ACCOUNT', 'store accounts', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'The existing Distribution decision has no owner/tester or web-only scope.'],
  ['LP167-B011-ASSET', 'store assets/listing readiness', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'The existing Distribution decision has no owner/tester or web-only scope.'],
  ['LP167-B012', 'legal approval', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'LP167 places legal/business approval in Distribution review without a private-validation exception.'],
  ['LP167-B013', 'final owner approval', 'REQUIRED_BEFORE_PREVIEW_VALIDATION', 'Explicit owner approval is mandatory for authorization under LP167.']
].map(([id, blocker, classification, rationale]) => ({ id, blocker, classification, rationale, alsoRequiredBeforePublicLaunch: true }));

export function build(root = ROOT, prerequisites = blockers) {
  const required = prerequisites.filter(item => item.classification === 'REQUIRED_BEFORE_PREVIEW_VALIDATION');
  const exactPrerequisitesPresent = required.length === 8 && blockers.every(expected => required.some(item => item.id === expected.id));
  const scopeSupported = false;
  const authorized = scopeSupported && exactPrerequisitesPresent;
  const identity = candidateIdentity(root);
  const authorizationScope = {
    requestedScope: { hostname: 'preview.gridlygo.com', purpose: 'physical-device validation', audience: 'owner-approved real-device testers', artifact: identity, duration: 'bounded' },
    governanceModel: 'GLOBAL_OPERATION_STATES_ONLY',
    scopeAwareAuthorizationSupported: false,
    privateTestingDistinguishedFromPublicDistribution: false,
    blocker: 'LP167 and its LP176 reassessment authorize operations globally and define no governed environment, hostname, audience, or private-testing scope. LP181 cannot invent a scoped authorization object that changes those decisions.'
  };
  const notAuthorized = 'NOT_AUTHORIZED';
  const report = {
    schemaVersion: 'gridly.lp181.physicalDeviceValidationDeploymentAuthorization.v1', milestone: 'LP181', generatedAt: GENERATED_AT,
    candidateCommit: CANDIDATE_COMMIT, candidateProtectedIdentity: identity, candidateBranch: 'main', sourceOfTruth: 'main at LP181 audit start; arbitrary future HEAD is not authorized',
    validationHostname: 'preview.gridlygo.com', canonicalProductionHostname: 'gridlygo.com', purpose: 'physical-device validation only', audience: 'owner-approved real-device testers', authorizationScope,
    deploymentAuthorization: authorized ? 'AUTHORIZED' : notAuthorized, distributionAuthorization: authorized ? 'AUTHORIZED' : notAuthorized,
    activationAuthorization: notAuthorized, publicLaunchAuthorization: notAuthorized, canonicalProductionPromotionAuthorization: notAuthorized, appStoreDistributionAuthorization: notAuthorized,
    restoreAuthorization: notAuthorized, rollbackAuthorization: notAuthorized,
    interpretation: { deployment: true, distribution: true, activation: false, publicLaunch: false, internetReachableUnannouncedUrlIsDistribution: true, obscurityPermittedAsAccessLimitation: false, accessControl: 'UNKNOWN', accessControlRationale: 'Existing governance says noindex/obscurity is not access control but defines neither a private-preview control nor an exception produced by one.' },
    authorizationConditions: [
      'No authorization is granted until existing governance is amended by an owner-approved milestone to support a validation-only scope or all global Deployment and Distribution gates are satisfied.',
      'Any future authorization must bind preview.gridlygo.com, the exact candidate identity, physical-device validation, owner-approved testers, and a bounded window.',
      'gridlygo.com, the old beta, marketing/public announcement, automatic deployment, canonical promotion, and app stores remain unauthorized.',
      'A defined, owner-approved rollback method and separately granted incident-specific rollback authority are required before execution.',
      'No private keys, signing material, service-role credentials, or owner secrets may be served or committed.'
    ],
    expirationCondition: 'No validation authority exists. A future bounded authority should close when both Android and iPhone evidence are complete or the owner explicitly closes the validation window, whichever occurs first.',
    remainingBlockers: prerequisites, previewRequiredBlockers: required.map(item => item.id), publicLaunchOnlyBlockers: [],
    blockerClassificationCaveat: 'All eight remain preview prerequisites only because the governed Distribution state is global. LP181 does not claim they are intrinsically necessary for web testing.',
    legalApprovalRequiredBeforePreviewValidation: true,
    rollbackAssessment: { requiredBeforeDeployment: true, sufficientMechanismExists: false, status: 'NOT_CONFIGURED_AND_NOT_AUTHORIZED', evidence: 'LP180 records no configured web rollback. LP170/LP176 require identity, ownership, validation/rehearsal and incident-specific authority; a conceptual prior-artifact redeploy is not sufficient governed execution evidence.' },
    operationalOwnership: { monitoringOwner: 'GOVERNED_IN_EXISTING_OWNER_EVIDENCE', incidentOwner: 'GOVERNED_IN_EXISTING_OWNER_EVIDENCE', supportOwner: 'GOVERNED_IN_EXISTING_OWNER_EVIDENCE', source: 'evidence/lp173/owner-evidence.autodiscovered.json', namesRepeated: false },
    ownerActionsRequired: ['Approve any governance change or satisfy all global gates', 'Select/configure the host only after authorization', 'Provide exact platform/DNS evidence', 'Grant final release approval', 'Close any future validation window'],
    platformActionsRequired: ['After authorization only: configure hosting/custom-domain binding, DNS verification, HTTPS certificate, and manual publication'],
    repositoryActionsRequired: ['Create an owner-approved scope-aware authorization policy before reassessment, unless all global gates will be satisfied', 'Define and govern a manual preview deployment and rollback procedure before execution'],
    performsDeployment: false, performsDnsChange: false, performsActivation: false, performsDistribution: false, performsPublicLaunch: false, performsRestore: false, performsRollback: false,
    protectedSystemsModified: [], runtimeModified: false, physicalDeviceValidationPerformed: false,
    secretSafety: 'PASS', deterministicCanonicalOutput: 'PASS', classification: authorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED'
  };
  const summary = {
    schemaVersion: 'gridly.lp181.summary.v1', milestone: 'LP181', generatedAt: GENERATED_AT, classification: report.classification,
    governanceModel: authorizationScope.governanceModel, scopeAwareAuthorizationSupported: false, candidateCommit: CANDIDATE_COMMIT, validationHostname: report.validationHostname,
    authorizations: { deployment: report.deploymentAuthorization, distribution: report.distributionAuthorization, activation: report.activationAuthorization, publicLaunch: report.publicLaunchAuthorization, canonicalProductionPromotion: report.canonicalProductionPromotionAuthorization, appStoreDistribution: report.appStoreDistributionAuthorization, restore: report.restoreAuthorization, rollback: report.rollbackAuthorization },
    operationsPerformed: { dnsChanges: 0, hostingConfigurationChanges: 0, deployments: 0, activations: 0, distributions: 0, publicLaunches: 0, restores: 0, rollbacks: 0 },
    runtimeModified: false, protectedSystemsModified: [], deterministicCanonicalOutput: 'PASS', secretSafety: 'PASS', mergeRecommendation: 'READY_TO_MERGE'
  };
  return { [REPORT_NAMES[0]]: report, [REPORT_NAMES[1]]: summary };
}

export function write(output = path.join(ROOT, REPORT_DIR), root = ROOT) { const reports = build(root); fs.mkdirSync(output, { recursive: true }); for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8'); return reports; }
export function verify(root = ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp181-'));
  try {
    const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root); write(b, root);
    for (const name of REPORT_NAMES) {
      const first = fs.readFileSync(path.join(a, name)); const second = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name)); const text = first.toString('utf8');
      if (!first.equals(second) || !first.equals(committed)) throw Error(`LP181 deterministic drift: ${name}`);
      if (first.includes(13) || (first[0] === 0xef && first[1] === 0xbb && first[2] === 0xbf)) throw Error(`LP181 canonical encoding failure: ${name}`);
      if (/(?:BEGIN [A-Z ]*PRIVATE KEY|service[_ -]?role\s*[:=]|bearer\s+[A-Za-z0-9._-]+|(?:secret|private)[_ -]?key\s*[:=])/i.test(text)) throw Error(`LP181 secret-safety failure: ${name}`);
    }
    return true;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if ((process.argv[2] ?? 'build') === 'verify') { verify(); console.log('LP181 verification PASS'); }
  else { write(); console.log('LP181 reports written; no deployment, DNS, activation, distribution, launch, restore, or rollback performed.'); }
}
