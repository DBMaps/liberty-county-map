const assert = require("node:assert/strict");
const fs = require("node:fs");
const learning = require("../js/historical-observation-learning.js");
const lp067 = require("../js/historical-pattern-intelligence.js");

const observation = (id, timestamp, overrides = {}) => ({ id, awareness_area: "Dayton", community: "Dayton", county: "Liberty County", road_name: "Waco Street", crossing_name: "Waco Street", hazard_type: "blocked_crossing", event_type: "rail_delay", observed_at: timestamp, observation_source: "community_report", duration_minutes: 30, ...overrides });
const options = { validAwarenessAreas: ["Dayton"], validCounties: ["Liberty County"], evaluatedAt: "2026-07-27T12:00:00.000Z" };

assert.deepEqual(learning.ACTIVATION, { productionIntegration: false, consumerVisible: false, activationAuthorized: false, explicitOptInRequired: true });
assert.equal(learning.qualifyObservation(observation("one", "2026-07-01T11:00:00Z"), options).eligible, true);
for (const [bad, reason] of [
  [null, "invalid_observation"],
  [observation("bad-time", "never"), "invalid_timestamp"],
  [observation("bad-type", "2026-07-01T11:00:00Z", { hazard_type: "mystery", event_type: "mystery" }), "unsupported_event_type"],
  [observation("bad-area", "2026-07-01T11:00:00Z", { awareness_area: "Unknown" }), "geographically_invalid"],
  [observation("incomplete", "2026-07-01T11:00:00Z", { road_name: null, crossing_name: null }), "missing_historical_subject"]
]) assert.ok(learning.qualifyObservation(bad, options).reasons.includes(reason), reason);

const first = learning.archiveObservation(observation("one", "2026-07-01T11:05:00Z"), options);
assert.equal(first.archived, true);
assert.equal(first.record.localDay, "Wednesday");
assert.equal(first.record.localTime, "11:05");
assert.equal(first.record.archiveVersion, 1);
assert.equal(first.record.qualificationStatus, "qualified");
assert.equal(Object.isFrozen(first.record), true);

const batch = [
  observation("one", "2026-07-01T11:05:00Z"),
  observation("two", "2026-07-09T11:10:00Z"),
  observation("three", "2026-07-17T10:55:00Z"),
  observation("unsupported", "2026-07-20T11:00:00Z", { hazard_type: "mystery", event_type: "mystery" })
];
const learned = learning.ingestIncrementally([], batch, options);
assert.equal(learned.archive.length, 3);
assert.equal(learned.rejected.length, 1);
assert.equal(learned.rebuildRequired, false);
const increment = learning.ingestIncrementally(learned.archive, [batch[1], observation("four", "2026-07-25T11:00:00Z")], options);
assert.equal(increment.archive.length, 4);
assert.equal(increment.added.length, 1);
assert.equal(increment.duplicates.length, 1);

const normalized = learning.toLP067Observations(increment.archive);
const patterns = lp067.discoverPatterns(normalized, { now: "2026-07-27T12:00:00Z" });
assert.equal(patterns.length, 1, "LP067 consumes archive records without an LP067 change");
assert.equal(patterns[0].meaningful, true);
for (const [days, status] of [[10, "recent"], [60, "established"], [240, "aging"], [500, "inactive"]]) {
  assert.equal(learning.agingStatus({ observationTimestamp: new Date(Date.parse("2026-07-27T00:00:00Z") - days * 86400000).toISOString() }, "2026-07-27T00:00:00Z"), status);
}

const html = fs.readFileSync("tests/lp076-browser-certification.html", "utf8");
for (const area of ["observation qualification", "archive construction", "incremental learning", "learning isolation", "observation aging", "learning quality", "LP067 compatibility", "production isolation"]) assert.ok(html.includes(`check("${area}"`));
assert.match(html, /window\.__LP076_CERTIFICATION__/);
for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP076|historical-observation-learning/i, `${file} remains unchanged and isolated`);

const handoff = fs.readFileSync("docs/handoffs/LP076-HISTORICAL-INTELLIGENCE-LEARNING-FOUNDATION-HANDOFF.md", "utf8");
for (let number = 1; number <= 10; number += 1) assert.match(handoff, new RegExp(`## ${number}\\.`));
assert.match(handoff, /## Updated next-chat handoff/);
console.log("LP076 Historical Intelligence learning foundation passed");
