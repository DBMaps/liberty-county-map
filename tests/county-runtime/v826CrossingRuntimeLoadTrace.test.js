const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const adapterSource = fs.readFileSync('js/gridlyCrossingPackageAdapter.js', 'utf8');
const providerSource = fs.readFileSync('js/gridlyCrossingProvider.js', 'utf8');

assert.ok(appSource.includes('async function gridlyCrossingLoadTraceAudit'), 'browser crossing load trace helper is defined');
assert.ok(appSource.includes('window.gridlyCrossingLoadTraceAudit = gridlyCrossingLoadTraceAudit'), 'browser crossing load trace helper is exposed on window');
assert.ok(appSource.includes('function gridlyFindCrossingCountDropStage'), 'count-drop-stage helper exists');
assert.ok(appSource.includes('current < previous'), 'count-drop-stage logic detects the first decreasing stage');
assert.ok(appSource.includes('runtimeCrossingSourcePath'), 'trace reports runtime crossing source path');
assert.ok(appSource.includes('rawFetchedJSONFeatureCount'), 'trace reports raw fetched JSON feature count');
assert.ok(appSource.includes('declaredCrossingCount'), 'trace reports declared crossingCount');
assert.ok(appSource.includes('renderInputCount'), 'trace reports render input count');
assert.ok(appSource.includes('renderedMarkerCount'), 'trace reports rendered marker count');
assert.ok(appSource.includes('bottomPanelCrossingCount'), 'trace reports bottom panel crossing count');
assert.ok(appSource.includes('firstCrossingId') && appSource.includes('lastCrossingId'), 'trace includes first and last crossing IDs');
assert.ok(appSource.includes('firstCountyName') && appSource.includes('lastCountyName'), 'trace includes first and last county names');
assert.ok(appSource.includes('crossingLoadTraceAudit: gridlyCrossingFallbackAuditState.crossingLoadTraceAudit'), 'crossing pipeline audit includes load trace result');
assert.ok(adapterSource.includes('getLastLoadTrace'), 'adapter exposes last load trace');
assert.ok(providerSource.includes('getLastLoadTrace'), 'provider exposes last load trace');

console.log('v826CrossingRuntimeLoadTrace.test.js passed');
