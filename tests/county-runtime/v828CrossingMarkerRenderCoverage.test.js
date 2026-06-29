const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(appSource.includes('function gridlyBuildCrossingRenderCoverageDiagnostics'), 'render coverage diagnostics helper exists');
assert(appSource.includes('crossingRenderSkippedCount'), 'render audit reports skipped crossing marker count');
assert(appSource.includes('crossingRenderSkipReasonBreakdown'), 'render audit reports skip reason breakdown');
assert(appSource.includes('crossingRenderHardCapActive'), 'render audit reports whether a hard cap is active');
assert(appSource.includes('crossingRenderViewportFilteringActive'), 'render audit reports whether viewport filtering is active');
assert(appSource.includes('const countyWideInfrastructure = showInfrastructureMarkers && (activeGeoFilter === "county" || activeGeoFilter === "all") && gridlyIsCountyOperational(activeCountyId);'), 'operational county county/all mode is treated as county-wide infrastructure');
assert(appSource.includes('const prioritizedVisibleCrossings = priorityAnchor && !countyWideInfrastructure'), 'nearest-anchor cap is bypassed for county-wide infrastructure rendering');
assert(appSource.includes('"all-active-county-infrastructure"'), 'render policy documents full active county infrastructure rendering');
assert(appSource.includes('unexplainedRenderDropNotDetected'), 'regional crossing rendering audit catches inventory-to-render drops without a valid policy');
assert(appSource.includes('countyWideInfrastructureRendersFullInventory'), 'regional crossing rendering audit requires full render coverage for county-wide infrastructure mode');

console.log('v828CrossingMarkerRenderCoverage.test.js passed');
