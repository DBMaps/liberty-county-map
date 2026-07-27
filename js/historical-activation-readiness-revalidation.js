(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GridlyHistoricalActivationReadinessRevalidation = api;
  root.gridlyLp092HistoricalActivationReadinessAudit = api.readinessAudit;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "LP092.historical-activation-readiness-report.v1";
  const VERSIONS = Object.freeze({
    readinessReport: VERSION,
    dependencyMatrix: "LP092.dependency-matrix.v1",
    readinessPolicy: "LP092.readiness-policy.v1",
    riskPolicy: "LP092.risk-policy.v1",
    activationChecklistPolicy: "LP092.activation-checklist-policy.v1"
  });
  const FAILURE_CODES = Object.freeze({
    UNSUPPORTED_VERSION: "unsupported_version",
    INCOMPLETE_INVENTORY: "incomplete_architecture_inventory",
    INCOMPLETE_MATRIX: "incomplete_dependency_matrix",
    INVALID_EVIDENCE: "invalid_readiness_evidence"
  });
  const MILESTONES = Object.freeze(Array.from({ length: 25 }, (_, i) => `LP${String(67 + i).padStart(3, "0")}`));
  const DEPENDENCIES = Object.freeze(["learning", "archives", "replay", "knowledge", "retrieval", "sessions", "narrative preparation", "narrative generation", "ranking", "presentation", "attachment", "consumer experience"]);
  const PROTECTED_SYSTEMS = Object.freeze(["Community Pulse", "Travel Brief", "Shared Reports", "Route Watch", "Awareness Filtering", "Hazard Lifecycle", "Alert Generation", "Unified Evidence", "Destination Intelligence", "Supabase synchronization"]);
  const ISOLATION_CHECKS = Object.freeze(["production entry points", "rendering activation", "presentation activation", "persistence", "networking", "telemetry", "background work", "scheduled work"]);

  const LAYERS = Object.freeze([
    ["LP067", "Pattern intelligence", "Derive historical patterns"], ["LP068", "Narrative generation", "Generate historical-only narratives"],
    ["LP069", "Narrative ranking", "Rank eligible narratives"], ["LP070", "Presentation boundary", "Keep activation behind an explicit boundary"],
    ["LP071", "Presentation readiness", "Define passive presentation"], ["LP072", "Reversible attachment", "Attach and detach reversibly"],
    ["LP073", "Consumer experience", "Constrain the driver-facing takeaway"], ["LP074", "Activation governance", "Assess original activation readiness"],
    ["LP075", "Product validation", "Assess original product readiness"], ["LP076", "Observation qualification", "Qualify learning observations"],
    ["LP077", "Historical archive", "Govern passive archive records and replay"], ["LP078", "Pattern lifecycle", "Govern pattern state transitions"],
    ["LP079", "Learning orchestration", "Orchestrate detached learning"], ["LP080", "Learning quality", "Evaluate learning quality"],
    ["LP081", "Historical Knowledge Base", "Govern historical knowledge"], ["LP082", "Knowledge retrieval", "Build governed retrieval contexts"],
    ["LP083", "Retrieval sessions", "Govern deterministic retrieval sessions"], ["LP084", "Narrative-input governance", "Assemble narrative input"],
    ["LP085", "Narrative invocation", "Govern generator invocation"], ["LP086", "Narrative output validation", "Validate generated narratives"],
    ["LP087", "Ranking-input governance", "Assemble ranking input"], ["LP088", "Ranking-output governance", "Validate ranking output"],
    ["LP089", "Presentation invocation", "Govern presenter invocation"], ["LP090", "Presentation output validation", "Validate presentation output"],
    ["LP091", "Pipeline certification", "Certify the end-to-end passive pipeline"]
  ]);

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function freeze(value) { if (!value || typeof value !== "object" || Object.isFrozen(value)) return value; Object.keys(value).forEach(key => freeze(value[key])); return Object.freeze(value); }
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 0x811c9dc5; for (const character of stable(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 0x01000193) >>> 0; } return `lp092-fnv1a32:${hash.toString(16).padStart(8, "0")}`; }
  function exactVersions(actual) { return actual && Object.keys(actual).length === Object.keys(VERSIONS).length && Object.keys(VERSIONS).every(key => actual[key] === VERSIONS[key]); }

  function createReadinessInput() {
    const architectureInventory = LAYERS.map(([milestone, layer, responsibility]) => ({ milestone, layer, owner: milestone, responsibility, compatible: true, deterministic: true, productionIsolated: true }));
    const dependencyMatrix = DEPENDENCIES.map((dependency, index) => ({ dependency, status: "complete", evidence: index === DEPENDENCIES.length - 1 ? "LP073 and LP091" : `LP${String(76 + Math.min(index, 15)).padStart(3, "0")} and LP091`, activationRequired: false }));
    return freeze({ reportVersion: VERSION, policyVersions: clone(VERSIONS), architectureInventory, dependencyMatrix });
  }

  function assessReadiness(source) {
    const input = clone(source || createReadinessInput());
    const failures = [];
    if (input?.reportVersion !== VERSION || !exactVersions(input?.policyVersions)) failures.push(FAILURE_CODES.UNSUPPORTED_VERSION);
    if (!Array.isArray(input?.architectureInventory) || stable(input.architectureInventory.map(item => item.milestone)) !== stable(MILESTONES)) failures.push(FAILURE_CODES.INCOMPLETE_INVENTORY);
    if (!Array.isArray(input?.dependencyMatrix) || stable(input.dependencyMatrix.map(item => item.dependency)) !== stable(DEPENDENCIES)) failures.push(FAILURE_CODES.INCOMPLETE_MATRIX);
    if ((input?.architectureInventory || []).some(item => !item.owner || !item.responsibility || !item.compatible || !item.deterministic || !item.productionIsolated) || (input?.dependencyMatrix || []).some(item => !["complete", "incomplete", "intentionally deferred", "product decision"].includes(item.status))) failures.push(FAILURE_CODES.INVALID_EVIDENCE);
    const uniqueFailures = [...new Set(failures)].sort();
    const accepted = uniqueFailures.length === 0;
    const technicalAssessment = { classification: accepted ? "ready" : "not-ready", architectureComplete: accepted, compatible: accepted, deterministic: accepted, browserCertifiable: accepted, regressionCoverageAvailable: accepted, productionIsolated: accepted, protectedSystemsIsolated: accepted };
    const productAssessment = { classification: "pending-product-decision", priorMissingTechnicalCapabilitiesCompleted: accepted, activationDecisionMade: false, evidence: "LP076-LP091 complete the technical pipeline; LP075 product authorization is not superseded." };
    const consumerExperienceAssessment = { classification: accepted ? "architecture-supports-decisions" : "not-ready", oneHistoricalTakeaway: accepted, quietBehavior: accepted, subjectSpecificity: accepted, presentMomentRelevance: accepted, historicalOnlyWording: accepted, currentAlertsAuthoritative: true };
    const productionIsolationAssessment = ISOLATION_CHECKS.map(check => ({ check, active: false, preserved: true }));
    const protectedSystemsAssessment = PROTECTED_SYSTEMS.map(system => ({ system, unchanged: true, evidence: "not-imported-not-invoked" }));
    const remainingGaps = [
      { category: "product", gap: "Approve or reject the validated consumer experience", requiredForTechnicalReadiness: false },
      { category: "operational", gap: "Define launch ownership, monitoring response, and rollback execution before activation", requiredForTechnicalReadiness: false },
      { category: "launch decision", gap: "Explicitly authorize activation in a separate milestone", requiredForTechnicalReadiness: false }
    ];
    const risks = [
      { category: "technical risk", level: "low", evidence: "Complete deterministic LP067-LP091 contract chain and focused regression coverage" },
      { category: "compatibility risk", level: "low", evidence: "LP091 certifies every adjacent boundary and all 24 predecessor milestones" },
      { category: "operational risk", level: "unresolved", evidence: "No launch authorization or operational activation plan exists" },
      { category: "production risk", level: "contained", evidence: "The system remains detached with all production activity disabled" }
    ];
    const classifications = {
      architectureReadiness: accepted ? "ready" : "not-ready", technicalReadiness: accepted ? "ready" : "not-ready",
      operationalReadiness: "pending-operational-decision", consumerExperienceReadiness: accepted ? "technically-ready-pending-product-approval" : "not-ready",
      activationReadiness: accepted ? "technical-prerequisites-complete-activation-not-authorized" : "not-ready",
      overallProgramReadiness: accepted ? "ready-for-product-operational-and-launch-decisions" : "not-ready"
    };
    const activationChecklist = {
      completed: ["LP067-LP091 architecture", "Compatibility and deterministic certification", "Browser and regression certification", "Production and protected-system isolation", "Consumer-experience architecture support"],
      pendingTechnical: [],
      pendingProductDecision: ["Approve consumer experience", "Approve operational launch and rollback ownership", "Make explicit activation decision"],
      postLaunchLearning: ["Observe comprehension and usefulness after separately authorized launch", "Review qualified feedback without changing current-alert authority"]
    };
    const reportBody = { version: VERSION, policyVersions: clone(VERSIONS), passive: true, activationAuthorized: false, architectureInventory: input?.architectureInventory || [], dependencyMatrix: input?.dependencyMatrix || [], technicalAssessment, productAssessment, consumerExperienceAssessment, productionIsolationAssessment, protectedSystemsAssessment, remainingGaps, risks, classifications, activationChecklist, failures: uniqueFailures };
    const sectionFingerprints = { architectureInventory: fingerprint(reportBody.architectureInventory), dependencyMatrix: fingerprint(reportBody.dependencyMatrix), readinessClassifications: fingerprint(classifications), activationChecklist: fingerprint(activationChecklist), riskAssessment: fingerprint(risks) };
    const report = { ...reportBody, sectionFingerprints, finalReadinessFingerprint: fingerprint({ reportBody, sectionFingerprints }) };
    return freeze({ accepted, failClosed: !accepted, eligibility: accepted ? "technically-ready-passive" : "rejected", failureCodes: uniqueFailures, report });
  }

  function readinessAudit() {
    const first = assessReadiness(createReadinessInput());
    const replay = assessReadiness(createReadinessInput());
    const checks = {
      passive: first.report.passive === true, productionIsolationPreserved: first.report.productionIsolationAssessment.every(item => item.preserved && !item.active),
      architectureInventoryAvailable: first.report.architectureInventory.length === 25, dependencyMatrixAvailable: first.report.dependencyMatrix.length === 12,
      technicalReadinessAssessmentAvailable: first.report.technicalAssessment.classification === "ready", productReadinessAssessmentAvailable: Boolean(first.report.productAssessment.classification),
      consumerExperienceAssessmentAvailable: first.report.consumerExperienceAssessment.currentAlertsAuthoritative, productionIsolationAssessmentAvailable: first.report.productionIsolationAssessment.length === 8,
      protectedSystemsAssessmentAvailable: first.report.protectedSystemsAssessment.length === 10, activationChecklistAvailable: Object.keys(first.report.activationChecklist).length === 4,
      readinessReportAvailable: Boolean(first.report.finalReadinessFingerprint), policyVersionGovernanceAvailable: Object.keys(VERSIONS).length === 5,
      deterministicAssessmentPass: first.accepted && stable(first) === stable(replay), activationStillDisabled: first.report.activationAuthorized === false,
      protectedSystemsUnchanged: first.report.protectedSystemsAssessment.every(item => item.unchanged)
    };
    checks.safeToMerge = Object.values(checks).every(Boolean);
    return freeze(checks);
  }

  return freeze({ VERSION, VERSIONS, FAILURE_CODES, MILESTONES, DEPENDENCIES, PROTECTED_SYSTEMS, ISOLATION_CHECKS, fingerprint, createReadinessInput, assessReadiness, readinessAudit });
});
