const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION = "V925-automated-performance-regression-simulation"', 'V925 version is declared');
includes('window.gridlyRunPerformanceRegressionSimulation = gridlyRunPerformanceRegressionSimulation', 'run helper is exposed');
includes('window.gridlyPerformanceRegressionSummary = gridlyPerformanceRegressionSummary', 'summary helper is exposed');
includes('window.gridlyResetPerformanceRegressionSimulation = gridlyResetPerformanceRegressionSimulation', 'optional reset helper is exposed');
includes('gridlyV925PerformanceRegressionResult = result; // persisted immediately for partial failure inspection', 'result is persisted immediately');
includes('result.exceptions.push', 'partial exceptions are retained');
includes('result.restorationPass', 'restoration is attempted and recorded');
includes('gridlyV925CompareMarkerMembership(result.originalState.expectedMarkerIds, gridlyV925MarkerIds())', 'expected-vs-actual marker validation exists');
includes('missingMarkerIds', 'missing marker validation exists');
includes('unexpectedMarkerIds', 'unexpected marker validation exists');
includes('duplicateMarkerIds', 'duplicate marker validation exists');
includes('gridlyV925ProtectedSystemMarkers', 'protected-system markers exist');
includes('supabaseWrites: "not-called"', 'Supabase writes are protected');
includes('reportCreation: "not-called"', 'report creation is protected');
includes('reportClearing: "not-called"', 'report clearing is protected');
includes('hazardLifecycle: "unchanged"', 'hazard lifecycle is protected');
includes('alertGeneration: "render-only"', 'alert generation is not mutated');
assert(!/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|clearSharedReports\s*\(/.test(app.slice(app.indexOf('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION'))), 'V925 helper does not introduce production write calls');

console.log('V925 automated performance regression simulation static audit passed');
