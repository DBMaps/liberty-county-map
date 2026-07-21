const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
assert(app.includes('function gridlyCountyBoundaryStateAudit'), 'county boundary state audit helper is defined');
assert(app.includes('window.gridlyCountyBoundaryStateAudit = gridlyCountyBoundaryStateAudit'), 'county boundary state audit helper is exposed on window');
assert(app.includes('gridlyCountyBoundaryOverlayLayer.clearLayers();\n  gridlyCountyBoundaryOverlayLayersById = {};'), 'render clears previous boundary overlay layers before adding active county');
assert(app.includes('staleLayers = layerCountyIds.filter((countyId) => countyId !== activeCountyId)'), 'audit reports stale non-active county layers');
assert(app.includes('displayedCountyBoundary === null || displayedCountyBoundary === activeCountyId'), 'audit validates displayed boundary matches selected county');
assert(app.includes('loadGridlyActiveCountyBoundaryIdentity("active-county-change")'), 'county switching reloads active county identity boundary instead of reusing stale boundary GeoJSON');
assert(app.includes('const activeCountyBoundaryUrl = gridlyGetActiveCountyRuntimeSources().boundarySource || LIBERTY_COUNTY_BOUNDARY_URL'), 'identity boundary loader resolves the active county runtime source');
console.log('LP043 county boundary state checks passed');
