const assert = require("node:assert/strict");
const fs = require("node:fs");
const quality = require("../js/historical-learning-quality-governance.js");
const learning = require("../js/historical-observation-learning.js");
const persistence = require("../js/historical-archive-persistence.js");
const orchestration = require("../js/historical-learning-orchestration.js");
const lifecycle = require("../js/historical-pattern-lifecycle.js");
const lp067 = require("../js/historical-pattern-intelligence.js");

const source = (id, timestamp, extra = {}) => ({ id, awareness_area: "Dayton", community: "Dayton", county: "Liberty County", crossing_name: "Waco Street", hazard_type: "blocked_crossing", event_type: "rail_delay", observed_at: timestamp, ...extra });
const qualification = { validAwarenessAreas: ["Dayton"], validCounties: ["Liberty County"] };
const rows = [source("a", "2026-06-01T12:00:00Z"), source("b", "2026-06-08T12:10:00Z"), source("c", "2026-06-15T12:20:00Z")].map((x) => learning.archiveObservation(x, qualification).record);
const pattern = { patternId: "pattern:dayton:waco", behaviorKey: rows[0].behaviorKey, eventType: "rail_delay", confidence: "supported", lastObservationTimestamp: "2026-06-01T00:00:00Z" };

assert.equal(quality.ACTIVATION.activationAuthorized, false);
assert.equal(quality.evaluateEvidence(rows[0]).classification, "high-quality");
assert.equal(quality.evaluateIndependence(rows[1], [rows[0]]).independent, true);
assert.equal(quality.evaluateIndependence(rows[0], [rows[0]]).classification, "duplicate-dependent");
assert.equal(quality.classifyContradiction(rows[0], pattern).classification, "reinforcing");
assert.equal(quality.classifyContradiction({ ...rows[0], eventType: "cleared" }, pattern).classification, "conflicting");
assert.equal(quality.classifyContradiction({ ...rows[1], eventType: "cleared" }, pattern, { explicitSupersession: true }).classification, "superseded");
const outlier = { ...rows[2], sourceObservationId: "outlier", archiveId: "historical:outlier", fingerprint: "outlier", minuteOfDay: 1380, durationMinutes: 1500 };
assert.equal(quality.detectOutlier(outlier, rows).outlier, true);
const evidence = quality.evaluateEvidence(rows[0]), independence = quality.evaluateIndependence(rows[0], []), contradiction = quality.classifyContradiction(rows[0], pattern);
assert.equal(quality.determineEligibility({ evidence, independence, contradiction, outlier: quality.detectOutlier(rows[0], rows.slice(1)), patternExists: true }).decision, "strengthen-existing-pattern");
assert.equal(quality.determineEligibility({ evidence, independence, contradiction, outlier: { outlier: true }, patternExists: true }).decision, "archive-only");

const eligible = (row) => ({ evidenceIdentity: row.fingerprint, quality: "high-quality", eligibility: { influencesLearning: true } });
const confidenceA = quality.calibrateConfidence(rows.map(eligible));
const confidenceB = quality.calibrateConfidence([...rows].reverse().concat(rows[0]).map(eligible));
assert.deepEqual(confidenceA, confidenceB, "confidence is set-based, order independent, and duplicate safe");
assert.equal(confidenceA.level, "established");
const governed = quality.govern(rows, pattern, { archiveValid: true, lifecycleValid: true, replayConsistent: true });
assert.deepEqual(governed, quality.govern([...rows].reverse(), pattern, { replayConsistent: true, lifecycleValid: true, archiveValid: true }));
assert.equal(Object.isFrozen(governed.diagnostics.confidenceCalibration), true);
assert.equal(governed.patternQuality.consumerQualityScore, null);
assert.equal(quality.validatePatternIntegrity(pattern, { lineageValid: true, confidenceConsistent: true, lifecycleCompatible: true, archiveCompatible: true, replayCompatible: true }).valid, true);
assert.equal(quality.validatePatternIntegrity({}, {}).failClosed, true);
assert.equal(quality.evaluateEvidence(rows[0], { policyVersions: { ...quality.VERSIONS, outlierPolicy: "LP080.outlier.v99" } }).failureCodes[0], quality.FAILURE_CODES.UNSUPPORTED_POLICY_VERSION);

assert.deepEqual(lp067.discoverPatterns(rows, { now: "2026-07-27T00:00:00Z" }), lp067.discoverPatterns(learning.toLP067Observations(rows), { now: "2026-07-27T00:00:00Z" }));
const archive = persistence.createArchive(rows, { archiveVersion: 1, archiveId: "lp080-test", createdAt: "2026-07-27T00:00:00.000Z", timezoneId: "liberty-county", geographyRegistryVersion: persistence.GEOGRAPHY.registryVersion });
assert.equal(persistence.validateArchive(archive).valid, true);
assert.equal(lifecycle.evolve([], rows, { now: "2026-07-27T00:00:00Z" }).validation.valid, true);
assert.equal(orchestration.ACTIVATION.activationAuthorized, false);
const html = fs.readFileSync("tests/lp080-browser-certification.html", "utf8");
for (const key of ["passive", "productionIsolationPreserved", "evidenceQualityGovernanceAvailable", "observationIndependenceAvailable", "confidenceCalibrationAvailable", "contradictoryEvidenceGovernanceAvailable", "patternQualityEvaluationAvailable", "outlierGovernanceAvailable", "learningEligibilityAvailable", "patternIntegrityValidationAvailable", "diagnosticsAvailable", "policyVersionGovernanceAvailable", "deterministicQualityPass", "lp067CompatibilityPreserved", "lp076CompatibilityPreserved", "lp077CompatibilityPreserved", "lp078CompatibilityPreserved", "lp079CompatibilityPreserved", "activationStillDisabled", "protectedSystemsUnchanged", "safeToMerge"]) assert.ok(html.includes(key), key);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP080|historical-learning-quality-governance/i);
console.log("LP080 Historical Learning Quality & Evidence Governance passed");
