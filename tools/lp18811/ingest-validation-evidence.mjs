#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const WAVE = 'LP18810-NP-001';
export const EVIDENCE_SCHEMA = 'gridly.lp18811.protected-validation-evidence.v1';
export const PACKAGE_SCHEMA = 'gridly.community-package.identity.v1';
const DIMENSIONS = ['deployment','runtime','regression','consumer','boundary','telemetry','rollback','operational'];
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const read = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const truth = result => result === 'PASS';

export function ingest({ matrix, identities, evidenceDocuments = [] }) {
  if (matrix.records.length !== 215 || matrix.records.some((r, i, a) => i && a[i - 1].countyFips >= r.countyFips)) throw Error('governed scope must contain 215 unique ascending FIPS');
  const identityByFips = new Map(identities.packages.map(p => [p.countyFips, p]));
  const governed = new Map(matrix.records.map(r => [r.countyFips, r]));
  const supplied = new Map();
  for (const document of evidenceDocuments) {
    if (document.schemaVersion !== EVIDENCE_SCHEMA || document.waveId !== WAVE || document.environmentClassification !== 'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION' || document.productionDeployment === true || document.productionActivation === true || !Array.isArray(document.results)) throw Error('wrong evidence schema, wave, or protected non-production classification');
    for (const row of document.results) {
      if (!governed.has(row.countyFips)) throw Error(`unknown FIPS ${row.countyFips}`);
      if (supplied.has(row.countyFips)) throw Error(`duplicate evidence ${row.countyFips}`);
      const expected = identityByFips.get(row.countyFips);
      if (!expected || row.packageSha256 !== expected.sha256) throw Error(`wrong SHA-256 ${row.countyFips}`);
      if (row.schemaVersion !== expected.schemaVersion || row.schemaVersion !== PACKAGE_SCHEMA) throw Error(`wrong package schema ${row.countyFips}`);
      if (!['ATTEMPTED','FAILED'].includes(row.executionStatus)) throw Error(`wrong execution status ${row.countyFips}`);
      for (const dimension of DIMENSIONS) {
        if (!['PASS','FAIL','NOT_RUN'].includes(row[`${dimension}Result`])) throw Error(`missing or invalid ${dimension} evidence ${row.countyFips}`);
        if (row[`${dimension}Result`] !== 'NOT_RUN' && (!row.evidenceReferences || typeof row.evidenceReferences[dimension] !== 'string' || !row.evidenceReferences[dimension].trim() || path.isAbsolute(row.evidenceReferences[dimension]))) throw Error(`missing portable ${dimension} evidence reference ${row.countyFips}`);
      }
      if (!row.executor || !['PRESENT','ABSENT'].includes(row.executor.status) || !row.independentReview || !['COMPLETE','PENDING','REJECTED'].includes(row.independentReview.status)) throw Error(`missing executor or review evidence ${row.countyFips}`);
      if (row.executor.status === 'PRESENT' && !row.executor.identityReference?.trim()) throw Error(`missing executor identity reference ${row.countyFips}`);
      if (row.independentReview.status === 'COMPLETE' && !row.independentReview.reviewerReference?.trim()) throw Error(`missing independent reviewer reference ${row.countyFips}`);
      if (DIMENSIONS.slice(1).some(d => truth(row[`${d}Result`])) && !truth(row.deploymentResult)) throw Error(`contradictory evidence ${row.countyFips}`);
      if (truth(row.operationalResult) && DIMENSIONS.slice(0, -1).some(d => !truth(row[`${d}Result`]))) throw Error(`contradictory operational PASS ${row.countyFips}`);
      supplied.set(row.countyFips, row);
    }
  }
  const records = matrix.records.map(base => {
    if (base.ownerMembershipDecision !== 'OWNER_APPROVED' || base.nonProductionExecutionAuthorization !== 'AUTHORIZED_NOT_EXECUTED') throw Error(`authorization absent ${base.countyFips}`);
    const id = identityByFips.get(base.countyFips), row = supplied.get(base.countyFips);
    if (!id || id.sha256 !== base.packageSha256) throw Error(`governed package identity mismatch ${base.countyFips}`);
    const values = Object.fromEntries(DIMENSIONS.map(d => [d, row ? truth(row[`${d}Result`]) : false]));
    const executor = row?.executor.status === 'PRESENT', review = row?.independentReview.status === 'COMPLETE';
    const eligible = DIMENSIONS.every(d => values[d]) && executor && review;
    const blockers = [];
    if (!row) blockers.push('EXTERNAL_PROTECTED_VALIDATION_EXECUTION_EVIDENCE_ABSENT');
    else {
      for (const d of DIMENSIONS) if (!values[d]) blockers.push(`${d.toUpperCase()}_VALIDATION_${row[`${d}Result`]}`);
      if (!executor) blockers.push('EXECUTOR_IDENTITY_EVIDENCE_ABSENT');
      if (!review) blockers.push('INDEPENDENT_REVIEW_INCOMPLETE');
    }
    blockers.push('FINAL_ACTIVATION_OWNER_AUTHORIZATION_ABSENT');
    return { countyFips: base.countyFips, countyName: base.countyName, packageSha256: id.sha256, schemaVersion: id.schemaVersion,
      membershipApproved: true, deploymentPrepared: true, executionAuthorized: true, executionStatus: row?.executionStatus ?? 'PENDING',
      deploymentConfirmed: values.deployment, runtimeValidated: values.runtime, regressionValidated: values.regression, consumerValidated: values.consumer, boundaryValidated: values.boundary, telemetryValidated: values.telemetry, rollbackValidated: values.rollback, operationallyValidated: values.operational,
      executorEvidenceStatus: executor ? 'PRESENT' : 'ABSENT', independentReviewStatus: row?.independentReview.status ?? 'PENDING', structuralActivationEligibility: eligible,
      finalActivationAuthorizationStatus: 'REQUIRED_NOT_AUTHORIZED', activationStatus: 'NOT_ACTIVATED', blockingReasons: blockers,
      nextRequiredAction: eligible ? 'OBTAIN_SEPARATE_FINAL_OWNER_ACTIVATION_AUTHORIZATION' : row ? 'REMEDIATE_FAILED_OR_INCOMPLETE_NON_PRODUCTION_EVIDENCE_AND_REINGEST' : 'EXECUTE_LP18810_NP_001_IN_OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION_ENVIRONMENT_AND_INGEST_EVIDENCE' };
  });
  const count = key => records.filter(r => r[key]).length;
  const attempted = records.filter(r => r.executionStatus !== 'PENDING').length, failures = records.filter(r => r.executionStatus === 'FAILED').length, eligible = count('structuralActivationEligibility');
  const classification = attempted === 0 ? 'AUTHORIZED_NON_PRODUCTION_EXECUTION_PENDING_EXTERNAL_EVIDENCE' : eligible === 215 ? 'PASS_NON_PRODUCTION_VALIDATION_COMPLETE_215_STRUCTURALLY_ACTIVATION_ELIGIBLE_FINAL_OWNER_AUTHORIZATION_REQUIRED' : 'PARTIAL_NON_PRODUCTION_VALIDATION_EVIDENCE_INGESTED_REMEDIATION_AND_FINAL_OWNER_AUTHORIZATION_REQUIRED';
  return { matrix: { schemaVersion: 'gridly.lp18811.county-validation-matrix.v1', milestone: 'LP188.11', waveId: WAVE, records }, summary: {
    schemaVersion: 'gridly.lp18811.summary.v1', milestone: 'LP188.11', waveId: WAVE, environmentClassification: 'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION', targetCountyCount: 215, executionAuthorizedCount: 215, executionAttemptedCount: attempted, executionPendingCount: 215 - attempted, executionFailureCount: failures,
    deploymentConfirmedCount: count('deploymentConfirmed'), runtimeValidatedCount: count('runtimeValidated'), regressionValidatedCount: count('regressionValidated'), consumerValidatedCount: count('consumerValidated'), boundaryValidatedCount: count('boundaryValidated'), telemetryValidatedCount: count('telemetryValidated'), rollbackValidatedCount: count('rollbackValidated'), operationallyValidatedCount: count('operationallyValidated'), independentReviewCompleteCount: records.filter(r => r.independentReviewStatus === 'COMPLETE').length, structurallyActivationEligibleCount: eligible, finalActivationAuthorizationRequiredCount: 215, potentialOperationalCountAfterSeparateAuthorizationAndActivation: 28 + eligible, currentOperationalCount: 28, restrictedCountyCount: 11, newActivatedCount: 0, runtimeOperationalCountChanged: false, restrictedCountyStateChanged: false, overallClassification: classification, nextMilestone: attempted === 0 ? 'OWNER_EXECUTE_LP18810_NP_001_AND_RETURN_PORTABLE_EVIDENCE' : eligible < 215 ? 'LP188_11_EVIDENCE_REMEDIATION_AND_REINGESTION' : 'SEPARATE_FINAL_OWNER_ACTIVATION_AUTHORIZATION' } };
}

export function build(root = ROOT) {
  const dir = path.join(root, 'evidence/lp18811/execution-results');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'template.json').sort() : [];
  return ingest({ matrix: read(root, 'reports/lp18810/county-membership-validation-matrix.json'), identities: read(root, 'reports/lp1885/community-package-identity-inventory.json'), evidenceDocuments: files.map(f => read(root, `evidence/lp18811/execution-results/${f}`)) });
}
const outputs = { 'county-validation-matrix.json': 'matrix', 'lp18811-summary.json': 'summary' };
export function write(root = ROOT, out = path.join(root, 'reports/lp18811')) { const made = build(root); fs.mkdirSync(out, { recursive: true }); for (const [f,k] of Object.entries(outputs)) fs.writeFileSync(path.join(out,f), stableJson(made[k])); return made; }
export function verify(root = ROOT) { const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'lp18811-')); try { for (const d of ['a','b']) write(root,path.join(tmp,d)); for (const f of Object.keys(outputs)) for (const d of ['a','b']) if (!fs.readFileSync(path.join(root,'reports/lp18811',f)).equals(fs.readFileSync(path.join(tmp,d,f)))) throw Error(`LP188.11 deterministic evidence mismatch: ${f}`); } finally { fs.rmSync(tmp,{recursive:true,force:true}); } }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const mode=process.argv[2]; if(mode==='build') write(); else if(mode==='verify') verify(); else throw Error('usage: <build|verify>'); process.stdout.write(stableJson(build().summary)); }
