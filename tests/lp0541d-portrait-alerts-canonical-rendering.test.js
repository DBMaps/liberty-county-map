const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
function includes(text, message) { assert(source.includes(text), message); }

includes('function gridlyInvalidatePortraitAlertsCanonicalRenderCaches(reason = "canonical-active-state-change")', 'portrait alert cache invalidator exists');
includes('window.__gridlyLatestAlertsForRender = [];', 'latest alert render snapshot is invalidated');
includes('window.__gridlyAlertsCachedMarkup = "";', 'cached alert markup is invalidated');
includes('const canonicalIdentity = gridlyResolveCanonicalLiveIncidentIdentity(alert);', 'visible alert renderer resolves canonical identity at render time');
includes('const canonicalLivePresentation = gridlyBuildCanonicalLiveIncidentPresentation(alert);', 'visible alert renderer rebuilds canonical presentation at render time');
includes('const displayTitle = canonicalLivePresentation.title;', 'visible alert title is owned exclusively by canonical presentation');
includes('const evidenceLine = canonicalLivePresentation.conditionLabel || "";', 'visible alert condition is owned exclusively by canonical presentation');
includes('data-gridly-canonical-incident-id=', 'visible card carries canonical incident id dataset');
includes('data-gridly-source-report-id=', 'visible card carries source report id dataset');
includes('data-gridly-canonical-hazard-type=', 'visible card carries canonical hazard type dataset');
includes('data-gridly-canonical-condition-family=', 'visible card carries canonical condition family dataset');
includes('data-gridly-canonical-title=', 'visible card carries canonical title dataset');
includes('data-gridly-canonical-condition-label=', 'visible card carries canonical condition label dataset');
includes('data-gridly-canonical-presentation="true"', 'visible card marks canonical presentation ownership');
includes('visibleAlertRawNodeCount', 'audit reports raw visible card count');
includes('visibleAlertCanonicalNodeCount', 'audit reports canonical visible card count');
includes('visibleAlertLegacyNodeCount', 'audit reports legacy visible card count');
includes('visibleAlertNodesWithoutCanonicalDataset', 'audit reports nodes missing canonical datasets');
includes('visibleAlertDomTitles', 'audit reports DOM titles');
includes('visibleAlertDomConditions', 'audit reports DOM conditions');
includes('visibleAlertDomIncidentIds', 'audit reports DOM incident ids');
includes('visibleAlertDomHazardTypes', 'audit reports DOM hazard types');
includes('domTitle !== canonical.title || domCondition !== canonical.conditionLabel || domHazardType !== canonical.hazardType', 'audit compares DOM text/datasets to rebuilt canonical presentation');
includes('cachedMarkupUsed: row.dataset?.gridlyCanonicalPresentation !== "true"', 'audit mismatch records report cached markup usage');
includes('legacyFallbackUsed: row.dataset?.gridlyCanonicalPresentation !== "true"', 'audit mismatch records report legacy fallback usage');
includes('gridlyInvalidatePortraitAlertsCanonicalRenderCaches("dev-exact-id-cleanup")', 'exact-ID cleanup invalidates portrait alert caches');
includes('renderUnifiedIncidents("dev-exact-id-cleanup")', 'exact-ID cleanup rebuilds unified incidents');
includes('map.closePopup()', 'exact-ID cleanup closes stale popup');

const forbidden = [
  'const displayTitle = canonicalLivePresentation.title || canonicalEventPresentation.primaryEvent',
  'data-gridly-alert-hazard-type="${sanitizeText(alert?.hazardType || alert?.type',
  'const evidenceLine = canonicalLivePresentation.conditionLabel || canonicalEventPresentation.evidence'
];
for (const pattern of forbidden) assert(!source.includes(pattern), `legacy portrait alert ownership removed: ${pattern}`);

console.log('LP054.1D portrait alerts canonical rendering tests passed');
