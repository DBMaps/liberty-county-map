const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) { assert(source.includes(text), message); }

includes('function gridlyResolveCanonicalLiveIncidentIdentity(record = {})', 'canonical live identity resolver exists');
includes('function gridlyBuildCanonicalLiveIncidentPresentation(record = {})', 'canonical live presentation builder exists');
includes('window.gridlyLp0541bHazardIdentityIntegrityAudit = gridlyLp0541bHazardIdentityIntegrityAudit', 'LP054.1B audit is exposed');
includes('data-gridly-alert-report-id=', 'alert rows carry canonical report id');
includes('data-gridly-alert-condition-family=', 'alert rows carry canonical condition family');
includes('data-gridly-alert-condition=', 'alert rows carry canonical condition label');
includes('data-gridly-canonical-incident-id=', 'markers carry canonical incident id');
includes('data-gridly-canonical-report-id=', 'markers carry canonical report id');
includes('data-gridly-canonical-hazard-type=', 'markers carry canonical hazard type');
includes('data-gridly-canonical-condition-family=', 'markers carry canonical condition family');
includes('const canonicalPresentation = gridlyBuildCanonicalLiveIncidentPresentation(incident);\n  const headline = canonicalPresentation.title', 'hazard popup title derives from canonical presentation');
includes('const canonicalPresentation = gridlyBuildCanonicalLiveIncidentPresentation(incident);\n  const title = canonicalPresentation.title || getGridlyCrossingPopupTitle(incident);', 'crossing popup title derives from canonical presentation');
includes('if (/historical_sidecar|historical/.test(sourceKindText)', 'historical sidecar records are rejected before canonical active state');
includes('const canonicalPresentation = gridlyBuildCanonicalLiveIncidentPresentation(alert);\n      alert = { ...alert', 'alert snapshot normalizes every row through canonical presentation');

const expectedLabels = ['Disabled Vehicle', 'Traffic Backup', 'Flooding', 'Crossing Blocked', 'Train Blocking Crossing'];
for (const label of expectedLabels) includes(`return "${label}"`, `${label} has a direct canonical label branch`);

const disallowedMixingPatterns = [
  'data-gridly-alert-title="${sanitizeText(displayTitle)}" data-gridly-alert-condition=',
  'const evidenceLine = canonicalEventPresentation.evidence || consumerCard.freshnessCountLine || "";'
];
for (const pattern of disallowedMixingPatterns) assert(!source.includes(pattern), `legacy mixed presentation pattern removed: ${pattern}`);

console.log('LP054.1B hazard identity integrity tests passed');
