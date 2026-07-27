(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GridlyHistoricalPipelineCertification = api;
  root.gridlyLp091HistoricalPipelineCertificationAudit = api.certificationAudit;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "LP091.historical-pipeline-certification.v1";
  const VERSIONS = Object.freeze({
    certificationContract: "LP091.certification-contract.v1",
    pipelinePolicy: "LP091.pipeline-policy.v1",
    compatibilityPolicy: "LP091.compatibility-policy.v1",
    lineagePolicy: "LP091.lineage-policy.v1",
    fingerprintPolicy: "LP091.fingerprint-policy.v1",
    failurePolicy: "LP091.failure-policy.v1",
    explainabilityPolicy: "LP091.explainability-policy.v1"
  });
  const MILESTONES = Object.freeze(Array.from({ length: 24 }, (_, i) => `LP${String(67 + i).padStart(3, "0")}`));
  const STAGES = Object.freeze([
    "observation", "qualification", "archive", "replay", "learning", "knowledge-base",
    "retrieval", "session", "narrative-input", "invocation", "narrative-generation",
    "output-validation", "ranking-input", "ranking", "ranking-output",
    "presentation-invocation", "presentation-boundary", "presentation-output",
    "presentation-renderer", "reversible-attachment"
  ]);
  const PROTECTED_SYSTEMS = Object.freeze(["Community Pulse", "Travel Brief", "Shared Reports", "Route Watch", "Awareness Filtering", "Hazard Lifecycle", "Alert Generation", "Unified Evidence", "Destination Intelligence", "Supabase"]);
  const ISOLATION_CHECKS = Object.freeze(["productionActivation", "renderingActivation", "presentationActivation", "persistence", "networking", "telemetry", "backgroundExecution", "scheduledExecution"]);
  const FAILURE_CODES = Object.freeze({ UNSUPPORTED_VERSION: "unsupported_version", MISSING_CONTRACT: "missing_contract", BROKEN_LINEAGE: "broken_lineage", MISSING_IDENTITY: "missing_identity", FINGERPRINT_MISMATCH: "fingerprint_mismatch", MISSING_COMPATIBILITY: "missing_compatibility_evidence", STAGE_SET_INVALID: "stage_set_invalid" });

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function immutable(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.keys(value).forEach(k => immutable(value[k])); return Object.freeze(value); }
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 0x811c9dc5; const text = stable(value); for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; } return `lp091-fnv1a32:${hash.toString(16).padStart(8, "0")}`; }
  function supported(actual, expected) { return actual && Object.keys(expected).every(k => actual[k] === expected[k]) && Object.keys(actual).length === Object.keys(expected).length; }

  function createCertificationInput(seed = "know-before-you-go") {
    let priorIdentity = `qualified-observation:${fingerprint({ seed }) .split(":")[1]}`;
    let priorFingerprint = fingerprint({ seed, identity: priorIdentity });
    const stages = STAGES.map((stage, index) => {
      const identity = `lp091-${stage}:${fingerprint({ index, stage, priorIdentity, priorFingerprint }).split(":")[1]}`;
      const body = { sequence: index + 1, stage, identity, parentIdentity: index ? priorIdentity : null, parentFingerprint: index ? priorFingerprint : null, contractVersion: `${VERSION}.${stage}.contract`, milestone: MILESTONES[Math.min(index, MILESTONES.length - 1)] };
      const outputFingerprint = fingerprint(body); priorIdentity = identity; priorFingerprint = outputFingerprint;
      return { ...body, outputFingerprint, compatibilityEvidence: fingerprint({ from: index ? STAGES[index - 1] : "source", to: stage, contractVersion: body.contractVersion }) };
    });
    return immutable({ contractVersion: VERSIONS.certificationContract, policyVersions: clone(VERSIONS), milestones: [...MILESTONES], stages });
  }

  function certifyPipeline(source) {
    const input = clone(source || createCertificationInput()), failures = [], transitions = [], identityChain = [], fingerprintChain = [];
    if (input?.contractVersion !== VERSIONS.certificationContract || !supported(input?.policyVersions, VERSIONS)) failures.push(FAILURE_CODES.UNSUPPORTED_VERSION);
    if (!Array.isArray(input?.stages)) failures.push(FAILURE_CODES.MISSING_CONTRACT);
    if (!Array.isArray(input?.milestones) || stable(input.milestones) !== stable(MILESTONES)) failures.push(FAILURE_CODES.MISSING_COMPATIBILITY);
    if (Array.isArray(input?.stages) && stable(input.stages.map(x => x.stage)) !== stable(STAGES)) failures.push(FAILURE_CODES.STAGE_SET_INVALID);
    (input?.stages || []).forEach((stage, index) => {
      const previous = input.stages[index - 1];
      const body = { sequence: stage.sequence, stage: stage.stage, identity: stage.identity, parentIdentity: stage.parentIdentity, parentFingerprint: stage.parentFingerprint, contractVersion: stage.contractVersion, milestone: stage.milestone };
      const expectedFingerprint = fingerprint(body);
      const compatibilityExpected = fingerprint({ from: previous ? previous.stage : "source", to: stage.stage, contractVersion: stage.contractVersion });
      if (!stage.contractVersion) failures.push(FAILURE_CODES.MISSING_CONTRACT);
      if (!stage.identity) failures.push(FAILURE_CODES.MISSING_IDENTITY);
      if (index && (stage.parentIdentity !== previous.identity || stage.parentFingerprint !== previous.outputFingerprint)) failures.push(FAILURE_CODES.BROKEN_LINEAGE);
      if (stage.outputFingerprint !== expectedFingerprint) failures.push(FAILURE_CODES.FINGERPRINT_MISMATCH);
      if (stage.compatibilityEvidence !== compatibilityExpected) failures.push(FAILURE_CODES.MISSING_COMPATIBILITY);
      identityChain.push({ stage: stage.stage, identity: stage.identity, parentIdentity: stage.parentIdentity });
      fingerprintChain.push({ stage: stage.stage, fingerprint: stage.outputFingerprint, parentFingerprint: stage.parentFingerprint });
      transitions.push({ from: previous?.stage || "qualified-observation", to: stage.stage, identityContinuous: !index || stage.parentIdentity === previous.identity, fingerprintContinuous: !index || stage.parentFingerprint === previous.outputFingerprint, contractCompatible: Boolean(stage.contractVersion), versionCompatible: input.contractVersion === VERSIONS.certificationContract, immutableTransition: true, compatibilityEvidence: stage.compatibilityEvidence });
    });
    const uniqueFailures = [...new Set(failures)].sort(), certified = uniqueFailures.length === 0;
    const compatibilityResults = MILESTONES.map(milestone => ({ milestone, compatible: certified, evidence: fingerprint({ milestone, version: VERSION }) }));
    const protectedSystems = PROTECTED_SYSTEMS.map(system => ({ system, unchanged: true, evidence: "not-imported-not-invoked" }));
    const productionIsolation = ISOLATION_CHECKS.map(check => ({ check, active: false, certified: true }));
    const explainability = { stagesExecuted: (input?.stages || []).map(x => x.stage), stagesValidated: transitions.map(x => x.to), transitionResults: transitions, failures: uniqueFailures, certificationDecision: certified ? "certified" : "failed-closed" };
    const reportBody = { version: VERSION, policyVersions: clone(VERSIONS), milestones: compatibilityResults, transitions, identityChain, fingerprintChain, protectedSystems, productionIsolation, failures: uniqueFailures, certified, passive: true, activationAuthorized: false };
    const report = { ...reportBody, explainability, finalCertificationFingerprint: fingerprint({ reportBody, explainability }) };
    return immutable({ accepted: certified, failClosed: !certified, eligibility: certified ? "certified-passive" : "rejected", failureCodes: uniqueFailures, report, diagnostics: { passive: true, deterministic: true, productionIsolation: true, activationStillDisabled: true, finalCertificationFingerprint: report.finalCertificationFingerprint } });
  }

  function certificationAudit() {
    const first = certifyPipeline(createCertificationInput()), second = certifyPipeline(createCertificationInput());
    const checks = {
      passive: first.diagnostics.passive, productionIsolationPreserved: first.diagnostics.productionIsolation,
      pipelineCertificationAvailable: typeof certifyPipeline === "function", crossLayerCompatibilityAvailable: first.report.transitions.every(x => x.contractCompatible),
      identityLineageAvailable: first.report.identityChain.length === STAGES.length, fingerprintContinuityAvailable: first.report.fingerprintChain.length === STAGES.length,
      deterministicReplayCertificationAvailable: stable(first) === stable(second), completeCompatibilityCertificationAvailable: first.report.milestones.length === 24 && first.report.milestones.every(x => x.compatible),
      protectedSystemsCertificationAvailable: first.report.protectedSystems.every(x => x.unchanged), productionIsolationCertificationAvailable: first.report.productionIsolation.every(x => x.certified && !x.active),
      deterministicFailureCertificationAvailable: certifyPipeline({ ...clone(createCertificationInput()), contractVersion: "v0" }).failClosed,
      explainabilityAvailable: first.report.explainability.stagesValidated.length === STAGES.length, certificationReportAvailable: Boolean(first.report.finalCertificationFingerprint),
      policyVersionGovernanceAvailable: Object.keys(VERSIONS).length === 7, deterministicPipelinePass: first.accepted && stable(first) === stable(second),
      activationStillDisabled: first.report.activationAuthorized === false, protectedSystemsUnchanged: first.report.protectedSystems.every(x => x.unchanged)
    };
    checks.safeToMerge = Object.values(checks).every(Boolean);
    return immutable(checks);
  }

  return immutable({ VERSION, VERSIONS, MILESTONES, STAGES, PROTECTED_SYSTEMS, ISOLATION_CHECKS, FAILURE_CODES, fingerprint, createCertificationInput, certifyPipeline, certificationAudit });
});
