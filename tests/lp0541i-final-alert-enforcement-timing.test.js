const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function blockBetween(start, end, label) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${label}: missing start marker`);
  const endIndex = source.indexOf(end, startIndex);
  assert(endIndex > startIndex, `${label}: missing end marker`);
  return source.slice(startIndex, endIndex);
}
function includes(haystack, needle, message) { assert(haystack.includes(needle), message); }
function notIncludes(haystack, needle, message) { assert(!haystack.includes(needle), message); }
function indexOf(haystack, needle, message) {
  const index = haystack.indexOf(needle);
  assert(index >= 0, message);
  return index;
}

const portraitOpen = blockBetween(
  'function openGridlyPortraitV2Sheet(sheetName, templateOverride = null) {',
  'function openPortraitV2Sheet(type, titleOverride = "", htmlOverride = "") {',
  'Portrait V2 sheet writer'
);
const enforcement = blockBetween(
  'function gridlyEnforceCanonicalPresentationOnVisibleAlertCards(reason = "visible-alert-dom-write") {',
  'if (typeof window !== "undefined") { window.gridlyEnforceCanonicalPresentationOnVisibleAlertCards',
  'last-mile enforcement function'
);
const audit = blockBetween(
  'function gridlyLp0541bHazardIdentityIntegrityAudit() {',
  'if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp0541bHazardIdentityIntegrityAudit", gridlyLp0541bHazardIdentityIntegrityAudit);',
  'LP054.1B audit'
);
const authoritativeApply = blockBetween(
  'async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync',
  'if (typeof isGridlyExplicitDebugModeEnabled === "function"',
  'authoritative alerts apply path'
);

const assignmentIndex = indexOf(portraitOpen, 'body.innerHTML = templateHtml || "";', 'alerts branch performs the final visible card innerHTML assignment');
const bodyVisibleIndex = indexOf(portraitOpen, 'body.hidden = false; body.style.display = "";', 'sheet body is made visible before final enforcement');
const shellVisibleIndex = indexOf(portraitOpen, 'sheet.classList.add("is-open", "active", "open");', 'sheet visible classes are applied before final enforcement');
const finalEnforcementIndex = indexOf(portraitOpen, 'gridlyEnforceCanonicalPresentationOnVisibleAlertCards("final-visible-alert-card-dom-write")', 'final visible DOM write invokes canonical enforcement');
const bindIndex = indexOf(portraitOpen, 'bindV2SheetActions()', 'close/click binding remains after final enforcement');

assert(assignmentIndex < bodyVisibleIndex, 'body visibility is applied after the alert-card HTML assignment');
assert(bodyVisibleIndex < shellVisibleIndex, 'sheet visibility classes are applied after body visibility');
assert(shellVisibleIndex < finalEnforcementIndex, 'final enforcement runs after visible sheet classes/styles are applied');
assert(finalEnforcementIndex < bindIndex, 'binding occurs after final enforcement and does not own card replacement');

const afterFinalEnforcement = portraitOpen.slice(finalEnforcementIndex);
notIncludes(afterFinalEnforcement, 'body.innerHTML =', 'no later body.innerHTML replacement occurs after final enforcement in Portrait V2 writer');
notIncludes(afterFinalEnforcement, 'replaceChildren(', 'no later replaceChildren replacement occurs after final enforcement in Portrait V2 writer');
notIncludes(afterFinalEnforcement, 'insertAdjacentHTML(', 'no later insertAdjacentHTML replacement occurs after final enforcement in Portrait V2 writer');

includes(authoritativeApply, 'window.openGridlyPortraitV2Sheet("alerts", {', 'authoritative alert application routes final markup through the Portrait V2 writer');
assert(
  authoritativeApply.indexOf('window.openGridlyPortraitV2Sheet("alerts", {') < authoritativeApply.indexOf('gridlyEnforceCanonicalPresentationOnVisibleAlertCards("gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync")'),
  'authoritative fallback enforcement remains after the open/write call, not before it'
);

for (const metric of [
  'enforcementFinalDomWriteRunCount',
  'enforcementFinalDomWriteCardCount',
  'enforcementFinalDomWriteUpdatedCount',
  'enforcementFinalDomWriteReason'
]) {
  includes(source, metric, `final DOM write diagnostic exists: ${metric}`);
  includes(audit, metric, `LP054.1B audit exposes final DOM write diagnostic: ${metric}`);
}
includes(enforcement, 'const isFinalVisibleAlertCardDomWrite = diagnostics.enforcementReason === "final-visible-alert-card-dom-write";', 'final DOM write reason is detected inside enforcement');
includes(enforcement, 'diagnostics.enforcementFinalDomWriteCardCount = cards.length;', 'final DOM write card count records the visible card count');
includes(enforcement, 'diagnostics.enforcementFinalDomWriteUpdatedCount = diagnostics.enforcementUpdatedCount;', 'final DOM write updated count records automatic repair count');

includes(enforcement, 'titleNode.textContent = expectedTitle;', 'legacy Flooding title is corrected automatically by open-time enforcement');
includes(enforcement, 'conditionNode.textContent = expectedCondition;', 'legacy Flooding condition is corrected automatically by open-time enforcement');
includes(portraitOpen, '"final-visible-alert-card-dom-write"', 'manual console enforcement is not required for the final visible write path');

for (const forbidden of ['MutationObserver', 'setInterval(', 'requestAnimationFrame(() => gridlyEnforceCanonicalPresentationOnVisibleAlertCards', 'setTimeout(() => gridlyEnforceCanonicalPresentationOnVisibleAlertCards']) {
  notIncludes(portraitOpen, forbidden, `Portrait V2 timing repair uses no timer/polling/observer: ${forbidden}`);
  notIncludes(enforcement, forbidden, `last-mile enforcement uses no timer/polling/observer: ${forbidden}`);
}

for (const protectedToken of [
  'gridlyBuildCanonicalLiveIncidentPresentation',
  'gridlyGetCanonicalActiveCommunityState',
  'gridlyLp0541bHazardIdentityIntegrityAudit',
  'renderAlerts()',
  'updateMobileAlertsMirror',
  'gridlyRenderTravelBrief',
  'communityPulseUsesCanonicalState'
]) {
  includes(source, protectedToken, `protected system remains present: ${protectedToken}`);
}

console.log('LP054.1I final alert enforcement timing tests passed');
