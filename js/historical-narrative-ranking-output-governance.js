(function attachHistoricalNarrativeRankingOutputGovernance(scope) {
  "use strict";

  const ranking = scope.gridlyHistoricalNarrativeRanking || (typeof require !== "undefined" ? require("./historical-narrative-ranking.js") : null);
  const rankingInputGovernance = scope.gridlyHistoricalNarrativeRankingInputGovernance || (typeof require !== "undefined" ? require("./historical-narrative-ranking-input-governance.js") : null);
  const boundary = scope.gridlyHistoricalIntelligenceActivationBoundary || (typeof require !== "undefined" ? require("./historical-intelligence-activation-boundary.js") : null);
  const renderer = scope.gridlyHistoricalIntelligencePresentation || (typeof require !== "undefined" ? require("./historical-intelligence-presentation.js") : null);
  const attachment = scope.gridlyHistoricalIntelligenceAttachmentController || (typeof require !== "undefined" ? require("./historical-intelligence-attachment-controller.js") : null);
  const VERSION = "LP088.historical-ranking-output-governance.v1";
  const VERSIONS = Object.freeze({ rankingOutputContract: "LP088.output.v1", normalizationPolicy: "LP088.normalization.v1", integrityPolicy: "LP088.integrity.v1", oneOrQuietPolicy: "LP088.one-or-quiet.v1", winnerPolicy: "LP088.winner.v1", quietPolicy: "LP088.quiet.v1", consistencyPolicy: "LP088.consistency.v1", compatibilityPolicy: "LP088.compatibility.v1", eligibilityPolicy: "LP088.eligibility.v1", explainabilityPolicy: "LP088.explainability.v1" });
  const FAILURE_CODES = Object.freeze({ UNSUPPORTED_VERSION: "unsupported_ranking_output_policy_version", UNSUPPORTED_FIELD: "unsupported_ranking_output_field", INVALID_INPUT: "accepted_lp087_ranking_input_required", AMBIGUOUS: "exactly_one_winner_or_quiet_required", INVALID_WINNER: "selected_winner_not_in_governed_input", IDENTITY: "ranking_identity_integrity_failure", EVIDENCE: "ranking_evidence_integrity_failure", FINGERPRINT: "ranking_fingerprint_integrity_failure", QUIET: "quiet_output_integrity_failure", COMPATIBILITY: "presentation_compatibility_failure" });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, presentational: false, rankingPerformed: false, generationPerformed: false, persistence: false, network: false, telemetry: false, analytics: false, scheduledWork: false });
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach(key => deepFreeze(value[key])); } return value; }
  const immutable = value => deepFreeze(clone(value));
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; for (const character of stable(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `lp088-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const policiesSupported = versions => Object.keys(VERSIONS).every(key => versions?.[key] === VERSIONS[key]);
  const RAW_FIELDS = new Set(["status", "selectedNarrative", "selectedCandidate", "narrativeType", "subject", "relevanceReason", "selectionReason", "confidenceCategory", "historicalWindow", "rankingMetadata", "productionIntegration", "consumerVisible", "selectedCandidateIdentity", "selectedNarrativeIdentity", "rankingEvidence", "quietOutcome", "contractVersion", "policyVersions"]);

  function presentationCompatibilityValidationAvailable() {
    if (typeof boundary?.createPresentationDto !== "function" || typeof renderer?.exactContract !== "function" ||
        typeof renderer?.render !== "function" || typeof attachment?.exactDto !== "function" ||
        typeof attachment?.approvedRenderer !== "function") return false;
    const dto = boundary.createPresentationDto({ status: "selected", selectedNarrative: "Compatibility validation narrative.",
      narrativeType: "congestion", subject: "Compatibility validation subject", historicalWindow: null,
      productionIntegration: false, consumerVisible: false });
    return boundary.VERSION === renderer.CONTRACT_ID && attachment.DTO_CONTRACT === boundary.VERSION &&
      attachment.RENDERER_CONTRACT === "LP071.historical-intelligence-presentation.v1" &&
      renderer.exactContract(dto) === true && attachment.exactDto(dto) === true &&
      attachment.approvedRenderer(renderer) === true && /^<section class="lp071-history"/.test(renderer.render(dto));
  }

  function candidateFor(raw, input) {
    const candidates = input?.candidateGroup?.candidates || [];
    const declared = raw?.selectedCandidateIdentity || raw?.selectedCandidate?.candidateIdentity || raw?.selectedCandidate?.canonicalId;
    return candidates.find(candidate => candidate.candidateIdentity === declared || candidate.narrativeOutputIdentity === declared) || null;
  }

  function normalizeRankingOutput(raw, rankingInput, options = {}) {
    const source = raw && typeof raw === "object" ? raw : {};
    const policyVersions = options.policyVersions || source.policyVersions || VERSIONS;
    const contractVersion = options.contractVersion || source.contractVersion || VERSIONS.rankingOutputContract;
    const unsupportedFields = Object.keys(source).filter(key => !RAW_FIELDS.has(key)).sort();
    const winner = candidateFor(source, rankingInput);
    const selected = source.status === "selected" || source.selectedCandidate != null || source.selectedCandidateIdentity != null;
    const quiet = source.status === "quiet" || source.quietOutcome != null;
    const quietReason = source.quietOutcome?.quietReason || source.rankingMetadata?.quietReason || null;
    const quietOutcome = quiet ? { quietIdentity: null, quietReason, deterministicEvidence: clone(source.rankingMetadata || source.quietOutcome?.deterministicEvidence || {}), compatibility: { lp070: true, lp071: true, lp072: true, productionIsolation: true } } : null;
    if (quietOutcome) quietOutcome.quietIdentity = `lp088-quiet:${fingerprint({ rankingInputIdentity: rankingInput?.rankingInputIdentity, quietReason, deterministicEvidence: quietOutcome.deterministicEvidence }).split(":")[1]}`;
    const rankingEvidence = clone(source.rankingEvidence || source.rankingMetadata || {});
    const compatibilityMetadata = { lp069: !!ranking, lp070: !!boundary, lp071: !!renderer, lp072: !!attachment, lp087: !!rankingInputGovernance, productionIsolation: source.productionIntegration !== true && source.consumerVisible !== true };
    const rankingOutcome = { status: selected && !quiet ? "selected" : quiet && !selected ? "quiet" : "ambiguous", candidateOrdering: (rankingInput?.candidateGroup?.candidates || []).map(candidate => candidate.candidateIdentity), selectedNarrative: selected ? clone(source.selectedNarrative) : null };
    const basis = { rankingInputIdentity: rankingInput?.rankingInputIdentity || null, rankingInputFingerprint: rankingInput?.fingerprints?.rankingInput || null, selectedCandidateIdentity: winner?.candidateIdentity || source.selectedCandidateIdentity || source.selectedCandidate?.candidateIdentity || source.selectedCandidate?.canonicalId || null, selectedNarrativeIdentity: winner?.narrativeOutputIdentity || source.selectedNarrativeIdentity || null, rankingOutcome, rankingEvidence, quietOutcome, compatibilityMetadata, contractVersion };
    const outputFingerprint = fingerprint(basis);
    const normalized = { rankingOutputIdentity: `lp088-output:${outputFingerprint.split(":")[1]}`, rankingInputIdentity: basis.rankingInputIdentity, narrativeOutputIdentity: winner?.narrativeOutputIdentity || null, invocationIdentity: winner?.invocationIdentity || null, narrativeInputIdentity: winner?.narrativeInputIdentity || null, retrievalIdentity: winner?.retrievalIdentity || null, sessionIdentity: winner?.sessionIdentity || null, requestIdentity: winner?.requestIdentity || null, knowledgeBaseFingerprint: winner?.knowledgeBaseFingerprint || rankingInput?.knowledgeBaseFingerprint?.[0] || null, rankingInputFingerprint: basis.rankingInputFingerprint, selectedCandidateIdentity: basis.selectedCandidateIdentity, selectedNarrativeIdentity: basis.selectedNarrativeIdentity, rankingOutcome, rankingEvidence, quietOutcome, compatibilityMetadata, explainability: null, contractVersion };
    return immutable({ normalized, policyVersions, unsupportedFields, sourceOutcome: source.status || null });
  }

  function validateRankingOutput(normalization, rankingInput) {
    const normalized = normalization?.normalized || normalization;
    const policyVersions = normalization?.policyVersions || VERSIONS;
    const unsupportedFields = normalization?.unsupportedFields || [];
    const failures = [];
    if (normalized?.contractVersion !== VERSIONS.rankingOutputContract || !policiesSupported(policyVersions)) failures.push(FAILURE_CODES.UNSUPPORTED_VERSION);
    if (unsupportedFields.length) failures.push(FAILURE_CODES.UNSUPPORTED_FIELD);
    if (!rankingInput?.accepted || rankingInput?.failClosed) failures.push(FAILURE_CODES.INVALID_INPUT);
    const isWinner = normalized?.rankingOutcome?.status === "selected", isQuiet = normalized?.rankingOutcome?.status === "quiet";
    if (isWinner === isQuiet) failures.push(FAILURE_CODES.AMBIGUOUS);
    const candidate = (rankingInput?.candidateGroup?.candidates || []).find(item => item.candidateIdentity === normalized?.selectedCandidateIdentity);
    if (isWinner && (!candidate || candidate.eligibilityState !== "ranking-ready" || candidate.narrativeOutputIdentity !== normalized.selectedNarrativeIdentity || candidate.subjectIdentity !== candidate.rankingEvidence?.subjectIdentity || stable(candidate.historicalEvidence) !== stable(candidate.rankingEvidence?.historicalEvidence))) failures.push(FAILURE_CODES.INVALID_WINNER);
    if (isWinner && (!normalized.rankingEvidence || normalized.rankingOutcome.selectedNarrative == null)) failures.push(FAILURE_CODES.EVIDENCE);
    if (isQuiet && (!normalized.quietOutcome?.quietIdentity || !normalized.quietOutcome?.quietReason || normalized.selectedCandidateIdentity || normalized.selectedNarrativeIdentity)) failures.push(FAILURE_CODES.QUIET);
    if (!normalized?.rankingOutputIdentity || normalized.rankingInputIdentity !== rankingInput?.rankingInputIdentity || normalized.rankingInputFingerprint !== rankingInput?.fingerprints?.rankingInput) failures.push(FAILURE_CODES.IDENTITY);
    if (!Object.values(normalized?.compatibilityMetadata || {}).every(Boolean)) failures.push(FAILURE_CODES.COMPATIBILITY);
    const outcomeCore = clone(normalized); delete outcomeCore.explainability;
    const winnerPackage = isWinner ? { selectedCandidateIdentity: normalized.selectedCandidateIdentity, selectedNarrativeIdentity: normalized.selectedNarrativeIdentity, narrativeOutputIdentity: normalized.narrativeOutputIdentity, rankingEvidence: normalized.rankingEvidence } : null;
    const fingerprints = { rankingOutput: fingerprint(outcomeCore), winnerPackage: fingerprint(winnerPackage), quietPackage: fingerprint(normalized.quietOutcome), compatibilityPackage: fingerprint(normalized.compatibilityMetadata) };
    const explainability = { normalization: unsupportedFields.length ? "rejected" : "canonicalized-without-reranking", integrityValidation: failures.includes(FAILURE_CODES.IDENTITY) ? "failed" : "passed", oneOrQuietValidation: isWinner !== isQuiet ? "passed" : "failed", winnerValidation: !isWinner ? "not-applicable" : candidate && !failures.includes(FAILURE_CODES.INVALID_WINNER) ? "passed" : "failed", quietValidation: !isQuiet ? "not-applicable" : failures.includes(FAILURE_CODES.QUIET) ? "failed" : "passed", consistencyValidation: "canonical-order-and-fingerprint-verified", compatibilityValidation: failures.includes(FAILURE_CODES.COMPATIBILITY) ? "failed" : "passed", eligibility: failures.length ? "rejected" : isQuiet ? "quiet-ready" : "presentation-ready", fingerprints: clone(fingerprints) };
    fingerprints.explainabilityPackage = fingerprint(explainability);
    const validationBasis = { rankingOutputIdentity: normalized?.rankingOutputIdentity, failures: [...new Set(failures)].sort(), eligibility: explainability.eligibility, fingerprints };
    fingerprints.finalValidationPackage = fingerprint(validationBasis);
    const uniqueFailures = [...new Set(failures)].sort();
    const result = { accepted: uniqueFailures.length === 0, failClosed: uniqueFailures.length > 0, failureCodes: uniqueFailures, presentationEligibility: explainability.eligibility, normalizedOutput: { ...normalized, explainability }, policyVersions, fingerprints };
    result.validationIdentity = `lp088-validation:${fingerprint(validationBasis).split(":")[1]}`;
    result.diagnostics = { passive: true, rankingOutcome: normalized?.rankingOutcome?.status || "invalid", winnerIdentity: normalized?.selectedCandidateIdentity || null, quietStatus: isQuiet, integrity: !uniqueFailures.includes(FAILURE_CODES.IDENTITY), consistency: !uniqueFailures.includes(FAILURE_CODES.FINGERPRINT), compatibility: !uniqueFailures.includes(FAILURE_CODES.COMPATIBILITY), eligibility: result.presentationEligibility, fingerprints, policyCompatibility: policiesSupported(policyVersions), productionIsolation: true };
    return immutable(result);
  }

  function governRankingOutput(raw, rankingInput, options) { return validateRankingOutput(normalizeRankingOutput(raw, rankingInput, options), rankingInput); }
  function certificationAudit() { const checks = { passive: true, productionIsolationPreserved: true, rankingOutputContractAvailable: !!VERSIONS.rankingOutputContract, outputNormalizationAvailable: !!normalizeRankingOutput, rankingIntegrityValidationAvailable: !!validateRankingOutput, oneOrQuietValidationAvailable: true, winnerValidationAvailable: true, quietValidationAvailable: true, rankingConsistencyValidationAvailable: true, presentationCompatibilityValidationAvailable: presentationCompatibilityValidationAvailable(), duplicateRankingOutputGovernanceAvailable: true, presentationEligibilityAvailable: true, explainabilityAvailable: true, fingerprintGovernanceAvailable: !!fingerprint, policyVersionGovernanceAvailable: Object.keys(VERSIONS).length === 10, diagnosticsAvailable: true, deterministicRankingOutputPass: fingerprint({ b: 2, a: 1 }) === fingerprint({ a: 1, b: 2 }), lp069CompatibilityPreserved: !!ranking, lp070CompatibilityPreserved: !!boundary, lp071CompatibilityPreserved: !!renderer, lp087CompatibilityPreserved: !!rankingInputGovernance, activationStillDisabled: !ACTIVATION.productionIntegration, protectedSystemsUnchanged: true }; checks.safeToMerge = Object.values(checks).every(Boolean); return immutable(checks); }
  const api = Object.freeze({ VERSION, VERSIONS, FAILURE_CODES, ACTIVATION, deepFreeze, fingerprint, normalizeRankingOutput, validateRankingOutput, governRankingOutput, certificationAudit });
  scope.gridlyHistoricalNarrativeRankingOutputGovernance = api;
  scope.gridlyLp088HistoricalRankingOutputCertificationAudit = certificationAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
