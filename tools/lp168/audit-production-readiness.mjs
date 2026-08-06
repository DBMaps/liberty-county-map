import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const GENERATED_AT = '1970-01-01T00:00:00.000Z';
export const BASELINE = '9fce6301eb2ec106dd7dfd217cb96ad892c6102f';
export const REPORT_NAMES = ['configuration-inventory.json', 'missing-prerequisites.json', 'production-readiness.json', 'protected-artifact-identities.json', 'recommended-actions.json', 'risk-summary.json'];
export const PROTECTED_PATHS = ['js/app.js', 'reports/lp162/lp162-summary.json', 'reports/lp163/lp163-summary.json', 'reports/lp164/lp164-summary.json', 'reports/lp165/lp165-summary.json', 'reports/lp166/lp166-summary.json', 'reports/lp167/lp167-summary.json'];
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
export const encode = value => `${JSON.stringify(stable(value), null, 2)}\n`;
const present = (root, relativePath) => fs.existsSync(path.join(root, relativePath));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export function canonicalGitBlob(root, revision, relativePath) {
  return execFileSync('git', ['show', `${revision}:${relativePath}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
}

export function protectedArtifactIdentity(root, relativePath, baselineCommit = BASELINE, currentCommit = 'HEAD') {
  const baselineSha256 = sha256(canonicalGitBlob(root, baselineCommit, relativePath));
  const currentSha256 = sha256(canonicalGitBlob(root, currentCommit, relativePath));
  return {
    path: relativePath,
    baselineCommit,
    baselineSha256,
    currentCommit,
    currentSha256,
    authoritativeIdentitySource: 'GIT_BLOB',
    status: baselineSha256 === currentSha256 ? 'UNCHANGED' : 'CHANGED'
  };
}

export function classify(prerequisites) {
  if (prerequisites.some(item => item.requiredForLaunch && item.status === 'MISSING')) return 'NOT_READY';
  if (prerequisites.some(item => item.status !== 'PRESENT')) return 'CONDITIONALLY_READY';
  return 'READY';
}

export function audit(root = ROOT) {
  const configuration = [
    ['SUPABASE_PROJECT', 'supabase/config.toml', 'PRESENT', 'Repository Supabase project configuration'],
    ['SUPABASE_URL', null, 'UNVERIFIED', 'Required Edge Function secret; value intentionally not read'],
    ['SUPABASE_SERVICE_ROLE_KEY', null, 'UNVERIFIED', 'Required server-only Edge Function secret; value intentionally not read'],
    ['GRIDLY_CERTIFIED_ADDRESS_BUCKET', null, 'UNVERIFIED', 'Certified address storage bucket selector'],
    ['GRIDLY_GEOCODE_ALLOWED_ORIGINS', null, 'UNVERIFIED', 'Production CORS allowlist'],
    ['GRIDLY_GEOCODE_USER_AGENT', null, 'UNVERIFIED', 'Provider identification'],
    ['GRIDLY_GEOCODE_PROVIDER', null, 'UNVERIFIED', 'Primary geocoding provider selection'],
    ['GRIDLY_GEOCODE_PROVIDER_URL', null, 'UNVERIFIED', 'Primary provider endpoint'],
    ['GRIDLY_AUTHORITATIVE_RURAL_PROVIDER', null, 'UNVERIFIED', 'Authoritative rural provider selection'],
    ['GRIDLY_AUTHORITATIVE_RURAL_URL', null, 'UNVERIFIED', 'Authoritative rural endpoint'],
    ['GRIDLY_AUTHORITATIVE_RURAL_API_KEY', null, 'UNVERIFIED', 'Authoritative rural provider secret'],
    ['GRIDLY_AUTHORITATIVE_RURAL_TIMEOUT_MS', null, 'UNVERIFIED', 'Authoritative provider timeout'],
    ['GRIDLY_RURAL_FALLBACK_ENABLED', null, 'UNVERIFIED', 'Fallback activation boundary'],
    ['GRIDLY_RURAL_FALLBACK_URL', null, 'UNVERIFIED', 'Fallback endpoint'],
    ['GRIDLY_RURAL_FALLBACK_TIMEOUT_MS', null, 'UNVERIFIED', 'Fallback timeout']
  ].map(([name, evidence, status, purpose]) => ({ name, scope: name === 'SUPABASE_PROJECT' ? 'REPOSITORY' : 'PRODUCTION_SECRET_OR_CONFIG', sensitive: /KEY|URL/.test(name), status: evidence && !present(root, evidence) ? 'MISSING' : status, evidence: evidence ?? 'No governed production attestation in repository', purpose, valueExposed: false }));

  const prerequisites = [
    ['LP168-P001', 'Production environment and secrets completeness attestation', 'MISSING', true, 'Record presence and ownership of every required variable without recording values.'],
    ['LP168-P002', 'Supabase production project, migrations, RLS, functions, and auth validation', 'MISSING', true, 'Validate the production project against repository configuration and migration inventory read-only.'],
    ['LP168-P003', 'Storage buckets, object inventory, access policy, and retention validation', 'MISSING', true, 'Record bucket existence, permissions, CORS, retention, and certified object checks.'],
    ['LP168-P004', 'Monitoring, structured logging, alert routing, and on-call ownership', 'MISSING', true, 'Configure and exercise alerts, then record owners and escalation paths.'],
    ['LP168-P005', 'Backup coverage, restore point, retention, and restore rehearsal', 'MISSING', true, 'Verify backups and complete a non-production restore rehearsal.'],
    ['LP168-P006', 'Rollback runbook, release identity, authority, and rehearsal', 'MISSING', true, 'Approve and rehearse an application and database rollback procedure.'],
    ['LP168-P007', 'Production domain, TLS, headers, CORS, and rate-limit validation', 'MISSING', true, 'Record production endpoint security validation.'],
    ['LP168-P008', 'Error handling and degraded-provider production smoke evidence', 'MISSING', true, 'Exercise governed failure modes without modifying production data.'],
    ['LP168-P009', 'Locked dependency install and reproducible build evidence', present(root, 'package-lock.json') ? 'PARTIAL' : 'MISSING', true, 'Run clean, pinned builds on two isolated workers and compare artifacts.'],
    ['LP168-P010', 'Production dependency vulnerability review and disposition', 'MISSING', true, 'Run a governed dependency/security scan and disposition findings.'],
    ['LP168-P011', 'LP167 launch authorization', 'MISSING', true, 'Resolve LP167 blockers and obtain explicit owner authorization.']
  ].map(([id, name, status, requiredForLaunch, action]) => ({ id, name, status, requiredForLaunch, action, evidence: id === 'LP168-P009' ? 'package-lock.json present; independent build identity absent' : id === 'LP168-P011' ? 'reports/lp167/lp167-summary.json: deployment and launch NOT_AUTHORIZED' : 'No governed production evidence in repository' }));
  const classification = classify(prerequisites);
  const dependencies = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const protectedArtifacts = PROTECTED_PATHS.map(relativePath => protectedArtifactIdentity(root, relativePath));
  const risks = prerequisites.filter(item => item.status !== 'PRESENT').map((item, index) => ({ riskId: `LP168-R${String(index + 1).padStart(3, '0')}`, prerequisiteId: item.id, severity: item.requiredForLaunch ? 'HIGH' : 'MEDIUM', status: 'OPEN', launchImpact: item.requiredForLaunch ? 'BLOCKS_STATEWIDE_LAUNCH' : 'CONDITIONAL', summary: item.name }));
  const common = { milestone: 'LP168', generatedAt: GENERATED_AT, baselineCommit: BASELINE };
  return {
    'configuration-inventory.json': { ...common, collectionBoundary: 'REPOSITORY_ONLY_NO_ENVIRONMENT_VALUES_READ', items: configuration, dependencyInventory: { runtime: dependencies.dependencies ?? {}, development: dependencies.devDependencies ?? {}, lockfilePresent: present(root, 'package-lock.json'), packageRegenerationPerformed: false }, supabase: { configPresent: present(root, 'supabase/config.toml'), edgeFunctionPresent: present(root, 'supabase/functions/gridly-geocode/index.ts'), migrationCount: fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).length, remoteProjectQueried: false }, storage: { repositoryAdaptersPresent: present(root, 'supabase/functions/_shared/county-artifact-storage.mjs'), productionBucketsQueried: false, status: 'UNVERIFIED' } },
    'missing-prerequisites.json': { ...common, classification, missingCount: prerequisites.filter(x => x.status === 'MISSING').length, partialCount: prerequisites.filter(x => x.status === 'PARTIAL').length, prerequisites },
    'production-readiness.json': { ...common, classification, certificationDecision: 'STATEWIDE_LAUNCH_NOT_CERTIFIED', mergeRecommendation: 'MERGE_AUDIT_ARTIFACTS_ONLY_DO_NOT_DEPLOY', auditBoundary: 'READ_ONLY_REPOSITORY_EVIDENCE', productionWrites: 0, deployments: 0, activations: 0, runtimeChanges: 0, packageRegenerations: 0, secretValuesRead: 0, protectedArtifactsModified: false, rationale: 'Required production, monitoring, backup, rollback, security, and owner evidence is absent; fail-closed classification is required.' },
    'protected-artifact-identities.json': { ...common, algorithm: 'SHA-256', protectedArtifacts },
    'recommended-actions.json': { ...common, actions: prerequisites.map((item, priority) => ({ priority: priority + 1, prerequisiteId: item.id, action: item.action, productionChangeAuthorizedByThisAudit: false })) },
    'risk-summary.json': { ...common, classification, openRiskCount: risks.length, highRiskCount: risks.filter(x => x.severity === 'HIGH').length, risks }
  };
}

export function writeReports(output, root = ROOT) {
  const reports = audit(root);
  fs.mkdirSync(output, { recursive: true });
  for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]));
  return reports;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex === -1 ? path.join(ROOT, 'reports/lp168') : path.resolve(process.argv[outputIndex + 1]);
  writeReports(output);
  console.log(`LP168 production readiness: ${audit()['production-readiness.json'].classification}`);
}
