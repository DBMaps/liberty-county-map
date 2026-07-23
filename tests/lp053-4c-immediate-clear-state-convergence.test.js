const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(app.includes(needle), message);
}

includes('function gridlyApplyImmediateClearLifecycleConvergence(options = {})', 'central immediate clear convergence helper exists');
includes('gridlyFilterRoadHazardsByLatestLifecycle(hazardInputs, nowMs)', 'road hazard immediate clear reuses authoritative latest lifecycle filter');
includes('gridlyFilterRecentlyClearedRoadHazardsForVisibility(hazardInputs, nowMs)', 'road hazard immediate clear rebuilds recently-cleared evidence with authoritative visibility filter');
includes('activeReports = [clearRow, ...(Array.isArray(activeReports) ? activeReports : []).filter((report) => String(report?.crossingId || report?.crossing_id || "") !== String(clearRow.crossingId || clearRow.crossing_id || options.crossingId || ""))];', 'crossing immediate clear replaces prior active crossing state with clear latest-state input');
includes('gridlyLp0534cInvalidateCurrentStateModels(`lp0534c:${kind}`);', 'canonical/cache invalidation occurs after local lifecycle arrays update');
includes('const canonical = gridlyGetCanonicalActiveCommunityState();', 'canonical state is recomputed before render chain');
includes('renderUnifiedIncidents(`lp0534c-${kind}-unified-${generation}`)', 'unified incidents rebuild after canonical recompute');
includes('refreshReportHazardViews(`lp0534c-${kind}-current-state-${generation}`)', 'single current-state refresh runs from convergence helper');
includes('updateNearestContext()', 'Location Context updates after canonical recompute');
includes('gridlyLp0534cClearConvergenceGeneration', 'generation guard exists');
includes('staleGenerationSuppressionCount += 1', 'older loadSharedReports result can be suppressed after clear convergence generation advances');
includes('function gridlyLp0534cRecordAuthoritativeRefreshConvergence(reason = "loadSharedReports")', 'authoritative refresh comparison diagnostic exists');
includes('convergenceMismatchCount += 1', 'safe mismatch counter records immediate-versus-authoritative divergence');
includes('window.gridlyLp0534cImmediateClearStateConvergenceAudit = gridlyLp0534cImmediateClearStateConvergenceAudit;', 'LP053.4C passive audit is exposed');
includes('window.gridlyLp0534bUnifiedActiveCommunityStateAudit = gridlyLp0534bUnifiedActiveCommunityStateAudit;', 'LP053.4B audit remains exposed');

console.log('LP053.4C immediate clear convergence structural checks passed');
