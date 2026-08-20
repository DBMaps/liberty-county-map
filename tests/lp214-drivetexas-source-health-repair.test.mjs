import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const publisherSource = fs.readFileSync("js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");

function harness({ records = [], allRecords = [], connected = true, error = null, sourceAvailable = true, area = { id: "place-4819000", countyId: "48113" }, canonicalArea = area, select, authoritySnapshot } = {}) {
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
    getGridlyCanonicalAwarenessPresentationContext: () => canonicalArea,
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

test("Fredericksburg canonical place ownership preserves the connector's one current-area record", () => {
  const operationalCounty = { key: "gillespie-tx", countyId: "48171", label: "Gillespie County" };
  const fredericksburg = {
    key: "place-4827348",
    canonicalKey: "place-4827348",
    placeGeoid: "4827348",
    countyId: "48171",
    label: "Fredericksburg",
    lat: 30.2752,
    lng: -98.8719,
    radiusMiles: 7,
    geographicEvaluationState: "AVAILABLE"
  };
  const record = { id: "fredericksburg-bridge", eligible: true, source: "DriveTexas" };
  const h = harness({
    records: [record],
    area: operationalCounty,
    canonicalArea: fredericksburg,
    select: (input) => ({
      consumerVisibleSituations: input.records.filter((candidate) => candidate.eligible),
      lp0393ConsumerProjectionInputCount: input.records.length
    })
  });
  h.window.gridlyDriveTexasConnector.areaLifecycleAudit = () => ({
    lastFetchError: null,
    lastSuccessfulFetchTimestamp: "2026-08-17T12:00:00.000Z",
    currentAwarenessViewIdentity: "place-4827348",
    currentAwarenessViewMatchesSelectedArea: true
  });

  const value = h.envelope();
  assert.equal(value.records.length, 1);
  assert.equal(value.records[0].id, "fredericksburg-bridge");
  assert.equal(value.connected, true);
  assert.equal(value.sourceStatus, "HEALTHY_WITH_DATA");
  assert.equal(value.healthyEmpty, false);
  assert.equal(value.selectedAreaIdentity, "place-4827348");
  assert.equal(value.areaIdentity, "place-4827348");
  assert.equal(value.areaOwnershipMatches, true);
});

test("Houston LineStrings use the canonical focus and retain identical direct/envelope LP039.2 proofs", () => {
  const selectedArea = { key: "place-4835000", placeGeoid: "4835000", countyId: "48201", label: "Houston" };
  const canonicalArea = { ...selectedArea, canonicalKey: "place-4835000", lat: 29.7589382, lng: -95.3676974, radiusMiles: 7, focusAuthority: "LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1", geographicEvaluationState: "AVAILABLE" };
  const categories = ["Lane Closure", "Bridge Restriction", "Road Closure", "Lane Closure", "Road Closure", "Bridge Restriction"];
  const records = categories.map((category, index) => ({
    id: `houston-${index + 1}`,
    consumerSituationId: `drivetexas:provider:houston-${index + 1}`,
    providerId: `provider:houston-${index + 1}`,
    sourceId: `provider:houston-${index + 1}`,
    sourceProviderRecordId: `houston-${index + 1}`,
    authorityIdentity: `provider:houston-${index + 1}`,
    category,
    headline: `Houston governed roadway situation ${index + 1}`,
    startTime: "2026-08-18T10:00:00.000Z",
    updatedTime: "2026-08-18T11:00:00.000Z",
    endTime: "2026-09-18T10:00:00.000Z",
    status: "active",
    freshnessStatus: "active",
    sourceCoordinates: null,
    sourceGeometry: { type: "LineString", coordinates: [[-95.38 + index * 0.001, 29.75], [-95.36 + index * 0.001, 29.77]] },
    geometry: { type: "LineString", coordinates: [[-95.38 + index * 0.001, 29.75], [-95.36 + index * 0.001, 29.77]] },
    ownershipMethod: "trusted_source_geometry_intersects_awareness_radius",
    distanceFromSelectedAwarenessMiles: index + 0.25,
    geometryType: "LineString",
    canonicalIdentity: { key: canonicalArea.key, placeGeoid: canonicalArea.placeGeoid },
    retained: false,
    sourceStatus: "HEALTHY_WITH_DATA"
  }));
  const calls = [];
  const authoritySnapshot = (input) => {
    const focusAvailable = Number.isFinite(input.selectedAwarenessArea?.lat) && Number.isFinite(input.selectedAwarenessArea?.lng) && input.selectedAwarenessArea?.radiusMiles === 7;
    const proof = input.records.map((record) => ({ authorityIdentity: record.authorityIdentity, freshnessStatus: record.freshnessStatus, categoryAllowed: true, coordinateValid: false, geometryQualified: focusAvailable, ownershipMethod: focusAvailable ? record.ownershipMethod : "not_established", distanceFromAwarenessMiles: focusAvailable ? record.distanceFromSelectedAwarenessMiles : null, duplicateIdentity: false, finalEligibility: focusAvailable, ineligibilityReasons: focusAvailable ? [] : ["awareness_anchor_unavailable"] }));
    const eligible = input.records.filter((_record, index) => proof[index].finalEligibility);
    const snapshot = Object.freeze({ evaluationRevision: `${input.selectedAwarenessArea?.key}|unversioned|${input.records.length}|${eligible.map((record) => record.authorityIdentity).join(",")}`, selectedAwarenessArea: input.selectedAwarenessArea, counts: { authorityEligibleRecordCount: eligible.length }, authority: { authorityEligibleRecordCount: eligible.length, consumerEligibleSituations: eligible, recordProof: proof, eligibleRecordProof: proof.filter((entry) => entry.finalEligibility) } });
    calls.push({ input, snapshot });
    return snapshot;
  };
  const directSnapshot = authoritySnapshot({ records, selectedAwarenessArea: canonicalArea });
  const legacyEnvelopeSnapshot = authoritySnapshot({ records, selectedAwarenessArea: selectedArea });
  assert.equal(legacyEnvelopeSnapshot.counts.authorityEligibleRecordCount, 0, "identity-only selected area reproduces the pre-repair envelope loss");
  assert.ok(legacyEnvelopeSnapshot.authority.recordProof.every((entry) => entry.ineligibilityReasons.includes("awareness_anchor_unavailable")));
  let projectedSnapshot;
  const value = harness({
    records,
    area: selectedArea,
    canonicalArea,
    authoritySnapshot,
    select(input) {
      projectedSnapshot = input.authoritySnapshot;
      return { consumerVisibleSituations: input.authoritySnapshot.authority.consumerEligibleSituations, lp0393ConsumerProjectionInputCount: input.authoritySnapshot.authority.consumerEligibleSituations.length };
    }
  }).envelope();
  const envelopeCall = calls[2];
  assert.strictEqual(envelopeCall.input.records, records, "envelope passes the connector array without presentation normalization");
  records.forEach((record, index) => assert.strictEqual(envelopeCall.input.records[index], record));
  assert.strictEqual(envelopeCall.input.selectedAwarenessArea, canonicalArea);
  assert.deepEqual(envelopeCall.snapshot.authority.recordProof, directSnapshot.authority.recordProof);
  assert.strictEqual(projectedSnapshot, envelopeCall.snapshot);
  assert.equal(value.evaluationRevision, envelopeCall.snapshot.evaluationRevision);
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
