import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync("js/gridly-saved-address-integrity.js", "utf8");
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

test("application locks replacement, separation, persistence provenance, and route eligibility", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /restoreSavedPlacesStorageSnapshot\(\)/);
  assert.match(app, /home: current\.home \?\? null[\s\S]*work: current\.work \?\? null/);
  assert.match(app, /resolutionStatus: coordinateResolution\?\.resolutionStatus/);
  assert.match(app, /validationStatus: coordinateResolution\?\.validationStatus/);
  assert.match(app, /place\.resolutionStatus === "success" && place\.validationStatus === "passed"/);
  assert.match(app, /rawInput: String\(work \|\| ""\)\.trim\(\)/);
  assert.match(app, /gridlySavedAddressIntegrityAudit/);
});
