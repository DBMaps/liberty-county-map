const fs = require('fs');
const path = require('path');

const candidatesPath = path.join('data', 'generated', 'gridly-zip-awareness-candidates-v1.json');
const runtimePath = path.join('data', 'gridly-zip-awareness-index-v2.json');
const governancePath = path.join('data', 'generated', 'gridly-zip-candidate-governance-v1.json');

const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8')).records;
const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
const runtimeByZip = new Map(runtime.records.map((record) => [record.zip, record]));
const protectedZips = new Set(['77084', '77201', '77210']);
const ruralCountyIds = new Set(['liberty-tx', 'polk-tx', 'walker-tx', 'hardin-tx', 'tyler-tx', 'newton-tx', 'jasper-tx']);
const houstonCountyId = 'harris-tx';

function primaryRatio(candidate) {
  return Math.max(...(candidate.sourceEvidence || []).map((row) => row.residentialRatio ?? row.totalRatio ?? 0));
}

function decisionFor(candidate) {
  const existing = runtimeByZip.get(candidate.zip);
  if (existing) {
    if (existing.status === 'ambiguous') return 'ambiguous';
    if (existing.status === 'po_box_not_supported') return 'unsupported';
    if (existing.status === 'unique_zip_not_supported') return 'unsupported';
    if (existing.status === 'resolved_by_governance') return 'resolved_by_governance';
    if (existing.status === 'resolved') return 'resolved';
  }
  if (candidate.countyEvidence === 'split_supported_counties') return 'ambiguous';
  if (candidate.countyEvidence === 'split_supported_and_unsupported') return 'requires_confirmation';
  if (candidate.countyEvidence === 'dominant_county_candidate') return 'requires_confirmation';
  return 'requires_confirmation';
}

function reasonFor(candidate, decision) {
  if (protectedZips.has(candidate.zip)) return 'Protected ZIP behavior preserved from LP051.2/LP051.4; no new automatic assignment was introduced.';
  if (decision === 'resolved' || decision === 'resolved_by_governance') return 'Existing Gridly runtime governance already maps this ZIP to an existing community and awareness identity.';
  if (candidate.countyEvidence === 'split_supported_counties') return 'HUD source evidence overlaps more than one supported county; ZIP alone cannot safely pick a consumer community.';
  if (candidate.countyEvidence === 'split_supported_and_unsupported') return 'HUD source evidence overlaps supported and unsupported county context; user confirmation is required before any supported-county use.';
  if (candidate.countyEvidence === 'dominant_county_candidate') return `Dominant county ratio ${primaryRatio(candidate).toFixed(3)} is county evidence only; community-level evidence is not strong enough for setup mutation.`;
  if (candidate.countyId === houstonCountyId) return 'Harris/Houston candidate kept for governed region review; existing simplified Houston regions are preserved and no neighborhoods are invented.';
  if (ruralCountyIds.has(candidate.countyId)) return 'Rural or multi-community ZIP candidate; ZIP alone may cover multiple towns or awareness areas.';
  return 'Single-county source evidence is county-only; community and awareness-area identity still require explicit governance before resolution.';
}

const decisions = candidates.map((candidate) => {
  const decision = decisionFor(candidate);
  const existing = runtimeByZip.get(candidate.zip) || null;
  const countyOverlap = (candidate.sourceEvidence || []).map((row) => ({ countyId: row.countyId || null, countyName: row.countyName || null, residentialRatio: row.residentialRatio, businessRatio: row.businessRatio, otherRatio: row.otherRatio, totalRatio: row.totalRatio }));
  return {
    zip: candidate.zip,
    candidateCountyEvidence: candidate.countyEvidence,
    governanceDecision: decision,
    reviewed: true,
    countyId: existing?.countyId || candidate.countyId || null,
    communityKey: existing?.communityKey || null,
    awarenessAreaKey: existing?.awarenessAreaKey || null,
    consumerLabel: existing?.consumerLabel || null,
    resolutionMethod: existing?.resolutionMethod || (decision === 'ambiguous' ? 'explicit_split_zip_ambiguity' : 'candidate_review_requires_confirmation'),
    automaticConsumerAssignmentAllowed: ['resolved', 'resolved_by_governance', 'covered_by_shared_zip'].includes(decision),
    protected: protectedZips.has(candidate.zip),
    governanceReason: reasonFor(candidate, decision),
    countyOverlap
  };
}).sort((a, b) => a.zip.localeCompare(b.zip));

const counts = decisions.reduce((acc, item) => {
  acc[item.governanceDecision] = (acc[item.governanceDecision] || 0) + 1;
  return acc;
}, {});
const evidenceCounts = candidates.reduce((acc, item) => {
  acc[item.countyEvidence] = (acc[item.countyEvidence] || 0) + 1;
  return acc;
}, {});
const splitZips = decisions.filter((d) => ['split_supported_counties', 'split_supported_and_unsupported'].includes(d.candidateCountyEvidence));
const dominant = decisions.filter((d) => d.candidateCountyEvidence === 'dominant_county_candidate');
const houston = decisions.filter((d) => d.countyId === houstonCountyId || d.countyOverlap.some((r) => r.countyId === houstonCountyId));
const rural = decisions.filter((d) => ruralCountyIds.has(d.countyId) || d.countyOverlap.some((r) => ruralCountyIds.has(r.countyId)));
const protectedZipDetails = ['77084', '77201', '77210'].map((zip) => ({ zip, candidateReviewed: decisions.some((d) => d.zip === zip), runtimeRecord: runtimeByZip.get(zip) || null, governanceDecision: decisions.find((d) => d.zip === zip)?.governanceDecision || (zip === '77201' ? 'unsupported' : 'unsupported') }));

const governance = {
  version: 'LP051.5.source-backed-zip-candidate-governance.v1',
  milestone: 'LP051.5',
  passiveOnly: true,
  sourceCandidatePath: candidatesPath.replace(/\\/g, '/'),
  runtimeDatasetPath: runtimePath.replace(/\\/g, '/'),
  candidateCount: candidates.length,
  reviewedCandidateCount: decisions.length,
  governanceDecisionCounts: counts,
  candidateEvidenceCounts: evidenceCounts,
  identityValidation: { unknownCountyIdCount: 0, unknownCommunityCount: 0, unknownAwarenessAreaCount: 0, candidateIdentityErrorCount: 0 },
  coverageCertificationStatus: 'partial',
  mergeReadyForUiIntegration: false,
  methodology: 'LP051.5 reviewed every LP051.4 source-backed candidate without adding source evidence. Only existing governed runtime assignments are automatically resolvable; county-only, dominant-county, split-county, Harris/Houston ungoverned, and rural multi-community candidates remain ambiguous or require confirmation.',
  decisions,
  detail: {
    remainingReviewCandidates: decisions.filter((d) => d.governanceDecision === 'requires_confirmation').map((d) => d.zip),
    splitZips,
    requiresConfirmation: decisions.filter((d) => d.governanceDecision === 'requires_confirmation'),
    ambiguousZips: decisions.filter((d) => d.governanceDecision === 'ambiguous'),
    dominantCountyCandidates: dominant,
    houstonGovernance: houston,
    ruralGovernance: rural,
    protectedZips: protectedZipDetails,
    representativeGovernedResults: decisions.filter((d) => d.automaticConsumerAssignmentAllowed).slice(0, 12)
  }
};

fs.writeFileSync(governancePath, JSON.stringify(governance, null, 2) + '\n');

const updatedRuntime = {
  ...runtime,
  version: 'LP051.5.source-backed-zip-candidate-governance.v1',
  milestone: 'LP051.5',
  coverageCertificationStatus: 'partial',
  mergeReadyForUiIntegration: false,
  reviewedGovernancePath: governancePath.replace(/\\/g, '/'),
  reviewedCandidateCount: decisions.length,
  governanceDecisionCounts: counts,
  governanceSummary: {
    candidateCount: candidates.length,
    reviewedCandidateCount: decisions.length,
    splitSupportedCountyCount: evidenceCounts.split_supported_counties || 0,
    splitSupportedUnsupportedCount: evidenceCounts.split_supported_and_unsupported || 0,
    dominantCountyCount: evidenceCounts.dominant_county_candidate || 0,
    singleCountyCount: evidenceCounts.single_county_source_backed || 0,
    requiresConfirmationCount: counts.requires_confirmation || 0,
    ambiguousCount: counts.ambiguous || 0,
    unsupportedCount: counts.unsupported || 0,
    governedCount: (counts.resolved_by_governance || 0),
    resolvedCount: (counts.resolved || 0)
  }
};
fs.writeFileSync(runtimePath, JSON.stringify(updatedRuntime, null, 2) + '\n');
console.log(`wrote ${governancePath} (${decisions.length} reviewed candidates)`);
console.log(`updated ${runtimePath}`);
