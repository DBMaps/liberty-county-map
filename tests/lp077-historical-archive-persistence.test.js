const assert = require("node:assert/strict");
const fs = require("node:fs");
const persistence = require("../js/historical-archive-persistence.js");
const learning = require("../js/historical-observation-learning.js");
const lp067 = require("../js/historical-pattern-intelligence.js");

const source = (id, timestamp) => ({ id, awareness_area: "Dayton", community: "Dayton", county: "Liberty County", road_name: "Waco Street", crossing_name: "Waco Street", hazard_type: "blocked_crossing", event_type: "rail_delay", observed_at: timestamp, duration_minutes: 30 });
const options = { validAwarenessAreas: ["Dayton"], validCounties: ["Liberty County"] };
const records = [source("a", "2026-01-15T12:00:00Z"), source("b", "2026-07-15T12:00:00Z"), source("b-copy", "2026-07-15T12:00:00Z")].map((item) => learning.archiveObservation(item, options).record);
const metadata = { archiveVersion: 1, archiveId: "liberty-history-2026", createdAt: "2026-07-27T00:00:00.000Z", timezoneId: "liberty-county", geographyRegistryVersion: persistence.GEOGRAPHY.registryVersion };
const archive = persistence.createArchive(records, metadata);
const authorization = { authorized: true, purpose: "LP077 controlled certification" };

assert.deepEqual(persistence.ACTIVATION, { productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticBackfill: false });
assert.equal(persistence.validateArchive(archive).valid, true);
assert.equal(Object.isFrozen(archive), true);
const first = persistence.replay(archive, authorization);
const second = persistence.replay(archive, authorization);
assert.deepEqual(first, second, "repeated replay is identical");
assert.equal(first.summary.attempted, 3);
assert.equal(first.summary.delivered, 2);
assert.equal(first.summary.duplicatesSuppressed, 1);
assert.deepEqual(first.delivered.map((record) => record.archiveId), [records[0].archiveId, records[1].archiveId], "original ordering is preserved");
assert.equal(persistence.replay(archive, {}).status, "rejected");

for (const mutation of [
  (copy) => { copy.records[0].sequence = 7; },
  (copy) => { copy.records[0].record.community = "Changed"; },
  (copy) => { delete copy.archiveId; },
  (copy) => { copy.archiveVersion = 99; }
]) {
  const corrupted = JSON.parse(JSON.stringify(archive)); mutation(corrupted);
  const replay = persistence.replay(corrupted, authorization);
  assert.equal(replay.status, "rejected"); assert.equal(replay.delivered.length, 0, "validation fails closed"); assert.ok(replay.diagnostics.length);
}
assert.deepEqual(persistence.compatibility(99), { compatible: false, code: "archive_version_newer_than_runtime", version: 99 });
assert.equal(persistence.migrationPlan(1, 2).automatic, false);

const winter = persistence.normalizeTimestamp("2026-01-15T12:00:00Z", "liberty-county");
const summer = persistence.normalizeTimestamp("2026-07-15T12:00:00Z", "liberty-county");
assert.deepEqual(winter, persistence.normalizeTimestamp("2026-01-15T12:00:00Z", "liberty-county"));
assert.equal(winter.localTime, "06:00:00"); assert.equal(summer.localTime, "07:00:00");
assert.equal(persistence.GEOGRAPHY.communities.dayton.countyId, "liberty-county");
assert.deepEqual(lp067.discoverPatterns(learning.toLP067Observations(first.delivered), { now: "2026-07-27T12:00:00Z" }), lp067.discoverPatterns(first.delivered, { now: "2026-07-27T12:00:00Z" }), "LP067 DTO is unchanged");

let delivery;
assert.equal(persistence.controlledBackfill(archive, authorization, (rows) => { delivery = rows; }).status, "complete");
assert.deepEqual(delivery, first.delivered);
assert.equal(persistence.controlledBackfill(archive, authorization, () => { throw new Error("interrupt"); }).status, "interrupted");
assert.deepEqual(archive, persistence.createArchive(records, metadata), "failure leaves archive unchanged");

(async () => {
  const providerValue = JSON.parse(JSON.stringify(archive));
  const adapter = persistence.createReadOnlyAdapter({ read: async (id) => { assert.equal(id, archive.archiveId); return providerValue; } });
  const read = await adapter.readArchive(archive.archiveId); read.records[0].record.community = "Impossible";
  assert.equal(read.records[0].record.community, "Dayton");
  assert.equal(providerValue.records[0].record.community, "Dayton");
  const html = fs.readFileSync("tests/lp077-browser-certification.html", "utf8");
  assert.match(html, /gridlyLp077HistoricalArchivePersistenceCertificationAudit/);
  for (const key of ["passive", "presentationOnlyFalse", "productionIsolationPreserved", "replayGovernanceAvailable", "persistenceAdapterAvailable", "archiveIntegrityValidationAvailable", "archiveVersionGovernanceAvailable", "timezoneRegistryAvailable", "geographyRegistryAvailable", "deterministicReplayPass", "idempotencyPass", "partialFailureHandlingPass", "controlledBackfillGovernancePass", "lp067CompatibilityPreserved", "activationStillDisabled", "protectedSystemsUnchanged", "safeToMerge"]) assert.ok(html.includes(key), key);
  for (const file of ["index.html", "js/app.js"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP077|historical-archive-persistence/i, `${file} remains isolated`);
  console.log("LP077 Historical Archive Persistence & Replay Governance passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
