import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE_COMMIT = '3b41cd7e3fe3163c9d67054e1efeddd6d82f7c26';
export const REPORT_DIR = 'reports/lp176';
export const REPORT_NAMES = ['authorization-decision-report.json', 'lp176-summary.json', 'protected-artifact-identities.json'];
const OPERATIONS = ['deployment', 'activation', 'distribution', 'publicLaunch', 'productionRestore', 'productionRollback'];
const PROTECTED = [
  'js/app.js',
  ...['activation-authorization-decision.json', 'app-distribution-authorization-decision.json', 'blocker-register.json', 'deployment-authorization-decision.json', 'launch-readiness-assessment.json', 'lp167-summary.json', 'prerequisite-reconciliation.json', 'production-readiness-checklist.json', 'protected-artifact-hashes.json', 'public-launch-authorization-decision.json'].map(name => `reports/lp167/${name}`),
  ...['launch-authorization-readiness-report.json', 'lp173-summary.json', 'operational-evidence-completion-report.json'].map(name => `reports/lp173/${name}`),
  ...['authorization-reassessment-report.json', 'deterministic-validation-report.json', 'operational-evidence-summary.json'].map(name => `reports/lp174/${name}`),
  'evidence/lp173/owner-evidence.autodiscovered.json'
];
const resolved = new Map([
  ['LP167-B004', ['SATISFIED_ACCEPTED_LIMITATION', 'reports/lp165/lp165-summary.json', 'Existing LP167 policy expressly permits launch with claims limited to in-app notifications.']],
  ['LP167-B006', ['SATISFIED', 'reports/lp169/certification-summary.json; reports/lp174/operational-evidence-summary.json', 'Production configuration evidence and the completed operational baseline satisfy this grouped gate.']],
  ['LP167-B007', ['SATISFIED', 'reports/lp173/lp173-summary.json; evidence/lp173/owner-evidence.autodiscovered.json', 'Monitoring services, provider, evidence time, and owner are truthfully classified; unavailable project alert configuration remains NOT_CONFIGURED rather than inferred PASS.']],
  ['LP167-B008', ['SATISFIED', 'reports/lp171/rollback-rehearsal.json; reports/lp173/lp173-summary.json', 'Backup metadata and rollback ownership/rehearsal evidence are complete.']]
]);
const evidenceForUnresolved = new Map([
  ['LP167-B001', 'reports/lp162/lp162-summary.json'], ['LP167-B002', 'reports/lp163/lp163-summary.json'],
  ['LP167-B003', 'reports/lp164/lp164-summary.json'], ['LP167-B005', 'reports/lp166/lp166-summary.json'],
  ['LP167-B009', 'reports/lp167/blocker-register.json'], ['LP167-B010', 'reports/lp167/blocker-register.json'],
  ['LP167-B011', 'reports/lp167/blocker-register.json'], ['LP167-B012', 'reports/lp167/blocker-register.json'],
  ['LP167-B013', 'evidence/lp173/owner-evidence.autodiscovered.json; reports/lp167/blocker-register.json']
]);

const read = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = (root, commit, relative) => execFileSync('git', ['show', `${commit}:${relative}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });

function validateBaseline(lp173, lp174) {
  if (lp173.evidenceClassification !== 'EVIDENCE_COMPLETE' || lp173.authorizationReassessment !== 'READY_FOR_AUTHORIZATION_REASSESSMENT') throw Error('LP176 fails closed: LP173 evidence baseline is not complete and ready');
  if (lp174.authorizationReassessment !== 'READY_FOR_AUTHORIZATION_REASSESSMENT' || lp174.authorizationGranted !== false) throw Error('LP176 fails closed: LP174 handoff is not a non-authorizing ready reassessment');
  const counts = [lp173.machineVerifiedFacts.length, lp173.ownerAttestedFacts.length, lp173.sourceUnavailableFacts.length, lp173.ownerActionRequiredFacts.length];
  if (counts.join(',') !== '8,14,0,0') throw Error(`LP176 fails closed: unexpected governed evidence totals ${counts.join(',')}`);
  if (!Object.values(lp173.validation).filter(value => typeof value === 'string').every(value => value === 'PASS')) throw Error('LP176 fails closed: LP173 validation is not fully passing');
}

export function protectedIdentities(root = ROOT) {
  const artifacts = PROTECTED.map(relative => {
    const expected = blob(root, BASELINE_COMMIT, relative);
    const actual = blob(root, 'HEAD', relative);
    return { path: relative, identity: 'git-blob', expectedSha256: sha(expected), actualSha256: sha(actual), classification: expected.equals(actual) ? 'PASS' : 'FAIL' };
  });
  return { schemaVersion: 'gridly.lp176.protectedArtifactIdentities.v1', milestone: 'LP176', identitySource: 'CANONICAL_GIT_BLOB', baselineCommit: BASELINE_COMMIT, comparisonCommit: 'HEAD', workingTreeIgnored: true, classification: artifacts.every(item => item.classification === 'PASS') ? 'PASS' : 'FAIL', artifacts };
}

export function build(root = ROOT) {
  const lp173 = read(root, 'reports/lp173/lp173-summary.json');
  const lp174 = read(root, 'reports/lp174/authorization-reassessment-report.json');
  const blockers = read(root, 'reports/lp167/blocker-register.json').blockers;
  const checklist = read(root, 'reports/lp167/production-readiness-checklist.json').items;
  validateBaseline(lp173, lp174);
  const prerequisiteEvaluations = blockers.map(item => {
    const resolution = resolved.get(item.blockerId);
    const classification = resolution?.[0] ?? 'UNSATISFIED';
    return { prerequisiteId: item.blockerId, title: item.title, lp167Classification: item.classification, supportingEvidence: resolution?.[1] ?? evidenceForUnresolved.get(item.blockerId), classification, authorizationDecision: classification.startsWith('SATISFIED') ? 'GATE_SATISFIED' : 'GATE_BLOCKS_APPLICABLE_OPERATIONS', remainingBlocker: classification === 'UNSATISFIED' ? item.resolutionCriteria : null, applicability: { deployment: !item.deploymentMayProceed, activation: !item.activationMayProceed, distribution: ['LP167-B005', 'LP167-B009', 'LP167-B010', 'LP167-B011', 'LP167-B012', 'LP167-B013'].includes(item.blockerId), publicLaunch: !item.launchMayProceed }, rationale: resolution?.[2] ?? 'No completed LP173/LP174/LP175 evidence changes this separately governed LP167 prerequisite.' };
  });
  const blocked = operation => prerequisiteEvaluations.filter(item => item.classification === 'UNSATISFIED' && item.applicability[operation]);
  const decisions = Object.fromEntries(OPERATIONS.map(operation => {
    if (operation === 'productionRestore' || operation === 'productionRollback') return [operation, { status: 'NOT_AUTHORIZED', authorizationGranted: false, remainingBlockers: ['LP167 does not grant standing production restore or rollback authority; preserve independent, incident-specific governance.'] }];
    const remaining = blocked(operation);
    return [operation, { status: remaining.length ? 'NOT_AUTHORIZED' : 'AUTHORIZED', authorizationGranted: remaining.length === 0, remainingBlockers: remaining.map(item => `${item.prerequisiteId}: ${item.remainingBlocker}`) }];
  }));
  const protectedIdentity = protectedIdentities(root);
  if (protectedIdentity.classification !== 'PASS') for (const operation of OPERATIONS) decisions[operation] = { status: 'NOT_AUTHORIZED', authorizationGranted: false, remainingBlockers: ['Protected artifact identity verification failed.'] };
  const operationsPerformed = { deployments: 0, activations: 0, distributions: 0, publicLaunches: 0, productionRestores: 0, productionRollbacks: 0, runtimeModifications: 0 };
  const report = { schemaVersion: 'gridly.lp176.authorizationDecision.v1', milestone: 'LP176', boundary: 'AUTHORIZATION_DECISION_ONLY_NO_EXECUTION', governedEvidenceBaseline: { blockers: 0, machineVerified: 8, notConfigured: 2, ownerAttested: 14, lp173: 'EVIDENCE_COMPLETE', lp174: 'EVIDENCE_COMPLETE', readiness: 'READY_FOR_AUTHORIZATION_REASSESSMENT' }, policySource: 'LP167', priorEvidencePrerequisites: read(root, 'reports/lp167/prerequisite-reconciliation.json').prerequisites, productionReadinessChecklistAudit: checklist.map(item => ({ ...item, reassessment: 'PRESERVED_UNLESS_EXPLICITLY_RESOLVED_BY_A_GOVERNED_PREREQUISITE_EVALUATION' })), prerequisiteEvaluations, decisions, remainingBlockerCount: prerequisiteEvaluations.filter(item => item.classification === 'UNSATISFIED').length, protectedIdentityResult: protectedIdentity.classification, deterministicGeneration: 'PASS', operationsPerformed, nextStep: 'Resolve the remaining operation-specific LP167 prerequisites, then run a new governed authorization reassessment; do not execute any production operation under LP176.' };
  const summary = { schemaVersion: 'gridly.lp176.summary.v1', milestone: 'LP176', decisions, authorizationGranted: Object.fromEntries(OPERATIONS.map(operation => [operation, decisions[operation].authorizationGranted])), remainingBlockerCount: report.remainingBlockerCount, protectedIdentityResult: protectedIdentity.classification, deterministicGeneration: 'PASS', operationsPerformed, launchExecutionStatement: 'NO_PRODUCTION_OPERATION_PERFORMED', nextStep: report.nextStep };
  return { 'authorization-decision-report.json': report, 'lp176-summary.json': summary, 'protected-artifact-identities.json': protectedIdentity };
}

export function write(output = path.join(ROOT, REPORT_DIR), root = ROOT) { const reports = build(root); fs.mkdirSync(output, { recursive: true }); for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8'); return reports; }
export function verify(root = ROOT) { const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp176-')); try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root); write(b, root); for (const name of REPORT_NAMES) { const first = fs.readFileSync(path.join(a, name)); const second = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name)); if (!first.equals(second) || !first.equals(committed)) throw Error(`LP176 deterministic drift: ${name}`); if (first.includes(13) || (first[0] === 0xef && first[1] === 0xbb && first[2] === 0xbf)) throw Error(`LP176 canonical encoding failure: ${name}`); } return true; } finally { fs.rmSync(temp, { recursive: true, force: true }); } }

if (process.argv[1] === fileURLToPath(import.meta.url)) { const command = process.argv[2] ?? 'build'; if (command === 'build') { write(); console.log('LP176 authorization reassessment reports written; no operation performed.'); } else if (command === 'verify') { verify(); console.log('LP176 verification PASS'); } else throw Error(`Unknown command: ${command}`); }
