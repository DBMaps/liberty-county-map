import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const publisherSource = fs.readFileSync("js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");

function harness({ records = [], allRecords = [], connected = true, error = null, sourceAvailable = true, area = { id: "place-4819000", countyId: "48113" }, select, authoritySnapshot } = {}) {
  let currentRecords = records;
  let runtime = { connected };
  let lifecycle = { lastFetchError: error, lastSuccessfulFetchTimestamp: connected ? "2026-08-17T12:00:00.000Z" : null };
  const window = {
    setInterval: () => 1, clearInterval() {}, setTimeout() {},
    gridlyDriveTexasConnectorRuntimeAudit: () => runtime,
    gridlyDriveTexasConnector: sourceAvailable ? {
      getNormalizedRecords: () => currentRecords,
      getAllNormalizedRecords: () => allRecords,
      areaLifecycleAudit: () => lifecycle
    } : undefined,
    gridlyDriveTexasProvider: sourceAvailable ? { getNormalizedRecords: () => [], getRuntimeState: () => ({ connected: false, lastError: error }) } : undefined,
    getGridlySelectedAwarenessArea: () => area,
    gridlyGetDriveTexasAuthoritySnapshot: authoritySnapshot ? (input) => authoritySnapshot(input) : undefined,
    gridlySelectConsumerVisibleDriveTexasSituations: select
  };
  vm.runInNewContext(publisherSource, { window, console, Date, JSON, Object, Array, String, Boolean, Promise });
  return {
    window,
    envelope: () => window.gridlyGetDriveTexasConsumerSourceStatusEnvelope(),
    fail(message = "network failure") { runtime = { connected: false }; lifecycle = { ...lifecycle, lastFetchError: message }; },
    records(value) { currentRecords = value; }
  };
}

test("healthy current-awareness records enter the governed consumer selector instead of the statewide cache", () => {
  const dallasRecords = Array.from({ length: 8 }, (_, index) => ({ id: `dallas-${index + 1}`, eligible: true }));
  const statewideRecords = Array.from({ length: 623 }, (_, index) => ({ id: `statewide-${index + 1}` }));
  let selectorInput;
  const value = harness({
    records: dallasRecords,
    allRecords: statewideRecords,
    select(input) {
      selectorInput = input;
      return { consumerVisibleSituations: input.records.filter((record) => record.eligible) };
    }
  }).envelope();
  assert.equal(selectorInput.records.length, 8);
  assert.equal(selectorInput.selectedAwarenessArea.id, "place-4819000");
  assert.equal(value.records.length, 8);
  assert.equal(value.sourceStatus, "HEALTHY_WITH_DATA");
  assert.equal(value.healthyEmpty, false);
  assert.equal(value.quietEligible, false);
});

test("Houston-shaped governed records use one LP039.2 snapshot through projection and envelope", () => {
  const area = { key: "place-4835000", placeGeoid: "4835000", countyId: "48201", lat: 29.7589382, lng: -95.3676974, radiusMiles: 7, geographicEvaluationState: "AVAILABLE" };
  const records = Array.from({ length: 6 }, (_, index) => ({
    sourceId: `provider:houston-${index + 1}`,
    sourceProviderRecordId: `houston-${index + 1}`,
    authorityIdentity: `provider:houston-${index + 1}`,
    category: index % 2 ? "Construction" : "Lane Closure",
    headline: `Houston governed roadway situation ${index + 1}`,
    status: "active",
    freshnessStatus: "active",
    ownershipMethod: "valid_source_point_inside_awareness_radius_miles",
    distanceFromSelectedAwarenessMiles: index + 0.25,
    geometryType: "Point",
    canonicalIdentity: { key: area.key, placeGeoid: area.placeGeoid },
    retained: false
  }));
  const snapshot = Object.freeze({
    evaluationRevision: "place-4835000|fetch-17|6",
    selectedAwarenessArea: area,
    counts: { authorityEligibleRecordCount: 6 },
    authority: { authorityEligibleRecordCount: 6, consumerEligibleSituations: records }
  });
  let projectedSnapshot;
  const value = harness({
    records,
    area,
    authoritySnapshot: () => snapshot,
    select(input) {
      projectedSnapshot = input.authoritySnapshot;
      return { consumerVisibleSituations: input.authoritySnapshot.authority.consumerEligibleSituations, lp0393ConsumerProjectionInputCount: 6 };
    }
  }).envelope();
  assert.strictEqual(projectedSnapshot, snapshot);
  assert.equal(value.evaluationRevision, snapshot.evaluationRevision);
  assert.deepEqual([value.authorityInputCount, value.authorityEligibleCount, value.lp0393ProjectionInputCount, value.lp0393ProjectedCount, value.consumerVisibleCount, value.consumerEnvelopeCount], [6, 6, 6, 6, 6, 6]);
  assert.equal(value.countConverged, true);
  assert.equal(value.sourceStatus, "HEALTHY_WITH_DATA");
  assert.equal(value.healthyEmpty, false);
  assert.equal(value.quietEligible, false);
});

test("authority-positive projection loss fails closed instead of certifying healthy empty", () => {
  const value = harness({
    records: [{ sourceId: "provider:lost" }],
    authoritySnapshot: () => ({ evaluationRevision: "same-snapshot", selectedAwarenessArea: { geographicEvaluationState: "AVAILABLE" }, counts: { authorityEligibleRecordCount: 1 }, authority: { authorityEligibleRecordCount: 1, consumerEligibleSituations: [{ sourceId: "provider:lost" }] } }),
    select: () => ({ consumerVisibleSituations: [], lp0393ConsumerProjectionInputCount: 1 })
  }).envelope();
  assert.equal(value.sourceStatus, "PROJECTION_DEFECT");
  assert.equal(value.healthyEmpty, false);
  assert.equal(value.quietEligible, false);
  assert.equal(value.countConverged, false);
});

test("authority eligibility, not connector raw count, governs healthy empty", () => {
  const value = harness({
    records: [{ id: "expired-dallas", eligible: false }],
    select: (input) => ({ consumerVisibleSituations: input.records.filter((record) => record.eligible) })
  }).envelope();
  assert.equal(value.sourceStatus, "HEALTHY_EMPTY");
  assert.equal(value.records.length, 0);
  assert.equal(value.healthyEmpty, true);
  assert.equal(value.quietEligible, true);
});

test("multi-county identity and community transitions use only the current awareness view", () => {
  let area = { id: "place-4819000", countyId: "48113", memberCountyFips: ["48085", "48113", "48257"] };
  const h = harness({
    records: [{ id: "dallas-current", eligible: true }],
    area,
    select: (input) => ({ consumerVisibleSituations: input.records.filter((record) => record.eligible) })
  });
  assert.deepEqual(JSON.parse(JSON.stringify(h.envelope().records.map((record) => record.id))), ["dallas-current"]);
  area = { id: "place-4827000", countyId: "48201" };
  h.window.getGridlySelectedAwarenessArea = () => area;
  h.records([{ id: "houston-current", eligible: true }]);
  assert.deepEqual(JSON.parse(JSON.stringify(h.envelope().records.map((record) => record.id))), ["houston-current"]);
});

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
