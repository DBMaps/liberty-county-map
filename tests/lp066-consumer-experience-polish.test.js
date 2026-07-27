const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");

assert.match(html, /gridly-brief-foundation-handle-label">Know Before You Go</);
assert.match(css, /LP066 — Unified consumer experience polish/);
assert.match(css, /gridlyDestinationImpactPaneSummary[\s\S]*position:\s*absolute/);
assert.match(css, /gridly-destination-impact-actions[\s\S]*grid-template-columns:\s*repeat\(2/);
assert.match(css, /@media \(max-width: 420px\) and \(orientation: portrait\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /gridlyPolishSheetIn/);

const protectedRuntimeFiles = [
  "js/app.js",
  "js/gridlyUnifiedIntelligence.js",
  "js/gridlyAlertsPublishedAwareness.js",
  "js/gridlyRouteWatchGeometryShadowScoring.js"
];
for (const file of protectedRuntimeFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `${file} remains present`);
}

console.log("LP066 consumer experience polish audit passed.");
