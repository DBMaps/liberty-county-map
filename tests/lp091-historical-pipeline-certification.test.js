const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const certification = require("../js/historical-pipeline-certification.js");

const input = certification.createCertificationInput();
const first = certification.certifyPipeline(input);
const replay = certification.certifyPipeline(certification.createCertificationInput());
assert.equal(first.accepted, true);
assert.equal(first.eligibility, "certified-passive");
assert.deepEqual(replay, first, "equivalent runs must produce identical reports and diagnostics");
assert.equal(first.report.transitions.length, 20);
assert.equal(first.report.milestones.length, 24);
assert.ok(first.report.transitions.every(result => result.identityContinuous && result.fingerprintContinuous && result.contractCompatible && result.versionCompatible && result.immutableTransition));
assert.equal(first.report.identityChain.at(0).stage, "observation");
assert.equal(first.report.identityChain.at(-1).stage, "reversible-attachment");
assert.ok(first.report.fingerprintChain.every(item => item.fingerprint.startsWith("lp091-fnv1a32:")));
assert.equal(first.report.protectedSystems.length, 10);
assert.ok(first.report.protectedSystems.every(item => item.unchanged));
assert.ok(first.report.productionIsolation.every(item => item.certified && item.active === false));
assert.equal(first.report.activationAuthorized, false);
assert.ok(Object.isFrozen(first) && Object.isFrozen(first.report) && Object.isFrozen(first.report.identityChain) && Object.isFrozen(first.report.identityChain[0]));

function rejected(change, code) {
  const candidate = JSON.parse(JSON.stringify(input));
  change(candidate);
  const result = certification.certifyPipeline(candidate);
  assert.equal(result.failClosed, true);
  assert.equal(result.eligibility, "rejected");
  assert.ok(result.failureCodes.includes(code), `${code} was not reported`);
}
rejected(x => { x.contractVersion = "LP091.certification-contract.v0"; }, certification.FAILURE_CODES.UNSUPPORTED_VERSION);
rejected(x => { delete x.policyVersions.lineagePolicy; }, certification.FAILURE_CODES.UNSUPPORTED_VERSION);
rejected(x => { delete x.stages[4].contractVersion; }, certification.FAILURE_CODES.MISSING_CONTRACT);
rejected(x => { x.stages[7].identity = null; }, certification.FAILURE_CODES.MISSING_IDENTITY);
rejected(x => { x.stages[8].parentIdentity = "broken"; }, certification.FAILURE_CODES.BROKEN_LINEAGE);
rejected(x => { x.stages[11].outputFingerprint = "lp091-fnv1a32:00000000"; }, certification.FAILURE_CODES.FINGERPRINT_MISMATCH);
rejected(x => { delete x.stages[14].compatibilityEvidence; }, certification.FAILURE_CODES.MISSING_COMPATIBILITY);
rejected(x => { x.milestones.pop(); }, certification.FAILURE_CODES.MISSING_COMPATIBILITY);

const audit = certification.certificationAudit();
assert.equal(audit.safeToMerge, true);
assert.ok(Object.values(audit).every(Boolean));
const fixture = fs.readFileSync("tests/lp091-browser-certification.html", "utf8");
const scripts = [...fixture.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
const window = { console: { table() {}, log() {}, error() {} } }; window.window = window; window.globalThis = window;
const context = vm.createContext(window);
scripts.forEach(relative => vm.runInContext(fs.readFileSync(path.resolve("tests", relative), "utf8"), context));
assert.equal(window.gridlyLp091HistoricalPipelineCertificationAudit().safeToMerge, true);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP091|historical-pipeline-certification/i);
console.log("LP091 Historical Intelligence End-to-End Pipeline Certification passed");
