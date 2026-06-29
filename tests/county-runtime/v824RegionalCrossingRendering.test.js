const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(appSource.includes('window.gridlyRegionalCrossingRenderingAudit = function gridlyRegionalCrossingRenderingAudit()'), 'V824 browser crossing rendering audit is exposed');
assert(appSource.includes('gridlyBuildRegionalCrossingRenderingAudit'), 'V824 regional crossing rendering audit builder is present');
assert(appSource.includes('"gridlyRegionalCrossingRenderingAudit"'), 'Regional launch experience certification includes V824 audit');
assert(appSource.includes('Regional crossing rendering audit failed.'), 'Regional launch experience certification blocks on V824 failures');
assert(!appSource.includes('activeSources?.countyId === "liberty-tx" &&'), 'Crossing provider runtime is not Liberty-only');
assert(appSource.includes('gridlyIsCountyOperational(gridlyGetActiveCountyId()) && Array.isArray(crossings) && crossings.length > 0'), 'Operational county crossing inventory can render infrastructure markers independent of zoom');
assert(appSource.includes('gridlyCountyId: gridlyGetActiveCountyId()'), 'Rendered crossing markers carry active county ownership metadata');

console.log('v824RegionalCrossingRendering.test.js passed');
