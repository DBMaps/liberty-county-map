const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(appSource.includes('version: "V829 regional-crossing-visibility"'), 'V829 regional crossing visibility policy is versioned');
assert(appSource.includes('const isCountyViewSuppressionPolicy = effectiveVisibilityPolicy === GRIDLY_REGIONAL_CROSSING_VISIBILITY_POLICY.version'), 'regional audit recognizes the V829 county-view suppression policy');
assert(appSource.includes('const countyViewMarkerSuppressionPolicyCompliant = inventoryCount > 0'), 'county-view suppression requires positive inventory');
assert(appSource.includes('&& bottomPanelDisplayedCrossingCount === inventoryCount'), 'county-view suppression requires bottom panel inventory preservation');
assert(appSource.includes('/hide individual crossing markers/i.test(effectiveExpectedMarkerBehavior)'), 'county-view suppression requires expected marker behavior documentation');
assert(appSource.includes('visibilityPolicyExplainsMarkerSuppression'), 'regional audit fails zero markers without an explanatory visibility policy');
assert(appSource.includes('streetOrNeighborhoodZoom'), 'regional audit keeps zoomed-in marker validation for neighborhood and street zoom');
assert(appSource.includes('renderedMarkerCount > 0'), 'regional audit requires rendered markers when zoomed in and markers are allowed');

console.log('v829RegionalCrossingVisibilityPolicyAudit.test.js passed');
