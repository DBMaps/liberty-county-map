const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

includes('function gridlyGetCrossingReportEligibility(crossing = {})', 'crossing report eligibility helper exists');
includes('id === "920159J"', 'FRA-920159J / TX 321 is explicitly treated as non-reportable');
includes('non_at_grade_position', 'non-at-grade crossing positions are rejected');
includes('grade-separated crossing is not eligible for blocked-crossing reports', 'blocked report submission is prevented for underpass crossings');
includes('const sorted = [...crossings].filter(isGridlyReportableCrossing).sort', 'manual crossing report candidates exclude underpass crossings');
includes('return crossings\n    .filter(isGridlyReportableCrossing)', 'nearest crossing candidates exclude underpass crossings');
includes('filteredRailIncidentSource.filter((incident) => isGridlyReportableCrossingRecord', 'non-reportable rail records cannot produce train-blocking incident language');
includes('linkedReports.filter((report) => ["active", "recently_cleared", "cleared"].includes(getIncidentLifecycleState(report)) && isGridlyReportableCrossingRecord(report))', 'movement-impact promotion excludes non-reportable crossing reports');
includes('reportEligibility: gridlyGetCrossingReportEligibility', 'normalized crossing inventory carries eligibility diagnostics');
