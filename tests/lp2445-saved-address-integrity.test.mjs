import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync("js/gridly-saved-address-integrity.js", "utf8");
const clientSource = fs.readFileSync("js/gridly-geocoding-client.js", "utf8");
const edgeSource = fs.readFileSync("supabase/functions/gridly-geocode/index.ts", "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const contract = context.globalThis.GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT;
const candidate = (overrides = {}) => ({ latitude: 30.057, longitude: -94.795,
  displayName: "1923 Sam Houston St, Liberty, Texas 77575",
  address: { city: "Liberty", state: "Texas", postalCode: "77575", county: "Liberty County", road: "Sam Houston Street", houseNumber: "1923" }, ...overrides });
const searchWith = (...results) => async (request) => ({ ok: true, status: "success", results, request });

test("GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT is named and Texas governed", () => {
  assert.equal(contract.name, "GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT");
  assert.equal(contract.geography, "Texas");
});

test("full qualified urban and rural Texas addresses resolve with provenance", async () => {
  for (const [address, result] of [
    ["1923 Sam Houston St, Liberty, TX 77575", candidate()],
    ["650 FM 1011, Liberty, TX 77575", candidate({ displayName: "650 FM 1011, Liberty, Texas 77575", address: { city: "Liberty", state: "TX", postalCode: "77575", county: "Liberty County", road: "FM 1011", houseNumber: "650" } })]
  ]) {
    const resolution = await contract.resolveAddress({ address, search: searchWith(result) });
    assert.equal(resolution.resolutionStatus, "success");
    assert.equal(resolution.validationStatus, "passed");
    assert.ok(Number.isFinite(resolution.coordinates.lat));
  }
});

test("wrong city, wrong state, and ZIP conflicts fail closed", async () => {
  const address = "1710 Sam Houston Ave, Liberty, TX 77575";
  const wrongCity = await contract.resolveAddress({ address, search: searchWith(candidate({ address: { city: "Arlington", state: "Texas", postalCode: "76014" }, latitude: 32.6879738, longitude: -97.2385385 })) });
  assert.equal(wrongCity.resolutionStatus, "failed");
  assert.ok(["zip_conflict", "city_conflict"].includes(wrongCity.rejectionReason));
  const wrongState = await contract.resolveAddress({ address, search: searchWith(candidate({ address: { city: "Liberty", state: "Ohio", postalCode: "77575" }, latitude: 39, longitude: -84 })) });
  assert.equal(wrongState.rejectionReason, "outside_supported_texas_geography");
  const wrongZip = await contract.resolveAddress({ address, search: searchWith(candidate({ address: { city: "Liberty", state: "Texas", postalCode: "78701" } })) });
  assert.equal(wrongZip.rejectionReason, "zip_conflict");
  const cityOnlyConflict = await contract.resolveAddress({ address: "1710 Sam Houston Ave, Liberty, TX", search: searchWith(candidate({ address: { city: "Arlington", state: "Texas" }, latitude: 32.6879738, longitude: -97.2385385 })) });
  assert.equal(cityOnlyConflict.rejectionReason, "city_conflict");
});

test("bare street never calls geocoder or silently saves a distant match", async () => {
  let calls = 0;
  const resolution = await contract.resolveAddress({ address: "1710 Sam Houston Avenue", search: async () => { calls++; return { ok: true, results: [candidate()] }; } });
  assert.equal(calls, 0);
  assert.equal(resolution.rejectionReason, "locality_required");
});

test("Home and Work names are isolated from the exact geocoder address query", async () => {
  for (const name of ["Home", "Work"]) {
    let request;
    await contract.resolveAddress({ address: "1710 Sam Houston Avenue, Liberty, TX 77575", name,
      search: async (value) => { request = value; return { ok: true, results: [candidate()] }; } });
    assert.equal(request.query, "1710 Sam Houston Avenue, Liberty, TX 77575");
    assert.doesNotMatch(request.query, new RegExp(`^${name}\\b`, "i"));
  }
});

test("saved-address request uses the deployed Edge Function request contract", async () => {
  let posted;
  const canonicalPayload = { ok: true, status: "success", providerBoundary: "gridly", requestId: "test",
    results: [candidate({ latitude: 30.0588518, longitude: -94.7978967 })] };
  const browser = { crypto: { randomUUID: () => "lp2445-test" }, fetch: async (_url, init) => {
    posted = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => canonicalPayload };
  } };
  vm.runInNewContext(clientSource, { window: browser });
  const result = await contract.resolveAddress({ address: "1710 Sam Houston Ave, Liberty, TX 77575",
    search: browser.gridlyGeocodingClient.search });
  assert.deepEqual(Object.keys(posted).sort(), ["intent", "limit", "query", "requestId", "requestMode"].sort());
  assert.equal(posted.requestMode, "explicit_search");
  assert.match(edgeSource, /\["explicit_search", "lp102_certification", "lp103_certification", "lp104_certification"\]/);
  assert.equal(result.requestAttempted, true);
  assert.equal(result.httpStatus, 200);
  assert.equal(result.providerResponseReceived, true);
  assert.equal(result.providerCandidateCount, 1);
  assert.equal(result.candidateCountAfterNormalization, 1);
});

test("valid full-address legacy Work revalidates while bad bare Home remains preserved and blocked", async () => {
  const work = { id: "work", label: "Work", address: "1829 Sam Houston St, Liberty, TX 77575",
    lat: 30.0588518, lng: -94.7978967, coordinateSource: "geocode" };
  const home = { id: "home", label: "Home", address: "1710 Sam Houston Avenue",
    lat: 32.6879738, lng: -97.2385385, coordinateSource: "geocode" };
  const workResult = await contract.revalidateLegacyPlace({ place: work,
    search: searchWith(candidate({ latitude: 30.0588518, longitude: -94.7978967,
      address: { city: "Liberty", state: "Texas", postalCode: "77575", county: "Liberty County", road: "Sam Houston Street", houseNumber: "1829" } })) });
  let homeCalls = 0;
  const homeResult = await contract.revalidateLegacyPlace({ place: home, search: async () => { homeCalls++; } });
  assert.equal(workResult.place.resolutionStatus, "success");
  assert.equal(workResult.place.validationStatus, "passed");
  assert.equal(workResult.place.routeEligible, true);
  assert.equal(homeCalls, 0);
  assert.equal(homeResult.place.routeEligible, false);
  assert.equal(homeResult.place.migrationResult, "locality_required");
  assert.equal(homeResult.place.lat, 32.6879738);
  assert.equal(homeResult.place.lng, -97.2385385);
  assert.equal(work.address, "1829 Sam Houston St, Liberty, TX 77575");
});

test("application locks replacement, separation, persistence provenance, and route eligibility", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /restoreSavedPlacesStorageSnapshot\(\)/);
  assert.match(app, /home: current\.home \?\? null[\s\S]*work: current\.work \?\? null/);
  assert.match(app, /resolutionStatus: coordinateResolution\?\.resolutionStatus/);
  assert.match(app, /validationStatus: coordinateResolution\?\.validationStatus/);
  assert.match(app, /place\.resolutionStatus === "success" && place\.validationStatus === "passed"/);
  assert.match(app, /rawInput: String\(work \|\| ""\)\.trim\(\)/);
  assert.match(app, /gridlySavedAddressIntegrityAudit/);
  assert.match(app, /legacy_requires_revalidation/);
  assert.match(app, /Needs verification/);
  assert.match(app, /Verify this saved place before using Route Watch/);
  assert.match(app, /for \(const slot of \["home", "work"\]\)/);
});
