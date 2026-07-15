const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

includes('function gridlyAlertsGetActiveRenderContext()', 'Alerts render exposes a scoped per-open render context helper');
includes('gridlyAlertsOpenPerformanceAuditState.activeRenderContext = alertsOpenRenderContext;', 'openAlertsSurfaceFromDock publishes the per-open snapshot/model during render');
includes('const suppliedSnapshot = options?.snapshot || activeAlertsRenderContext?.snapshot || null;', 'community rows prefer the supplied per-open snapshot before rebuilding');
includes('Array.isArray(activeAlertsRenderContext?.presentationModel?.alerts) ? activeAlertsRenderContext.presentationModel.alerts : null', 'nested helpers can reuse the supplied per-open presentation model');
includes('const suppliedSnapshotAlerts = Array.isArray(options?.snapshot?.alerts)', 'authoritative road hazard headline accepts supplied snapshot alerts');
includes('const fallbackSnapshotAlerts = (!contextAlerts && !suppliedSnapshotAlerts', 'authoritative road hazard headline only falls back to rebuilding outside an active render context');
includes('const renderedRows = gridlyAlertsOpenAuditMeasure("DOM generation", () => ({', 'Alerts card markup is generated in a single DOM generation measurement');
includes('const animationRunId = activeAuditRun?.runId || null;', 'animation completion is scoped to the current Alerts open run id');
includes('if (!run || run.runId !== animationRunId) return;', 'stale animation completion callbacks are rejected');

const activeRenderSection = source.slice(
  source.indexOf('function getGridlyAlertsSurfaceActiveCommunityReportRows(options = {})'),
  source.indexOf('function getGridlyAlertsSurfaceActiveCommunityReportCount(options = {})')
);
assert(activeRenderSection.indexOf('const suppliedSnapshot = options?.snapshot || activeAlertsRenderContext?.snapshot || null;') < activeRenderSection.indexOf('window.getAlertsSurfaceSnapshot()'), 'community rows must check supplied snapshot before standalone fallback snapshot rebuild');

const headlineSection = source.slice(
  source.indexOf('function buildGridlyV322TopAwarenessAuthoritativeRoadHazardHeadline'),
  source.indexOf('function buildGridlyTopAwarenessSpecificHeadlineSelection')
);
assert(headlineSection.indexOf('const contextAlerts = Array.isArray(options?.presentationModel?.alerts)') < headlineSection.indexOf('window.getAlertsSurfaceSnapshot'), 'authoritative headline must check supplied model before standalone fallback snapshot rebuild');

console.log('lp004cAlertsSingleSnapshotReuse.test.js passed');
