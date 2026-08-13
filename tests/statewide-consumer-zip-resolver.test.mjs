import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const index = JSON.parse(fs.readFileSync("data/generated/gridly-statewide-consumer-zip-index-v1.json"));
const overrides = JSON.parse(fs.readFileSync("data/gridly-consumer-zip-overrides-v1.json"));
const responses = new Map([
  ["data/generated/gridly-statewide-consumer-zip-index-v1.json", index],
  ["data/gridly-consumer-zip-overrides-v1.json", overrides]
]);
const context = { fetch: async (url) => ({ ok: true, json: async () => responses.get(url) }) };
context.window = context;
vm.runInNewContext(fs.readFileSync("js/gridly-statewide-zip-resolver.js", "utf8"), context);
await context.GridlyStatewideZipResolver.load();

test("artifact has audited statewide cardinalities and keeps every county evidence row", () => {
  assert.deepEqual(index.counts, { texasZips: 2433, evidenceRows: 3408, singleCountyZips: 1706, multiCountyZips: 727 });
  assert.equal(index.records.flatMap((record) => record.countyCandidates).length, 3408);
  assert.equal(overrides.records.length, 37);
});

test("strict ZIP normalization accepts only ZIP and ZIP+4", () => {
  const normalize = context.GridlyStatewideZipResolver.normalize;
  assert.equal(normalize("75201"), "75201");
  assert.equal(normalize("75201-1234"), "75201");
  for (const value of ["7520", "752011", "75201-123", "abc75201", "75201 1234"]) assert.equal(normalize(value), null);
});

test("Dallas and historical governed identities require explicit confirmation", () => {
  const resolve = context.GridlyStatewideZipResolver.resolveLoaded;
  const dallas = resolve("75201");
  assert.equal(dallas.status, "requires_confirmation");
  assert.deepEqual(Array.from(dallas.candidates, (row) => [row.countyFips, row.placeGeoid, row.consumerLabel]), [["48113", "4819000", "Dallas"]]);
  const liberty = resolve("77575");
  assert.equal(liberty.status, "requires_confirmation");
  assert.equal(liberty.candidates[0].countyId, "liberty-tx");
  assert.equal(liberty.candidates[0].consumerLabel, "Liberty");
  const palestine = resolve("75801");
  assert.equal(palestine.candidates[0].countyId, "anderson-tx");
  assert.equal(palestine.candidates[0].placeGeoid, "4854708");
});

test("representative statewide journeys retain all multi-county choices", () => {
  const resolve = context.GridlyStatewideZipResolver.resolveLoaded;
  for (const zip of ["78520", "75766", "76201", "79761", "79851", "79701", "79843", "75652", "76043", "79601"]) assert.notEqual(resolve(zip).status, "unavailable", zip);
  for (const zip of ["75007", "75652", "76043", "79601"]) {
    const result = resolve(zip);
    assert.equal(result.status, "ambiguous", zip);
    assert.ok(result.countyCandidates.length > 1, zip);
  }
  assert.equal(resolve("77201").status, "po_box_not_supported");
  assert.equal(resolve("77210").status, "unique_zip_not_supported");
});

test("zero residential ratio remains evidence rather than a ZIP-type inference", () => {
  const zero = index.records.flatMap((record) => record.countyCandidates).find((county) => county.evidence.residentialRatio === 0);
  assert.ok(zero);
  assert.equal(Object.hasOwn(zero, "zipType"), false);
});

test("artifact load failure returns manual fallback, never unavailable", async () => {
  const failed = { fetch: async () => { throw new Error("offline"); } };
  failed.window = failed;
  vm.runInNewContext(fs.readFileSync("js/gridly-statewide-zip-resolver.js", "utf8"), failed);
  const result = await failed.GridlyStatewideZipResolver.resolve("75201");
  assert.equal(result.status, "manual_fallback");
  assert.equal(result.manualFallbackAvailable, true);
});
