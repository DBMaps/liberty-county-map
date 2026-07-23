const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) { assert(app.includes(text), message); }
function order(before, after, message) {
  const a = app.indexOf(before);
  const b = app.indexOf(after);
  assert(a >= 0 && b >= 0 && a < b, message);
}

includes('function gridlyLp0534dAlertCountConvergenceAudit()', 'LP053.4D passive audit exists');
includes('window.gridlyLp0534dAlertCountConvergenceAudit = gridlyLp0534dAlertCountConvergenceAudit;', 'LP053.4D audit is exposed on window');
includes('milestone: "LP053.4D"', 'LP053.4D audit reports the milestone');
includes('alertsDerivedFromCanonicalState: true', 'audit certifies Alerts derives from canonical state');
includes('alertRendererUsesCurrentLifecycleState: true', 'audit certifies renderer uses current lifecycle state');
includes('alertAuditUsesCurrentLifecycleState: true', 'audit certifies audit uses current lifecycle state');
includes('alertDomMatchesRenderedState', 'audit checks DOM rows against rendered state');
includes('alertActiveCount !== canonicalActiveCount', 'audit fails when Alerts and canonical counts disagree');
includes('alertActiveCount !== unifiedIncidentActiveCount', 'audit fails when Alerts and unified incidents disagree');
includes('alertActiveCount !== markerActiveCount', 'audit fails when Alerts and markers disagree');
includes('canonicalActiveRecords = !options?.skipCanonicalSource', 'Alerts active rows prefer canonical active community records');
includes('return canonicalActiveRecords;', 'Alerts active row helper returns canonical active records before cache fallback');
includes('canonicalActiveCommunityState = typeof gridlyGetCanonicalActiveCommunityState', 'Alerts snapshot acquires canonical active community state');
includes('const incidents = canonicalActiveCommunityRecords || getActiveUnifiedIncidents();', 'Alerts renderer snapshot derives incidents from canonical state before independent unified fallback');
includes('const reports = gridlyAlertsOpenAuditMeasure("community alert collection", () => canonicalActiveCommunityRecords', 'community alert collection uses canonical records before legacy activeReports/fallbackHazards');
includes('window.__gridlyLatestAlertsForRender = [];', 'immediate clear invalidates cached alert render list for refresh-free convergence');
includes('gridly-alert-empty-state', 'empty alert rows remain identifiable so hidden/header/empty rows are not active alerts');
includes('!node.classList?.contains("gridly-alert-empty-state")', 'LP053.4D DOM check excludes empty rows');
includes('!node.hasAttribute?.("data-gridly-alert-hidden")', 'LP053.4D DOM check excludes hidden rows');
includes('gridlyAlertsGetActiveRenderContext', 'cached active render context is traced');
includes('__gridlyLatestAlertsForRender', 'cached alert render list is traced');
order('gridlyLp0534cInvalidateCurrentStateModels(`lp0534c:${kind}`);', 'if (typeof renderAlerts === "function") renderAlerts();', 'alert renderer rebuild happens after canonical/cache invalidation');

console.log('LP053.4D alert count convergence structural checks passed');
