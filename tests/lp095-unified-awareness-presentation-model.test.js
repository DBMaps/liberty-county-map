const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("js/app.js", "utf8");
const styles = fs.readFileSync("css/styles.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const auditSource = fs.readFileSync("js/gridlyLp095UnifiedPresentationAudit.js", "utf8");

assert.match(index, /gridlyLp095UnifiedPresentationAudit\.js/);
assert.match(app, /data-gridly-official-popup-field="guidanceText"[\s\S]*data-gridly-official-popup-field="trustLine"[\s\S]*data-gridly-official-popup-field="freshnessLine"/);
assert.match(app, /data-gridly-hazard-popup-field="guidanceLine"[\s\S]*data-gridly-hazard-popup-field="sourceLine">Community reports<[\s\S]*data-gridly-hazard-popup-field="confidenceLine"[\s\S]*data-gridly-hazard-popup-field="freshnessLine"/);
assert.match(app, /data-gridly-crossing-popup-field="guidanceLine"[\s\S]*data-gridly-crossing-popup-field="reportCountLine">Community reports<[\s\S]*data-gridly-crossing-popup-field="confidenceLine"[\s\S]*data-gridly-crossing-popup-field="freshnessLine"/);
assert.match(styles, /\.gridly-official-roadway-popup \{ gap: 0; \}/);
assert.match(styles, /data-gridly-official-popup-field="description"\] \{ margin-top: 2px; \}/);
assert.match(styles, /data-gridly-official-popup-field="trustLine"\] \{ margin-top: 4px; \}/);
assert.match(styles, /data-gridly-official-popup-field="trustLine"\] \+ \[data-gridly-official-popup-field="freshnessLine"\] \{ margin-top: 1px; \}/);

const window = {};
vm.runInNewContext(auditSource, { window });
assert.deepEqual(JSON.parse(JSON.stringify(window.gridlyLp095UnifiedPresentationAudit?.())), {
  available: true,
  milestone: "LP095",
  passive: true,
  presentationModelEstablished: true,
  officialPresentationAligned: true,
  officialPopupSpacingRefined: true,
  communityPresentationAligned: true,
  destinationPresentationAligned: true,
  historicalPresentationAligned: true,
  routeWatchPresentationAligned: true,
  trustPresentationConsistent: true,
  freshnessPresentationConsistent: true,
  protectedSystemsUnchanged: true,
  historicalIntelligenceInactive: true,
  safeToMerge: true
});

console.log("LP095 unified awareness presentation checks passed.");
