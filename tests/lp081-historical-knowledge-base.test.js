const assert = require("node:assert/strict");
const fs = require("node:fs");
const kb = require("../js/historical-knowledge-base.js");
const lp067 = require("../js/historical-pattern-intelligence.js");
const lp076 = require("../js/historical-observation-learning.js");
const lp077 = require("../js/historical-archive-persistence.js");
const lp078 = require("../js/historical-pattern-lifecycle.js");
const lp079 = require("../js/historical-learning-orchestration.js");
const lp080 = require("../js/historical-learning-quality-governance.js");

const patterns = [
  { patternId: "pattern:dayton:waco", revision: 2, lineageId: "lineage:waco", archiveId: "archive:2026-q2", fingerprint: "pattern-fp-a", crossingIdentity: "crossing:waco", roadwayIdentity: "roadway:waco", awarenessArea: "Dayton", community: "Dayton", county: "Liberty County", category: "rail-delay", lifecycleStatus: "active", qualityStatus: "stable", behaviorKey: "dayton|waco" },
  { patternId: "pattern:liberty:main", revision: 1, lineageId: "lineage:main", archiveId: "archive:2026-q2", fingerprint: "pattern-fp-b", crossingIdentity: "crossing:main", roadwayIdentity: "roadway:main", awarenessArea: "Liberty", community: "Liberty", county: "Liberty County", category: "rail-delay", lifecycleStatus: "candidate", qualityStatus: "supported", behaviorKey: "liberty|main" }
];
const relationships = [{ source: "pattern:dayton:waco", target: "pattern:liberty:main", type: "related" }];
const base = kb.createKnowledgeBase(patterns, relationships);
const reversed = kb.createKnowledgeBase([...patterns].reverse(), [...relationships].reverse());

assert.equal(base.accepted, true);
assert.deepEqual(base.registry, reversed.registry, "registry is deterministic");
assert.deepEqual(base.catalog, reversed.catalog, "catalog is deterministic");
assert.deepEqual(base.index, reversed.index, "indexes are deterministic");
assert.deepEqual(base.relationships, reversed.relationships, "relationships are deterministic and explicitly registered");
assert.equal(base.consistency.valid, true);
assert.equal(Object.isFrozen(base.catalog.entries[0]), true, "catalog is recursively frozen");
assert.equal(Object.isFrozen(base.diagnostics.fingerprints), true, "diagnostics are recursively frozen");
assert.deepEqual(base.query.patternsByCounty("Liberty County").map((x) => x.canonicalIdentity), ["pattern:dayton:waco", "pattern:liberty:main"]);
assert.equal(base.query.patternByIdentity("pattern:dayton:waco").currentRevision, 2);
assert.equal(base.query.patternsByCommunity("Dayton")[0].canonicalIdentity, "pattern:dayton:waco");
assert.equal(base.query.patternsByCrossing("crossing:waco").length, 1);
assert.equal(base.query.patternsByRoadway("roadway:waco").length, 1);
assert.equal(base.query.patternsByCategory("rail-delay").length, 2);
const results = base.query.patternsByCounty("Liberty County");
assert.equal(Object.isFrozen(results), true);
assert.throws(() => { "use strict"; results.push({}); }, TypeError);
assert.equal(base.query.resultFingerprint(results), base.query.resultFingerprint(base.query.patternsByCounty("Liberty County")));
assert.notEqual(kb.fingerprint(patterns), kb.fingerprint([{ ...patterns[0], revision: 3 }, patterns[1]]), "fingerprints detect material mutation");
assert.equal(kb.createKnowledgeBase(patterns, relationships, { versions: { ...kb.VERSIONS, indexSchema: "LP081.index.v2" } }).failureCodes[0], kb.FAILURE_CODES.UNSUPPORTED_VERSION);
assert.equal(kb.createKnowledgeBase(patterns, [{ source: "missing", target: patterns[0].patternId, type: "related" }]).failClosed, true);
assert.equal(kb.createRegistry([...patterns, patterns[0]]).failClosed, true);

assert.equal(typeof lp067.discoverPatterns, "function");
assert.equal(typeof lp076.archiveObservation, "function");
assert.equal(typeof lp077.createArchive, "function");
assert.equal(typeof lp078.evolve, "function");
assert.equal(lp079.ACTIVATION.activationAuthorized, false);
assert.equal(lp080.ACTIVATION.activationAuthorized, false);
assert.equal(kb.ACTIVATION.activationAuthorized, false);
const certification = fs.readFileSync("tests/lp081-browser-certification.html", "utf8");
for (const key of ["passive", "productionIsolationPreserved", "knowledgeBaseAvailable", "canonicalRegistryAvailable", "knowledgeCatalogAvailable", "knowledgeIndexAvailable", "relationshipGovernanceAvailable", "consistencyValidationAvailable", "deterministicQueryInterfaceAvailable", "versionGovernanceAvailable", "knowledgeFingerprintAvailable", "diagnosticsAvailable", "deterministicKnowledgePass", "lp067CompatibilityPreserved", "lp076CompatibilityPreserved", "lp077CompatibilityPreserved", "lp078CompatibilityPreserved", "lp079CompatibilityPreserved", "lp080CompatibilityPreserved", "activationStillDisabled", "protectedSystemsUnchanged", "safeToMerge"]) assert.ok(certification.includes(key), key);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP081|historical-knowledge-base/i);
console.log("LP081 Historical Knowledge Base Governance passed");
