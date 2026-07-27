(function attachHistoricalLearningOrchestration(globalScope) {
  "use strict";

  const VERSION = "LP079.historical-learning-orchestration.v1";
  const VERSIONS = Object.freeze({ orchestrationContract: VERSION, authorizationPolicy: "LP079.authorization.v1", checkpointSchema: "LP079.checkpoint.v1", resumePolicy: "LP079.resume.v1", dryRunPolicy: "LP079.dry-run.v1", concurrencyPolicy: "LP079.concurrency.v1", completionPolicy: "LP079.completion.v1" });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticExecution: false, automaticResume: false, automaticPersistence: false });
  const AUTHORIZATION = Object.freeze({ UNAUTHORIZED: "unauthorized", DRY_RUN: "dry-run-authorized", EXECUTION: "execution-authorized" });
  const FAILURE_CODES = Object.freeze({ ARCHIVE_VALIDATION_FAILURE: "archive_validation_failure", UNSUPPORTED_ARCHIVE_VERSION: "unsupported_archive_version", AUTHORIZATION_FAILURE: "authorization_failure", CHECKPOINT_INCOMPATIBILITY: "checkpoint_incompatibility", REPLAY_INTERRUPTION: "replay_interruption", DELIVERY_INTERRUPTION: "delivery_interruption", LIFECYCLE_VALIDATION_FAILURE: "lifecycle_validation_failure", CONFLICTING_EXECUTION: "conflicting_execution", INCOMPLETE_COMPLETION_EVIDENCE: "incomplete_completion_evidence", UNSUPPORTED_POLICY_VERSION: "unsupported_policy_version" });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach((key) => freeze(value[key])); } return value; }
  const immutable = (value) => freeze(clone(value));
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; const text = stable(value); for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `lp079-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const sealed = (kind, body) => immutable({ ...body, fingerprint: fingerprint({ kind, ...body }) });
  const failure = (code, detail, base = {}) => sealed("failure", { status: "rejected", complete: false, failureCodes: [code], diagnostics: [{ code, detail }], ...base });
  function versionsValid(versions) { return Object.keys(VERSIONS).every((key) => versions?.[key] === VERSIONS[key]); }

  function authorize(state, purpose) { return immutable({ state: Object.values(AUTHORIZATION).includes(state) ? state : AUTHORIZATION.UNAUTHORIZED, purpose: typeof purpose === "string" ? purpose.trim() : "", policyVersion: VERSIONS.authorizationPolicy }); }
  function createPlan(archive, options = {}) {
    const policyVersions = options.policyVersions || VERSIONS;
    if (!versionsValid(policyVersions)) return failure(FAILURE_CODES.UNSUPPORTED_POLICY_VERSION, "Every LP079 policy version must be explicitly supported.");
    const governed = { archiveId: archive?.archiveId || null, archiveFingerprint: archive?.archiveFingerprint || null, replayScope: options.replayScope || { kind: "complete-archive" }, geographyRegistryVersion: archive?.geographyRegistryVersion || null, timezoneRegistryVersion: options.timezoneRegistryVersion || archive?.timezoneId || null, lifecyclePolicyVersion: options.lifecyclePolicyVersion || null, orchestrationVersion: VERSION, policyVersions, cycleTime: options.cycleTime || null };
    const cycleId = `learning-cycle:${fingerprint(governed)}`;
    return sealed("plan", { status: "planned", cycleId, ...governed });
  }
  function validateFingerprint(record, kind) { if (!record?.fingerprint) return false; const body = clone(record); delete body.fingerprint; return record.fingerprint === fingerprint({ kind, ...body }); }

  function expectedReplay(archive, persistence) { return persistence.replay(archive, { authorized: true, purpose: "LP079 governed evaluation" }); }
  function dryRun({ archive, plan, authorization, persistence, lifecycle, existingLineages = [] }) {
    if (authorization?.state !== AUTHORIZATION.DRY_RUN) return failure(FAILURE_CODES.AUTHORIZATION_FAILURE, "Explicit dry-run authorization is required.", { cycleId: plan?.cycleId || null });
    if (!plan || plan.cycleId !== createPlan(archive, plan).cycleId) return failure(FAILURE_CODES.CHECKPOINT_INCOMPATIBILITY, "Plan does not match governed archive inputs.");
    const validation = persistence.validateArchive(archive);
    if (!validation.valid) return failure(validation.errors.some((e) => String(e.code).includes("version")) ? FAILURE_CODES.UNSUPPORTED_ARCHIVE_VERSION : FAILURE_CODES.ARCHIVE_VALIDATION_FAILURE, "Archive validation failed.", { archiveValidation: validation });
    const replay = expectedReplay(archive, persistence);
    if (replay.status !== "complete") return failure(FAILURE_CODES.REPLAY_INTERRUPTION, "Deterministic replay was not completed.");
    const lifecycleResult = lifecycle.evolve(existingLineages, replay.delivered, { now: plan.cycleTime });
    const body = { status: "dry-run-complete", complete: false, mode: "dry-run", cycleId: plan.cycleId, archiveValidation: validation, replayEligible: true, expectedObservationCount: replay.summary.delivered, expectedDuplicateCount: replay.summary.duplicatesSuppressed, expectedLifecycleDecisions: lifecycleResult.decisions.length, expectedCheckpointIdentity: `checkpoint:${plan.cycleId}`, expectedCompletionOutcome: lifecycleResult.validation.valid ? "complete" : "rejected", deliveredCount: 0, lifecycleStateChanged: false, planFingerprint: plan.fingerprint, lifecycleFingerprint: fingerprint(lifecycleResult) };
    return sealed("dry-run", body);
  }

  function acquireLease(plan, owner, activeLease) {
    if (!plan?.cycleId || typeof owner !== "string" || !owner.trim()) return failure(FAILURE_CODES.CONFLICTING_EXECUTION, "A deterministic cycle and explicit owner are required.");
    if (activeLease?.status === "active" && activeLease.cycleId === plan.cycleId) return failure(FAILURE_CODES.CONFLICTING_EXECUTION, "The cycle already has an active execution.", { concurrencyStatus: "conflict" });
    return sealed("lease", { status: "active", cycleId: plan.cycleId, owner: owner.trim(), token: fingerprint({ cycleId: plan.cycleId, owner: owner.trim(), policy: VERSIONS.concurrencyPolicy }), concurrencyPolicyVersion: VERSIONS.concurrencyPolicy });
  }
  function releaseLease(lease) { if (!validateFingerprint(lease, "lease") || lease.status !== "active") return failure(FAILURE_CODES.CONFLICTING_EXECUTION, "Only a valid active lease may be released."); const body = clone(lease); delete body.fingerprint; body.status = "released"; return sealed("lease", body); }
  function evaluateStaleLease(lease, evidence) { return immutable({ stale: lease?.status === "active" && evidence?.explicitlyStale === true && evidence?.token === lease.token, automaticRelease: false, code: evidence?.explicitlyStale === true ? "explicit_stale_evidence" : "stale_state_unproven" }); }

  function checkpoint(body) { return sealed("checkpoint", { checkpointSchemaVersion: VERSIONS.checkpointSchema, checkpointId: `checkpoint:${body.cycleId}:${body.lastGovernedSequence}:${body.completionStatus}`, ...body }); }
  function validateCheckpoint(value, plan, archive) {
    const reasons = [];
    if (value?.checkpointSchemaVersion !== VERSIONS.checkpointSchema) reasons.push("checkpoint_schema_unsupported");
    if (!validateFingerprint(value, "checkpoint")) reasons.push("checkpoint_fingerprint_invalid");
    if (value?.cycleId !== plan?.cycleId) reasons.push("cycle_identity_mismatch");
    if (value?.archiveId !== archive?.archiveId || value?.validatedArchiveFingerprint !== archive?.archiveFingerprint) reasons.push("archive_identity_mismatch");
    return immutable({ compatible: reasons.length === 0, reasons });
  }
  function evaluateResume({ archive, plan, checkpoint: prior, authorization, persistence }) {
    if (authorization?.state !== AUTHORIZATION.EXECUTION) return failure(FAILURE_CODES.AUTHORIZATION_FAILURE, "Resume requires explicit execution authorization.");
    const validation = persistence.validateArchive(archive); if (!validation.valid) return failure(FAILURE_CODES.ARCHIVE_VALIDATION_FAILURE, "The original archive no longer validates.");
    const compatibility = validateCheckpoint(prior, plan, archive); if (!compatibility.compatible) return failure(FAILURE_CODES.CHECKPOINT_INCOMPATIBILITY, "Checkpoint compatibility failed.", { resumeEligibility: false, checkpointValidation: compatibility });
    return sealed("resume", { status: prior.completionStatus === "complete" ? "already-complete" : "eligible", resumeEligibility: true, cycleId: plan.cycleId, nextSequence: prior.lastGovernedSequence + 1, deliveredObservationFingerprints: prior.deliveredObservationFingerprints, diagnostics: [{ code: "resume_state_verified", skippedCount: prior.deliveredObservationFingerprints.length }] });
  }

  function execute({ archive, plan, authorization, lease, persistence, learning, lifecycle, existingLineages = [], priorCheckpoint = null, completedResult = null, deliver }) {
    if (authorization?.state !== AUTHORIZATION.EXECUTION) return failure(FAILURE_CODES.AUTHORIZATION_FAILURE, "Explicit execution authorization is required.");
    if (!validateFingerprint(lease, "lease") || lease.status !== "active" || lease.cycleId !== plan?.cycleId) return failure(FAILURE_CODES.CONFLICTING_EXECUTION, "A matching active execution lease is required.");
    if (completedResult?.complete === true && completedResult.cycleId === plan.cycleId && validateFingerprint(completedResult, "completed")) return completedResult;
    const validation = persistence.validateArchive(archive); if (!validation.valid) return failure(validation.errors.some((e) => String(e.code).includes("version")) ? FAILURE_CODES.UNSUPPORTED_ARCHIVE_VERSION : FAILURE_CODES.ARCHIVE_VALIDATION_FAILURE, "Archive validation failed.");
    let already = [];
    if (priorCheckpoint) { const resume = evaluateResume({ archive, plan, checkpoint: priorCheckpoint, authorization, persistence }); if (!resume.resumeEligibility) return resume; if (priorCheckpoint.completionStatus === "complete") return failure(FAILURE_CODES.INCOMPLETE_COMPLETION_EVIDENCE, "A completed checkpoint requires its completed result for idempotent replay."); already = priorCheckpoint.deliveredObservationFingerprints; }
    const replay = expectedReplay(archive, persistence); if (replay.status !== "complete") return failure(FAILURE_CODES.REPLAY_INTERRUPTION, "Replay did not complete.");
    const pending = replay.delivered.filter((row) => !already.includes(row.fingerprint)); const delivered = [...already];
    for (const row of pending) { try { if (typeof deliver !== "function") throw new Error("missing delivery"); deliver(learning.toLP067Observations([row])[0]); delivered.push(row.fingerprint); } catch (_) { const partial = checkpoint({ cycleId: plan.cycleId, archiveId: archive.archiveId, validatedArchiveFingerprint: archive.archiveFingerprint, lastGovernedSequence: delivered.length - 1, deliveredObservationFingerprints: delivered, lifecycleResultFingerprint: null, completionStatus: "interrupted", policyVersions: VERSIONS, diagnosticSummary: [FAILURE_CODES.DELIVERY_INTERRUPTION] }); return failure(FAILURE_CODES.DELIVERY_INTERRUPTION, "Observation delivery was interrupted.", { cycleId: plan.cycleId, checkpoint: partial, deliveredCount: delivered.length }); } }
    const lp067Rows = learning.toLP067Observations(replay.delivered); const lifecycleResult = lifecycle.evolve(existingLineages, lp067Rows, { now: plan.cycleTime });
    if (!lifecycleResult.validation?.valid) return failure(FAILURE_CODES.LIFECYCLE_VALIDATION_FAILURE, "LP078 lifecycle validation failed.", { deliveredCount: delivered.length });
    const lifecycleFingerprint = fingerprint(lifecycleResult); const deliveryResult = sealed("delivery", { cycleId: plan.cycleId, deliveredObservationFingerprints: delivered, deliveredCount: delivered.length, duplicateCount: replay.summary.duplicatesSuppressed, replayEvidence: replay.summary.deterministicEvidence });
    const finalCheckpoint = checkpoint({ cycleId: plan.cycleId, archiveId: archive.archiveId, validatedArchiveFingerprint: archive.archiveFingerprint, lastGovernedSequence: archive.records.length - 1, deliveredObservationFingerprints: delivered, lifecycleResultFingerprint: lifecycleFingerprint, completionStatus: "complete", policyVersions: VERSIONS, diagnosticSummary: [] });
    const evidence = validation.valid && delivered.length === replay.summary.delivered && lifecycleResult.validation.valid && validateFingerprint(finalCheckpoint, "checkpoint");
    if (!evidence) return failure(FAILURE_CODES.INCOMPLETE_COMPLETION_EVIDENCE, "The completion boundary was not satisfied.", { checkpoint: finalCheckpoint });
    return sealed("completed", { status: "complete", complete: true, mode: "execution", cycleId: plan.cycleId, planFingerprint: plan.fingerprint, deliveryResult, lifecycleResult, lifecycleFingerprint, checkpoint: finalCheckpoint, diagnostics: { authorizationState: authorization.state, archiveValidation: "passed", replayScope: plan.replayScope, deliveredCount: delivered.length, duplicateCount: replay.summary.duplicatesSuppressed, lifecycleDecisionCount: lifecycleResult.decisions.length, checkpointStatus: "complete", resumeEligibility: true, concurrencyStatus: "leased", completionStatus: "complete", failureCodes: [] }, idempotencyEvidence: fingerprint({ cycleId: plan.cycleId, delivered, lifecycleFingerprint, checkpoint: finalCheckpoint.fingerprint }) });
  }

  const api = Object.freeze({ VERSION, VERSIONS, ACTIVATION, AUTHORIZATION, FAILURE_CODES, fingerprint, authorize, createPlan, dryRun, acquireLease, releaseLease, evaluateStaleLease, checkpoint, validateCheckpoint, evaluateResume, execute });
  globalScope.gridlyHistoricalLearningOrchestration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
