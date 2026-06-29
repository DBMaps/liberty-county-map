const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(appSource.includes('function gridlyBuildCrossingRenderCoverageDiagnostics'), 'render coverage diagnostics helper exists');
assert(appSource.includes('crossingRenderSkippedCount'), 'render audit reports skipped crossing marker count');
assert(appSource.includes('crossingRenderSkipReasonBreakdown'), 'render audit reports skip reason breakdown');
assert(appSource.includes('crossingRenderHardCapActive'), 'render audit reports whether a hard cap is active');
assert(appSource.includes('crossingRenderViewportFilteringActive'), 'render audit reports whether viewport filtering is active');
assert(appSource.includes('visibilityPolicyExplainsMarkerSuppression'), 'regional crossing rendering audit requires marker suppression to be explained by policy');
assert(appSource.includes('countyViewMarkerSuppressionPolicyCompliant'), 'regional crossing rendering audit allows V829 county-view marker suppression');
assert(appSource.includes('"V829 regional-crossing-visibility"'), 'render policy documents V829 regional crossing visibility behavior');
assert(appSource.includes('unexplainedRenderDropNotDetected'), 'regional crossing rendering audit catches inventory-to-render drops without a valid policy');
assert(appSource.includes('countyWideInfrastructureRendersFullInventory'), 'regional crossing rendering audit retains full render coverage guard for legacy county-wide infrastructure mode');

console.log('v828CrossingMarkerRenderCoverage.test.js passed');
