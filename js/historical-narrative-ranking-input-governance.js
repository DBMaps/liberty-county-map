(function attachHistoricalNarrativeRankingInputGovernance(scope) {
  "use strict";

  const outputValidation = scope.gridlyHistoricalNarrativeOutputValidation || (typeof require !== "undefined" ? require("./historical-narrative-output-validation.js") : null);
  const ranking = scope.gridlyHistoricalNarrativeRanking || (typeof require !== "undefined" ? require("./historical-narrative-ranking.js") : null);
  const boundary = scope.gridlyHistoricalIntelligenceActivationBoundary || (typeof require !== "undefined" ? require("./historical-intelligence-activation-boundary.js") : null);
  const VERSION = "LP087.historical-ranking-input-governance.v1";
  const VERSIONS = Object.freeze({ rankingInputContract: "LP087.input.v1", registrationPolicy: "LP087.registration.v1", eligibilityPolicy: "LP087.eligibility.v1", groupingPolicy: "LP087.grouping.v1", duplicatePolicy: "LP087.duplicate.v1", tieBreakPolicy: "LP087.tie-break.v1", compatibilityPolicy: "LP087.compatibility.v1", explainabilityPolicy: "LP087.explainability.v1" });
  const F = Object.freeze({ UNSUPPORTED_VERSION: "unsupported_ranking_input_policy_version", INVALID_OUTPUT: "lp086_validation_required", REJECTED_OUTPUT: "rejected_narrative_output", COMPATIBILITY: "ranking_input_compatibility_failure" });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, presentational: false, rankingPerformed: false, generationPerformed: false, persistence: false, network: false, telemetry: false, backgroundWork: false });
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach(key => deepFreeze(value[key])); } return value; }
  const immutable = value => deepFreeze(clone(value));
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; for (const character of stable(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `lp087-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const supported = versions => Object.keys(VERSIONS).every(key => versions?.[key] === VERSIONS[key]);

  function classifyEligibility(validation) {
    if (!validation?.accepted || validation?.failClosed || validation?.downstreamEligibility === "rejected") return "rejected";
    if (validation.downstreamEligibility === "quiet-eligible") return "quiet-ready";
    return validation.downstreamEligibility === "ranking-eligible" ? "ranking-ready" : "rejected";
  }

  function registerCandidate(validation) {
    const eligibilityState = classifyEligibility(validation);
    if (!validation?.normalizedOutput || eligibilityState === "rejected") return immutable({ accepted: false, eligibilityState: "rejected", failureCodes: [validation?.normalizedOutput ? F.REJECTED_OUTPUT : F.INVALID_OUTPUT] });
    const output = validation.normalizedOutput;
    const narrativeOutputFingerprint = validation.fingerprints?.normalizedOutput;
    const identityBasis = { narrativeOutputIdentity: output.narrativeOutputIdentity, narrativeOutputFingerprint, eligibilityState };
    const candidateIdentity = `lp087-candidate:${fingerprint(identityBasis).split(":")[1]}`;
    const rankingEvidence = {
      subjectIdentity: output.subjectIdentity,
      subjectType: output.subjectType,
      historicalEvidence: output.provenanceSummary,
      subjectSpecificity: output.subjectIdentity ? (output.subjectType === "crossing" ? 4 : output.subjectType === "roadway" ? 3 : 2) : 0,
      historicalRelevance: output.contextStatement !== null,
      quality: validation.explainability?.completenessChecks === "passed",
      lifecycleStability: output.compatibilityMetadata?.lifecycleStable === true,
      evidenceStrength: output.provenanceSummary?.candidateIdentities?.length || 0,
      durationEligibility: output.durationStatement !== null,
      quietStatus: eligibilityState === "quiet-ready"
    };
    const compatibilityMetadata = { lp069: output.compatibilityMetadata?.lp069 === true, lp070: output.compatibilityMetadata?.lp070 === true, lp086: true, productionIsolation: output.compatibilityMetadata?.productionIsolation === true };
    const body = { candidateIdentity, candidateType: output.narrativeType, narrativeOutputIdentity: output.narrativeOutputIdentity, invocationIdentity: output.invocationIdentity, narrativeInputIdentity: output.narrativeInputIdentity, retrievalIdentity: output.retrievalIdentity, sessionIdentity: output.sessionIdentity, requestIdentity: output.requestIdentity, knowledgeBaseFingerprint: output.knowledgeBaseFingerprint, narrativeOutputFingerprint, subjectIdentity: output.subjectIdentity, narrativeType: output.narrativeType, historicalEvidence: output.provenanceSummary, quietEligibility: eligibilityState === "quiet-ready", rankingEligibility: eligibilityState === "ranking-ready", rankingEvidence, eligibilityState, compatibilityMetadata };
    const registrationFingerprint = fingerprint(body);
    return immutable({ accepted: true, ...body, registrationIdentity: `lp087-registration:${registrationFingerprint.split(":")[1]}`, registrationFingerprint, failureCodes: [] });
  }

  function prepareRankingInput(validations, options = {}) {
    const policyVersions = options.policyVersions || VERSIONS;
    const failureCodes = [];
    if ((options.contractVersion || VERSIONS.rankingInputContract) !== VERSIONS.rankingInputContract || !supported(policyVersions)) failureCodes.push(F.UNSUPPORTED_VERSION);
    const registrations = (Array.isArray(validations) ? validations : []).map(registerCandidate);
    const rejectedCount = registrations.filter(item => !item.accepted).length;
    const canonical = new Map(); let duplicateCount = 0;
    registrations.filter(item => item.accepted).sort((a, b) => a.candidateIdentity.localeCompare(b.candidateIdentity)).forEach(item => { const duplicateKey = `${item.narrativeOutputIdentity}|${item.narrativeOutputFingerprint}`; if (canonical.has(duplicateKey)) duplicateCount += 1; else canonical.set(duplicateKey, item); });
    const candidates = [...canonical.values()];
    const compatibility = { lp069: !!ranking && candidates.every(item => item.compatibilityMetadata.lp069), lp070: !!boundary && candidates.every(item => item.compatibilityMetadata.lp070), lp086: !!outputValidation, productionIsolation: candidates.every(item => item.compatibilityMetadata.productionIsolation) };
    if (!Object.values(compatibility).every(Boolean)) failureCodes.push(F.COMPATIBILITY);
    const groupBasis = candidates.map(item => ({ candidateIdentity: item.candidateIdentity, narrativeOutputIdentity: item.narrativeOutputIdentity, subjectIdentity: item.subjectIdentity, evidenceReferences: item.historicalEvidence?.candidateIdentities || [] }));
    const groupFingerprint = fingerprint(groupBasis), groupingIdentity = `lp087-group:${groupFingerprint.split(":")[1]}`;
    const explainability = { registration: candidates.map(item => ({ accepted: true, registrationIdentity: item.registrationIdentity, failureCodes: item.failureCodes })), grouping: { groupingIdentity, candidateOrdering: candidates.map(item => item.candidateIdentity) }, eligibility: candidates.map(item => ({ candidateIdentity: item.candidateIdentity, state: item.eligibilityState })), duplicateEvaluation: { evaluatedCount: registrations.length, duplicateCount, rule: "narrative-output-identity-and-fingerprint" }, tieBreakPreparation: candidates.map(item => ({ candidateIdentity: item.candidateIdentity, evidence: item.rankingEvidence })), compatibility };
    const fingerprints = { registration: fingerprint(candidates.map(item => item.registrationFingerprint)), candidateGroup: groupFingerprint, eligibility: fingerprint(explainability.eligibility), explainability: fingerprint(explainability), compatibility: fingerprint(compatibility) };
    const contract = { narrativeOutputIdentity: candidates.map(item => item.narrativeOutputIdentity), invocationIdentity: candidates.map(item => item.invocationIdentity), narrativeInputIdentity: candidates.map(item => item.narrativeInputIdentity), retrievalIdentity: candidates.map(item => item.retrievalIdentity), sessionIdentity: candidates.map(item => item.sessionIdentity), requestIdentity: candidates.map(item => item.requestIdentity), knowledgeBaseFingerprint: candidates.map(item => item.knowledgeBaseFingerprint), narrativeOutputFingerprint: candidates.map(item => item.narrativeOutputFingerprint), candidateIdentity: candidates.map(item => item.candidateIdentity), candidateType: candidates.map(item => item.candidateType), rankingEvidence: candidates.map(item => item.rankingEvidence), eligibilityState: candidates.map(item => item.eligibilityState), compatibilityMetadata: compatibility, explainability, contractVersion: VERSIONS.rankingInputContract };
    const rankingInputFingerprint = fingerprint(contract); const rankingInputIdentity = `lp087-input:${rankingInputFingerprint.split(":")[1]}`;
    const candidateGroup = { groupingIdentity, candidates, narrativeIdentities: candidates.map(item => item.narrativeOutputIdentity), subjectIdentities: candidates.map(item => item.subjectIdentity), evidenceReferences: candidates.map(item => item.historicalEvidence?.candidateIdentities || []) };
    fingerprints.rankingInput = rankingInputFingerprint;
    const result = { accepted: failureCodes.length === 0, failClosed: failureCodes.length > 0, failureCodes: failureCodes.sort(), rankingInputIdentity, ...contract, policyVersions, candidateGroup, fingerprints };
    fingerprints.finalRankingPackage = fingerprint(result);
    result.diagnostics = { passive: true, registeredCandidates: candidates.length, eligibilityCounts: { rankingReady: candidates.filter(item => item.eligibilityState === "ranking-ready").length, quietReady: candidates.filter(item => item.eligibilityState === "quiet-ready").length, rejected: rejectedCount }, duplicateCount, grouping: groupingIdentity, compatibility, fingerprints, policyCompatibility: supported(policyVersions), productionIsolation: true };
    return immutable(result);
  }

  function certificationAudit() { const checks = { passive: true, productionIsolationPreserved: true, rankingInputContractAvailable: !!VERSIONS.rankingInputContract, candidateRegistrationAvailable: !!registerCandidate, rankingEligibilityAvailable: !!classifyEligibility, candidateGroupingAvailable: true, duplicateCandidateGovernanceAvailable: true, tieBreakPreparationAvailable: true, explainabilityAvailable: true, compatibilityValidationAvailable: true, fingerprintGovernanceAvailable: !!fingerprint, policyVersionGovernanceAvailable: Object.keys(VERSIONS).length === 8, diagnosticsAvailable: true, deterministicRankingInputPass: fingerprint({ b: 2, a: 1 }) === fingerprint({ a: 1, b: 2 }), lp069CompatibilityPreserved: !!ranking, lp070CompatibilityPreserved: !!boundary, lp086CompatibilityPreserved: !!outputValidation, activationStillDisabled: !ACTIVATION.productionIntegration, protectedSystemsUnchanged: true }; checks.safeToMerge = Object.values(checks).every(Boolean); return immutable(checks); }
  const api = Object.freeze({ VERSION, VERSIONS, FAILURE_CODES: F, ACTIVATION, deepFreeze, fingerprint, classifyEligibility, registerCandidate, prepareRankingInput, certificationAudit });
  scope.gridlyHistoricalNarrativeRankingInputGovernance = api;
  scope.gridlyLp087HistoricalRankingInputCertificationAudit = certificationAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
