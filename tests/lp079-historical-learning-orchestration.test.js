const assert = require("node:assert/strict");
const fs = require("node:fs");
const orchestration = require("../js/historical-learning-orchestration.js");
const persistence = require("../js/historical-archive-persistence.js");
const learning = require("../js/historical-observation-learning.js");
const lifecycle = require("../js/historical-pattern-lifecycle.js");
const lp067 = require("../js/historical-pattern-intelligence.js");

const source = (id, timestamp) => ({ id, awareness_area: "Dayton", community: "Dayton", county: "Liberty County", crossing_name: "Waco Street", hazard_type: "blocked_crossing", event_type: "rail_delay", observed_at: timestamp });
const qualification = { validAwarenessAreas: ["Dayton"], validCounties: ["Liberty County"] };
const records = [source("a", "2026-06-01T12:00:00Z"), source("b", "2026-06-08T12:00:00Z"), source("copy", "2026-06-08T12:00:00Z")].map((row) => learning.archiveObservation(row, qualification).record);
const metadata = { archiveVersion: 1, archiveId: "lp079-liberty", createdAt: "2026-07-27T00:00:00.000Z", timezoneId: "liberty-county", geographyRegistryVersion: persistence.GEOGRAPHY.registryVersion };
const archive = persistence.createArchive(records, metadata);
const options = { replayScope: { endSequence: 2, kind: "complete-archive" }, timezoneRegistryVersion: "LP077.timezone.v1", lifecyclePolicyVersion: lifecycle.VERSION, cycleTime: "2026-07-27T00:00:00Z" };
const plan = orchestration.createPlan(archive, options);
const executionAuth = orchestration.authorize(orchestration.AUTHORIZATION.EXECUTION, "focused regression");
const dryAuth = orchestration.authorize(orchestration.AUTHORIZATION.DRY_RUN, "focused regression");

assert.deepEqual(orchestration.ACTIVATION, { productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticExecution: false, automaticResume: false, automaticPersistence: false });
assert.equal(orchestration.execute({ archive, plan, authorization: orchestration.authorize("unauthorized"), persistence, learning, lifecycle }).failureCodes[0], "authorization_failure");
assert.deepEqual(plan, orchestration.createPlan(archive, { cycleTime: options.cycleTime, lifecyclePolicyVersion: lifecycle.VERSION, timezoneRegistryVersion: options.timezoneRegistryVersion, replayScope: { kind: "complete-archive", endSequence: 2 } }), "object insertion order does not affect identity");
const dry = orchestration.dryRun({ archive, plan, authorization: dryAuth, persistence, lifecycle });
assert.equal(dry.status, "dry-run-complete"); assert.equal(dry.deliveredCount, 0); assert.equal(dry.expectedDuplicateCount, 1); assert.deepEqual(dry, orchestration.dryRun({ archive, plan, authorization: dryAuth, persistence, lifecycle }));

const lease = orchestration.acquireLease(plan, "lp079-certifier");
assert.equal(lease.status, "active"); assert.equal(orchestration.acquireLease(plan, "other", lease).failureCodes[0], "conflicting_execution");
assert.equal(orchestration.evaluateStaleLease(lease, {}).stale, false);
assert.equal(orchestration.releaseLease(lease).status, "released");
assert.equal(orchestration.acquireLease(plan, "retry", orchestration.releaseLease(lease)).status, "active");
const delivered = [];
const complete = orchestration.execute({ archive, plan, authorization: executionAuth, lease, persistence, learning, lifecycle, deliver: (row) => delivered.push(row) });
assert.equal(complete.complete, true); assert.equal(delivered.length, 2); assert.equal(complete.diagnostics.duplicateCount, 1);
assert.equal(Object.isFrozen(complete.lifecycleResult.lineages[0]), true); assert.equal(orchestration.validateCheckpoint(complete.checkpoint, plan, archive).compatible, true);
assert.deepEqual(lp067.discoverPatterns(delivered, { now: options.cycleTime }), lp067.discoverPatterns(learning.toLP067Observations(delivered), { now: options.cycleTime }));
const noDuplicates = [];
assert.strictEqual(orchestration.execute({ archive, plan, authorization: executionAuth, lease, persistence, learning, lifecycle, completedResult: complete, deliver: (row) => noDuplicates.push(row) }), complete);
assert.equal(noDuplicates.length, 0); assert.equal(complete.idempotencyEvidence, orchestration.execute({ archive, plan, authorization: executionAuth, lease, persistence, learning, lifecycle, completedResult: complete }).idempotencyEvidence);

let calls = 0;
const interrupted = orchestration.execute({ archive, plan, authorization: executionAuth, lease, persistence, learning, lifecycle, deliver: () => { calls += 1; if (calls === 2) throw new Error("stop"); } });
assert.equal(interrupted.complete, false); assert.equal(interrupted.failureCodes[0], "delivery_interruption"); assert.equal(interrupted.checkpoint.completionStatus, "interrupted");
const resume = orchestration.evaluateResume({ archive, plan, checkpoint: interrupted.checkpoint, authorization: executionAuth, persistence });
assert.equal(resume.resumeEligibility, true); assert.equal(resume.nextSequence, 1); assert.deepEqual(resume, orchestration.evaluateResume({ archive, plan, checkpoint: interrupted.checkpoint, authorization: executionAuth, persistence }));
const resumedRows = [];
const resumed = orchestration.execute({ archive, plan, authorization: executionAuth, lease, persistence, learning, lifecycle, priorCheckpoint: interrupted.checkpoint, deliver: (row) => resumedRows.push(row) });
assert.equal(resumed.complete, true); assert.equal(resumedRows.length, 1, "already delivered evidence is not delivered again");

const changedArchive = JSON.parse(JSON.stringify(archive)); changedArchive.records[0].record.community = "Changed";
assert.equal(orchestration.evaluateResume({ archive: changedArchive, plan, checkpoint: interrupted.checkpoint, authorization: executionAuth, persistence }).failureCodes[0], "archive_validation_failure");
const badCheckpoint = JSON.parse(JSON.stringify(interrupted.checkpoint)); badCheckpoint.checkpointSchemaVersion = "LP079.checkpoint.v99";
assert.equal(orchestration.evaluateResume({ archive, plan, checkpoint: badCheckpoint, authorization: executionAuth, persistence }).failureCodes[0], "checkpoint_incompatibility");
assert.equal(orchestration.createPlan(archive, { ...options, policyVersions: { ...orchestration.VERSIONS, resumePolicy: "unknown" } }).failureCodes[0], "unsupported_policy_version");
const lifecycleFailure = { evolve: () => ({ validation: { valid: false } }) };
assert.equal(orchestration.execute({ archive, plan, authorization: executionAuth, lease, persistence, learning, lifecycle: lifecycleFailure, deliver: () => {} }).failureCodes[0], "lifecycle_validation_failure");

const html = fs.readFileSync("tests/lp079-browser-certification.html", "utf8");
for (const key of ["passive", "productionIsolationPreserved", "learningOrchestratorAvailable", "explicitAuthorizationAvailable", "deterministicCycleIdentityPass", "checkpointGovernanceAvailable", "immutableCheckpointPass", "resumeGovernanceAvailable", "resumeIdempotencyPass", "completedCycleIdempotencyPass", "dryRunGovernanceAvailable", "dryRunNoDeliveryPass", "concurrencyGovernanceAvailable", "conflictingExecutionFailsClosed", "partialFailureClassificationAvailable", "completionBoundaryAvailable", "incompleteCycleNotCompletedPass", "orchestrationFingerprintPass", "policyVersionGovernanceAvailable", "lp067CompatibilityPreserved", "lp077ReplayCompatibilityPreserved", "lp078LifecycleCompatibilityPreserved", "activationStillDisabled", "protectedSystemsUnchanged", "safeToMerge"]) assert.ok(html.includes(key), key);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP079|historical-learning-orchestration/i);
console.log("LP079 Historical Learning Orchestration & Checkpoint Governance passed");
