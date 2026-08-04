import { readFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const DOSSIER_SCHEMA = 'gridly-lp141-county-activation-evidence-dossier-v1';
export const SUMMARY_SCHEMA = 'gridly-lp141-activation-evidence-summary-v1';
export const ALLOWED_GATE_STATUSES = Object.freeze(['COMPLETE', 'INCOMPLETE', 'NOT_OBSERVED']);

const evidenceReferences = Object.freeze([
  'evidence/lp140/activation-wave-planning.json',
  'LP132-TEXAS-STATEWIDE-ACTIVATION-ROADMAP.md',
  'evidence/lp135/statewide-certification.json',
  'evidence/lp136/statewide-operational-readiness.json',
  'evidence/lp138/county-geometry-membership-contract.draft.json'
]);

const missingByGate = Object.freeze({
  3: 'GOVERNED_COMMUNITY_READINESS_EVIDENCE',
  4: 'GOVERNED_DESTINATION_READINESS_EVIDENCE',
  5: 'GOVERNED_CROSSING_READINESS_EVIDENCE',
  6: 'COUNTY_SPECIFIC_RUNTIME_REGRESSION_CONSUMER_AND_OPERATIONAL_VALIDATION',
  7: 'TIME_BOUNDED_PRODUCTION_APPROVAL'
});

const operationalPrerequisites = Object.freeze([
  'NAMED_OWNER_AND_ON_CALL_ACKNOWLEDGEMENT', 'DASHBOARDS_AND_ALERTS_ACKNOWLEDGEMENT',
  'RUNBOOK_ACKNOWLEDGEMENT', 'ROLLBACK_TRIGGER_PROCEDURE_AND_REHEARSAL_EVIDENCE',
  'SUPPORT_BRIEFING', 'OBSERVATION_WINDOW', 'INCIDENT_AUTHORITY'
]);
const deploymentPrerequisites = Object.freeze([
  'COMPLETE_GATES_1_THROUGH_6_DOSSIER', 'RISK_AND_EXCEPTION_REGISTER', 'PROPOSED_BATCH',
  'CHANGE_AND_ROLLBACK_PLAN', 'OBSERVATION_PLAN', 'ACCOUNTABLE_OWNERS',
  'GEOMETRY_MEMBERSHIP_APPROVAL', 'TIME_BOUNDED_PRODUCTION_APPROVAL'
]);

const translateGateStatus = status => ({ PASS: 'COMPLETE', BLOCKED: 'INCOMPLETE', NOT_EVALUATED: 'NOT_OBSERVED' }[status] ?? 'NOT_OBSERVED');

/** Pure transformation of authoritative LP140 and LP135 observations. */
export function manufactureActivationDossiers({ plan, certification }) {
  const certifications = new Map(certification.counties.map(row => [row.fips, row]));
  const counties = plan.counties.filter(row => row.readinessClass === 'CONDITIONALLY_READY')
    .sort((a, b) => a.fips.localeCompare(b.fips));
  if (new Set(counties.map(row => row.fips)).size !== counties.length) throw new Error('Duplicate conditionally-ready county FIPS');

  const dossiers = counties.map(county => {
    const cert = certifications.get(county.fips);
    if (!cert) throw new Error(`Missing certification identity for ${county.fips}`);
    const gates = county.gates.map(gate => ({
      gate: gate.gate, name: gate.name, status: translateGateStatus(gate.status),
      observedSourceStatus: gate.status,
      evidence: gate.gate === 1 ? ['evidence/lp130/final-reconciliation.json']
        : gate.gate === 2 ? [cert.evidenceReference, 'evidence/lp135/statewide-certification.json'] : []
    }));
    const missingEvidence = gates.filter(gate => gate.status !== 'COMPLETE')
      .map(gate => missingByGate[gate.gate]).filter(Boolean);
    if (!county.geometryMembershipEligible) missingEvidence.push('GEOMETRY_MEMBERSHIP_APPROVAL');
    if (county.operationalPrerequisites !== 'PASS') missingEvidence.push('COUNTY_OPERATIONAL_PREREQUISITES');
    if (county.deploymentPrerequisites !== 'PASS') missingEvidence.push('DEPLOYMENT_PREREQUISITES');
    return {
      schemaVersion: DOSSIER_SCHEMA, milestone: 'LP141', scope: 'GOVERNANCE_EVIDENCE_ONLY',
      authority: 'NON_AUTHORIZING',
      identity: {
        county: county.county, countyId: county.countyId, countyFips: county.fips,
        package: cert.packageIdentity,
        certification: { status: cert.certificationStatus, classification: cert.primaryClassification, evidenceReference: cert.evidenceReference }
      },
      lp132Gates: gates,
      missingEvidence,
      failedEvidence: [],
      unmetOperationalPrerequisites: county.operationalPrerequisites === 'PASS' ? [] : [...operationalPrerequisites],
      unmetDeploymentPrerequisites: county.deploymentPrerequisites === 'PASS' ? [] : [...deploymentPrerequisites],
      summaryClassification: 'WAITING_ON_GOVERNANCE_EVIDENCE',
      activationRecommendation: null,
      governingEvidence: [...evidenceReferences]
    };
  });

  const gateCounts = Object.fromEntries(Array.from({ length: 7 }, (_, index) => {
    const gate = index + 1;
    return [`gate${gate}`, Object.fromEntries(ALLOWED_GATE_STATUSES.map(status =>
      [status, dossiers.filter(row => row.lp132Gates[index].status === status).length]))];
  }));
  const frequencies = key => [...new Set(dossiers.flatMap(row => row[key]))].sort().map(item => ({
    item, countyCount: dossiers.filter(row => row[key].includes(item)).length
  }));
  const summary = {
    schemaVersion: SUMMARY_SCHEMA, milestone: 'LP141', scope: 'GOVERNANCE_EVIDENCE_ONLY',
    authority: 'NON_AUTHORIZING', ordering: 'ASCENDING_FIPS', totalCountiesProcessed: dossiers.length,
    countyFips: dossiers.map(row => row.identity.countyFips), gateCounts,
    commonMissingEvidence: frequencies('missingEvidence'), commonFailedEvidence: frequencies('failedEvidence'),
    summaryClassifications: [{ classification: 'WAITING_ON_GOVERNANCE_EVIDENCE', countyCount: dossiers.length }],
    governingEvidence: [...evidenceReferences]
  };
  return { dossiers, summary };
}

const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;

export async function writeActivationDossiers({ root, verify = false }) {
  const load = async path => JSON.parse(await readFile(new URL(path, root)));
  const result = manufactureActivationDossiers({
    plan: await load('evidence/lp140/activation-wave-planning.json'),
    certification: await load('evidence/lp135/statewide-certification.json')
  });
  const output = new URL('reports/lp141/', root);
  const expected = new Map(result.dossiers.map(row => [`county-${row.identity.countyFips}.json`, stableJson(row)]));
  expected.set('summary.json', stableJson(result.summary));
  if (verify) {
    const names = (await readdir(output)).sort();
    if (JSON.stringify(names) !== JSON.stringify([...expected.keys()].sort())) throw new Error('LP141 output file set differs');
    for (const [name, contents] of expected) if (await readFile(new URL(name, output), 'utf8') !== contents) throw new Error(`LP141 output differs: ${name}`);
    return result;
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const [name, contents] of expected) await writeFile(new URL(name, output), contents);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = new URL('../../', import.meta.url);
  const result = await writeActivationDossiers({ root, verify: process.argv.includes('--verify') });
  console.log(`${process.argv.includes('--verify') ? 'Verified' : 'Wrote'} ${result.dossiers.length} LP141 county dossiers.`);
}
