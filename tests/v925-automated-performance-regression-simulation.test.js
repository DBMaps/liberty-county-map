const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION = "V926-performance-measurement-capture-repair"', 'V925 version is declared');
includes('window.gridlyRunPerformanceRegressionSimulation = gridlyRunPerformanceRegressionSimulation', 'run helper is exposed');
includes('window.gridlyPerformanceRegressionSummary = gridlyPerformanceRegressionSummary', 'summary helper is exposed');
includes('window.gridlyResetPerformanceRegressionSimulation = gridlyResetPerformanceRegressionSimulation', 'optional reset helper is exposed');
includes('gridlyV926PersistResult(result)', 'result is persisted immediately to internal and public globals');
includes('window.gridlyPerformanceRegressionSimulationResult', 'public simulation result global is exposed');
includes('window.gridlyPerformanceMeasurementCaptureAudit = gridlyPerformanceMeasurementCaptureAudit', 'V926 capture audit helper is exposed');
includes('gridlyV926ArmCollectors(runId)', 'per-run collectors are armed');
includes('gridlyV926StopCollectors()', 'per-run collectors are stopped');
includes('percentile_input_empty', 'missing percentile samples are diagnosed instead of coerced to zero');
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

console.log('V926 performance measurement capture repair static audit passed');
