const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const authority = require("../js/gridlyConditionDisplayLabel.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
const label = authority.gridlyConditionDisplayLabel;

test("LP243.B governs known Community Report casing without rewriting unknown prose", () => {
  for (const variant of ["blocked", "Blocked", "BLOCKED"]) {
    assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey: variant, trustedLabel: variant }), "Blocked");
  }
  assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey: "flooding", trustedLabel: "flooding" }), "Flooding");
  assert.equal(label({ sourceFamily: "COMMUNITY_REPORTS", canonicalKey: "unmapped", trustedLabel: "US 59 NB delay near FM 1960" }), "US 59 NB delay near FM 1960");
});

test("LP243.B places the existing Show me owner in a bounded upper-right grid column", () => {
  assert.match(css, /grid-template-areas:"condition-copy condition-actions"/);
  assert.match(css, /\.gridly-lp236-condition-body \{ grid-area:condition-copy;/);
  assert.match(css, /\.gridly-lp236-condition-actions \{ grid-area:condition-actions;/);
  assert.match(css, /\.gridly-lp236-show-me \{[^}]*min-width:74px; min-height:44px/);
  assert.doesNotMatch(css.slice(css.indexOf("/* LP236.11 condition isolation"), css.indexOf(".gridly-lp236-critical")), /position:absolute/);
});

test("LP243.B preserves Show me eligibility, data, delegated action ownership, and governed target calls", () => {
  const renderer = app.slice(app.indexOf("const renderRow"), app.indexOf("const renderGroup"));
  assert.match(renderer, /Number\.isFinite\(lat\) && Number\.isFinite\(lng\) \? `<div class="gridly-lp236-condition-actions">/);
  assert.match(renderer, /class="gridly-alert-show-on-map gridly-lp236-show-me" data-gridly-show-on-map="true"/);
  assert.match(renderer, /data-gridly-alert-lat="\$\{sanitizeText\(lat\)\}" data-gridly-alert-lng="\$\{sanitizeText\(lng\)\}"/);
  assert.match(app, /gridlyLP236MapTarget\(alert, crossingTarget, row\.canonicalId\)/);
  assert.match(app, /showMeListenerOwner: "gridlyLp019BindAlertFocusHandlers"/);
});

test("LP243.B retains LP243.A official roadway labels and semantic hierarchy authorities", () => {
  assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: "FLOODING", trustedLabel: "FLOODING" }), "Flooding");
  assert.equal(label({ sourceFamily: "OFFICIAL_ROADWAYS", canonicalKey: "road_closed", trustedLabel: "road closed" }), "Road Closed");
  assert.match(app, /activeConditionCount: group\.rows\.length, rowCount: group\.rows\.length/);
  assert.match(app, /sourceOrder: sources\.map\(\(source\) => source\.sourceClass\)/);
  assert.match(app, /conditionIds: conditions\.map\(\(row\) => row\.conditionId\)/);
});
