import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync("js/gridly-saved-address-integrity.js", "utf8"), context);
const integrity = context.globalThis.GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT;
const acquisition = context.globalThis.GRIDLY_SAVED_ADDRESS_ACQUISITION_CONTRACT;
const texas = (road = "Main Street") => ({ latitude: 30.057, longitude: -94.795, displayName: "Texas address",
  address: { houseNumber: "100", road, city: "Liberty", state: "Texas", postalCode: "77575", county: "Liberty County" } });

test("bounded Texas normalization preserves every supplied authority", () => {
  for (const address of [
    "100 Main Avenue, Liberty, TX 77575-1234", "650 Farm to Market 1011, Liberty, TX 77575",
    "44 County Road 200, Liberty, TX 77575", "12 North Main Street, Liberty, TX 77575",
    "500 Congress Avenue, Austin, TX 78701", "100 Main Rd, Ames, TX 77575"
  ]) {
    const attempts = acquisition.normalizedAddressAttempts(address);
    assert.ok(attempts.length >= 1 && attempts.length <= 4);
    assert.ok(attempts.every((query) => acquisition.qualifiersPreserved(address, query)));
  }
  assert.ok(acquisition.normalizedAddressAttempts("100 Main Avenue, Liberty, TX 77575").some((q) => /Main Ave,/.test(q)));
  assert.equal(acquisition.normalizedAddressAttempts("1710 Sam Houston Avenue").length, 0);
});

test("retries all candidates and accepts a later safe normalized result", async () => {
  const calls = [];
  const result = await integrity.resolveAddress({ address: "650 Farm to Market 1011, Liberty, TX 77575", search: async ({ query }) => {
    calls.push(query);
    return calls.length === 1 ? { ok: false, status: "no_results", results: [] }
      : { ok: true, status: "success", results: [texas("FM 1011")] };
  } });
  assert.equal(result.resolutionStatus, "success");
  assert.equal(result.qualifiersPreserved, true);
  assert.equal(result.attempts.length, 2);
  assert.match(calls[1], /Liberty, TX 77575/);
});

test("wrong-city candidate remains rejected across retries and fallback is explicit", async () => {
  const wrong = { ...texas(), latitude: 32.6879738, longitude: -97.2385385,
    address: { city: "Arlington", state: "Texas", postalCode: "76014", road: "Sam Houston Avenue", houseNumber: "1710" } };
  const result = await integrity.resolveAddress({ address: "1710 Sam Houston Ave, Liberty, TX 77575",
    search: async () => ({ ok: true, status: "success", results: [wrong] }) });
  assert.equal(result.resolutionStatus, "failed");
  assert.equal(result.mapFallback.offered, true);
  assert.equal(result.mapFallback.confirmationRequired, true);
  assert.ok(result.attempts.every((attempt) => /Liberty, TX 77575/.test(attempt.normalizedQuery)));
});

test("map confirmation is honest, eligible, finite, and Texas governed", () => {
  const confirmed = acquisition.confirmMapSelection({ address: "1710 Sam Houston Ave, Liberty, TX 77575", slot: "home",
    coordinates: { lat: 30.057, lng: -94.795 }, anchor: { source: "validated_zip_community", query: "Liberty, TX, 77575" }, confirmedAt: "2026-09-04T00:00:00.000Z" });
  assert.equal(confirmed.coordinateSource, "user_map_selection");
  assert.equal(confirmed.resolutionStatus, "user_confirmed");
  assert.equal(confirmed.validationStatus, "user_confirmed");
  assert.equal(acquisition.isRouteEligible(confirmed), true);
  assert.equal(acquisition.isRouteEligible({ ...confirmed, confirmedAt: undefined }), false);
  assert.equal(acquisition.confirmMapSelection({ address: "x", coordinates: { lat: 40, lng: -74 } }), null);
});

test("transactional UI, presentation, persistence and route consumers retain governed contract", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /restoreSavedPlacesStorageSnapshot\(\)/);
  assert.match(app, /validated_zip_community/);
  assert.match(app, /Set \$\{slot === "home" \? "Home"/);
  assert.match(app, /coordinateSource: "user_map_selection"/);
  assert.match(app, /Location confirmed on map\./);
  assert.match(app, /Verified address\./);
  assert.match(app, /Needs verification\./);
  assert.match(app, /gridlySavedAddressAcquisitionAudit/);
  assert.match(app, /confirmedCoordinates/);
  assert.match(app, /home: current\.home \?\? null[\s\S]*work: current\.work \?\? null/);
});

test("Edge preserves provider structure and uses only existing no-paid-default authorities", () => {
  const edge = fs.readFileSync("supabase/functions/gridly-geocode/index.ts", "utf8");
  assert.match(edge, /nominatim\.openstreetmap\.org\/search/);
  assert.match(edge, /addressdetails: "1"/);
  for (const field of ["houseNumber", "road", "community", "city", "county", "state", "postalCode", "boundingBox", "providerClass", "providerType"]) assert.match(edge, new RegExp(field));
  assert.match(edge, /authoritativeRuralProvider !== "google"/);
});
