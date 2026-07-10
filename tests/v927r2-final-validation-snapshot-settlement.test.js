const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('async function gridlyV927R2AwaitSettledFinalMarkers', 'final validation waits for crossing generations to settle');
includes('!activeGenerations.length && signature === previousSignature', 'marker membership must be stable while no generations are active');
includes('if (stableFrames >= 2) return { settled: true', 'settlement requires two bounded stable animation frames');
includes('return { settled: false', 'timeout is reported as unsettled, not accepted as settled');
includes('const expectedMarkerIds = gridlyV925ExpectedMarkerIds();', 'expected marker IDs are computed after settlement');
includes('const actualMarkerIds = gridlyV925MarkerIds();', 'actual marker IDs are read after expected snapshot');
includes('generationStartedBetweenSnapshots', 'generation changes between snapshots are detected');
includes('for (let attempt = 0; attempt < 2; attempt += 1)', 'snapshot capture retries once after generation changes');
includes('activeGenerationIds', 'failure diagnostics report active generation IDs');
includes('generationBeforeExpectedSnapshot', 'failure diagnostics report generation before expected snapshot');
includes('generationBeforeActualSnapshot', 'failure diagnostics report generation before actual snapshot');
includes('expectedSnapshotMarkerCount', 'failure diagnostics report expected snapshot marker count');
includes('actualSnapshotMarkerCount', 'failure diagnostics report actual snapshot marker count');
includes('missingMarkerIds.length === 0 && unexpectedMarkerIds.length === 0 && duplicateMarkerIds.length === 0', 'marker correctness checks remain strict');
assert(!/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|clearSharedReports\s*\(/.test(app.slice(app.indexOf('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION'))), 'V927R.2 final validation does not introduce production write calls');
console.log('V927R.2 final validation snapshot settlement static test passed');
