#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildValidation, canonicalJsonEqual, protectedHashes, gitBlobBytes } from '../lp151/validate-statewide-operations.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const P = {
  lp138Baseline: 'evidence/lp138/county-geometry-membership-contract.baseline.json',
  lp140Planner: 'tools/lp140/activation-wave-planner.mjs',
  lp148Package: 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json',
  lp148Manifest: 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json',
  lp149Registry: 'data/lp149/runtime-county-registry.json',
  lp150Transition: 'data/lp150/membership-transition-registry.json',
  lp151Registry: 'data/lp151/statewide-operational-validation-registry.json',
  lp151Summary: 'reports/lp151/validation-summary.json',
  registry: 'data/lp152/operational-enablement-registry.json',
  deploymentAuthorization: 'reports/lp152/deployment-authorization-report.json',
  activationAuthorization: 'reports/lp152/activation-authorization-report.json',
  gates: 'reports/lp152/operational-gate-report.json',
  blockers: 'reports/lp152/blocker-inventory.json',
  summary: 'reports/lp152/operational-enablement-summary.json'
};

function abs(path) { return resolve(ROOT, path); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}
function stableJson(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function fail(message) { throw new Error(`[LP152] ${message}`); }
function shaText(text) { return createHash('sha256').update(text).digest('hex'); }
function shaGit(path) { return createHash('sha256').update(gitBlobBytes(path)).digest('hex'); }
function gate(name, passed, details = {}) { return { name, passed: Boolean(passed), details }; }

function operationalPipeline() {
  return [
    { stage: 'Manufacturing', governedInputs: ['LP130 statewide package hashes'], outputs: ['county package identity'], boundary: 'package evidence only', protectedSystems: ['runtime selection'], failClosedTransition: 'missing package blocks certification/storage/geometry readiness' },
    { stage: 'Certification', governedInputs: ['LP133-LP135 certificates', 'LP151 certification reconciliation'], outputs: ['certificate availability state'], boundary: 'certificate evidence only', protectedSystems: ['alert generation', 'awareness filtering'], failClosedTransition: 'missing certificate blocks storage and deployment authorization gates' },
    { stage: 'Storage', governedInputs: ['LP147 publication evidence', 'LP149 package/certificate references'], outputs: ['storage readiness state'], boundary: 'read-only publication reconciliation', protectedSystems: ['Supabase synchronization', 'production storage writes'], failClosedTransition: 'storage evidence gaps block geometry-to-identity advancement' },
    { stage: 'Geometry', governedInputs: ['LP138 contract', 'LP148 geometry package and manifest'], outputs: ['runtime geometry readiness'], boundary: 'canonical Git-blob validation only', protectedSystems: ['runtime geometry', 'address lookup', 'business search'], failClosedTransition: 'geometry gaps block runtime identity readiness' },
    { stage: 'Identity', governedInputs: ['LP149 runtime identity registry'], outputs: ['254 represented identities'], boundary: 'identity does not imply membership', protectedSystems: ['runtime selection'], failClosedTransition: 'identity gaps block membership validation' },
    { stage: 'Membership', governedInputs: ['LP138 baseline', 'LP150 transition registry'], outputs: ['28 current operational counties, zero candidate/approved/deployed/active transitions'], boundary: 'membership does not imply validation or authorization', protectedSystems: ['runtime membership', 'planner'], failClosedTransition: 'membership drift blocks operational validation' },
    { stage: 'Operational Validation', governedInputs: ['LP151 validation artifacts'], outputs: ['statewide validation state'], boundary: 'read-only validation', protectedSystems: ['Route Watch', 'Shared Reports', 'Hazard Lifecycle'], failClosedTransition: 'validation failure blocks deployment authorization modeling' },
    { stage: 'Deployment Authorization', governedInputs: ['explicit future authorization artifact only'], outputs: ['NOT_AUTHORIZED for all counties'], boundary: 'authorization is never inferred', protectedSystems: ['deployment execution'], failClosedTransition: 'absent authorization blocks deployment readiness' },
    { stage: 'Deployment', governedInputs: ['deployment authorization state'], outputs: ['zero deployed counties'], boundary: 'LP152 does not deploy', protectedSystems: ['runtime behavior'], failClosedTransition: 'not deployed blocks activation authorization advancement' },
    { stage: 'Activation Authorization', governedInputs: ['explicit future authorization artifact only', 'LP140 planner as reference'], outputs: ['NOT_AUTHORIZED for all counties'], boundary: 'activation authorization is separate from deployment authorization', protectedSystems: ['activation logic', 'planner'], failClosedTransition: 'absent authorization blocks activation' },
    { stage: 'Activation', governedInputs: ['activation authorization state'], outputs: ['zero active counties'], boundary: 'LP152 does not activate', protectedSystems: ['consumer runtime'], failClosedTransition: 'not active remains fail-closed' }
  ];
}

function buildArtifacts() {
  const lp151 = buildValidation();
  const id = readJson(P.lp149Registry);
  const transition = readJson(P.lp150Transition);
  const lp151Summary = readJson(P.lp151Summary);
  const hashes = {
    ...protectedHashes(),
    lp151Registry: shaGit(P.lp151Registry),
    lp151Summary: shaGit(P.lp151Summary)
  };

  const counties = id.identities.map((county) => {
    const t = transition.counties.find((row) => row.fips === county.fips);
    const certificateReady = county.certificateAvailability.available === true;
    const storageReady = county.packageIdentity.recognized === true && county.certificateAvailability.certificateRefs.length > 0;
    const geometryReady = county.runtimeGeometry.present === true;
    const currentOperational = t?.currentOperationalMembership === true;
    const operationalValidationReady = certificateReady && storageReady && geometryReady && currentOperational;
    const blockers = [];
    if (!certificateReady) blockers.push('CERTIFICATION_BLOCKED');
    if (!storageReady) blockers.push('STORAGE_EVIDENCE_BLOCKED');
    if (!geometryReady) blockers.push('GEOMETRY_BLOCKED');
    if (!currentOperational) blockers.push('MEMBERSHIP_NOT_OPERATIONAL');
    blockers.push('DEPLOYMENT_AUTHORIZATION_ABSENT', 'NOT_DEPLOYED', 'ACTIVATION_AUTHORIZATION_ABSENT', 'NOT_ACTIVE');
    return {
      fips: county.fips,
      countyId: county.countyId,
      countyName: county.countyName,
      identity: { represented: true, source: P.lp149Registry },
      certification: { state: certificateReady ? 'READY' : 'BLOCKED', certificateRefs: county.certificateAvailability.certificateRefs },
      storage: { state: storageReady ? 'READY' : 'BLOCKED', source: 'LP147/LP149 evidence' },
      geometry: { state: geometryReady ? 'READY' : 'BLOCKED', source: P.lp148Manifest },
      membership: { state: currentOperational ? 'CURRENT_OPERATIONAL' : 'NOT_OPERATIONAL_MEMBER', currentOperational, candidate: false, approved: false },
      operationalValidation: { state: operationalValidationReady ? 'VALIDATED' : 'BLOCKED' },
      deploymentAuthorization: { state: 'NOT_AUTHORIZED', inferred: false, explicitAuthorizationPresent: false },
      deploymentReadiness: { state: operationalValidationReady ? 'READY_PENDING_AUTHORIZATION' : 'BLOCKED', authorizationRequired: true },
      deployment: { state: 'NOT_DEPLOYED', deployed: false, inferred: false },
      activationAuthorization: { state: 'NOT_AUTHORIZED', inferred: false, explicitAuthorizationPresent: false, plannerReference: P.lp140Planner },
      activationReadiness: { state: 'BLOCKED', reason: 'DEPLOYMENT_AND_ACTIVATION_AUTHORIZATION_REQUIRED' },
      activation: { state: 'NOT_ACTIVE', active: false, inferred: false },
      operationalBlockers: blockers
    };
  }).sort((a, b) => a.fips.localeCompare(b.fips));

  const counts = {
    identityCount: counties.length,
    operationalCountyCount: counties.filter((c) => c.membership.currentOperational).length,
    deploymentAuthorizationCount: counties.filter((c) => c.deploymentAuthorization.state === 'AUTHORIZED').length,
    deploymentCount: counties.filter((c) => c.deployment.deployed).length,
    activationAuthorizationCount: counties.filter((c) => c.activationAuthorization.state === 'AUTHORIZED').length,
    activationCount: counties.filter((c) => c.activation.active).length,
    readyPendingDeploymentAuthorizationCount: counties.filter((c) => c.deploymentReadiness.state === 'READY_PENDING_AUTHORIZATION').length,
    activationReadyCount: counties.filter((c) => c.activationReadiness.state === 'READY').length,
    blockedCount: counties.filter((c) => c.operationalBlockers.length > 0).length
  };

  const sourceGates = lp151.report.gates;
  const gateDefs = [
    gate('Manufacturing', sourceGates.find((g) => g.name === 'Manufacturing')?.passed, { source: 'LP151' }),
    gate('Certification', sourceGates.find((g) => g.name === 'Certification')?.passed, { source: 'LP151' }),
    gate('Storage', sourceGates.find((g) => g.name === 'Storage')?.passed, { source: 'LP151' }),
    gate('Geometry', sourceGates.find((g) => g.name === 'Geometry')?.passed, { source: 'LP151' }),
    gate('Identity', counts.identityCount === 254, { identityCount: counts.identityCount }),
    gate('Membership', counts.operationalCountyCount === 28 && counts.deploymentCount === 0 && counts.activationCount === 0, { operationalCountyCount: counts.operationalCountyCount, deploymentCount: counts.deploymentCount, activationCount: counts.activationCount }),
    gate('Operational Validation', lp151Summary.passed === true, { source: P.lp151Summary }),
    gate('Deployment Authorization', counts.deploymentAuthorizationCount === 0, { state: 'NOT_AUTHORIZED', authorizedCount: 0, inferredAuthorizationAllowed: false }),
    gate('Deployment', counts.deploymentCount === 0, { state: 'NOT_DEPLOYED', deployedCount: 0, deploymentPerformed: false }),
    gate('Activation Authorization', counts.activationAuthorizationCount === 0, { state: 'NOT_AUTHORIZED', authorizedCount: 0, inferredAuthorizationAllowed: false }),
    gate('Activation', counts.activationCount === 0, { state: 'NOT_ACTIVE', activationCount: 0, activationPerformed: false })
  ];
  let closed = false;
  const gates = gateDefs.map((g) => {
    const blockedByPriorFailure = closed;
    const passed = !blockedByPriorFailure && g.passed;
    if (!passed) closed = true;
    return { ...g, passed, blockedByPriorFailure };
  });

  const blockerInventory = Object.entries(counties.flatMap((county) => county.operationalBlockers.map((blocker) => [blocker, county.fips])).reduce((out, [blocker, fips]) => { (out[blocker] ??= []).push(fips); return out; }, {}))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([blocker, fips]) => ({ blocker, count: fips.length, fips }));

  const registry = { schemaVersion: 'gridly.lp152.operationalEnablementRegistry.v1', milestone: 'LP152', generatedAt: GENERATED_AT, sort: 'ascending-fips', nonDeploying: true, nonActivating: true, operationalPipeline: operationalPipeline(), protectedArtifactHashes: hashes, ...counts, runtimeMembershipChanged: false, deploymentOccurred: false, activationOccurred: false, counties };
  const deploymentAuthorization = { schemaVersion: 'gridly.lp152.deploymentAuthorizationReport.v1', milestone: 'LP152', generatedAt: GENERATED_AT, model: { states: ['NOT_AUTHORIZED', 'AUTHORIZED', 'DEPLOYED'], authorizationMustBeExplicit: true, authorizationMayBeInferred: false, deploymentMayBeInferred: false }, authorizedCount: counts.deploymentAuthorizationCount, deployedCount: counts.deploymentCount, authorizations: [], deployments: [], counties: counties.map((c) => ({ fips: c.fips, countyName: c.countyName, authorizationState: c.deploymentAuthorization.state, deploymentState: c.deployment.state })) };
  const activationAuthorization = { schemaVersion: 'gridly.lp152.activationAuthorizationReport.v1', milestone: 'LP152', generatedAt: GENERATED_AT, model: { states: ['NOT_AUTHORIZED', 'AUTHORIZED', 'ACTIVE'], authorizationMustBeExplicit: true, authorizationMayBeInferred: false, activationMayBeInferred: false, plannerReference: P.lp140Planner }, authorizedCount: counts.activationAuthorizationCount, activeCount: counts.activationCount, authorizations: [], activations: [], counties: counties.map((c) => ({ fips: c.fips, countyName: c.countyName, authorizationState: c.activationAuthorization.state, activationState: c.activation.state })) };
  const gateReport = { schemaVersion: 'gridly.lp152.operationalGateReport.v1', milestone: 'LP152', generatedAt: GENERATED_AT, protectedArtifactHashes: hashes, gates, failClosed: true, readOnlyValidationOnly: true };
  const blockers = { schemaVersion: 'gridly.lp152.blockerInventory.v1', milestone: 'LP152', generatedAt: GENERATED_AT, blockerInventory };
  const summary = { schemaVersion: 'gridly.lp152.operationalEnablementSummary.v1', milestone: 'LP152', generatedAt: GENERATED_AT, passed: gates.every((g) => g.passed), registrySha256: shaText(stableJson(registry)), deploymentAuthorizationReportSha256: shaText(stableJson(deploymentAuthorization)), activationAuthorizationReportSha256: shaText(stableJson(activationAuthorization)), gateReportSha256: shaText(stableJson(gateReport)), blockerInventorySha256: shaText(stableJson(blockers)), ...counts, runtimeMembershipChanged: false, deploymentAuthorizationPresent: false, deploymentOccurred: false, activationAuthorizationPresent: false, activationOccurred: false, remainingBlockers: blockerInventory.map((b) => ({ blocker: b.blocker, count: b.count })), preExistingBaselineFailures: [{ milestone: 'LP148', message: '[LP148] tracked/generated package does not match deterministic rebuild', introducedByLp152: false, repairedByLp152: false }] };
  return { registry, deploymentAuthorization, activationAuthorization, gateReport, blockers, summary };
}

function writeAll() {
  const artifacts = buildArtifacts();
  for (const path of [P.registry, P.deploymentAuthorization, P.activationAuthorization, P.gates, P.blockers, P.summary]) mkdirSync(dirname(abs(path)), { recursive: true });
  writeFileSync(abs(P.registry), stableJson(artifacts.registry));
  writeFileSync(abs(P.deploymentAuthorization), stableJson(artifacts.deploymentAuthorization));
  writeFileSync(abs(P.activationAuthorization), stableJson(artifacts.activationAuthorization));
  writeFileSync(abs(P.gates), stableJson(artifacts.gateReport));
  writeFileSync(abs(P.blockers), stableJson(artifacts.blockers));
  writeFileSync(abs(P.summary), stableJson(artifacts.summary));
  return artifacts.summary;
}
function verify() {
  const artifacts = buildArtifacts();
  for (const [path, object] of [[P.registry, artifacts.registry], [P.deploymentAuthorization, artifacts.deploymentAuthorization], [P.activationAuthorization, artifacts.activationAuthorization], [P.gates, artifacts.gateReport], [P.blockers, artifacts.blockers], [P.summary, artifacts.summary]]) {
    if (!canonicalJsonEqual(readFileSync(abs(path), 'utf8'), stableJson(object))) fail(`${path} differs from deterministic rebuild`);
  }
  if (!artifacts.summary.passed) fail('operational enablement gates failed');
  return artifacts.summary;
}

export { buildArtifacts, writeAll, verify, stableJson, P };
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = process.argv.includes('--write') ? writeAll() : verify();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
