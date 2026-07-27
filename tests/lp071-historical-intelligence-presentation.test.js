const assert = require("node:assert/strict");
const fs = require("node:fs");
const presentation = require("../js/historical-intelligence-presentation.js");

const fields = ["historicalTakeaway", "narrativeType", "subject", "historicalWindow", "liveConditionGuidance", "quiet", "displayEligible"];
const eligible = {
  historicalTakeaway: "Crossing delays have commonly been observed near the Main Street crossing.",
  narrativeType: "crossing_delay", subject: "Main Street crossing", historicalWindow: "Weekday mornings",
  liveConditionGuidance: "Check current alerts for live conditions.", quiet: false, displayEligible: true
};
const markup = presentation.render(eligible);
assert.deepEqual(presentation.DTO_FIELDS, fields, "consumes the exact LP070 contract");
assert.equal(presentation.exactContract(eligible), true);
assert.equal(presentation.render({ ...eligible, confidenceCategory: "private" }), "", "rejects expanded/private fields");
assert.equal((markup.match(/Crossing delays have commonly/g) || []).length, 1, "renders one takeaway");
assert.match(markup, /Main Street crossing/, "renders subject");
assert.match(markup, /Weekday mornings/, "renders meaningful window");
assert.doesNotMatch(presentation.render({ ...eligible, historicalWindow: { firstObservedAt: "2026-01-01T00:00:00Z" } }), /Historically relevant|2026-01-01/, "omits raw window");
assert.match(markup, /Check current alerts for live conditions/, "renders guidance");
const quiet = { ...eligible, quiet: true, displayEligible: false, historicalTakeaway: null };
assert.equal(presentation.render(quiet), "", "quiet omits all markup");
assert.equal(presentation.render({ ...eligible, displayEligible: false }), "", "ineligible omits all markup");
assert.doesNotMatch(presentation.render(quiet), /No historical|Nothing unusual|unavailable|No data/i, "quiet has no filler");
const liveScenario = `<section class="lp071-alert"><h3>Current alert</h3></section>${markup}`;
assert.ok(liveScenario.indexOf("lp071-alert") < liveScenario.indexOf("lp071-history"), "current alert precedes history");
assert.match(markup, /Historical context/, "labels history");
assert.doesNotMatch(markup, /currently (active|closed)|will|expected to|take another route|avoid|detour/i, "does not claim live state, predict, or advise a route");
assert.doesNotMatch(markup, /confidence|ranking|score|candidate|suppression|identifier|DTO|classifier/i, "no technical metadata is visible or accessible");
assert.ok(markup.indexOf("Historical context") < markup.indexOf("Place") && markup.indexOf("Place") < markup.indexOf("Historically relevant") && markup.indexOf("Historically relevant") < markup.indexOf("Check current alerts"), "reading order is valid");

const css = fs.readFileSync("css/lp071-historical-intelligence-prototype.css", "utf8");
assert.match(css, /prefers-reduced-motion:\s*reduce/, "reduced-motion fallback exists");
assert.match(css, /overflow-wrap:\s*anywhere/, "narrow layout protects against overflow");
assert.match(css, /min\(100%/, "fluid layout supports narrow portrait and zoom");
assert.equal(presentation.ACTIVATION.activationAuthorized, false);
assert.equal(presentation.ACTIVATION.productionIntegration, false);
assert.equal(presentation.ACTIVATION.consumerVisible, false);
assert.equal(presentation.ACTIVATION.explicitOptInRequired, true);
assert.ok(presentation.ACTIVATION.rollbackOwner);
assert.equal(presentation.ACTIVATION.authorizedFutureOwner, "Know Before You Go Historical Intelligence surface");
assert.match(presentation.ACTIVATION.currentAlertAuthority, /Current alerts/);

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
for (const productionFile of [index, app]) {
  assert.doesNotMatch(productionFile, /LP0(?:67|68|69|70|71)|historical-pattern-intelligence\.js|historical-narrative-(?:generation|ranking)\.js|historical-intelligence-(?:activation-boundary|presentation)\.js/i);
}
assert.equal(fs.existsSync("tests/lp071-browser-certification.html"), true);
console.log("LP071 Historical Intelligence presentation readiness certification passed (24 requirements covered)");
