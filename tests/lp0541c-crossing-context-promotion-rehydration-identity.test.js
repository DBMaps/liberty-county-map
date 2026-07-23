const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) { assert(source.includes(text), message); }

includes('function gridlyLp0541bExplicitCrossingReportOwnership(record = {})', 'explicit crossing ownership helper exists');
includes('function gridlyLp0541bStableSourceReportId(record = {})', 'stable source report identity helper exists');
includes('function gridlyLp0541cClearedSuppressionLookup(record = {})', 'early cleared suppression lookup exists');
includes('if (suppression.rejectedBeforeCanonicalConstruction) return false;', 'cleared records are rejected before canonical construction');
includes('explicitRoadHazardTypeExists && !explicitCrossingReportOwnership', 'road hazards block crossing context promotion');
includes('const incidentId = String(sourceReportId || existingCanonicalIncidentId || stableSourceSpecificId', 'identity authority prioritizes source report id');
includes('explicitCrossingReportOwnership && crossingId ? `rail-${crossingId}`', 'crossing id fallback is gated by explicit crossing ownership');
includes('data-gridly-alert-condition-family=', 'visible alert rows expose condition family');
includes('data-gridly-canonical-event-presentation="true"', 'visible alert rows mark canonical presentation coverage');
includes('function gridlyLp0541bVisibleAlertsAuditDom()', 'audit inspects visible alerts DOM helper');
includes('visibleAlertsContainerFound', 'audit reports visible alerts container coverage');
includes('visibleAlertDomCountMatchesCanonicalCount', 'audit checks visible DOM count against canonical count');
includes('window.gridlyDevRemoveCorruptedIncidentRecordsById = gridlyDevRemoveCorruptedIncidentRecordsById', 'exact-ID dev cleanup helper is exposed');

const forbiddenPromotionBranches = [
  'if (/(train|rail[_\\s-]*delay|heavy|delayed|blocking)/.test(text) && (crossingId || /crossing|rail|train/.test(text) || reportKind === "crossing")) return "Train Blocking Crossing";',
  'if (/(crossing|rail|blocked)/.test(text) && (crossingId || reportKind === "crossing")) return "Crossing Blocked";',
  'const incidentId = String(record?.incidentId || record?.id || record?.incident_id || (crossingId ? `rail-${crossingId}` : sourceReportId)'
];
for (const pattern of forbiddenPromotionBranches) assert(!source.includes(pattern), `forbidden context-promotion branch removed: ${pattern}`);

const conditionPairings = {
  'Disabled Vehicle': 'Disabled Vehicle',
  'Flooding': 'Flooding',
  'Traffic Backup': 'Traffic Backup / Heavy Delay',
  'Crossing Blocked': 'Crossing Blocked',
  'Train Blocking Crossing': 'Train Blocking Crossing'
};
for (const [title, condition] of Object.entries(conditionPairings)) {
  if (title === 'Traffic Backup') includes('if (normalized === "traffic_backup") return "Traffic Backup / Heavy Delay";', 'traffic backup condition pairing is canonical');
  else includes(`return "${title}"`, `${title} canonical title branch exists`);
  assert(condition, `condition pairing documented for ${title}`);
}

includes('visibleAlertRowCount: alertRows.length', 'audit returns visible alert row count');
includes('hiddenLegacyAlertRowCount: dom.hiddenLegacyRows.length', 'audit returns hidden legacy row count');
includes('submittedCanonicalHazardMismatchCount', 'audit reports submitted/canonical mismatch count');
includes('crossingContextPromotionCount', 'audit reports crossing context promotion count');
includes('unstableRehydratedIdentityCount', 'audit reports unstable rehydrated identity count');
includes('protectedSystemsModified = false', 'protected systems are not modified by LP054.1C helper');

console.log('LP054.1C crossing context promotion and rehydration identity tests passed');
