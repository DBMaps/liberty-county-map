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

includes(enforcement, 'const fullyCanonical =', 'uses explicit full-canonical equality boolean');
includes(enforcement, 'if (fullyCanonical === true) { diagnostics.enforcementFullyCanonicalBeforeCount += 1; diagnostics.enforcementAlreadyCanonicalCount += 1; return; }', 'only fully canonical cards increment alreadyCanonicalCount');
notIncludes(enforcement, 'const alreadyCanonical =', 'removes weak partial-canonical alreadyCanonical branch');
notIncludes(enforcement, 'if (alreadyCanonical)', 'does not use legacy alreadyCanonical short-circuit');

for (const required of [
  'card.dataset.gridlyCanonicalPresentation === "true"',
  'card.dataset.gridlyCanonicalPresentationLocked === "true"',
  'card.dataset.gridlyCanonicalIncidentId === expectedIncidentId',
  'card.dataset.gridlySourceReportId === expectedReportId',
  'card.dataset.gridlyCanonicalHazardType === expectedHazardType',
  'card.dataset.gridlyCanonicalConditionFamily === expectedConditionFamily',
  'card.dataset.gridlyCanonicalTitle === expectedTitle',
  'card.dataset.gridlyCanonicalConditionLabel === expectedCondition',
  'card.dataset.gridlyTitleSource === "last-mile-canonical-enforcement"',
  'card.dataset.gridlyConditionSource === "last-mile-canonical-enforcement"',
  'card.dataset.gridlyRendererSource === "visible-alert-dom-enforcement"',
  'currentTitle === expectedTitle',
  'currentCondition === expectedCondition'
]) {
  includes(enforcement, required, `full canonical contract includes ${required}`);
}

for (const required of [
  'const expectedIncidentId = String(presentation.incidentId || identity.incidentId || "");',
  'const expectedReportId = String(presentation.sourceReportId || identity.sourceReportId || "");',
  'const expectedHazardType = String(presentation.hazardType || identity.hazardType || "");',
  'const expectedConditionFamily = String(presentation.conditionFamily || identity.conditionFamily || "");',
  'const expectedTitle = String(presentation.title || "");',
  'const expectedCondition = String(presentation.conditionLabel || "");',
  'const currentTitle = String(titleNode?.textContent || "").trim();',
  'const currentCondition = String(conditionNode?.textContent || "").trim();'
]) {
  includes(enforcement, required, `derives required comparison value: ${required}`);
}

includes(enforcement, 'diagnostics.enforcementMatchedCanonicalRecordCount += 1;', 'matched canonical records are counted');
includes(enforcement, 'diagnostics.enforcementPartiallyCanonicalCount += 1;', 'partial canonical cards are counted before repair');
includes(enforcement, 'diagnostics.enforcementTitleUpdatedCount += 1;', 'title updates are counted');
includes(enforcement, 'diagnostics.enforcementConditionUpdatedCount += 1;', 'condition updates are counted');
includes(enforcement, 'diagnostics.enforcementDatasetsUpdatedCount += 1;', 'dataset updates are counted');
includes(enforcement, 'diagnostics.enforcementConditionNodeCreatedCount += 1;', 'condition node creation is counted');
includes(enforcement, 'diagnostics.enforcementUpdatedCount += 1;', 'non-fully canonical cards are counted as updated');

includes(enforcement, 'titleNode.textContent = expectedTitle;', 'wrong visible titles are synchronously overwritten');
includes(enforcement, 'conditionNode.textContent = expectedCondition;', 'blank or wrong visible conditions are synchronously overwritten');
includes(enforcement, 'document.createElement("div")', 'missing canonical condition node is created');
includes(enforcement, 'conditionNode.setAttribute("data-gridly-alert-condition-node", "true")', 'created/existing condition node is stamped with canonical selector');
includes(enforcement, 'titleNode.insertAdjacentElement("afterend", conditionNode)', 'condition node is inserted immediately after title');

for (const stamp of [
  'card.dataset.gridlyCanonicalPresentation = "true";',
  'card.dataset.gridlyCanonicalPresentationLocked = "true";',
  'card.dataset.gridlyCanonicalIncidentId = expectedIncidentId;',
  'card.dataset.gridlySourceReportId = expectedReportId;',
  'card.dataset.gridlyCanonicalHazardType = expectedHazardType;',
  'card.dataset.gridlyCanonicalConditionFamily = expectedConditionFamily;',
  'card.dataset.gridlyCanonicalTitle = expectedTitle;',
  'card.dataset.gridlyCanonicalConditionLabel = expectedCondition;',
  'card.dataset.gridlyTitleSource = "last-mile-canonical-enforcement";',
  'card.dataset.gridlyConditionSource = "last-mile-canonical-enforcement";',
  'card.dataset.gridlyRendererSource = "visible-alert-dom-enforcement";'
]) {
  includes(enforcement, stamp, `mandatory dataset is stamped: ${stamp}`);
}

for (const metric of [
  'enforcementMatchedCanonicalRecordCount',
  'enforcementFullyCanonicalBeforeCount',
  'enforcementPartiallyCanonicalCount',
  'enforcementUpdatedCount',
  'enforcementTitleUpdatedCount',
  'enforcementConditionUpdatedCount',
  'enforcementDatasetsUpdatedCount',
  'enforcementConditionNodeCreatedCount'
]) {
  includes(source, metric, `diagnostic object exposes ${metric}`);
  includes(audit, metric, `LP054.1B audit returns ${metric}`);
}

for (const forbidden of ['MutationObserver', 'setInterval(', 'requestAnimationFrame(() => gridlyEnforceCanonicalPresentationOnVisibleAlertCards', 'setTimeout(() => gridlyEnforceCanonicalPresentationOnVisibleAlertCards']) {
  notIncludes(enforcement, forbidden, `no timers/polling/observer introduced: ${forbidden}`);
}

includes(source, 'return "Flooding"', 'Flooding remains the canonical title/condition source');
includes(source, 'Traffic Backup / Heavy Delay', 'Traffic Backup heavy-delay canonical presentation remains available');
notIncludes(enforcement, 'Crossing Blocked', 'broken Flooding card cannot keep Crossing Blocked in last-mile enforcement');
notIncludes(enforcement, 'Train Blocking Crossing', 'Traffic Backup card cannot keep crossing renderer text in last-mile enforcement');
includes(enforcement, 'container.querySelectorAll(\n      ".gridly-alert-row[data-gridly-alert-row=\'true\']"\n    )', 'enforcement stays scoped to existing visible alert cards, not another renderer');
includes(enforcement, 'if (fullyCanonical === true)', 'correct canonical cards remain unchanged');
includes(enforcement, 'return;', 'fully canonical or unmatchable cards return without rewriting buttons or handlers');

console.log('LP054.1H remove last-mile partial canonical skip tests passed');
