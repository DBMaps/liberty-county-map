const assert = require("node:assert/strict");
const fs = require("node:fs");
const presentation = require("../js/historical-intelligence-presentation.js");
const attachment = require("../js/historical-intelligence-attachment-controller.js");

const html = fs.readFileSync("tests/lp075-browser-certification.html", "utf8");
const handoff = fs.readFileSync("docs/handoffs/LP075-HISTORICAL-INTELLIGENCE-PRODUCT-VALIDATION-HANDOFF.md", "utf8");
const areas = ["driver comprehension", "non-redundancy", "scanning efficiency", "cognitive load", "accessibility", "rollback readiness", "production isolation", "activation recommendation"];

for (const area of areas) assert.ok(html.includes(`check("${area}"`), `browser certifies ${area}`);
assert.match(html, /const passed=checks\.every\(\(item\)=>item\.passed === true\)/);
assert.match(html, /recommendation:"NOT READY"/);
assert.match(html, /current alerts remain authoritative/i);
assert.match(html, /not a prediction/i);
assert.doesNotMatch(html, /<script\s+src=|<link[^>]+stylesheet/i);
assert.doesNotMatch(html, /historical-pattern-intelligence\.js|historical-narrative-(?:generator|ranking)\.js|historical-intelligence-attachment-controller\.js/);

for (const heading of ["## 1. Executive Summary", "## 2. Product validation findings", "## 3. Driver-comprehension findings", "## 4. Cross-surface comparison", "## 5. Accessibility findings", "## 6. Rollback rehearsal", "## 7. Activation recommendation", "## 8. Risks", "## 9. Browser certification", "## 10. Merge recommendation", "## 11. Recommended LP076", "## Updated next-chat handoff"]) {
  assert.ok(handoff.includes(heading), `handoff includes ${heading}`);
}
for (const phrase of ["time to takeaway", "reading effort", "success criteria", "stop criteria", "screen reader", "200% zoom", "narrow portrait", "reduced motion", "Community Pulse", "Travel Brief", "Destination Intelligence", "Unified Evidence", "current alerts", "NOT READY"]) {
  assert.match(handoff, new RegExp(phrase, "i"), `handoff documents ${phrase}`);
}

const expected = { productionIntegration: false, consumerVisible: false, activationAuthorized: false, explicitOptInRequired: true };
for (const [key, value] of Object.entries(expected)) {
  assert.equal(presentation.ACTIVATION[key], value, `${key} presentation boundary`);
  if (Object.hasOwn(attachment.ACTIVATION_DECISION, key)) assert.equal(attachment.ACTIVATION_DECISION[key], value, `${key} attachment boundary`);
  assert.ok(html.includes(`${key}:${value}`), `browser preserves ${key}`);
  assert.ok(handoff.includes(`\`${key}: ${value}\``), `handoff preserves ${key}`);
}
assert.equal(attachment.ACTIVATION_DECISION.rollbackReady, true);
for (const file of ["index.html", "js/app.js", "service-worker.js"]) {
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /LP075|lp075|lp075-browser-certification/i, `${file} remains isolated`);
}

console.log("LP075 Historical Intelligence product validation passed (45 requirements covered; recommendation: NOT READY)");
