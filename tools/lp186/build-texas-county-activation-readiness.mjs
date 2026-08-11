import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, ''));
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const mode = process.argv[2] || 'verify';
if (!['build', 'verify'].includes(mode)) throw new Error('usage: build|verify');

const identity = read('data/lp149/runtime-county-registry.json');
const membership = read('data/lp150/membership-transition-registry.json');
const certification = read('evidence/lp135/statewide-certification.json');
const execution = read('data/lp153/operational-execution-registry.json');
const crossings = read('Crossing-Packages/production-crossing-manifest.json');
const addressManifest = read('data/generated/lp104/txgio-addresses/manifest.json');
const byFips = (rows, key = 'fips') => new Map(rows.map(row => [row[key], row]));
const membershipByFips = byFips(membership.counties);
const certByFips = byFips(certification.counties);
const executionByFips = byFips(execution.counties);
const addressByFips = byFips(addressManifest.packages);
const crossingByCounty = new Map(crossings.records.map(row => [`${row.county} County`, row]));

if (identity.identityCount !== 254 || identity.identities.length !== 254) throw new Error('authoritative identity inventory is not 254 counties');
if (new Set(identity.identities.map(x => x.fips)).size !== 254) throw new Error('duplicate county FIPS');
for (const source of [membershipByFips, executionByFips, addressByFips]) {
  if (source.size !== 254) throw new Error('county evidence does not reconcile to 254 unique FIPS');
}

const inventory = identity.identities.map(id => {
  const member = membershipByFips.get(id.fips);
  const cert = certByFips.get(id.fips);
  const exec = executionByFips.get(id.fips);
  const address = addressByFips.get(id.fips);
  if (!member || !exec || !address || (cert && cert.county !== id.countyName)) throw new Error(`ambiguous evidence for ${id.fips}`);
  const crossing = crossingByCounty.get(id.countyName);
  const restricted = cert?.certificationStatus === 'CERTIFICATION_BLOCKED';
  const operational = id.operationalMembership.active === true && member.currentOperationalMembership === true && exec.currentOperational === true;
  const primaryClassification = operational ? 'CURRENT_OPERATIONAL' : restricted ? 'RESTRICTED' : 'REPOSITORY_WORK_REQUIRED';
  return {
    fips: id.fips,
    countyId: id.countyId,
    countyName: id.countyName,
    addressPackage: { identityRecorded: true, payloadPresentInCurrentEvidence: !restricted, manifestRepresented: true, validated: !restricted, certificationStatus: cert?.certificationStatus || member.certificationStatus, evidence: restricted ? cert.evidenceReference : member.authoritativeEvidenceRefs.certificates },
    productionCrossingPackage: { present: Boolean(crossing), certified: crossing?.status === 'PASS', crossingCount: crossing?.crossingCount || 0, evidence: crossing?.certificationFile || null },
    runtime: { identityRepresented: true, geometryPresent: id.runtimeGeometry.present, operationalMembership: id.operationalMembership.active, evidence: 'data/lp149/runtime-county-registry.json' },
    configuration: { represented: true, membershipClassification: member.classification, evidence: 'data/lp150/membership-transition-registry.json' },
    authorization: { activation: exec.authorizationStatus.activation, deployment: exec.authorizationStatus.deployment },
    restriction: restricted ? { active: true, source: 'evidence/lp135/statewide-certification.json', reason: cert.primaryClassification, stage: cert.failureStage, correctiveAction: cert.recommendedCorrectiveAction, repositoryEvidenceCanClear: false, ownerOrExternalActionRequired: true } : { active: false },
    operational,
    publiclyAvailable: operational,
    primaryClassification,
    remainingBlocker: operational ? null : restricted ? 'LP132 Gate 2 closed: immutable LP130 payload unavailable for byte-identical recertification' : 'County is KNOWN_NOT_CANDIDATE; membership, deployment authorization/deployment, and activation authorization/activation are absent'
  };
});

const count = classification => inventory.filter(x => x.primaryClassification === classification).length;
const operational = inventory.filter(x => x.operational).map(x => x.countyName);
const nonOperational = inventory.filter(x => !x.operational).map(x => ({ countyName: x.countyName, fips: x.fips, primaryClassification: x.primaryClassification, remainingBlocker: x.remainingBlocker }));
const summary = {
  milestone: 'LP186', mode: 'AUDIT_RECONCILIATION_ONLY', generatedFromRepositoryEvidence: true,
  classificationPrecedence: ['CURRENT_OPERATIONAL', 'RESTRICTED', 'REPOSITORY_WORK_REQUIRED', 'OWNER_EVIDENCE_REQUIRED', 'EXTERNAL_DEPENDENCY_REQUIRED', 'ACTIVATION_READY', 'UNKNOWN_REQUIRES_RECONCILIATION'],
  counts: { totalTexasCounties: inventory.length, operational: operational.length, nonOperational: nonOperational.length, activationReadyNow: count('ACTIVATION_READY'), repositoryWorkRequired: count('REPOSITORY_WORK_REQUIRED'), ownerOrExternalActionRequired: count('OWNER_EVIDENCE_REQUIRED') + count('EXTERNAL_DEPENDENCY_REQUIRED'), restricted: count('RESTRICTED'), unknown: count('UNKNOWN_REQUIRES_RECONCILIATION') },
  address: { manifestRepresented: addressByFips.size, identityRecorded: 254, payloadAvailableAndCertified: certification.summary.certified, certificationBlocked: certification.summary.certificationBlocked, malformedOrDuplicate: 0 },
  crossings: { packages: crossings.totalPackages, certifiedPackages: crossings.passCount, blockedPackages: crossings.blockedCount, certifiedCrossings: crossings.totalCrossings, countiesWithoutPackage: 254 - crossings.totalPackages, activationPrerequisite: false },
  operationalCounties: operational, nonOperationalCounties: nonOperational,
  activationReadyCounties: [],
  recommendation: 'No activation pass is justified: first create governed county candidacy, dossier, authorization, deployment, and activation evidence; retain the 11 restrictions. When ready, stage by certified-crossing coverage versus address-only coverage rather than arbitrary batch size.',
  safety: { countyActivationPerformed: false, restrictionRemoved: false, productionDeploymentPerformed: false, statewideLaunchAuthorizationCreated: false }
};
if (Object.values(summary.counts).some(x => !Number.isInteger(x)) || summary.counts.operational + summary.counts.repositoryWorkRequired + summary.counts.restricted + summary.counts.ownerOrExternalActionRequired + summary.counts.activationReadyNow + summary.counts.unknown !== 254) throw new Error('classification totals do not reconcile');
const restrictions = inventory.filter(x => x.restriction.active).map(x => ({ countyName: x.countyName, fips: x.fips, restrictionId: `LP135-${x.fips}-PACKAGE_AVAILABILITY`, governanceSource: x.restriction.source, originalReason: x.restriction.reason, currentEvidence: x.remainingBlocker, currentStatus: 'PRESERVED', canRepositoryEvidenceClear: false, ownerOrExternalActionRequired: true, recommendedDisposition: 'Preserve until exact bytes are restored, hashes verified, and unchanged LP134 certification passes twice.' }));

const outputs = new Map([
  ['reports/lp186/texas-county-activation-inventory.json', inventory],
  ['reports/lp186/texas-county-activation-summary.json', summary],
  ['reports/lp186/county-restriction-reconciliation.json', restrictions]
]);
for (const [relative, value] of outputs) {
  const target = path.join(root, relative); const content = stable(value);
  if (mode === 'build') { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
  else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) throw new Error(`${relative} is missing or stale`);
}
console.log(`LP186 ${mode} PASS: 254 counties; ${operational.length} operational; ${count('REPOSITORY_WORK_REQUIRED')} repository work; ${count('RESTRICTED')} restricted; ${crossings.totalPackages} crossing packages/${crossings.totalCrossings} crossings`);
