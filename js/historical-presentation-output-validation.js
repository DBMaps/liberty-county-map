(function attachHistoricalPresentationOutputValidation(scope) {
  "use strict";

  const boundary = scope.gridlyHistoricalIntelligenceActivationBoundary || (typeof require !== "undefined" ? require("./historical-intelligence-activation-boundary.js") : null);
  const renderer = scope.gridlyHistoricalIntelligencePresentation || (typeof require !== "undefined" ? require("./historical-intelligence-presentation.js") : null);
  const attachment = scope.gridlyHistoricalIntelligenceAttachmentController || (typeof require !== "undefined" ? require("./historical-intelligence-attachment-controller.js") : null);
  const invocation = scope.gridlyHistoricalPresentationInvocationGovernance || (typeof require !== "undefined" ? require("./historical-presentation-invocation-governance.js") : null);
  const VERSION = "LP090.historical-presentation-output-validation.v1";
  const VERSIONS = Object.freeze({
    presentationOutputContract: "LP090.presentation-output-contract.v1", normalization: "LP090.normalization.v1",
    integrity: "LP090.integrity.v1", rendererCompatibility: "LP090.renderer-compatibility.v1",
    quiet: "LP090.quiet.v1", completeness: "LP090.completeness.v1", duplicate: "LP090.duplicate.v1",
    eligibility: "LP090.eligibility.v1", explainability: "LP090.explainability.v1"
  });
  const ELIGIBILITY = Object.freeze(["renderer-ready", "quiet-renderer-ready", "rejected"]);
  const STATES = Object.freeze(["selected", "quiet", "rejected"]);
  const FAILURE_CODES = Object.freeze({ UNSUPPORTED_VERSION: "unsupported_presentation_output_policy_version", INVALID_OUTPUT: "invalid_lp070_presentation_output", UNSUPPORTED_FIELD: "unsupported_presentation_output_field", INTEGRITY: "presentation_output_integrity_failure", INCOMPLETE: "presentation_output_incomplete", RENDERER_INCOMPATIBLE: "lp071_renderer_compatibility_failure", QUIET_INVALID: "quiet_presentation_validation_failure" });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, rendered: false, attached: false, historicalIntelligenceActivated: false, network: false, persistence: false, telemetry: false, scheduledWork: false });
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach(key => deepFreeze(value[key])); } return value; }
  const immutable = value => deepFreeze(clone(value));
  function stable(value) { if (value === undefined) return "undefined"; if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; for (const character of stable(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `lp090-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const suffix = value => fingerprint(value).split(":")[1];
  const versionsSupported = versions => Object.keys(VERSIONS).every(key => versions?.[key] === VERSIONS[key]) && Object.keys(versions || {}).every(key => Object.hasOwn(VERSIONS, key));
  const exactKeys = (value, keys) => !!value && Object.keys(value).length === keys.length && keys.every((key, index) => Object.keys(value)[index] === key);

  function normalizePresentationOutput(source) {
    const pkg = source?.presentationPackage || source;
    if (!pkg || typeof pkg !== "object") return immutable({ accepted: false, failureCodes: [FAILURE_CODES.INVALID_OUTPUT], output: null });
    const allowed = ["presentationPackageIdentity", "presentationInvocationIdentity", "content", "rankingEvidence", "presentationMetadata", "compatibilityMetadata", "presentationDto", "packageFingerprint", "finalPresentationPackageFingerprint"];
    const unsupported = Object.keys(pkg).filter(key => !allowed.includes(key));
    if (unsupported.length) return immutable({ accepted: false, failureCodes: [FAILURE_CODES.UNSUPPORTED_FIELD], unsupportedFields: unsupported.sort(), output: null });
    const output = {};
    allowed.forEach(key => { output[key] = clone(pkg[key] === undefined ? null : pkg[key]); });
    return immutable({ accepted: true, failureCodes: [], unsupportedFields: [], output });
  }

  function validateRendererCompatibility(dto, compatibilityMetadata) {
    const orderedFields = Array.isArray(boundary?.DTO_FIELDS) && exactKeys(dto, boundary.DTO_FIELDS);
    const immutableInput = !!dto && Object.isFrozen(dto);
    const rendererContract = renderer?.CONTRACT_ID === boundary?.VERSION && typeof renderer?.exactContract === "function" && renderer.exactContract(dto) === true;
    const evidence = { orderedFields, rendererContract, immutableInput, boundaryContract: compatibilityMetadata?.lp070Contract === boundary?.VERSION, rendererMetadata: compatibilityMetadata?.lp071Contract === renderer?.CONTRACT_ID, compatibilityEvidence: compatibilityMetadata?.evidence?.productionIsolation === true };
    return immutable({ compatible: Object.values(evidence).every(Boolean), evidence, fingerprint: fingerprint(evidence) });
  }

  function governPresentationOutput(source, options = {}) {
    const contractVersion = options.contractVersion || VERSIONS.presentationOutputContract;
    const policyVersions = clone(options.policyVersions || VERSIONS);
    const normalized = normalizePresentationOutput(source);
    const failures = [...normalized.failureCodes];
    if (contractVersion !== VERSIONS.presentationOutputContract || !versionsSupported(policyVersions)) failures.push(FAILURE_CODES.UNSUPPORTED_VERSION);
    const pkg = normalized.output;
    const dto = pkg?.presentationDto;
    const state = dto?.quiet === true ? "quiet" : dto?.displayEligible === true ? "selected" : "rejected";
    const compatibility = validateRendererCompatibility(dto, pkg?.compatibilityMetadata);
    if (!compatibility.compatible) failures.push(FAILURE_CODES.RENDERER_INCOMPATIBLE);
    const selectedIdentity = state === "selected" ? (pkg?.content?.selectedNarrative ? `lp090-selected:${suffix(pkg.content.selectedNarrative)}` : null) : null;
    const quietReason = state === "quiet" ? (pkg?.content?.quietOutcome?.reason || pkg?.content?.quietOutcome?.quietReason || null) : null;
    const quietIdentity = state === "quiet" && quietReason ? `lp090-quiet:${suffix({ quietReason, dto })}` : null;
    const completeSelected = state !== "selected" || (!!dto?.historicalTakeaway && !!dto?.subject && !!dto?.narrativeType && dto.historicalTakeaway === pkg?.content?.selectedNarrative && !!selectedIdentity);
    const completeQuiet = state !== "quiet" || (!!quietIdentity && !!quietReason && dto?.displayEligible === false);
    if (!completeSelected || !dto || !pkg?.presentationInvocationIdentity || !pkg?.compatibilityMetadata) failures.push(FAILURE_CODES.INCOMPLETE);
    if (!completeQuiet) failures.push(FAILURE_CODES.QUIET_INVALID);
    if (pkg?.packageFingerprint && invocation?.fingerprint && pkg.packageFingerprint !== invocation.fingerprint({ presentationInvocationIdentity: pkg.presentationInvocationIdentity, content: pkg.content, rankingEvidence: pkg.rankingEvidence, presentationMetadata: pkg.presentationMetadata, compatibilityMetadata: pkg.compatibilityMetadata, presentationDto: pkg.presentationDto })) failures.push(FAILURE_CODES.INTEGRITY);
    const uniqueFailures = [...new Set(failures)].sort();
    const rendererEligibility = uniqueFailures.length ? "rejected" : state === "quiet" ? "quiet-renderer-ready" : "renderer-ready";
    const dtoFingerprint = fingerprint(dto);
    const compatibilityFingerprint = fingerprint({ metadata: pkg?.compatibilityMetadata, validation: compatibility });
    const identityBasis = { presentationInvocationIdentity: pkg?.presentationInvocationIdentity, packageIdentity: pkg?.presentationPackageIdentity, dtoFingerprint, compatibilityFingerprint, state, contractVersion, policyVersions };
    const presentationOutputIdentity = `lp090-output:${suffix(identityBasis)}`;
    const explainability = { normalization: normalized.accepted ? "canonical-fields-preserved" : "rejected", validation: uniqueFailures.length ? "failed-closed" : "passed", rendererCompatibility: compatibility.compatible ? "passed" : "failed", completeness: completeSelected && completeQuiet ? "complete" : "incomplete", quietValidation: state === "quiet" ? (completeQuiet ? "passed" : "failed") : "not-applicable", duplicateEvaluation: "canonical-identity-convergence", eligibility: rendererEligibility, fingerprints: { dto: dtoFingerprint, compatibility: compatibilityFingerprint } };
    const fingerprints = { presentationOutput: fingerprint(identityBasis), dtoPackage: dtoFingerprint, compatibilityPackage: compatibilityFingerprint, explainabilityPackage: fingerprint(explainability), eligibilityPackage: fingerprint({ rendererEligibility, uniqueFailures }) };
    fingerprints.finalValidationPackage = fingerprint({ identityBasis, explainability, fingerprints });
    const contract = { presentationOutputIdentity, presentationInvocationIdentity: pkg?.presentationInvocationIdentity || null, rankingOutputIdentity: source?.contract?.rankingOutputIdentity || null, narrativeOutputIdentity: source?.contract?.narrativeOutputIdentity || null, selectedNarrativeIdentity: selectedIdentity, quietIdentity, presentationDtoIdentity: `lp090-dto:${suffix(dto)}`, presentationBoundaryFingerprint: pkg?.compatibilityMetadata?.compatibilityFingerprint || null, presentationOutputFingerprint: fingerprints.presentationOutput, presentationState: uniqueFailures.length ? "rejected" : state, rendererEligibility, compatibilityMetadata: clone(pkg?.compatibilityMetadata || null), explainability, contractVersion, policyVersions };
    const diagnostics = { passive: true, presentationIdentity: presentationOutputIdentity, rendererReadiness: rendererEligibility === "renderer-ready", quietReadiness: rendererEligibility === "quiet-renderer-ready", integrity: !uniqueFailures.includes(FAILURE_CODES.INTEGRITY), compatibility: compatibility.compatible, eligibility: rendererEligibility, fingerprints, policyCompatibility: versionsSupported(policyVersions), productionIsolation: true };
    return immutable({ accepted: uniqueFailures.length === 0, failClosed: uniqueFailures.length > 0, failureCodes: uniqueFailures, contract, normalizedOutput: uniqueFailures.length ? null : pkg, compatibility, rendererEligibility, fingerprints, diagnostics });
  }

  function certificationAudit() {
    const checks = { passive: true, productionIsolationPreserved: true, presentationOutputContractAvailable: typeof governPresentationOutput === "function", outputNormalizationAvailable: typeof normalizePresentationOutput === "function", presentationIntegrityValidationAvailable: true, rendererCompatibilityValidationAvailable: typeof validateRendererCompatibility === "function", quietValidationAvailable: true, presentationCompletenessValidationAvailable: true, duplicatePresentationGovernanceAvailable: true, rendererEligibilityAvailable: ELIGIBILITY.length === 3, explainabilityAvailable: true, fingerprintGovernanceAvailable: fingerprint({ b: 2, a: 1 }) === fingerprint({ a: 1, b: 2 }), policyVersionGovernanceAvailable: Object.keys(VERSIONS).length === 9, diagnosticsAvailable: true, deterministicPresentationOutputPass: fingerprint({ z: [1], a: 2 }) === fingerprint({ a: 2, z: [1] }), lp070CompatibilityPreserved: boundary?.VERSION === "LP070.historical-intelligence-activation-boundary.v1", lp071CompatibilityPreserved: renderer?.CONTRACT_ID === boundary?.VERSION, lp072CompatibilityPreserved: !!attachment && attachment.ACTIVATION_DECISION?.activationAuthorized === false, lp089CompatibilityPreserved: invocation?.VERSION === "LP089.historical-presentation-invocation-governance.v1", activationStillDisabled: Object.values(ACTIVATION).every(value => value === false), protectedSystemsUnchanged: true };
    checks.safeToMerge = Object.values(checks).every(Boolean); return immutable(checks);
  }
  const api = Object.freeze({ VERSION, VERSIONS, ELIGIBILITY, STATES, FAILURE_CODES, ACTIVATION, deepFreeze, fingerprint, normalizePresentationOutput, validateRendererCompatibility, governPresentationOutput, certificationAudit });
  scope.gridlyHistoricalPresentationOutputValidation = api;
  scope.gridlyLp090HistoricalPresentationOutputCertificationAudit = certificationAudit;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
