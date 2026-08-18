const test = require("node:test");
const assert = require("node:assert/strict");
const contract = require("../js/gridlyDestinationSearchLocality.js");

test("query normalization is case and whitespace invariant", () => {
  for (const query of ["Walmart", "walmart", "WALMART", "  WALMART  ", " wal   mart "]) {
    assert.equal(contract.normalizeQuery(query), query.includes(" ") && query.trim().toLowerCase() === "wal   mart" ? "wal mart" : "walmart");
  }
});

test("governed relevance ranks nearby exact matches before farther exact matches", () => {
  const anchor = { lat: 30, lng: -95 };
  const atMiles = (id, name, miles) => ({ id, name, lat: 30 + miles / 69, lng: -95, sourceConfidence: 30 });
  const ranked = contract.rankCandidates("market", anchor, [
    atMiles("b", "Market", 25), atMiles("d", "Market", 60), atMiles("c", "Market Pharmacy", 1), atMiles("a", "Market", 2)
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ["a", "c", "b", "d"]);
  assert.ok(ranked.every((item) => Number.isFinite(item.audit.distanceMiles) && Number.isFinite(item.audit.score)));
});

test("cache identity isolates transitions and multi-county identity from county order", () => {
  const a = { canonicalCommunityKey: "place:4806128", placeGeoid: "4806128", lat: 29.7355, lng: -94.9774 };
  const b = { canonicalCommunityKey: "place:4842568", placeGeoid: "4842568", lat: 30.0572, lng: -94.795 };
  assert.notEqual(contract.contextCacheKey("walmart", a), contract.contextCacheKey("walmart", b));
  assert.equal(contract.contextCacheKey("WALMART", { ...a, countyId: "chambers-tx" }), contract.contextCacheKey(" walmart ", { ...a, countyId: "harris-tx" }));
});

test("empty candidate set and duplicate identities remain deterministic inputs", () => {
  assert.deepEqual(contract.rankCandidates("hospital", { lat: 30, lng: -95 }, []), []);
  const candidates = [{ id: "same", name: "Gas", lat: 30, lng: -95 }, { id: "same", name: "Gas", lat: 30, lng: -95 }];
  assert.deepEqual(contract.rankCandidates("gas", { lat: 30, lng: -95 }, candidates).map((x) => x.audit.finalRank), [1, 2]);
});
