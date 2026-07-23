const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function blockBetween(start, end, message) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${message}: missing start marker`);
  const endIndex = source.indexOf(end, startIndex);
  assert(endIndex > startIndex, `${message}: missing end marker`);
  return source.slice(startIndex, endIndex);
}

const renderComplete = blockBetween(
  'const RenderCompleteAlertCard = (phase2Contract) => {',
  'const renderAlertCard = (alert, index, isHidden = false, options = {}) => {',
  'RenderCompleteAlertCard final sink'
);
const renderAlertCard = blockBetween(
  'const renderAlertCard = (alert, index, isHidden = false, options = {}) => {',
  'const normalizeAlertPresentationKey = (value) => cleanDisplayValue(value)',
  'visible alert renderer callback'
);
const auditDom = blockBetween(
  'function gridlyIsElementActuallyVisible(element) {',
  'function gridlyLp0541bHazardIdentityIntegrityAudit() {',
  'actual visible DOM audit helpers'
);
const audit = blockBetween(
  'function gridlyLp0541bHazardIdentityIntegrityAudit() {',
  'if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp0541bHazardIdentityIntegrityAudit", gridlyLp0541bHazardIdentityIntegrityAudit);',
  'hazard identity audit'
);

assert(renderAlertCard.includes('const canonicalRenderContract = {'), 'renderAlertCard creates final locked canonical render contract');
assert(renderAlertCard.includes('canonicalPresentationLocked: true'), 'final contract marks canonical presentation locked');
assert(renderAlertCard.includes('title: canonicalPresentation.title'), 'final contract title comes from canonical presentation');
assert(renderAlertCard.includes('headline: canonicalPresentation.title'), 'final contract headline comes from canonical presentation');
assert(renderAlertCard.includes('conditionLabel: canonicalPresentation.conditionLabel'), 'final contract condition comes from canonical presentation');
assert(renderAlertCard.includes('situationSummary: canonicalPresentation.conditionLabel'), 'final contract situation summary comes from canonical presentation');
assert(renderAlertCard.includes('evidenceLine: canonicalPresentation.conditionLabel'), 'final contract evidence line is locked to canonical condition');
assert(renderAlertCard.includes('RenderCompleteAlertCard(canonicalRenderContract)'), 'final sink receives locked contract');

assert(renderComplete.includes('if (phase2Contract.canonicalPresentationLocked === true) {'), 'RenderCompleteAlertCard honors canonicalPresentationLocked');
assert(renderComplete.includes('displayTitle = phase2Contract.canonicalTitle || phase2Contract.title || "";'), 'locked branch uses canonical title verbatim');
assert(renderComplete.includes('displayCondition = phase2Contract.canonicalConditionLabel || phase2Contract.conditionLabel || "";'), 'locked branch uses canonical condition verbatim');
assert(renderComplete.includes('canonicalHazardType = phase2Contract.hazardType || "";'), 'locked branch uses canonical hazard type verbatim');
assert(renderComplete.includes('canonicalConditionFamily = phase2Contract.conditionFamily || "";'), 'locked branch uses canonical condition family verbatim');
assert(renderComplete.includes('canonicalIncidentId = phase2Contract.incidentId || "";'), 'locked branch uses canonical incident id verbatim');
assert(renderComplete.includes('sourceReportId = phase2Contract.sourceReportId || "";'), 'locked branch uses source report id verbatim');

const lockedBranch = renderComplete.slice(renderComplete.indexOf('if (phase2Contract.canonicalPresentationLocked === true) {'), renderComplete.indexOf('} else {'));
for (const forbidden of ['buildAlertTitle', 'buildGridlyAlertCardConsumerModel', 'Crossing Blocked', 'Train Blocking Crossing', 'crossingDisplayName', 'alert.title', 'alert.headline', 'source record headline', 'titleFor', 'situationTitle', 'primaryLabel']) {
  assert(!lockedBranch.includes(forbidden), `locked branch does not use legacy title source: ${forbidden}`);
}

assert(renderComplete.includes('data-gridly-canonical-presentation="true"'), 'final root contains canonical presentation dataset');
assert(renderComplete.includes('data-gridly-canonical-presentation-locked="true"'), 'final root contains canonical-presentation-locked');
assert(renderComplete.includes('data-gridly-renderer-source="RenderCompleteAlertCard"'), 'final root identifies RenderCompleteAlertCard as renderer source');
assert(renderComplete.includes('data-gridly-title-source="canonical-live-presentation"'), 'title source is canonical-live-presentation');
assert(renderComplete.includes('data-gridly-condition-source="canonical-live-presentation"'), 'condition source is canonical-live-presentation');
assert(renderComplete.includes('data-gridly-canonical-title="${esc(displayTitle)}"'), 'canonical Flooding title cannot be overwritten by Crossing Blocked');
assert(renderComplete.includes('data-gridly-canonical-condition-label="${esc(displayCondition)}"'), 'canonical conditions cannot be overwritten after lock');
assert(!lockedBranch.includes('Train Blocking Crossing'), 'canonical Traffic Backup cannot become Train Blocking Crossing in locked sink');
assert(!lockedBranch.includes('crossing'), 'canonical Disabled Vehicle cannot become a crossing title in locked sink');

assert(auditDom.includes('function gridlyIsElementActuallyVisible(element)'), 'actual visibility helper exists');
assert(auditDom.includes('element.isConnected === false'), 'visibility checks connected DOM');
assert(auditDom.includes('getBoundingClientRect'), 'visibility checks rendered dimensions');
assert(auditDom.includes('style.display === "none"'), 'visibility rejects display none');
assert(auditDom.includes('style.visibility === "hidden"'), 'visibility rejects visibility hidden');
assert(auditDom.includes('style.opacity === "0"'), 'visibility rejects opacity zero');
assert(auditDom.includes('String(element.getAttribute?.("aria-hidden") || "").toLowerCase() === "true"'), 'visibility rejects aria-hidden true');
assert(auditDom.includes('const visibleAlertsSheetOpen = Boolean(visibleContainer && isVisible(visibleContainer) && alertsHeadingVisible && alertsCloseVisible);'), 'open state is derived from actual visible DOM without data-active-sheet');
assert(!auditDom.includes('visibleAlertsSheetOpen: Boolean(document.querySelector("#gridlyPortraitV2Sheet[data-active-sheet'), 'audit no longer depends solely on data-active-sheet');
assert(auditDom.includes('".gridly-alert-row[data-gridly-alert-row=\'true\']"'), 'audit locates final visible cards by required row selector');

for (const metric of ['visibleAlertCanonicalPresentationLockedCount', 'visibleAlertCanonicalTitleSourceCount', 'visibleAlertCanonicalConditionSourceCount', 'visibleAlertRenderCompleteCardCount']) {
  assert(audit.includes(metric), `audit reports ${metric}`);
}
assert(audit.includes('visibleAlertDomTitles'), 'audit reports visible card title text');
assert(audit.includes('visibleAlertDomConditions'), 'audit reports visible card condition text');
assert(audit.includes('visibleAlertDomHazardTypes'), 'audit reports canonical hazard type');
assert(audit.includes('visibleAlertDomConditionFamilies'), 'audit reports canonical condition family');
assert(audit.includes('visibleAlertTitleSources'), 'audit reports title source');
assert(audit.includes('visibleAlertConditionSources'), 'audit reports condition source');
assert(audit.includes('visibleAlertRendererSources'), 'audit reports renderer source');

console.log('LP054.1F final alert card sink repair tests passed');
