import assert from "node:assert/strict";
import test from "node:test";
import { certifyCoordinates, classifyPointWeatherAuthority } from "../tools/lp2401f/nws-point-authority-audit.mjs";

const now = Date.parse("2026-08-26T18:00:00Z");
const base = { supportedIdentity: true, lat: 30.0466, lng: -94.8852, alertRequestAttempted: true, alertRequestSucceeded: true, alertFetchedAt: "2026-08-26T17:55:00Z" };
const alert = (id, geometry = null) => ({ id, geometry, properties: { event: "Heat Advisory", affectedZones: ["https://api.weather.gov/zones/forecast/TXZ291"] } });

test("CASE A/B - a fresh valid point response distinguishes ACTIVE from authoritative empty QUIET", () => {
  assert.equal(classifyPointWeatherAuthority({ ...base, response: { features: [alert("nws-1")] } }, now).weatherAuthorityState, "ACTIVE");
  const quiet = classifyPointWeatherAuthority({ ...base, response: { type: "FeatureCollection", features: [] } }, now);
  assert.equal(quiet.weatherAuthorityState, "QUIET");
  assert.equal(quiet.quietProven, true);
});

test("CASE C/D/E/L - failures, invalid schema/coordinate, and stale success fail closed", () => {
  assert.equal(classifyPointWeatherAuthority({ ...base, alertRequestSucceeded: false }, now).authorityReason, "REQUEST_FAILED");
  assert.equal(classifyPointWeatherAuthority({ ...base, response: {} }, now).authorityReason, "INVALID_RESPONSE_SCHEMA");
  assert.equal(classifyPointWeatherAuthority({ ...base, lat: 999, response: { features: [] } }, now).authorityReason, "INVALID_GOVERNED_COORDINATE");
  assert.equal(classifyPointWeatherAuthority({ ...base, alertFetchedAt: "2026-08-26T17:00:00Z", response: { features: [] } }, now).authorityReason, "STALE_RESPONSE");
});

test("CASE F/G/H - governed coordinate certification covers Dayton, Tarkington, and multi-county Katy", () => {
  const certification = certifyCoordinates();
  const find = (label) => certification.records.filter((row) => row.area.label === label);
  assert.equal(find("Dayton").map((row) => row.identityClass).join(), "CANONICAL_PLACE");
  assert.equal(find("Tarkington").map((row) => row.identityClass).join(), "GOVERNED_NON_PLACE");
  assert.equal(find("Katy").length, 3);
  assert.ok(find("Katy").every((row) => row.area.placeGeoid === "4838476" && row.coordinate.source === "LP201_PLACE_PRESENTATION"));
  assert.equal(certification.allEligiblePointQueryCompatible, true);
});

test("CASE I - provider IDs deduplicate evidence returned for different points", () => {
  const dayton = classifyPointWeatherAuthority({ ...base, response: { features: [alert("nws-same")] } }, now);
  const tarkington = classifyPointWeatherAuthority({ ...base, lat: 30.3205, lng: -94.996, response: { features: [alert("nws-same")] } }, now);
  assert.deepEqual([...new Set([...dayton.activeAlertIds, ...tarkington.activeAlertIds])], ["nws-same"]);
});

test("CASE J/K - null zone-only and polygon geometries are both usable point-query results", () => {
  const polygon = { type: "Polygon", coordinates: [[[-95, 30], [-94, 30], [-94, 31], [-95, 31], [-95, 30]]] };
  for (const geometry of [null, polygon]) {
    const result = classifyPointWeatherAuthority({ ...base, response: { features: [alert("nws-geometry", geometry)] } }, now);
    assert.equal(result.weatherAuthorityState, "ACTIVE");
  }
});

test("statewide certification uses every eligible governed identity and preserves fallback ineligibility", () => {
  const result = certifyCoordinates();
  assert.deepEqual({ eligible: result.homeAreaEligibleCount, available: result.governedCoordinateAvailableCount, missing: result.governedCoordinateMissingCount, invalid: result.invalidCoordinateCount, canonical: result.canonicalPlaceCoordinateCount, nonPlace: result.governedNonPlaceCoordinateCount, countyWide: result.countyWideCoordinateCount, fallback: result.fallbackCoordinateCount }, { eligible: 2341, available: 2341, missing: 0, invalid: 0, canonical: 2058, nonPlace: 29, countyWide: 254, fallback: 1 });
});
