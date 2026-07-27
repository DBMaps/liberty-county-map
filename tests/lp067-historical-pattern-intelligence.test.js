const assert = require("node:assert/strict");
const fs = require("node:fs");
const engine = require("../js/historical-pattern-intelligence.js");

const report = (id, timestamp, overrides = {}) => ({
  id,
  awareness_area: "Dayton",
  community: "Dayton",
  county: "Liberty County",
  crossing_name: "Waco Street",
  road_name: "Waco Street",
  hazard_type: "blocked_crossing",
  event_type: "rail_delay",
  observed_at: timestamp,
  cleared_at: new Date(Date.parse(timestamp) + 30 * 60000).toISOString(),
  ...overrides
});

const reports = [
  report("rail-1", "2026-06-15T11:00:00.000Z"),
  report("rail-2", "2026-06-23T11:10:00.000Z"),
  report("rail-3", "2026-07-01T10:55:00.000Z"),
  report("rail-4", "2026-07-09T11:20:00.000Z"),
  report("flood-1", "2026-07-01T20:00:00.000Z", { crossing_name: null, road_name: "FM 1960", hazard_type: "flooding", event_type: "road_hazard" })
];
const context = {
  now: "2026-07-27T11:05:00.000Z",
  awarenessArea: "Dayton",
  community: "Dayton",
  county: "Liberty County",
  nearbyCrossings: ["Waco Street"],
  nearbyRoads: ["Waco Street"],
  utcOffsetMinutes: 0
};

// Historical observation normalization.
const observations = engine.normalizeObservations(reports);
assert.equal(observations.length, 5);
assert.deepEqual(
  [observations[0].awarenessArea, observations[0].community, observations[0].county, observations[0].roadway, observations[0].crossing],
  ["Dayton", "Dayton", "Liberty County", "Waco Street", "Waco Street"]
);
assert.equal(observations[0].dayOfWeek, "Monday");
assert.equal(observations[0].minuteOfDay, 660);
assert.equal(observations[0].durationMinutes, 30);
assert.equal(engine.normalizeObservation({ observed_at: "invalid" }), null);

// Pattern discovery identifies repeated behavior across dates, not duplicate row volume.
const patterns = engine.discoverPatterns(observations, { now: context.now });
assert.equal(patterns.length, 1);
assert.equal(patterns[0].subject, "Waco Street");
assert.equal(patterns[0].meaningful, true);
assert.equal(patterns[0].confidence, "meaningful");
assert.deepEqual(patterns[0].basis, {
  repeatedOnDistinctDays: true,
  stableTimeContext: true,
  sustainedHistoricalSpan: true,
  historicallyFresh: true
});
const duplicates = engine.normalizeObservations(Array.from({ length: 8 }, (_, index) => report(`duplicate-${index}`, "2026-07-20T11:00:00.000Z")));
assert.equal(engine.discoverPatterns(duplicates, { now: context.now }).length, 0, "same-day volume is not recurrence");

// Current relevance and the single internal, non-predictive driver summary.
const relevant = engine.determineCurrentRelevance(patterns, context);
assert.equal(relevant.status, "relevant");
assert.equal(relevant.pattern.patternKey, patterns[0].patternKey);
const summary = engine.generateDriverSummary(relevant);
assert.match(summary, /^Weekday rail delays are commonly reported at Waco Street crossing/);
assert.match(summary, /Check current alerts for live conditions\.$/);
assert.doesNotMatch(summary, /predict|forecast|probab|will|should take|%/i);

// Quiet state for mismatched time, place, day, and low evidence.
for (const quietContext of [
  { ...context, now: "2026-07-27T20:00:00.000Z" },
  { ...context, awarenessArea: "Cleveland", community: "Cleveland", county: "Liberty County", nearbyCrossings: ["Houston Street"] },
  { ...context, now: "2026-07-26T11:05:00.000Z" }
]) {
  const quiet = engine.determineCurrentRelevance(patterns, quietContext);
  assert.equal(quiet.status, "quiet");
  assert.equal(engine.generateDriverSummary(quiet), null);
}
const evaluation = engine.evaluate(reports, context);
assert.equal(evaluation.summary, summary);
assert.equal(evaluation.nonPredictive, true);
assert.equal(evaluation.productionIntegration, false);

// Protected runtime verification: LP067 stays unreferenced by the production document.
const index = fs.readFileSync("index.html", "utf8");
assert.doesNotMatch(index, /historical-pattern-intelligence\.js/);
for (const protectedFile of [
  "js/app.js", "js/gridlyUnifiedIntelligence.js", "js/gridlyAlertsPublishedAwareness.js",
  "js/history-capture/historyIntelligenceRuntimeIntegration.js"
]) assert.equal(fs.existsSync(protectedFile), true, `${protectedFile} remains present`);

console.log("LP067 historical pattern intelligence certification passed");
