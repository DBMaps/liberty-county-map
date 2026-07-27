const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const rankingGovernance = require("../js/historical-narrative-ranking-output-governance.js");
const governance = require("../js/historical-presentation-invocation-governance.js");

const candidate = Object.freeze({ candidateIdentity: "lp087-candidate:alpha", narrativeOutputIdentity: "lp086-output:alpha", invocationIdentity: "lp085-invocation:alpha", narrativeInputIdentity: "lp084-input:alpha", retrievalIdentity: "lp082-retrieval:alpha", sessionIdentity: "lp083-session:alpha", requestIdentity: "request:alpha", knowledgeBaseFingerprint: "kb:alpha", subjectIdentity: "Waco Street", eligibilityState: "ranking-ready", historicalEvidence: { candidateIdentities: ["evidence:1"] }, rankingEvidence: { subjectIdentity: "Waco Street", historicalEvidence: { candidateIdentities: ["evidence:1"] } } });
const rankingInput = Object.freeze({ accepted: true, failClosed: false, rankingInputIdentity: "lp087-input:alpha", fingerprints: { rankingInput: "lp087-fnv1a32:12345678" }, candidateGroup: { candidates: [candidate] }, knowledgeBaseFingerprint: ["kb:alpha"] });
const ranking = rankingGovernance.governRankingOutput({ status: "selected", selectedNarrative: "Historically, Waco Street has often been reported blocked.", selectedCandidate: { candidateIdentity: candidate.candidateIdentity }, rankingMetadata: { subjectIdentity: "Waco Street", narrativeType: "congestion", winningCanonicalId: "alpha" }, productionIntegration: false, consumerVisible: false }, rankingInput);
const request = { authorizationState: "presentation authorized", presentationMetadata: { narrativeType: "congestion", subject: "Waco Street", historicalWindow: null } };

const governed = governance.governPresentationInvocation(ranking, request);
assert.equal(governed.accepted, true);
assert.equal(governed.contract.invocationState, "presentation-ready");
assert.equal(governed.presentationEligibility, "presentation-ready");
assert.equal(governed.presentationPackage.content.selectedNarrative, ranking.normalizedOutput.rankingOutcome.selectedNarrative, "narrative wording is preserved exactly");
assert.equal(governed.presentationPackage.presentationDto.historicalTakeaway, ranking.normalizedOutput.rankingOutcome.selectedNarrative);
assert.ok(Object.isFrozen(governed) && Object.isFrozen(governed.contract.compatibilityMetadata.evidence) && Object.isFrozen(governed.presentationPackage.rankingEvidence) && Object.isFrozen(governed.diagnostics.fingerprints));
assert.equal(governed.contract.contractVersion, governance.VERSIONS.invocationContract);
assert.deepEqual(governed.contract.policyVersions, governance.VERSIONS);

const reordered = governance.governPresentationInvocation(ranking, { presentationMetadata: { historicalWindow: null, subject: "Waco Street", narrativeType: "congestion" }, authorizationState: "presentation authorized" });
assert.equal(reordered.contract.presentationInvocationIdentity, governed.contract.presentationInvocationIdentity);
assert.deepEqual(reordered.presentationPackage, governed.presentationPackage);
assert.deepEqual(reordered.fingerprints, governed.fingerprints);

const unsupported = governance.governPresentationInvocation(ranking, request, { contractVersion: "LP089.invocation-contract.v0" });
assert.equal(unsupported.accepted, false);
assert.ok(unsupported.failureCodes.includes(governance.FAILURE_CODES.UNSUPPORTED_VERSION));
const unsupportedPolicy = governance.governPresentationInvocation(ranking, request, { policyVersions: { ...governance.VERSIONS, authorization: "LP089.authorization.v0" } });
assert.ok(unsupportedPolicy.failureCodes.includes(governance.FAILURE_CODES.UNSUPPORTED_VERSION));
const unauthorized = governance.governPresentationInvocation(ranking, { ...request, authorizationState: "unauthorized" });
assert.equal(unauthorized.accepted, false);
assert.equal(unauthorized.presentationPackage, null);
assert.ok(unauthorized.failureCodes.includes(governance.FAILURE_CODES.UNAUTHORIZED));
const dryRun = governance.governPresentationInvocation(ranking, { ...request, authorizationState: "dry-run authorized" });
assert.equal(dryRun.accepted, true);
assert.equal(dryRun.contract.invocationState, "authorized");
assert.equal(governance.transitionInvocation(dryRun.contract, "presentation-ready").accepted, false);
assert.equal(governance.transitionInvocation(governed.contract, "invoked").accepted, true);
assert.equal(governance.transitionInvocation(governed.contract, "completed").accepted, false);

const quietRanking = rankingGovernance.governRankingOutput({ status: "quiet", selectedNarrative: null, selectedCandidate: null, rankingMetadata: { quietReason: "no_meaningful_candidates", candidateCount: 0 }, productionIntegration: false, consumerVisible: false }, rankingInput);
const quiet = governance.governPresentationInvocation(quietRanking, { authorizationState: "presentation authorized", presentationMetadata: {} });
assert.equal(quiet.accepted, true);
assert.equal(quiet.presentationEligibility, "quiet-ready");
assert.equal(quiet.presentationPackage.content.selectedNarrative, null);
assert.equal(quiet.presentationPackage.presentationDto.quiet, true);
const invalidMetadata = governance.governPresentationInvocation(ranking, { authorizationState: "presentation authorized", presentationMetadata: { subject: "Waco Street", narrativeType: "unsupported" } });
assert.equal(invalidMetadata.accepted, false);
assert.ok(invalidMetadata.failureCodes.includes(governance.FAILURE_CODES.INCOMPATIBLE));
assert.equal(governance.certificationAudit().safeToMerge, true);

const browserFixture = fs.readFileSync("tests/lp089-browser-certification.html", "utf8");
const browserScripts = [...browserFixture.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
function browserAudit(scripts = browserScripts) {
  const window = {}; window.window = window; window.globalThis = window;
  const context = vm.createContext(window);
  scripts.forEach(relative => vm.runInContext(fs.readFileSync(path.resolve("tests", relative), "utf8"), context, { filename: relative }));
  return window.gridlyLp089HistoricalPresentationInvocationCertificationAudit();
}
assert.deepEqual(browserScripts.slice(-4), ["../js/historical-intelligence-activation-boundary.js", "../js/historical-intelligence-presentation.js", "../js/historical-narrative-ranking-output-governance.js", "../js/historical-presentation-invocation-governance.js"]);
assert.equal(browserAudit().safeToMerge, true);
assert.equal(browserAudit(browserScripts.filter(script => !script.endsWith("historical-intelligence-presentation.js"))).safeToMerge, false);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP089|historical-presentation-invocation-governance/i);
for (const file of ["historical-intelligence-activation-boundary.js", "historical-intelligence-presentation.js", "historical-narrative-ranking-output-governance.js"]) assert.doesNotThrow(() => require(`../js/${file}`));
console.log("LP089 Historical Presentation Boundary Invocation Governance passed");
