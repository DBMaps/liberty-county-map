(function attachHistoricalLearningQualityGovernance(globalScope) {
  "use strict";

  const VERSION = "LP080.historical-learning-quality.v1";
  const VERSIONS = Object.freeze({ evidenceQualityPolicy: "LP080.evidence-quality.v1", independencePolicy: "LP080.independence.v1", confidencePolicy: "LP080.confidence.v1", contradictionPolicy: "LP080.contradiction.v1", outlierPolicy: "LP080.outlier.v1", eligibilityPolicy: "LP080.eligibility.v1", integrityValidationPolicy: "LP080.integrity-validation.v1" });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticExecution: false, persistence: false, telemetry: false });
  const FAILURE_CODES = Object.freeze({ UNSUPPORTED_POLICY_VERSION: "unsupported_policy_version", INVALID_EVIDENCE: "invalid_evidence", INTEGRITY_VALIDATION_FAILURE: "integrity_validation_failure" });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach((key) => freeze(value[key])); } return value; }
  const immutable = (value) => freeze(clone(value));
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; const text = stable(value); for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `lp080-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const validVersions = (versions) => Object.keys(VERSIONS).every((key) => versions?.[key] === VERSIONS[key]);
  const reject = (code, detail) => immutable({ accepted: false, status: "rejected", failureCodes: [code], diagnostics: [{ code, detail }] });
  function policy(options = {}) { return validVersions(options.policyVersions || VERSIONS) ? null : reject(FAILURE_CODES.UNSUPPORTED_POLICY_VERSION, "Every LP080 policy version must be explicitly supported; migration is not automatic."); }
  const identity = (row) => row?.fingerprint || row?.archiveId || row?.sourceObservationId || null;
  const time = (row) => Date.parse(row?.observationTimestamp);

  function evaluateEvidence(row, options = {}) {
    const denied = policy(options); if (denied) return denied;
    const reasons = [], cautions = [];
    if (!row || typeof row !== "object" || row.qualificationStatus !== "qualified") reasons.push("not_qualified");
    if (!identity(row)) reasons.push("missing_governed_identity");
    if (!Number.isFinite(time(row))) reasons.push("invalid_observation_time");
    if (!row?.behaviorKey || !row?.archiveId) reasons.push("incomplete_archive_lineage");
    if (!row?.sourceObservationId) cautions.push("source_identity_unavailable");
    const classification = reasons.length ? "ineligible" : cautions.length ? "qualified" : "high-quality";
    return immutable({ accepted: true, classification, contributes: reasons.length === 0, reasons, cautions, evidenceIdentity: identity(row), policyVersion: VERSIONS.evidenceQualityPolicy, fingerprint: fingerprint({ classification, reasons, cautions, identity: identity(row) }) });
  }

  function evaluateIndependence(row, prior = [], options = {}) {
    const denied = policy(options); if (denied) return denied;
    const matches = (Array.isArray(prior) ? prior : []).filter((other) => identity(other) === identity(row) || other?.archiveId === row?.archiveId || (other?.sourceObservationId && other.sourceObservationId === row?.sourceObservationId) || (other?.fingerprint && other.fingerprint === row?.fingerprint));
    const lineageMatch = (Array.isArray(prior) ? prior : []).some((other) => options.lineageId && options.lineageId === other?.lineageId && time(other) === time(row));
    const independent = matches.length === 0 && !lineageMatch;
    return immutable({ accepted: true, independent, classification: independent ? "independent" : "duplicate-dependent", matchingEvidenceIdentities: [...new Set(matches.map(identity))].sort(), policyVersion: VERSIONS.independencePolicy, fingerprint: fingerprint({ independent, matches: matches.map(identity).sort(), lineageMatch }) });
  }

  function classifyContradiction(row, pattern, options = {}) {
    const denied = policy(options); if (denied) return denied;
    let classification = "unresolved";
    if (row?.behaviorKey && row.behaviorKey === pattern?.behaviorKey) classification = row.eventType === pattern.eventType || !pattern.eventType ? "reinforcing" : "conflicting";
    if (classification === "conflicting" && Number.isFinite(time(row)) && Number.isFinite(Date.parse(pattern?.lastObservationTimestamp)) && time(row) > Date.parse(pattern.lastObservationTimestamp) && options.explicitSupersession === true) classification = "superseded";
    return immutable({ accepted: true, classification, policyVersion: VERSIONS.contradictionPolicy, fingerprint: fingerprint({ evidence: identity(row), pattern: pattern?.patternId || pattern?.behaviorKey || null, classification }) });
  }

  function detectOutlier(row, peers = [], options = {}) {
    const denied = policy(options); if (denied) return denied;
    const comparable = (Array.isArray(peers) ? peers : []).filter((p) => p?.behaviorKey === row?.behaviorKey && Number.isFinite(p?.minuteOfDay)).map((p) => p.minuteOfDay).sort((a, b) => a - b);
    let reason = null;
    if (comparable.length >= 3 && Number.isFinite(row?.minuteOfDay)) { const median = comparable[Math.floor(comparable.length / 2)]; if (Math.abs(row.minuteOfDay - median) > 360) reason = "time_distance_exceeds_six_hours"; }
    if (Number.isFinite(row?.durationMinutes) && row.durationMinutes > 1440) reason = "duration_exceeds_governed_day";
    return immutable({ accepted: true, outlier: Boolean(reason), classification: reason ? "outlier" : "typical", reason, contributionLimited: Boolean(reason), policyVersion: VERSIONS.outlierPolicy, fingerprint: fingerprint({ evidence: identity(row), reason }) });
  }

  function determineEligibility({ evidence, independence, contradiction, outlier, patternExists = false }, options = {}) {
    const denied = policy(options); if (denied) return denied;
    let decision = "archive-only", reason = "quality_not_eligible";
    if (evidence?.contributes && independence?.independent && !outlier?.outlier && contradiction?.classification === "reinforcing") { decision = patternExists ? "strengthen-existing-pattern" : "create-candidate-pattern"; reason = "independent_reinforcing_evidence"; }
    else if (evidence?.contributes && independence?.independent && !outlier?.outlier && contradiction?.classification === "unresolved" && !patternExists) { decision = "create-candidate-pattern"; reason = "independent_candidate_evidence"; }
    return immutable({ accepted: true, decision, influencesLearning: decision !== "archive-only", reason, policyVersion: VERSIONS.eligibilityPolicy, fingerprint: fingerprint({ decision, reason }) });
  }

  function calibrateConfidence(evidenceDecisions, options = {}) {
    const denied = policy(options); if (denied) return denied;
    const unique = new Map(); (Array.isArray(evidenceDecisions) ? evidenceDecisions : []).forEach((item) => { const id = item.evidenceIdentity || item.fingerprint; if (id && !unique.has(id)) unique.set(id, item); });
    let units = 0; unique.forEach((item) => { if (item.eligibility?.influencesLearning) units += item.quality === "high-quality" ? 2 : 1; });
    const level = units >= 6 ? "established" : units >= 3 ? "supported" : units >= 1 ? "emerging" : "unconfirmed";
    return immutable({ accepted: true, level, evidenceUnits: units, independentEvidenceCount: unique.size, policyVersion: VERSIONS.confidencePolicy, fingerprint: fingerprint({ ids: [...unique.keys()].sort(), units, level }) });
  }

  function evaluatePatternQuality(pattern, evidenceDecisions = [], options = {}) {
    const denied = policy(options); if (denied) return denied;
    const counts = { reinforcing: 0, conflicting: 0, superseded: 0, unresolved: 0, outliers: 0, independent: 0 };
    evidenceDecisions.forEach((x) => { if (counts[x.contradiction] !== undefined) counts[x.contradiction] += 1; if (x.outlier) counts.outliers += 1; if (x.independent) counts.independent += 1; });
    const criteria = { evidenceConsistency: counts.conflicting === 0, observationDiversity: counts.independent >= 2, archiveStability: options.archiveValid !== false, lifecycleStability: options.lifecycleValid !== false, replayConsistency: options.replayConsistent !== false };
    return immutable({ accepted: true, classification: Object.values(criteria).every(Boolean) ? "stable" : "review-required", criteria, counts, consumerQualityScore: null, fingerprint: fingerprint({ pattern: pattern?.patternId || null, criteria, counts }) });
  }

  function validatePatternIntegrity(pattern, context = {}, options = {}) {
    const denied = policy(options); if (denied) return denied;
    const failures = [];
    if (!pattern?.patternId || (context.expectedPatternId && pattern.patternId !== context.expectedPatternId)) failures.push("deterministic_identity_failure");
    if (!pattern?.behaviorKey || context.lineageValid === false) failures.push("lineage_integrity_failure");
    if (!pattern?.confidence || context.confidenceConsistent === false) failures.push("confidence_consistency_failure");
    if (context.lifecycleCompatible === false) failures.push("lifecycle_compatibility_failure");
    if (context.archiveCompatible === false) failures.push("archive_compatibility_failure");
    if (context.replayCompatible === false) failures.push("replay_compatibility_failure");
    return immutable({ accepted: failures.length === 0, valid: failures.length === 0, failClosed: failures.length > 0, failureCodes: failures.length ? [FAILURE_CODES.INTEGRITY_VALIDATION_FAILURE] : [], failures, policyVersion: VERSIONS.integrityValidationPolicy, fingerprint: fingerprint({ pattern: pattern?.patternId || null, failures }) });
  }

  function govern(rows, pattern = null, options = {}) {
    const denied = policy(options); if (denied) return denied;
    const ordered = (Array.isArray(rows) ? rows : []).slice().sort((a, b) => String(identity(a)).localeCompare(String(identity(b))));
    const decisions = ordered.map((row, index) => { const quality = evaluateEvidence(row), independence = evaluateIndependence(row, ordered.slice(0, index)), contradiction = classifyContradiction(row, pattern), outlier = detectOutlier(row, ordered.filter((x) => x !== row)), eligibility = determineEligibility({ evidence: quality, independence, contradiction, outlier, patternExists: Boolean(pattern) }); return { evidenceIdentity: identity(row), quality: quality.classification, independent: independence.independent, contradiction: contradiction.classification, outlier: outlier.outlier, eligibility }; });
    const confidence = calibrateConfidence(decisions); const patternQuality = evaluatePatternQuality(pattern, decisions, options);
    const diagnostics = { qualityClassifications: decisions.map((x) => x.quality), independenceEvaluations: decisions.map((x) => x.independent), contradictoryEvidenceCounts: patternQuality.counts, outlierCount: patternQuality.counts.outliers, eligibilityDecisions: decisions.map((x) => x.eligibility.decision), confidenceCalibration: confidence, integrityValidation: options.integrityValidation || null };
    return immutable({ accepted: true, passive: true, decisions, confidence, patternQuality, diagnostics, qualityGovernanceFingerprint: fingerprint({ decisions, confidence, patternQuality }), policyVersions: VERSIONS });
  }

  const api = Object.freeze({ VERSION, VERSIONS, ACTIVATION, FAILURE_CODES, fingerprint, evaluateEvidence, evaluateIndependence, classifyContradiction, detectOutlier, determineEligibility, calibrateConfidence, evaluatePatternQuality, validatePatternIntegrity, govern });
  globalScope.gridlyHistoricalLearningQualityGovernance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
