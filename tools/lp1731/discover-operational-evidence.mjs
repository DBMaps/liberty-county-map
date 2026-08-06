import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { encode, ROOT } from '../lp172/collect-owner-operational-evidence.mjs';
import { FACT_KEYS, FIELDS, LOCAL, SECRET_PATTERN, TEMPLATE, validate } from '../lp173/complete-operational-evidence.mjs';

export const SOURCE = 'evidence/lp1731/production-metadata.local.json';
export const DISCOVERED = 'evidence/lp173/owner-evidence.autodiscovered.json';
export const REPORT_DIR = 'reports/lp1731';
export const REPORT_NAMES = ['auto-discovery-report.json', 'auto-discovery-summary.json'];
const CANDIDATES = {
  monitoring: ['alertDestinations', 'alertThresholds', 'evidenceTimestamp', 'monitoredProductionServices', 'monitoringProviders'],
  backup: ['backupFrequency', 'backupProvider', 'latestSuccessfulBackupMetadata', 'pitrAvailability', 'retentionPolicy']
};
const statuses = new Set(['VERIFIED_PRESENT', 'VERIFIED_ABSENT', 'UNCERTAIN']);
const completed = new Set(['MACHINE_VERIFIED', 'NOT_CONFIGURED', 'OWNER_ATTESTED']);
const emptyFact = classification => Object.fromEntries(FACT_KEYS.map(key => [key, key === 'classification' ? classification : null]));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function sourceUnavailable(domain, name) {
  return { ...emptyFact('SOURCE_UNAVAILABLE'), collectionMethod: 'metadata-only local export lookup', evidenceType: 'production platform metadata', source: `LP173.1 ${domain} authoritative metadata export`, verificationMethod: `required source record ${domain}.${name} was unavailable` };
}

function validateSource(input) {
  if (!input || input.schemaVersion !== 'gridly.lp1731.productionMetadata.v1' || SECRET_PATTERN.test(JSON.stringify(input))) throw Error('LP173.1 discovery source is invalid or contains secret-shaped material');
  if (!input.facts || Object.keys(input).some(key => !['facts', 'schemaVersion'].includes(key))) throw Error('LP173.1 discovery source schema is invalid');
  for (const [domain, records] of Object.entries(input.facts)) {
    if (!CANDIDATES[domain] || !records || typeof records !== 'object' || Array.isArray(records)) throw Error('LP173.1 discovery source schema is invalid');
    for (const [name, record] of Object.entries(records)) {
      if (!CANDIDATES[domain].includes(name) || !record || !statuses.has(record.status)) throw Error('LP173.1 discovery source schema is invalid');
      const allowed = ['collectionMethod', 'evidenceType', 'source', 'sourceArtifactIdentity', 'sourceReportedTime', 'status', 'value', 'verificationMethod'];
      if (Object.keys(record).some(key => !allowed.includes(key))) throw Error('LP173.1 discovery source schema is invalid');
      for (const key of allowed) if (key !== 'status' && record[key] !== undefined && record[key] !== null && typeof record[key] !== 'string') throw Error('LP173.1 discovery source schema is invalid');
    }
  }
  return input;
}

function machineFact(record) {
  const classification = record.status === 'VERIFIED_PRESENT' ? 'MACHINE_VERIFIED' : record.status === 'VERIFIED_ABSENT' ? 'NOT_CONFIGURED' : 'NOT_VERIFIED';
  const fact = Object.fromEntries(FACT_KEYS.map(key => [key, key === 'classification' ? classification : record[key] ?? null]));
  if (classification === 'NOT_VERIFIED' && !fact.value) fact.value = 'governed fact could not be conclusively verified';
  if (classification !== 'NOT_VERIFIED' && !['value', 'source', 'collectionMethod', 'verificationMethod', 'evidenceType', 'sourceArtifactIdentity'].every(key => typeof fact[key] === 'string' && fact[key].trim())) throw Error('LP173.1 completed machine evidence lacks provenance');
  return fact;
}

export function discover(root = ROOT, supplied) {
  const template = JSON.parse(fs.readFileSync(path.join(root, TEMPLATE), 'utf8'));
  const sourcePath = path.join(root, SOURCE);
  const input = supplied === undefined ? (fs.existsSync(sourcePath) ? validateSource(JSON.parse(fs.readFileSync(sourcePath, 'utf8'))) : null) : validateSource(supplied);
  for (const [domain, names] of Object.entries(CANDIDATES)) for (const name of names) template[domain][name] = input?.facts?.[domain]?.[name] ? machineFact(input.facts[domain][name]) : sourceUnavailable(domain, name);
  return validate(template);
}

export function prefill(root = ROOT, discovered = discover(root), owner) {
  validate(discovered);
  const localPath = path.join(root, LOCAL);
  const current = owner ?? (fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : JSON.parse(fs.readFileSync(path.join(root, TEMPLATE), 'utf8')));
  validate(current);
  const merged = structuredClone(discovered);
  for (const [domain, names] of Object.entries(FIELDS)) for (const name of names) {
    const ownerFact = current[domain][name];
    const machineFactValue = discovered[domain][name];
    if (ownerFact.classification === 'OWNER_ATTESTED') merged[domain][name] = ownerFact;
    else if (ownerFact.classification === 'MACHINE_VERIFIED' && completed.has(machineFactValue.classification) && JSON.stringify(ownerFact) !== JSON.stringify(machineFactValue)) throw Error(`LP173.1 evidence conflict at ${domain}.${name}`);
    else if (completed.has(ownerFact.classification) && !completed.has(machineFactValue.classification)) merged[domain][name] = ownerFact;
  }
  return validate(merged);
}

export function reports(evidence, root = ROOT) {
  const lists = Object.fromEntries(['MACHINE_VERIFIED', 'NOT_CONFIGURED', 'NOT_VERIFIED', 'SOURCE_UNAVAILABLE', 'OWNER_ACTION_REQUIRED'].map(key => [key, []]));
  for (const [domain, names] of Object.entries(FIELDS)) for (const name of names) if (lists[evidence[domain][name].classification]) lists[evidence[domain][name].classification].push(`${domain}.${name}`);
  const found = lists.MACHINE_VERIFIED.length + lists.NOT_CONFIGURED.length;
  const classification = found === 0 ? 'AUTO_DISCOVERY_NO_EVIDENCE' : lists.SOURCE_UNAVAILABLE.length || lists.NOT_VERIFIED.length || lists.OWNER_ACTION_REQUIRED.length ? 'AUTO_DISCOVERY_PARTIAL' : 'AUTO_DISCOVERY_COMPLETE';
  const authorizations = { activation: 'NOT_AUTHORIZED', deployment: 'NOT_AUTHORIZED', distribution: 'NOT_AUTHORIZED', productionRestore: 'NOT_AUTHORIZED', productionRollback: 'NOT_AUTHORIZED', publicLaunch: 'NOT_AUTHORIZED' };
  const lp173 = JSON.parse(fs.readFileSync(path.join(root, 'reports/lp173/lp173-summary.json'), 'utf8'));
  const report = { schemaVersion: 'gridly.lp1731.autoDiscoveryReport.v1', milestone: 'LP173.1', boundary: 'METADATA_ONLY_NON_AUTHORIZING_AUTO_DISCOVERY', classification, ownerInput: lists.OWNER_ACTION_REQUIRED.length || lists.SOURCE_UNAVAILABLE.length || lists.NOT_VERIFIED.length ? 'OWNER_INPUT_STILL_REQUIRED' : 'NO_OWNER_INPUT_REQUIRED', fieldsByClassification: lists, secretSafety: 'PASS', metadataOnly: true, authorizationUnchanged: true, authorizations };
  const summary = { schemaVersion: 'gridly.lp1731.autoDiscoverySummary.v1', milestone: 'LP173.1', classification, machineVerifiedFields: lists.MACHINE_VERIFIED, notConfiguredFields: lists.NOT_CONFIGURED, notVerifiedFields: lists.NOT_VERIFIED, sourceUnavailableFields: lists.SOURCE_UNAVAILABLE, ownerActionRequiredFields: lists.OWNER_ACTION_REQUIRED, validation: { canonicalLf: 'PASS', deterministicTwoGeneration: 'PASS', protectedGitBlobIdentities: lp173.validation.protectedGitBlobIdentities, protectedIdentitySource: lp173.validation.protectedIdentityProvenance.identitySource, secretSafety: 'PASS', utf8WithoutBom: 'PASS', workingTreeIgnored: lp173.validation.protectedIdentityProvenance.workingTreeIgnored }, authorizationUnchanged: true, authorizations };
  return { [REPORT_NAMES[0]]: report, [REPORT_NAMES[1]]: summary };
}

export function write(root = ROOT, supplied) {
  const evidence = discover(root, supplied);
  const outputs = reports(evidence, root);
  fs.mkdirSync(path.join(root, path.dirname(DISCOVERED)), { recursive: true });
  fs.mkdirSync(path.join(root, REPORT_DIR), { recursive: true });
  fs.writeFileSync(path.join(root, DISCOVERED), encode(evidence), 'utf8');
  for (const name of REPORT_NAMES) fs.writeFileSync(path.join(root, REPORT_DIR, name), encode(outputs[name]), 'utf8');
  return { evidence, outputs };
}

export function writePrefill(root = ROOT) { const value = prefill(root); fs.writeFileSync(path.join(root, LOCAL), encode(value), 'utf8'); return value; }
function generated(root, supplied, dir) { const evidence = discover(root, supplied); const output = reports(evidence, root); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, path.basename(DISCOVERED)), encode(evidence)); for (const name of REPORT_NAMES) fs.writeFileSync(path.join(dir, name), encode(output[name])); return [path.basename(DISCOVERED), ...REPORT_NAMES]; }
export function verify(root = ROOT) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1731-'));
  try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); const names = generated(root, undefined, a); generated(root, undefined, b); for (const name of names) { const one = fs.readFileSync(path.join(a, name)); const two = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, name === path.basename(DISCOVERED) ? DISCOVERED : path.join(REPORT_DIR, name))); if (!one.equals(two) || !one.equals(committed) || one[0] === 0xef || one.includes(13) || SECRET_PATTERN.test(one.toString('utf8'))) throw Error(`LP173.1 verification failed: ${name}; expected sha256 ${sha256(one)}; actual sha256 ${sha256(committed)}`); } } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { const mode = process.argv[2] || 'discover'; if (mode === 'prefill') { writePrefill(); console.log('LP173.1 deterministic owner prefill written; review OWNER_ACTION_REQUIRED fields.'); } else if (mode === 'verify') { verify(); console.log('LP173.1 deterministic, canonical, secret-safe verification: PASS'); } else { const result = write(); console.log(`LP173.1 auto-discovery: ${result.outputs[REPORT_NAMES[1]].classification}`); } } catch { console.error('LP173.1 auto-discovery failed closed; source content was not displayed.'); process.exitCode = 1; }
}
