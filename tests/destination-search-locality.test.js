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

test("canonical PLACE key and LP201 anchor are retained independently of the label", () => {
  const area = { label: "Consumer label", canonicalKey: "place-4806128", placeGeoid: "4806128", countyId: "harris-tx" };
  const anchor = contract.resolveCanonicalAnchor(area, (identity) => ({
    ...identity, lat: 29.7355047, lng: -94.9774274,
    authority: "LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1", provenance: "lp201-artifact"
  }));
  assert.equal(anchor.label, "Consumer label");
  assert.equal(anchor.canonicalCommunityKey, "place-4806128");
  assert.equal(anchor.placeGeoid, "4806128");
  assert.equal(anchor.lat, 29.7355047);
  assert.equal(anchor.lng, -94.9774274);
});

test("canonical authority fails closed when presentation coordinates are absent", () => {
  const anchor = contract.resolveCanonicalAnchor({ label: "Any town", canonicalKey: "place-4806128" }, () => null);
  assert.equal(anchor.geographicAuthority, null);
  assert.equal(anchor.source, "canonical_place_presentation_unavailable");
  assert.equal(anchor.lat, null);
  assert.equal(anchor.lng, null);
  assert.equal(anchor.failure, "CANONICAL_PLACE_PRESENTATION_COORDINATES_UNAVAILABLE");
});

test("provider retrieval is canonical-local first, nearby second, and Texas fallback last", () => {
  const anchor = { label: "Selected town", canonicalCommunityKey: "place-4806128", lat: 29.7355047, lng: -94.9774274, radiusMiles: 7 };
  const plan = contract.buildProviderRequestPlan("pharmacy", anchor);
  assert.deepEqual(plan.map((request) => request.variant), ["canonical_local", "nearby_regional", "texas_fallback"]);
  assert.equal(plan[0].query, "pharmacy near Selected town Texas");
  assert.equal(plan[0].locality, "Selected town");
  assert.equal(plan[0].lat, anchor.lat);
  assert.equal(plan[0].lng, anchor.lng);
  assert.equal(plan[0].viewbox.length, 4);
  assert.equal(plan[0].bounded, false);
  assert.equal(plan[0].county, null);
  assert.equal(plan[2].viewbox, null);
});

test("closer live exact match outranks far supplemental static exact match", () => {
  const anchor = { lat: 29.7355047, lng: -94.9774274 };
  const ranked = contract.rankCandidates("grocery", anchor, [
    { id: "legacy", name: "Grocery", lat: 30.3413, lng: -95.0858, sourceConfidence: 50 },
    { id: "live", name: "Grocery", lat: 29.75, lng: -94.98, sourceConfidence: 25, requestProvenance: { requestSequence: 1, requestVariant: "canonical_local" } }
  ]);
  assert.equal(ranked[0].id, "live");
  assert.deepEqual(ranked[0].requestProvenance, { requestSequence: 1, requestVariant: "canonical_local" });
  assert.ok(ranked.every((candidate) => Number.isFinite(candidate.audit.distanceMiles)));
});

test("context transition changes key, anchor, request locality, and cache authority", () => {
  const focus = { "4806128": [29.7355, -94.9774], "4842568": [30.0572, -94.795] };
  const resolve = ({ placeGeoid }) => ({ lat: focus[placeGeoid][0], lng: focus[placeGeoid][1] });
  const baytown1 = contract.resolveCanonicalAnchor({ label: "Baytown", canonicalKey: "place-4806128" }, resolve);
  const liberty = contract.resolveCanonicalAnchor({ label: "Liberty", canonicalKey: "place-4842568" }, resolve);
  const baytown2 = contract.resolveCanonicalAnchor({ label: "Baytown", canonicalKey: "place-4806128" }, resolve);
  assert.notEqual(contract.contextCacheKey("hotel", baytown1), contract.contextCacheKey("hotel", liberty));
  assert.equal(contract.contextCacheKey("hotel", baytown1), contract.contextCacheKey("hotel", baytown2));
  assert.equal(contract.buildProviderRequestPlan("hotel", baytown2)[0].locality, "Baytown");
});
