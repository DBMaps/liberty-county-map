const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) {
  assert(source.includes(text), message);
}

function notIncludes(text, message) {
  assert(!source.includes(text), message);
}

function blockBetween(start, end, message) {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${message}: missing start marker`);
  const endIndex = source.indexOf(end, startIndex);
  assert(endIndex > startIndex, `${message}: missing end marker`);
  return source.slice(startIndex, endIndex);
}

const visibleRenderer = blockBetween(
  'const renderAlertCard = (alert, index, isHidden = false, options = {}) => {',
  'const normalizeAlertPresentationKey = (value) => cleanDisplayValue(value)',
  'actual visible Portrait Alerts card renderer'
);

includes('const rawPresentationAlerts = await cooperativePhase("presentationGroupingMs"', 'snapshot/presentation records are captured before visible rendering');
includes('const presentationAlerts = rawPresentationAlerts.map(alert => {', 'snapshot.alerts/presentation records are canonicalized before rendering');
includes('const identity = gridlyResolveCanonicalLiveIncidentIdentity(alert);', 'canonical identity is resolved during pre-render canonicalization');
includes('const presentation = gridlyBuildCanonicalLiveIncidentPresentation(alert);', 'canonical presentation is built during pre-render canonicalization');
includes('__gridlyCanonicalIdentity: identity', 'canonical identity is attached to render records');
includes('__gridlyCanonicalPresentation: presentation', 'canonical presentation is attached to render records');

assert(visibleRenderer.includes('const canonicalIdentity = alert?.__gridlyCanonicalIdentity || gridlyResolveCanonicalLiveIncidentIdentity(alert);'), 'visible renderer resolves canonical identity at the actual card callback');
assert(visibleRenderer.includes('const canonicalPresentation = alert?.__gridlyCanonicalPresentation || gridlyBuildCanonicalLiveIncidentPresentation(alert);'), 'actual data-gridly-alert-row renderer calls gridlyBuildCanonicalLiveIncidentPresentation');
assert(visibleRenderer.includes('const displayTitle = canonicalPresentation.title;'), 'visible title is owned only by canonical presentation');
assert(visibleRenderer.includes('const displayCondition = canonicalPresentation.conditionLabel;'), 'visible condition is owned only by canonical presentation');
assert(visibleRenderer.includes('const canonicalIncidentId = canonicalPresentation.incidentId || canonicalIdentity.incidentId;'), 'canonical incident id falls back through canonical identity');
assert(visibleRenderer.includes('const sourceReportId = canonicalPresentation.sourceReportId || canonicalPresentation.reportId || canonicalIdentity.sourceReportId;'), 'source report id is canonicalized');
assert(visibleRenderer.includes('const canonicalHazardType = canonicalPresentation.hazardType || canonicalIdentity.hazardType;'), 'hazard type is canonicalized');
assert(visibleRenderer.includes('const canonicalConditionFamily = canonicalPresentation.conditionFamily || canonicalIdentity.conditionFamily;'), 'condition family is canonicalized');
assert(visibleRenderer.includes('data-gridly-canonical-presentation="true"'), 'visible card root contains canonical presentation dataset');
assert(visibleRenderer.includes('data-gridly-canonical-incident-id="${esc(canonicalIncidentId || id || "")}"'), 'visible card dataset uses canonical incident id');
assert(visibleRenderer.includes('data-gridly-canonical-hazard-type="${esc(canonicalHazardType || "")}"'), 'visible card dataset uses canonical hazard type');
assert(visibleRenderer.includes('data-gridly-canonical-condition-family="${esc(canonicalConditionFamily || "")}"'), 'visible card dataset uses canonical condition family');
assert(visibleRenderer.includes('data-gridly-canonical-title="${esc(displayTitle || "")}"'), 'visible card dataset uses canonical title');
assert(visibleRenderer.includes('data-gridly-canonical-condition-label="${esc(displayCondition || "")}"'), 'visible card dataset uses canonical condition label');
assert(visibleRenderer.includes('const rawSituationSummary = gridlyAlertsOpenAuditMeasureMicro("domGenerationSubphases", "situation summary markup", () => displayCondition);'), 'visible condition text is canonical condition label');

const forbiddenVisibleOwnership = [
  'const displayTitle = normalizeGridlyCountyAwareDisplayText(canonicalPresentation.title || alert?.__gridlyEventSituationLabel',
  'canonicalPresentation.title || titleFor(alert)',
  'canonicalPresentation.title || alert?.__gridlyEventSituationLabel',
  'consumerCard.title || standardizeGridlyAlertHeadline',
  'getEventCenteredSituationSummary(alert, displayTitle)'
];
for (const pattern of forbiddenVisibleOwnership) {
  assert(!visibleRenderer.includes(pattern), `legacy visible title/condition ownership removed: ${pattern}`);
}

assert(new RegExp('function gridlyLp0541bExplicitCrossingReportOwnership[\\s\\S]*!/disabled_vehicle\\|flood\\|traffic_backup\\|heavy_delay/').test(source), 'only explicit crossing reports can own crossing titles');
assert(source.includes('if (explicitCrossingReportOwnership && /crossing_blocked|blocked_crossing|rail_crossing_blocked|rail_blockage|^blocked$/.test(token)) return "Crossing Blocked";'), 'Crossing Blocked is constrained to explicit crossing ownership');
assert(/function gridlyLp0541bCanonicalHazardLabel[\s\S]*traffic_backup[\s\S]*Traffic Backup/.test(source), 'Traffic Backup canonical pairing is available');
assert(/function gridlyLp0541bCanonicalHazardLabel[\s\S]*disabled_vehicle[\s\S]*Disabled Vehicle/.test(source), 'Disabled Vehicle canonical pairing is available');
assert(/function gridlyLp0541bCanonicalHazardLabel[\s\S]*flood[\s\S]*Flooding/.test(source), 'Flooding canonical pairing is available');
assert(/function gridlyLp0541bCanonicalConditionLabel[\s\S]*traffic_backup[\s\S]*Traffic Backup \/ Heavy Delay/.test(source), 'Traffic Backup condition pairing is available');

includes('visibleAlertLegacyNodeCount', 'audit continues to report visible legacy card count');
includes('visibleAlertCanonicalNodeCount', 'audit continues to report visible canonical card count');
includes('safeToMergeLp0541Repair', 'audit continues to gate safe merge state');
notIncludes('data-gridly-alert-hazard-type="${sanitizeText(alert?.hazardType || alert?.type', 'legacy hazard dataset ownership is not used in buildAlertsSurfaceHtml');

console.log('LP054.1E visible portrait alert renderer replacement tests passed');
