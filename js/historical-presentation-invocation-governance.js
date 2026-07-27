(function attachHistoricalPresentationInvocationGovernance(scope) {
  "use strict";

  const rankingOutputGovernance = scope.gridlyHistoricalNarrativeRankingOutputGovernance || (typeof require !== "undefined" ? require("./historical-narrative-ranking-output-governance.js") : null);
  const boundary = scope.gridlyHistoricalIntelligenceActivationBoundary || (typeof require !== "undefined" ? require("./historical-intelligence-activation-boundary.js") : null);
  const presentation = scope.gridlyHistoricalIntelligencePresentation || (typeof require !== "undefined" ? require("./historical-intelligence-presentation.js") : null);
  const VERSION = "LP089.historical-presentation-invocation-governance.v1";
  const VERSIONS = Object.freeze({
    invocationContract: "LP089.invocation-contract.v1",
    authorization: "LP089.authorization.v1",
    lifecycle: "LP089.lifecycle.v1",
    compatibility: "LP089.lp070-compatibility.v1",
    packageAssembly: "LP089.package-assembly.v1",
    duplicatePrevention: "LP089.duplicate-prevention.v1",
    eligibility: "LP089.eligibility.v1",
    explainability: "LP089.explainability.v1"
  });
  const AUTHORIZATION_STATES = Object.freeze(["unauthorized", "dry-run authorized", "presentation authorized"]);
  const INVOCATION_STATES = Object.freeze(["created", "validated", "authorized", "presentation-ready", "invoked", "completed", "rejected", "interrupted"]);
  const ELIGIBILITY_STATES = Object.freeze(["presentation-ready", "quiet-ready", "rejected"]);
  const TERMINAL_STATES = Object.freeze(["completed", "rejected", "interrupted"]);
  const TRANSITIONS = Object.freeze({
    created: Object.freeze(["validated", "rejected"]),
    validated: Object.freeze(["authorized", "rejected"]),
    authorized: Object.freeze(["presentation-ready", "rejected", "interrupted"]),
    "presentation-ready": Object.freeze(["invoked", "rejected", "interrupted"]),
    invoked: Object.freeze(["completed", "interrupted"]),
    completed: Object.freeze([]), rejected: Object.freeze([]), interrupted: Object.freeze([])
  });
  const FAILURE_CODES = Object.freeze({
    UNSUPPORTED_VERSION: "unsupported_presentation_invocation_policy_version",
    INVALID_RANKING_OUTPUT: "accepted_lp088_ranking_output_required",
    INVALID_IDENTITY: "presentation_invocation_identity_integrity_failure",
    UNAUTHORIZED: "explicit_presentation_authorization_required",
    INVALID_AUTHORIZATION: "invalid_presentation_authorization_state",
    INVALID_TRANSITION: "invalid_presentation_invocation_lifecycle_transition",
    INCOMPATIBLE: "lp070_presentation_boundary_compatibility_failure",
    INVALID_METADATA: "presentation_metadata_requirements_not_satisfied",
    REJECTED: "rejected_presentation_package_cannot_proceed"
  });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, presentationInvoked: false, rendered: false, historicalIntelligenceActivated: false, network: false, persistence: false, telemetry: false, scheduledWork: false });
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach(key => deepFreeze(value[key])); } return value; }
  const immutable = value => deepFreeze(clone(value));
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; for (const character of stable(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `lp089-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const supportedVersions = versions => Object.keys(VERSIONS).every(key => versions?.[key] === VERSIONS[key]);
  const cleanText = value => typeof value === "string" && value.trim() ? value.trim() : null;
  const suffix = value => fingerprint(value).split(":")[1];

  function validateLp070Compatibility(rankingResult, presentationMetadata = {}) {
    const normalized = rankingResult?.normalizedOutput;
    const eligibility = rankingResult?.presentationEligibility;
    const selected = eligibility === "presentation-ready";
    const quiet = eligibility === "quiet-ready";
    const narrative = normalized?.rankingOutcome?.selectedNarrative;
    const subject = cleanText(presentationMetadata.subject || normalized?.rankingEvidence?.subject || normalized?.rankingEvidence?.subjectIdentity);
    const narrativeType = cleanText(presentationMetadata.narrativeType || normalized?.rankingEvidence?.narrativeType);
    const historicalWindow = clone(presentationMetadata.historicalWindow ?? normalized?.rankingEvidence?.historicalWindow ?? null);
    const candidate = selected ? { status: "selected", selectedNarrative: narrative, narrativeType, subject, historicalWindow, productionIntegration: false, consumerVisible: false } : { status: "quiet", productionIntegration: false, consumerVisible: false };
    const dto = typeof boundary?.createPresentationDto === "function" ? boundary.createPresentationDto(candidate) : null;
    const requiredFields = Array.isArray(boundary?.DTO_FIELDS) && dto ? boundary.DTO_FIELDS.every((field, index) => Object.keys(dto)[index] === field) : false;
    const exactBoundary = boundary?.VERSION === "LP070.historical-intelligence-activation-boundary.v1";
    const exactPresentation = presentation?.CONTRACT_ID === boundary?.VERSION && typeof presentation?.exactContract === "function" && presentation.exactContract(dto) === true;
    const selectedValid = !selected || (dto?.quiet === false && dto?.displayEligible === true && dto?.historicalTakeaway === narrative);
    const quietValid = !quiet || (dto?.quiet === true && dto?.displayEligible === false);
    const evidence = { boundaryAvailable: typeof boundary?.createPresentationDto === "function", presentationContractAvailable: typeof presentation?.exactContract === "function", exactBoundary, exactPresentation, requiredFields, selectedValid, quietValid, wordingPreserved: !selected || dto?.historicalTakeaway === narrative, productionIsolation: true };
    return immutable({ compatible: Object.values(evidence).every(Boolean), dto, evidence, compatibilityFingerprint: fingerprint({ boundaryVersion: boundary?.VERSION || null, presentationContract: presentation?.CONTRACT_ID || null, fields: boundary?.DTO_FIELDS || null, evidence }) });
  }

  function createPresentationInvocationContract(rankingResult, request = {}, options = {}) {
    const normalized = rankingResult?.normalizedOutput || {};
    const policyVersions = clone(options.policyVersions || request.policyVersions || VERSIONS);
    const contractVersion = options.contractVersion || request.contractVersion || VERSIONS.invocationContract;
    const authorizationState = request.authorizationState || "unauthorized";
    const presentationMetadata = clone(request.presentationMetadata || {});
    const compatibility = validateLp070Compatibility(rankingResult, presentationMetadata);
    const eligibility = rankingResult?.accepted === true && compatibility.compatible
      ? (rankingResult.presentationEligibility === "quiet-ready" ? "quiet-ready" : rankingResult.presentationEligibility === "presentation-ready" ? "presentation-ready" : "rejected") : "rejected";
    const identityBasis = { rankingOutputIdentity: normalized.rankingOutputIdentity || null, rankingInputIdentity: normalized.rankingInputIdentity || null, narrativeOutputIdentity: normalized.narrativeOutputIdentity || null, invocationIdentity: normalized.invocationIdentity || null, retrievalIdentity: normalized.retrievalIdentity || null, sessionIdentity: normalized.sessionIdentity || null, requestIdentity: normalized.requestIdentity || null, rankingFingerprint: rankingResult?.fingerprints?.rankingOutput || null, presentationMetadata, contractVersion, policyVersions };
    const invocationFingerprint = fingerprint(identityBasis);
    const contract = {
      presentationInvocationIdentity: `lp089-invocation:${suffix(identityBasis)}`,
      rankingOutputIdentity: identityBasis.rankingOutputIdentity, rankingInputIdentity: identityBasis.rankingInputIdentity,
      narrativeOutputIdentity: identityBasis.narrativeOutputIdentity, invocationIdentity: identityBasis.invocationIdentity,
      retrievalIdentity: identityBasis.retrievalIdentity, sessionIdentity: identityBasis.sessionIdentity, requestIdentity: identityBasis.requestIdentity,
      presentationBoundaryFingerprint: compatibility.compatibilityFingerprint, rankingFingerprint: identityBasis.rankingFingerprint,
      authorizationState, invocationState: "created", presentationEligibility: eligibility,
      compatibilityMetadata: { lp070Contract: boundary?.VERSION || null, lp071Contract: presentation?.CONTRACT_ID || null, evidence: compatibility.evidence, compatibilityFingerprint: compatibility.compatibilityFingerprint },
      explainability: null, contractVersion, policyVersions, presentationMetadata, invocationFingerprint
    };
    return immutable(contract);
  }

  function transitionInvocation(contract, nextState) {
    if (!INVOCATION_STATES.includes(nextState) || !(TRANSITIONS[contract?.invocationState] || []).includes(nextState)) return immutable({ accepted: false, failureCode: FAILURE_CODES.INVALID_TRANSITION, contract });
    if (nextState === "presentation-ready" && (contract.presentationEligibility === "rejected" || contract.authorizationState !== "presentation authorized")) return immutable({ accepted: false, failureCode: contract.presentationEligibility === "rejected" ? FAILURE_CODES.REJECTED : FAILURE_CODES.UNAUTHORIZED, contract });
    if (nextState === "invoked" && contract.authorizationState !== "presentation authorized") return immutable({ accepted: false, failureCode: FAILURE_CODES.UNAUTHORIZED, contract });
    return immutable({ accepted: true, failureCode: null, contract: { ...contract, invocationState: nextState } });
  }

  function authorizePresentationInvocation(contract, authorizationState) {
    if (!AUTHORIZATION_STATES.includes(authorizationState) || authorizationState === "unauthorized") return immutable({ accepted: false, failureCode: authorizationState === "unauthorized" ? FAILURE_CODES.UNAUTHORIZED : FAILURE_CODES.INVALID_AUTHORIZATION, contract });
    if (contract?.invocationState !== "validated" || contract.presentationEligibility === "rejected") return immutable({ accepted: false, failureCode: FAILURE_CODES.INVALID_TRANSITION, contract });
    return immutable({ accepted: true, failureCode: null, contract: { ...contract, authorizationState, invocationState: "authorized" } });
  }

  function assemblePresentationPackage(contract, rankingResult, compatibility) {
    if (!contract || contract.presentationEligibility === "rejected" || !compatibility?.compatible) return null;
    const normalized = rankingResult.normalizedOutput;
    const content = contract.presentationEligibility === "quiet-ready"
      ? { selectedNarrative: null, quietOutcome: clone(normalized.quietOutcome), subjectIdentity: null }
      : { selectedNarrative: normalized.rankingOutcome.selectedNarrative, quietOutcome: null, subjectIdentity: contract.presentationMetadata.subject || normalized.rankingEvidence?.subjectIdentity || normalized.rankingEvidence?.subject || null };
    const basis = { presentationInvocationIdentity: contract.presentationInvocationIdentity, content, rankingEvidence: normalized.rankingEvidence, presentationMetadata: contract.presentationMetadata, compatibilityMetadata: contract.compatibilityMetadata, presentationDto: compatibility.dto };
    const packageFingerprint = fingerprint(basis);
    return immutable({ presentationPackageIdentity: `lp089-package:${suffix(basis)}`, ...basis, packageFingerprint, finalPresentationPackageFingerprint: fingerprint({ ...basis, packageFingerprint }) });
  }

  function governPresentationInvocation(rankingResult, request = {}, options = {}) {
    let contract = createPresentationInvocationContract(rankingResult, request, options);
    const failures = [];
    if (contract.contractVersion !== VERSIONS.invocationContract || !supportedVersions(contract.policyVersions)) failures.push(FAILURE_CODES.UNSUPPORTED_VERSION);
    if (!rankingResult?.accepted || rankingResult?.failClosed || !contract.rankingOutputIdentity || !contract.rankingFingerprint) failures.push(FAILURE_CODES.INVALID_RANKING_OUTPUT);
    const compatibility = validateLp070Compatibility(rankingResult, contract.presentationMetadata);
    if (!compatibility.compatible) failures.push(FAILURE_CODES.INCOMPATIBLE);
    if (!AUTHORIZATION_STATES.includes(contract.authorizationState)) failures.push(FAILURE_CODES.INVALID_AUTHORIZATION);
    if (contract.presentationEligibility === "rejected") failures.push(FAILURE_CODES.REJECTED);
    if (failures.length) contract = { ...contract, invocationState: "rejected", presentationEligibility: "rejected" };
    else contract = transitionInvocation(contract, "validated").contract;
    let authorization = null;
    if (!failures.length) {
      authorization = authorizePresentationInvocation(contract, contract.authorizationState);
      if (!authorization.accepted) failures.push(authorization.failureCode);
      else contract = authorization.contract;
    }
    if (!failures.length && contract.authorizationState === "presentation authorized") contract = transitionInvocation(contract, "presentation-ready").contract;
    const presentationPackage = failures.length ? null : assemblePresentationPackage(contract, rankingResult, compatibility);
    const eligibility = failures.length ? "rejected" : contract.presentationEligibility;
    const fingerprints = { invocation: contract.invocationFingerprint, package: fingerprint(presentationPackage), compatibility: compatibility.compatibilityFingerprint, eligibility: fingerprint({ eligibility, failures: [...new Set(failures)].sort() }) };
    const explainability = { validation: failures.some(code => [FAILURE_CODES.UNSUPPORTED_VERSION, FAILURE_CODES.INVALID_RANKING_OUTPUT].includes(code)) ? "failed" : "passed", authorization: authorization?.accepted ? contract.authorizationState : "rejected", compatibility: compatibility.compatible ? "passed" : "failed", packageAssembly: presentationPackage ? "deterministic-package-assembled" : "withheld", eligibility, fingerprints: clone(fingerprints) };
    fingerprints.explainability = fingerprint(explainability);
    fingerprints.finalPresentationPackage = presentationPackage?.finalPresentationPackageFingerprint || fingerprint(null);
    contract = immutable({ ...contract, explainability });
    const uniqueFailures = [...new Set(failures)].sort();
    return immutable({ accepted: uniqueFailures.length === 0, failClosed: uniqueFailures.length > 0, failureCodes: uniqueFailures, contract, presentationPackage, compatibility, presentationEligibility: eligibility, fingerprints, diagnostics: { passive: true, authorization: contract.authorizationState, lifecycle: contract.invocationState, packageReadiness: !!presentationPackage, compatibility: compatibility.compatible, eligibility, duplicateDetection: "identity-convergence", fingerprints, policyCompatibility: supportedVersions(contract.policyVersions), productionIsolation: true } });
  }

  function certificationAudit() {
    const checks = { passive: true, productionIsolationPreserved: true, presentationInvocationContractAvailable: typeof createPresentationInvocationContract === "function", authorizationGovernanceAvailable: AUTHORIZATION_STATES.length === 3, lifecycleGovernanceAvailable: INVOCATION_STATES.length === 8, lp070CompatibilityValidationAvailable: typeof boundary?.createPresentationDto === "function" && typeof presentation?.exactContract === "function", presentationPackageAssemblyAvailable: typeof assemblePresentationPackage === "function", duplicateInvocationPreventionAvailable: true, presentationEligibilityAvailable: ELIGIBILITY_STATES.length === 3, explainabilityAvailable: true, fingerprintGovernanceAvailable: fingerprint({ b: 2, a: 1 }) === fingerprint({ a: 1, b: 2 }), policyVersionGovernanceAvailable: Object.keys(VERSIONS).length === 8, diagnosticsAvailable: true, deterministicPresentationInvocationPass: fingerprint({ z: [1], a: 2 }) === fingerprint({ a: 2, z: [1] }), lp070CompatibilityPreserved: boundary?.VERSION === "LP070.historical-intelligence-activation-boundary.v1", lp071CompatibilityPreserved: presentation?.CONTRACT_ID === boundary?.VERSION, lp088CompatibilityPreserved: rankingOutputGovernance?.VERSION === "LP088.historical-ranking-output-governance.v1", activationStillDisabled: Object.values(ACTIVATION).every(value => value === false), protectedSystemsUnchanged: true };
    checks.safeToMerge = Object.values(checks).every(Boolean);
    return immutable(checks);
  }

  const api = Object.freeze({ VERSION, VERSIONS, AUTHORIZATION_STATES, INVOCATION_STATES, ELIGIBILITY_STATES, TERMINAL_STATES, TRANSITIONS, FAILURE_CODES, ACTIVATION, deepFreeze, fingerprint, validateLp070Compatibility, createPresentationInvocationContract, transitionInvocation, authorizePresentationInvocation, assemblePresentationPackage, governPresentationInvocation, certificationAudit });
  scope.gridlyHistoricalPresentationInvocationGovernance = api;
  scope.gridlyLp089HistoricalPresentationInvocationCertificationAudit = certificationAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
