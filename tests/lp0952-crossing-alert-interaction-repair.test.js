const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("js/app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const auditSource = fs.readFileSync("js/gridlyLp0952CrossingAlertInteractionAudit.js", "utf8");
const selector = "[data-gridly-alert-focus='true'][data-gridly-alert-row='true']";

assert.match(index, /gridlyLp0952CrossingAlertInteractionAudit\.js/);
assert.match(app, /function gridlyLp0952AlertCardInteractionAttributes[\s\S]*role="button" tabindex="0" data-gridly-alert-focus="true" data-gridly-alert-row="true" data-gridly-alert-crossing-id/);
assert.match(app, /gridlyLp0952AlertCardInteractionAttributes\(crossingId, esc\)/, "current renderer uses the shared contract");
assert.match(app, /gridlyLp0952AlertCardInteractionAttributes\(crossingTarget\.crossingId, sanitizeText\)/, "LP236 renderer uses the shared contract");
assert.match(app, /function gridlyLp0952ResolveCrossingAlertTarget[\s\S]*crossingMarkers\.get\(crossingId\)/);
assert.match(app, /const crossingAlertTarget = gridlyLp0952ResolveCrossingAlertTarget\(alert, null\);[\s\S]*crossingAlertTarget\.coords\?\.lat/);
assert.match(app, /panel\.addEventListener\("keydown"[\s\S]*event\.repeat[\s\S]*event\.preventDefault\(\)[\s\S]*row\.click\(\)/);
assert.match(app, /openCrossingPopupFromMarkerInteraction\(marker, crossingTarget\.crossing, "alert-card"\)/);
assert.match(app, /else marker\.openPopup\(\)/, "hazard and official popup path remains canonical");

function card(attributes = {}) {
  const values = {
    "data-gridly-alert-focus": "true", "data-gridly-alert-row": "true",
    "data-gridly-alert-crossing-id": "crossing-123", role: "button", tabindex: "0",
    ...attributes
  };
  return {
    getAttribute: (name) => values[name] ?? null,
    matches: (candidate) => candidate === selector
      ? values["data-gridly-alert-focus"] === "true" && values["data-gridly-alert-row"] === "true"
      : values["data-gridly-alert-row"] === "true" || Boolean(values["data-gridly-alert-id"])
  };
}
function auditWith(renderedCards) {
  const window = {
    gridlyLp019BindAlertFocusHandlers() {}, focusGridlyAlertIncident() {},
    openCrossingPopupFromMarkerInteraction() {}
  };
  const document = { querySelectorAll: (candidate) => candidate === selector ? renderedCards : [] };
  vm.runInNewContext(auditSource, { window, document });
  return window.gridlyLp0952CrossingAlertInteractionAudit();
}

const passing = auditWith([card()]);
assert.equal(Object.isFrozen(passing), true);
assert.equal(passing.crossingAlertInteractive, true);
assert.equal(passing.delegatedSelectorCompatible, true);
assert.equal(passing.safeToMerge, true);
for (const [failure, brokenCard] of [
  ["role", card({ role: null })],
  ["tabindex", card({ tabindex: null })],
  ["canonical crossing identity", card({ "data-gridly-alert-crossing-id": null })],
  ["authoritative selector", card({ "data-gridly-alert-focus": null })]
]) {
  const result = auditWith([brokenCard]);
  assert.equal(result.crossingAlertInteractive, false, `${failure} is required`);
  assert.equal(result.safeToMerge, false, `${failure} failure must fail safeToMerge`);
}
const absent = auditWith([]);
assert.equal(absent.crossingAlertRendered, false);
assert.equal(absent.crossingAlertInteractive, false);
assert.equal(absent.safeToMerge, false);
console.log("LP095.2A crossing alert interactive DOM contract checks passed.");
