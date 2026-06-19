const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyReportVisibilityPipelineAudit()'), 'Report visibility pipeline audit helper exists');
assert(source.includes('window.gridlyReportVisibilityPipelineAudit = gridlyReportVisibilityPipelineAudit;'), 'Pipeline audit helper is exposed on window');
assert(source.includes('droppedAtStage'), 'Pipeline audit reports the first dropped stage');
assert(source.includes('dropReason'), 'Pipeline audit reports the drop reason');

assert(source.includes('const rawCountyId = row?.county_id || row?.countyId || row?.raw?.county_id || row?.raw?.countyId;'), 'Active county matching accepts normalized countyId and raw county metadata');
assert(source.includes('String(gridlyGetReportCountyId(row) || "").trim().toLowerCase()'), 'Active county matching can recover county ownership from structured report metadata');
const pipelineSlice = source.slice(source.indexOf('function gridlyReportVisibilityPipelineAudit()'), source.indexOf('function gridlyRoadHazardDuplicateGuardClusterKey'));
assert(!/montgomery-tx/i.test(pipelineSlice), 'Report visibility pipeline audit is not Montgomery-specific');

assert(source.includes('activeHazards = [localHazardEntry'), 'Accepted road hazards enter activeHazards immediately');
assert(source.includes('gridlyRecordReportSubmissionOwnershipAccepted(localHazardEntry, "hazard")'), 'Accepted road hazards record post-registration visibility');
assert(source.includes('const filteredActiveCountyRows = sharedRows.filter((report) => gridlyReportMatchesActiveCounty(report, activeCounty));'), 'Pipeline audit checks the active county visible set');
assert(source.includes('const clusterInputRows = typeof gridlyFilterRoadHazardsByLatestLifecycle === "function"'), 'Pipeline audit checks cluster input');
assert(source.includes('const alertInputRows = ['), 'Pipeline audit checks alert input');
assert(source.includes('const markerInputRows = typeof getUnifiedIncidents === "function" ? getUnifiedIncidents() : liveHazardIncidents;'), 'Pipeline audit checks marker input');
assert(source.includes('const activeAwareness = typeof getGridlyAwarenessLifecycleActiveHazards === "function"'), 'Pipeline audit checks awareness counting');

assert(source.includes('gridlyFilterRoadHazardsByLatestLifecycle(activeHazardRows, Date.now())'), 'Accepted non-Liberty hazards enter generalized lifecycle/marker/alert/awareness pipeline');
assert(source.includes('gridlyReportVisibilityMatchesLastReport(row, lastReportId)'), 'Pipeline audit identifies a filtered-out report by the submitted report id');
assert(source.includes('safeForActiveCountyReportVisibility: Boolean(reportAccepted && inSharedReports && inFilteredActiveCountySet'), 'Pipeline audit requires the active county visibility path to be complete');
assert(source.includes('visible_for_active_county'), 'Existing Montgomery report submission audit reports the expected visible_for_active_county status');
assert(source.includes('activeCountyVisibleCount'), 'Existing report audit still counts active-county-visible reports');

console.log('Report visibility pipeline V622 tests passed');
