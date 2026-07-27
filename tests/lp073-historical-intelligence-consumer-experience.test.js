const assert = require("node:assert/strict");
const fs = require("node:fs");
const presentation = require("../js/historical-intelligence-presentation.js");

const fields = ["historicalTakeaway", "narrativeType", "subject", "historicalWindow", "liveConditionGuidance", "quiet", "displayEligible"];
const selected = { historicalTakeaway: "Drivers have frequently reported crossing delays near Main Street.", narrativeType: "crossing_delay", subject: "Main Street crossing", historicalWindow: "Weekday mornings", liveConditionGuidance: "Check current alerts for live conditions.", quiet: false, displayEligible: true };
const quiet = { historicalTakeaway: null, narrativeType: null, subject: null, historicalWindow: null, liveConditionGuidance: null, quiet: true, displayEligible: false };
const card = presentation.render(selected);

assert.deepEqual(presentation.DTO_FIELDS, fields, "prototype consumes only the LP070 DTO");
assert.equal(presentation.exactContract(selected), true);
assert.equal(presentation.render({ ...selected, rankingScore: 99 }), "", "private candidate data is rejected");
assert.equal(presentation.render(quiet), "", "quiet means complete omission");
assert.match(card, /Drivers have frequently reported/);
assert.equal((card.match(/<section/g) || []).length, 1, "one selected DTO produces one card");
assert.ok(card.indexOf("Historical context") < card.indexOf("Drivers have") && card.indexOf("Drivers have") < card.indexOf("Place") && card.indexOf("Place") < card.indexOf("Historically relevant") && card.indexOf("Historically relevant") < card.indexOf("Check current alerts"), "consumer reading hierarchy is exact");
assert.doesNotMatch(card, /will|expected to|avoid|detour|current condition is/i, "copy is non-predictive and non-routing");

const browser = fs.readFileSync("tests/lp073-browser-certification.html", "utf8");
for (const check of ["quiet omission", "historical-only presentation", "historical + current alert presentation", "hierarchy", "readability", "scanning efficiency", "accessibility", "reduced-motion support", "production isolation", "activation disabled"]) assert.ok(browser.includes(`check(\"${check}\"`), `browser certifies ${check}`);
assert.match(browser, /const passed=checks\.every\(\(check\) => check\.passed === true\)/);
assert.match(browser, /preferred:\"compact\"/);
assert.match(browser, /multipleCandidateInput:\[selected,second\],renderedHistoricalCountPerScenario:1/);
assert.doesNotMatch(browser, /historical-pattern-intelligence\.js|historical-narrative-(?:generator|ranking)\.js|historical-intelligence-attachment-controller\.js/);

const css = fs.readFileSync("css/lp073-historical-intelligence-consumer-experience.css", "utf8");
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /max-width:\s*46rem/);
assert.match(css, /max-width:\s*23rem/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.match(css, /grid-template-columns:\s*1fr/);

assert.deepEqual(presentation.ACTIVATION, {
  productionIntegration: false, consumerVisible: false, activationAuthorized: false, explicitOptInRequired: true,
  rollbackOwner: "Know Before You Go release owner", authorizedFutureOwner: "Know Before You Go Historical Intelligence surface",
  currentAlertAuthority: "Current alerts determine live conditions", approvedDtoVersion: "LP070.historical-intelligence-activation-boundary.v1"
});
for (const file of ["index.html", "js/app.js"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(source, /LP0(?:67|68|69|70|71|72|73)|historical-intelligence-(?:activation-boundary|presentation|attachment-controller)\.js/i, `${file} remains isolated`);
}
assert.equal(fs.existsSync("docs/handoffs/LP073-HISTORICAL-INTELLIGENCE-CONSUMER-EXPERIENCE-HANDOFF.md"), true);
console.log("LP073 Historical Intelligence consumer experience certification passed (31 requirements covered)");
