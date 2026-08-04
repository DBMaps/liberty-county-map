import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deriveActivationWavePlan } from '../lp140/activation-wave-planner.mjs';

export const AUTHORIZATION_SCHEMA = 'gridly-lp144-operational-authorization-v1';
const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const approvalRequirement = 'EXPLICIT_OPERATIONAL_AUTHORIZATION';

const plannerInputs = async root => ({
  readiness: JSON.parse(await readFile(new URL('evidence/lp131/statewide-readiness-audit.json', root))),
  certification: JSON.parse(await readFile(new URL('evidence/lp135/statewide-certification.json', root))),
  integrity: JSON.parse(await readFile(new URL('evidence/lp130/final-reconciliation.json', root))),
  operational: JSON.parse(await readFile(new URL('evidence/lp136/statewide-operational-readiness.json', root))),
  membershipDraft: JSON.parse(await readFile(new URL('evidence/lp138/county-geometry-membership-contract.draft.json', root)))
});

export function manufactureOperationalAuthorizations({ templates, advancement }) {
  const observed = new Map(advancement.counties.map(row => [row.fips, row]));
  if (observed.size !== advancement.counties.length) throw new Error('Duplicate LP142 county FIPS');
  const records = templates.sort((a, b) => a.fips.localeCompare(b.fips)).map(template => {
    const audit = observed.get(template.fips);
    if (!audit) throw new Error(`Missing LP142 evidence for ${template.fips}`);
    const gateEvaluations = audit.gates.map(gate => ({
      requirement: `LP132_GATE_${gate.gate}_${gate.name.toUpperCase().replaceAll(' ', '_')}`,
      satisfied: gate.currentObservedGateState === 'COMPLETE',
      evidenceReference: `reports/lp142/advancement-matrix.json#/counties/${advancement.counties.findIndex(row => row.fips === template.fips)}/gates/${gate.gate - 1}`
    }));
    const remainingEvidence = [...audit.remainingMissingEvidence, ...audit.remainingFailedEvidence].sort();
    const objectiveComplete = gateEvaluations.slice(0, 6).every(row => row.satisfied) &&
      remainingEvidence.filter(item => item !== 'TIME_BOUNDED_PRODUCTION_APPROVAL').length === 0;
    const operationalAuthorizationState = !objectiveComplete ? 'NOT_READY'
      : template.operationalApproval === null ? 'PENDING_APPROVAL' : 'AUTHORIZATION_READY';
    const prerequisiteEvaluation = [
      ...gateEvaluations,
      ...remainingEvidence.map(requirement => ({ requirement, satisfied: false, evidenceReference: `reports/lp142/advancement-matrix.json#/counties/${advancement.counties.findIndex(row => row.fips === template.fips)}/remainingMissingEvidence` })),
      { requirement: approvalRequirement, satisfied: false, evidenceReference: `reports/lp143/templates/county-${template.fips}.json#/operationalApproval` }
    ];
    return {
      county: template.county, FIPS: template.fips, authorizationId: `LP144-TX-${template.fips}-V1`, authorizationVersion: 1,
      operationalAuthorizationState, prerequisiteEvaluation,
      satisfiedRequirements: prerequisiteEvaluation.filter(row => row.satisfied).map(row => row.requirement).sort(),
      remainingRequirements: prerequisiteEvaluation.filter(row => !row.satisfied).map(row => row.requirement).sort(),
      evidenceReferences: [`reports/lp142/advancement-matrix.json`, `reports/lp143/templates/county-${template.fips}.json`],
      authorizationAuthority: null, authorizationTimestamp: null, activationAuthorization: null, runtimeActivation: false
    };
  });
  if (new Set(records.map(row => row.FIPS)).size !== records.length) throw new Error('Duplicate LP144 county FIPS');
  return records;
}

export async function writeOperationalAuthorizations({ root, verify = false }) {
  const names = (await readdir(new URL('reports/lp143/templates/', root))).filter(name => /^county-\d{5}\.json$/.test(name)).sort();
  const templates = await Promise.all(names.map(async name => JSON.parse(await readFile(new URL(`reports/lp143/templates/${name}`, root)))));
  const advancement = JSON.parse(await readFile(new URL('reports/lp142/advancement-matrix.json', root)));
  const records = manufactureOperationalAuthorizations({ templates, advancement });
  const inputs = await plannerInputs(root);
  const baseline = deriveActivationWavePlan(inputs);
  const plannerRegistry = { authorizations: records.map(row => ({
    fips: row.FIPS,
    authorizationStatus: row.activationAuthorization === null ? 'NOT_AUTHORIZED' : row.activationAuthorization,
    operationalAuthorizationState: row.operationalAuthorizationState
  })) };
  const planner = deriveActivationWavePlan({ ...inputs, authorizationRegistry: plannerRegistry });
  const states = ['NOT_READY', 'PENDING_APPROVAL', 'AUTHORIZATION_READY'];
  const allRequirements = [...new Set(records.flatMap(row => row.satisfiedRequirements))].sort();
  const remainingCounts = new Map();
  for (const requirement of records.flatMap(row => row.remainingRequirements)) remainingCounts.set(requirement, (remainingCounts.get(requirement) ?? 0) + 1);
  const registry = { schemaVersion: AUTHORIZATION_SCHEMA, milestone: 'LP144', scope: 'GOVERNANCE_ONLY', authority: 'NON_AUTHORIZING', ordering: 'ASCENDING_FIPS', authorizations: records };
  const summary = {
    schemaVersion: 'gridly-lp144-operational-authorization-summary-v1', milestone: 'LP144', scope: 'GOVERNANCE_ONLY', authority: 'NON_AUTHORIZING',
    countiesEvaluated: records.length,
    authorizationStateCounts: Object.fromEntries(states.map(state => [state, records.filter(row => row.operationalAuthorizationState === state).length])),
    commonRemainingRequirements: [...remainingCounts].sort((a, b) => a[0].localeCompare(b[0])).map(([requirement, countyCount]) => ({ requirement, countyCount })),
    satisfiedRequirementTotals: Object.fromEntries(allRequirements.map(requirement => [requirement, records.filter(row => row.satisfiedRequirements.includes(requirement)).length])),
    deterministicFipsOrdering: records.map(row => row.FIPS),
    plannerValidation: {
      authorizationStatesRecognized: records.every(row => states.includes(row.operationalAuthorizationState)), plannerLogicModified: false,
      outputUnchanged: JSON.stringify(planner) === JSON.stringify(baseline), wave0RemainsEmpty: planner.waves[0].members.length === 0,
      waveCountyFips: planner.waves.map(row => ({ wave: row.wave, countyFips: row.members.map(member => member.fips) })),
      activationPerformed: false, runtimeMembershipChanged: false
    }
  };
  const expected = new Map([['operational-authorizations.json', stableJson(registry)], ['summary.json', stableJson(summary)]]);
  const output = new URL('reports/lp144/', root);
  if (verify) {
    const actualNames = (await readdir(output)).sort();
    if (JSON.stringify(actualNames) !== JSON.stringify([...expected.keys()].sort())) throw new Error('LP144 output file set differs');
    for (const [name, contents] of expected) if (await readFile(new URL(name, output), 'utf8') !== contents) throw new Error(`LP144 output differs: ${name}`);
  } else {
    await mkdir(output, { recursive: true });
    for (const [name, contents] of expected) await writeFile(new URL(name, output), contents);
  }
  return { records, summary, planner };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verify = process.argv.includes('--verify');
  const result = await writeOperationalAuthorizations({ root: new URL('../../', import.meta.url), verify });
  console.log(`${verify ? 'Verified' : 'Wrote'} ${result.records.length} LP144 operational authorization records; Wave 0 has ${result.planner.waves[0].members.length} counties.`);
}
