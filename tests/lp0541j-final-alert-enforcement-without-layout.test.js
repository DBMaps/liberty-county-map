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

const enforcement = blockBetween(
  'function gridlyEnforceCanonicalPresentationOnVisibleAlertCards(reason = "visible-alert-dom-write", options = {}) {',
  'if (typeof window !== "undefined") { window.gridlyEnforceCanonicalPresentationOnVisibleAlertCards',
  'last-mile enforcement function'
);
const portraitOpen = blockBetween(
  'function openGridlyPortraitV2Sheet(sheetName, templateOverride = null) {',
  'function openPortraitV2Sheet(type, titleOverride = "", htmlOverride = "") {',
  'Portrait V2 sheet writer'
);
includes(enforcement, 'options = {}', 'enforcement accepts an options object');
includes(enforcement, 'const explicitContainer =\n    options?.container instanceof Element\n      ? options.container\n      : null;', 'explicit container is resolved from options');
includes(enforcement, 'const requireRenderedVisibility =\n    options?.requireRenderedVisibility !== false;', 'rendered visibility defaults to required unless explicitly disabled');
includes(enforcement, 'explicitContainer ||\n    gridlyFindVisibleAlertsContainerForLastMileEnforcement();', 'general path still discovers the visible alerts container');
includes(enforcement, 'if (!container || (explicitContainer && container.isConnected === false))', 'explicit containers must be connected');
includes(enforcement, 'const rawCards = Array.from(', 'raw candidate cards are counted before visibility filtering');
includes(enforcement, 'diagnostics.enforcementRawCardCandidateCount = rawCards.length;', 'raw card candidate diagnostic is recorded');
includes(enforcement, 'if (requireRenderedVisibility === false) {\n      return card.isConnected !== false;\n    }', 'explicit final path enforces connected zero-layout cards');
includes(enforcement, 'const actuallyVisible = gridlyIsElementActuallyVisible(card);', 'normal path still requires actual rendered visibility');
includes(enforcement, 'if (!actuallyVisible) visibilityRejectedCardCount += 1;', 'visibility rejections are diagnosed');
includes(enforcement, 'card.getAttribute("data-gridly-alert-hidden") === "true"', 'hidden alert rows remain excluded');
includes(enforcement, 'card.classList?.contains("gridly-alert-empty-state")', 'empty-state rows remain excluded');

for (const metric of [
  'enforcementExplicitContainerUsed',
  'enforcementRenderedVisibilityRequired',
  'enforcementConnectedContainer',
  'enforcementRawCardCandidateCount',
  'enforcementVisibilityRejectedCardCount'
]) {
  includes(source, metric, `diagnostic exists and is exposed: ${metric}`);
}

const assignmentIndex = indexOf(portraitOpen, 'body.innerHTML = templateHtml || "";', 'alerts markup is inserted into the sheet body');
const styleIndex = indexOf(portraitOpen, 'sheet.classList.add("is-open", "active", "open");', 'sheet visibility styles/classes are applied');
const insertedContainerIndex = indexOf(portraitOpen, 'const insertedAlertsContainer =\n          body.querySelector(".gridly-alerts-active") ||\n          body;', 'final invocation uses the exact inserted alerts container');
const finalCallIndex = indexOf(portraitOpen, 'gridlyEnforceCanonicalPresentationOnVisibleAlertCards(\n          "final-visible-alert-card-dom-write",\n          {\n            container: insertedAlertsContainer,\n            requireRenderedVisibility: false\n          }\n        );', 'final invocation disables rendered visibility for the known inserted DOM');
const bindIndex = indexOf(portraitOpen, 'bindV2SheetActions()', 'binding remains after final enforcement');
assert(assignmentIndex < styleIndex, 'final DOM write happens before sheet styles are applied');
assert(styleIndex < insertedContainerIndex, 'inserted container is captured after sheet styles are applied');
assert(insertedContainerIndex < finalCallIndex, 'the captured inserted container is passed to final enforcement');
assert(finalCallIndex < bindIndex, 'final enforcement remains before bindV2SheetActions');

includes(source, 'hazardType: identity.hazardType', 'canonical presentation continues to write canonical hazard type without classification changes');
includes(source, 'Flooding', 'Flooding canonical presentation remains available for automatic rendering');
includes(source, 'return "Flooding"', 'Flooding title/condition canonical label remains available');
includes(source, 'flooding', 'Flooding hazard type remains available');
includes(portraitOpen, 'requireRenderedVisibility: false', 'manual console enforcement is no longer required for the final Portrait Alerts path');

for (const forbidden of ['setTimeout', 'requestAnimationFrame', 'MutationObserver', 'setInterval']) {
  notIncludes(enforcement, forbidden, `enforcement repair adds no ${forbidden}`);
  notIncludes(portraitOpen, forbidden, `Portrait Alerts final invocation adds no ${forbidden}`);
}

for (const protectedToken of [
  'gridlyBuildCanonicalLiveIncidentPresentation',
  'gridlyGetCanonicalActiveCommunityState',
  'renderAlerts()',
  'updateMobileAlertsMirror',
  'gridlyRenderTravelBrief',
  'communityPulseUsesCanonicalState',
  'Supabase',
  'route'
]) {
  includes(source, protectedToken, `protected system token remains present: ${protectedToken}`);
}

console.log('LP054.1J final alert enforcement without layout tests passed');
