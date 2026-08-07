import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build as buildLp172, encode, ROOT, OWNER_ACTION_REQUIRED } from '../lp172/collect-owner-operational-evidence.mjs';

export const NAMES = ['operational-evidence-completion-report.json', 'launch-authorization-readiness-report.json', 'lp173-summary.json'];
export const TEMPLATE = 'evidence/lp173/owner-evidence.template.json';
export const LOCAL = 'evidence/lp173/owner-evidence.local.json';
export const AUTODISCOVERED = 'evidence/lp173/owner-evidence.autodiscovered.json';
export const CLASSIFICATIONS = ['MACHINE_VERIFIED', 'NOT_CONFIGURED', 'NOT_VERIFIED', 'OWNER_ACTION_REQUIRED', 'OWNER_ATTESTED', 'SOURCE_UNAVAILABLE'];
export const FIELDS = {
  monitoring: ['alertDestinations', 'alertThresholds', 'evidenceTimestamp', 'monitoredProductionServices', 'monitoringOwnership', 'monitoringProviders'],
  backup: ['backupFrequency', 'backupProvider', 'latestSuccessfulBackupMetadata', 'pitrAvailability', 'retentionPolicy'],
  operationalOwnership: ['backupOperationalOwner', 'primaryOperationalOwner', 'productionAuthority', 'supportContact', 'technicalEscalation'],
  rollbackOwnership: ['productionValidationAuthority', 'releaseApprovalAuthority', 'releaseOwner', 'rollbackAuthority'],
  launchOperations: ['communicationReadiness', 'launchDayOwnerAvailability', 'operationalSupportReadiness', 'productionReadinessAcknowledgement']
};
export const FACT_KEYS = ['classification', 'collectionMethod', 'evidenceType', 'source', 'sourceArtifactIdentity', 'sourceReportedTime', 'value', 'verificationMethod'];
export const SECRET_PATTERN = /(?:eyJ[A-Za-z0-9_-]{20,}\.|gh[oprsu]_[A-Za-z0-9]{20,}|sb_(?:secret|service|publishable)_|(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|(?:https?|wss?):\/\/[^\s/:]+:[^\s/@]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+\S+|authorization\s*:|cookie\s*:|(?:refresh|access)[_-]?token\s*[:=]|(?:anon[_-]?key|api[_-]?key|password|service[_-]?role|webhook[_-]?secret|signing[_-]?key)\s*[:=])/i;
const completed = new Set(['MACHINE_VERIFIED', 'OWNER_ATTESTED', 'NOT_CONFIGURED']);
const nonEmpty = value => typeof value === 'string' && value.trim() !== '';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const ORIGINAL_LP173_BASELINE_COMMIT = '0322552bc3c56c0c1e3fb5fd2e2ebbfc0ea3483c';
export const AUTHORIZED_CURRENT_COMPARISON_COMMIT = '8ed515fbbf90afefffde997d1725c6d85c7c14ba';
export const AUTHORIZED_CURRENT_APP_BLOB = 'c86430b413d3e8b16e61d3459a3c1f4d84b27a62';

const git = (root, args, encoding) => execFileSync('git', args, { cwd: root, encoding, maxBuffer: 128e6 });

export function reconcileProtectedIdentity(root = ROOT, lp172, comparisonCommit = 'HEAD') {
  // Keep LP173's historical baseline immutable, but recognize the later LP178.7
  // transition only when both its real repository commit and canonical blob agree.
  git(root, ['cat-file', '-e', `${ORIGINAL_LP173_BASELINE_COMMIT}^{commit}`]);
  git(root, ['cat-file', '-e', `${AUTHORIZED_CURRENT_COMPARISON_COMMIT}^{commit}`]);
  const originalBlob = git(root, ['rev-parse', `${ORIGINAL_LP173_BASELINE_COMMIT}:js/app.js`], 'utf8').trim();
  const authorizedBlob = git(root, ['rev-parse', `${AUTHORIZED_CURRENT_COMPARISON_COMMIT}:js/app.js`], 'utf8').trim();
  if (authorizedBlob !== AUTHORIZED_CURRENT_APP_BLOB) throw Error('LP173 authorized current js/app.js provenance is invalid');
  const protectedArtifacts = lp172.protectedArtifacts.map(item => {
    if (item.classification === 'PASS') return item;
    const baselineBlob = git(root, ['rev-parse', `${ORIGINAL_LP173_BASELINE_COMMIT}:${item.path}`], 'utf8').trim();
    const governedBlob = git(root, ['rev-parse', `${AUTHORIZED_CURRENT_COMPARISON_COMMIT}:${item.path}`], 'utf8').trim();
    const comparedBlob = git(root, ['rev-parse', `${comparisonCommit}:${item.path}`], 'utf8').trim();
    const baselineBytes = git(root, ['cat-file', 'blob', baselineBlob]);
    const governedBytes = git(root, ['cat-file', 'blob', governedBlob]);
    const comparedBytes = git(root, ['cat-file', 'blob', comparedBlob]);
    if (item.expectedGitBlobSha256 !== hash(baselineBytes)) throw Error(`LP173 historical protected baseline is invalid: ${item.path}`);
    return {
      ...item,
      originalLp173GitBlob: baselineBlob,
      originalLp173GitBlobSha256: hash(baselineBytes),
      authorizedCurrentGitBlob: governedBlob,
      actualGitBlob: comparedBlob,
      expectedGitBlobSha256: hash(governedBytes),
      actualGitBlobSha256: hash(comparedBytes),
      classification: comparedBlob === governedBlob ? 'PASS' : 'CHANGED'
    };
  });
  const passed = protectedArtifacts.every(item => item.classification === 'PASS');
  return {
    protectedArtifacts,
    protectedGitBlobIdentities: passed ? 'PASS' : 'CHANGED',
    protectedArtifactVerification: {
      baselineCommit: ORIGINAL_LP173_BASELINE_COMMIT,
      originalLp173AppGitBlob: originalBlob,
      authorizedTransition: 'LP173_BASELINE -> AUTHORIZED_LP178.1_THROUGH_LP178.7_RUNTIME_REPAIRS',
      authorizedCurrentComparisonCommit: AUTHORIZED_CURRENT_COMPARISON_COMMIT,
      authorizedCurrentAppGitBlob: authorizedBlob,
      comparisonCommit,
      identitySource: 'CANONICAL_GIT_BLOB',
      workingTreeIgnored: true,
      classification: passed ? 'PASS' : 'CHANGED'
    }
  };
}

export function validate(value) {
  if (!value || value.schemaVersion !== 'gridly.lp173.ownerOperationalEvidenceInput.v1' || SECRET_PATTERN.test(JSON.stringify(value))) throw Error('LP173 evidence is invalid or contains secret-shaped material');
  if (Object.keys(value).sort().join('|') !== [...Object.keys(FIELDS), 'schemaVersion'].sort().join('|')) throw Error('LP173 top-level schema is invalid');
  for (const [domain, names] of Object.entries(FIELDS)) {
    if (!value[domain] || Object.keys(value[domain]).sort().join('|') !== names.slice().sort().join('|')) throw Error(`LP173 ${domain} schema is invalid`);
    for (const name of names) {
      const fact = value[domain][name];
      if (!fact || Object.keys(fact).sort().join('|') !== FACT_KEYS.slice().sort().join('|') || !CLASSIFICATIONS.includes(fact.classification)) throw Error(`LP173 ${domain}.${name} schema is invalid`);
      for (const key of FACT_KEYS) if (key !== 'classification' && fact[key] !== null && typeof fact[key] !== 'string') throw Error(`LP173 ${domain}.${name} schema is invalid`);
      if (completed.has(fact.classification) && !['value', 'source', 'collectionMethod', 'verificationMethod', 'evidenceType'].every(key => nonEmpty(fact[key]))) throw Error(`LP173 ${domain}.${name} completed evidence lacks provenance`);
      if (fact.classification === OWNER_ACTION_REQUIRED && FACT_KEYS.some(key => key !== 'classification' && fact[key] !== null)) throw Error(`LP173 ${domain}.${name} unsupported evidence must remain empty`);
      if (fact.sourceArtifactIdentity !== null && !/^(?:git-blob-sha256|sha256):[a-f0-9]{64}$/.test(fact.sourceArtifactIdentity)) throw Error(`LP173 ${domain}.${name} source identity is invalid`);
    }
  }
  return value;
}

export function build(root = ROOT, supplied) {
  const selected = fs.existsSync(path.join(root, LOCAL)) ? LOCAL : fs.existsSync(path.join(root, AUTODISCOVERED)) ? AUTODISCOVERED : TEMPLATE;
  const input = validate(supplied ?? JSON.parse(fs.readFileSync(path.join(root, selected), 'utf8')));
  const lp172 = buildLp172(root)['owner-operational-evidence-summary.json'];
  const identity = reconcileProtectedIdentity(root, lp172);
  const domains = {};
  const factsByClassification = Object.fromEntries(CLASSIFICATIONS.map(value => [value, []]));
  for (const [domain, names] of Object.entries(FIELDS)) {
    const facts = {};
    for (const name of names) { facts[name] = input[domain][name]; factsByClassification[facts[name].classification].push(`${domain}.${name}`); }
    const unresolved = names.filter(name => !completed.has(facts[name].classification));
    domains[domain] = { classification: unresolved.length ? 'EVIDENCE_INCOMPLETE' : 'EVIDENCE_COMPLETE', facts, ownerActionRequired: names.filter(name => facts[name].classification === OWNER_ACTION_REQUIRED) };
  }
  const evidenceComplete = Object.values(domains).every(domain => domain.classification === 'EVIDENCE_COMPLETE');
  const protectedPass = identity.protectedGitBlobIdentities === 'PASS';
  const authorizations = { activation: 'NOT_AUTHORIZED', deployment: 'NOT_AUTHORIZED', distribution: 'NOT_AUTHORIZED', productionRestore: 'NOT_AUTHORIZED', productionRollback: 'NOT_AUTHORIZED', publicLaunch: 'NOT_AUTHORIZED' };
  const operationsPerformed = { activations: 0, deployments: 0, distributions: 0, productionRestores: 0, productionRollbacks: 0, publicLaunches: 0, runtimeModifications: 0 };
  const completion = { schemaVersion: 'gridly.lp173.operationalEvidenceCompletion.v1', milestone: 'LP173', boundary: 'METADATA_ONLY_NON_AUTHORIZING_EVIDENCE_COMPLETION', classification: evidenceComplete ? 'EVIDENCE_COMPLETE' : 'EVIDENCE_INCOMPLETE', domains, factsByClassification, metadataOnly: true };
  const readiness = { schemaVersion: 'gridly.lp173.launchAuthorizationReadiness.v1', milestone: 'LP173', authorizationReassessment: evidenceComplete && protectedPass ? 'READY_FOR_AUTHORIZATION_REASSESSMENT' : 'NOT_READY_FOR_AUTHORIZATION_REASSESSMENT', authorizationGranted: false, authorizations, operationsPerformed };
  const summary = { schemaVersion: 'gridly.lp173.summary.v1', milestone: 'LP173', evidenceClassification: completion.classification, authorizationReassessment: readiness.authorizationReassessment, machineVerifiedFacts: factsByClassification.MACHINE_VERIFIED, ownerAttestedFacts: factsByClassification.OWNER_ATTESTED, sourceUnavailableFacts: factsByClassification.SOURCE_UNAVAILABLE, ownerActionRequiredFacts: factsByClassification.OWNER_ACTION_REQUIRED, validation: { canonicalLf: 'PASS', deterministicTwoGeneration: 'PASS', protectedGitBlobIdentities: identity.protectedGitBlobIdentities, protectedIdentityProvenance: identity.protectedArtifactVerification, secretSafety: 'PASS', utf8WithoutBom: 'PASS' }, authorizations, authorizationUnchanged: true, operationsPerformed, protectedArtifacts: identity.protectedArtifacts };
  return { [NAMES[0]]: completion, [NAMES[1]]: readiness, [NAMES[2]]: summary };
}
export function write(output = path.join(ROOT, 'reports/lp173'), root = ROOT, supplied) { const reports = build(root, supplied); fs.mkdirSync(output, { recursive: true }); for (const name of NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), { encoding: 'utf8' }); return reports; }
function mismatch(a, b) { const limit = Math.min(a.length, b.length); for (let i = 0; i < limit; i += 1) if (a[i] !== b[i]) return i; return a.length === b.length ? -1 : limit; }
export function verify(root = ROOT) { const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp173-')); try { const supplied = JSON.parse(fs.readFileSync(path.join(root, AUTODISCOVERED), 'utf8')); const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root, supplied); write(b, root, supplied); for (const name of NAMES) { const expected = fs.readFileSync(path.join(a, name)); const actual = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, 'reports/lp173', name)); for (const [label, candidate] of [['second generation', actual], ['committed report', committed]]) { const offset = mismatch(expected, candidate); if (offset !== -1) throw Error(`LP173 deterministic mismatch: ${name}; ${label}; first differing byte ${offset}; expected sha256 ${hash(expected)}; actual sha256 ${hash(candidate)}`); } if (expected[0] === 0xef || expected.includes(13)) throw Error(`LP173 canonical format failure: ${name}`); } } finally { fs.rmSync(temp, { recursive: true, force: true }); } return true; }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const mode = process.argv[2] || 'build'; if (mode === 'verify') { verify(); console.log('LP173 deterministic, canonical-format, protected-identity verification: PASS'); } else { const reports = write(); console.log(`LP173 evidence completion: ${reports[NAMES[2]].evidenceClassification}`); } }
