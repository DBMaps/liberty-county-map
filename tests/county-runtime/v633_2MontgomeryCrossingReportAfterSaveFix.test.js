const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

includes('const gridlyLocalAcceptedCrossingRegistrations = new Map();', 'accepted crossing reports have a local post-save preservation registry');
includes('function gridlyRegisterAcceptedLocalCrossingReport(localCrossingEntry = {}, submittedReportId = "")', 'crossing reports register immediately after a successful save');
includes('gridlyRegisterAcceptedLocalCrossingReport(localCrossingRows[0], row.crossing_id);', 'crossing submission flow preserves the saved crossing before refresh');
includes('const localAcceptedCrossingsRestored = gridlyMergeAcceptedLocalCrossingReportsIntoActiveInventory(`loadSharedReports:${reason}`);', 'post-save refresh merges locally accepted crossing reports back into activeReports');
includes('activeReports = merged;', 'local crossing merge restores activeReports after a refresh reset');
includes('gridlyReportSubmissionOwnershipState.postSaveRefreshTriggered = true;', 'crossing save flow records post-save refresh trigger');
includes('crossingReportVisibleAfterSave', 'audit exposes crossing visibility after save');
includes('crossingReportPromotedAfterSave', 'audit exposes crossing promotion after save');
includes('crossingReportAreaFilterPass', 'audit exposes crossing area filter result');
includes('crossingReportRenderCandidateCount', 'audit exposes crossing render candidate count');
includes('lastSubmittedCrossingReportCounty', 'audit exposes last submitted crossing county');
includes('lastSubmittedCrossingReportTown', 'audit exposes last submitted crossing town');
includes('lastSubmittedCrossingReportCrossingId', 'audit exposes last submitted crossing id');
includes('lastSubmittedCrossingReportCoordinates', 'audit exposes last submitted crossing coordinates');
includes('const areaCountyId = gridlyNormalizeCountyId(area?.countyId || gridlyGetActiveCountyId());', 'countywide awareness area filtering is active-county aware');
includes('gridlyCoordinateInsideCountyBounds(coords.lat, coords.lng, areaCountyId)', 'countywide awareness area filtering uses active county bounds, not Liberty-only bounds');
includes('const crossingReportCount = explicitCrossingRows.length || activeReportRows.filter((record) => typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(record)).length', 'bottom panel keeps crossing report count separate');
includes('classifiedAsRoadHazard: row.sourceKind === "activeHazard" && !gridlyIsClearedHazardAwarenessRecord(row.item || row)', 'crossing awareness samples are not road hazards');
includes('if (category === "rail") return `Train Blocking Crossing${hasLocation ? ` near ${locationLabel}` : ""}`;', 'V633 Train Blocking Crossing wording remains unchanged');
includes('classificationActiveRoadHazardCount: safeClassificationActiveRoadHazardCount,', 'post-save restored crossing summary carries classification road hazard count before bottom fallback');
includes('activeHazards: activeHazardsInArea,\n        activeReports: activeReportsInArea,\n        unifiedIncidents: [],\n        alerts: []', 'area summary classification reconciles scoped hazards and reports without fallback sources');
includes('const safeClassificationActiveRoadHazardCount = Number.isFinite(classificationActiveRoadHazardCount)', 'classification road hazard count preserves finite zero as valid');
includes('bottomCountMatchesClassification: true', 'bottom count match remains true when classification count drives bottom hazards');

console.log('v633_2MontgomeryCrossingReportAfterSaveFix.test.js passed');
