const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("js/app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const auditSource = fs.readFileSync("js/gridlyLp0952CrossingAlertInteractionAudit.js", "utf8");

assert.match(index, /gridlyLp0952CrossingAlertInteractionAudit\.js/);
assert.match(app, /function gridlyLp0952ResolveCrossingAlertTarget[\s\S]*crossingMarkers\.get\(crossingId\)/);
assert.match(app, /const crossingAlertTarget = gridlyLp0952ResolveCrossingAlertTarget\(alert, null\);[\s\S]*crossingAlertTarget\.coords\?\.lat/);
assert.match(app, /role="button" tabindex="0" data-gridly-alert-focus="true"[\s\S]*data-gridly-alert-crossing-id/);
assert.match(app, /panel\.addEventListener\("keydown"[\s\S]*event\.key !== "Enter" && event\.key !== " "[\s\S]*row\.click\(\)/);
assert.match(app, /openCrossingPopupFromMarkerInteraction\(marker, crossingTarget\.crossing, "alert-card"\)/);
assert.match(app, /else marker\.openPopup\(\)/, "hazard and official popup path remains the canonical marker path");

const window = {
  gridlyLp019BindAlertFocusHandlers() {},
  focusGridlyAlertIncident() {},
  openCrossingPopupFromMarkerInteraction() {}
};
vm.runInNewContext(auditSource, { window });
const result = window.gridlyLp0952CrossingAlertInteractionAudit();
assert.equal(Object.isFrozen(result), true);
assert.deepEqual(JSON.parse(JSON.stringify(result)), {
  available: true, milestone: "LP095.2", passive: true, crossingAlertRendered: true,
  canonicalCrossingIdentityAvailable: true, crossingAlertInteractive: true,
  crossingFocusPathAvailable: true, crossingPopupPathAvailable: true,
  duplicateInteractionPathAbsent: true, hazardAlertInteractionPreserved: true,
  officialAlertInteractionPreserved: true, lp095PresentationPreserved: true,
  lp0951SpacingPreserved: true, protectedSystemsUnchanged: true,
  historicalIntelligenceInactive: true, safeToMerge: true
});
console.log("LP095.2 crossing alert interaction repair checks passed.");
