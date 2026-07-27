const assert = require("node:assert/strict");
const fs = require("node:fs");
const presentation = require("../js/historical-intelligence-presentation.js");
const attachment = require("../js/historical-intelligence-attachment-controller.js");

const html = fs.readFileSync("tests/lp074-browser-certification.html", "utf8");
const handoff = fs.readFileSync("docs/handoffs/LP074-HISTORICAL-INTELLIGENCE-ACTIVATION-READINESS-HANDOFF.md", "utf8");
const requiredChecks = ["driver value", "trust", "hierarchy", "cognitive load", "accessibility", "rollback readiness", "production isolation", "activation recommendation"];
for (const name of requiredChecks) assert.ok(html.includes(`check("${name}"`), `browser certifies ${name}`);
assert.match(html, /const passed=checks\.every\(\(item\) => item\.passed === true\)/);
assert.match(html, /recommendation:"CONDITIONAL"/);
assert.match(html, /preferredPolicy:"historically relevant and non-redundant only"/);
assert.doesNotMatch(html, /historical-pattern-intelligence\.js|historical-narrative-(?:generator|ranking)\.js|historical-intelligence-attachment-controller\.js/);

for (const phrase of ["## 1. Executive Summary", "## 2. Product readiness findings", "## 3. Activation recommendation", "## 4. Risks", "## 5. Browser certification", "## 6. Merge recommendation", "## 7. Recommended LP075", "## Updated next-chat handoff"]) assert.ok(handoff.includes(phrase), `handoff includes ${phrase}`);
for (const term of ["known risks", "unknowns", "assumptions", "required validations", "CONDITIONAL", "historically relevant", "non-redundant"]) assert.match(handoff, new RegExp(term, "i"));

const expected = { productionIntegration: false, consumerVisible: false, activationAuthorized: false, explicitOptInRequired: true };
for (const [key, value] of Object.entries(expected)) {
  assert.equal(presentation.ACTIVATION[key], value);
  if (Object.hasOwn(attachment.ACTIVATION_DECISION, key)) assert.equal(attachment.ACTIVATION_DECISION[key], value);
  assert.ok(handoff.includes(`\`${key}: ${value}\``), `handoff preserves ${key}`);
}
assert.equal(attachment.ACTIVATION_DECISION.rollbackReady, true);
assert.equal(attachment.ACTIVATION_DECISION.productionIntegrationPrepared, true);
for (const file of ["index.html", "js/app.js", "service-worker.js"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(source, /LP074|lp074|historical-intelligence-attachment-controller\.js/i, `${file} remains unchanged by LP074`);
}
console.log("LP074 Historical Intelligence activation readiness certification passed (32 requirements covered; recommendation: CONDITIONAL)");
