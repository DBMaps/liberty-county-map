const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { classifyWeatherAuthority, getWeatherAuthorityEnvelope } = require("../js/gridlyLP240WeatherAuthorityAudit.js");

const healthy = { sourceConfigured: true, sourceRequestAttempted: true, sourceRequestSucceeded: true, sourceHealthy: true, sourceFreshEnough: true, canonicalGeographyResolved: true, geographyAgreementPass: true };

test("production LP236 handoff consumes the LP240 runtime envelope", () => {
  const index = fs.readFileSync("index.html", "utf8");
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.ok(index.indexOf("js/gridlyLP240WeatherAuthorityAudit.js") < index.indexOf("js/app.js"));
  assert.match(app, /gridlyGetWeatherRuntimeAuthorityEnvelope/);
  assert.match(app, /gridlyLP240ClassifyWeatherAuthority/);
  assert.match(app, /state: weatherClassification\?\.weatherAuthorityState \|\| "UNAVAILABLE"/);
});

test("runtime envelope keeps connector request truth separate from provider configuration", () => {
  const now = Date.parse("2026-08-26T12:02:00Z");
  const result = getWeatherAuthorityEnvelope({
    now,
    providerRuntime: { enabled: false, lastError: null },
    connectorRuntime: {
      connected: true,
      requestAttempted: true,
      requestSucceeded: true,
      lastRequestAt: "2026-08-26T12:00:00Z",
      lastSuccessAt: "2026-08-26T12:00:01Z",
      lastFailureAt: null,
      lastError: null,
      refreshIntervalMs: 120000
    },
    snapshot: { authorityEligibleRecordCount: 0 },
    selected: { label: "Dayton", countyId: "liberty-tx" },
    canonical: { community: "Dayton", countyId: "liberty-tx" }
  });
  assert.equal(result.configured, false);
  assert.equal(result.requestAttempted, true);
  assert.equal(result.requestSucceeded, true);
  assert.equal(result.healthy, false);
  assert.equal(result.freshEnoughForAuthority, true);
  assert.equal(result.geographyAgreementPass, false);
});

test("CASE A - healthy current applicable evidence is ACTIVE", () => {
  const result = classifyWeatherAuthority({ ...healthy, currentApplicableCount: 2, presentationCount: 2 });
  assert.equal(result.weatherAuthorityState, "ACTIVE");
  assert.equal(result.quietProven, false);
});

test("CASE B - healthy governed zero is QUIET", () => {
  const result = classifyWeatherAuthority({ ...healthy, currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "No active weather alerts" });
  assert.equal(result.weatherAuthorityState, "QUIET");
  assert.equal(result.quietProven, true);
  assert.equal(result.presentationAgreementPass, true);
});

test("CASE C - source disabled or unconfigured is UNAVAILABLE", () => {
  const result = classifyWeatherAuthority({ ...healthy, sourceConfigured: false, currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "Weather information unavailable." });
  assert.equal(result.weatherAuthorityState, "UNAVAILABLE");
  assert.equal(result.quietProven, false);
  assert.equal(result.presentationAgreementPass, true);
});

test("CASE D - request failure is UNAVAILABLE", () => {
  const result = classifyWeatherAuthority({ ...healthy, sourceRequestSucceeded: false, sourceHealthy: false, sourceError: "network failed", currentApplicableCount: 0 });
  assert.equal(result.weatherAuthorityState, "UNAVAILABLE");
  assert.equal(result.quietProven, false);
  assert.equal(result.firstLosingStage, "SOURCE_HEALTH");
});

test("CASE E - unresolved geography is UNAVAILABLE", () => {
  const result = classifyWeatherAuthority({ ...healthy, geographyAgreementPass: false, currentApplicableCount: 0 });
  assert.equal(result.weatherAuthorityState, "UNAVAILABLE");
  assert.equal(result.quietProven, false);
  assert.equal(result.firstLosingStage, "GOVERNED_GEOGRAPHY");
});

test("CASE F - expired evidence only is QUIET after a fresh healthy governed evaluation", () => {
  const result = classifyWeatherAuthority({ ...healthy, rawWeatherRecordCount: 1, currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "No active weather alerts" });
  assert.equal(result.weatherAuthorityState, "QUIET");
  assert.equal(result.quietProven, true);
});

test("CASE G - an empty array without authority cannot prove QUIET", () => {
  const result = classifyWeatherAuthority({ currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "Weather information unavailable." });
  assert.equal(result.weatherAuthorityState, "UNAVAILABLE");
  assert.equal(result.quietProven, false);
  assert.equal(result.presentationAgreementPass, true);
});

test("CASE H - false quiet presentation fails for UNAVAILABLE", () => {
  const presentation = { presentationCount: 0, presentationEmptyState: "No active weather alerts" };
  assert.equal(classifyWeatherAuthority({ ...healthy, sourceRequestSucceeded: false, sourceHealthy: false, currentApplicableCount: 0, ...presentation }).presentationAgreementPass, false);
});

test("CASE I - false unavailable presentation fails for QUIET", () => {
  const result = classifyWeatherAuthority({ ...healthy, currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "Weather information unavailable." });
  assert.equal(result.weatherAuthorityState, "QUIET");
  assert.equal(result.presentationAgreementPass, false);
});

const { evaluatePlaceAlertGeography } = require("../js/gridlyLP240WeatherAuthorityAudit.js");
const square = (x, y, size = 2) => ({ type: "Polygon", coordinates: [[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]] });
const place = square(0, 0);

test("geography CASE A - alert Polygon intersects PLACE", () => {
  assert.deepEqual(evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "A", geometry: square(1, 1) }] }).applicableAlertIds, ["A"]);
});
test("geography CASE B - disjoint Polygon proves not applicable", () => {
  const result = evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "B", geometry: square(5, 5) }] });
  assert.equal(result.placeAlertIntersectionCount, 1); assert.deepEqual(result.applicableAlertIds, []); assert.deepEqual(result.unresolvedAlertIds, []);
});
test("geography CASE C - MultiPolygon intersects PLACE", () => {
  const geometry = { type: "MultiPolygon", coordinates: [square(5,5).coordinates, square(1,1).coordinates] };
  assert.deepEqual(evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "C", geometry }] }).applicableAlertIds, ["C"]);
});
test("geography CASE D - null geometry uses resolvable affected zone", () => {
  assert.deepEqual(evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "D", geometry: null, affectedZones: ["TXZ001"] }], zoneGeometries: { TXZ001: square(1,1) } }).applicableAlertIds, ["D"]);
});
test("geography CASE E - unresolved zones leave applicability unavailable", () => {
  assert.deepEqual(evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "E", affectedZones: ["TXZ404"] }] }).unresolvedAlertIds, ["E"]);
});
test("geography CASE F - free-text locality is not authoritative", () => {
  assert.deepEqual(evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "F", areaDesc: "Dayton" }] }).unresolvedAlertIds, ["F"]);
});
test("geography CASE G - centroid/radius is not authoritative", () => {
  assert.deepEqual(evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "G", latitude: 1, longitude: 1, radiusMiles: 7 }] }).unresolvedAlertIds, ["G"]);
});
test("geography CASE H - county text does not activate a disjoint PLACE", () => {
  const result = evaluatePlaceAlertGeography({ placeGeometry: place, alerts: [{ id: "H", county: "Liberty", geometry: square(20,20) }] });
  assert.equal(result.placeAlertIntersectionCount, 1); assert.deepEqual(result.applicableAlertIds, []);
});
test("geography CASE I - full multi-county PLACE geometry is not truncated by selected membership", () => {
  const multiCountyPlace = { type: "MultiPolygon", coordinates: [square(0,0).coordinates, square(10,10).coordinates] };
  const result = evaluatePlaceAlertGeography({ placeGeometry: multiCountyPlace, selectedGovernedMembership: "county-a", alerts: [{ id: "I", geometry: square(11,11) }] });
  assert.deepEqual(result.applicableAlertIds, ["I"]);
});

test("provider retains bounded NWS geography audit metadata without exposing raw geometry", () => {
  const provider = require("../js/gridlyWeatherProvider.js");
  const [record] = provider.normalizeRecords({ features: [{ id: "nws-1", geometry: square(0,0), properties: { event: "Tornado Warning", affectedZones: ["https://api.weather.gov/zones/forecast/TXZ001"] } }] });
  assert.deepEqual(record.geographyAudit, { geometryType: "Polygon", affectedZones: ["https://api.weather.gov/zones/forecast/TXZ001"] });
  assert.equal(record.geometry, undefined);
});
