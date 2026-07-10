const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

function includes(snippet, message) { assert(app.includes(snippet), message); }

includes('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION = "V927R-community-pulse-simulation-path-repair"', 'V927 version is declared');
includes('window.gridlyRunPerformanceRegressionSimulation = gridlyRunPerformanceRegressionSimulation', 'run helper is exposed');
includes('window.gridlyPerformanceRegressionSummary = gridlyPerformanceRegressionSummary', 'summary helper is exposed');
includes('window.gridlyResetPerformanceRegressionSimulation = gridlyResetPerformanceRegressionSimulation', 'optional reset helper is exposed');
includes('gridlyV926PersistResult(result)', 'result is persisted immediately to internal and public globals');
includes('window.gridlyPerformanceRegressionSimulationResult', 'public simulation result global is exposed');
includes('window.gridlyPerformanceMeasurementCaptureAudit = gridlyPerformanceMeasurementCaptureAudit', 'V926 capture audit helper is exposed');
includes('window.gridlyCommunityPulsePerformanceCaptureAudit = gridlyCommunityPulsePerformanceCaptureAudit', 'V927 focused Community Pulse audit helper is exposed');
includes('window.gridlyCommunityPulseSimulationPathAudit = gridlyCommunityPulseSimulationPathAudit', 'V927R simulation path audit helper is exposed');
includes('gridlyV926ArmCollectors(runId)', 'per-run collectors are armed');
includes('gridlyV926StopCollectors()', 'per-run collectors are stopped');
includes('percentile_input_empty', 'missing percentile samples are diagnosed instead of coerced to zero');
includes('result.exceptions.push', 'partial exceptions are retained');
includes('result.restorationPass', 'restoration is attempted and recorded');
includes('gridlyV927R2CaptureFinalMarkerMembership(options)', 'expected-vs-actual marker validation exists');
includes('missingMarkerIds', 'missing marker validation exists');
includes('unexpectedMarkerIds', 'unexpected marker validation exists');
includes('duplicateMarkerIds', 'duplicate marker validation exists');
includes('gridlyV925ProtectedSystemMarkers', 'protected-system markers exist');
includes('supabaseWrites: "not-called"', 'Supabase writes are protected');
includes('reportCreation: "not-called"', 'report creation is protected');
includes('reportClearing: "not-called"', 'report clearing is protected');
includes('hazardLifecycle: "unchanged"', 'hazard lifecycle is protected');
includes('alertGeneration: "render-only"', 'alert generation is not mutated');
includes('gridlyV927RecordCommunityPulseOutcome', 'Community Pulse outcome recorder exists');
includes('outcome: rendered ? "rendered" : "reused"', 'rendered and reuse outcomes are distinguished');
includes('durationMs: rendered ? refreshDurationMs : null', 'reuse-only outcomes do not manufacture zero-duration timings');
includes('communityPulseMeasurementPass', 'summary exposes Community Pulse measurement pass');
includes('communityPulseRenderedSampleAvailable', 'summary exposes rendered sample availability');
includes('communityPulseReuseOutcomeAvailable', 'summary exposes reuse outcome availability');
includes('communityPulseCaptureStatus', 'summary exposes Community Pulse capture status');
includes('key === "communityPulse" ? communityPulseAudit.validOutcomeCount <= 0', 'missing required samples accepts valid Community Pulse reuse evidence');
includes('productionPathObserved', 'Community Pulse audit requires production-path observation');
includes('evaluationObserved', 'Community Pulse audit reports production evaluation observation');
includes('captureStatus = renderedSampleCount ? "captured" : (reuseOutcomeCount ? "reused_unchanged"', 'reuse-only capture status is explicit');
includes('gridlyV927ResetCommunityPulseState()', 'reset clears Community Pulse outcome state');
includes('communityPulseRawEvents', 'raw Community Pulse diagnostic events are preserved');
assert(!/durationMs:\s*0[^\n]*reused/.test(app), 'reuse outcomes are not represented as fake zero-duration renders');
assert(!/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|clearSharedReports\s*\(/.test(app.slice(app.indexOf('GRIDLY_V925_PERFORMANCE_REGRESSION_VERSION'))), 'V927 helper does not introduce production write calls');

console.log('V927 Community Pulse performance instrumentation completion static audit passed');
