const assert = require("node:assert/strict");
const fs = require("node:fs");
const generator = require("../js/historical-narrative-generator.js");

const base = {
  patternKey: "dayton|roadway|us-90|hazard|hazard",
  meaningful: true,
  confidence: "meaningful",
  dayClass: "weekday",
  centerMinute: 510,
  roadway: "US 90",
  subject: "US 90",
  hazardType: "roadway hazard",
  firstObservedAt: "2026-05-01T13:30:00.000Z",
  lastObservedAt: "2026-07-20T13:40:00.000Z"
};
const relevant = (overrides) => ({ status: "relevant", pattern: { ...base, ...overrides } });

const cases = [
  ["crossing_delay", { crossing: "Waco Street", roadway: "Waco Street", hazardType: "blocked_crossing", eventType: "rail_delay", typicalDurationMinutes: 43 }, /trains blocking the Waco Street crossing.*Delays have typically lasted about 45 minutes/i],
  ["flooding", { roadway: "FM 1960", hazardType: "flooding" }, /Flooding has repeatedly been reported along FM 1960/i],
  ["construction", { roadway: "SH 146", hazardType: "construction" }, /Construction activity has commonly been reported along SH 146/i],
  ["congestion", { roadway: "US 90", hazardType: "traffic congestion", typicalDurationMinutes: 32 }, /congestion along US 90.*Slower conditions have typically lasted about 30 minutes/i],
  ["community_activity", { roadway: null, community: "Dayton", subject: "Dayton", hazardType: "community event" }, /Community activity has commonly been reported around Dayton/i],
  ["roadway_hazard", { roadway: "FM 1008", hazardType: "debris" }, /Roadway hazards have repeatedly been reported along FM 1008/i]
];

const narratives = [];
for (const [expectedType, pattern, wording] of cases) {
  const record = generator.buildNarrativeRecord(relevant(pattern));
  assert.equal(record.metadata.narrativeType, expectedType, `${expectedType} is classified independently`);
  assert.match(record.narrative, wording, `${expectedType} uses pattern-specific language`);
  assert.match(record.narrative, /align with the current weekday morning travel period/i);
  assert.match(record.narrative, /Check current alerts for live conditions\.$/);
  assert.equal(record.consumerVisible, false);
  assert.equal(record.productionIntegration, false);
  assert.equal(record.nonPredictive, true);
  narratives.push(record.narrative);
}
assert.equal(new Set(narratives.map((value) => value.split(".")[0])).size, cases.length, "narrative types do not share one generic opening");

// Quiet means null: no fallback or filler is generated.
for (const input of [null, { status: "quiet", pattern: null }, relevant({ meaningful: false, confidence: "emerging" }), { status: "irrelevant", pattern: base }]) {
  assert.equal(generator.generateNarrative(input), null);
  assert.equal(generator.buildNarrativeRecord(input), null);
}

// Consumer prose excludes scoring, counts, technical fields, prediction, and route advice.
const record = generator.buildNarrativeRecord(relevant({ crossing: "Waco Street", hazardType: "blocked crossing", observationCount: 99, recurrenceScore: 87 }));
assert.deepEqual(record.metadata.historicalWindow, { firstObservedAt: base.firstObservedAt, lastObservedAt: base.lastObservedAt });
assert.equal(record.metadata.matchedPattern, base.patternKey);
assert.equal(record.metadata.confidenceCategory, "meaningful");
assert.doesNotMatch(record.narrative, /99|87|count|confidence|score|metadata|pattern key|predict|forecast|probab|\bwill\b|route|detour|avoid/i);
assert.equal(generator.generateNarrative(relevant({ crossing: "Waco Street", hazardType: "blocked crossing" })), record.narrative);

// Protected production runtime remains isolated from the certification-only module.
const productionDocument = fs.readFileSync("index.html", "utf8");
assert.doesNotMatch(productionDocument, /historical-narrative-generator\.js/);
for (const protectedFile of [
  "js/app.js", "js/gridlyUnifiedIntelligence.js", "js/gridlyAlertsPublishedAwareness.js",
  "js/history-capture/historyIntelligenceRuntimeIntegration.js"
]) assert.equal(fs.existsSync(protectedFile), true, `${protectedFile} remains present`);

console.log("LP068 historical narrative generation certification passed");
