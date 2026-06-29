const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const registryBlock = appSource.slice(appSource.indexOf('const GRIDLY_COUNTY_REGISTRY'), appSource.indexOf('function gridlyIsLoadableGeoJsonSource'));
const montgomeryRoadPath = 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson';

assert(appSource.includes('window.gridlyRegionalRuntimeAssetOwnershipAudit = function gridlyRegionalRuntimeAssetOwnershipAudit()'), 'V823 browser asset ownership audit is exposed');
assert(appSource.includes('assetOwnershipAuditPassed'), 'V820 regional runtime certification includes asset ownership as a blocking check');
assert(appSource.includes('gridlyClearStaleAwarenessAreaForCountyContext(normalized, "active-county-change")'), 'active county switching clears stale awareness area context');
assert(appSource.includes('"harris-tx": Object.freeze({ south: 29.497297'), 'Harris county bounds are registered for fit-to-county runtime');

const montgomeryLeakMatches = [...registryBlock.matchAll(new RegExp(montgomeryRoadPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))];
assert.strictEqual(montgomeryLeakMatches.length, 1, 'Only Montgomery may reference the Montgomery road runtime asset');

const harrisBlock = registryBlock.slice(registryBlock.indexOf('"harris-tx"'), registryBlock.indexOf('"orange-tx"'));
assert(harrisBlock.includes('roadSegmentsPath: null'), 'Harris does not point at Montgomery roads when manufactured Harris roads are unavailable');
assert(harrisBlock.includes('roads: "unavailable"'), 'Harris roads are marked unavailable until a Harris-owned manufactured GeoJSON exists');
assert(harrisBlock.includes('localCrossingsPath: "Crossing-Packages/harris/harris-crossings.geojson"'), 'Harris crossing source remains Harris-owned');

const entryRegex = /\n  "([^"]+-tx)": Object\.freeze\(\{([\s\S]*?)\n  \}\)(?:,|\n\});/g;
const operationalRoadLeaks = [...registryBlock.matchAll(entryRegex)]
  .filter((match) => match[1] !== 'montgomery-tx' && match[2].includes(`roadSegmentsPath: "${montgomeryRoadPath}"`))
  .map((match) => match[1]);
assert.deepStrictEqual(operationalRoadLeaks, [], 'No non-Montgomery operational county points to Montgomery roads');

assert(!appSource.includes('Ã¢â‚¬Â¢'), 'Known bullet mojibake regression is absent');

console.log('v823RegionalRuntimeAssetOwnership.test.js passed');
