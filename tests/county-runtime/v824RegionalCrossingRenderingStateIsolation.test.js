const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(appSource.includes('async function gridlyAwaitActiveCountyCrossingInventoryLoad'), 'Regional crossing audit awaits the active county inventory load');
assert(appSource.includes('gridlyCrossingInventoryReloadPromise.gridlyTargetCountyId === activeCountyId'), 'Inventory wait is scoped to the active county reload promise');
assert(appSource.includes('function gridlyCrossingSampleMatchesCounty'), 'Crossing sample county ownership verifier exists');
assert(appSource.includes('inventoryCountyMatchesActiveCounty'), 'Regional audit fails clearly when inventory samples do not match the active county');
assert(appSource.includes('runtimeCrossingInventoryCountPositiveWhenInventoryExists'), 'Regional audit asserts runtime inventory is loaded before rendering');
assert(appSource.includes('firstRuntimeCrossingSample'), 'Regional audit reports the first runtime crossing sample for county mismatch diagnosis');
assert(appSource.includes('crossingSourceCounty: sources?.countyId || null'), 'Regional audit reports the active crossing source county');
assert(appSource.includes('function gridlyGetActiveCountyCrossingInventory'), 'Render path has an active-county crossing inventory accessor');
assert(appSource.includes('const activeCountyCrossings = gridlyGetActiveCountyCrossingInventory();'), 'renderCrossings uses active county inventory instead of raw global crossings');
assert(appSource.includes('!activeCountyCrossingIds.has(String(crossing.id)) || !gridlyCrossingSampleMatchesCounty(crossing, activeCountyId)'), 'renderCrossings filters out stale cross-county crossing records');
assert(appSource.includes('crossingMarkers.clear();\n    }\n    gridlyCrossingRenderAuditState.renderCallCount'), 'renderCrossings clears stale markers when active county inventory is empty or mismatched');
assert(appSource.includes('await gridlyAwaitActiveCountyCrossingInventoryLoad("regional-crossing-rendering-audit-restore")'), 'Regional audit restores the original active county and inventory after completion');

console.log('v824RegionalCrossingRenderingStateIsolation.test.js passed');
