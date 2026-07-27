const assert = require("node:assert/strict");
const fs = require("node:fs");
const lifecycle = require("../js/historical-pattern-lifecycle.js");
const learning = require("../js/historical-observation-learning.js");
const lp067 = require("../js/historical-pattern-intelligence.js");

const options = { validAwarenessAreas: ["Dayton"], validCounties: ["Liberty County"] };
const source = (id, timestamp) => ({ id, awareness_area: "Dayton", community: "Dayton", county: "Liberty County", crossing_name: "Waco Street", hazard_type: "blocked_crossing", event_type: "rail_delay", observed_at: timestamp });
const record = (id, timestamp) => learning.archiveObservation(source(id, timestamp), options).record;
const firstEvidence = [record("a", "2026-06-01T12:00:00Z"), record("b", "2026-06-08T12:00:00Z")];
const cycle = { now: "2026-07-27T00:00:00Z" };

assert.deepEqual(lifecycle.ACTIVATION, { productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticLifecycle: false });
assert.equal(lifecycle.evolve([], [firstEvidence[0]], cycle).lineages.length, 0, "one observation cannot create a pattern");
const original = lifecycle.evolve([], firstEvidence, cycle);
assert.equal(original.validation.valid, true);
assert.equal(original.lineages.length, 1);
assert.equal(Object.isFrozen(original.lineages[0]), true);
const lineage = original.lineages[0];
assert.equal(lineage.patternId, lifecycle.patternIdentity(firstEvidence[0].behaviorKey));
assert.equal(lineage.revisions[0].stability, "emerging");
assert.equal(lineage.revisions[0].confidence.basisPoints, 4000);

const shuffled = lifecycle.evolve([], [...firstEvidence].reverse(), cycle);
assert.deepEqual(original, shuffled, "runtime input ordering cannot affect a lifecycle decision");
const reinforcedEvidence = [record("c", "2026-07-01T12:00:00Z"), record("d", "2026-07-08T12:00:00Z")];
const evolved = lifecycle.evolve(original.lineages, reinforcedEvidence, cycle);
const revision = evolved.lineages[0].revisions[1];
assert.equal(evolved.lineages[0].patternId, lineage.patternId, "pattern identity survives evolution");
assert.equal(revision.supersedes, lineage.activeRevisionId);
assert.equal(evolved.lineages[0].revisions[0].supersededBy, revision.revisionId);
assert.equal(revision.stability, "strengthening");
assert.equal(revision.confidence.basisPoints, 5500);
assert.equal(evolved.lineages[0].revisions.length, 2, "supersession preserves prior evidence");
assert.deepEqual(evolved, lifecycle.evolve(original.lineages, [...reinforcedEvidence].reverse(), cycle), "supersession is deterministic");
assert.equal(lifecycle.validateLineage(evolved.lineages[0]).valid, true);
assert.equal(lifecycle.evolve(evolved.lineages, reinforcedEvidence, cycle).updated, false, "duplicate evidence cannot create a revision");

const dormant = lifecycle.evolve([], firstEvidence, { now: "2027-01-01T00:00:00Z" });
assert.equal(dormant.lineages[0].revisions[0].stability, "dormant");
const weakening = lifecycle.evolve([], firstEvidence, { now: "2026-10-01T00:00:00Z" });
assert.equal(weakening.lineages[0].revisions[0].stability, "weakening");
const stable = lifecycle.evolve([], [...firstEvidence, ...reinforcedEvidence], cycle);
assert.equal(stable.lineages[0].revisions[0].stability, "stable");

const lp067Input = learning.toLP067Observations([...firstEvidence, ...reinforcedEvidence]);
const before = lp067.discoverPatterns(lp067Input, cycle);
lifecycle.evolve([], lp067Input, cycle);
assert.deepEqual(lp067.discoverPatterns(lp067Input, cycle), before, "LP067 receives unchanged observations");
assert.deepEqual(lp067Input, learning.toLP067Observations([...firstEvidence, ...reinforcedEvidence]), "archive compatibility is preserved");

const corrupted = JSON.parse(JSON.stringify(evolved.lineages)); corrupted[0].activeRevisionId = "changed";
const rejected = lifecycle.evolve(corrupted, [], cycle);
assert.equal(rejected.validation.valid, false); assert.equal(rejected.updated, false);
const html = fs.readFileSync("tests/lp078-browser-certification.html", "utf8");
assert.match(html, /gridlyLp078HistoricalPatternLifecycleCertificationAudit/);
for (const key of ["passive", "productionIsolationPreserved", "patternIdentityAvailable", "patternEvolutionAvailable", "patternSupersessionAvailable", "patternLineageAvailable", "confidenceEvolutionAvailable", "stabilityClassificationAvailable", "lifecycleValidationAvailable", "deterministicLifecyclePass", "lp067CompatibilityPreserved", "activationStillDisabled", "protectedSystemsUnchanged", "safeToMerge"]) assert.ok(html.includes(key), key);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP078|historical-pattern-lifecycle/i, `${file} remains isolated`);
console.log("LP078 Historical Pattern Lifecycle Governance passed");
