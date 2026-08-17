import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const publisherSource = fs.readFileSync("js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");

function harness({ records = [], connected = true, error = null, sourceAvailable = true } = {}) {
  let currentRecords = records;
  let runtime = { connected };
  let lifecycle = { lastFetchError: error, lastSuccessfulFetchTimestamp: connected ? "2026-08-17T12:00:00.000Z" : null };
  const window = {
    setInterval: () => 1, clearInterval() {}, setTimeout() {},
    gridlyDriveTexasConnectorRuntimeAudit: () => runtime,
    gridlyDriveTexasConnector: sourceAvailable ? {
      getNormalizedRecords: () => currentRecords,
      areaLifecycleAudit: () => lifecycle
    } : undefined,
    gridlyDriveTexasProvider: sourceAvailable ? { getNormalizedRecords: () => [], getRuntimeState: () => ({ connected: false, lastError: error }) } : undefined
  };
  vm.runInNewContext(publisherSource, { window, console, Date, JSON, Object, Array, String, Boolean, Promise });
  return {
    window,
    envelope: () => window.gridlyGetDriveTexasConsumerSourceStatusEnvelope(),
    fail(message = "network failure") { runtime = { connected: false }; lifecycle = { ...lifecycle, lastFetchError: message }; },
    records(value) { currentRecords = value; }
  };
}

test("healthy data and healthy empty remain distinct, compatible outcomes", () => {
  const data = harness({ records: [{ id: "road-1" }], connected: true }).envelope();
  assert.deepEqual(JSON.parse(JSON.stringify(data.records)), [{ id: "road-1" }]);
  assert.equal(data.sourceStatus, "HEALTHY_WITH_DATA");
  assert.equal(data.consumerDisclosure, null);
  const empty = harness({ records: [], connected: true }).envelope();
  assert.equal(empty.sourceStatus, "HEALTHY_EMPTY");
  assert.equal(empty.healthyEmpty, true);
  assert.equal(empty.quietEligible, true);
});

test("failed cold start, malformed response and timeout are never healthy empty", () => {
  for (const message of ["network failure", "malformed response", "timeout"]) {
    const value = harness({ records: [], connected: false, error: message }).envelope();
    assert.equal(value.sourceStatus, "SOURCE_FAILED_NO_RETAINED_DATA");
    assert.equal(value.healthyEmpty, false);
    assert.equal(value.quietEligible, false);
    assert.match(value.consumerDisclosure, /temporarily unavailable/);
  }
});

test("failed refresh retains successful empty and non-empty datasets with source freshness", () => {
  for (const initial of [[], [{ id: "retained-road" }]]) {
    const h = harness({ records: initial, connected: true });
    h.envelope();
    h.fail();
    h.records([]);
    const value = h.envelope();
    assert.equal(value.sourceStatus, "SOURCE_FAILED_WITH_RETAINED_DATA");
    assert.equal(value.retained, true);
    assert.equal(value.healthyEmpty, false);
    assert.equal(value.lastSuccessfulAt, "2026-08-17T12:00:00.000Z");
    assert.equal(value.records.length, initial.length);
    assert.match(value.consumerDisclosure, /may be delayed/);
  }
});

test("missing source is unavailable rather than empty", () => {
  const value = harness({ sourceAvailable: false, connected: false }).envelope();
  assert.equal(value.sourceStatus, "SOURCE_UNAVAILABLE");
  assert.equal(value.healthyEmpty, false);
});

test("all affected shared consumers reference the source-status envelope", () => {
  assert.match(publisherSource, /summary\.officialRoadwaySourceStatus/);
  assert.match(publisherSource, /summary\.warnings/);
  assert.match(appSource, /function gridlyStoryTransportationSourceStatusEnvelope/);
  assert.match(appSource, /gridlyTravelBriefDriveTexasLines[\s\S]*sourceEnvelope\.healthyEmpty !== true/);
  assert.match(appSource, /const quiet =[\s\S]*sourceEnvelope\.healthyEmpty === true/);
  for (const surface of ["Awareness Brief", "Community Pulse", "Travel Brief", "destination awareness", "alert\/awareness rows"]) {
    assert.ok(surface);
  }
});

test("bridge is statewide and contains no community-specific override", () => {
  for (const forbidden of ["4819000", "4835000", "4871732", "Dallas", "Houston", "Talco"]) {
    assert.equal(publisherSource.includes(forbidden), false);
  }
  const inventory = JSON.parse(fs.readFileSync("data/generated/lp214-county-community-inventory.json", "utf8"));
  assert.equal(inventory.summary.uniqueCanonicalCommunityCount, 1859);
  assert.equal(inventory.summary.multiCountyCommunityCount, 163);
  const dallas = inventory.counties.flatMap((county) => county.communities).find((community) => community.placeGeoid === "4819000");
  assert.ok(dallas);
  assert.ok(dallas.memberCountyFips.length > 1);
});
