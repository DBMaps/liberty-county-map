const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const contract = require("../js/gridlyAlertSemanticContract.js");

const official = (category, extra = {}) => ({ providerId: "drivetexas", reportKind: "official-situation", category, status: "Active", ...extra });

test("DriveTexas roadway taxonomy cannot manufacture crossing evidence", () => {
  const matrix = [
    ["Road Closure", "road_closure", "Road Closed"],
    ["Lane Closure", "lane_closure", "Lane Closure"],
    ["Bridge Restriction", "bridge_restriction", "Bridge Restriction"],
    ["Construction", "construction", "Construction"],
    ["Crash", "crash", "Crash"]
  ];
  for (const [category, classification, title] of matrix) {
    const result = contract.classify(official(category, { description: "Use another crossing; bridge closed and detour posted." }));
    assert.equal(result.classification, classification);
    assert.equal(result.title, title);
    assert.equal(result.ownership, "OFFICIAL_ROADWAY");
    assert.equal(contract.crossingBlockedEvidence(official(category, { title: "Crossing Blocked" })), false);
  }
});

test("crossing blockage is fail-closed and lifecycle governed", () => {
  const active = { reportKind: "crossing", submittedReportType: "crossing_blocked", status: "active", crossingId: "123" };
  assert.equal(contract.classify(active).classification, "crossing_blocked");
  assert.equal(contract.classify(active).title, "Crossing Blocked");
  assert.equal(contract.classify({ ...active, submittedReportType: "train_blocking_crossing" }).title, "Train Blocking Crossing");
  assert.equal(contract.classify({ ...active, status: "cleared" }).active, false);
  assert.equal(contract.consistency({ ...active, status: "cleared" }, { title: "Crossing Blocked" }).pass, false);
});

test("community crossing semantics require crossing ownership and explicit category", () => {
  assert.equal(contract.classify({ reportKind: "crossing", report_type: "crossing_blocked" }).classification, "crossing_blocked");
  assert.equal(contract.classify({ reportKind: "hazard", report_type: "road_closed", crossingId: "nearby-rail", description: "Road closure near a railroad crossing" }).classification, "road_closure");
  assert.equal(contract.classify({ reportKind: "hazard", report_type: "other_hazard", description: "Use the next crossing" }).classification, "community_report");
});

test("Dallas construction and bridge text remains stable across refresh and retention metadata", () => {
  const dallas = official("Bridge Restriction", {
    id: "dallas-i30-bridge",
    routeName: "IH 30",
    description: "Construction underway; roadway and bridge closed. Use another crossing and expect extra travel time.",
    retained: true,
    retainedReason: "last-known official observation"
  });
  const first = contract.classify(dallas);
  const refreshed = contract.classify({ ...dallas, updatedAt: "2026-08-18T12:00:00Z" });
  assert.deepEqual(refreshed, first);
  assert.equal(contract.consistency(dallas, { title: "Bridge Restriction" }).pass, true);
  assert.equal(contract.consistency(dallas, { title: "Crossing Blocked" }).pass, false);
  assert.equal(dallas.retained, true);
});

test("source ownership prevents correlated roadway and crossing incidents from collapsing semantically", () => {
  const roadway = contract.classify(official("Road Closure", { id: "same-scene" }));
  const crossing = contract.classify({ id: "same-scene", reportKind: "crossing", report_type: "crossing_blocked" });
  assert.notEqual(roadway.ownership, crossing.ownership);
  assert.notEqual(roadway.classification, crossing.classification);
});

test("weather remains audited but separately owned", () => {
  const result = contract.classify({ providerId: "nws", reportKind: "official-situation", category: "Flash Flood Warning" });
  assert.equal(result.ownership, "WEATHER");
  assert.equal(result.classification, "weather_alert");
});

test("governed DriveTexas projection retains official ownership through its consumer identity", () => {
  const governed = (category, extra = {}) => ({
    consumerSituationId: "drivetexas:provider:live-record",
    providerId: "provider:live-record",
    category,
    headline: `${category} on IH0030`,
    ...extra
  });
  const matrix = [
    ["Bridge Restriction", "bridge_restriction", "Bridge Restriction"],
    ["Lane Closure", "lane_closure", "Lane Closure"],
    ["Closure", "road_closure", "Road Closed"],
    ["Unmapped official condition", "travel_advisory", "Travel Advisory"]
  ];
  for (const [category, classification, title] of matrix) {
    const result = contract.classify(governed(category));
    assert.equal(result.ownership, "OFFICIAL_ROADWAY");
    assert.equal(result.classification, classification);
    assert.equal(result.title, title);
    assert.notEqual(result.classification, "community_report");
  }
  const prose = contract.classify(governed("Construction", { description: "Use the next crossing during work." }));
  assert.equal(prose.ownership, "OFFICIAL_ROADWAY");
  assert.notEqual(prose.ownership, "CROSSING");
  assert.notEqual(prose.classification, "crossing_blocked");
});

test("ownership remains governed for community, crossing, and weather records", () => {
  assert.equal(contract.classify({ reportKind: "hazard", report_type: "other_hazard" }).ownership, "COMMUNITY");
  assert.equal(contract.classify({ reportKind: "crossing", report_type: "crossing_blocked" }).ownership, "CROSSING");
  assert.equal(contract.classify({ providerId: "nws", category: "Warning" }).ownership, "WEATHER");
});

test("LP214 statewide community denominator is unchanged", () => {
  const inventory = JSON.parse(fs.readFileSync("data/generated/lp214-county-community-inventory.json", "utf8"));
  assert.equal(inventory.summary.countyCount, 254);
  assert.equal(inventory.summary.uniqueCanonicalCommunityCount, 1859);
  assert.equal(inventory.summary.countyCommunityMembershipCount, 2058);
  assert.equal(inventory.summary.multiCountyCommunityCount, 163);
});
