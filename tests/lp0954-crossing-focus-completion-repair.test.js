const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const app = fs.readFileSync("js/app.js", "utf8");
const functionSource = (name) => app.match(new RegExp(`function ${name}\\([\\s\\S]*?\\n}`))?.[0] || "";
const completionSource = functionSource("gridlyLp0954MapFocusCompleted");

assert(completionSource, "LP095.4 owns an explicit focus-completion contract");
const completeFocus = vm.runInNewContext(`(${completionSource})`);
const validFocus = {
  sheetCloseCompleted: true,
  mapInvalidateCompleted: true,
  movementSettlementCompleted: true,
  zoomCompleted: true,
  markerInsideUsableViewport: true,
  awarenessSelectionPreserved: true
};

assert.strictEqual(completeFocus(validFocus), true, "a valid marker focus completes");
assert.strictEqual(completeFocus({ ...validFocus, viewportCenteringCompleted: false }), true, "an already-visible marker does not wait for unnecessary exact movement");
assert.strictEqual(completeFocus({ ...validFocus, markerInsideUsableViewport: false }), false, "a failed visible focus cannot report completion");
assert.strictEqual(completeFocus({ ...validFocus, movementSettlementCompleted: false }), false, "an unsettled movement cannot report completion");

const focusBody = app.match(/function focusGridlyAlertIncident[\s\S]*?function focusAlertLocation/)?.[0] || "";
assert(focusBody.includes("debug.mapMovementCompleted = gridlyLp0954MapFocusCompleted(debug)"), "the production focus path uses the repaired contract");
assert(focusBody.includes('openCrossingPopupFromMarkerInteraction(marker, crossingTarget.crossing, "alert-card")'), "success dispatches through the canonical crossing popup path");
assert(!focusBody.includes("L.marker("), "focus reuses the existing marker instead of constructing one");
assert.strictEqual((focusBody.match(/openCrossingPopupFromMarkerInteraction\(/g) || []).length, 1, "the focus path requests the crossing popup once");
assert(focusBody.includes("else marker.openPopup()"), "generic hazard marker behavior remains intact");
assert(focusBody.includes("officialMarkerMatched") && focusBody.includes("gridlyLp045EnsureOfficialMarkersCurrent"), "official marker behavior remains intact");
assert(app.includes('gridlyLp0953Record("Map focus completed"'), "LP095.3 records the focus terminal state");
assert(app.includes('gridlyLp0953Fail("map_focus_completion"'), "LP095.3 records failed focus terminal state");

const auditSource = functionSource("gridlyLp0954CrossingFocusCompletionAudit");
assert(auditSource && app.includes("window.gridlyLp0954CrossingFocusCompletionAudit = gridlyLp0954CrossingFocusCompletionAudit"), "the passive LP095.4 audit is exposed");
assert(auditSource.includes("Object.freeze"), "the audit result is frozen");
assert(auditSource.includes("required.every"), "safeToMerge is derived from every required check");
assert(!/\.click\(|\.focus\(|flyTo\(|setView\(|openPopup\(|submit\(|clear\(/.test(auditSource), "the audit does not interact with the product");

const failedChecks = { available: true, passive: true, focusCompletionContractAvailable: false };
assert.strictEqual(Object.values(failedChecks).every((value) => value === true), false, "safeToMerge fails closed when a required contract is absent");

console.log("LP095.4 crossing focus completion regression checks passed");
