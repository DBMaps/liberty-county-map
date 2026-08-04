const WAVE_PURPOSES = Object.freeze([
  'Production control (no new activation)',
  'Near-ready validation',
  'Bounded-gap readiness',
  'Community and coverage expansion',
  'Statewide completion'
]);

const evidenceRefs = Object.freeze([
  'evidence/lp130/final-reconciliation.json',
  'evidence/lp131/statewide-readiness-audit.json',
  'LP132-TEXAS-STATEWIDE-ACTIVATION-ROADMAP.md',
  'evidence/lp135/statewide-certification.json',
  'evidence/lp136/statewide-operational-readiness.json',
  'evidence/lp138/county-geometry-membership-contract.draft.json'
]);

/** Pure LP140 planning. This function reads no files and performs no writes or activation. */
export function deriveActivationWavePlan({ readiness, certification, integrity, operational, membershipDraft, authorizationRegistry }) {
  if (integrity.packageIntegrity.classification !== 'PASS') throw new Error('LP130 integrity baseline is not PASS');
  const certifications = new Map(certification.counties.map(row => [row.fips, row]));
  const eligibleGeometry = new Set(membershipDraft.approvedCounties.map(row => row.fips));
  const authorizationRecords = new Map((authorizationRegistry?.authorizations ?? []).map(record => [record.fips, record]));
  if (authorizationRecords.size !== (authorizationRegistry?.authorizations ?? []).length) throw new Error('Duplicate authorization FIPS');

  const counties = readiness.counties.map(row => {
    const cert = certifications.get(row.fips);
    if (!cert) throw new Error(`Missing LP135 certification evidence for ${row.fips}`);
    const derivedGates = [
      ['Package integrity', 'PASS'],
      ['Certification complete', cert.certificationStatus === 'CERTIFIED' ? 'PASS' : 'BLOCKED'],
      ['Community readiness', row.communities.datasetPresent === true && row.communities.searchSupported === true ? 'PASS' : 'NOT_EVALUATED'],
      ['Destination readiness', row.destinations.datasetPresent === true && row.destinations.searchSupported === true ? 'PASS' : 'NOT_EVALUATED'],
      ['Crossing readiness', row.crossings.productionPackageExists === true && row.crossings.runtimeAvailable === true ? 'PASS' : 'NOT_EVALUATED'],
      ['Runtime validation', 'NOT_EVALUATED'],
      ['Production approval', 'NOT_EVALUATED']
    ].map(([name, status], index) => ({ gate: index + 1, name, status }));
    const gates = row.lp132Gates ?? derivedGates;
    const operationalReady = row.operationalPrerequisites === 'PASS';
    const deploymentReady = row.deploymentPrerequisites === 'PASS';
    const blockers = [];
    if (cert.certificationStatus !== 'CERTIFIED') blockers.push('CERTIFICATION_BLOCKED');
    if (!row.activationEligible) blockers.push('LP131_READINESS_INCOMPLETE');
    if (!gates.slice(0, 6).every(gate => gate.status === 'PASS')) blockers.push('LP132_GATES_1_6_INCOMPLETE');
    if (!eligibleGeometry.has(row.fips)) blockers.push('GEOMETRY_MEMBERSHIP_NOT_APPROVED');
    if (!operationalReady) blockers.push('COUNTY_OPERATIONAL_PREREQUISITES_INCOMPLETE');
    if (!deploymentReady) blockers.push('DEPLOYMENT_PREREQUISITES_INCOMPLETE');
    blockers.push('ACTIVATION_NOT_AUTHORIZED');
    const qualifies = cert.certificationStatus === 'CERTIFIED' && row.activationEligible &&
      gates.slice(0, 6).every(gate => gate.status === 'PASS') && eligibleGeometry.has(row.fips) && operationalReady && deploymentReady;
    const readinessClass = cert.certificationStatus !== 'CERTIFIED' ? 'BLOCKED' : qualifies ? 'READY_FOR_FUTURE_WAVE' : 'CONDITIONALLY_READY';
    const proposedWave = qualifies ? ({ TIER_1: 0, TIER_2: 1, TIER_3: 2, TIER_4: 3 }[row.tier] ?? 4) : null;
    const authorization = authorizationRecords.get(row.fips);
    return {
      county: row.county, countyId: row.countyId, fips: row.fips, readinessClass,
      certification: cert.certificationStatus, lp131Tier: row.tier, lp131Readiness: row.status,
      packageIntegrity: 'PASS', gates, geometryMembershipEligible: eligibleGeometry.has(row.fips),
      operationalPrerequisites: operationalReady ? 'PASS' : 'INCOMPLETE', deploymentPrerequisites: deploymentReady ? 'PASS' : 'INCOMPLETE', activationAuthorization: authorization?.authorizationStatus ?? 'NOT_AUTHORIZED', proposedWave,
      governingEvidence: evidenceRefs, blockers,
      unmetRequirements: blockers,
      recommendedAction: readinessClass === 'BLOCKED'
        ? 'Mount and verify the byte-identical LP130 package, then run the LP134 certifier twice; only afterward complete the remaining LP132 gates.'
        : 'Complete and record the county-specific LP132 Gates 1–6 dossier; then seek separate membership and Gate 7 decisions.'
    };
  }).sort((a, b) => a.fips.localeCompare(b.fips));

  if (new Set(counties.map(row => row.fips)).size !== counties.length) throw new Error('Duplicate county FIPS');
  const members = counties.filter(row => row.readinessClass === 'READY_FOR_FUTURE_WAVE');
  const waves = WAVE_PURPOSES.map((purpose, wave) => ({ wave, purpose, members: members.filter(row => row.proposedWave === wave) }));
  const totals = Object.fromEntries(['READY_FOR_FUTURE_WAVE', 'CONDITIONALLY_READY', 'BLOCKED'].map(key => [key, counties.filter(row => row.readinessClass === key).length]));
  const causes = [...new Set(counties.flatMap(row => row.blockers))].sort().map(cause => ({ cause, countyCount: counties.filter(row => row.blockers.includes(cause)).length, fips: counties.filter(row => row.blockers.includes(cause)).map(row => row.fips) }));
  return { counties, waves, statewideTotals: totals, blockerInventory: causes };
}

export const lp140Policy = Object.freeze({
  readinessRule: 'READY requires observed package integrity PASS, certification PASS, LP131 eligibility, LP132 Gates 1-6 PASS, geometry eligibility, and operational/deployment prerequisites; missing evidence fails closed.',
  authorizationRule: 'Planning never supplies or implies Gate 7 approval.',
  ordering: 'ascending Texas FIPS', evidenceRefs
});
