const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

// 1. Dayton duplicate flooding clears are matched across active hazards, active reports, and recently-cleared rows.
includes('function gridlyBuildClearedDuplicateRoadHazardSuppressionSources(sourceHazards = activeHazards)', 'cleared duplicate suppression sources helper is present');
includes('const reportRows = typeof activeReports !== "undefined" ? gridlyDiagnosticArray(activeReports) : [];', 'active report clear rows participate in duplicate suppression');
includes('const recentlyClearedRows = typeof recentlyClearedRoadHazards !== "undefined" ? gridlyDiagnosticArray(recentlyClearedRoadHazards) : [];', 'recently-cleared hazard rows participate in duplicate suppression');
includes('const suppressionSources = gridlyBuildClearedDuplicateRoadHazardSuppressionSources(sourceHazards);', 'duplicate suppression uses combined lifecycle sources');

// 2. Cleared duplicates cannot rehydrate as active awareness candidates.
includes('function gridlySuppressClearedDuplicateRoadHazardAwarenessCandidates(hazards = activeHazards, options = {})', 'active awareness duplicate suppression helper is present');
includes('latestActiveHazards = gridlySuppressClearedDuplicateRoadHazardAwarenessCandidates(latestActiveHazards, { sourceHazards });', 'active hazard awareness lifecycle applies duplicate suppression after latest lifecycle filtering');
includes('const matchingClear = gridlyFindRecentClearForRoadHazard(hazard, suppressionSources, recentClearIndex, nowMs);', 'duplicate suppression requires a newer matching clear');
includes('return !matchingClear;', 'matching cleared duplicates are rejected from active awareness');

// 3. Classification audit exposes post-suppression safety fields and crossing overlap after suppression.
includes('duplicateActiveHazardKeys', 'classification audit exposes duplicate active hazard keys');
includes('clearedDuplicateSuppressedCount', 'classification audit exposes suppressed duplicate count');
includes('duplicateSuppressionReason', 'classification audit exposes duplicate suppression reason');
includes('activeRoadHazardCountAfterDuplicateSuppression', 'classification audit exposes post-suppression road hazard count');
includes('overlappingCandidateKeysAfterSuppression', 'classification audit exposes post-suppression crossing overlap keys');
includes('const crossingCountedAsRoadHazard = overlappingCandidateKeysAfterSuppression.length > 0;', 'crossing safety is based on post-suppression overlap');
includes('activeRoadHazardCount: roadHazardCandidatesAfterDuplicateSuppression.length,', 'classification road hazard count honors duplicate suppression');

// 4. V633/V633.8 crossing preservation: crossing reports remain separate from road hazards.
includes('classifiedAsRoadHazard: row.sourceKind === "activeHazard" && !gridlyIsClearedHazardAwarenessRecord(row.item || row),', 'awareness candidates count only activeHazard rows as road hazards');
includes('if (typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(record)) return true;', 'crossing classifier remains intact');

console.log('v634DaytonDuplicateClearedFloodingCleanup.test.js passed');
