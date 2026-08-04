import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deriveActivationWavePlan } from '../lp140/activation-wave-planner.mjs';

export const MATRIX_SCHEMA = 'gridly-lp142-activation-evidence-advancement-matrix-v1';
export const SUMMARY_SCHEMA = 'gridly-lp142-activation-evidence-advancement-summary-v1';
export const ADVANCEMENT_VOCABULARY = Object.freeze(['NO_CHANGE', 'ADVANCED', 'COMPLETE']);

const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Pure, fail-closed comparison of LP141 dossiers with the current authoritative
 * LP140 planner observations. An absent new observation can never advance a gate.
 */
export function auditActivationEvidence({ dossiers, previousPlan, currentPlan }) {
  const currentCounties = new Map(currentPlan.counties.map(row => [row.fips, row]));
  const previousCounties = new Map(previousPlan.counties.map(row => [row.fips, row]));
  const rows = [...dossiers].sort((a, b) => a.identity.countyFips.localeCompare(b.identity.countyFips)).map(dossier => {
    const fips = dossier.identity.countyFips;
    const previousCounty = previousCounties.get(fips);
    const currentCounty = currentCounties.get(fips);
    if (!previousCounty || !currentCounty) throw new Error(`Missing planner observation for ${fips}`);
    const gates = dossier.lp132Gates.map((previousGate, index) => {
      const currentGate = currentCounty.gates[index];
      const currentObservedState = ({ PASS: 'COMPLETE', BLOCKED: 'INCOMPLETE', NOT_EVALUATED: 'NOT_OBSERVED' })[currentGate?.status] ?? 'NOT_OBSERVED';
      const changed = currentObservedState !== previousGate.status;
      return {
        gate: previousGate.gate,
        name: previousGate.name,
        previousGateState: previousGate.status,
        currentObservedGateState: currentObservedState,
        advancement: changed ? (currentObservedState === 'COMPLETE' ? 'COMPLETE' : 'ADVANCED') : 'NO_CHANGE',
        evidenceSupportingAdvancement: changed ? [...(previousGate.evidence ?? [])] : []
      };
    });
    const activationEligible = gates.slice(0, 6).every(gate => gate.currentObservedGateState === 'COMPLETE') &&
      currentCounty.geometryMembershipEligible && currentCounty.operationalPrerequisites === 'PASS' &&
      currentCounty.deploymentPrerequisites === 'PASS';
    return {
      county: dossier.identity.county,
      fips,
      gates,
      remainingMissingEvidence: [...dossier.missingEvidence],
      remainingFailedEvidence: [...dossier.failedEvidence],
      activationEligible,
      activationRecommendation: null
    };
  });
  if (new Set(rows.map(row => row.fips)).size !== rows.length) throw new Error('Duplicate LP142 county FIPS');
  const matrix = {
    schemaVersion: MATRIX_SCHEMA,
    milestone: 'LP142',
    scope: 'AUDIT_ONLY',
    authority: 'NON_AUTHORIZING',
    ordering: 'ASCENDING_FIPS',
    counties: rows
  };
  const advanced = rows.filter(row => row.gates.some(gate => gate.advancement !== 'NO_CHANGE'));
  const countsByGate = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`gate${index + 1}`,
    Object.fromEntries(ADVANCEMENT_VOCABULARY.map(status => [status, rows.filter(row => row.gates[index].advancement === status).length]))]));
  const eligible = rows.filter(row => row.activationEligible).map(row => row.fips);
  const summary = {
    schemaVersion: SUMMARY_SCHEMA,
    milestone: 'LP142',
    scope: 'AUDIT_ONLY',
    authority: 'NON_AUTHORIZING',
    ordering: 'ASCENDING_FIPS',
    countiesAudited: rows.length,
    countyFips: rows.map(row => row.fips),
    countiesAdvancedAtLeastOneGate: advanced.length,
    countiesUnchanged: rows.length - advanced.length,
    advancementCountsByGate: countsByGate,
    remainingMissingEvidenceTotal: rows.reduce((sum, row) => sum + row.remainingMissingEvidence.length, 0),
    remainingFailedEvidenceTotal: rows.reduce((sum, row) => sum + row.remainingFailedEvidence.length, 0),
    activationEligibleCounties: eligible,
    activationEligibilityResult: eligible.length === 0 ? 'NO_COUNTY_ACTIVATION_ELIGIBLE' : 'OBSERVED_ELIGIBLE_COUNTIES_REQUIRE_SEPARATE_AUTHORIZATION',
    plannerValidation: {
      plannerLogicModified: false,
      outputChanged: stableJson(currentPlan) !== stableJson(previousPlan),
      statewideTotals: currentPlan.statewideTotals,
      waveCountyFips: currentPlan.waves.map(wave => ({ wave: wave.wave, countyFips: wave.members.map(row => row.fips) })),
      wave0RemainsEmpty: currentPlan.waves[0].members.length === 0
    },
    result: advanced.length === 0 ? 'NO_ADDITIONAL_OBSERVED_GOVERNANCE_EVIDENCE' : 'OBSERVED_EVIDENCE_ADVANCEMENT_RECORDED',
    activationPerformed: false
  };
  return { matrix, summary };
}

export async function writeActivationEvidenceAudit({ root, verify = false }) {
  const loadBytes = path => readFile(new URL(path, root));
  const load = async path => JSON.parse(await loadBytes(path));
  const dossierDirectory = new URL('reports/lp141/', root);
  const dossierNames = (await readdir(dossierDirectory)).filter(name => /^county-\d{5}\.json$/.test(name)).sort();
  const dossiers = await Promise.all(dossierNames.map(name => load(`reports/lp141/${name}`)));
  const [integrity, readiness, certification, operational, membershipDraft, previousPlan] = await Promise.all([
    load('evidence/lp130/final-reconciliation.json'), load('evidence/lp131/statewide-readiness-audit.json'),
    load('evidence/lp135/statewide-certification.json'), load('evidence/lp136/statewide-operational-readiness.json'),
    load('evidence/lp138/county-geometry-membership-contract.draft.json'), load('evidence/lp140/activation-wave-planning.json')
  ]);
  const currentPlan = deriveActivationWavePlan({ integrity, readiness, certification, operational, membershipDraft });
  const result = auditActivationEvidence({ dossiers, previousPlan: {
    counties: previousPlan.counties, waves: previousPlan.waves, statewideTotals: previousPlan.statewideTotals,
    blockerInventory: previousPlan.blockerInventory
  }, currentPlan });
  const output = new URL('reports/lp142/', root);
  const expected = new Map([['advancement-matrix.json', stableJson(result.matrix)], ['summary.json', stableJson(result.summary)]]);
  if (verify) {
    const names = (await readdir(output)).sort();
    if (JSON.stringify(names) !== JSON.stringify([...expected.keys()].sort())) throw new Error('LP142 output file set differs');
    for (const [name, contents] of expected) if (await readFile(new URL(name, output), 'utf8') !== contents) throw new Error(`LP142 output differs: ${name}`);
    return result;
  }
  await mkdir(output, { recursive: true });
  for (const [name, contents] of expected) await writeFile(new URL(name, output), contents);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await writeActivationEvidenceAudit({ root: new URL('../../', import.meta.url), verify: process.argv.includes('--verify') });
  console.log(`${process.argv.includes('--verify') ? 'Verified' : 'Wrote'} LP142 audit for ${result.summary.countiesAudited} counties.`);
}
