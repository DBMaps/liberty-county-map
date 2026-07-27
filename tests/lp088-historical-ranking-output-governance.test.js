const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const governance = require("../js/historical-narrative-ranking-output-governance.js");
const candidate = Object.freeze({ candidateIdentity: "lp087-candidate:alpha", narrativeOutputIdentity: "lp086-output:alpha", invocationIdentity: "invocation:1", narrativeInputIdentity: "input:1", retrievalIdentity: "retrieval:1", sessionIdentity: "session:1", requestIdentity: "request:1", knowledgeBaseFingerprint: "kb:1", subjectIdentity: "crossing:waco", eligibilityState: "ranking-ready", historicalEvidence: { candidateIdentities: ["evidence:1"] }, rankingEvidence: { subjectIdentity: "crossing:waco", historicalEvidence: { candidateIdentities: ["evidence:1"] } } });
const rankingInput = Object.freeze({ accepted: true, failClosed: false, rankingInputIdentity: "lp087-input:alpha", fingerprints: { rankingInput: "lp087-fnv1a32:12345678" }, candidateGroup: { candidates: [candidate] }, knowledgeBaseFingerprint: ["kb:1"] });
const winner = { status: "selected", selectedNarrative: "Historically, Waco Street has often been reported blocked.", selectedCandidate: { candidateIdentity: candidate.candidateIdentity }, rankingMetadata: { winningCanonicalId: "alpha", factors: { usefulnessScore: 80 } }, productionIntegration: false, consumerVisible: false };
const governed = governance.governRankingOutput(winner, rankingInput);
assert.equal(governed.accepted, true); assert.equal(governed.presentationEligibility, "presentation-ready");
assert.equal(governed.normalizedOutput.selectedCandidateIdentity, candidate.candidateIdentity); assert.equal(governed.normalizedOutput.selectedNarrativeIdentity, candidate.narrativeOutputIdentity);
assert.ok(Object.isFrozen(governed) && Object.isFrozen(governed.normalizedOutput.rankingOutcome) && Object.isFrozen(governed.diagnostics.fingerprints));
assert.equal(governed.normalizedOutput.explainability.winnerValidation, "passed");
const reordered = { consumerVisible: false, rankingMetadata: winner.rankingMetadata, selectedCandidate: winner.selectedCandidate, selectedNarrative: winner.selectedNarrative, productionIntegration: false, status: "selected" };
const equivalent = governance.governRankingOutput(reordered, rankingInput);
assert.equal(equivalent.normalizedOutput.rankingOutputIdentity, governed.normalizedOutput.rankingOutputIdentity); assert.deepEqual(equivalent.fingerprints, governed.fingerprints); assert.equal(equivalent.validationIdentity, governed.validationIdentity);
const quiet = governance.governRankingOutput({ status: "quiet", selectedNarrative: null, selectedCandidate: null, rankingMetadata: { quietReason: "no_meaningful_candidates", candidateCount: 0 }, productionIntegration: false, consumerVisible: false }, rankingInput);
assert.equal(quiet.accepted, true); assert.equal(quiet.presentationEligibility, "quiet-ready"); assert.ok(quiet.normalizedOutput.quietOutcome.quietIdentity);
const unsupported = governance.governRankingOutput(winner, rankingInput, { contractVersion: "LP088.output.v0" });
assert.equal(unsupported.accepted, false); assert.ok(unsupported.failureCodes.includes(governance.FAILURE_CODES.UNSUPPORTED_VERSION));
assert.equal(governance.governRankingOutput({ ...winner, surprise: true }, rankingInput).accepted, false);
assert.equal(governance.governRankingOutput({ ...winner, quietOutcome: { quietReason: "ambiguous" } }, rankingInput).accepted, false);
assert.equal(governance.governRankingOutput({ ...winner, selectedCandidate: { candidateIdentity: "missing" } }, rankingInput).accepted, false);
assert.notEqual(governed.fingerprints.rankingOutput, governance.governRankingOutput({ ...winner, rankingMetadata: { ...winner.rankingMetadata, material: true } }, rankingInput).fingerprints.rankingOutput);
assert.equal(governance.ACTIVATION.rankingPerformed, false); assert.equal(governance.certificationAudit().safeToMerge, true);
const browserFixture = fs.readFileSync("tests/lp088-browser-certification.html", "utf8");
const browserScripts = [...browserFixture.matchAll(/<script src="([^"]+)"><\/script>/g)].map((match) => match[1]);
function browserAudit(scripts = browserScripts, mutate = source => source) {
  const window = {}; window.window = window; window.globalThis = window;
  const context = vm.createContext(window);
  for (const relativeScript of scripts) {
    const filename = path.resolve("tests", relativeScript);
    vm.runInContext(mutate(fs.readFileSync(filename, "utf8"), relativeScript), context, { filename });
  }
  return window.gridlyLp088HistoricalRankingOutputCertificationAudit();
}
assert.deepEqual(browserScripts.slice(1, 4), ["../js/historical-intelligence-activation-boundary.js", "../js/historical-intelligence-presentation.js", "../js/historical-intelligence-attachment-controller.js"], "isolated fixture loads LP070, LP071, and LP072 in dependency order");
const isolatedBrowserAudit = browserAudit();
assert.equal(isolatedBrowserAudit.presentationCompatibilityValidationAvailable, true, "real browser globals complete the presentation validation path");
assert.equal(isolatedBrowserAudit.safeToMerge, true);
const withoutAttachment = browserAudit(browserScripts.filter(script => !script.endsWith("historical-intelligence-attachment-controller.js")));
assert.equal(withoutAttachment.presentationCompatibilityValidationAvailable, false, "missing LP072 fails closed");
assert.equal(withoutAttachment.safeToMerge, false);
const invalidRenderer = browserAudit(browserScripts, (source, script) => script.endsWith("historical-intelligence-presentation.js") ? source.replace("exactContract, meaningfulWindow, render });", "exactContract, meaningfulWindow, render: null });") : source);
assert.equal(invalidRenderer.presentationCompatibilityValidationAvailable, false, "an incompatible LP071 export cannot masquerade as available");
assert.equal(invalidRenderer.safeToMerge, false);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP088|historical-narrative-ranking-output-governance/i);
for (const file of ["historical-narrative-ranking.js", "historical-intelligence-activation-boundary.js", "historical-intelligence-presentation.js", "historical-narrative-ranking-input-governance.js"]) assert.doesNotThrow(() => require(`../js/${file}`));
console.log("LP088 Historical Narrative Ranking Output Governance passed");
