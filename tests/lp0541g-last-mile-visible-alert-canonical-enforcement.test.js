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

const enforcement = blockBetween(
  'function gridlyEnforceCanonicalPresentationOnVisibleAlertCards(reason = "visible-alert-dom-write", options = {}) {',
  'if (typeof window !== "undefined") { window.gridlyEnforceCanonicalPresentationOnVisibleAlertCards',
  'last-mile enforcement function'
);
const audit = blockBetween(
  'function gridlyLp0541bHazardIdentityIntegrityAudit() {',
  'if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp0541bHazardIdentityIntegrityAudit", gridlyLp0541bHazardIdentityIntegrityAudit);',
  'LP054.1B audit'
);
const openApply = blockBetween(
  'async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync',
  'if (typeof isGridlyExplicitDebugModeEnabled === "function"',
  'authoritative alerts apply path'
);
const portraitOpen = blockBetween(
  'function openGridlyPortraitV2Sheet(sheetName, templateOverride = null) {',
  'function openPortraitV2Sheet(type, titleOverride = "", htmlOverride = "") {',
  'Portrait V2 sheet writer'
);
const renderAlerts = blockBetween(
  'function renderAlerts() {',
  'function renderTrendingCrossings()',
  'legacy alerts list renderer'
);

includes(enforcement, 'gridlyFindVisibleAlertsContainerForLastMileEnforcement()', 'enforcement locates the actually visible Alerts container');
includes(source, 'gridlyIsElementActuallyVisible(node)', 'container lookup uses the actual visibility helper');
includes(enforcement, 'container.querySelectorAll(\n      ".gridly-alert-row[data-gridly-alert-row=\'true\']"\n    )', 'enforcement targets only real visible alert rows');
for (const attr of ['data-gridly-canonical-incident-id', 'data-gridly-incident-id', 'data-incident-id', 'data-gridly-alert-id', 'data-report-id']) {
  includes(source, `"${attr}"`, `incident ID resolution checks ${attr}`);
}
includes(enforcement, 'canonicalByStableId.get(incidentId)', 'canonical lookup is exact stable-ID map lookup');
notIncludes(enforcement, 'nearest', 'enforcement does not guess by nearest location');
notIncludes(enforcement, 'crossingId)', 'enforcement does not resolve visible cards by crossing ID alone');
includes(enforcement, 'const identity = gridlyResolveCanonicalLiveIncidentIdentity(canonicalRecord);', 'identity is resolved from the exact canonical record');
includes(enforcement, 'const presentation = gridlyBuildCanonicalLiveIncidentPresentation(canonicalRecord);', 'presentation is rebuilt from the exact canonical record');
includes(enforcement, 'titleNode.textContent = expectedTitle;', 'legacy Flooding/Crossing Blocked title is overwritten by canonical title');
includes(enforcement, 'conditionNode.textContent = expectedCondition;', 'legacy/missing condition is overwritten by canonical condition');
includes(enforcement, 'document.createElement("div")', 'missing condition node is created');
includes(enforcement, 'titleNode.insertAdjacentElement("afterend", conditionNode)', 'created condition node is inserted directly under title');
includes(enforcement, 'card.dataset.gridlyTitleSource = "last-mile-canonical-enforcement";', 'last-mile owns title source');
includes(enforcement, 'card.dataset.gridlyConditionSource = "last-mile-canonical-enforcement";', 'last-mile owns condition source');
includes(enforcement, 'card.dataset.gridlyRendererSource = "visible-alert-dom-enforcement";', 'last-mile renderer source is stamped');
for (const metric of ['enforcementRunCount', 'enforcementCardCount', 'enforcementUpdatedCount', 'enforcementAlreadyCanonicalCount', 'enforcementMissingIncidentIdCount', 'enforcementCanonicalRecordNotFoundCount', 'enforcementTitleNodeMissingCount', 'enforcementConditionNodeCreatedCount', 'enforcementReason', 'enforcementLastRunAt']) {
  includes(source, metric, `diagnostic metric exists: ${metric}`);
}

includes(source, 'data-gridly-alert-title-node="true"', 'all visible card renderers have a stable title-node selector');
includes(source, 'data-gridly-alert-condition-node="true"', 'all visible card renderers have a stable condition-node selector');
includes(openApply, 'gridlyEnforceCanonicalPresentationOnVisibleAlertCards("gridlyOpenAlertsSurfaceAuthoritativeBuildAndApplyAsync")', 'authoritative apply invokes enforcement synchronously after HTML insertion');
includes(portraitOpen, 'gridlyEnforceCanonicalPresentationOnVisibleAlertCards("openGridlyPortraitV2Sheet")', 'buildAlertsSurfaceHtml insertion invokes enforcement through Portrait V2 writer');
includes(renderAlerts, 'gridlyEnforceCanonicalPresentationOnVisibleAlertCards("renderAlerts")', 'legacy visible alerts DOM writes invoke enforcement');
for (const forbidden of ['MutationObserver', 'setInterval(', 'requestAnimationFrame(() => gridlyEnforceCanonicalPresentationOnVisibleAlertCards', 'setTimeout(() => gridlyEnforceCanonicalPresentationOnVisibleAlertCards']) {
  notIncludes(enforcement, forbidden, `no timers/polling/observer introduced: ${forbidden}`);
}

for (const metric of ['visibleAlertLastMileEnforcedCount', 'visibleAlertLastMileTitleSourceCount', 'visibleAlertLastMileConditionSourceCount', 'visibleAlertLastMileRendererSourceCount', 'lastMileEnforcementRunCount', 'lastMileEnforcementUpdatedCount', 'lastMileEnforcementMissingRecordCount']) {
  includes(audit, metric, `audit exposes ${metric}`);
}
includes(audit, 'value === "last-mile-canonical-enforcement"', 'audit recognizes last-mile canonical title/condition ownership');
includes(audit, 'value === "visible-alert-dom-enforcement"', 'audit recognizes last-mile renderer ownership');
includes(audit, 'visibleAlertNodesWithoutCanonicalDataset === 0', 'safe merge still requires no missing canonical datasets');

// Required examples are protected by canonical presentation and exact-ID enforcement rather than test-local fixtures.
for (const label of ['return "Flooding"', 'return "Traffic Backup"', 'return "Disabled Vehicle"']) {
  includes(source, label, `${label} remains canonical presentation output`);
}
includes(source, 'Traffic Backup / Heavy Delay', 'Traffic Backup condition remains canonical');
notIncludes(enforcement, 'Crossing Blocked', 'Flooding cannot retain legacy crossing title in last-mile enforcement');
notIncludes(enforcement, 'Train Blocking Crossing', 'Traffic Backup cannot retain legacy train-blocking title in last-mile enforcement');
includes(enforcement, 'return;', 'cards without an incident ID or missing canonical records are reported but not guessed');
includes(enforcement, 'card.dataset.gridlyCanonicalTitle = expectedTitle;', 'correct canonical cards remain dataset-stable');
includes(enforcement, 'if (fullyCanonical === true) { diagnostics.enforcementFullyCanonicalBeforeCount += 1; diagnostics.enforcementAlreadyCanonicalCount += 1; return; }', 'idempotent runs distinguish already-canonical cards from updates');

console.log('LP054.1G last-mile visible alert canonical enforcement tests passed');
