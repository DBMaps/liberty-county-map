const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

// 1. Helper is exposed.
includes('window.gridlyAwarenessClassificationAudit = function gridlyAwarenessClassificationAudit(options = {})', 'awareness classification audit helper is exposed on window');
includes('function gridlyBuildAwarenessClassificationAudit(options = {})', 'awareness classification audit builder is present');

// 2. A crossing-like record classified as crossing is not counted as road hazard in the diagnostic expectation.
includes('function gridlyAwarenessClassificationAuditIsCrossing(record = {})', 'diagnostic crossing classifier is present');
includes('if (typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(record)) return true;', 'diagnostic accepts existing crossing classifier evidence');
includes('if (String(sourcePath || "").includes("activeHazards")) return true;', 'road-hazard classification is source-path explicit instead of auto-promoting crossing reports');

// 3. An ambiguous other_hazard record with crossing text is detected as potential overlap.
includes('return /\\b(?:rail|train|crossing|blocked crossing|blocking crossing)\\b/i.test(gridlyAwarenessClassificationAuditText(record));', 'crossing text is inspected even when the runtime crossing classifier rejects ambiguous other_hazard rows');
includes('return /hazard|flood|debris|crash|closure|construction|disabled|other_hazard/.test(type);', 'other_hazard remains a road-hazard diagnostic signal for overlap detection');

// 4. overlappingCandidateKeys reports shared keys.
includes('const roadKeys = new Set(roadHazardCandidates.map((candidate) => candidate.key));', 'road candidate keys are indexed');
includes('const overlappingCandidateKeys = crossingCandidates.map((candidate) => candidate.key).filter((key) => roadKeys.has(key));', 'overlapping crossing/road hazard keys are reported');

// 5. safeForAwarenessClassification is false when crossing overlap exists.
includes('const crossingCountedAsRoadHazard = overlappingCandidateKeys.length > 0;', 'crossing overlap boolean is derived from shared keys');
includes('safeForAwarenessClassification: !crossingCountedAsRoadHazard', 'classification safety fails when overlap exists');

// 6. Audit does not mutate runtime state.
includes('const gridlyAwarenessClassificationAuditStateSnapshot = {', 'audit snapshots mutable diagnostic state before inspection');
includes('gridlyAlertAreaFilterState = gridlyAwarenessClassificationAuditStateSnapshot.gridlyAlertAreaFilterState;', 'audit restores crossing/alert area filter state after inspection');
includes('lifecycleAuditReadOnly: true', 'audit invokes lightweight awareness in read-only lifecycle mode');

// Required evidence surfaces.
includes('["activeHazards", sourceActiveHazards]', 'audit inspects activeHazards');
includes('["activeReports", sourceActiveReports]', 'audit inspects activeReports');
includes('["unifiedIncidents", sourceUnifiedIncidents]', 'audit inspects unified incidents');
includes('["alertCandidates", sourceAlerts]', 'audit inspects alert candidates');
includes('awarenessCandidates', 'audit reports awareness candidates');
includes('selectedTopAwarenessDetail', 'audit reports selected top awareness detail when accessible');

console.log('v631AwarenessClassificationDiagnostic.test.js passed');
