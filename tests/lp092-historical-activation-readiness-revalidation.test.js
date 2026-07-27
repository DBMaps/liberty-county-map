const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const readiness = require("../js/historical-activation-readiness-revalidation.js");

const input = readiness.createReadinessInput();
const first = readiness.assessReadiness(input);
const replay = readiness.assessReadiness(readiness.createReadinessInput());
assert.equal(first.accepted, true);
assert.equal(first.eligibility, "technically-ready-passive");
assert.deepEqual(replay, first, "readiness results must be deterministic");
assert.equal(first.report.architectureInventory.length, 25);
assert.deepEqual(first.report.architectureInventory.map(item => item.milestone), readiness.MILESTONES);
assert.ok(first.report.architectureInventory.every(item => item.owner && item.responsibility && item.compatible && item.deterministic && item.productionIsolated));
assert.deepEqual(first.report.dependencyMatrix.map(item => item.dependency), readiness.DEPENDENCIES);
assert.ok(first.report.dependencyMatrix.every(item => item.status === "complete"));
assert.equal(first.report.classifications.technicalReadiness, "ready");
assert.equal(first.report.classifications.activationReadiness, "technical-prerequisites-complete-activation-not-authorized");
assert.deepEqual(first.report.activationChecklist.pendingTechnical, []);
assert.equal(first.report.activationAuthorized, false);
assert.ok(first.report.productionIsolationAssessment.every(item => item.preserved && !item.active));
assert.ok(first.report.protectedSystemsAssessment.every(item => item.unchanged));
assert.ok(Object.values(first.report.sectionFingerprints).every(value => value.startsWith("lp092-fnv1a32:")));
assert.ok(first.report.finalReadinessFingerprint.startsWith("lp092-fnv1a32:"));
assert.ok(Object.isFrozen(first) && Object.isFrozen(first.report) && Object.isFrozen(first.report.architectureInventory) && Object.isFrozen(first.report.architectureInventory[0]));

function rejects(change, code) {
  const candidate = JSON.parse(JSON.stringify(input));
  change(candidate);
  const result = readiness.assessReadiness(candidate);
  assert.equal(result.failClosed, true);
  assert.ok(result.failureCodes.includes(code));
}
rejects(candidate => { candidate.reportVersion = "LP092.historical-activation-readiness-report.v0"; }, readiness.FAILURE_CODES.UNSUPPORTED_VERSION);
rejects(candidate => { candidate.policyVersions.riskPolicy = "LP092.risk-policy.v0"; }, readiness.FAILURE_CODES.UNSUPPORTED_VERSION);
rejects(candidate => { candidate.architectureInventory.pop(); }, readiness.FAILURE_CODES.INCOMPLETE_INVENTORY);
rejects(candidate => { candidate.dependencyMatrix.pop(); }, readiness.FAILURE_CODES.INCOMPLETE_MATRIX);
rejects(candidate => { candidate.architectureInventory[0].deterministic = false; }, readiness.FAILURE_CODES.INVALID_EVIDENCE);

const audit = readiness.readinessAudit();
assert.equal(audit.safeToMerge, true);
assert.ok(Object.values(audit).every(Boolean));
const fixture = fs.readFileSync("tests/lp092-browser-certification.html", "utf8");
const scripts = [...fixture.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
const window = { console: { table() {}, log() {}, error() {} } }; window.window = window; window.globalThis = window;
const context = vm.createContext(window);
scripts.forEach(relative => vm.runInContext(fs.readFileSync(path.resolve("tests", relative), "utf8"), context));
assert.equal(window.gridlyLp092HistoricalActivationReadinessAudit().safeToMerge, true);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP092|historical-activation-readiness-revalidation/i);
console.log("LP092 Historical Intelligence Activation Readiness Revalidation passed");
