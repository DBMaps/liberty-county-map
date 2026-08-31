const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const authority = require("../js/gridlyConditionDisplayLabel.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const label = authority.gridlyConditionDisplayLabel;

test("A-H actual Community keys use the exact Report vocabulary", () => {
  assert.deepEqual(authority.COMMUNITY_LABELS, {
    blocked: "Blocked", flooding: "Flooding", crash: "Crash / Wreck", disabled_vehicle: "Disabled Vehicle",
    debris: "Debris In Road", road_closed: "Road Closed", construction: "Construction",
    traffic_backup: "Traffic Backup / Heavy Delay", other_hazard: "Other Hazard"
  });
  for (const [canonicalKey, expected] of Object.entries(authority.COMMUNITY_LABELS)) {
    assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey }), expected);
  }
});

test("I-M actual Other Hazard subtype keys retain approved wording", () => {
  assert.deepEqual(authority.OTHER_HAZARD_SUBTYPE_LABELS, {
    livestock_on_road: "Livestock on Road", traffic_signal_issue: "Traffic Signal Issue",
    downed_power_line: "Downed Power Line", emergency_response_activity: "Emergency Response Activity", other: "Other"
  });
  for (const [subtype, expected] of Object.entries(authority.OTHER_HAZARD_SUBTYPE_LABELS)) {
    assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey: "other_hazard", subtype }), expected);
  }
});

test("N-R precedence is source-aware, provider-first, and safely humanizes unknown keys", () => {
  assert.equal(label({ sourceFamily: "CROSSING_REPORTS", canonicalKey: "blocked" }), "Blocked Crossing");
  assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey: "blocked" }), "Blocked");
  assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: "lane_closure", trustedLabel: "Lane Closure" }), "Lane Closure");
  assert.equal(label({ sourceFamily: "WEATHER", canonicalKey: "other_hazard", providerEvent: "Heat Advisory" }), "Heat Advisory");
  assert.equal(label({ sourceFamily: "WEATHER", canonicalKey: "hazard", providerEvent: "Flood Warning" }), "Flood Warning");
  const canonicalKey = "unexpected_condition_key";
  assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey }), "Unexpected Condition Key");
  assert.equal(canonicalKey, "unexpected_condition_key");
});

test("LP243.A official roadway labels resolve by semantic identity without destructive fallback casing", () => {
  for (const raw of ["flooding", "Flooding", "FLOODING"]) {
    assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: raw, trustedLabel: raw }), "Flooding");
  }
  for (const raw of ["construction", "Construction", "CONSTRUCTION"]) {
    assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: raw, trustedLabel: raw }), "Construction");
  }
  assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: "bridge_restriction", trustedLabel: "Bridge Restriction" }), "Bridge Restriction");
  assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: "unmapped", trustedLabel: "US 59 NB incident near FM 1960" }), "US 59 NB incident near FM 1960");
  assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: "flooding_high_water", trustedLabel: "flooding", displayRole: "condition_group" }), "Flooding / High Water");
});

test("S-AG presentation wiring changes labels only after canonical identity construction", () => {
  assert.match(app, /const identity = gridlyResolveCanonicalLiveIncidentIdentity\(record\);[\s\S]{0,1800}gridlyConditionDisplayLabel/);
  assert.match(app, /hazardType: identity\.hazardType, conditionFamily: identity\.conditionFamily/);
  assert.match(app, /gridlyLP236ConciseCondition[\s\S]{0,1200}gridlyConditionDisplayLabel/);
  const authorityScript = index.indexOf('src="js/gridlyConditionDisplayLabel.js');
  const applicationScript = index.indexOf('src="js/app.js');
  assert.ok(authorityScript >= 0, "the current application loads the condition-label authority");
  assert.ok(applicationScript > authorityScript, "the authority loads before the current application consumer");
  assert.match(app, /const ROAD_HAZARD_TYPE_OPTIONS = \[[\s\S]*?\{ value: "debris", label: "Debris In Road" \}[\s\S]*?\{ value: "other_hazard", label: "Other Hazard" \}/);
  assert.match(app, /const OTHER_HAZARD_SUBTYPE_OPTIONS = Object\.freeze\(\[[\s\S]*?livestock_on_road[\s\S]*?traffic_signal_issue[\s\S]*?downed_power_line[\s\S]*?emergency_response_activity[\s\S]*?\{ value: "other"/);
});
