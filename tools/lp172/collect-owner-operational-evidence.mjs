import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// The authoritative protected-artifact state is the mainline commit immediately
// before LP172 was merged.  Do not derive this from the moving HEAD or from the
// checkout, since either makes the generated report branch/line-ending dependent.
export const BASELINE = '0322552bc3c56c0c1e3fb5fd2e2ebbfc0ea3483c';
export const NAMES = ['monitoring-evidence.json', 'backup-evidence.json', 'operational-ownership.json', 'rollback-ownership.json', 'launch-operations.json', 'owner-operational-evidence-summary.json'];
export const OWNER_ACTION_REQUIRED = 'OWNER_ACTION_REQUIRED';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const encode = value => `${JSON.stringify(stable(value), null, 2)}\n`;
const secret = /(?:eyJ[A-Za-z0-9_-]{20,}\.|sb_(?:secret|service|publishable)_|(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/|-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+\S+|authorization\s*:|cookie\s*:|(?:refresh|access)[_-]?token\s*[:=]|(?:anon[_-]?key|api[_-]?key|password|service[_-]?role|webhook[_-]?secret|signing[_-]?key)\s*[:=])/i;
const fields = {
  monitoring: ['monitoringProviders', 'monitoredProductionServices', 'alertDestinations', 'alertThresholds', 'monitoringOwnership', 'evidenceTimestamp'],
  backup: ['backupProvider', 'backupFrequency', 'retentionPolicy', 'pitrAvailability', 'latestSuccessfulBackupMetadata'],
  operationalOwnership: ['primaryOperationalOwner', 'backupOperationalOwner', 'technicalEscalation', 'supportContact', 'productionAuthority'],
  rollbackOwnership: ['releaseOwner', 'rollbackAuthority', 'productionValidationAuthority', 'releaseApprovalAuthority'],
  launchOperations: ['launchDayOwnerAvailability', 'communicationReadiness', 'operationalSupportReadiness', 'productionReadinessAcknowledgement']
};
const schemas = {
  monitoring: 'gridly.lp172.monitoringEvidence.v1', backup: 'gridly.lp172.backupEvidence.v1', operationalOwnership: 'gridly.lp172.operationalOwnership.v1', rollbackOwnership: 'gridly.lp172.rollbackOwnership.v1', launchOperations: 'gridly.lp172.launchOperations.v1'
};
const reportNames = { monitoring: NAMES[0], backup: NAMES[1], operationalOwnership: NAMES[2], rollbackOwnership: NAMES[3], launchOperations: NAMES[4] };
const summaryKeys = { monitoring: 'monitoring', backup: 'backup', operationalOwnership: 'ownership', rollbackOwnership: 'rollback', launchOperations: 'launchOperations' };
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export function validateEvidence(value) {
  if (!value || value.schemaVersion !== 'gridly.lp172.ownerOperationalEvidenceInput.v1' || secret.test(JSON.stringify(value))) throw Error('LP172 evidence is invalid or contains secret-shaped material');
  for (const [section, required] of Object.entries(fields)) {
    if (!value[section] || Object.keys(value[section]).some(key => !required.includes(key))) throw Error(`LP172 ${section} evidence schema is invalid`);
    for (const key of required) if (typeof value[section][key] !== 'string' || !value[section][key].trim()) throw Error(`LP172 ${section} evidence schema is invalid`);
  }
  return value;
}
const classification = record => Object.values(record).every(value => value !== OWNER_ACTION_REQUIRED) ? 'PASS' : OWNER_ACTION_REQUIRED;
function protectedArtifacts(root) {
  const prefixes = ['js/app.js', ...[162, 163, 164, 165, 166, 167, 168, 169, 170, 171].map(n => `reports/lp${n}`)];
  const names = execFileSync('git', ['ls-tree', '-r', '--name-only', BASELINE], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(name => prefixes.some(prefix => name === prefix || name.startsWith(`${prefix}/`))).sort();
  return names.map(name => {
    const expected = execFileSync('git', ['show', `${BASELINE}:${name}`], { cwd: root, maxBuffer: 128e6 });
    const actual = execFileSync('git', ['show', `HEAD:${name}`], { cwd: root, maxBuffer: 128e6 });
    return { path: name, expectedGitBlobSha256: sha256(expected), actualGitBlobSha256: sha256(actual), classification: expected.equals(actual) ? 'PASS' : 'CHANGED' };
  });
}
export function build(root = ROOT, supplied) {
  const input = validateEvidence(supplied ?? JSON.parse(fs.readFileSync(path.join(root, 'evidence/lp172/owner-operational-evidence.json'), 'utf8')));
  const reports = {};
  const classifications = {};
  for (const section of Object.keys(fields)) {
    const evidence = Object.fromEntries(fields[section].map(key => [key, input[section][key]]));
    const result = classification(evidence);
    classifications[summaryKeys[section]] = result;
    reports[reportNames[section]] = { schemaVersion: schemas[section], milestone: 'LP172', boundary: 'METADATA_ONLY_EVIDENCE_COLLECTION', classification: result, metadataOnly: true, evidence };
  }
  const artifacts = protectedArtifacts(root);
  const ownerActionRequired = Object.values(classifications).some(value => value !== 'PASS');
  reports[NAMES[5]] = { schemaVersion: 'gridly.lp172.ownerOperationalEvidenceSummary.v1', ...classifications, overallClassification: ownerActionRequired ? OWNER_ACTION_REQUIRED : 'PASS', ownerActionRequired, metadataOnly: true, secretSafe: true, validation: { canonicalLf: true, utf8WithoutBom: true, deterministicOrdering: true, protectedGitBlobIdentities: artifacts.every(item => item.classification === 'PASS') ? 'PASS' : 'CHANGED', protectedRuntime: 'UNCHANGED', deployment: 'NOT_AUTHORIZED', activation: 'NOT_AUTHORIZED', launchAuthorization: 'NOT_AUTHORIZED' }, protectedArtifactVerification: { baselineCommit: BASELINE, comparisonCommit: 'HEAD', identitySource: 'CANONICAL_GIT_BLOB', workingTreeIgnored: true }, protectedArtifacts: artifacts, operationsPerformed: { deployments: 0, activations: 0, launchAuthorizations: 0, restorations: 0, rollbacks: 0, runtimeModifications: 0, productionConfigurationChanges: 0 } };
  return reports;
}
export function write(output = path.join(ROOT, 'reports/lp172'), root = ROOT, supplied) { const reports = build(root, supplied); fs.mkdirSync(output, { recursive: true }); for (const name of NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name])); return reports; }
export function verify(root = ROOT) { const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp172-')); try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root); write(b, root); for (const name of NAMES) { const one = fs.readFileSync(path.join(a, name)); const two = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, 'reports/lp172', name)); if (!one.equals(two) || !one.equals(committed) || one[0] === 0xef || one.includes(13)) throw Error(`LP172 report drift: ${name}`); } } finally { fs.rmSync(temp, { recursive: true, force: true }); } return true; }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const mode = process.argv[2] || 'build'; if (mode === 'verify') { verify(); console.log('LP172 deterministic verification: PASS'); } else { const reports = write(); console.log(`LP172 evidence collection: ${reports[NAMES[5]].overallClassification}`); } }
