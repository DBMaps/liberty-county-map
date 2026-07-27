const assert = require("node:assert/strict");
const fs = require("node:fs");
const generator = require("../js/historical-narrative-generator.js");
const ranking = require("../js/historical-narrative-ranking.js");

const context = { now: "2026-07-27T13:30:00Z", awarenessArea: "Dayton", community: "Dayton", county: "Liberty County", crossing: "Waco Street", nearbyCrossings: ["Waco Street"], roadway: "US 90", nearbyRoads: ["US 90", "FM 1960", "SH 146", "FM 1008"] };
const base = { patternKey: "dayton|roadway|us-90|hazard", meaningful: true, confidence: "meaningful", dayClass: "weekday", centerMinute: 810, awarenessArea: "Dayton", community: "Dayton", county: "Liberty County", roadway: "US 90", subject: "US 90", hazardType: "congestion", observationCount: 4, basis: { stableTimeContext: true }, firstObservedAt: "2026-05-01T13:30:00Z", lastObservedAt: "2026-07-20T13:30:00Z" };
const input = (overrides = {}) => {
  const pattern = { ...base, ...overrides };
  const relevance = { status: "relevant", pattern };
  return { relevance, pattern, narrativeRecord: generator.buildNarrativeRecord(relevance) };
};

// Candidate construction retains internal evidence without making it consumer-visible.
const candidate = ranking.buildCandidate(input(), context);
assert.equal(candidate.subject, "US 90");
assert.equal(candidate.productionIntegration, false);
assert.equal(candidate.consumerVisible, false);
assert.equal(candidate.rankingMetadata.eligible, true);

// 1. Exact crossing beats a generic community observation.
const crossing = input({ patternKey: "waco-crossing", crossing: "Waco Street", roadway: "Waco Street", subject: "Waco Street", hazardType: "blocked_crossing", eventType: "rail_delay", typicalDurationMinutes: 40 });
const community = input({ patternKey: "dayton-community", crossing: null, roadway: null, subject: "Dayton", hazardType: "community event" });
assert.equal(ranking.selectPrimary([community, crossing], context).selectedCandidate.canonicalId, "waco-crossing");

// 2–5. Current time, roadway specificity, confidence, and freshness govern comparable candidates.
assert.equal(ranking.selectPrimary([input({ patternKey: "irrelevant-time", centerMinute: 1080, confidence: "strong_recurring_pattern", observationCount: 20 }), input({ patternKey: "current-time" })], context).selectedCandidate.canonicalId, "current-time");
assert.equal(ranking.selectPrimary([community, input({ patternKey: "specific-road" })], context).selectedCandidate.canonicalId, "specific-road");
assert.equal(ranking.selectPrimary([input({ patternKey: "emerging", confidence: "emerging" }), input({ patternKey: "meaningful" })], context).selectedCandidate.canonicalId, "meaningful");
assert.equal(ranking.selectPrimary([input({ patternKey: "stale", lastObservedAt: "2025-09-01T13:30:00Z" }), input({ patternKey: "fresh" })], context).selectedCandidate.canonicalId, "fresh");

// 6. Semantic duplicate resolution uses behavior identity/evidence, not narrative text.
const duplicateResult = ranking.selectPrimary([community, crossing, input({ patternKey: "alternate-copy", underlyingBehaviorId: "rail-dayton-am", crossing: "Waco Street", roadway: "Waco Street", subject: "Waco Street", hazardType: "rail blockage", eventType: "train delay" }), input({ patternKey: "canonical-copy", underlyingBehaviorId: "rail-dayton-am", crossing: "Waco Street", roadway: "Waco Street", subject: "Waco Street", hazardType: "blocked_crossing", eventType: "rail_delay", typicalDurationMinutes: 45 })], context);
assert.ok(duplicateResult.rankingMetadata.duplicateSuppressions.length >= 2);
assert.equal(duplicateResult.rankingMetadata.retainedCount, 2);

// 7. Every LP068 narrative family participates as a ranked candidate.
const types = [
  ["crossing_delay", { crossing: "Waco Street", roadway: "Waco Street", hazardType: "blocked_crossing", eventType: "rail_delay" }],
  ["flooding", { crossing: null, roadway: "FM 1960", subject: "FM 1960", hazardType: "flooding" }],
  ["construction", { crossing: null, roadway: "SH 146", subject: "SH 146", hazardType: "construction" }],
  ["congestion", {}],
  ["community_activity", { crossing: null, roadway: null, subject: "Dayton", hazardType: "community event" }],
  ["roadway_hazard", { crossing: null, roadway: "FM 1008", subject: "FM 1008", hazardType: "debris" }]
];
types.forEach(([type, overrides], index) => assert.equal(ranking.buildCandidate(input({ patternKey: `type-${index}`, ...overrides }), context).narrativeType, type));

// 8. Canonical identifiers make exact ties stable regardless of repetition.
const ties = [input({ patternKey: "z-choice" }), input({ patternKey: "a-choice" })];
for (let index = 0; index < 25; index += 1) assert.equal(ranking.selectPrimary(ties, context).selectedCandidate.canonicalId, "a-choice");

// 9–12. Geographic, temporal, confidence, and weak-only sets stay quiet.
assert.equal(ranking.selectPrimary([input({ awarenessArea: "Cleveland", community: "Cleveland", county: "San Jacinto County", roadway: "Loop 573" })], context).status, "quiet");
assert.equal(ranking.selectPrimary([input({ centerMinute: 20 })], context).status, "quiet");
assert.equal(ranking.selectPrimary([input({ confidence: "emerging" }), input({ confidence: "insufficient" })], context).status, "quiet");
assert.equal(ranking.selectPrimary([community], { ...context, awarenessArea: null, community: null, county: "Liberty County" }).status, "quiet");

// 13–14. Exactly one historical, non-predictive takeaway is returned.
const selected = ranking.selectPrimary(types.map(([type, overrides], index) => input({ patternKey: `selection-${index}`, ...overrides })), context);
assert.equal(selected.status, "selected");
assert.equal(typeof selected.selectedNarrative, "string");
assert.equal(Array.isArray(selected.selectedNarrative), false);
assert.match(selected.selectedNarrative, /historical reports|have .*been reported|have frequently reported/i);
assert.match(selected.selectedNarrative, /Check current alerts for live conditions\.$/);
assert.doesNotMatch(selected.selectedNarrative, /predict|forecast|probab|\bwill\b|route|detour|avoid|active now/i);
assert.ok(selected.selectionReason && selected.rankingMetadata.factors && selected.relevanceReason);

// 15. The production document does not load or name LP069.
const productionDocument = fs.readFileSync("index.html", "utf8");
assert.doesNotMatch(productionDocument, /historical-narrative-ranking|lp069/i);
assert.equal(selected.productionIntegration, false);
assert.equal(selected.consumerVisible, false);

console.log("LP069 historical narrative ranking certification passed");
