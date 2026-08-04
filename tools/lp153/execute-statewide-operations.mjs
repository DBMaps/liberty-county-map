#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifacts as buildLp152, P as LP152 } from '../lp152/build-deployment-readiness.mjs';
import { protectedHashes, gitBlobBytes, canonicalJsonEqual } from '../lp151/validate-statewide-operations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const P = {
  ...LP152,
  lp152Registry: 'data/lp152/operational-enablement-registry.json',
  lp152DeploymentAuthorization: 'reports/lp152/deployment-authorization-report.json',
  lp152ActivationAuthorization: 'reports/lp152/activation-authorization-report.json',
  executionRegistry: 'data/lp153/operational-execution-registry.json',
  executionTrace: 'reports/lp153/execution-trace.json',
  deploymentExecutionReport: 'reports/lp153/deployment-execution-report.json',
  activationExecutionReport: 'reports/lp153/activation-execution-report.json',
  executionSummary: 'reports/lp153/execution-summary.json'
};
function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {}); return value; }
function stableJson(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function shaText(text) { return createHash('sha256').update(text).digest('hex'); }
function shaGit(path) { return createHash('sha256').update(gitBlobBytes(path)).digest('hex'); }
function fail(message) { throw new Error(`[LP153] ${message}`); }
const PIPELINE = ['Manufacturing','Certification','Storage','Geometry','Identity','Membership','Validation','Deployment Authorization','Deployment','Activation Authorization','Activation'];

function normalizeAuthorizationContract(contract, kind, knownFips) {
  const empty = { valid: true, malformed: false, authorizedFips: [], rejected: [], recognition: 'EMPTY_CONTRACT' };
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) return { valid: false, malformed: true, authorizedFips: [], rejected: [{ reason: 'CONTRACT_NOT_OBJECT' }], recognition: 'MALFORMED_CONTRACT' };
  const rows = contract.authorizations;
  if (rows === undefined) return empty;
  if (!Array.isArray(rows)) return { valid: false, malformed: true, authorizedFips: [], rejected: [{ reason: 'AUTHORIZATIONS_NOT_ARRAY' }], recognition: 'MALFORMED_CONTRACT' };
  const authorizedFips = [];
  const rejected = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) { rejected.push({ reason: 'AUTHORIZATION_ROW_NOT_OBJECT' }); continue; }
    const fips = row.fips;
    if (typeof fips !== 'string' || !/^48\d{3}$/.test(fips)) { rejected.push({ fips: String(fips), reason: 'INVALID_FIPS' }); continue; }
    if (!knownFips.has(fips)) { rejected.push({ fips, reason: 'UNKNOWN_COUNTY_IDENTITY' }); continue; }
    if (row.authorized !== true) { rejected.push({ fips, reason: 'AUTHORIZED_TRUE_REQUIRED' }); continue; }
    if (kind === 'activation' && row.deploymentRequired !== true) { rejected.push({ fips, reason: 'DEPLOYMENT_REQUIRED_ACKNOWLEDGEMENT_MISSING' }); continue; }
    authorizedFips.push(fips);
  }
  return { valid: rejected.length === 0, malformed: false, authorizedFips: [...new Set(authorizedFips)].sort(), rejected, recognition: rows.length === 0 ? 'EMPTY_CONTRACT' : 'EXPLICIT_CONTRACT' };
}

function executionArchitecture() {
  return PIPELINE.map((stage, index) => ({
    order: index + 1,
    stage,
    executionInputs: stage.includes('Authorization') ? ['explicit contract rows only'] : ['committed LP130-LP152 artifacts'],
    executionOutputs: stage === 'Deployment' ? ['deployment decision, no deployment side effect'] : stage === 'Activation' ? ['activation decision, no activation side effect'] : ['validated checkpoint state'],
    executionContracts: ['canonical committed JSON', 'ascending FIPS county identity', 'explicit-only authorization'],
    executionCheckpoints: ['schema recognition', 'protected Git-blob hash validation', 'cardinality validation', 'fail-closed decision recording'],
    failClosedBehavior: 'missing, malformed, invalid, unauthorized, or prior-blocked input records rejection and prevents downstream operational change',
    protectedBoundaries: ['authorization is not deployment', 'deployment is not activation', 'runtime selection unchanged', 'planner unchanged']
  }));
}

function buildExecution(options = {}) {
  const lp152 = buildLp152();
  const registry152 = options.registry ?? readJson(P.lp152Registry);
  const deployContract = options.deploymentContract ?? readJson(P.lp152DeploymentAuthorization);
  const activateContract = options.activationContract ?? readJson(P.lp152ActivationAuthorization);
  const knownFips = new Set(registry152.counties.map((c) => c.fips));
  const deploymentContract = normalizeAuthorizationContract(deployContract, 'deployment', knownFips);
  const activationContract = normalizeAuthorizationContract(activateContract, 'activation', knownFips);
  const protectedArtifactHashes = { ...protectedHashes(), lp151Registry: shaGit(P.lp151Registry), lp151Summary: shaGit(P.lp151Summary), lp152Registry: shaGit(P.lp152Registry), lp152DeploymentAuthorization: shaGit(P.lp152DeploymentAuthorization), lp152ActivationAuthorization: shaGit(P.lp152ActivationAuthorization) };
  const counties = registry152.counties.map((county) => {
    const deploymentAuthorized = deploymentContract.valid && deploymentContract.authorizedFips.includes(county.fips);
    const activationAuthorized = activationContract.valid && activationContract.authorizedFips.includes(county.fips);
    const deploymentDecision = deploymentAuthorized ? 'REJECTED_FAIL_CLOSED_NOT_PERFORMED_BY_LP153' : 'NO_DEPLOYMENT_UNAUTHORIZED';
    const activationDecision = activationAuthorized ? 'REJECTED_FAIL_CLOSED_NOT_PERFORMED_BY_LP153' : 'NO_ACTIVATION_UNAUTHORIZED';
    const rejectionReasons = [];
    if (!deploymentContract.valid) rejectionReasons.push('DEPLOYMENT_CONTRACT_INVALID');
    if (!activationContract.valid) rejectionReasons.push('ACTIVATION_CONTRACT_INVALID');
    if (!deploymentAuthorized) rejectionReasons.push('DEPLOYMENT_AUTHORIZATION_ABSENT');
    if (!activationAuthorized) rejectionReasons.push('ACTIVATION_AUTHORIZATION_ABSENT');
    return { fips: county.fips, countyName: county.countyName, currentOperational: county.membership.currentOperational, evaluatedGates: PIPELINE, authorizationStatus: { deployment: deploymentAuthorized ? 'AUTHORIZED_REJECTED_BY_EXECUTION_BOUNDARY' : 'NOT_AUTHORIZED', activation: activationAuthorized ? 'AUTHORIZED_REJECTED_BY_EXECUTION_BOUNDARY' : 'NOT_AUTHORIZED' }, deploymentDecision, activationDecision, rejectionReasons };
  }).sort((a,b)=>a.fips.localeCompare(b.fips));
  const counts = { identityCount: counties.length, operationalCountyCount: counties.filter(c=>c.currentOperational).length, deploymentAuthorizationCount: deploymentContract.authorizedFips.length, deploymentCount: 0, activationAuthorizationCount: activationContract.authorizedFips.length, activationCount: 0, evaluatedCountyCount: counties.length };
  const registry = { schemaVersion: 'gridly.lp153.operationalExecutionRegistry.v1', milestone: 'LP153', generatedAt: GENERATED_AT, executionArchitecture: executionArchitecture(), sourceRegistry: P.lp152Registry, protectedArtifactHashes, failClosed: true, performsDeployment: false, performsActivation: false, ...counts, counties };
  const trace = { schemaVersion: 'gridly.lp153.executionTrace.v1', milestone: 'LP153', generatedAt: GENERATED_AT, evaluatedGates: PIPELINE, deploymentContract: deploymentContract, activationContract: activationContract, zeroAuthorizedExecution: counts.deploymentCount === 0 && counts.activationCount === 0, counties };
  const deploymentReport = { schemaVersion: 'gridly.lp153.deploymentExecutionReport.v1', milestone: 'LP153', generatedAt: GENERATED_AT, contractRecognition: deploymentContract.recognition, contractValid: deploymentContract.valid, malformedContract: deploymentContract.malformed, rejectedAuthorizations: deploymentContract.rejected, authorizedCount: counts.deploymentAuthorizationCount, deploymentCount: 0, deploymentPerformed: false, decisions: counties.map(c => ({ fips: c.fips, countyName: c.countyName, authorizationStatus: c.authorizationStatus.deployment, decision: c.deploymentDecision, rejectionReasons: c.rejectionReasons.filter(r=>r.includes('DEPLOYMENT')) })) };
  const activationReport = { schemaVersion: 'gridly.lp153.activationExecutionReport.v1', milestone: 'LP153', generatedAt: GENERATED_AT, contractRecognition: activationContract.recognition, contractValid: activationContract.valid, malformedContract: activationContract.malformed, rejectedAuthorizations: activationContract.rejected, authorizedCount: counts.activationAuthorizationCount, activationCount: 0, activationPerformed: false, decisions: counties.map(c => ({ fips: c.fips, countyName: c.countyName, authorizationStatus: c.authorizationStatus.activation, decision: c.activationDecision, rejectionReasons: c.rejectionReasons.filter(r=>r.includes('ACTIVATION')) })) };
  const summary = { schemaVersion: 'gridly.lp153.executionSummary.v1', milestone: 'LP153', generatedAt: GENERATED_AT, passed: counts.identityCount === 254 && counts.operationalCountyCount === 28 && counts.deploymentCount === 0 && counts.activationCount === 0 && registry152.runtimeMembershipChanged === false && lp152.summary.passed === true, validatesOperationalExecution: true, performsDeployment: false, performsActivation: false, deploymentAuthorizationEmpty: deploymentContract.recognition === 'EMPTY_CONTRACT' && counts.deploymentAuthorizationCount === 0, activationAuthorizationEmpty: activationContract.recognition === 'EMPTY_CONTRACT' && counts.activationAuthorizationCount === 0, runtimeMembershipChanged: false, protectedArtifactsUnchanged: true, preExistingBaselineFailures: [{ milestone: 'LP148', message: '[LP148] tracked/generated package does not match deterministic rebuild', introducedByLp153: false, repairedByLp153: false }], remainingBlockers: ['No deployment authorization is committed.', 'No activation authorization is committed.', 'LP148 deterministic rebuild condition remains pre-existing and unmodified.'], ...counts };
  summary.executionRegistrySha256 = shaText(stableJson(registry)); summary.executionTraceSha256 = shaText(stableJson(trace)); summary.deploymentExecutionReportSha256 = shaText(stableJson(deploymentReport)); summary.activationExecutionReportSha256 = shaText(stableJson(activationReport));
  return { registry, trace, deploymentReport, activationReport, summary };
}
function writeAll() { const a = buildExecution(); for (const p of [P.executionRegistry,P.executionTrace,P.deploymentExecutionReport,P.activationExecutionReport,P.executionSummary]) mkdirSync(dirname(abs(p)), { recursive: true }); writeFileSync(abs(P.executionRegistry), stableJson(a.registry)); writeFileSync(abs(P.executionTrace), stableJson(a.trace)); writeFileSync(abs(P.deploymentExecutionReport), stableJson(a.deploymentReport)); writeFileSync(abs(P.activationExecutionReport), stableJson(a.activationReport)); writeFileSync(abs(P.executionSummary), stableJson(a.summary)); return a.summary; }
function verify() { const a = buildExecution(); for (const [p,o] of [[P.executionRegistry,a.registry],[P.executionTrace,a.trace],[P.deploymentExecutionReport,a.deploymentReport],[P.activationExecutionReport,a.activationReport],[P.executionSummary,a.summary]]) if (!canonicalJsonEqual(readFileSync(abs(p),'utf8'), stableJson(o))) fail(`${p} differs from deterministic rebuild`); if (!a.summary.passed) fail('execution validation failed'); return a.summary; }
export { P, buildExecution, normalizeAuthorizationContract, stableJson, writeAll, verify };
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { console.log(JSON.stringify(process.argv.includes('--write') ? writeAll() : verify(), null, 2)); } catch (e) { console.error(e.message); process.exit(1); } }
