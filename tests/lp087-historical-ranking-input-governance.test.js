const assert = require("node:assert/strict");
const fs = require("node:fs");
const validation = require("../js/historical-narrative-output-validation.js");
const governance = require("../js/historical-narrative-ranking-input-governance.js");

const input = { narrativeInputIdentity: "input:1", selectedSubjectIdentity: "crossing:main", selectedSubjectType: "crossing", candidateIdentities: ["evidence:1"], contextSummary: { normalizedHistoricalContext: "weekday mornings" }, durationEvidence: [{ identity: "crossing:main", eligible: true }], quietState: { quiet: false }, fingerprints: { narrativeInput: "input-fp" } };
const invocation = { invocationIdentity: "invocation:1", plan: { expectedNarrativeType: "crossing_delay", invocationFingerprint: "invocation-fp" } };
function output(subject = "crossing:main") { const raw = { invocationIdentity: "invocation:1", narrativeInputIdentity: "input:1", retrievalIdentity: "retrieval:1", sessionIdentity: "session:1", requestIdentity: "request:1", knowledgeBaseFingerprint: "kb:1", narrativeInputFingerprint: "input-fp", invocationFingerprint: "invocation-fp", narrativeType: "crossing_delay", subjectIdentity: subject, subjectType: "crossing", historicalStatement: `Historically, ${subject} has often been reported blocked.`, durationStatement: "Delays have typically lasted about 15 minutes.", contextStatement: "weekday mornings", quietOutput: null, provenanceSummary: { invocationIdentity: "invocation:1", narrativeInputIdentity: "input:1", candidateIdentities: ["evidence:1"], supportedStatements: [`Historically, ${subject} has often been reported blocked.`] }, compatibilityMetadata: { lp068: true, lp069: true, lp070: true, lp084: true, lp085: true, productionIsolation: true }, contractVersion: validation.VERSIONS.outputContract, policyVersions: validation.VERSIONS }; return validation.validateOutput(validation.normalizeOutput(raw).normalized, invocation, { ...input, selectedSubjectIdentity: subject }); }

const valid = output();
const registration = governance.registerCandidate(valid);
assert.equal(registration.accepted, true);
assert.equal(registration.eligibilityState, "ranking-ready");
assert.equal(registration.subjectIdentity, "crossing:main");
assert.ok(Object.isFrozen(registration) && Object.isFrozen(registration.rankingEvidence));
assert.equal(governance.classifyEligibility({ accepted: false, downstreamEligibility: "ranking-eligible" }), "rejected");

const packageA = governance.prepareRankingInput([valid, output("crossing:east"), valid]);
const packageB = governance.prepareRankingInput([valid, valid, output("crossing:east")]);
assert.equal(packageA.accepted, true);
assert.equal(packageA.rankingInputIdentity, packageB.rankingInputIdentity);
assert.equal(packageA.fingerprints.finalRankingPackage, packageB.fingerprints.finalRankingPackage);
assert.equal(packageA.candidateGroup.candidates.length, 1);
assert.equal(packageA.diagnostics.duplicateCount, 1);
assert.deepEqual(packageA.candidateGroup.candidates.map(candidate => candidate.candidateIdentity), [...packageA.candidateGroup.candidates.map(candidate => candidate.candidateIdentity)].sort());
assert.ok(Object.isFrozen(packageA) && Object.isFrozen(packageA.candidateGroup.candidates) && Object.isFrozen(packageA.explainability.tieBreakPreparation));
assert.ok(packageA.explainability.registration && packageA.explainability.grouping && packageA.explainability.duplicateEvaluation && packageA.explainability.compatibility);
assert.notEqual(packageA.fingerprints.rankingInput, governance.prepareRankingInput([valid]).fingerprints.rankingInput);

const unsupported = governance.prepareRankingInput([valid], { contractVersion: "LP087.input.v0" });
assert.equal(unsupported.accepted, false);
assert.ok(unsupported.failureCodes.includes(governance.FAILURE_CODES.UNSUPPORTED_VERSION));
const rejected = governance.prepareRankingInput([{ accepted: false, downstreamEligibility: "rejected" }]);
assert.equal(rejected.candidateGroup.candidates.length, 0);
assert.equal(rejected.diagnostics.eligibilityCounts.rejected, 1);
assert.equal(governance.ACTIVATION.rankingPerformed, false);
assert.equal(governance.certificationAudit().safeToMerge, true);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP087|historical-narrative-ranking-input-governance/i);
for (const file of ["historical-narrative-ranking.js", "historical-intelligence-activation-boundary.js", "historical-narrative-output-validation.js"]) assert.doesNotThrow(() => require(`../js/${file}`));
console.log("LP087 Historical Narrative Ranking Input Governance passed");
