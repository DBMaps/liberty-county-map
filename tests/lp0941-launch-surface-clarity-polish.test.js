const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const auditSource = fs.readFileSync("js/gridlyLp0941LaunchSurfaceAudit.js", "utf8");

assert.match(index, />San Jacinto County<\/option>/);
assert.doesNotMatch(index, /San Jacinto County \(validation only\)/i);
assert.deepEqual(
  Array.from(index.matchAll(/data-v2-sheet="(report|alerts|history|settings)"[^>]*>[\s\S]*?<em>([^<]+)<\/em>/g), (match) => match[2]),
  ["Report", "Alerts", "History", "Settings"]
);

const consumerPresentation = index;
for (const phrase of [
  "currently in development",
  "No cleanup or test tools are available",
  "Gridly is currently in beta",
  "Beta Notice",
  "Settings does not expose cleanup"
]) {
  assert.equal(consumerPresentation.includes(phrase), false, `consumer copy still includes: ${phrase}`);
}
assert.doesNotMatch(app, /<p[^>]*>[^<]*(?:cleanup|testing|development-only)[^<]*<\/p>/i);

const dockNodes = ["Report", "Alerts", "History", "Settings"].map((textContent) => ({ textContent }));
const setupNode = { textContent: "Choose Your County Liberty County Montgomery County San Jacinto County" };
const settingsNode = { textContent: "Settings Appearance Install Privacy Safety Feedback Version About Gridly" };
const document = {
  querySelectorAll(selector) {
    if (selector.includes("button em")) return dockNodes;
    return [setupNode, settingsNode];
  },
  querySelector(selector) {
    if (selector === "#settingsModal") return settingsNode;
    return null;
  }
};
const window = {};
vm.runInNewContext(auditSource, { document, window });
assert.deepEqual(JSON.parse(JSON.stringify(window.gridlyLp0941LaunchSurfaceAudit())), {
  available: true,
  milestone: "LP094.1",
  passive: true,
  validationLanguageRemoved: true,
  dockLabelsVerified: true,
  settingsDevelopmentLanguageRemoved: true,
  onboardingReadyForScreenshotRefresh: true,
  protectedSystemsUnchanged: true,
  historicalIntelligenceInactive: true,
  safeToMerge: true
});

console.log("LP094.1 launch-surface presentation checks passed.");
